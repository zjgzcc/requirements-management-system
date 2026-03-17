# 回收站功能设计方案

## 企业级 SaaS 系统回收站最佳实践调研

**调研日期**: 2026-03-16  
**调研对象**: Google Drive, Dropbox, Jira, Notion, Confluence, GitHub, 印象笔记/有道云笔记

---

## 一、各平台回收站功能调研总结

### 1.1 Google Drive - 文件回收站

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除，数据库标记 `trashed=true`，文件实际存储不变 |
| **保留期限** | 固定 30 天自动永久删除，支持手动提前清空 |
| **存储优化** | 回收站文件仍计入存储配额，支持批量永久删除释放空间 |
| **恢复操作** | 单条恢复、批量恢复，恢复到原位置 |
| **权限控制** | 仅文件所有者可删除，共享文件移除不删除原文件，支持审计日志 |
| **冲突处理** | 恢复时若原位置被占用，自动重命名或提示用户选择 |

**关键特性**:
- 删除后进入回收站，30 天后自动永久删除
- 回收站文件仍占用存储空间
- 共享文件只能"移除"不能"删除"（非所有者）
- 支持 Empty Trash 批量永久删除

---

### 1.2 Dropbox - 文件版本与恢复

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除 + 版本历史，独立存储删除元数据 |
| **保留期限** | Basic: 30 天；Plus/Professional: 180 天；Business: 1 年+ |
| **存储优化** | 增量同步，回收站不计入主配额但受总配额限制 |
| **恢复操作** | 单文件恢复、批量恢复、整文件夹恢复、版本回滚 |
| **权限控制** | 文件所有者/团队管理员可恢复，支持删除审计 |
| **冲突处理** | 恢复时冲突自动添加副本标记 |

**关键特性**:
- 按用户等级区分保留期限（差异化服务）
- 支持文件版本历史恢复（不仅仅是删除恢复）
- 团队版支持管理员恢复成员删除的文件

---

### 1.3 Jira - 问题删除与恢复

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除，标记 `deleted=true` + 删除时间戳 |
| **保留期限** | Cloud: 60 天；Server/Data Center: 可配置（默认 60 天） |
| **存储优化** | 删除问题仍计入许可计数，定期清理作业 |
| **恢复操作** | 单条恢复，恢复到原项目/原位置 |
| **权限控制** | Delete Issues 权限控制删除，Browse 权限查看回收站 |
| **审计日志** | 完整的删除/恢复审计日志，支持合规审计 |

**关键特性**:
- 需要特定权限才能删除问题
- 回收站按项目隔离
- 支持审计日志追踪谁在何时删除了什么

---

### 1.4 Notion - 页面删除与恢复

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除，页面树标记删除状态 |
| **保留期限** | 固定 30 天自动永久删除 |
| **存储优化** | 删除页面仍计入块限额，Team 版支持管理员恢复 |
| **恢复操作** | 单页面恢复、批量恢复、整工作区恢复 |
| **权限控制** | 页面编辑者可删除，工作区管理员可恢复所有 |
| **冲突处理** | 恢复时若父页面不存在，恢复到工作区根目录 |

**关键特性**:
- 页面树结构，删除父页面会级联删除子页面
- 支持按时间线查看删除历史
- Team 空间管理员有额外恢复权限

---

### 1.5 Confluence - 内容删除与恢复

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除，内容标记 + 独立回收站表 |
| **保留期限** | Cloud: 30 天；Server: 可配置 |
| **存储优化** | 附件单独处理，支持批量清理作业 |
| **恢复操作** | 单条恢复、批量恢复、恢复位置选择 |
| **权限控制** | Delete 权限控制，Space Admin 可恢复所有 |
| **审计日志** | 完整的 Content Audit Log |

**关键特性**:
- 页面和博客文章分别管理
- 附件删除独立于页面删除
- Space 管理员有特殊恢复权限

---

