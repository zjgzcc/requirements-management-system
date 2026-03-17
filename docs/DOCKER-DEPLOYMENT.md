# Docker 部署指南

医疗器械需求管理系统 - Docker 容器化部署完整指南

## 📋 目录

- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [构建镜像](#构建镜像)
- [运行容器](#运行容器)
- [多环境配置](#多环境配置)
- [数据持久化](#数据持久化)
- [健康检查](#健康检查)
- [日志管理](#日志管理)
- [常见问题](#常见问题)
- [故障排查](#故障排查)

---

## 🚀 快速开始

### 一键部署（推荐）

```bash
# 克隆项目
cd /home/admin/.openclaw/workspace

# 构建并启动
docker-compose up -d

# 查看状态
docker-compose ps

# 访问应用
# 后端 API: http://localhost:8000/docs
# 前端界面：http://localhost:3000
```

### 使用构建脚本

```bash
# 构建生产环境镜像
./scripts/build-docker.sh prod 1.0.0

# 启动服务
docker-compose up -d
```

---

## 📦 环境要求

### 硬件要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核心 | 4 核心 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 10 GB | 20 GB SSD |

### 软件要求

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **操作系统**: Linux (Ubuntu 20.04+, CentOS 7+), macOS, Windows 10+

### 检查环境

```bash
# 检查 Docker 版本
docker --version
docker-compose --version

# 检查 Docker 运行状态
docker info
```

---

## 🔨 构建镜像

### 使用构建脚本（推荐）

```bash
# 构建生产环境（latest）
./scripts/build-docker.sh prod

# 构建生产环境（指定版本）
./scripts/build-docker.sh prod 1.0.0

# 构建开发环境
./scripts/build-docker.sh dev
```

### 手动构建

```bash
# 生产环境
docker build -t requirements-management-system:latest --target production .

# 开发环境
docker build -t requirements-management-system:dev --target production .

# 带构建参数
docker build \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  -t requirements-management-system:1.0.0 \
  .
```

### 多阶段构建优势

```dockerfile
# 阶段 1: Node.js 前端构建 (node:20-alpine)
# 阶段 2: Python 后端构建 (python:3.11-slim)
# 阶段 3: 生产运行环境 (python:3.11-slim)

# 最终镜像大小：~800MB
# 传统构建：~1.5GB
```

---

## 🏃 运行容器

### 使用 Docker Compose（推荐）

```bash
# 生产环境
docker-compose -f docker-compose.prod.yml up -d

# 开发环境
docker-compose -f docker-compose.dev.yml up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

### 使用 Docker 命令

```bash
# 运行容器
docker run -d \
  --name rms \
  -p 8000:8000 \
  -p 3000:3000 \
  -v uploads_data:/app/uploads \
  -v output_data:/app/output \
  -e NODE_ENV=production \
  requirements-management-system:latest

# 查看容器状态
docker ps
docker stats rms

# 进入容器
docker exec -it rms bash

# 查看日志
docker logs -f rms
```

### 环境变量配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `NODE_ENV` | Node.js 环境 | `production` | `development`, `production` |
| `PYTHONUNBUFFERED` | Python 输出缓冲 | `1` | `1` |
| `DEBUG` | 调试模式 | `0` | `0`, `1` |
| `LOG_LEVEL` | 日志级别 | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `UPLOAD_DIR` | 上传目录 | `/app/uploads` | `/app/uploads` |
| `OUTPUT_DIR` | 输出目录 | `/app/output` | `/app/output` |
| `SECURITY_HEADERS` | 安全头 | `1` | `0`, `1` |
| `CORS_ORIGINS` | CORS 允许源 | - | `https://your-domain.com` |

---

## 🌍 多环境配置

### 开发环境

```bash
# 启动开发环境（支持热重载）
docker-compose -f docker-compose.dev.yml up -d

# 特性:
# - 源代码挂载（修改即生效）
# - 调试日志
# - 宽松的资源限制
# - 频繁的健康检查
```

**docker-compose.dev.yml 特点:**
- 挂载 `./api` 和 `./web` 目录
- 启用 `--reload` 热重载
- 日志级别：DEBUG
- 资源限制：4 CPU, 4GB 内存

### 测试环境

```bash
# 使用生产配置但连接测试数据库
docker-compose -f docker-compose.yml up -d

# 配置测试环境变量
export NODE_ENV=test
export LOG_LEVEL=INFO
```

### 生产环境

```bash
# 启动生产环境
docker-compose -f docker-compose.prod.yml up -d

# 特性:
# - 只读文件系统（可选）
# - 严格的安全配置
# - 资源限制优化
# - 自动重启策略
# - 日志轮转
```

**docker-compose.prod.yml 特点:**
- 重启策略：`always`
- 安全选项：`no-new-privileges`
- 日志轮转：100MB × 10 文件
- 健康检查：30 秒间隔，5 次重试

---

## 💾 数据持久化

### 数据卷类型

```yaml
volumes:
  # 命名卷（推荐）
  uploads_data:
    driver: local
    name: rms-uploads-data
  
  # 绑定挂载
  - ./web/data:/app/web/data:ro
```

### 数据卷管理

```bash
# 查看数据卷
docker volume ls

# 查看数据卷详情
docker volume inspect rms-uploads-data

# 备份数据卷
docker run --rm \
  -v rms-uploads-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup.tar.gz -C /data .

# 恢复数据卷
docker run --rm \
  -v rms-uploads-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/uploads-backup.tar.gz -C /data

# 删除数据卷（危险操作！）
docker volume rm rms-uploads-data
```

### 数据目录结构

```
/app/
├── uploads/          # 上传文件（持久化）
│   └── *.pdf
├── output/           # 输出文件（持久化）
│   └── *.pdf
└── web/
    ├── logs/         # 日志文件（持久化）
    │   └── *.log
    └── data/         # 数据文件（只读挂载）
        ├── users.json
        ├── projects.json
        └── ...
```

---

## ❤️ 健康检查

### 配置说明

```yaml
healthcheck:
  test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')"]
  interval: 30s      # 检查间隔
  timeout: 10s       # 超时时间
  retries: 3         # 重试次数
  start_period: 10s  # 启动宽限期
```

### 检查健康状态

```bash
# 查看容器健康状态
docker inspect --format='{{.State.Health.Status}}' rms

# 查看健康检查日志
docker inspect --format='{{json .State.Health}}' rms | jq

# Docker Compose 方式
docker-compose ps
```

### 健康检查端点

| 端点 | 说明 | 端口 |
|------|------|------|
| `/docs` | FastAPI 文档 | 8000 |
| `/health` | 健康检查接口 | 8000 |
| `/` | 前端首页 | 3000 |

---

## 📝 日志管理

### 查看日志

```bash
# 实时查看日志
docker-compose logs -f app

# 查看最近 100 行
docker-compose logs --tail=100 app

# 查看特定时间范围
docker-compose logs --since="2024-03-18T00:00:00" app

# 导出日志到文件
docker-compose logs app > app-logs.txt
```

### 日志配置

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"    # 单个日志文件最大大小
    max-file: "10"      # 日志文件数量
```

### 日志轮转

```bash
# 清理旧日志
docker-compose logs --tail=0

# 重启容器以应用新配置
docker-compose restart

# 手动轮转日志
docker kill --signal=USR1 rms
```

---

## ❓ 常见问题

### 1. 容器无法启动

**问题**: 容器启动后立即退出

**解决方案**:
```bash
# 查看容器日志
docker logs rms

# 检查端口占用
lsof -i :8000
lsof -i :3000

# 检查资源限制
docker stats rms

# 重新构建镜像
docker-compose build --no-cache
```

### 2. OCR 功能不可用

**问题**: PDF OCR 处理失败

**解决方案**:
```bash
# 检查 OCR 工具是否安装
docker exec rms which ocrmypdf
docker exec rms which tesseract

# 检查语言包
docker exec rms tesseract --list-langs

# 重新构建镜像（确保安装 OCR 依赖）
docker-compose build --no-cache
```

### 3. 数据丢失

**问题**: 重启容器后数据消失

**解决方案**:
```bash
# 确保使用命名卷
docker volume ls | grep rms

# 检查 docker-compose.yml 中的 volumes 配置
# 确保不是临时卷

# 从备份恢复
# 参考"数据持久化"章节
```

### 4. 端口冲突

**问题**: 端口 8000 或 3000 已被占用

**解决方案**:
```bash
# 修改 docker-compose.yml 中的端口映射
ports:
  - "8001:8000"  # 使用 8001 代替 8000
  - "3001:3000"  # 使用 3001 代替 3000

# 或者停止占用端口的服务
sudo lsof -ti:8000 | xargs kill -9
```

### 5. 内存不足

**问题**: 容器因内存不足被杀死

**解决方案**:
```bash
# 增加内存限制
# 编辑 docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G  # 增加到 4GB

# 或者添加 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 6. 构建失败

**问题**: Docker 镜像构建失败

**解决方案**:
```bash
# 清理 Docker 缓存
docker system prune -a

# 检查 Dockerfile 语法
docker build -t test .

# 检查网络连接
ping -c 3 pypi.org
ping -c 3 registry.npmjs.org

# 使用国内镜像源
# 编辑 /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://registry.docker-cn.com"
  ]
}
```

---

## 🔧 故障排查

### 诊断命令

```bash
# 容器状态
docker ps -a
docker inspect rms

# 资源使用
docker stats rms

# 网络检查
docker network ls
docker network inspect app-network

# 卷检查
docker volume ls
docker volume inspect rms-uploads-data

# 进入容器调试
docker exec -it rms bash

# 检查进程
docker top rms

# 查看事件
docker events --since 10m
```

### 常见问题诊断流程

```
1. 容器无法启动
   ↓
   docker logs rms
   ↓
   查看错误信息
   ↓
   针对性解决

2. 应用无响应
   ↓
   docker-compose ps
   ↓
   检查健康状态
   ↓
   docker inspect --format='{{.State.Health.Status}}' rms
   ↓
   查看应用日志

3. 性能问题
   ↓
   docker stats rms
   ↓
   检查 CPU/内存使用
   ↓
   调整资源限制
```

### 获取帮助

```bash
# 查看脚本帮助
./scripts/build-docker.sh --help
./scripts/push-docker.sh --help

# 查看 Docker 版本信息
docker --version
docker-compose --version

# 检查系统资源
free -h
df -h
top
```

---

## 📞 技术支持

- **项目仓库**: https://github.com/zjgzcc/requirements-management-system
- **文档**: `/docs` 目录
- **日志**: `docker-compose logs -f`

---

**最后更新**: 2024-03-18  
**版本**: 1.0.0
