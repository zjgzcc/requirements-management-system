# 概要设计文档 (HLD)

> **文档编号**: HLD-2026-001  
> **项目名称**: PDF OCR 智能扫描系统  
> **版本**: v1.0  
> **创建日期**: 2026-03-14  
> **状态**: 待评审

---

## 1. 引言

### 1.1 文档目的

本文档描述 PDF OCR 智能扫描系统的概要设计，包括系统架构、模块划分、接口设计、数据设计等，为详细设计和编码提供指导。

### 1.2 适用范围

本文档适用于：
- 系统架构师：理解系统整体架构
- 开发工程师：指导模块开发
- 测试工程师：编写测试用例
- 项目经理：评估开发工作量

### 1.3 术语定义

| 术语 | 定义 |
|------|------|
| OCR | Optical Character Recognition，光学字符识别 |
| RTM | Requirements Traceability Matrix，需求追踪矩阵 |
| API | Application Programming Interface，应用程序接口 |
| Docker | 容器化部署平台 |
| ETA | Estimated Time of Arrival，预估到达时间 |

---

## 2. 系统概述

### 2.1 系统目标

构建一个安全、高效、易用的 PDF OCR 系统，满足医疗器械等行业对扫描版 PDF 数字化的需求。

**核心目标**:
- 数据安全性：本地部署，数据不上传云端
- 识别准确性：中文识别率>95%
- 处理高效性：10 页 PDF<2 分钟
- 使用便捷性：图形界面，无需培训

### 2.2 系统范围

**包含功能**:
- PDF 文件上传（单文件/批量）
- OCR 识别处理
- 可搜索 PDF 生成
- 任务管理和进度显示
- 文件下载和管理
- 用户认证和权限管理
- 审计日志

**不包含功能**:
- 手写体识别（V2 规划）
- 公式识别（V2 规划）
- 移动端 APP（V2 规划）

### 2.3 用户特点

| 用户类别 | 技术能力 | 使用频率 | 核心需求 |
|----------|----------|----------|----------|
| 医疗器械从业者 | 中等 | 高频 | 数据安全、合规 |
| 企业文档管理员 | 一般 | 高频 | 批量处理、效率 |
| 开发者 | 较强 | 中频 | API、易集成 |
| 学术研究人员 | 中等 | 低频 | 多语言、免费 |

---

## 3. 系统架构

### 3.1 架构设计原则

1. **分层架构**: 表现层、业务层、数据层分离
2. **模块化设计**: 高内聚、低耦合
3. **容器化部署**: Docker 容器，易部署、易迁移
4. **异步处理**: 耗时操作异步执行，不阻塞 UI
5. **安全优先**: 数据加密、权限控制、审计日志

### 3.2 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│                        客户端层                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ Web 浏览器   │  │ 移动浏览器  │  │ API 客户端  │             │
│  │ (Chrome 等) │  │ (Safari 等) │  │ (Postman 等)│             │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘             │
└────────┼───────────────┼───────────────┼─────────────────────┘
         │               │               │
         └───────────────┴───────┬───────┘
                                 │ HTTPS
┌────────────────────────────────▼──────────────────────────────┐
│                        接入层                                  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                      Nginx                               ││
│  │  • 反向代理  • 负载均衡  • SSL 终止  • 静态资源服务       ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                      应用服务层                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  FastAPI 应用服务                         ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ ││
│  │  │上传服务  │  │OCR 服务   │  │任务管理  │  │用户服务  │ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ ││
│  │  │文件服务  │  │日志服务  │  │认证服务  │  │配置服务  │ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ ││
│  └──────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  OCR 处理引擎                             ││
│  │  • OCRmyPDF  • Tesseract  • Ghostscript  • Unpaper       ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                      数据持久层                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   数据库          │  │   文件系统        │                 │
│  │  (SQLite/PG)     │  │  (本地/OSS)       │                 │
│  │  • 用户数据      │  │  • PDF 文件        │                 │
│  │  • 任务元数据    │  │  • 临时文件        │                 │
│  │  • 日志数据      │  │  • 备份文件        │                 │
│  └──────────────────┘  └──────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 技术栈选型

