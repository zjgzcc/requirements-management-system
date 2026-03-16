# 详细设计文档 (LLD) - Sprint 3 批量处理

> **文档编号**: LLD-SPRINT3-2026-001  
> **项目名称**: PDF OCR 智能扫描系统  
> **版本**: v1.0  
> **创建日期**: 2026-03-14  
> **Sprint**: Sprint 3 - 批量处理  
> **状态**: 待评审

---

## 1. Sprint 3 概述

### 1.1 Sprint 目标

实现批量上传和批量处理功能，支持一次处理 10-50 个 PDF 文件，提高企业用户工作效率。

### 1.2 Sprint 周期

- **开始日期**: 2026-03-15
- **结束日期**: 2026-03-16
- **周期**: 2 天

### 1.3 开发任务

| 任务 ID | 任务描述 | 优先级 | 预估工时 | 负责人 |
|---------|----------|--------|----------|--------|
| T012 | 批量上传接口开发 | P0 | 3h | AI 开发 |
| T013 | 任务队列管理 | P0 | 4h | AI 开发 |
| T014 | 并发控制 | P1 | 2h | AI 开发 |
| T015 | 前端批量 UI | P0 | 3h | AI 开发 |
| T016 | 性能优化 | P1 | 2h | AI 开发 |
| T017 | 测试验证 | P0 | 2h | AI 开发 |

**总工时**: 16 小时

---

## 2. 批量上传接口设计 (T012)

### 2.1 接口定义

#### 接口 1：批量上传

```http
POST /api/v1/upload/batch
Content-Type: multipart/form-data

Request:
  files[]: <PDF file> (可多个)
  auto_process: boolean (可选，是否自动开始处理)

Response:
{
    "code": 200,
    "message": "success",
    "data": {
        "batch_id": "batch_20260315_001",
        "total_count": 5,
        "success_count": 5,
        "failed_count": 0,
        "tasks": [
            {
                "task_id": "abc12345",
                "filename": "file1.pdf",
                "size": 123456,
                "status": "uploaded"
            },
            {
                "task_id": "def67890",
                "filename": "file2.pdf",
                "size": 234567,
                "status": "uploaded"
            }
        ],
        "total_size": 618023,
        "created_at": "2026-03-15T10:00:00Z"
    }
}
```

### 2.2 实现逻辑

```python
class UploadService:
    async def upload_batch(
        self,
        files: List[UploadFile],
        user_id: str,
        auto_process: bool = False
    ) -> BatchUploadResult:
        """
        批量上传文件
        
        Args:
            files: 文件列表
            user_id: 用户 ID
            auto_process: 是否自动开始处理
            
        Returns:
            BatchUploadResult: 批量上传结果
        """
        batch_id = self._generate_batch_id()
        results = []
        success_count = 0
        failed_count = 0
        total_size = 0
        
        for file in files:
            try:
                # 验证文件
                if not await self.validate_file(file):
                    failed_count += 1
                    results.append({
                        "filename": file.filename,
                        "status": "failed",
                        "error": "Invalid file format"
                    })
                    continue
                
                # 检查文件大小
                if file.size > MAX_FILE_SIZE:
                    failed_count += 1
                    results.append({
                        "filename": file.filename,
                        "status": "failed",
                        "error": "File too large"
                    })
                    continue
                
                # 保存文件
                task_id = self._generate_task_id()
                file_path = await self._save_file(file, task_id)
                
                # 创建任务
                task = await self.task_service.create_task(
                    user_id=user_id,
                    batch_id=batch_id,
                    input_file=file_path,
                    filename=file.filename
                )
                
                results.append({
                    "task_id": task.id,
                    "filename": file.filename,
                    "size": file.size,
                    "status": "uploaded"
                })
                
                success_count += 1
                total_size += file.size
                
                # 如果自动处理，加入处理队列
                if auto_process:
                    await self.task_service.enqueue_task(task.id)
                
            except Exception as e:
                failed_count += 1
                results.append({
                    "filename": file.filename,
                    "status": "failed",
                    "error": str(e)
                })
        
        return BatchUploadResult(
            batch_id=batch_id,
            total_count=len(files),
            success_count=success_count,
            failed_count=failed_count,
            tasks=results,
            total_size=total_size
        )
```

