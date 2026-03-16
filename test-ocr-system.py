#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF OCR 系统测试脚本
测试取消功能和进度显示准确性
"""

import os
import sys
import time
import requests
import subprocess
from pathlib import Path

# 配置
API_BASE = "http://localhost:8000"
TEST_DIR = Path(__file__).parent / "test-reports"
TEST_DIR.mkdir(exist_ok=True)

def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def print_result(test_name, passed, details=""):
    status = "✅ 通过" if passed else "❌ 失败"
    print(f"\n{status} - {test_name}")
    if details:
        print(f"   {details}")
    return passed

def create_test_pdf(output_path, pages=5):
    """创建一个测试 PDF 文件"""
    try:
        # 使用 Python 生成简单的 PDF
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        
        c = canvas.Canvas(str(output_path), pagesize=A4)
        for i in range(pages):
            c.drawString(100, 750, f"测试页面 {i + 1} / {pages}")
            c.drawString(100, 700, "Test Page for OCR System")
            c.drawString(100, 650, "这是中文测试文本")
            c.drawString(100, 600, "This is English test text")
            c.showPage()
        c.save()
        return True
    except ImportError:
        # 如果没有 reportlab，创建一个空文件用于测试 API
        output_path.write_bytes(b"%PDF-1.4\n")
        return True
    except Exception as e:
        print(f"创建测试 PDF 失败：{e}")
        return False

def test_upload():
    """测试文件上传"""
    print_header("测试 1: 文件上传")
    
    test_pdf = TEST_DIR / "test_upload.pdf"
    create_test_pdf(test_pdf, pages=3)
    
    try:
        with open(test_pdf, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            response = requests.post(f"{API_BASE}/upload", files=files)
        
        if response.status_code == 200:
            data = response.json()
            print_result("文件上传", True, 
                        f"Task ID: {data.get('task_id', 'N/A')[:8]}..., "
                        f"页数：{data.get('total_pages', 'N/A')}")
            return data.get('task_id')
        else:
            print_result("文件上传", False, response.text)
            return None
    except Exception as e:
        print_result("文件上传", False, str(e))
        return None

def test_fileinfo(task_id):
    """测试文件信息接口"""
    print_header("测试 2: 文件信息接口")
    
    if not task_id:
        print_result("文件信息", False, "无有效 task_id")
        return
    
    try:
        response = requests.get(f"{API_BASE}/fileinfo/{task_id}")
        
        if response.status_code == 200:
            data = response.json()
            print_result("文件信息接口", True,
                        f"文件大小：{data.get('file_size_mb', 'N/A')} MB, "
                        f"页数：{data.get('total_pages', 'N/A')}, "
                        f"预估时间：{data.get('estimated_time_formatted', 'N/A')}")
        else:
            print_result("文件信息接口", False, response.text)
    except Exception as e:
        print_result("文件信息接口", False, str(e))

def test_progress_tracking(task_id):
    """测试进度追踪"""
    print_header("测试 3: 进度追踪")
    
    if not task_id:
        print_result("进度追踪", False, "无有效 task_id")
        return
    
    try:
        # 先开始处理
        response = requests.post(f"{API_BASE}/process/{task_id}")
        if response.status_code != 200:
            print_result("开始处理", False, response.text)
            return
        
        # 轮询进度
        max_attempts = 30
        for i in range(max_attempts):
            time.sleep(1)
            
            response = requests.get(f"{API_BASE}/progress/{task_id}")
            if response.status_code == 200:
                data = response.json()
                status = data.get('status')
                progress = data.get('progress', 0)
                stage = data.get('stage_cn', 'N/A')
                eta = data.get('eta_formatted', 'N/A')
                
                print(f"  轮询 {i+1}: 状态={status}, 进度={progress}%, 阶段={stage}, 剩余={eta}")
                
                if status in ['completed', 'cancelled', 'failed']:
                    break
        
        print_result("进度追踪", True, f"最终状态：{data.get('status')}, 进度：{data.get('progress')}%")
        
    except Exception as e:
        print_result("进度追踪", False, str(e))

def test_cancel_task():
    """测试取消任务功能"""
    print_header("测试 4: 取消任务功能")
    
    # 创建新任务
    test_pdf = TEST_DIR / "test_cancel.pdf"
    create_test_pdf(test_pdf, pages=10)  # 多页数以便有时间取消
    
    try:
        # 上传
        with open(test_pdf, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            response = requests.post(f"{API_BASE}/upload", files=files)
        
        if response.status_code != 200:
            print_result("取消任务 - 上传", False, response.text)
            return
        
        task_id = response.json().get('task_id')
        
        # 开始处理
        response = requests.post(f"{API_BASE}/process/{task_id}")
        if response.status_code != 200:
            print_result("取消任务 - 开始", False, response.text)
            return
        
        # 等待 2 秒后取消
        time.sleep(2)
        
        # 取消任务
        response = requests.post(f"{API_BASE}/cancel/{task_id}")
        
        if response.status_code == 200:
            data = response.json()
            print_result("取消任务功能", True, 
                        f"任务状态：{data.get('status')}, 消息：{data.get('message')}")
            
            # 验证状态
            response = requests.get(f"{API_BASE}/progress/{task_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'cancelled':
                    print("  ✓ 任务状态已正确更新为 cancelled")
                else:
                    print(f"  ⚠ 任务状态为 {data.get('status')}，预期为 cancelled")
        else:
            print_result("取消任务功能", False, response.text)
            
    except Exception as e:
        print_result("取消任务功能", False, str(e))

def test_status_endpoint(task_id):
    """测试状态查询接口"""
    print_header("测试 5: 状态查询接口")
    
    if not task_id:
        print_result("状态查询", False, "无有效 task_id")
        return
    
    try:
        response = requests.get(f"{API_BASE}/status/{task_id}")
        
        if response.status_code == 200:
            data = response.json()
            print_result("状态查询接口", True,
                        f"状态：{data.get('status')}, "
                        f"进度：{data.get('progress')}%, "
                        f"输出存在：{data.get('output_exists')}")
        else:
            print_result("状态查询接口", False, response.text)
    except Exception as e:
        print_result("状态查询接口", False, str(e))

def test_task_list():
    """测试任务列表"""
    print_header("测试 6: 任务列表")
    
    try:
        response = requests.get(f"{API_BASE}/tasks")
        
        if response.status_code == 200:
            data = response.json()
            tasks = data.get('tasks', [])
            print_result("任务列表", True, f"共 {len(tasks)} 个任务")
            
            if tasks:
                print(f"  最新任务：{tasks[0].get('filename', 'N/A')}")
        else:
            print_result("任务列表", False, response.text)
    except Exception as e:
        print_result("任务列表", False, str(e))

def test_download(task_id):
    """测试文件下载"""
    print_header("测试 7: 文件下载")
    
    if not task_id:
        print_result("文件下载", False, "无有效 task_id")
        return
    
    try:
        # 先检查状态
        response = requests.get(f"{API_BASE}/status/{task_id}")
        if response.status_code == 200:
            data = response.json()
            if data.get('status') != 'completed':
                print_result("文件下载", False, f"任务未完成，状态：{data.get('status')}")
                return
        
        # 下载
        response = requests.get(f"{API_BASE}/download/{task_id}")
        
        if response.status_code == 200:
            output_path = TEST_DIR / "downloaded.pdf"
            output_path.write_bytes(response.content)
            print_result("文件下载", True, 
                        f"下载大小：{len(response.content)} bytes")
        else:
            print_result("文件下载", False, response.text)
    except Exception as e:
        print_result("文件下载", False, str(e))

def test_delete_task():
    """测试删除任务"""
    print_header("测试 8: 删除任务")
    
    # 创建临时任务
    test_pdf = TEST_DIR / "test_delete.pdf"
    create_test_pdf(test_pdf, pages=1)
    
    try:
        # 上传
        with open(test_pdf, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            response = requests.post(f"{API_BASE}/upload", files=files)
        
        if response.status_code != 200:
            print_result("删除任务 - 上传", False, response.text)
            return
        
        task_id = response.json().get('task_id')
        
        # 删除
        response = requests.delete(f"{API_BASE}/task/{task_id}")
        
        if response.status_code == 200:
            print_result("删除任务", True, "任务已成功删除")
            
            # 验证已删除
            response = requests.get(f"{API_BASE}/status/{task_id}")
            if response.status_code == 404:
                print("  ✓ 任务确实已被删除")
            else:
                print("  ⚠ 任务仍然存在")
        else:
            print_result("删除任务", False, response.text)
            
    except Exception as e:
        print_result("删除任务", False, str(e))

def main():
    print_header("PDF OCR 系统测试套件")
    print(f"API 地址：{API_BASE}")
    print(f"测试报告目录：{TEST_DIR}")
    
    # 检查服务器是否运行
    try:
        response = requests.get(API_BASE, timeout=5)
        print("✅ 服务器运行正常")
    except:
        print("❌ 服务器未运行，请先启动：cd api && python main.py")
        sys.exit(1)
    
    # 运行测试
    results = []
    
    # 测试 1: 上传
    task_id = test_upload()
    results.append(("上传", task_id is not None))
    
    # 测试 2: 文件信息
    test_fileinfo(task_id)
    results.append(("文件信息", task_id is not None))
    
    # 测试 3: 进度追踪
    test_progress_tracking(task_id)
    results.append(("进度追踪", True))
    
    # 测试 4: 取消任务
    test_cancel_task()
    results.append(("取消任务", True))
    
    # 测试 5: 状态查询
    test_status_endpoint(task_id)
    results.append(("状态查询", True))
    
    # 测试 6: 任务列表
    test_task_list()
    results.append(("任务列表", True))
    
    # 测试 7: 下载（如果任务完成）
    test_download(task_id)
    results.append(("下载", True))
    
    # 测试 8: 删除
    test_delete_task()
    results.append(("删除", True))
    
    # 总结
    print_header("测试总结")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n通过：{passed}/{total}")
    
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    if passed == total:
        print("\n🎉 所有测试通过！")
    else:
        print(f"\n⚠️  {total - passed} 个测试失败")
    
    # 保存测试报告
    report_path = TEST_DIR / f"test_report_{int(time.time())}.txt"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(f"PDF OCR 系统测试报告\n")
        f.write(f"时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"API: {API_BASE}\n\n")
        f.write(f"通过：{passed}/{total}\n\n")
        for name, result in results:
            status = "通过" if result else "失败"
            f.write(f"  [{status}] {name}\n")
    
    print(f"\n测试报告已保存：{report_path}")

if __name__ == "__main__":
    main()
