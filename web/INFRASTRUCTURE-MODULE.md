# 基础设施模块文档

**版本**: v1.0  
**最后更新**: 2026-03-16  
**制定**: 云龙虾 1 号 - 首席架构师  
**模块代号**: Agent-Infra

---

## 📋 概述

基础设施模块为整个需求管理系统提供底层支持，包括：

- ✅ 全局错误处理
- ✅ 请求日志记录
- ✅ 性能监控
- ✅ 文件上传服务（支持断点续传）
- ✅ 统一 API 响应格式

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────┐
│              HTTP 请求                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          请求日志中间件                          │
│  - 记录所有 API 调用                              │
│  - 性能监控（慢查询告警）                        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          API 路由处理                            │
│  - 业务逻辑                                      │
│  - 数据操作                                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          全局错误处理中间件                      │
│  - 统一错误格式                                  │
│  - 错误日志记录                                  │
│  - 错误码管理                                    │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              HTTP 响应                          │
└─────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
web/
├── api-server.js          # 主 API 服务器（已集成中间件）
├── middleware.js          # 全局中间件模块
├── file-upload.js         # 文件上传服务
└── logs/                  # 日志目录（自动创建）
    ├── requests.log       # 请求日志
    ├── errors.log         # 错误日志
    └── performance.log    # 性能日志
```

---

## 🔧 核心功能

### 1. 全局错误处理

**位置**: `middleware.js`

**功能**:
- 统一的错误响应格式
- 错误日志自动记录
- 预定义错误码系统
- 开发/生产环境错误信息分离

**错误码规范**:
```javascript
ERROR_CODES = {
  // 1xxx - 用户认证
  UNAUTHORIZED: 1001,
  FORBIDDEN: 1002,
  
  // 2xxx - 项目
  PROJECT_NOT_FOUND: 2001,
  
  // 3xxx - 需求
  REQUIREMENT_NOT_FOUND: 3001,
  
  // 4xxx - 用例
  TESTCASE_NOT_FOUND: 4001,
  
  // 5xxx - 文件
  FILE_TOO_LARGE: 5001,
  INVALID_FILE_TYPE: 5002,
  FILE_UPLOAD_FAILED: 5003,
  
  // 9xxx - 系统
  INTERNAL_ERROR: 9000,
  VALIDATION_ERROR: 9003
}
```

**使用示例**:
```javascript
// 在 API 处理器中
try {
    // 业务逻辑
} catch (error) {
    logError(error, { url: req.url, method: req.method });
    return jsonRes(res, 500, createErrorResponse(
        error.message,
        error.errorCode || ERROR_CODES.INTERNAL_ERROR
    ));
}
```

**错误响应格式**:
```json
{
  "success": false,
  "message": "错误描述",
  "errorCode": 5001,
  "timestamp": "2026-03-16T12:00:00.000Z"
}
```

---

### 2. 请求日志记录

**位置**: `middleware.js`

**功能**:
- 自动记录所有 API 请求
- 记录请求方法、URL、状态码、耗时
- 慢查询自动标记和告警
- 日志文件自动轮转（保留 7 天）

**日志格式**:
```json
{
  "timestamp": "2026-03-16T12:00:00.000Z",
  "method": "POST",
  "url": "/api/requirements",
  "statusCode": 200,
  "durationMs": 156,
  "userId": "admin",
  "slow": false
}
```

**配置**:
```javascript
PERFORMANCE_CONFIG = {
    slowQueryThreshold: 1000,  // 慢查询阈值（毫秒）
    enableLogging: true,
    enablePerformanceMonitoring: true
}
```

**查看日志**:
```bash
# 查看最近的请求日志
tail -f web/logs/requests.log | jq .

# 查看所有慢查询
cat web/logs/requests.log | jq 'select(.slow == true)'

# 查看错误统计
cat web/logs/errors.log | jq -r '.message' | sort | uniq -c | sort -rn
```

---

### 3. 性能监控

**位置**: `middleware.js`

**功能**:
- API 响应时间监控
- 慢查询自动告警（>1 秒）
- 性能日志记录
- 系统统计信息接口

**使用示例**:
```javascript
// 开始监控
const perfMonitor = startPerformanceMonitor();

// 添加标记点（可选）
markPerformance(perfMonitor, 'database_query');

// 结束监控并记录
endPerformanceMonitor(perfMonitor, 'create_requirement', {
    requirementId: 'req_123'
});
```

**性能日志格式**:
```json
{
  "timestamp": "2026-03-16T12:00:00.000Z",
  "operation": "POST /api/requirements",
  "durationMs": 1250,
  "marks": [
    {"label": "database_query", "time": 850}
  ],
  "slow": true
}
```

**监控接口**:
```bash
# 健康检查
curl http://localhost:8001/api/health