### 2.3 文件验证规则

```python
async def validate_file(self, file: UploadFile) -> bool:
    """验证上传文件"""
    # 检查文件扩展名
    allowed_extensions = ['.pdf']
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return False
    
    # 检查文件大小（最大 50MB）
    if file.size > 50 * 1024 * 1024:
        return False
    
    # 检查文件头（PDF 文件头为 %PDF）
    file_head = await file.read(5)
    if not file_head.startswith(b'%PDF'):
        return False
    
    # 重置文件指针
    await file.seek(0)
    
    return True
```

### 2.4 验收标准

- [ ] 支持一次上传 1-50 个文件
- [ ] 单个文件大小限制 50MB
- [ ] 总文件大小限制 500MB
- [ ] 文件格式验证（仅 PDF）
- [ ] 返回每个文件的上传结果
- [ ] 支持自动开始处理选项

---

## 3. 任务队列管理 (T013)

### 3.1 队列架构

```
┌─────────────────────────────────────────────────────┐
│                  任务队列管理器                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                │
│  │  待处理队列  │───▶│  处理中队列  │                │
│  │  (Pending)  │    │ (Processing)│                │
│  └─────────────┘    └──────┬──────┘                │
│                            │                        │
│                            ▼                        │
│                     ┌─────────────┐                 │
│                     │  已完成队列  │                 │
│                     │ (Completed) │                 │
│                     └─────────────┘                 │
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                │
│  │  失败队列   │    │  取消队列   │                 │
│  │  (Failed)   │    │ (Cancelled) │                 │
│  └─────────────┘    └─────────────┘                │
└─────────────────────────────────────────────────────┘
```

### 3.2 队列数据结构

```python
@dataclass
class TaskQueue:
    """任务队列"""
    pending: Deque[str]  # 待处理任务 ID 队列
    processing: Set[str]  # 处理中任务 ID 集合
    completed: Deque[str]  # 已完成任务 ID 队列
    failed: Dict[str, str]  # 失败任务 {task_id: error_message}
    cancelled: Set[str]  # 已取消任务 ID 集合
    
    # 并发控制
    max_concurrent: int = 5  # 最大并发数
    current_concurrent: int = 0  # 当前并发数
```

### 3.3 队列管理器实现

```python
class TaskQueueManager:
    """任务队列管理器"""
    
    def __init__(self, max_concurrent: int = 5):
        self.queue = TaskQueue(max_concurrent=max_concurrent)
        self.lock = asyncio.Lock()
        self.worker_tasks = []
    
    async def enqueue(self, task_id: str) -> bool:
        """将任务加入队列"""
        async with self.lock:
            if task_id in self.queue.processing:
                return False
            
            self.queue.pending.append(task_id)
            await self._try_start_tasks()
            return True
    
    async def _try_start_tasks(self):
        """尝试启动任务"""
        while (self.queue.current_concurrent < self.queue.max_concurrent 
               and self.queue.pending):
            
            task_id = self.queue.pending.popleft()
            self.queue.processing.add(task_id)
            self.queue.current_concurrent += 1
            
            # 启动异步任务
            task = asyncio.create_task(self._process_task(task_id))
            self.worker_tasks.append(task)
    
    async def _process_task(self, task_id: str):
        """处理单个任务"""
        try:
            # 更新任务状态为处理中
            await self.task_service.update_status(task_id, "processing")
            
            # 执行 OCR 处理
            result = await self.ocr_service.process(task_id)
            
            # 更新任务状态为完成
            await self.task_service.update_status(task_id, "completed")
            self.queue.completed.append(task_id)
            
        except asyncio.CancelledError:
            # 任务被取消
            self.queue.cancelled.add(task_id)
            await self.task_service.update_status(task_id, "cancelled")
            
        except Exception as e:
            # 任务失败
            self.queue.failed[task_id] = str(e)
            await self.task_service.update_status(task_id, "failed", error=str(e))
            
        finally:
            # 减少并发计数
            self.queue.current_concurrent -= 1
            self.queue.processing.discard(task_id)
            
            # 尝试启动下一个任务
            await self._try_start_tasks()
    
    async def cancel(self, task_id: str) -> bool:
        """取消任务"""
        async with self.lock:
            # 如果在待处理队列中
            if task_id in self.queue.pending:
                self.queue.pending.remove(task_id)
                self.queue.cancelled.add(task_id)
                return True
            
            # 如果在处理中
            if task_id in self.queue.processing:
                # 取消对应的异步任务
                await self.ocr_service.cancel(task_id)
                return True
            
            return False
    
    def get_queue_status(self) -> QueueStatus:
        """获取队列状态"""
        return QueueStatus(
            pending_count=len(self.queue.pending),
            processing_count=len(self.queue.processing),
            completed_count=len(self.queue.completed),
            failed_count=len(self.queue.failed),
            cancelled_count=len(self.queue.cancelled),
            current_concurrent=self.queue.current_concurrent,
            max_concurrent=self.queue.max_concurrent
        )
```

