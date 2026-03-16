# PDF OCR 系统 - 开发文档

## 项目概述

这是一个功能完整的 PDF OCR（光学字符识别）系统，支持实时进度追踪和任务取消功能。系统采用前后端分离架构，提供友好的 Web 界面。

## 功能特性

### ✅ 已实现功能

1. **文件上传**
   - 支持拖拽上传
   - 自动验证 PDF 格式
   - 显示文件基本信息

2. **任务管理**
   - 创建唯一任务 ID
   - 维护任务状态机
   - 支持多任务并发

3. **进度显示** ⭐
   - 实时进度百分比（0-100%）
   - 当前处理阶段指示器
   - 已处理/总页数显示
   - 预估剩余时间（ETA）
   - 处理速度统计（秒/页）

4. **任务取消** ⭐
   - 处理中可随时取消
   - 优雅终止 OCR 进程
   - 自动清理临时文件
   - 状态更新为"已取消"

5. **文件信息** ⭐
   - 文件大小（MB）
   - PDF 页数
   - 预估处理时间
   - 基于历史数据的智能估算

6. **结果下载**
   - 处理完成后下载
   - 自动添加 OCR_前缀

7. **历史记录**
   - 任务列表查看
   - 支持删除任务
   - 状态持久化（会话期间）

## 技术架构

### 后端 (FastAPI)

```
api/main.py
├── 任务管理字典 (tasks)
│   ├── task_id → 任务信息
│   ├── status: pending/processing/completed/failed/cancelled
│   ├── process: subprocess 对象
│   ├── total_pages: 总页数
│   ├── processed_pages: 已处理页数
│   ├── stage: uploaded/analyzing/ocr/optimizing/completed
│   ├── progress: 0-100
│   ├── eta_seconds: 预估剩余秒数
│   └── avg_time_per_page: 平均每页耗时
│
├── API 端点
│   ├── POST /upload - 上传文件
│   ├── POST /process/{task_id} - 开始处理
│   ├── POST /cancel/{task_id} - 取消任务 ⭐
│   ├── GET /progress/{task_id} - 获取进度 ⭐
│   ├── GET /fileinfo/{task_id} - 文件信息 ⭐
│   ├── GET /status/{task_id} - 任务状态
│   ├── GET /download/{task_id} - 下载结果
│   ├── GET /tasks - 任务列表
│   └── DELETE /task/{task_id} - 删除任务
│
└── 后台任务
    └── monitor_process() - 实时监控 OCR 进程
```

### 前端 (HTML/CSS/JS)

```
web/index.html
├── 上传区域
│   ├── 拖拽上传
│   └── 文件选择器
│
├── 文件信息卡片
│   ├── 文件名
│   ├── 文件大小
│   ├── 总页数
│   └── 预估时间
│
├── 进度卡片
│   ├── 状态徽章
│   ├── 阶段指示器（5 个阶段）⭐
│   ├── 进度条（百分比）⭐
│   ├── 预估时间显示 ⭐
│   ├── 取消按钮 ⭐
│   └── 下载按钮
│
└── 任务列表
    ├── 历史任务
    └── 删除功能
```

## API 详细文档

### 1. 上传文件

**端点**: `POST /upload`

**请求**:
```
Content-Type: multipart/form-data

file: <PDF 文件>
```

**响应**:
```json
{
  "task_id": "uuid-string",
  "filename": "example.pdf",
  "file_size": 123456,
  "total_pages": 10,
  "message": "文件上传成功，开始处理"
}
```

### 2. 开始处理

**端点**: `POST /process/{task_id}`

**响应**:
```json
{
  "task_id": "uuid-string",
  "status": "processing",
  "message": "开始处理 PDF 文件"
}
```

### 3. 取消任务 ⭐

**端点**: `POST /cancel/{task_id}`

**响应**:
```json
{
  "task_id": "uuid-string",
  "status": "cancelled",
  "message": "任务已取消"
}
```

**实现细节**:
- 调用 `process.terminate()` 温和终止
- 5 秒超时后调用 `process.kill()` 强制终止
- 清理输入/输出文件
- 更新任务状态为 `cancelled`

### 4. 获取进度 ⭐

**端点**: `GET /progress/{task_id}`