| 层级 | 技术 | 版本 | 选型理由 | 备选方案 |
|------|------|------|----------|----------|
| **前端** | HTML/CSS/JS | ES6+ | 轻量、快速、无依赖 | Vue/React |
| **后端框架** | FastAPI | 0.100+ | 高性能、异步、自动文档 | Django/Flask |
| **OCR 引擎** | OCRmyPDF | 14.0+ | 开源、中文支持好 | Tesseract 直接调用 |
| **OCR 核心** | Tesseract | 5.3+ | 开源、多语言、精度高 | PaddleOCR |
| **数据库** | SQLite | 3.40+ | 轻量、零配置 | PostgreSQL |
| **缓存** | Redis | 7.x | 高性能、支持数据结构 | Memcached |
| **Web 服务器** | Nginx | 1.24+ | 高性能、反向代理 | Apache |
| **容器** | Docker | 24.x | 标准化、易部署 | Podman |
| **云服务** | 阿里云 ECS | - | 国内访问快、合规 | 腾讯云/华为云 |

---

## 4. 模块设计

### 4.1 模块划分

```
PDF OCR 系统
├── 前端模块 (Frontend)
│   ├── 上传组件
│   ├── 进度组件
│   ├── 文件列表组件
│   └── 用户界面组件
│
├── API 网关模块 (API Gateway)
│   ├── 路由管理
│   ├── 请求验证
│   ├── 响应格式化
│   └── 错误处理
│
├── 业务服务模块 (Business Services)
│   ├── 上传服务 (Upload Service)
│   ├── OCR 服务 (OCR Service)
│   ├── 任务管理服务 (Task Management)
│   ├── 文件服务 (File Service)
│   ├── 用户服务 (User Service)
│   └── 日志服务 (Logging Service)
│
├── 数据访问模块 (Data Access)
│   ├── 数据库访问层 (DAL)
│   ├── 文件访问层 (FAL)
│   └── 缓存访问层 (CAL)
│
└── 基础设施模块 (Infrastructure)
    ├── 配置管理
    ├── 日志记录
    ├── 监控告警
    └── 安全认证
```

### 4.2 模块详细说明

#### 模块 1：上传服务

**职责**: 处理文件上传请求

**接口**:
```python
class UploadService:
    async def upload_single(file: UploadFile) -> TaskInfo
    async def upload_batch(files: List[UploadFile]) -> List[TaskInfo]
    async def validate_file(file: UploadFile) -> bool
```

**流程**:
```
接收文件 → 验证格式 → 检查大小 → 保存临时目录 → 生成 task_id → 返回结果
```

**依赖**:
- 文件系统
- 任务管理服务

---

#### 模块 2:OCR 服务

**职责**: 执行 OCR 识别

**接口**:
```python
class OCRService:
    async def process(task_id: str) -> ProcessResult
    async def cancel(task_id: str) -> bool
    async def get_progress(task_id: str) -> ProgressInfo
```

**流程**:
```
读取 PDF → 分析页数 → 图像预处理 → OCR 识别 → 生成文本层 → 
合成 PDF → 优化压缩 → 保存输出
```

**依赖**:
- OCRmyPDF
- Tesseract
- 任务管理服务

---

#### 模块 3：任务管理服务

**职责**: 管理任务队列和状态

**接口**:
```python
class TaskService:
    def create_task(user_id: str, input_file: str) -> TaskInfo
    def update_task(task_id: str, status: str, **kwargs) -> bool
    def get_task(task_id: str) -> TaskInfo
    def list_tasks(user_id: str, status: str = None) -> List[TaskInfo]
    def cancel_task(task_id: str) -> bool
    def delete_task(task_id: str) -> bool
```

**依赖**:
- 数据库
- OCR 服务

---

#### 模块 4：用户服务

**职责**: 用户认证和权限管理

