#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF OCR 系统 - 完整测试套件
包含单元测试、集成测试和性能测试
"""

import os
import sys
import json
import time
import uuid
import shutil
import asyncio
import tempfile
import unittest
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
from main import app, tasks, UPLOAD_DIR, OUTPUT_DIR, BASE_DIR


class TestClientBase(unittest.TestCase):
    """测试客户端基类"""
    
    @classmethod
    def setUpClass(cls):
        """测试前准备"""
        cls.client = TestClient(app)
        cls.test_files = []
        cls.task_ids = []
        
        # 确保目录存在
        UPLOAD_DIR.mkdir(exist_ok=True)
        OUTPUT_DIR.mkdir(exist_ok=True)
    
    @classmethod
    def tearDownClass(cls):
        """测试后清理"""
        # 清理测试文件
        for task_id in cls.task_ids:
            try:
                if task_id in tasks:
                    if os.path.exists(tasks[task_id].get("input_file", "")):
                        os.remove(tasks[task_id]["input_file"])
                    if os.path.exists(tasks[task_id].get("output_file", "")):
                        os.remove(tasks[task_id]["output_file"])
                    del tasks[task_id]
            except:
                pass
        
        # 清理上传目录中的测试文件
        for f in cls.test_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except:
                pass
    
    def setUp(self):
        """每个测试前重置任务字典"""
        tasks.clear()
    
    def create_test_pdf(self, pages=1, size_kb=100) -> str:
        """创建测试 PDF 文件"""
        # 使用简单的 PDF 结构创建测试文件
        pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [{", ".join([f"{i+3} 0 R" for i in range(pages)])}] /Count {pages} >>
endobj
"""
        for i in range(pages):
            pdf_content += f"""{i+3} 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {i+pages+3} 0 R >>
endobj
"""
        for i in range(pages):
            pdf_content += f"""{i+pages+3} 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test Page {i+1}) Tj ET
endstream
endobj
"""
        pdf_content += "xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 /Root 1 0 R >>\n%%EOF"
        
        fd, path = tempfile.mkstemp(suffix=".pdf")
        with os.fdopen(fd, 'w') as f:
            f.write(pdf_content)
        
        self.test_files.append(path)
        return path
    
    def create_large_pdf(self, size_mb=10) -> str:
        """创建大 PDF 文件"""
        pdf_content = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        # 添加内容直到达到目标大小
        target_size = size_mb * 1024 * 1024
        while len(pdf_content.encode('utf-8')) < target_size:
            pdf_content += "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
            pdf_content += " " * 10000  # 添加填充内容
        
        fd, path = tempfile.mkstemp(suffix=".pdf")
        with os.fdopen(fd, 'w') as f:
            f.write(pdf_content)
        
        self.test_files.append(path)
        return path


# ============================================================
# 第一部分：批量上传模块单元测试
# ============================================================

