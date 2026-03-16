# 登录系统快速使用指南

> 版本：v1.0  
> 日期：2026-03-16

---

## 🚀 快速开始

### 1. 访问登录页面

打开浏览器，访问：
```
http://8.215.93.217:8001/login.html
```

### 2. 使用默认账号登录

```
用户名：admin
密码：admin123
```

勾选"记住我"可以 7 天内免登录。

### 3. 登录成功

登录成功后会自动跳转到需求管理页面：
```
http://8.215.93.217:8001/requirements.html
```

---

## 🧪 API 测试

### 测试登录

```bash
curl -X POST http://8.215.93.217:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","rememberMe":true}'
```

**成功响应**:
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
    "token": "b9f6084ee46251ac5c5002e8e65a810a0136a49d1aeec605ad12603a040b2636",
    "expires": 1774274351956
  }
}
```

### 测试获取用户信息

```bash
curl -X GET http://8.215.93.217:8001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 测试登出

```bash
curl -X POST http://8.215.93.217:8001/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📱 前端集成

### 登录示例代码

```javascript
async function login(username, password, rememberMe = false) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe })
  });
  
  const result = await response.json();
  
  if (result.success) {
    sessionStorage.setItem('currentUser', JSON.stringify(result.data));
    sessionStorage.setItem('authToken', result.data.token);
    
    if (rememberMe) {
      localStorage.setItem('savedUsername', username);
      localStorage.setItem('savedPassword', password);
    }
    
    window.location.href = '/requirements.html';
  } else {
    alert(result.message);
  }
}
```

### 登出示例代码

```javascript
async function logout() {
  const token = sessionStorage.getItem('authToken');
  
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
  
  sessionStorage.clear();
  localStorage.removeItem('savedUsername');
  localStorage.removeItem('savedPassword');
  window.location.href = '/login.html';
}
```

### API 请求示例

```javascript
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
    window.location.href = '/login.html';
    return;
  }
  
  return response;
}
```

---

## 🔧 创建新用户

### 方法 1: 通过 API

```bash
curl -X POST http://8.215.93.217:8001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123",
    "role": "user",
    "status": "active"
  }'
```

### 方法 2: 直接修改 users.json

编辑 `/home/admin/.openclaw/workspace/web/users.json`，添加用户：

```json
[
  {
    "id": "1",
    "username": "admin",
    "email": "admin@example.com",
    "password": "hash 值",
    "role": "admin",
    "status": "active",
    "createdAt": "2026-03-15T14:25:12.047Z"
  },
  {
    "id": "2",
    "username": "newuser",
    "email": "new@example.com",
    "password": "密码的 SHA256 哈希",
    "role": "user",
    "status": "active",
    "createdAt": "2026-03-16T00:00:00.000Z"
  }
]
```

**生成密码哈希**:
```bash
echo -n "your_password" | sha256sum
```

---

## 🔍 故障排查

### 问题 1: 登录失败

**症状**: 提示"用户名或密码错误"

**解决**:
1. 确认用户名和密码正确（默认：admin / admin123）
2. 检查服务器是否运行：`ps aux | grep "node api-server"`
3. 查看服务器日志：`tail -f /home/admin/.openclaw/workspace/web/logs/api-server.log`

### 问题 2: Token 无效

**症状**: 访问 API 提示"未授权访问"

**解决**:
1. 重新登录获取新 Token
2. 检查 Token 是否正确添加到请求头
3. 确认 Token 未过期（普通登录 30 分钟，记住我 7 天）

### 问题 3: 页面跳转登录页

**症状**: 访问 requirements.html 自动跳转到 login.html

**解决**:
1. 检查 sessionStorage 中是否有 currentUser 和 authToken
2. 打开浏览器控制台查看是否有认证错误
3. 重新登录

### 问题 4: 服务器无法启动

**症状**: 端口被占用

**解决**:
```bash
# 查找占用端口的进程
lsof -i :8001

# 杀死进程
kill -9 <PID>

# 重启服务器
cd /home/admin/.openclaw/workspace/web
node api-server.js > logs/api-server.log 2>&1 &
```

---

## 📊 监控和维护

### 查看活跃 Sessions

```bash
cat /home/admin/.openclaw/workspace/web/sessions.json
```

### 清理过期 Sessions

系统会自动清理，也可以手动清理：

```bash
echo '{}' > /home/admin/.openclaw/workspace/web/sessions.json
```

### 查看日志

```bash
# 请求日志
tail -f /home/admin/.openclaw/workspace/web/logs/requests.log

# 错误日志
tail -f /home/admin/.openclaw/workspace/web/logs/errors.log

# 服务器日志
tail -f /home/admin/.openclaw/workspace/web/logs/api-server.log
```

---

## 📚 相关文档

- [认证 API 文档](./AUTH-API.md) - 详细的 API 接口文档
- [登录实现报告](./LOGIN-IMPLEMENTATION-REPORT.md) - 开发完成报告
- [登录界面设计](../LOGIN-UI-DESIGN.md) - 界面设计原型

---

## 🆘 获取帮助

如有问题，请查看：
1. 服务器日志
2. 浏览器控制台
3. API 响应内容

---

*快速指南结束*
