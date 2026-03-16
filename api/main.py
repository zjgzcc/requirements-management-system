#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF OCR 系统 API - 支持进度显示和任务取消功能
"""

import os
import sys
import json
import time
import uuid
import shutil
import asyncio
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 配置
BASE_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"
WEB_DIR = BASE_DIR / "web"

# 确保目录存在
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# 全局任务管理字典
# task_id → {
#     "status": str,  # pending, processing, completed, failed, cancelled
#     "process": subprocess.Popen or None,
#     "total_pages": int,
#     "processed_pages": int,
#     "start_time": float,
#     "file_size": int,
#     "input_file": str,
#     "output_file": str,
#     "stage": str,  # uploaded, analyzing, ocr, optimizing, completed
#     "progress": float,  # 0-100
#     "eta_seconds": float,
#     "error": str or None,
#     "avg_time_per_page": float
# }
tasks: Dict[str, Dict[str, Any]] = {}

# 历史处理速度记录（用于估算时间）
processing_history: list = []

app = FastAPI(title="PDF OCR API", version="2.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件
if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


def get_page_count(pdf_path: str) -> int:
    """使用 pdfinfo 获取 PDF 页数"""
    try:
        result = subprocess.run(
            ["pdfinfo", pdf_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        for line in result.stdout.split("\n"):
            if line.startswith("Pages:"):
                return int(line.split(":")[1].strip())
    except Exception as e:
        print(f"获取页数失败：{e}")
    return 0


def parse_ocrmypdf_progress(stderr_text: str) -> tuple:
    """
    解析 OCRmyPDF 的进度输出
    返回：(processed_pages, total_pages, current_stage)
    """
    processed = 0
    total = 0
    stage = "ocr"
    
    lines = stderr_text.split("\n")
    for line in lines:
        # 匹配进度信息，如 "INFO - ocrmypdf.pdfinfo - Page 3 of 10"
        if "Page" in line and "of" in line:
            try:
                parts = line.split("Page")
                if len(parts) > 1:
                    page_part = parts[-1]
                    nums = page_part.split("of")
                    if len(nums) == 2:
                        processed = int(nums[0].strip())
                        total = int(nums[1].strip())
            except:
                pass
        
        # 检测阶段
        if "analyzing" in line.lower() or "分析" in line.lower():
            stage = "analyzing"
        elif "ocr" in line.lower():
            stage = "ocr"
        elif "optimizing" in line.lower() or "优化" in line.lower():
            stage = "optimizing"
    
    return processed, total, stage


async def monitor_process(task_id: str, process: subprocess.Popen):
    """监控 OCR 进程并更新进度"""
    task = tasks.get(task_id)
    if not task:
        return
    
    stderr_text = ""
    start_time = time.time()
    
    try:
        # 实时读取 stderr
        while True:
            line = process.stderr.readline()
            if not line and process.poll() is not None:
                break
            
            if line:
                line_str = line.decode('utf-8', errors='ignore')
                stderr_text += line_str
                
                # 解析进度
                processed, total, stage = parse_ocrmypdf_progress(stderr_text)
                
                if total > 0:
                    task["processed_pages"] = processed
                    task["total_pages"] = total
                    task["stage"] = stage
                    task["progress"] = (processed / total) * 100
                    
                    # 计算预估时间
                    elapsed = time.time() - start_time
                    if processed > 0:
                        avg_time = elapsed / processed
                        task["avg_time_per_page"] = avg_time
                        remaining = total - processed
                        task["eta_seconds"] = remaining * avg_time
            
            await asyncio.sleep(0.5)
        
        # 进程结束
        returncode = process.wait()
        elapsed = time.time() - start_time
        
        if returncode == 0:
            task["status"] = "completed"
            task["progress"] = 100
            task["stage"] = "completed"
            task["eta_seconds"] = 0
            
            # 记录到历史
            if task["total_pages"] > 0:
                processing_history.append({
                    "pages": task["total_pages"],
                    "time": elapsed,
                    "time_per_page": elapsed / task["total_pages"]
                })
                # 保留最近 100 条记录
                if len(processing_history) > 100:
                    processing_history.pop(0)
        else:
            task["status"] = "failed"
            task["error"] = f"OCR 进程退出码：{returncode}"
            
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
    finally:
        # 清理进程引用
        if task_id in tasks:
            tasks[task_id]["process"] = None


@app.get("/", response_class=HTMLResponse)
async def root():
    """返回前端页面"""
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return JSONResponse({"error": "前端页面未找到"})


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传 PDF 文件并创建任务"""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="只支持 PDF 文件")
    
    # 生成任务 ID
    task_id = str(uuid.uuid4())
    
    # 保存文件
    input_path = UPLOAD_DIR / f"{task_id}_{file.filename}"
    output_path = OUTPUT_DIR / f"{task_id}_output.pdf"
    
    try:
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        file_size = len(content)
        page_count = get_page_count(str(input_path))
        
        # 初始化任务信息
        tasks[task_id] = {
            "status": "pending",
            "process": None,
            "total_pages": page_count,
            "processed_pages": 0,
            "start_time": None,
            "file_size": file_size,
            "input_file": str(input_path),
            "output_file": str(output_path),
            "stage": "uploaded",
            "progress": 0,
            "eta_seconds": 0,
            "error": None,
            "avg_time_per_page": 0,
            "filename": file.filename
        }
        
        return JSONResponse({
            "task_id": task_id,
            "filename": file.filename,
            "file_size": file_size,
            "total_pages": page_count,
            "message": "文件上传成功，开始处理"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败：{str(e)}")


@app.post("/process/{task_id}")
async def process_file(task_id: str, background_tasks: BackgroundTasks):
    """开始处理 PDF 文件"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    if task["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"任务状态：{task['status']}")
    
    input_file = task["input_file"]
    output_file = task["output_file"]
    
    if not os.path.exists(input_file):
        raise HTTPException(status_code=404, detail="输入文件不存在")
    
    # 更新任务状态
    task["status"] = "processing"
    task["start_time"] = time.time()
    task["stage"] = "analyzing"
    
    # 构建 OCRmyPDF 命令
    cmd = [
        "ocrmypdf",
        "--progress-bar",
        "--output-type", "pdf",
        "--language", "chi_sim+eng",  # 中文 + 英文
        "--optimize", "3",
        input_file,
        output_file
    ]
    
    try:
        # 启动子进程
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(BASE_DIR)
        )
        
        task["process"] = process
        
        # 在后台监控进程
        background_tasks.add_task(monitor_process, task_id, process)
        
        return JSONResponse({
            "task_id": task_id,
            "status": "processing",
            "message": "开始处理 PDF 文件"
        })
        
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        raise HTTPException(status_code=500, detail=f"处理失败：{str(e)}")


@app.post("/cancel/{task_id}")
async def cancel_task(task_id: str):
    """取消正在处理的任务"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    if task["status"] != "processing":
        raise HTTPException(status_code=400, detail=f"任务状态为 {task['status']}，无法取消")
    
    # 终止进程
    process = task.get("process")
    if process:
        try:
            # 先尝试温和终止
            process.terminate()
            
            # 等待 5 秒
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # 如果没终止，强制杀死
                process.kill()
                process.wait(timeout=5)
            
            task["status"] = "cancelled"
            task["stage"] = "cancelled"
            task["progress"] = 0
            task["eta_seconds"] = 0
            
            # 清理临时文件
            try:
                if os.path.exists(task["input_file"]):
                    os.remove(task["input_file"])
                if os.path.exists(task["output_file"]):
                    os.remove(task["output_file"])
            except:
                pass
            
            return JSONResponse({
                "task_id": task_id,
                "status": "cancelled",
                "message": "任务已取消"
            })
            
        except Exception as e:
            task["status"] = "failed"
            task["error"] = f"取消失败：{str(e)}"
            raise HTTPException(status_code=500, detail=f"取消失败：{str(e)}")
    else:
        task["status"] = "cancelled"
        return JSONResponse({
            "task_id": task_id,
            "status": "cancelled",
            "message": "任务已取消"
        })


@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    """获取任务进度"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    # 计算进度信息
    progress = task["progress"]
    eta_seconds = task["eta_seconds"]
    
    # 格式化剩余时间
    eta_formatted = ""
    if eta_seconds > 0 and task["status"] == "processing":
        if eta_seconds < 60:
            eta_formatted = f"{int(eta_seconds)}秒"
        elif eta_seconds < 3600:
            eta_formatted = f"{int(eta_seconds / 60)}分{int(eta_seconds % 60)}秒"
        else:
            eta_formatted = f"{int(eta_seconds / 3600)}小时{int((eta_seconds % 3600) / 60)}分"
    
    # 阶段中文映射
    stage_map = {
        "uploaded": "已上传",
        "analyzing": "分析中",
        "ocr": "OCR 中",
        "optimizing": "优化中",
        "completed": "已完成",
        "cancelled": "已取消",
        "failed": "失败"
    }
    
    stage_cn = stage_map.get(task["stage"], task["stage"])
    
    return JSONResponse({
        "task_id": task_id,
        "status": task["status"],
        "stage": task["stage"],
        "stage_cn": stage_cn,
        "progress": round(progress, 2),
        "processed_pages": task["processed_pages"],
        "total_pages": task["total_pages"],
        "eta_seconds": round(eta_seconds, 2),
        "eta_formatted": eta_formatted,
        "file_size": task["file_size"],
        "error": task["error"],
        "start_time": task["start_time"],
        "avg_time_per_page": round(task["avg_time_per_page"], 2)
    })


@app.get("/fileinfo/{task_id}")
async def get_file_info(task_id: str):
    """获取文件信息"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    # 获取文件大小（MB）
    file_size_mb = round(task["file_size"] / (1024 * 1024), 2)
    
    # 估算处理时间（基于历史数据）
    estimated_time = 0
    if task["total_pages"] > 0 and processing_history:
        avg_time_per_page = sum(
            h["time_per_page"] for h in processing_history
        ) / len(processing_history)
        estimated_time = task["total_pages"] * avg_time_per_page
    
    estimated_time_formatted = ""
    if estimated_time > 0:
        if estimated_time < 60:
            estimated_time_formatted = f"{int(estimated_time)}秒"
        elif estimated_time < 3600:
            estimated_time_formatted = f"{int(estimated_time / 60)}分{int(estimated_time % 60)}秒"
        else:
            estimated_time_formatted = f"{int(estimated_time / 3600)}小时{int((estimated_time % 3600) / 60)}分"
    
    return JSONResponse({
        "task_id": task_id,
        "filename": task.get("filename", "未知"),
        "file_size": task["file_size"],
        "file_size_mb": file_size_mb,
        "total_pages": task["total_pages"],
        "estimated_time_seconds": round(estimated_time, 2),
        "estimated_time_formatted": estimated_time_formatted,
        "input_file": task["input_file"],
        "output_file": task["output_file"]
    })


@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """获取任务完整状态"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    # 检查输出文件是否存在
    output_exists = os.path.exists(task["output_file"]) if task["output_file"] else False
    
    return JSONResponse({
        "task_id": task_id,
        "status": task["status"],
        "stage": task["stage"],
        "progress": task["progress"],
        "processed_pages": task["processed_pages"],
        "total_pages": task["total_pages"],
        "file_size": task["file_size"],
        "filename": task.get("filename", "未知"),
        "error": task["error"],
        "output_exists": output_exists,
        "output_file": task["output_file"] if output_exists else None,
        "start_time": task["start_time"],
        "completed_time": time.time() if task["status"] == "completed" else None
    })


@app.get("/download/{task_id}")
async def download_file(task_id: str):
    """下载处理后的文件"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="任务未完成")
    
    output_file = task["output_file"]
    if not os.path.exists(output_file):
        raise HTTPException(status_code=404, detail="输出文件不存在")
    
    from fastapi.responses import FileResponse
    
    filename = task.get("filename", "output.pdf")
    output_filename = f"OCR_{filename}"
    
    return FileResponse(
        path=output_file,
        filename=output_filename,
        media_type="application/pdf"
    )


@app.get("/tasks")
async def list_tasks():
    """列出所有任务"""
    task_list = []
    for task_id, task in tasks.items():
        task_list.append({
            "task_id": task_id,
            "filename": task.get("filename", "未知"),
            "status": task["status"],
            "progress": task["progress"],
            "total_pages": task["total_pages"],
            "start_time": task["start_time"]
        })
    
    # 按开始时间倒序
    task_list.sort(key=lambda x: x["start_time"] or 0, reverse=True)
    
    return JSONResponse({"tasks": task_list})


@app.delete("/task/{task_id}")
async def delete_task(task_id: str):
    """删除任务及其文件"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    # 如果任务正在处理，先取消
    if task["status"] == "processing":
        process = task.get("process")
        if process:
            process.terminate()
            try:
                process.wait(timeout=5)
            except:
                process.kill()
    
    # 删除文件
    try:
        if os.path.exists(task["input_file"]):
            os.remove(task["input_file"])
        if os.path.exists(task["output_file"]):
            os.remove(task["output_file"])
    except:
        pass
    
    # 从字典中移除
    del tasks[task_id]
    
    return JSONResponse({"message": "任务已删除"})


if __name__ == "__main__":
    print("=" * 60)
    print("PDF OCR 系统 API 服务器")
    print("=" * 60)
    print(f"上传目录：{UPLOAD_DIR}")
    print(f"输出目录：{OUTPUT_DIR}")
    print(f"Web 目录：{WEB_DIR}")
    print("=" * 60)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
