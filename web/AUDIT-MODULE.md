# 操作审计日志模块

## 概述

操作审计日志模块用于记录和追踪系统中的所有用户操作，确保数据安全与合规性。

## 功能特性

### 1. 审计记录

自动记录以下操作：

- **CRUD 操作**: 创建、更新、删除、查询
- **认证操作**: 登录、登出
- **数据操作**: 导出、导入
- **权限管理**: 权限变更

### 2. 审计查询

支持多维度筛选：

- **时间范围**: 今天、最近 7 天、最近 30 天、自定义
- **用户**: 按操作用户筛选
- **操作类型**: create、update、delete、read、login、logout、export、import、permission
- **数据类型**: user、project、requirement、testcase、defect、task、baseline、trace

### 3. 审计导出

支持多种导出格式：

- **CSV**: 适用于数据分析
- **Excel**: 带自动筛选的表格
- **Word 报告**: 包含统计分析和详细记录

### 4. 审计统计

实时统计：

- 总操作数
- 今日操作数
- 活跃用户数（近 7 天）
- 高频操作类型
- 异常操作数（失败的操作）

## API 接口

### 获取审计日志列表

```
GET /api/audit/logs?page=1&pageSize=20&timeRange=week&user=admin&operationType=create&dataType=requirement
```

**参数说明**:
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `timeRange`: 时间范围（today/week/month/custom）
- `startDate`: 开始日期（timeRange=custom 时使用）
- `endDate`: 结束日期（timeRange=custom 时使用）
- `user`: 用户名
- `operationType`: 操作类型
- `dataType`: 数据类型

**响应示例**:
```json
{
  "success": true,
  "message": "获取审计日志成功",
  "data": {
    "logs": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 获取统计数据

```
GET /api/audit/stats
```

**响应示例**:
```json
{
  "success": true,
  "message": "获取统计数据成功",
  "data": {
    "totalOperations": 1000,
    "todayOperations": 50,
    "activeUsers": 10,
    "topOperation": "update",
    "topOperationCount": 400,
    "abnormalOperations": 5
  }
}
```

### 导出审计日志

```
GET /api/audit/export?format=csv&timeRange=month
```

**参数说明**:
- `format`: 导出格式（csv/excel）
- 其他筛选参数同上

**响应**: 文件下载

### 导出审计报告

```
GET /api/audit/report
```

**响应**: Word 文档下载

## 审计日志结构

```json
{
  "id": "AUDIT_1710681600000_abc123",
  "timestamp": "2026-03-17T14:00:00.000Z",
  "username": "admin",
  "userRole": "admin",
  "operationType": "create",
  "dataType": "requirement",
  "objectId": "REQ_001",
  "objectName": "需求标题",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "method": "POST",
  "endpoint": "/api/requirements",
  "status": "success",
  "details": "创建新需求",
  "changes": {...}
}
```

## 使用界面

访问审计日志页面：`http://localhost:8001/audit.html`

### 界面功能

1. **统计卡片**: 实时显示关键指标
2. **筛选器**: 多维度组合筛选
3. **日志列表**: 分页展示审计记录
4. **详情查看**: 点击"详情"查看完整信息
5. **导出功能**: 支持 CSV、Excel、Word 报告导出
6. **自动刷新**: 可开启自动刷新（30 秒间隔）

## 数据存储

- **文件**: `audit-logs.json`
- **位置**: `/home/admin/.openclaw/workspace/web/audit-logs.json`
- **容量限制**: 自动保留最近 10000 条记录

## 安全考虑

1. **认证要求**: 所有审计 API 需要登录认证
2. **不可篡改**: 审计日志只增不减（除了自动清理过期数据）
3. **完整记录**: 记录失败的操作尝试
4. **IP 追踪**: 记录操作来源 IP 地址

## 性能优化

1. **内存限制**: 最多保留 10000 条记录
2. **分页查询**: 避免一次性加载大量数据
3. **索引优化**: 时间戳倒序存储，最新数据优先

## 集成示例

### 在 API 中记录审计日志

```javascript
// 记录操作
logAudit({
    username: user.username,
    userRole: user.role,
    operationType: 'create',
    dataType: 'requirement',
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    method: 'POST',
    endpoint: '/api/requirements',
    status: 'success',
    details: '创建新需求',
    objectId: newReq.id,
    objectName: newReq.title
});
```

### 获取客户端 IP

```javascript
const ip = getClientIp(req);
```

## 未来扩展

1. **实时告警**: 异常操作实时通知
2. **行为分析**: 用户行为模式识别
3. **合规报告**: 自动生成合规审计报告
4. **数据保留策略**: 可配置的保留期限

## 相关文件

- `web/audit.html` - 审计日志页面
- `web/api-server.js` - API 服务器（包含审计功能）
- `web/audit-logs.json` - 审计日志存储文件

## 快速开始

1. 启动服务器：`./start.sh`
2. 访问审计页面：`http://localhost:8001/audit.html`
3. 使用 admin 账户登录查看所有操作记录

---

**版本**: 1.0.0  
**创建日期**: 2026-03-17  
**最后更新**: 2026-03-17