**接口**:
```python
class UserService:
    async def register(username: str, password: str) -> UserInfo
    async def login(username: str, password: str) -> TokenInfo
    async def logout(token: str) -> bool
    async def get_profile(user_id: str) -> UserInfo
    async def update_profile(user_id: str, **kwargs) -> bool
```

**依赖**:
- 数据库
- JWT 库

---

#### 模块 5：日志服务

**职责**: 记录审计日志

**接口**:
```python
class LoggingService:
    def log_action(user_id: str, action: str, resource: str, **kwargs)
    def query_logs(user_id: str, start_time: datetime, end_time: datetime) -> List[LogEntry]
    def export_logs(user_id: str, format: str = "csv") -> bytes
```

**依赖**:
- 数据库
- 文件系统

---

### 4.3 模块依赖关系

```
┌────────────────────────────────────────────────────────┐
│                    Frontend                             │
└───────────────────┬────────────────────────────────────┘
                    │ HTTP/HTTPS
┌───────────────────▼────────────────────────────────────┐
│                   API Gateway                           │
└────┬────────────┬────────────┬────────────┬────────────┘
     │            │            │            │
┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
│上传服务  │  │OCR 服务   │  │任务管理  │  │用户服务  │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     │            │            │            │
     └────────────┴─────┬──────┴────────────┘
                        │
               ┌────────▼────────┐
               │   数据访问层     │
               └────────┬────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │ 数据库   │   │ 文件系统 │   │  缓存   │
    └─────────┘   └─────────┘   └─────────┘
```

---

## 5. 接口设计

### 5.1 API 接口规范

**RESTful 风格**:
- GET: 查询
- POST: 创建
- PUT: 更新
- DELETE: 删除

**响应格式**:
```json
{
    "code": 200,
    "message": "success",
    "data": {},
    "timestamp": "2026-03-14T19:00:00Z"
}
```

**错误格式**:
```json
{
    "code": 400,
    "message": "Invalid file format",
    "details": "Only PDF files are supported"
}
```

### 5.2 核心 API 接口

#### 文件上传
```http
POST /api/v1/upload
Content-Type: multipart/form-data

Request:
  file: <PDF file>

Response:
{
    "code": 200,
    "data": {
        "task_id": "abc12345",
        "filename": "test.pdf",
        "size": 123456,
        "status": "uploaded"
    }
}
```

#### 开始处理
```http
POST /api/v1/process/{task_id}

Response:
{
    "code": 200,
    "data": {
        "task_id": "abc12345",
        "status": "processing",
        "eta_seconds": 120
    }
}
```

#### 查询进度
```http
GET /api/v1/progress/{task_id}

Response:
{
    "code": 200,
    "data": {
        "task_id": "abc12345",
        "progress": 45.5,
        "stage": "ocr",
        "processed_pages": 5,
        "total_pages": 11,
        "eta_seconds": 65
    }
}
```

#### 取消任务
```http
POST /api/v1/cancel/{task_id}

Response:
{
    "code": 200,
    "data": {
        "task_id": "abc12345",
        "status": "cancelled"
    }
}
```

#### 下载文件
```http
GET /api/v1/download/{task_id}

Response:
  <PDF file binary>
```

---

## 6. 数据设计

### 6.1 数据库表结构

#### 用户表 (users)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 任务表 (tasks)
```sql
CREATE TABLE tasks (
    id VARCHAR(20) PRIMARY KEY,
    user_id INTEGER,
    status VARCHAR(20) NOT NULL,
    stage VARCHAR(20),
    input_file VARCHAR(500),
    output_file VARCHAR(500),
    total_pages INTEGER,
    processed_pages INTEGER DEFAULT 0,
    progress FLOAT DEFAULT 0,
    eta_seconds FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 日志表 (audit_logs)
```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    result VARCHAR(20),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 6.2 文件存储结构

```
/data/
├── input/              # 输入文件
│   └── {date}/
│       └── {task_id}_{filename}.pdf
│
├── output/             # 输出文件
│   └── {date}/
│       └── {task_id}_{filename}_searchable.pdf
│
├── temp/               # 临时文件
│   └── {task_id}/
│
└── backup/             # 备份文件
    └── {date}/
```