# 系统统计
curl http://localhost:8001/api/system/stats
```

**系统统计响应**:
```json
{
  "success": true,
  "message": "系统统计信息",
  "data": {
    "requests": {
      "total": 1523,
      "slow": 12,
      "errors": 5
    },
    "errors": {
      "total": 23
    },
    "performance": {
      "avgDuration": 145,
      "slowQueries": 12
    }
  }
}
```

---

### 4. 文件上传服务

**位置**: `file-upload.js`

**功能**:
- ✅ 简单文件上传（<50MB）
- ✅ 分片上传（大文件）
- ✅ 断点续传
- ✅ 上传进度查询
- ✅ 文件 MD5 校验
- ✅ 文件类型验证
- ✅ 上传记录管理

#### 4.1 简单上传

**接口**: `POST /api/upload`

**请求**: `multipart/form-data`

**响应**:
```json
{
  "success": true,
  "message": "文件上传成功",
  "data": [
    {
      "id": "file_xxx",
      "originalName": "document.pdf",
      "fileName": "1710590000_xxx.pdf",
      "mimeType": "application/pdf",
      "size": 102400,
      "md5": "d41d8cd98f00b204e9800998ecf8427e",
      "url": "/uploads/1710590000_xxx.pdf",
      "uploadedAt": "2026-03-16T12:00:00.000Z"
    }
  ]
}
```

**限制**:
- 最大文件大小：50MB
- 支持格式：所有格式（可在 middleware.js 中配置白名单）

---

#### 4.2 分片上传（大文件/断点续传）

**流程**:

1. **初始化上传**
```http
POST /api/upload/chunked/init
Content-Type: application/json

{
  "fileName": "large_video.mp4",
  "fileSize": 104857600,
  "mimeType": "video/mp4",
  "md5": "optional_md5_hash",
  "totalChunks": 100
}
```

**响应**:
```json
{
  "success": true,
  "message": "分片上传初始化成功",
  "data": {
    "uploadId": "upload_xxx",
    "chunkDir": "/api/upload/chunks/upload_xxx",
    "totalChunks": 100
  }
}
```

2. **上传分片**
```http
POST /api/upload/chunks/{uploadId}/{chunkIndex}
Content-Type: multipart/form-data

chunk: [file data]
```

**响应**:
```json
{
  "success": true,
  "message": "分片 0 上传成功",
  "data": {
    "uploadId": "upload_xxx",
    "chunkIndex": 0,
    "uploadedChunks": 1,
    "totalChunks": 100,
    "progress": 1
  }
}
```

3. **查询进度**（可选）
```http
GET /api/upload/progress/{uploadId}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_xxx",
    "fileName": "large_video.mp4",
    "totalChunks": 100,
    "uploadedChunks": 50,
    "progress": 50,
    "status": "uploading"
  }
}
```

4. **合并分片**
```http
POST /api/upload/chunks/{uploadId}/merge
```

**响应**:
```json
{
  "success": true,
  "message": "文件合并成功",
  "data": {
    "id": "file_xxx",
    "originalName": "large_video.mp4",
    "fileName": "1710590000_xxx.mp4",
    "mimeType": "video/mp4",
    "size": 104857600,
    "md5": "final_md5_hash",
    "url": "/uploads/1710590000_xxx.mp4",
    "uploadedAt": "2026-03-16T12:00:00.000Z",
    "uploadId": "upload_xxx",
    "chunkedUpload": true
  }
}
```

---

#### 4.3 上传记录管理

**获取所有上传记录**:
```http
GET /api/uploads
```

**删除上传文件**:
```http
DELETE /api/uploads/{fileId}
```

---

## 📊 API 接口清单

### 监控类

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/system/stats` | GET | 系统统计信息 |

### 文件上传类

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/upload` | POST | 简单文件上传 |
| `/api/upload/chunked/init` | POST | 初始化分片上传 |
| `/api/upload/chunks/{uploadId}/{chunkIndex}` | POST | 上传分片 |
| `/api/upload/chunks/{uploadId}/merge` | POST | 合并分片 |
| `/api/upload/progress/{uploadId}` | GET | 查询上传进度 |
| `/api/uploads` | GET | 获取上传记录 |
| `/api/uploads/{fileId}` | DELETE | 删除上传文件 |

---

## 🔍 运维指南

### 日志管理

**查看实时日志**:
```bash
# 请求日志
tail -f web/logs/requests.log | jq .

# 错误日志
tail -f web/logs/errors.log | jq .

# 性能日志（慢查询）
tail -f web/logs/performance.log | jq 'select(.slow == true)'
```

**日志分析**:
```bash
# 统计慢查询数量
cat web/logs/requests.log | jq 'select(.slow == true)' | wc -l