### 1.6 GitHub - 仓库删除与恢复

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除，仓库标记 + 独立元数据存储 |
| **保留期限** | 个人仓库：90 天；组织仓库：90 天（组织管理员可恢复） |
| **存储优化** | 删除仓库释放存储，LFS 文件单独处理 |
| **恢复操作** | 仅管理员可恢复，恢复到原组织/用户名下 |
| **权限控制** | 仓库所有者/组织管理员可删除，仅管理员可恢复 |
| **审计日志** | Organization Audit Log 记录所有删除操作 |

**关键特性**:
- 删除后有较长时间窗口（90 天）
- 组织仓库删除需要更高权限
- 支持审计日志追踪

---

### 1.7 印象笔记/有道云笔记 - 笔记删除与恢复

| 维度 | 实现方式 |
|------|----------|
| **数据保存方式** | 软删除，笔记标记删除状态 |
| **保留期限** | 印象笔记：60 天；有道云笔记：30 天 |
| **存储优化** | 删除笔记仍计入配额，VIP 用户更长保留期 |
| **恢复操作** | 单条恢复、批量恢复、恢复到原笔记本 |
| **权限控制** | 笔记所有者可删除/恢复 |
| **冲突处理** | 原笔记本不存在时恢复到默认笔记本 |

**关键特性**:
- 按用户等级区分保留期限（VIP 更长）
- 笔记本结构保持
- 支持批量操作

---

## 二、回收站功能设计方案

### 2.1 数据结构设计

#### 核心表结构

```sql
-- 主业务表（示例：文档表）
CREATE TABLE documents (
    id BIGINT PRIMARY KEY,
    title VARCHAR(500),
    content TEXT,
    owner_id BIGINT,
    parent_id BIGINT,          -- 父级 ID（支持树形结构）
    workspace_id BIGINT,       -- 工作区/项目 ID
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,      -- 删除时间（NULL 表示未删除）
    deleted_by BIGINT,         -- 删除人 ID
    delete_reason VARCHAR(500), -- 删除原因
    original_path JSON,        -- 原始路径快照
    version INT DEFAULT 1      -- 版本号
);

-- 回收站元数据表（可选，用于复杂查询优化）
CREATE TABLE recycle_bin (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(50),   -- 实体类型：document/folder/note等
    entity_id BIGINT,          -- 实体 ID
    owner_id BIGINT,           -- 所有者 ID
    deleted_by BIGINT,         -- 删除人 ID
    deleted_at TIMESTAMP,      -- 删除时间
    expire_at TIMESTAMP,       -- 过期时间（自动计算）
    original_parent_id BIGINT, -- 原父级 ID
    original_path JSON,        -- 原路径快照
    size_bytes BIGINT,         -- 占用空间
    can_restore BOOLEAN DEFAULT TRUE, -- 是否可恢复
    restored_at TIMESTAMP,     -- 恢复时间
    restored_by BIGINT,        -- 恢复人 ID
    INDEX idx_owner_deleted (owner_id, deleted_at),
    INDEX idx_expire (expire_at)
);

-- 审计日志表
CREATE TABLE audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    action VARCHAR(50),        -- DELETE/RESTORE/PERMANENT_DELETE
    actor_id BIGINT,           -- 操作人 ID
    actor_name VARCHAR(100),
    timestamp TIMESTAMP,
    details JSON,              -- 操作详情
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_actor (actor_id, timestamp),
    INDEX idx_timestamp (timestamp)
);

-- 回收站配置表（支持多租户/多项目配置）
CREATE TABLE recycle_bin_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    workspace_id BIGINT,       -- 工作区 ID（NULL 表示全局配置）
    entity_type VARCHAR(50),   -- 实体类型
    retention_days INT,        -- 保留天数
    auto_cleanup_enabled BOOLEAN DEFAULT TRUE,
    cleanup_cron VARCHAR(50),  -- 清理定时表达式
    max_items_per_user INT,    -- 每用户最大回收站条目数
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE KEY uniq_workspace_entity (workspace_id, entity_type)
);
```

