#!/bin/bash
# =============================================================================
# Docker 镜像推送脚本
# =============================================================================
# 用途：推送 Docker 镜像到镜像仓库
# 使用：./scripts/push-docker.sh [registry] [version]
# =============================================================================

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1" }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" }
log_error() { echo -e "${RED}[ERROR]${NC} $1" }

# 默认参数
REGISTRY="${1:-docker.io}"
VERSION="${2:-latest}"
IMAGE_NAME="requirements-management-system"
LOCAL_TAG="${IMAGE_NAME}:${VERSION}"

# 帮助信息
show_help() {
    cat << EOF
Docker 镜像推送脚本

用法：$0 [镜像仓库] [版本]

参数:
    镜像仓库    Docker 镜像仓库地址 (默认：docker.io)
                示例：docker.io, ghcr.io, registry.cn-shanghai.aliyuncs.com
    版本        镜像版本号 (默认：latest)
                示例：1.0.0, 2024.03.18, latest

示例:
    $0                              # 推送到 Docker Hub (latest)
    $0 docker.io 1.0.0              # 推送到 Docker Hub (1.0.0)
    $0 ghcr.io/username 1.0.0       # 推送到 GitHub Container Registry
    $0 registry.cn-shanghai.aliyuncs.com/myapp 1.0.0  # 阿里云

前置条件:
    1. 已安装 Docker
    2. 已登录镜像仓库 (docker login)
    3. 本地镜像已构建

EOF
}

# 检查参数
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    log_error "未找到 Docker"
    exit 1
fi

# 检查是否登录
if ! docker info &> /dev/null; then
    log_error "Docker 未运行"
    exit 1
fi

# 检查本地镜像是否存在
if ! docker image inspect "$LOCAL_TAG" &> /dev/null; then
    log_error "本地镜像不存在：$LOCAL_TAG"
    log_info "请先运行构建脚本：./scripts/build-docker.sh"
    exit 1
fi

# 生成远程镜像标签
if [[ "$REGISTRY" == "docker.io" ]]; then
    # Docker Hub 需要用户名
    DOCKER_USERNAME=$(docker info 2>/dev/null | grep "Username:" | cut -d' ' -f2)
    if [[ -z "$DOCKER_USERNAME" ]]; then
        log_warn "未检测到 Docker Hub 用户名"
        read -p "请输入 Docker Hub 用户名：" DOCKER_USERNAME
    fi
    REMOTE_TAG="${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
else
    REMOTE_TAG="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
fi

# 显示推送信息
echo ""
echo "============================================================"
echo "  Docker 镜像推送"
echo "============================================================"
echo "  本地镜像：  $LOCAL_TAG"
echo "  远程镜像：  $REMOTE_TAG"
echo "  版本：      $VERSION"
echo "============================================================"
echo ""

# 确认推送
read -p "确认推送镜像？(y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "推送已取消"
    exit 0
fi

# 标记镜像
log_info "标记镜像..."
docker tag "$LOCAL_TAG" "$REMOTE_TAG"

# 推送镜像
log_info "推送镜像到 $REGISTRY ..."
echo ""

# 显示进度
docker push "$REMOTE_TAG"

# 检查推送结果
if [ $? -eq 0 ]; then
    echo ""
    log_success "镜像推送成功！"
    echo ""
    
    # 显示镜像信息
    log_info "推送的镜像:"
    docker images "$REMOTE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    echo ""
    echo "============================================================"
    echo "  部署指南"
    echo "============================================================"
    echo ""
    echo "  1. 从镜像仓库拉取:"
    echo "     docker pull $REMOTE_TAG"
    echo ""
    echo "  2. 运行容器:"
    echo "     docker run -d -p 8000:8000 -p 3000:3000 $REMOTE_TAG"
    echo ""
    echo "  3. 使用 docker-compose:"
    echo "     更新 docker-compose.yml 中的 image 字段为：$REMOTE_TAG"
    echo "     docker-compose up -d"
    echo ""
    echo "============================================================"
    echo ""
    
    exit 0
else
    log_error "镜像推送失败！"
    log_info "请检查:"
    echo "  - 是否已登录镜像仓库 (docker login)"
    echo "  - 网络连接是否正常"
    echo "  - 是否有推送权限"
    exit 1
fi
