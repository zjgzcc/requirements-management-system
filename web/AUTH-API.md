# 认证 API 文档

> 版本：v1.0  
> 创建日期：2026-03-16  
> 最后更新：2026-03-16

---

## 概述

本系统采用基于 Session Token 的认证机制，支持记住我功能和自动过期管理。

### 认证流程

```
用户登录 → 验证凭据 → 生成 Token → 客户端存储 → 请求携带 Token → 服务端验证
```

### Token 说明

- **格式**: 64 字符十六进制字符串
- **有效期**: 
  - 普通登录：30 分钟无操作自动过期
  - 记住我：7 天
- **存储**: 服务端 Session 文件 + 客户端 sessionStorage/localStorage
- **传输**: Authorization Header (Bearer Token)

---

## API 端点

### 1. 用户登录

**接口**: `POST /api/auth/login`

**请求**:
```json
{
  "username": "admin",
  "password": "admin123",
  "rememberMe": true
}
```

**响应** (成功):
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "id": "1",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active",
    "createdAt": "2026-03-15T14:25:12.047Z",
    "token": "b9f6084ee46251ac5c5002e8e65a810a0136a49d1aeec605ad12603a040b2636",
    "expires": 1774274351956
  }
}
```

**响应** (失败):
```json
{
  "success": false,
  "message": "用户名或密码错误",
  "code": 401
}
```

**错误码**:
- `400` - 用户名或密码为空
- `401` - 用户名或密码错误
- `403` - 账户已被禁用

---

### 2. 用户登出

**接口**: `POST /api/auth/logout`

**请求头**:
```
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

**说明**:
- 登出后 Token 立即失效
- 客户端应清除存储的用户信息和 Token
- 重复调用登出接口不会报错

---

### 3. 获取当前用户信息

**接口**: `GET /api/auth/me`

**请求头**:
```
Authorization: Bearer <token>
```

**响应** (成功):
```json
{
  "success": true,
  "data": {
    "id": "1",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active",
    "createdAt": "2026-03-15T14:25:12.047Z"
  },
  "session": {
    "expires": 1774274351956,
    "lastActivity": 1773669587048
  }
}
```

**响应** (失败):
```json
{
  "success": false,
  "message": "未授权访问",
  "code": 401
}
```

**说明**:
- 用于页面加载时恢复用户登录状态
- 可检测 Token 是否过期
- 返回 session 信息包含过期时间和最后活动时间

---

## 客户端使用示例

### JavaScript (前端)

```javascript
// 登录
async function login(username, password, rememberMe = false) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password, rememberMe })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // 保存用户信息
    sessionStorage.setItem('currentUser', JSON.stringify(result.data));
    sessionStorage.setItem('authToken', result.data.token);
    
    if (rememberMe) {
      localStorage.setItem('savedUsername', username);
      localStorage.setItem('savedPassword', password);
    }
    
    // 跳转到首页
    window.location.href = '/index.html';
  } else {
    alert(result.message);
  }
}

// 登出
async function logout() {
  const token = sessionStorage.getItem('authToken');
  
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // 清除本地存储
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('authToken');
  localStorage.removeItem('savedUsername');
  localStorage.removeItem('savedPassword');
  
  // 跳转到登录页
  window.location.href = '/login.html';
}

// 检查登录状态
async function checkAuth() {
  const token = sessionStorage.getItem('authToken');
  
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    return false;
  }
}

// 带认证的 API 请求
async function authenticatedFetch(url, options = {}) {
  const token = sessionStorage.getItem('authToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.status === 401) {
    // Token 过期，跳转到登录页
    window.location.href = '/login.html';
    return;
  }
  
  return response;
}
```

---

## 安全建议

### 1. 密码安全
- 密码至少 6 个字符
- 建议使用大小写字母 + 数字 + 特殊字符组合
- 定期更换密码

### 2. Token 安全
- Token 仅通过 HTTPS 传输
- 不要将 Token 存储在 URL 或日志中
- 登出时立即清除 Token

### 3. 会话管理
- 30 分钟无操作自动过期
- 敏感操作建议重新验证密码
- 公共电脑使用后务必登出

### 4. 记住我功能
- 仅在私人设备上使用
- 记住我功能有效期 7 天
- 7 天后需要重新登录

---

## 兼容性说明

### 旧版接口
系统保留了旧版 `/api/login` 接口以保持向后兼容，但建议迁移到新的 `/api/auth/login` 接口以获取完整的 Session 管理功能。

### 迁移指南
旧版登录接口不包含 Token 返回，迁移后需要：
1. 更新登录接口路径
2. 在请求头中添加 Authorization
3. 处理 Token 存储和刷新

---

## 测试用例

### 测试 1: 正常登录
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","rememberMe":true}'
```

### 测试 2: 获取用户信息
```bash
curl -X GET http://localhost:8001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 测试 3: 登出
```bash
curl -X POST http://localhost:8001/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 测试 4: 密码错误
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'
# 响应：401 Unauthorized
```

### 测试 5: 未授权访问
```bash
curl -X GET http://localhost:8001/api/auth/me
# 响应：401 Unauthorized
```

---

## 故障排查

### 问题 1: 登录后立即被要求重新登录
**原因**: Token 未正确保存或传输  
**解决**: 检查客户端是否正确存储和发送 Token

### 问题 2: 提示"未授权访问"
**原因**: Token 过期或无效  
**解决**: 重新登录获取新 Token

### 问题 3: 登出后仍可访问 API
**原因**: 客户端缓存未清除  
**解决**: 清除本地存储的 Token 和用户信息

---

*文档结束*
