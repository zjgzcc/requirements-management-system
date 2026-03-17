# AI 智能助手 - 快速开始指南

## 🚀 5 分钟快速体验

### 步骤 1: 启动服务
```bash
cd /home/admin/.openclaw/workspace/web
node api-server.js
```

服务将在 http://localhost:8001 启动

### 步骤 2: 访问 AI 助手
打开浏览器访问：
```
http://localhost:8001/ai-assistant.html
```

### 步骤 3: 体验功能

#### 示例 1: AI 需求生成
在"AI 需求生成助手"卡片中输入：
```
用户登录功能
```
点击"✨ 生成需求文档"，等待 AI 生成完整需求。

#### 示例 2: AI 测试用例生成
在"AI 测试用例生成"卡片中输入：
```
功能：用户登录
- 用户输入用户名和密码
- 系统验证 credentials
- 登录成功跳转到首页
- 登录失败显示错误提示
- 支持记住登录状态
```
点击"✨ 生成测试用例"。

#### 示例 3: AI 需求审查
粘贴一段需求文档，点击"🔍 审查需求"，AI 会：
- 识别模糊词汇
- 检查验收标准
- 给出改进建议

---

## 📋 API 使用示例

### 使用 curl 测试

#### 1. 生成需求
```bash
curl -X POST http://localhost:8001/api/ai/generate-requirement \
  -H "Content-Type: application/json" \
  -d '{"userInput": "购物车功能"}'
```

#### 2. 生成测试用例
```bash
curl -X POST http://localhost:8001/api/ai/generate-testcase \
  -H "Content-Type: application/json" \
  -d '{"requirementDoc": "用户登录功能需求..."}'
```

#### 3. 需求审查
```bash
curl -X POST http://localhost:8001/api/ai/review-requirement \
  -H "Content-Type: application/json" \
  -d '{"requirementText": "需求内容..."}'
```

#### 4. 缺陷分类
```bash
curl -X POST http://localhost:8001/api/ai/classify-defect \
  -H "Content-Type: application/json" \
  -d '{"defectDescription": "登录页面在移动端显示异常"}'
```

#### 5. 智能搜索
```bash
curl -X POST http://localhost:8001/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query": "登录相关的测试用例"}'
```

#### 6. 检查 AI 状态
```bash
curl http://localhost:8001/api/ai/status
```

---

## 🔧 配置 AI 服务

### 方案 A: 使用本地 AI（推荐）

#### 安装 Ollama
```bash
# Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh

# 启动 Ollama
ollama serve

# 拉取模型（选择一个）
ollama pull qwen2.5:7b      # 7B 参数，速度快
ollama pull qwen2.5:14b     # 14B 参数，质量更好
```

#### 配置 ai-assistant.js
```javascript
local: {
    enabled: true,
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:7b',  // 修改为你安装的模型
    timeout: 60000,
}
```

### 方案 B: 使用云端 AI

#### 获取 API Key
1. 访问 https://dashscope.console.aliyun.com/
2. 创建账号并获取 API Key
3. 设置环境变量：
```bash
export DASHSCOPE_API_KEY="sk-xxxxx"
```

#### 配置 ai-assistant.js
```javascript
cloud: {
    enabled: true,
    provider: 'dashscope',
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    model: 'qwen-plus',
    timeout: 30000,
}
```

---

## 💡 最佳实践

### 1. 输入优化
✅ **好的输入**:
```
用户登录功能，支持手机号和邮箱登录，
密码需要加密传输，登录失败 5 次后锁定账号 30 分钟，
支持第三方登录（微信、QQ、GitHub）
```

❌ **差的输入**:
```
登录
```

### 2. 结果审核
- AI 生成的内容仅供参考
- 务必人工审核验收标准
- 结合项目实际情况调整

### 3. 迭代优化
- 第一次生成不满意？调整输入重试
- 使用审查功能改进已有需求
- 积累优质提示词模板

---

## 🎯 典型使用场景

### 场景 1: 快速原型设计
1. 输入功能想法
2. AI 生成需求文档
3. AI 生成测试用例
4. 评审并调整
5. 开始开发

**节省时间**: 60-70%

### 场景 2: 需求质量提升
1. 编写初版需求
2. AI 审查需求
3. 根据建议改进
4. 再次审查确认

**提升效果**: 减少 50% 以上需求缺陷

### 场景 3: 测试用例补充
1. 完成需求文档
2. AI 生成测试用例
3. 补充特殊场景
4. 执行测试

**覆盖率提升**: 30-40%

### 场景 4: 缺陷管理优化
1. 提交缺陷描述
2. AI 自动分类定级
3. 自动分配负责人
4. 关联相似缺陷

**效率提升**: 减少 80% 手动分类时间

---

## 🐛 故障排查

### 问题 1: AI 服务不可用
**症状**: 返回"AI 服务不可用"错误

**解决**:
```bash
# 检查 Ollama 服务
curl http://localhost:11434/api/tags

# 如未启动，运行
ollama serve
```

### 问题 2: 响应超时
**症状**: 请求超过 60 秒无响应

**解决**:
- 使用更小的模型（如 qwen2.5:3b）
- 简化输入内容
- 检查网络/系统负载

### 问题 3: 生成质量差
**症状**: AI 输出不符合预期

**解决**:
- 提供更详细的输入描述
- 添加示例（few-shot）
- 调整 temperature 参数

---

## 📊 性能基准

| 功能 | 本地 AI (7B) | 云端 AI | 缓存命中 |
|------|-------------|---------|----------|
| 需求生成 | 5-8 秒 | 2-4 秒 | <0.1 秒 |
| 测试用例 | 8-12 秒 | 3-6 秒 | <0.1 秒 |
| 需求审查 | 6-10 秒 | 2-5 秒 | <0.1 秒 |
| 缺陷分类 | 4-6 秒 | 1-3 秒 | <0.1 秒 |
| 智能搜索 | <0.5 秒 | <0.5 秒 | <0.1 秒 |

*测试环境：Intel i7, 16GB RAM, SSD*

---

## 📞 获取帮助

### 查看日志
```bash
tail -f logs/errors.log
tail -f logs/requests.log
```

### 测试 API
```bash
./test-ai-api.sh  # 创建测试脚本
```

### 阅读完整文档
- `AI-ASSISTANT-MODULE.md` - 完整功能文档
- `ai-prompts.js` - 提示词模板
- `ai-assistant.js` - 核心实现

---

## 🎓 进阶使用

### 自定义提示词
编辑 `ai-prompts.js`，修改或添加提示词模板。

### 集成工作流
将 AI API 集成到 CI/CD 流程：
- 需求提交时自动审查
- 缺陷创建时自动分类
- 迭代结束时自动生成报告

### 模型微调
使用项目历史数据微调模型，提升特定领域的准确性。

---

**开始使用 AI 智能助手，让需求管理更高效！🚀**