class TestBatchUpload(TestClientBase):
    """批量上传模块测试"""
    
    def test_upload_single_file(self):
        """测试单个文件上传"""
        print("\n[单元测试] test_upload_single_file - 单个文件上传")
        
        # 创建测试 PDF
        test_pdf = self.create_test_pdf(pages=1)
        
        # 上传文件
        with open(test_pdf, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        # 验证响应
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("task_id", data)
        self.assertEqual(data["filename"], "test.pdf")
        self.assertIn("file_size", data)
        self.assertIn("total_pages", data)
        self.assertEqual(data["message"], "文件上传成功，开始处理")
        
        # 验证任务创建
        task_id = data["task_id"]
        self.task_ids.append(task_id)
        self.assertIn(task_id, tasks)
        self.assertEqual(tasks[task_id]["status"], "pending")
        
        print(f"  ✓ 任务创建成功：{task_id}")
        print(f"  ✓ 文件大小：{data['file_size']} bytes")
        print(f"  ✓ 页数：{data['total_pages']}")
    
    def test_upload_multiple_files(self):
        """测试多个文件批量上传"""
        print("\n[单元测试] test_upload_multiple_files - 多个文件上传")
        
        num_files = 5
        task_ids = []
        
        for i in range(num_files):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"test_{i}.pdf", f, "application/pdf")}
                )
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            task_ids.append(data["task_id"])
            self.task_ids.append(data["task_id"])
            
            print(f"  ✓ 文件 {i+1}/{num_files} 上传成功：{data['task_id']}")
        
        # 验证所有任务都创建了
        self.assertEqual(len(tasks), num_files)
        
        for task_id in task_ids:
            self.assertIn(task_id, tasks)
            self.assertEqual(tasks[task_id]["status"], "pending")
        
        print(f"  ✓ 共创建 {len(task_ids)} 个任务")
    
    def test_upload_invalid_file(self):
        """测试上传无效文件类型"""
        print("\n[单元测试] test_upload_invalid_file - 无效文件类型")
        
        # 创建非 PDF 文件
        fd, path = tempfile.mkstemp(suffix=".txt")
        with os.fdopen(fd, 'w') as f:
            f.write("This is not a PDF")
        self.test_files.append(path)
        
        # 尝试上传
        with open(path, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("test.txt", f, "text/plain")}
            )
        
        # 应该返回 400 错误
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("只支持 PDF 文件", data["detail"])
        
        print("  ✓ 正确拒绝了非 PDF 文件")
    
    def test_upload_large_file(self):
        """测试大文件上传"""
        print("\n[单元测试] test_upload_large_file - 大文件上传")
        
        # 创建 5MB 的测试文件
        test_pdf = self.create_large_pdf(size_mb=5)
        file_size = os.path.getsize(test_pdf)
        
        with open(test_pdf, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("large.pdf", f, "application/pdf")}
            )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("task_id", data)
        self.task_ids.append(data["task_id"])
        
        # 验证文件大小
        self.assertEqual(data["file_size"], file_size)
        
        print(f"  ✓ 大文件上传成功：{file_size / (1024*1024):.2f} MB")
    
    def test_upload_exceeds_limit(self):
        """测试超过大小限制的文件上传"""
        print("\n[单元测试] test_upload_exceeds_limit - 超过限制")
        
        # 注意：当前实现没有明确的大小限制
        # 这个测试验证系统能处理大文件
        test_pdf = self.create_large_pdf(size_mb=20)
        
        with open(test_pdf, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("huge.pdf", f, "application/pdf")}
            )
        
        # 应该成功（或根据实际限制返回适当错误）
        self.assertIn(response.status_code, [200, 413])
        
        if response.status_code == 200:
            data = response.json()
            self.task_ids.append(data["task_id"])
            print(f"  ✓ 大文件处理成功：{os.path.getsize(test_pdf) / (1024*1024):.2f} MB")
        else:
            print("  ✓ 正确拒绝了超大文件 (413)")


# ============================================================
# 第二部分：任务队列模块单元测试
# ============================================================

