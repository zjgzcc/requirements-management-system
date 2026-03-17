#!/bin/bash

# PWA 图标生成脚本
# 使用 ImageMagick 从 SVG 生成各种尺寸的 PNG 图标

ICON_SVG="/home/admin/.openclaw/workspace/web/icons/icon.svg"
ICONS_DIR="/home/admin/.openclaw/workspace/web/icons"

# 检查 ImageMagick 是否安装
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick 未安装，请先安装:"
    echo "   sudo apt-get install imagemagick  # Debian/Ubuntu"
    echo "   sudo yum install ImageMagick      # CentOS/RHEL"
    exit 1
fi

echo "🎨 开始生成 PWA 图标..."

# 生成各种尺寸的图标
convert -background none -resize 72x72 "$ICON_SVG" "$ICONS_DIR/icon-72x72.png"
convert -background none -resize 96x96 "$ICON_SVG" "$ICONS_DIR/icon-96x96.png"
convert -background none -resize 128x128 "$ICON_SVG" "$ICONS_DIR/icon-128x128.png"
convert -background none -resize 144x144 "$ICON_SVG" "$ICONS_DIR/icon-144x144.png"
convert -background none -resize 152x152 "$ICON_SVG" "$ICONS_DIR/icon-152x152.png"
convert -background none -resize 192x192 "$ICON_SVG" "$ICONS_DIR/icon-192x192.png"
convert -background none -resize 384x384 "$ICON_SVG" "$ICONS_DIR/icon-384x384.png"
convert -background none -resize 512x512 "$ICON_SVG" "$ICONS_DIR/icon-512x512.png"

# 生成快捷方式图标
convert -background none -resize 96x92 "$ICON_SVG" "$ICONS_DIR/shortcut-home.png"
convert -background none -resize 96x92 "$ICON_SVG" "$ICONS_DIR/shortcut-requirements.png"
convert -background none -resize 96x92 "$ICON_SVG" "$ICONS_DIR/shortcut-tasks.png"
convert -background none -resize 96x92 "$ICON_SVG" "$ICONS_DIR/shortcut-testcases.png"

echo "✅ 图标生成完成!"
ls -lh "$ICONS_DIR"/*.png