#### 实体类设计（伪代码）

```typescript
// 回收站条目
interface RecycleBinItem {
  id: string;
  entityType: EntityType;      // 'document' | 'folder' | 'note' | etc.
  entityId: string;
  title: string;
  owner: User;
  deletedBy: User;
  deletedAt: Date;
  expireAt: Date;              // 自动删除时间
  originalPath: PathSnapshot;  // 原始路径信息
  sizeBytes: number;
  canRestore: boolean;
  restoredAt?: Date;
  restoredBy?: User;
}

// 路径快照（用于恢复时定位）
interface PathSnapshot {
  parentId: string | null;
  parentTitle: string;
  fullPath: string[];          // 完整路径数组
  workspaceId: string;
}

// 回收站配置
interface RecycleBinConfig {
  workspaceId?: string;
  entityType: EntityType;
  retentionDays: number;       // 默认 30
  autoCleanupEnabled: boolean;
  maxItemsPerUser?: number;
}
```

---

### 2.2 数据保存策略建议

#### 推荐方案：**软删除 + 独立元数据**

```
┌─────────────────────────────────────────────────────────┐
│                    主业务表                              │
│  documents: id, title, content, ..., deleted_at, ...   │
└─────────────────────────────────────────────────────────┘
                          ↓ 软删除标记
┌─────────────────────────────────────────────────────────┐
│                  回收站元数据表                           │
│  recycle_bin: entity_id, deleted_at, expire_at, ...    │
└─────────────────────────────────────────────────────────┘
                          ↓ 异步作业
┌─────────────────────────────────────────────────────────┐
│                    审计日志表                            │
│  audit_log: action, actor, timestamp, details          │
└─────────────────────────────────────────────────────────┘
```

**优势**:
1. **查询性能**: 主表查询无需过滤删除数据（加 `deleted_at IS NULL` 条件即可）
2. **恢复效率**: 回收站元数据表独立，支持快速列出可恢复项
3. **数据完整性**: 原数据保持完整，恢复时只需更新标记
4. **审计追踪**: 独立审计表支持合规要求

**实现要点**:
```sql
-- 查询未删除数据
SELECT * FROM documents WHERE deleted_at IS NULL AND workspace_id = ?;

-- 查询回收站
SELECT * FROM recycle_bin 
WHERE owner_id = ? AND can_restore = TRUE 
ORDER BY deleted_at DESC;

-- 恢复操作（事务）
BEGIN;
UPDATE documents SET deleted_at = NULL, updated_at = NOW() WHERE id = ?;
UPDATE recycle_bin SET can_restore = FALSE, restored_at = NOW() WHERE entity_id = ?;
INSERT INTO audit_log (...) VALUES (...);
COMMIT;
```

---

### 2.3 保留期限建议

#### 分级保留策略

| 用户等级/数据类型 | 保留期限 | 说明 |
|------------------|---------|------|
| **免费用户** | 30 天 | 基础保留期，平衡存储成本与用户体验 |
| **付费用户** | 60 天 | 增值服务，提升用户满意度 |
| **企业用户** | 90 天 | 满足企业合规与审计需求 |
| **关键数据** | 可配置（最高 180 天） | 如合同、财务文档等，支持自定义 |

#### 自动清理机制

```python
# 定时清理任务（每日执行）
def cleanup_expired_items():
    """清理过期回收站项目"""
    expired_items = RecycleBin.query.filter(
        RecycleBin.expire_at <= datetime.now(),
        RecycleBin.can_restore == True
    ).all()
    
    for item in expired_items:
        # 1. 记录审计日志
        audit_log.create(
            action='AUTO_PERMANENT_DELETE',
            entity_type=item.entity_type,
            entity_id=item.entity_id,
            details={'reason': 'retention_period_expired'}
        )
        
        # 2. 物理删除或标记永久删除
        if item.entity_type == 'document':
            Document.query.filter(id=item.entity_id).delete()
        
        # 3. 更新回收站记录
        item.can_restore = False
        item.restored_at = None
    
    db.session.commit()
    logger.info(f"Cleaned up {len(expired_items)} expired items")
```

