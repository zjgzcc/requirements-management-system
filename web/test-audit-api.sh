#!/bin/bash
# 测试审计日志 API

BASE_URL="http://localhost:8001"

echo "======================================"
echo "操作审计日志模块 - API 测试"
echo "======================================"
echo ""

# 1. 登录获取 Token
echo "1. 测试登录接口..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "登录响应：$LOGIN_RESPONSE" | jq .

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
echo ""
echo "获取到的 Token: ${TOKEN:0:20}..."
echo ""

# 2. 获取审计统计数据
echo "2. 测试获取审计统计数据..."
curl -s -X GET "$BASE_URL/api/audit/stats" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 3. 获取审计日志列表
echo "3. 测试获取审计日志列表..."
curl -s -X GET "$BASE_URL/api/audit/logs?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# 4. 按时间范围筛选
echo "4. 测试按时间范围筛选（今天）..."
curl -s -X GET "$BASE_URL/api/audit/logs?timeRange=today" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.total'
echo ""

# 5. 按操作类型筛选
echo "5. 测试按操作类型筛选（login）..."
curl -s -X GET "$BASE_URL/api/audit/logs?operationType=login" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.total'
echo ""

# 6. 导出 CSV
echo "6. 测试导出 CSV..."
curl -s -X GET "$BASE_URL/api/audit/export?format=csv&timeRange=week" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/audit-logs-test.csv

if [ -f /tmp/audit-logs-test.csv ]; then
  echo "CSV 导出成功！文件大小：$(wc -c < /tmp/audit-logs-test.csv) 字节"
  echo "前 5 行内容:"
  head -5 /tmp/audit-logs-test.csv
else
  echo "CSV 导出失败!"
fi
echo ""

# 7. 导出 Excel
echo "7. 测试导出 Excel..."
curl -s -X GET "$BASE_URL/api/audit/export?format=excel&timeRange=week" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/audit-logs-test.xlsx

if [ -f /tmp/audit-logs-test.xlsx ]; then
  echo "Excel 导出成功！文件大小：$(wc -c < /tmp/audit-logs-test.xlsx) 字节"
else
  echo "Excel 导出失败!"
fi
echo ""

# 8. 导出 Word 报告
echo "8. 测试导出 Word 报告..."
curl -s -X GET "$BASE_URL/api/audit/report" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/audit-report-test.docx

if [ -f /tmp/audit-report-test.docx ]; then
  echo "Word 报告导出成功！文件大小：$(wc -c < /tmp/audit-report-test.docx) 字节"
else
  echo "Word 报告导出失败!"
fi
echo ""

# 9. 测试未授权访问
echo "9. 测试未授权访问（应该失败）..."
curl -s -X GET "$BASE_URL/api/audit/logs" | jq .
echo ""

# 10. 创建一些测试数据
echo "10. 创建测试数据（创建项目）..."
curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"审计测试项目","description":"用于测试审计功能"}' | jq .
echo ""

# 11. 再次查看审计日志
echo "11. 查看最新的审计日志..."
curl -s -X GET "$BASE_URL/api/audit/logs?page=1&pageSize=3" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "======================================"
echo "测试完成!"
echo "======================================"