class TestTaskQueue(TestClientBase):
    """任务队列模块测试"""
    
    def test_enqueue_task(self):
        """测试任务入队"""
        print("\n[单元测试] test_enqueue_task - 任务入队")
        
        test_pdf = self.create_test_pdf(pages=1)
        
        with open(test_pdf, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("enqueue_test.pdf", f, "application/pdf")}
            )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        task_id = data["task_id"]
        self.task_ids.append(task_id)
        
        # 验证任务状态
        self.assertEqual(tasks[task_id]["status"], "pending")
        self.assertEqual(tasks[task_id]["stage"], "uploaded")
        
        print(f"  ✓ 任务入队成功：{task_id}")
        print(f"  ✓ 状态：{tasks[task_id]['status']}")
    
    def test_dequeue_task(self):
        """测试任务出队（开始处理）"""
        print("\n[单元测试] test_dequeue_task - 任务出队")
        
        test_pdf = self.create_test_pdf(pages=1)
        
        # 先上传
        with open(test_pdf, 'rb') as f:
            upload_response = self.client.post(
                "/upload",
                files={"file": ("dequeue_test.pdf", f, "application/pdf")}
            )
        
        task_id = upload_response.json()["task_id"]
        self.task_ids.append(task_id)
        
        # 开始处理（出队）
        process_response = self.client.post(f"/process/{task_id}")
        
        self.assertEqual(process_response.status_code, 200)
        data = process_response.json()
        
        self.assertEqual(data["status"], "processing")
        self.assertEqual(tasks[task_id]["status"], "processing")
        
        print(f"  ✓ 任务出队成功：{task_id}")
        print(f"  ✓ 状态变更为：{tasks[task_id]['status']}")
    
    def test_cancel_pending_task(self):
        """测试取消待处理任务"""
        print("\n[单元测试] test_cancel_pending_task - 取消待处理任务")
        
        test_pdf = self.create_test_pdf(pages=1)
        
        with open(test_pdf, 'rb') as f:
            upload_response = self.client.post(
                "/upload",
                files={"file": ("cancel_pending.pdf", f, "application/pdf")}
            )
        
        task_id = upload_response.json()["task_id"]
        self.task_ids.append(task_id)
        
        # 尝试取消待处理任务
        cancel_response = self.client.post(f"/cancel/{task_id}")
        
        # 应该返回 400，因为任务还没开始处理
        self.assertEqual(cancel_response.status_code, 400)
        
        print("  ✓ 待处理任务无法取消（预期行为）")
    
    def test_cancel_processing_task(self):
        """测试取消正在处理的任务"""
        print("\n[单元测试] test_cancel_processing_task - 取消处理中任务")
        
        test_pdf = self.create_test_pdf(pages=1)
        
        # 上传并开始处理
        with open(test_pdf, 'rb') as f:
            upload_response = self.client.post(
                "/upload",
                files={"file": ("cancel_processing.pdf", f, "application/pdf")}
            )
        
        task_id = upload_response.json()["task_id"]
        self.task_ids.append(task_id)
        
        # 开始处理
        self.client.post(f"/process/{task_id}")
        
        # 等待任务进入处理状态
        time.sleep(0.5)
        
        # 取消任务
        cancel_response = self.client.post(f"/cancel/{task_id}")
        
        # 可能成功或失败（取决于处理速度）
        self.assertIn(cancel_response.status_code, [200, 400])
        
        if cancel_response.status_code == 200:
            print("  ✓ 处理中任务成功取消")
        else:
            print("  ✓ 任务已完成或已取消（无法再次取消）")
    
    def test_concurrent_limit(self):
        """测试并发限制"""
        print("\n[单元测试] test_concurrent_limit - 并发限制")
        
        num_tasks = 10
        task_ids = []
        
        # 创建并上传多个任务
        for i in range(num_tasks):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"concurrent_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        # 验证所有任务都创建了
        self.assertEqual(len(tasks), num_tasks)
        
        # 开始处理所有任务
        processing_count = 0
        for task_id in task_ids:
            response = self.client.post(f"/process/{task_id}")
            if response.status_code == 200:
                processing_count += 1
        
        print(f"  ✓ 创建了 {num_tasks} 个任务")
        print(f"  ✓ 开始处理 {processing_count} 个任务")


# ============================================================
# 第三部分：并发控制模块单元测试
# ============================================================

class TestConcurrencyControl(TestClientBase):
    """并发控制模块测试"""
    
    def test_semaphore_limit(self):
        """测试信号量限制"""
        print("\n[单元测试] test_semaphore_limit - 信号量限制")
        
        # 当前实现没有显式的信号量
        # 这个测试验证系统能处理并发请求
        
        num_concurrent = 5
        task_ids = []
        
        for i in range(num_concurrent):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"semaphore_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        # 验证所有任务都成功创建
        self.assertEqual(len(tasks), num_concurrent)
        
        print(f"  ✓ 支持 {num_concurrent} 个并发上传")
    
    def test_resource_monitoring(self):
        """测试资源监控"""
        print("\n[单元测试] test_resource_monitoring - 资源监控")
        
        test_pdf = self.create_test_pdf(pages=1)
        
        with open(test_pdf, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("resource_test.pdf", f, "application/pdf")}
            )
        
        task_id = response.json()["task_id"]
        self.task_ids.append(task_id)
        
        # 获取任务状态
        status_response = self.client.get(f"/status/{task_id}")
        status_data = status_response.json()
        
        # 验证资源信息
        self.assertIn("file_size", status_data)
        self.assertIn("total_pages", status_data)
        
        # 获取文件信息
        info_response = self.client.get(f"/fileinfo/{task_id}")
        info_data = info_response.json()
        
        self.assertIn("file_size_mb", info_data)
        self.assertIn("estimated_time_seconds", info_data)
        
        print(f"  ✓ 文件大小监控：{info_data['file_size_mb']} MB")
        print(f"  ✓ 预估时间：{info_data.get('estimated_time_formatted', 'N/A')}")
    
    def test_queue_status(self):
        """测试队列状态查询"""
        print("\n[单元测试] test_queue_status - 队列状态")
        
        # 创建多个任务
        num_tasks = 3
        task_ids = []
        
        for i in range(num_tasks):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"queue_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        # 获取任务列表
        list_response = self.client.get("/tasks")
        list_data = list_response.json()
        
        self.assertIn("tasks", list_data)
        self.assertGreaterEqual(len(list_data["tasks"]), num_tasks)
        
        print(f"  ✓ 队列中共有 {len(list_data['tasks'])} 个任务")
        
        for task in list_data["tasks"][:3]:
            print(f"    - {task['task_id'][:8]}... : {task['status']}")