#### 清理前通知（可选增强）

```python
def notify_before_deletion():
    """删除前 7 天通知用户"""
    soon_expired = RecycleBin.query.filter(
        RecycleBin.expire_at.between(
            datetime.now(),
            datetime.now() + timedelta(days=7)
        ),
        RecycleBin.can_restore == True
    ).all()
    
    # 按用户分组发送通知
    user_items = group_by(soon_expired, lambda x: x.owner_id)
    for user_id, items in user_items.items():
        notification.send(
            user_id=user_id,
            type='RECYCLE_BIN_CLEANUP_WARNING',
            title=f'{len(items)} 个项目即将永久删除',
            body='请在 7 天内恢复需要保留的项目',
            action_url='/recycle-bin'
        )
```

---

### 2.4 存储优化建议

#### 1. 配额管理策略

```
┌─────────────────────────────────────────────────────────┐
│  用户总配额 = 活跃数据 + 回收站数据                      │
│                                                         │
│  建议：回收站数据计入总配额，但提供"清理回收站释放空间"  │
│        的明确引导                                        │
└─────────────────────────────────────────────────────────┘
```

**实现方案**:
```sql
-- 计算用户存储使用
SELECT 
    owner_id,
    SUM(CASE WHEN deleted_at IS NULL THEN size_bytes ELSE 0 END) as active_size,
    SUM(CASE WHEN deleted_at IS NOT NULL THEN size_bytes ELSE 0 END) as trash_size,
    SUM(size_bytes) as total_size
FROM documents
GROUP BY owner_id;
```

#### 2. 冷热数据分离

```
活跃数据（热）          回收站数据（温）        归档数据（冷）
────────────          ──────────────        ────────────
SSD 存储               HDD 存储               对象存储/归档存储
快速访问               中等访问               低频访问
高 IOPS                中等 IOPS              低 IOPS
```

**迁移策略**:
- 删除后 0-7 天：保持原存储位置（快速恢复）
- 删除后 7-30 天：迁移到低成本存储层
- 删除后 30+ 天：自动清理

#### 3. 压缩与去重

```python
# 回收站数据压缩（异步任务）
def compress_trash_data():
    """压缩超过 7 天的回收站数据"""
    old_items = RecycleBin.query.filter(
        RecycleBin.deleted_at <= datetime.now() - timedelta(days=7),
        RecycleBin.compressed == False
    ).all()
    
    for item in old_items:
        # 压缩内容数据
        entity = get_entity(item.entity_type, item.entity_id)
        compressed_content = gzip.compress(entity.content)
        
        # 存储到压缩存储区
        store_compressed(item.entity_id, compressed_content)
        
        # 标记已压缩
        item.compressed = True
    
    db.session.commit()
```

#### 4. 回收站条目数量限制

| 用户等级 | 最大回收站条目数 | 最大回收站总大小 |
|---------|----------------|-----------------|
| 免费 | 500 条 | 1 GB |
| 付费 | 5000 条 | 10 GB |
| 企业 | 无限制 | 配额内 |

**超限处理**:
- 新删除时提示"回收站已满，请先清理"
- 或自动删除最早的条目（FIFO）
- 推荐：提示用户清理，不自动删除

---

### 2.5 恢复操作设计

#### 恢复流程图

```
用户发起恢复请求
        ↓
验证权限（是否可恢复该条目）
        ↓
检查原位置状态
        ↓
    ┌───────┴───────┐
    ↓               ↓
原位置可用      原位置被占用
    ↓               ↓
直接恢复      冲突处理策略
    ↓               ↓
更新数据库     ┌────┴────┐
    ↓           ↓        ↓
记录审计    重命名   选择新位置
    ↓           ↓        ↓
返回成功    恢复完成   恢复完成
```

