#!/bin/bash
# PDF OCR 系统启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  PDF OCR 系统"
echo "============================================================"
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误：未找到 Python 3"
    exit 1
fi

echo "✅ Python 版本：$(python3 --version)"

# 检查依赖
echo ""
echo "检查系统依赖..."

if command -v ocrmypdf &> /dev/null; then
    echo "✅ OCRmyPDF: $(ocrmypdf --version 2>&1 | head -1)"
else
    echo "❌ OCRmyPDF 未安装"
    echo ""
    echo "请安装 OCRmyPDF:"
    echo "  Ubuntu/Debian: sudo apt-get install ocrmypdf"
    echo "  macOS: brew install ocrmypdf"
    echo "  CentOS: sudo yum install ocrmypdf"
    exit 1
fi

if command -v pdfinfo &> /dev/null; then
    echo "✅ Poppler (pdfinfo): 已安装"
else
    echo "⚠️  pdfinfo 未安装（文件信息功能可能受限）"
fi

# 检查 Python 依赖
echo ""
echo "检查 Python 依赖..."
cd api

if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "安装 Python 依赖..."
    pip3 install -r requirements.txt
fi

echo "✅ Python 依赖：已安装"

# 创建必要目录
cd "$SCRIPT_DIR"
mkdir -p uploads output

echo ""
echo "============================================================"
echo "  启动服务器..."
echo "============================================================"
echo ""
echo "访问地址：http://localhost:8000"
echo "API 文档：http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

cd api
python3 main.py