**响应**:
```json
{
  "task_id": "uuid-string",
  "status": "processing",
  "stage": "ocr",
  "stage_cn": "OCR 中",
  "progress": 45.5,
  "processed_pages": 5,
  "total_pages": 11,
  "eta_seconds": 120.5,
  "eta_formatted": "2 分 0 秒",
  "file_size": 123456,
  "error": null,
  "start_time": 1234567890.123,
  "avg_time_per_page": 20.5
}
```

**进度计算逻辑**:
```python
# 基于页数计算进度
progress = (processed_pages / total_pages) * 100

# 基于历史速度计算 ETA
elapsed = time.time() - start_time
avg_time_per_page = elapsed / processed_pages
eta_seconds = (total_pages - processed_pages) * avg_time_per_page
```

### 5. 获取文件信息 ⭐

**端点**: `GET /fileinfo/{task_id}`

**响应**:
```json
{
  "task_id": "uuid-string",
  "filename": "example.pdf",
  "file_size": 123456,
  "file_size_mb": 0.12,
  "total_pages": 10,
  "estimated_time_seconds": 180.5,
  "estimated_time_formatted": "3 分 0 秒",
  "input_file": "/path/to/input.pdf",
  "output_file": "/path/to/output.pdf"
}
```

**预估时间计算**:
- 基于历史处理记录
- 保留最近 100 条记录
- 计算平均每页处理时间
- `estimated_time = total_pages * avg_time_per_page`

### 6. 获取任务状态

**端点**: `GET /status/{task_id}`

**响应**:
```json
{
  "task_id": "uuid-string",
  "status": "completed",
  "stage": "completed",
  "progress": 100,
  "processed_pages": 10,
  "total_pages": 10,
  "file_size": 123456,
  "filename": "example.pdf",
  "error": null,
  "output_exists": true,
  "output_file": "/path/to/output.pdf",
  "start_time": 1234567890.123,
  "completed_time": 1234567900.456
}
```

### 7. 下载文件

**端点**: `GET /download/{task_id}`

**响应**: PDF 文件（application/pdf）

**文件名**: `OCR_原文件名.pdf`

### 8. 任务列表

**端点**: `GET /tasks`

**响应**:
```json
{
  "tasks": [
    {
      "task_id": "uuid-1",
      "filename": "file1.pdf",
      "status": "completed",
      "progress": 100,
      "total_pages": 10,
      "start_time": 1234567890
    }
  ]
}
```

### 9. 删除任务

**端点**: `DELETE /task/{task_id}`

**响应**:
```json
{
  "message": "任务已删除"
}
```

## 任务状态机

```
pending → processing → completed
              ↓
         cancelled
              ↓
           failed
```

**状态说明**:
- `pending`: 已上传，等待处理
- `processing`: 正在处理中
- `completed`: 处理完成
- `cancelled`: 用户取消
- `failed`: 处理失败

## 处理阶段

```
uploaded → analyzing → ocr → optimizing → completed
```

**阶段说明**:
1. `uploaded`: 文件已上传
2. `analyzing`: 分析 PDF 结构
3. `ocr`: OCR 文字识别（主要阶段）
4. `optimizing`: 优化输出文件
5. `completed`: 全部完成

## 进度追踪实现

### 后端监控

```python
async def monitor_process(task_id: str, process: subprocess.Popen):
    # 实时读取 stderr
    while True:
        line = process.stderr.readline()
        if line:
            # 解析 OCRmyPDF 进度
            processed, total, stage = parse_ocrmypdf_progress(line)
            
            # 更新任务信息
            task["processed_pages"] = processed
            task["total_pages"] = total
            task["stage"] = stage
            task["progress"] = (processed / total) * 100
            
            # 计算 ETA
            avg_time = elapsed / processed
            task["eta_seconds"] = (total - processed) * avg_time
```

### 前端轮询

```javascript
function startProgressPolling() {
    // 立即更新一次
    updateProgress();
    // 每秒轮询
    progressInterval = setInterval(updateProgress, 1000);
}

async function updateProgress() {
    const response = await fetch(`/progress/${taskId}`);
    const data = await response.json();
    
    // 更新 UI
    updateProgressBar(data.progress);
    updateStageIndicator(data.stage);
    updateETA(data.eta_formatted);
}
```

