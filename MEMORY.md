# MEMORY.md - Long-Term Memory

## Preferences

- **联网搜索优先使用 searxng skill** —— 只要涉及联网搜索任务，优先调用 searxng 技能而非直接使用 web_search 工具。

## 重大成就 - 2026-03-16

### 🎉 需求管理系统 v1.0 完成

**项目状态**: 生产环境运行中 (http://8.215.93.217:8001)

**核心功能**:
- 用户认证与管理
- 项目管理 (支持 4 级标题层级)
- 需求管理 (富文本编辑器/附件上传/前缀管理)
- 用例管理 (富文本编辑器/模板功能)
- 追踪矩阵 (需求 - 用例关联/覆盖率统计/导出)
- 基线版本 (版本创建/对比/恢复)
- 文件上传 (图片/视频/文档，最大 50MB)

**技术栈**:
- 后端：Node.js + formidable
- 前端：原生 JS + Quill.js
- 数据：JSON 文件存储

**代码规模**:
- 166,430+ 行代码
- 687 个文件
- 30+ API 接口

### 👥 AI Agent 团队建立

**创新点**: 首次实现多 Agent 协作开发模式

**团队架构**:
```
首席架构师 (云龙虾 1 号 🦞)
├── Agent-Requirement (需求管理)
├── Agent-Testcase (用例管理)
├── Agent-Trace (追踪矩阵)
├── Agent-Baseline (基线版本)
└── Agent-Infra (基础设施)
```

**规范文档**:
- DEVELOPMENT-STANDARDS.md - 开发规范
- API-CONTRACT.md - API 接口契约
- MODULE-INTERFACES.md - 模块接口规范
- TEAM.md - 团队协作文档

### 📦 版本管理

- Git 仓库已初始化
- 首次提交：2026-03-16
- 待推送到 GitHub (仓库名：requirements-management-system)

## Notes

- Created: 2026-03-05
- Major milestone: 2026-03-16 (需求管理系统上线)
