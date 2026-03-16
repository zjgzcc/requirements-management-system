# 需求管理系统 - 开发说明

## 📋 项目概述

这是一个基于 Web 的需求管理追踪系统，支持用户登录、用户管理、需求创建和追踪等功能。

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     浏览器                              │
│  (login.html / dashboard.html / ...)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/JSON
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Node.js 服务器                          │
│  (api-server.js - 端口 8002)                            │
│  - 静态文件服务                                          │
│  - RESTful API                                          │
│  - 用户认证                                              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ 文件系统
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  本地 JSON 数据库                        │
│  (users.json)                                           │
└─────────────────────────────────────────────────────────┘
```

## 📁 项目结构

```
web/
├── api-server.js          # 后端 API 服务器（主服务器）
├── server.js              # 简单静态服务器（备用）
├── login.html             # 登录页面
├── dashboard.html         # 用户管理仪表盘
├── API-DOCUMENTATION.md   # API 接口文档
├── README-DEV.md          # 本文件
└── users.json             # 用户数据文件（运行时生成）
```

## 🚀 快速启动

### 启动服务器

```bash
cd /home/admin/.openclaw/workspace/web
node api-server.js
```

### 访问地址

- **本地**: http://localhost:8002
- **远程**: http://8.215.93.217:8002

### 默认管理员账户

- **用户名**: `admin`
- **密码**: `admin123`

## 🔌 API 接口

### 认证接口
- `POST /api/login` - 用户登录

### 用户管理接口
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

详细文档见：[API-DOCUMENTATION.md](./API-DOCUMENTATION.md)

## 🎨 前端页面

### 登录页面 (`login.html`)

**功能**:
- ✅ 用户名/密码输入
- ✅ 实时格式验证
- ✅ 记住密码功能
- ✅ 忘记密码入口
- ✅ 错误提示动画

**验证规则**:
- 用户名：3-20 字符，字母开头，可含字母数字下划线
- 密码：至少 8 位，包含大小写字母和数字或特殊字符

### 用户管理页面 (`dashboard.html`)

**功能**:
- ✅ 用户列表展示
- ✅ 用户统计卡片
- ✅ 搜索过滤
- ✅ 添加用户
- ✅ 编辑用户
- ✅ 删除用户
- ✅ 角色管理（管理员/普通用户）
- ✅ 状态管理（活跃/禁用）

## 📝 开发计划

### 第一阶段 - 用户系统 ✅
- [x] 登录界面
- [x] 用户管理界面
- [x] 用户认证 API
- [x] 用户管理 API

### 第二阶段 - 需求管理 🔄
- [ ] 需求列表页面
- [ ] 需求详情页面
- [ ] 创建/编辑需求表单
- [ ] 需求状态管理
- [ ] 需求 API 接口

### 第三阶段 - 高级功能
- [ ] 需求评论系统
- [ ] 文件附件上传
- [ ] 需求分配和协作
- [ ] 数据统计和报表
- [ ] 通知系统

### 第四阶段 - 优化和部署
- [ ] 数据库集成（MySQL/MongoDB）
- [ ] HTTPS 配置
- [ ] 性能优化
- [ ] 日志系统
- [ ] 备份机制

## 🛠️ 开发指南

### 添加新页面

1. 在 `web/` 目录下创建新的 HTML 文件
2. 参考现有页面的样式和结构
3. 在 `api-server.js` 中确保静态文件服务正常

### 添加新 API

1. 在 `api-server.js` 的 `handleApiRequest` 函数中添加路由
2. 遵循 RESTful 风格
3. 统一返回格式：`{ success: boolean, message?: string, data?: any }`
4. 更新 API 文档

### 数据库扩展

当前使用 JSON 文件存储数据，适合小规模使用。如需扩展：

```javascript
// 示例：切换到 MongoDB
const { MongoClient } = require('mongodb');

async function initDatabase() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  return client.db('requirements').collection('users');
}
```

## 🧪 测试

### 手动测试清单

- [ ] 使用 admin/admin123 登录
- [ ] 创建新用户
- [ ] 编辑用户信息
- [ ] 修改用户密码
- [ ] 禁用/启用用户
- [ ] 删除用户
- [ ] 搜索用户
- [ ] 退出登录

### API 测试示例

```bash
# 测试登录
curl -X POST http://8.215.93.217:8002/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 获取用户列表
curl http://8.215.93.217:8002/api/users

# 创建用户
curl -X POST http://8.215.93.217:8002/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123","role":"user"}'
```

## 📊 数据统计

系统内置统计功能：
- 总用户数
- 管理员数量
- 活跃用户数
- 禁用用户数

## 🔒 安全注意事项

1. **密码加密**: 使用 SHA-256 加密存储
2. **输入验证**: 前后端双重验证
3. **CORS**: 已配置跨域访问
4. **默认账户**: 首次登录后应修改密码
5. **数据备份**: 定期备份 `users.json`

## 📞 联系支持

- **项目负责人**: 陈先生
- **开发团队**: 云龙虾 1 号 🦞
- **文档版本**: v1.0
- **更新日期**: 2026-03-15

---

**祝开发顺利！** 🚀