## 取消功能实现

### 后端处理

```python
@app.post("/cancel/{task_id}")
async def cancel_task(task_id: str):
    task = tasks[task_id]
    process = task.get("process")
    
    if process:
        # 温和终止
        process.terminate()
        
        try:
            # 等待 5 秒
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            # 强制杀死
            process.kill()
            process.wait(timeout=5)
        
        # 更新状态
        task["status"] = "cancelled"
        
        # 清理文件
        os.remove(task["input_file"])
        os.remove(task["output_file"])
```

### 前端交互

```javascript
async function cancelTask() {
    if (!confirm('确定要取消当前任务吗？')) {
        return;
    }
    
    const response = await fetch(`/cancel/${taskId}`, {
        method: 'POST'
    });
    
    if (response.ok) {
        // 停止轮询
        clearInterval(progressInterval);
        // 更新 UI
        updateStatus('cancelled');
        hideCancelButton();
    }
}
```

## 性能优化

### 1. 进度计算优化

- 避免频繁计算：只在页数变化时重新计算
- 缓存历史数据：保留最近 100 条记录
- 平滑 ETA：使用移动平均避免跳动

### 2. 进程管理优化

- 及时清理：进程结束后立即清理引用
- 优雅终止：先 terminate，超时后 kill
- 资源释放：取消时立即删除临时文件

### 3. 前端渲染优化

- 节流轮询：1 秒间隔，避免过快
- 条件更新：只在数据变化时更新 DOM
- 动画过渡：进度条使用 CSS transition

## 错误处理

### 后端错误

```python
try:
    # OCR 处理
    process = subprocess.Popen(cmd, ...)
except Exception as e:
    task["status"] = "failed"
    task["error"] = str(e)
    raise HTTPException(status_code=500, detail=str(e))
```

### 前端错误

```javascript
try {
    const response = await fetch(api);
    if (!response.ok) {
        throw new Error(response.statusText);
    }
} catch (error) {
    showAlert(`操作失败：${error.message}`, 'error');
}
```

## 测试指南

### 运行测试

```bash
# 1. 启动服务器
./start.sh

# 2. 运行测试脚本
python3 test-ocr-system.py
```

### 测试用例

1. **上传测试**: 验证文件上传和基本信息
2. **进度测试**: 验证进度追踪准确性
3. **取消测试**: 验证任务取消功能
4. **下载测试**: 验证结果下载
5. **删除测试**: 验证任务删除

### 手动测试

1. 访问 http://localhost:8000
2. 上传一个 PDF 文件（建议 5-10 页）
3. 点击"开始处理"
4. 观察进度条和阶段指示器
5. 点击"取消"按钮（可选）
6. 等待完成并下载结果

## 部署建议

### 生产环境配置

1. **使用 Gunicorn**:
   ```bash
   gunicorn api.main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

2. **配置 Nginx 反向代理**:
   ```nginx
   location / {
       proxy_pass http://localhost:8000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

3. **启用 HTTPS**:
   ```bash
   certbot --nginx -d your-domain.com
   ```

4. **限制上传大小**:
   ```python
   app = FastAPI()
   app.config.max_upload_size = 100 * 1024 * 1024  # 100MB
   ```

### 监控和日志

1. **访问日志**: 记录所有 API 请求
2. **错误日志**: 捕获异常和失败
3. **性能监控**: 跟踪处理时间和成功率

## 未来改进

- [ ] 批量上传和处理
- [ ] 用户认证和权限
- [ ] 任务队列和优先级
- [ ] WebSocket 实时推送
- [ ] 更多语言支持
- [ ] PDF 压缩选项
- [ ] 输出格式选择（PDF/A, PDF 等）

## 故障排除

### 常见问题

1. **OCRmyPDF 未找到**
   - 解决：`sudo apt-get install ocrmypdf`

2. **中文识别效果差**
   - 解决：安装中文字体和语言包
   - `sudo apt-get install tesseract-ocr-chi-sim`

3. **内存不足**
   - 解决：减少并发，增加 swap

4. **进度不更新**
   - 检查：浏览器控制台错误
   - 检查：后端日志

## 许可证

MIT License

## 联系方式

如有问题，请提交 Issue 或联系开发团队。