#### API 设计

```typescript
// 恢复单个项目
POST /api/recycle-bin/restore
{
  "itemId": "string",
  "restoreToParentId?: "string"  // 可选，指定恢复位置
}

Response:
{
  "success": true,
  "restoredItem": {
    "id": "string",
    "title": "string",
    "path": "string"
  },
  "conflictResolved": "renamed" | "moved" | "none"
}

// 批量恢复
POST /api/recycle-bin/restore-batch
{
  "itemIds": ["string"],
  "restoreToParentId?: "string"
}

Response:
{
  "success": true,
  "restored": 10,
  "failed": 2,
  "details": [
    {"itemId": "1", "status": "success", "path": "/docs/file1"},
    {"itemId": "2", "status": "conflict", "resolution": "renamed", "newName": "file2 (1)"}
  ]
}

// 查询可恢复项目
GET /api/recycle-bin/items?limit=50&offset=0&entityType=document

Response:
{
  "items": [...],
  "total": 150,
  "expiringSoon": 5  // 7 天内过期的数量
}
```

#### 冲突处理策略

```python
def restore_item(item_id, target_parent_id=None):
    """恢复单个项目，处理冲突"""
    item = RecycleBin.query.get(item_id)
    
    if not item or not item.can_restore:
        raise RestoreError("Item not found or not restorable")
    
    # 确定恢复位置
    if target_parent_id:
        parent = get_entity(target_parent_id)
        if not parent:
            raise RestoreError("Target parent not found")
    else:
        # 尝试恢复到原位置
        parent = get_entity(item.original_parent_id)
        if not parent:
            # 原位置不存在，恢复到工作区根目录
            parent = get_workspace_root(item.workspace_id)
    
    # 检查命名冲突
    entity = get_entity(item.entity_type, item.entity_id)
    if entity_exists_at_path(entity.title, parent.id):
        # 冲突处理策略
        strategy = get_conflict_resolution_strategy()
        
        if strategy == 'rename':
            new_name = generate_unique_name(entity.title, parent.id)
            entity.title = new_name
        elif strategy == 'replace':
            # 覆盖现有（需要额外权限）
            if not has_permission(user, 'overwrite'):
                raise RestoreError("Permission denied for overwrite")
        elif strategy == 'skip':
            return RestoreResult(status='skipped', reason='conflict')
    
    # 执行恢复
    entity.deleted_at = None
    entity.parent_id = parent.id
    entity.updated_at = datetime.now()
    
    # 更新回收站记录
    item.can_restore = False
    item.restored_at = datetime.now()
    item.restored_by = current_user.id
    
    # 记录审计
    audit_log.create(
        action='RESTORE',
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        actor_id=current_user.id,
        details={'from_trash': True, 'conflict_resolved': strategy}
    )
    
    db.session.commit()
    return RestoreResult(status='success', entity=entity)
```

---

### 2.6 权限控制设计

#### 权限矩阵

| 操作 | 文件所有者 | 协作者（编辑） | 协作者（查看） | 工作区管理员 | 系统管理员 |
|------|-----------|--------------|--------------|-------------|-----------|
| 删除自己的 | ✅ | ❌ | ❌ | ✅ | ✅ |
| 删除他人的 | ❌ | ❌ | ❌ | ✅（同工作区） | ✅ |
| 恢复自己的 | ✅ | ❌ | ❌ | ✅ | ✅ |
| 恢复他人的 | ❌ | ❌ | ❌ | ✅（同工作区） | ✅ |
| 清空回收站 | ✅（仅自己的） | ❌ | ❌ | ✅（工作区内） | ✅（全局） |
| 查看回收站 | ✅（仅自己的） | ❌ | ❌ | ✅（工作区内） | ✅（全局） |
| 查看审计日志 | ❌ | ❌ | ❌ | ✅（工作区内） | ✅（全局） |

