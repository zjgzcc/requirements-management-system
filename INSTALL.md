# PDF OCR 系统安装指南

## 系统要求

- Python 3.8+
- Linux/macOS/Windows
- 至少 2GB 可用内存
- Ghostscript（OCRmyPDF 依赖）

## 安装步骤

### 1. 安装系统依赖

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y ocrmypdf ghostscript poppler-utils
```

#### CentOS/RHEL
```bash
sudo yum install -y epel-release
sudo yum install -y ocrmypdf ghostscript poppler-utils
```

#### macOS (使用 Homebrew)
```bash
brew install ocrmypdf poppler
```

#### Windows
1. 安装 WSL2（推荐）
2. 在 WSL2 中按照 Ubuntu 步骤安装
3. 或者使用 Docker（见下文）

### 2. 安装 Python 依赖

```bash
cd /home/admin/.openclaw/workspace/api
pip install -r requirements.txt
```

### 3. 安装中文字体（可选但推荐）

为了提高中文 OCR 准确率，建议安装中文字体：

```bash
# Ubuntu/Debian
sudo apt-get install -y fonts-wqy-zenhei fonts-wqy-microhei

# macOS
brew install --cask font-wenquanyi
```

### 4. 下载 OCR 语言数据

OCRmyPDF 默认使用 Tesseract OCR，需要下载中文语言包：

```bash
# Ubuntu/Debian
sudo apt-get install -y tesseract-ocr-chi-sim tesseract-ocr-eng

# macOS
brew install tesseract-lang
```

### 5. 启动服务器

```bash
cd /home/admin/.openclaw/workspace/api
python main.py
```

服务器将在 http://localhost:8000 启动。

## 使用 Docker（可选）

如果不想安装系统依赖，可以使用 Docker：

```bash
docker run -d -p 8000:8000 \
  -v /home/admin/.openclaw/workspace/uploads:/app/uploads \
  -v /home/admin/.openclaw/workspace/output:/app/output \
  --name pdf-ocr \
  jbreit/ocrmypdf:latest
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 前端页面 |
| `/upload` | POST | 上传 PDF 文件 |
| `/process/{task_id}` | POST | 开始处理 |
| `/cancel/{task_id}` | POST | 取消任务 |
| `/progress/{task_id}` | GET | 获取进度 |
| `/fileinfo/{task_id}` | GET | 获取文件信息 |
| `/status/{task_id}` | GET | 获取任务状态 |
| `/download/{task_id}` | GET | 下载结果 |
| `/tasks` | GET | 列出所有任务 |
| `/task/{task_id}` | DELETE | 删除任务 |

## 测试

1. 访问 http://localhost:8000
2. 上传一个 PDF 文件
3. 点击"开始处理"
4. 观察实时进度
5. 处理完成后下载结果

## 故障排除

### OCRmyPDF 未找到
```bash
which ocrmypdf
# 如果未找到，请安装系统依赖
```

### 中文识别效果差
- 确保安装了中文字体
- 确保安装了中文 OCR 语言包
- 尝试调整 PDF 分辨率

### 内存不足
- 减少并发处理数量
- 增加系统 swap 空间
- 分批处理大文件

## 性能优化

1. **SSD 存储**: 使用 SSD 可显著提升处理速度
2. **多核 CPU**: OCRmyPDF 支持并行处理
3. **足够内存**: 建议至少 4GB 可用内存