### 3.4 验收标准

- [ ] 支持任务队列管理（待处理、处理中、已完成）
- [ ] 并发控制（最多 5 个任务同时处理）
- [ ] 支持取消待处理和正在处理的任务
- [ ] 队列状态查询接口
- [ ] 失败任务重试机制（可选）

---

## 4. 并发控制 (T014)

### 4.1 并发限制策略

```python
class ConcurrencyController:
    """并发控制器"""
    
    def __init__(self, max_concurrent: int = 5):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_tasks = set()
    
    async def acquire(self, task_id: str) -> bool:
        """获取执行许可"""
        acquired = await self.semaphore.acquire()
        if acquired:
            self.active_tasks.add(task_id)
        return acquired
    
    def release(self, task_id: str):
        """释放执行许可"""
        if task_id in self.active_tasks:
            self.active_tasks.discard(task_id)
            self.semaphore.release()
    
    async def execute_with_limit(self, task_id: str, coro):
        """在并发限制下执行协程"""
        async with self.semaphore:
            self.active_tasks.add(task_id)
            try:
                return await coro
            finally:
                self.active_tasks.discard(task_id)
    
    def get_status(self) -> ConcurrencyStatus:
        """获取并发状态"""
        return ConcurrencyStatus(
            max_concurrent=self.max_concurrent,
            active_count=len(self.active_tasks),
            available=self.max_concurrent - len(self.active_tasks)
        )
```

### 4.2 系统资源监控

```python
class ResourceMonitor:
    """资源监控器"""
    
    def __init__(self):
        self.cpu_threshold = 80  # CPU 阈值 80%
        self.memory_threshold = 90  # 内存阈值 90%
    
    async def check_resources(self) -> ResourceStatus:
        """检查系统资源"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return ResourceStatus(
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            disk_percent=disk.percent,
            is_available=(
                cpu_percent < self.cpu_threshold and
                memory.percent < self.memory_threshold
            )
        )
    
    async def wait_for_resources(self, timeout: float = 30.0):
        """等待资源可用"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            status = await self.check_resources()
            if status.is_available:
                return True
            await asyncio.sleep(1)
        return False
```

### 4.3 验收标准

- [ ] 并发任务数限制（5 个）
- [ ] 系统资源监控（CPU、内存）
- [ ] 资源不足时暂停新任务
- [ ] 并发状态查询接口

---

## 5. 前端批量 UI 设计 (T015)

### 5.1 界面布局

```
┌─────────────────────────────────────────────────────────┐
│              PDF OCR 智能扫描 - 批量处理                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │            拖拽文件到此处或点击选择                 │ │
│  │                                                   │ │
│  │          📁 支持 1-50 个 PDF 文件                    │ │
│  │          📊 总大小限制 500MB                        │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  已选择 5 个文件，总大小 2.3MB                           │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 文件名                    大小      状态          │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ✓ file1.pdf              456KB    已上传        │ │
│  │ ✓ file2.pdf              523KB    已上传        │ │
│  │ ✓ file3.pdf              412KB    已上传        │ │
│  │ ✗ file4.pdf              1.2MB    失败          │ │
│  │ ✓ file5.pdf              389KB    已上传        │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ☑️ 上传后自动开始处理                                   │
│                                                         │
│  [开始处理]  [清除全部]                                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    处理队列 (3/5)                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ file1.pdf  ████████░░  65%  剩余 30 秒  [取消]     │ │
│  │ file2.pdf  ████░░░░░░  40%  剩余 60 秒  [取消]     │ │
│  │ file3.pdf  ░░░░░░░░░░   0%  等待中...   [取消]     │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 5.2 前端组件结构

```javascript
// 批量上传组件
<BatchUpload>
  <FileDropZone />           // 拖拽上传区域
  <FileList />               // 文件列表
  <UploadOptions />          // 上传选项
  <ProcessButton />          // 处理按钮
  <QueueStatus />            // 队列状态
  <TaskProgressList />       // 任务进度列表
