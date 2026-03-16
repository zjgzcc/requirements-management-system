# 需求管理系统 - API 接口文档

## 基础信息

- **基础 URL**: `http://8.215.93.217:8002`
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 认证接口

### 1. 用户登录

**接口**: `POST /api/login`

**请求参数**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应示例** - 成功:
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
    "createdAt": "2026-03-15T14:20:00.000Z"
  }
}
```

**响应示例** - 失败:
```json
{
  "success": false,
  "message": "用户名或密码错误"
}
```

**错误码**:
- `400` - 参数错误
- `401` - 用户名或密码错误
- `403` - 账户已被禁用

---

## 用户管理接口

### 2. 获取用户列表

**接口**: `GET /api/users`

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "status": "active",
      "createdAt": "2026-03-15T14:20:00.000Z"
    },
    {
      "id": "m8x9y2z3",
      "username": "zhangsan",
      "email": "zhangsan@example.com",
      "role": "user",
      "status": "active",
      "createdAt": "2026-03-15T15:30:00.000Z"
    }
  ]
}
```

---

### 3. 创建用户

**接口**: `POST /api/users`

**请求参数**:
```json
{
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "password": "zhang123",
  "role": "user",
  "status": "active"
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名，3-20 字符，字母开头，可含字母数字下划线 |
| email | string | ❌ | 邮箱地址 |
| password | string | ✅ | 密码，至少 6 个字符 |
| role | string | ❌ | 角色：`admin` 或 `user`，默认 `user` |
| status | string | ❌ | 状态：`active` 或 `inactive`，默认 `active` |

**响应示例** - 成功:
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": "m8x9y2z3",
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "role": "user",
    "status": "active",
    "createdAt": "2026-03-15T15:30:00.000Z"
  }
}
```

**响应示例** - 失败:
```json
{
  "success": false,
  "message": "用户名已存在"
}
```

**错误码**:
- `400` - 参数错误（用户名格式不对、密码太短、用户名已存在等）
- `500` - 服务器错误

---

### 4. 更新用户

**接口**: `PUT /api/users/:id`

**URL 示例**: `PUT /api/users/m8x9y2z3`

**请求参数** (所有字段可选):
```json
{
  "username": "lisi",
  "email": "lisi@example.com",
  "password": "newpass123",
  "role": "admin",
  "status": "inactive"
}
```

**响应示例** - 成功:
```json
{
  "success": true,
  "message": "用户更新成功",
  "data": {
    "id": "m8x9y2z3",
    "username": "lisi",
    "email": "lisi@example.com",
    "role": "admin",
    "status": "inactive",
    "createdAt": "2026-03-15T15:30:00.000Z"
  }
}
```

**错误码**:
- `400` - 参数错误
- `404` - 用户不存在
- `500` - 服务器错误

---

### 5. 删除用户

**接口**: `DELETE /api/users/:id`

**URL 示例**: `DELETE /api/users/m8x9y2z3`

**响应示例** - 成功:
```json
{
  "success": true,
  "message": "用户已删除"
}
```

**响应示例** - 失败:
```json
{
  "success": false,
  "message": "不能删除默认管理员账户"
}
```

**错误码**:
- `400` - 不能删除默认管理员
- `404` - 用户不存在
- `500` - 服务器错误

---

## 前端页面

| 页面 | URL | 说明 |
|------|-----|------|
| 登录页 | `http://8.215.93.217:8002/` 或 `/login.html` | 用户登录界面 |
| 用户管理 | `http://8.215.93.217:8002/dashboard.html` | 管理员用户管理界面 |

---

## 默认账户

**管理员账户**:
- 用户名：`admin`
- 密码：`admin123`

⚠️ **首次登录后建议修改密码**

---

## 前端集成示例

### JavaScript Fetch 示例

```javascript
// 登录
async function login(username, password) {
  const response = await fetch('http://8.215.93.217:8002/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // 保存用户信息到 sessionStorage
    sessionStorage.setItem('currentUser', JSON.stringify(data.data));
    // 跳转到仪表盘
    window.location.href = '/dashboard.html';
  } else {
    alert(data.message);
  }
}

// 获取用户列表
async function loadUsers() {
  const response = await fetch('http://8.215.93.217:8002/api/users');
  const data = await response.json();
  
  if (data.success) {
    console.log('用户列表:', data.data);
    return data.data;
  }
}

// 创建用户
async function createUser(userData) {
  const response = await fetch('http://8.215.93.217:8002/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  
  const data = await response.json();
  
  if (data.success) {
    alert('用户创建成功');
    return data.data;
  } else {
    alert(data.message);
    throw new Error(data.message);
  }
}

// 删除用户
async function deleteUser(userId) {
  const response = await fetch(`http://8.215.93.217:8002/api/users/${userId}`, {
    method: 'DELETE'
  });
  
  const data = await response.json();
  
  if (data.success) {
    alert('用户已删除');
  } else {
    alert(data.message);
  }
}
```

---

## 数据文件

用户数据存储在服务器本地的 `users.json` 文件中，格式如下：

```json
[
  {
    "id": "1",
    "username": "admin",
    "email": "admin@example.com",
    "password": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    "role": "admin",
    "status": "active",
    "createdAt": "2026-03-15T14:20:00.000Z"
  }
]
```

⚠️ **注意**: 密码使用 SHA-256 加密存储

---

## 开发团队任务分配

### 前端开发
- [x] 登录界面 (`login.html`)
- [x] 用户管理界面 (`dashboard.html`)
- [ ] 需求管理主界面
- [ ] 需求详情页面
- [ ] 需求创建/编辑表单

### 后端开发
- [x] 用户认证 API
- [x] 用户管理 API
- [ ] 需求管理 API
- [ ] 数据库集成（可选）

### 测试
- [ ] 登录功能测试
- [ ] 用户管理功能测试
- [ ] API 接口测试

---

**文档版本**: v1.0  
**更新时间**: 2026-03-15  
**联系人**: 云龙虾 1 号 🦞