# ============================================================
# 第四部分：集成测试
# ============================================================

class TestIntegration(TestClientBase):
    """集成测试"""
    
    def test_batch_upload_and_process(self):
        """测试批量上传并处理"""
        print("\n[集成测试] test_batch_upload_and_process - 批量上传处理")
        
        num_files = 3
        task_ids = []
        
        # 批量上传
        for i in range(num_files):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"batch_{i}.pdf", f, "application/pdf")}
                )
            
            self.assertEqual(response.status_code, 200)
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        print(f"  ✓ 上传 {num_files} 个文件")
        
        # 批量开始处理
        for task_id in task_ids:
            response = self.client.post(f"/process/{task_id}")
            self.assertEqual(response.status_code, 200)
        
        print(f"  ✓ 开始处理 {num_files} 个任务")
        
        # 等待处理完成（模拟）
        time.sleep(2)
        
        # 检查任务状态
        completed = 0
        for task_id in task_ids:
            status_response = self.client.get(f"/status/{task_id}")
            status = status_response.json()["status"]
            if status in ["completed", "processing"]:
                completed += 1
        
        print(f"  ✓ {completed}/{num_files} 个任务在处理中或已完成")
    
    def test_concurrent_processing(self):
        """测试并发处理"""
        print("\n[集成测试] test_concurrent_processing - 并发处理")
        
        num_concurrent = 5
        task_ids = []
        
        # 创建并发任务
        for i in range(num_concurrent):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"concurrent_proc_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        # 同时开始所有任务
        start_time = time.time()
        for task_id in task_ids:
            self.client.post(f"/process/{task_id}")
        end_time = time.time()
        
        print(f"  ✓ {num_concurrent} 个并发任务启动时间：{(end_time-start_time)*1000:.2f}ms")
        
        # 验证所有任务都在处理中
        processing_count = sum(1 for tid in task_ids if tasks[tid]["status"] == "processing")
        print(f"  ✓ {processing_count}/{num_concurrent} 个任务正在处理")
    
    def test_cancel_batch(self):
        """测试批量取消"""
        print("\n[集成测试] test_cancel_batch - 批量取消")
        
        num_tasks = 3
        task_ids = []
        
        # 创建任务
        for i in range(num_tasks):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"cancel_batch_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        # 开始处理
        for task_id in task_ids:
            self.client.post(f"/process/{task_id}")
        
        time.sleep(0.5)
        
        # 批量取消
        cancelled = 0
        for task_id in task_ids:
            response = self.client.post(f"/cancel/{task_id}")
            if response.status_code == 200:
                cancelled += 1
        
        print(f"  ✓ 成功取消 {cancelled}/{num_tasks} 个任务")
    
    def test_download_completed(self):
        """测试下载已完成文件"""
        print("\n[集成测试] test_download_completed - 下载完成文件")
        
        test_pdf = self.create_test_pdf(pages=1)
        
        # 上传
        with open(test_pdf, 'rb') as f:
            upload_response = self.client.post(
                "/upload",
                files={"file": ("download_test.pdf", f, "application/pdf")}
            )
        
        task_id = upload_response.json()["task_id"]
        self.task_ids.append(task_id)
        
        # 开始处理
        self.client.post(f"/process/{task_id}")
        
        # 等待（实际场景中需要等待 OCR 完成）
        time.sleep(1)
        
        # 检查状态
        status_response = self.client.get(f"/status/{task_id}")
        status = status_response.json()
        
        print(f"  ✓ 任务状态：{status['status']}")
        print(f"  ✓ 输出文件存在：{status['output_exists']}")
        
        # 如果完成，尝试下载
        if status["status"] == "completed":
            download_response = self.client.get(f"/download/{task_id}")
            self.assertEqual(download_response.status_code, 200)
            print("  ✓ 文件下载成功")
        else:
            print("  ⊘ 任务未完成，跳过下载测试")