# 统计错误类型
cat web/logs/errors.log | jq -r '.errorCode' | sort | uniq -c | sort -rn

# 查看平均响应时间
cat web/logs/requests.log | jq -s '[.[].durationMs] | add / length'
```

**清理旧日志**:
```bash
# 手动清理 7 天前的日志
find web/logs -name "*.log" -mtime +7 -delete

# 或通过 API 清理（需实现）
curl -X POST http://localhost:8001/api/system/cleanup-logs
```

### 性能调优

**慢查询优化**:
1. 查看性能日志识别慢查询
2. 分析慢查询的业务逻辑
3. 优化数据库查询或添加索引
4. 考虑缓存热点数据

**内存监控**:
```bash
# 查看 Node.js 进程内存使用
ps aux | grep node

# 或通过健康检查接口
curl http://localhost:8001/api/health | jq .data.memory
```

---

## 🛡️ 安全建议

### 文件上传安全

1. **文件大小限制**: 默认 50MB，可根据需要调整
2. **文件类型验证**: 在 `file-upload.js` 中配置白名单
3. **文件重命名**: 自动重命名为时间戳 + 随机数，防止覆盖和预测
4. **MD5 校验**: 支持上传前后 MD5 校验，防止传输损坏

### 日志安全

1. **敏感信息脱敏**: 生产环境不返回详细错误堆栈
2. **日志访问控制**: 限制日志文件访问权限
3. **定期清理**: 自动清理 7 天前的日志，避免泄露

---

## 📝 开发指南

### 添加新的 API 接口

```javascript
// 1. 在 api-server.js 中添加路由
if (url === '/api/new-feature' && method === 'POST') {
    const perfMonitor = startPerformanceMonitor();
    
    try {
        // 2. 业务逻辑
        validateRequest(['requiredField'])(body);
        
        // 3. 性能监控标记（可选）
        markPerformance(perfMonitor, 'database_operation');
        
        // 4. 返回成功响应
        const result = await doSomething();
        endPerformanceMonitor(perfMonitor, 'new_feature');
        return jsonRes(res, 200, createSuccessResponse(result));
        
    } catch (error) {
        // 5. 错误处理
        logError(error, { type: 'new_feature' });
        return jsonRes(res, 500, createErrorResponse(
            error.message,
            error.errorCode || ERROR_CODES.INTERNAL_ERROR
        ));
    }
}
```

### 添加新的错误码

在 `middleware.js` 的 `ERROR_CODES` 对象中添加:

```javascript
const ERROR_CODES = {
    // ... 现有错误码
    
    // 新模块错误码（按模块分配编号段）
    // 例如：10xxx - 新模块
    NEW_FEATURE_NOT_FOUND: 10001,
    NEW_FEATURE_CREATE_FAILED: 10002
};
```

---

## 🧪 测试指南

### 单元测试

```javascript
// 测试文件上传
const { handleSimpleUpload } = require('./file-upload');
const { createSuccessResponse, ERROR_CODES } = require('./middleware');

// 测试错误处理
assert.strictEqual(
    createErrorResponse('Test error', ERROR_CODES.VALIDATION_ERROR).success,
    false
);

// 测试成功响应
assert.strictEqual(
    createSuccessResponse({ data: 'test' }).success,
    true
);
```

### 集成测试

```bash
# 测试健康检查
curl http://localhost:8001/api/health

# 测试文件上传
curl -X POST http://localhost:8001/api/upload \
  -F "file=@test.pdf"

# 测试系统统计
curl http://localhost:8001/api/system/stats
```

---

## 📈 性能指标

### 目标指标

- **API 响应时间**: < 500ms (95% 请求)
- **慢查询比例**: < 1%
- **错误率**: < 0.1%
- **文件上传成功率**: > 99.9%

### 监控告警

当以下指标超标时自动告警:

- 单个 API 响应时间 > 1 秒
- 错误日志增长速率 > 10 条/分钟
- 慢查询比例 > 5%

---

## 🔄 版本历史

### v1.0 (2026-03-16)

**新增功能**:
- ✅ 全局错误处理中间件
- ✅ 请求日志记录
- ✅ 性能监控（慢查询告警）
- ✅ 文件上传优化（支持断点续传）
- ✅ 统一 API 响应格式
- ✅ 系统健康检查接口
- ✅ 系统统计信息接口

**优化**:
- 统一错误码规范
- 日志自动轮转（7 天）
- 生产环境错误信息脱敏

---

## 📞 联系支持

**负责人**: 云龙虾 1 号 🦞  
**模块代号**: Agent-Infra  
**问题反馈**: 直接 @首席架构师

---

_遵守开发规范，确保系统稳定性_