---

## 7. 安全设计

### 7.1 认证机制

- **JWT Token**: 用户登录后颁发
- **Token 有效期**: 2 小时
- **刷新机制**: Refresh Token，有效期 7 天
- **存储方式**: 客户端 LocalStorage

### 7.2 权限控制

| 角色 | 权限 |
|------|------|
| 匿名用户 | 上传、处理、下载（限次） |
| 注册用户 | 无限制上传、批量处理、历史记录 |
| 管理员 | 用户管理、系统配置、日志查询 |

### 7.3 数据安全

- **传输加密**: HTTPS (TLS 1.3)
- **存储加密**: AES-256（敏感数据）
- **密码加密**: bcrypt
- **文件隔离**: 按用户 ID 隔离存储

### 7.4 审计日志

**记录内容**:
- 用户操作（上传、处理、下载、删除）
- 系统事件（登录、登出、权限变更）
- 异常事件（失败、超时、错误）

**日志保留**: 180 天

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| API 响应时间 | < 100ms | P95 |
| OCR 处理时间 | < 2 分钟/10 页 | 平均 |
| 并发处理能力 | 5 个任务 | 同时 |
| 系统可用性 | > 99% | 月度 |

### 8.2 优化策略

1. **异步处理**: OCR 任务异步执行，不阻塞 API
2. **缓存策略**: 常用数据缓存到 Redis
3. **连接池**: 数据库连接池，减少连接开销
4. **文件流式处理**: 大文件分块处理，减少内存占用
5. **并发控制**: 限制最大并发任务数，防止过载

---

## 9. 部署设计

### 9.1 部署架构

```
┌──────────────────────────────────────────────────────┐
│                   阿里云 ECS                          │
│  ┌────────────────────────────────────────────────┐ │
│  │              Docker Container                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │  Nginx   │  │FastAPI   │  │ OCR 引擎  │     │ │
│  │  │  :80     │  │  :8000   │  │          │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘     │ │
│  │  ┌──────────┐  ┌──────────┐                    │ │
│  │  │  SQLite  │  │  Redis   │                    │ │
│  │  └──────────┘  └──────────┘                    │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 9.2 Docker Compose 配置

```yaml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
  
  api:
    image: python:3.11-slim
    command: uvicorn main:app --host 0.0.0.0 --port 8000
    volumes:
      - ./api:/app
      - ./data:/data
    environment:
      - DATABASE_URL=sqlite:///data/db.sqlite3
      - REDIS_URL=redis://redis:6379
  
  ocr:
    image: jbarlow83/ocrmypdf:latest
    volumes:
      - ./data:/data
  
  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
  
volumes:
  redis-data:
```

---

## 10. 监控和告警

### 10.1 监控指标

- **系统指标**: CPU、内存、磁盘、网络
- **应用指标**: QPS、响应时间、错误率
- **业务指标**: 任务数、处理时长、成功率

### 10.2 告警规则

| 指标 | 阈值 | 告警级别 | 通知方式 |
|------|------|----------|----------|
| CPU 使用率 | > 80% | Warning | 邮件 |
| 内存使用率 | > 90% | Critical | 邮件 + 短信 |
| 错误率 | > 5% | Warning | 邮件 |
| 任务失败率 | > 10% | Critical | 邮件 + 短信 |

---

## 11. 附录

### 11.1 参考文档

- [产品需求文档](./prd-requirements-traceability-matrix.md)
- [用户需求规格说明书](./user-requirements-specification.md)
- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [OCRmyPDF 文档](https://ocrmypdf.readthedocs.io/)

### 11.2 评审记录

| 角色 | 姓名 | 日期 | 意见 |
|------|------|------|------|
| 产品负责人 | 陈先生 | - | 待评审 |
| 架构师 | - | - | 待评审 |
| 开发负责人 | - | - | 待评审 |

---

*本文档待评审通过后生效*  
*创建日期：2026-03-14*