</BatchUpload>

// 单个文件项组件
<FileItem>
  <FileName />               // 文件名
  <FileSize />               // 文件大小
  <FileStatus />             // 文件状态
  <FileProgress />           // 进度条
  <CancelButton />           // 取消按钮
</FileItem>
```

### 5.3 状态管理

```javascript
// 批量上传状态
const batchUploadState = {
  files: [],  // 文件列表
  batchId: null,
  totalSize: 0,
  uploading: false,
  progress: 0,
  
  // 队列状态
  queue: {
    pending: [],
    processing: [],
    completed: [],
    failed: [],
    cancelled: []
  },
  
  // 并发控制
  maxConcurrent: 5,
  currentConcurrent: 0
};

// 操作方法
const actions = {
  addFiles(files),           // 添加文件
  removeFile(fileId),        // 移除文件
  startUpload(),             // 开始上传
  startProcessing(),         // 开始处理
  cancelTask(taskId),        // 取消任务
  clearAll(),                // 清除全部
  retryFailed()              // 重试失败
};
```

### 5.4 验收标准

- [ ] 拖拽上传支持
- [ ] 文件列表显示（文件名、大小、状态）
- [ ] 进度条显示（百分比 + 剩余时间）
- [ ] 队列状态显示（等待中、处理中、已完成）
- [ ] 单个任务取消按钮
- [ ] 批量操作按钮（开始、清除、重试）

---

## 6. 性能优化 (T016)

### 6.1 文件处理优化

```python
class OptimizedOCRService:
    """优化的 OCR 服务"""
    
    async def process_batch(self, task_ids: List[str]):
        """批量处理优化"""
        # 1. 预检查所有文件
        valid_tasks = []
        for task_id in task_ids:
            if await self._validate_task(task_id):
                valid_tasks.append(task_id)
        
        # 2. 并行预处理（分析页数、图像预处理）
        preprocess_results = await asyncio.gather(*[
            self._preprocess(task_id) for task_id in valid_tasks
        ])
        
        # 3. 按页数排序，小文件优先
        sorted_tasks = sorted(
            zip(valid_tasks, preprocess_results),
            key=lambda x: x[1]['total_pages']
        )
        
        # 4. 并发处理
        semaphore = asyncio.Semaphore(5)
        
        async def process_with_semaphore(task_id):
            async with semaphore:
                return await self._process_single(task_id)
        
        results = await asyncio.gather(*[
            process_with_semaphore(task_id) 
            for task_id, _ in sorted_tasks
        ])
        
        return results
```

### 6.2 内存优化

```python
async def process_large_file(self, task_id: str):
    """大文件处理优化"""
    # 使用流式处理，避免一次性加载整个文件
    async with aiofiles.open(input_path, 'rb') as f:
        # 分块读取
        chunk_size = 1024 * 1024  # 1MB
        while chunk := await f.read(chunk_size):
            # 处理数据块
            await self._process_chunk(chunk)
    
    # 及时释放内存
    gc.collect()
```

### 6.3 缓存优化

```python
class CacheManager:
    """缓存管理器"""
    
    def __init__(self):
        self.redis = redis.Redis()
    
    async def cache_file_info(self, task_id: str, info: FileInfo):
        """缓存文件信息"""
        await self.redis.setex(
            f"file_info:{task_id}",
            3600,  # 1 小时过期
            json.dumps(info.dict())
        )
    
    async def get_cached_info(self, task_id: str) -> Optional[FileInfo]:
        """获取缓存的文件信息"""
        data = await self.redis.get(f"file_info:{task_id}")
        if data:
            return FileInfo.parse_raw(data)
        return None