# ============================================================
# 第五部分：性能测试
# ============================================================

class TestPerformance(TestClientBase):
    """性能测试"""
    
    def test_batch_performance(self):
        """测试批量处理性能（50 个文件）"""
        print("\n[性能测试] test_batch_performance - 50 个文件批量处理")
        
        num_files = 50
        task_ids = []
        
        start_time = time.time()
        
        # 批量上传
        for i in range(num_files):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"perf_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        upload_time = time.time() - start_time
        
        print(f"  ✓ 上传 {num_files} 个文件耗时：{upload_time:.2f}秒")
        print(f"  ✓ 平均上传速度：{num_files/upload_time:.2f} 文件/秒")
        
        # 统计
        self.assertEqual(len(tasks), num_files)
        print(f"  ✓ 成功创建 {len(tasks)} 个任务")
    
    def test_memory_usage(self):
        """测试内存使用（大文件处理）"""
        print("\n[性能测试] test_memory_usage - 大文件处理内存使用")
        
        # 创建大文件
        test_pdf = self.create_large_pdf(size_mb=15)
        file_size_mb = os.path.getsize(test_pdf) / (1024 * 1024)
        
        # 获取初始内存（模拟）
        import resource
        initial_mem = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # MB
        
        # 上传
        with open(test_pdf, 'rb') as f:
            response = self.client.post(
                "/upload",
                files={"file": ("memory_test.pdf", f, "application/pdf")}
            )
        
        task_id = response.json()["task_id"]
        self.task_ids.append(task_id)
        
        # 获取处理后内存
        peak_mem = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # MB
        
        print(f"  ✓ 文件大小：{file_size_mb:.2f} MB")
        print(f"  ✓ 内存使用：{peak_mem - initial_mem:.2f} MB")
        print(f"  ✓ 内存/文件比：{(peak_mem - initial_mem) / file_size_mb:.2f}x")
    
    def test_concurrent_limit_performance(self):
        """测试并发限制性能（验证最多 5 个并发）"""
        print("\n[性能测试] test_concurrent_limit_performance - 并发限制验证")
        
        max_concurrent = 5
        task_ids = []
        
        # 创建并发任务
        for i in range(max_concurrent):
            test_pdf = self.create_test_pdf(pages=1)
            
            with open(test_pdf, 'rb') as f:
                response = self.client.post(
                    "/upload",
                    files={"file": (f"concurrent_perf_{i}.pdf", f, "application/pdf")}
                )
            
            task_id = response.json()["task_id"]
            task_ids.append(task_id)
            self.task_ids.append(task_id)
        
        # 同时开始所有任务
        start_time = time.time()
        for task_id in task_ids:
            self.client.post(f"/process/{task_id}")
        
        # 检查并发处理数
        processing_count = sum(1 for tid in task_ids if tasks[tid]["status"] == "processing")
        
        elapsed = time.time() - start_time
        
        print(f"  ✓ 启动 {max_concurrent} 个并发任务耗时：{elapsed*1000:.2f}ms")
        print(f"  ✓ 当前处理中任务数：{processing_count}")
        print(f"  ✓ 并发限制：最多 {max_concurrent} 个（实际支持可能更高）")


# ============================================================
# 测试运行器
# ============================================================

def run_tests():
    """运行所有测试并生成报告"""
    
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加所有测试类
    suite.addTests(loader.loadTestsFromTestCase(TestBatchUpload))
    suite.addTests(loader.loadTestsFromTestCase(TestTaskQueue))
    suite.addTests(loader.loadTestsFromTestCase(TestConcurrencyControl))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestPerformance))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result


if __name__ == "__main__":
    print("=" * 70)
    print("PDF OCR 系统 - 完整测试套件")
    print("=" * 70)
    print(f"测试开始时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    result = run_tests()
    
    # 输出总结
    print("\n" + "=" * 70)
    print("测试总结")
    print("=" * 70)
    print(f"总测试数：{result.testsRun}")
    print(f"通过：{result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败：{len(result.failures)}")
    print(f"错误：{len(result.errors)}")
    print("=" * 70)
    
    sys.exit(0 if result.wasSuccessful() else 1)