#### RBAC 权限模型实现

```python
# 权限定义
class RecycleBinPermission:
    DELETE_OWN = 'recycle_bin:delete:own'
    DELETE_OTHERS = 'recycle_bin:delete:others'
    RESTORE_OWN = 'recycle_bin:restore:own'
    RESTORE_OTHERS = 'recycle_bin:restore:others'
    VIEW_OWN = 'recycle_bin:view:own'
    VIEW_OTHERS = 'recycle_bin:view:others'
    EMPTY_TRASH_OWN = 'recycle_bin:empty:own'
    EMPTY_TRASH_WORKSPACE = 'recycle_bin:empty:workspace'
    VIEW_AUDIT_LOG = 'recycle_bin:audit:view'

# 权限检查装饰器
def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if not current_user.has_permission(permission):
                # 检查工作区级别权限
                workspace_id = kwargs.get('workspace_id')
                if not current_user.has_workspace_permission(permission, workspace_id):
                    raise PermissionError(f"Permission {permission} required")
            return f(*args, **kwargs)
        return wrapped
    return decorator

# 使用示例
@api.route('/recycle-bin/items', methods=['GET'])
@require_permission(RecycleBinPermission.VIEW_OWN)
def list_trash_items():
    """列出用户回收站项目"""
    if current_user.has_permission(RecycleBinPermission.VIEW_OTHERS):
        # 管理员可查看所有
        items = RecycleBin.query.filter_by(workspace_id=workspace_id).all()
    else:
        # 普通用户只看自己的
        items = RecycleBin.query.filter_by(owner_id=current_user.id).all()
    
    return jsonify({'items': [item.to_dict() for item in items]})

@api.route('/recycle-bin/delete', methods=['POST'])
@require_permission(RecycleBinPermission.DELETE_OWN)
def delete_item():
    """删除项目到回收站"""
    item_id = request.json['itemId']
    item = get_entity(item_id)
    
    # 检查是否是所有者
    if item.owner_id != current_user.id:
        # 非所有者需要 DELETE_OTHERS 权限
        if not current_user.has_permission(RecycleBinPermission.DELETE_OTHERS):
            raise PermissionError("Cannot delete others' items")
    
    # 执行软删除
    item.deleted_at = datetime.now()
    item.deleted_by = current_user.id
    
    # 创建回收站记录
    recycle_item = RecycleBin(
        entity_type=item.type,
        entity_id=item.id,
        owner_id=item.owner_id,
        deleted_by=current_user.id,
        deleted_at=item.deleted_at,
        expire_at=item.deleted_at + timedelta(days=get_retention_days()),
        original_parent_id=item.parent_id,
        original_path=item.path_snapshot
    )
    
    # 审计日志
    audit_log.create(
        action='DELETE',
        entity_type=item.type,
        entity_id=item.id,
        actor_id=current_user.id,
        details={'moved_to_trash': True}
    )
    
    db.session.commit()
    return jsonify({'success': True})
```

#### 审计日志设计

```sql
-- 审计日志表（扩展）
CREATE TABLE audit_log (
    id BIGINT PRIMARY KEY,
    -- 基础信息
    entity_type VARCHAR(50),
    entity_id BIGINT,
    action VARCHAR(50),         -- DELETE, RESTORE, PERMANENT_DELETE, EMPTY_TRASH
    action_category VARCHAR(50), -- USER_ACTION, ADMIN_ACTION, SYSTEM_ACTION
    
    -- 操作者信息
    actor_id BIGINT,
    actor_name VARCHAR(100),
    actor_role VARCHAR(50),
    actor_ip VARCHAR(45),
    
    -- 时间信息
    timestamp TIMESTAMP,
    
    -- 详情（JSON）
    details JSON,
    /*
    示例内容:
    DELETE: {
      "itemTitle": "文档标题",
      "itemPath": "/工作区/文件夹/文档",
      "fromTrash": false,
      "permanent": false
    }
    RESTORE: {
      "itemTitle": "文档标题",
      "restoredTo": "/工作区/文件夹",
      "conflictResolved": "renamed"
    }
    PERMANENT_DELETE: {
      "reason": "user_action" | "auto_cleanup" | "quota_exceeded",
      "itemCount": 1
    }
    */
    
    -- 索引
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_actor (actor_id, timestamp),
    INDEX idx_action (action, timestamp),
    INDEX idx_category (action_category, timestamp)
);
```

