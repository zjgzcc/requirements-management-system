# =============================================================================
# 多阶段构建 Dockerfile - 医疗器械需求管理系统
# =============================================================================
# 优化目标：
# - 最小化镜像大小
# - 分层缓存优化
# - 生产环境安全配置
# =============================================================================

# -----------------------------------------------------------------------------
# 阶段 1: Node.js 前端构建
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

# 复制 package 文件以利用缓存
COPY web/package*.json ./

# 安装依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 复制前端代码
COPY web/ ./

# 构建前端（如有需要）
RUN npm run build || echo "No build step required"

# -----------------------------------------------------------------------------
# 阶段 2: Python 后端构建
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS backend-builder

WORKDIR /app/api

# 安装系统依赖（OCR 工具）
RUN apt-get update && apt-get install -y --no-install-recommends \
    ocrmypdf \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY api/requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

# -----------------------------------------------------------------------------
# 阶段 3: 生产运行环境
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS production

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NODE_ENV=production

# 创建非 root 用户
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# 从构建阶段复制系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ocrmypdf \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    tesseract-ocr-chi-tra \
    tesseract-ocr-eng \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# 复制 Python 依赖
COPY --from=backend-builder /root/.local /home/appuser/.local

# 复制 Node.js 依赖和前端代码
COPY --from=frontend-builder /app/web /app/web

# 复制后端代码
COPY api/ /app/api/

# 创建必要的目录
RUN mkdir -p /app/uploads /app/output /app/web/logs && \
    chown -R appuser:appgroup /app

# 切换到非 root 用户
USER appuser

# 将 Python 用户 bin 目录添加到 PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# 暴露端口
EXPOSE 8000 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

# 启动命令
CMD ["sh", "-c", "cd /app/api && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 & cd /app/web && node server.js"]