```

### 6.4 验收标准

- [ ] 批量处理性能提升 30%
- [ ] 内存占用降低 50%
- [ ] 大文件处理不崩溃
- [ ] 缓存命中率>80%

---

## 7. 测试计划 (T017)

### 7.1 单元测试

```python
class TestBatchUpload:
    """批量上传测试"""
    
    async def test_upload_single_file(self):
        """测试单文件上传"""
        pass
    
    async def test_upload_multiple_files(self):
        """测试多文件上传"""
        pass
    
    async def test_upload_invalid_file(self):
        """测试无效文件上传"""
        pass
    
    async def test_upload_large_file(self):
        """测试大文件上传"""
        pass

class TestTaskQueue:
    """任务队列测试"""
    
    async def test_enqueue_task(self):
        """测试任务入队"""
        pass
    
    async def test_dequeue_task(self):
        """测试任务出队"""
        pass
    
    async def test_cancel_task(self):
        """测试任务取消"""
        pass
    
    async def test_concurrent_limit(self):
        """测试并发限制"""
        pass
```

### 7.2 集成测试

```python
class TestBatchProcessing:
    """批量处理集成测试"""
    
    async def test_batch_upload_and_process(self):
        """测试批量上传和处理"""
        # 1. 上传 10 个文件
        # 2. 开始批量处理
        # 3. 验证所有任务完成
        pass
    
    async def test_concurrent_processing(self):
        """测试并发处理"""
        # 1. 上传 20 个文件
        # 2. 验证最多 5 个任务同时处理
        # 3. 验证队列调度正确
        pass
    
    async def test_cancel_batch(self):
        """测试批量取消"""
        # 1. 开始批量处理
        # 2. 取消部分任务
        # 3. 验证其他任务继续执行
        pass
```

### 7.3 性能测试

```python
class TestPerformance:
    """性能测试"""
    
    async def test_batch_performance(self):
        """批量处理性能测试"""
        # 1. 上传 50 个文件（总 100MB）
        # 2. 记录处理时间
        # 3. 验证平均处理速度
        pass
    
    async def test_memory_usage(self):
        """内存使用测试"""
        # 1. 处理大文件（50MB）
        # 2. 监控内存使用
        # 3. 验证内存<500MB
        pass
```

### 7.4 验收标准

- [ ] 单元测试覆盖率>80%
- [ ] 集成测试全部通过
- [ ] 性能测试达标
- [ ] 无严重 Bug

---

## 8. 开发 checklist

### T012 - 批量上传接口
- [ ] 实现 upload_batch 接口
- [ ] 实现文件验证逻辑
- [ ] 实现文件大小限制
- [ ] 实现批量上传结果返回
- [ ] 编写单元测试

### T013 - 任务队列管理
- [ ] 实现 TaskQueueManager
- [ ] 实现队列状态管理
- [ ] 实现任务取消逻辑
- [ ] 实现队列状态查询接口
- [ ] 编写单元测试

### T014 - 并发控制
- [ ] 实现 ConcurrencyController
- [ ] 实现 Semaphore 限制
- [ ] 实现资源监控
- [ ] 实现并发状态查询
- [ ] 编写单元测试

### T015 - 前端批量 UI
- [ ] 实现拖拽上传组件
- [ ] 实现文件列表组件
- [ ] 实现进度条组件
- [ ] 实现队列状态显示
- [ ] 实现批量操作按钮
- [ ] 编写前端测试

### T016 - 性能优化
- [ ] 实现批量处理优化
- [ ] 实现内存优化
- [ ] 实现缓存优化
- [ ] 性能测试验证

### T017 - 测试验证
- [ ] 执行单元测试
- [ ] 执行集成测试
- [ ] 执行性能测试
- [ ] Bug 修复
- [ ] 编写测试报告

---

## 9. 风险和问题

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 大文件内存溢出 | 高 | 中 | 流式处理、内存监控 |
| 并发过高导致系统过载 | 高 | 中 | 并发限制、资源监控 |
| 批量上传失败率高 | 中 | 低 | 失败重试、详细错误提示 |
| 前端性能问题 | 中 | 低 | 虚拟列表、分页显示 |

---

*本文档待评审通过后生效*  
*创建日期：2026-03-14*