#### 审计日志查询 API

```typescript
// 查询审计日志
GET /api/audit-logs?
  entityType=document&
  action=DELETE&
  startDate=2026-01-01&
  endDate=2026-03-16&
  actorId=123&
  limit=50

Response:
{
  "logs": [
    {
      "id": "1",
      "entityType": "document",
      "entityId": "456",
      "entityTitle": "季度报告.docx",
      "action": "DELETE",
      "actor": {"id": "123", "name": "张三"},
      "timestamp": "2026-03-15T10:30:00Z",
      "details": {
        "itemPath": "/财务部/2026/季度报告.docx",
        "fromTrash": false
      }
    }
  ],
  "total": 150
}
```

---

## 三、实施建议与最佳实践

### 3.1 分阶段实施计划

#### Phase 1: 基础功能（2-3 周）
- [ ] 软删除数据模型设计与实现
- [ ] 回收站基础 CRUD API
- [ ] 单条恢复功能
- [ ] 基础权限控制（所有者删除/恢复）

#### Phase 2: 增强功能（2-3 周）
- [ ] 批量恢复功能
- [ ] 自动清理定时任务
- [ ] 冲突处理机制
- [ ] 审计日志记录

#### Phase 3: 高级功能（2-3 周）
- [ ] 分级保留期限（按用户等级）
- [ ] 工作区管理员权限
- [ ] 删除前通知
- [ ] 存储配额管理

#### Phase 4: 优化与监控（持续）
- [ ] 性能优化（索引、缓存）
- [ ] 监控告警（回收站容量、清理任务）
- [ ] 用户反馈迭代

### 3.2 关键指标监控

```yaml
监控指标:
  - 回收站项目总数
  - 即将过期项目数（7 天内）
  - 每日删除量
  - 每日恢复量
  - 自动清理执行成功率
  - 平均恢复时间
  - 存储配额使用率（活跃 vs 回收站）

告警阈值:
  - 回收站容量 > 80%: 警告
  - 自动清理失败: 立即告警
  - 恢复失败率 > 5%: 警告
```

### 3.3 用户体验优化

1. **删除确认**: 重要文件删除前二次确认
2. **恢复预览**: 恢复前显示文件内容和位置
3. **过期提醒**: 删除前 7 天、3 天、1 天通知
4. **批量操作**: 支持按时间、类型、大小筛选后批量操作
5. **搜索功能**: 回收站内支持搜索
6. **快捷清理**: "一键清空回收站"功能

---

## 四、总结

### 核心设计原则

1. **安全第一**: 所有删除操作可追溯，支持审计
2. **用户友好**: 恢复操作简单直观，冲突处理智能
3. **成本可控**: 分级保留策略，自动清理机制
4. **性能优先**: 软删除 + 独立元数据，查询高效
5. **扩展性强**: 支持多租户、多实体类型、可配置策略

### 推荐配置（默认）

| 配置项 | 推荐值 |
|--------|--------|
| 保留期限 | 30 天（免费）/ 60 天（付费）/ 90 天（企业） |
| 清理频率 | 每日凌晨 2:00 |
| 通知时机 | 过期前 7 天、3 天、1 天 |
| 冲突处理 | 默认重命名，可选覆盖/跳过 |
| 配额计算 | 回收站计入总配额 |
| 审计保留 | 180 天 |

---

**文档版本**: 1.0  
**最后更新**: 2026-03-16  
**作者**: 云龙虾 1 号 🦞
