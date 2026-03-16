/**
 * 左侧导航树组件 - Navigation Tree Component
 * 基于嵌套集合模型 (Nested Set Model)
 * 
 * 功能:
 * - 显示需求集合（用户需求/产品需求/...）
 * - 显示子标题（1.1, 1.2, 1.3...）
 * - 展开/收起功能
 * - 显示需求数量
 * - 集合操作（新建、重命名、删除）
 * - 标题操作菜单（重命名、插入、移动、删除）
 * - 自动编号算法
 */

// 导航树数据结构
class NavigationTree {
    constructor(projectId) {
        this.projectId = projectId;
        this.nodes = []; // 所有节点
        this.expandedNodes = new Set(); // 展开的节点 ID
        this.selectedNode = null; // 当前选中的节点
        this.onNodeSelect = null; // 节点选择回调
        this.onDataChange = null; // 数据变化回调
    }

    // 加载导航树数据
    async load() {
        try {
            const response = await fetch(`${API_BASE}/navigation?projectId=${this.projectId}`);
            const data = await response.json();
            if (data.success) {
                this.nodes = data.data || [];
                // 默认展开根节点
                this.nodes.filter(n => n.level === 1).forEach(n => this.expandedNodes.add(n.id));
                return true;
            }
        } catch (error) {
            console.error('加载导航树失败:', error);
        }
        return false;
    }

    // 获取子节点
    getChildren(nodeId) {
        return this.nodes.filter(n => n.parentId === nodeId).sort((a, b) => a.order - b.order);
    }

    // 获取父节点
    getParent(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || !node.parentId) return null;
        return this.nodes.find(n => n.id === node.parentId);
    }

    // 判断是否有子节点
    hasChildren(nodeId) {
        return this.nodes.some(n => n.parentId === nodeId);
    }

    // 获取节点的完整路径
    getPath(nodeId) {
        const path = [];
        let current = this.nodes.find(n => n.id === nodeId);
        while (current) {
            path.unshift(current);
            current = this.nodes.find(n => n.id === current.parentId);
        }
        return path;
    }

    // 切换展开/收起状态
    toggleExpand(nodeId) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }
    }

    // 选中节点
    selectNode(nodeId) {
        this.selectedNode = nodeId;
        if (this.onNodeSelect) {
            const node = this.nodes.find(n => n.id === nodeId);
            this.onNodeSelect(node);
        }
    }

    // 创建新集合
    async createCollection(name, parentId = null) {
        try {
            const response = await fetch(`${API_BASE}/navigation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.projectId,
                    name,
                    parentId,
                    type: 'collection'
                })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return data.data;
            }
        } catch (error) {
            console.error('创建集合失败:', error);
        }
        return null;
    }

    // 创建子标题
    async createHeader(name, parentId) {
        try {
            const response = await fetch(`${API_BASE}/navigation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.projectId,
                    name,
                    parentId,
                    type: 'header'
                })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return data.data;
            }
        } catch (error) {
            console.error('创建标题失败:', error);
        }
        return null;
    }

    // 更新节点
    async updateNode(nodeId, updates) {
        try {
            const response = await fetch(`${API_BASE}/navigation/${nodeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return true;
            }
        } catch (error) {
            console.error('更新节点失败:', error);
        }
        return false;
    }

    // 删除节点
    async deleteNode(nodeId) {
        try {
            const response = await fetch(`${API_BASE}/navigation/${nodeId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return true;
            }
        } catch (error) {
            console.error('删除节点失败:', error);
        }
        return false;
    }

    // 移动节点（上移/下移）
    async moveNode(nodeId, direction) {
        try {
            const response = await fetch(`${API_BASE}/navigation/${nodeId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ direction })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return true;
            }
        } catch (error) {
            console.error('移动节点失败:', error);
        }
        return false;
    }

    // 重新计算编号（自动编号算法）
    recalculateNumbers() {
        const updateNumbers = (parentId = null, prefix = '', order = 0) => {
            const children = this.getChildren(parentId);
            children.forEach((child, index) => {
                const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
                child.path = number;
                updateNumbers(child.id, number, index);
            });
        };
        updateNumbers();
    }
}

// 导航树渲染器
class NavigationTreeRenderer {
    constructor(tree, containerId) {
        this.tree = tree;
        this.container = document.getElementById(containerId);
        this.menuTimeout = null;
    }

    // 渲染整个导航树
    render() {
        if (!this.container) return;
        
        const rootNodes = this.tree.nodes.filter(n => n.level === 1).sort((a, b) => a.order - b.order);
        
        this.container.innerHTML = `
            <div class="nav-tree-header">
                <div class="nav-tree-title">📁 需求集合</div>
                <button class="nav-tree-action-btn" onclick="navTree.showCreateCollectionModal(null)" title="新建集合">+</button>
            </div>
            <div class="nav-tree-content">
                ${this.renderNodes(rootNodes, 0)}
            </div>
        `;
    }

    // 递归渲染节点
    renderNodes(nodes, depth) {
        if (!nodes || nodes.length === 0) return '';
        
        return nodes.map(node => {
            const hasChildren = this.tree.hasChildren(node.id);
            const isExpanded = this.tree.expandedNodes.has(node.id);
            const isSelected = this.tree.selectedNode === node.id;
            const paddingLeft = depth * 20 + 10;
            
            return `
                <div class="nav-tree-node ${isSelected ? 'selected' : ''}" data-id="${node.id}" style="padding-left: ${paddingLeft}px">
                    <div class="nav-tree-item">
                        <div class="nav-tree-item-left">
                            ${hasChildren ? `
                                <button class="nav-tree-toggle" onclick="navTree.toggleExpand('${node.id}')">
                                    ${isExpanded ? '▼' : '▶'}
                                </button>
                            ` : '<span class="nav-tree-toggle-placeholder"></span>'}
                            
                            <span class="nav-tree-icon">${node.type === 'collection' ? '📁' : '📑'}</span>
                            
                            <span class="nav-tree-name" onclick="navTree.selectNode('${node.id}')">${node.name}</span>
                            
                            ${node.requirementCount > 0 ? `
                                <span class="nav-tree-count">${node.requirementCount}</span>
                            ` : ''}
                        </div>
                        
                        <div class="nav-tree-item-right">
                            <button class="nav-tree-menu-btn" onclick="navTree.showNodeMenu(event, '${node.id}')">⋮</button>
                        </div>
                    </div>
                    
                    ${hasChildren && isExpanded ? `
                        <div class="nav-tree-children">
                            ${this.renderNodes(this.tree.getChildren(node.id), depth + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // 显示节点操作菜单
    showNodeMenu(event, nodeId) {
        event.stopPropagation();
        
        // 关闭之前的菜单
        this.hideMenu();
        
        const node = this.tree.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const menu = document.createElement('div');
        menu.className = 'nav-tree-menu';
        menu.id = 'navTreeMenu';
        menu.innerHTML = `
            <div class="nav-tree-menu-item" onclick="navTree.showRenameModal('${nodeId}')">
                ✏️ 重命名
            </div>
            ${node.type === 'collection' ? `
                <div class="nav-tree-menu-item" onclick="navTree.showCreateCollectionModal('${nodeId}')">
                    📁 新建子集合
                </div>
            ` : ''}
            <div class="nav-tree-menu-item" onclick="navTree.showCreateHeaderModal('${nodeId}')">
                📑 插入子标题
            </div>
            <div class="nav-tree-menu-divider"></div>
            <div class="nav-tree-menu-item" onclick="navTree.insertSibling('${nodeId}', 'before')">
                ⬆️ 插入同级（之前）
            </div>
            <div class="nav-tree-menu-item" onclick="navTree.insertSibling('${nodeId}', 'after')">
                ⬇️ 插入同级（之后）
            </div>
            <div class="nav-tree-menu-divider"></div>
            <div class="nav-tree-menu-item" onclick="navTree.moveNode('${nodeId}', 'up')">
                ⬆ 上移
            </div>
            <div class="nav-tree-menu-item" onclick="navTree.moveNode('${nodeId}', 'down')">
                ⬇ 下移
            </div>
            <div class="nav-tree-menu-divider"></div>
            <div class="nav-tree-menu-item danger" onclick="navTree.deleteNode('${nodeId}')">
                🗑️ 删除
            </div>
        `;
        
        // 定位菜单
        const rect = event.target.getBoundingClientRect();
        menu.style.left = `${rect.right + 5}px`;
        menu.style.top = `${rect.top}px`;
        
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.hideMenu.bind(this));
        }, 100);
    }

    // 隐藏菜单
    hideMenu() {
        const menu = document.getElementById('navTreeMenu');
        if (menu) {
            menu.remove();
        }
        document.removeEventListener('click', this.hideMenu.bind(this));
    }

    // 显示创建集合模态框
    showCreateCollectionModal(parentId) {
        this.hideMenu();
        const parentName = parentId ? this.tree.nodes.find(n => n.id === parentId)?.name : '根目录';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'createCollectionModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 500px">
                <div class="modal-header">
                    <h2>📁 新建集合</h2>
                    <button class="close-btn" onclick="navTree.closeModal('createCollectionModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>父级集合</label>
                        <input type="text" value="${parentName}" disabled style="background: #f5f5f5">
                    </div>
                    <div class="form-group">
                        <label>集合名称 <span style="color: red">*</span></label>
                        <input type="text" id="newCollectionName" placeholder="例如：用户需求、产品需求..." autofocus>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="navTree.closeModal('createCollectionModal')">取消</button>
                    <button class="btn-primary" onclick="navTree.createCollection()">创建</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('newCollectionName').focus();
        
        // 回车创建
        document.getElementById('newCollectionName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') navTree.createCollection();
        });
    }

    // 显示创建标题模态框
    showCreateHeaderModal(parentId) {
        this.hideMenu();
        const parentName = this.tree.nodes.find(n => n.id === parentId)?.name;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'createHeaderModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 500px">
                <div class="modal-header">
                    <h2>📑 新建标题</h2>
                    <button class="close-btn" onclick="navTree.closeModal('createHeaderModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>父级标题</label>
                        <input type="text" value="${parentName}" disabled style="background: #f5f5f5">
                    </div>
                    <div class="form-group">
                        <label>标题名称 <span style="color: red">*</span></label>
                        <input type="text" id="newHeaderName" placeholder="例如：1.1 登录注册、1.2 数据管理..." autofocus>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="navTree.closeModal('createHeaderModal')">取消</button>
                    <button class="btn-primary" onclick="navTree.createHeader()">创建</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('newHeaderName').focus();
        
        // 回车创建
        document.getElementById('newHeaderName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') navTree.createHeader();
        });
    }

    // 显示重命名模态框
    showRenameModal(nodeId) {
        this.hideMenu();
        const node = this.tree.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'renameModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 500px">
                <div class="modal-header">
                    <h2>✏️ 重命名</h2>
                    <button class="close-btn" onclick="navTree.closeModal('renameModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>新名称 <span style="color: red">*</span></label>
                        <input type="text" id="renameInput" value="${node.name}" autofocus>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="navTree.closeModal('renameModal')">取消</button>
                    <button class="btn-primary" onclick="navTree.renameNode('${nodeId}')">保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const input = document.getElementById('renameInput');
        input.focus();
        input.select();
        
        // 回车保存
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') navTree.renameNode(nodeId);
        });
    }

    // 关闭模态框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
    }

    // 创建集合
    async createCollection() {
        const name = document.getElementById('newCollectionName').value.trim();
        if (!name) {
            showToast('请输入集合名称', 'error');
            return;
        }
        
        const menu = document.getElementById('createCollectionModal');
        const parentId = menu.querySelector('input[disabled]').value === '根目录' ? null : 
            this.tree.nodes.find(n => n.name === menu.querySelector('input[disabled]').value)?.id;
        
        await this.tree.createCollection(name, parentId);
        this.closeModal('createCollectionModal');
        showToast('集合创建成功', 'success');
    }

    // 创建标题
    async createHeader() {
        const name = document.getElementById('newHeaderName').value.trim();
        if (!name) {
            showToast('请输入标题名称', 'error');
            return;
        }
        
        const menu = document.getElementById('createHeaderModal');
        const parentId = this.tree.nodes.find(n => n.name === menu.querySelector('input[disabled]').value)?.id;
        
        await this.tree.createHeader(name, parentId);
        this.closeModal('createHeaderModal');
        showToast('标题创建成功', 'success');
    }

    // 重命名节点
    async renameNode(nodeId) {
        const name = document.getElementById('renameInput').value.trim();
        if (!name) {
            showToast('请输入名称', 'error');
            return;
        }
        
        await this.tree.updateNode(nodeId, { name });
        this.closeModal('renameModal');
        showToast('重命名成功', 'success');
    }

    // 插入同级节点
    async insertSibling(nodeId, position) {
        const node = this.tree.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const name = prompt(`请输入新${node.type === 'collection' ? '集合' : '标题'}名称:`);
        if (!name) return;
        
        // 找到父节点的所有子节点
        const siblings = this.tree.getChildren(node.parentId);
        const index = siblings.findIndex(s => s.id === nodeId);
        
        // 计算新节点的 order
        const newOrder = position === 'before' ? 
            (index > 0 ? siblings[index - 1].order + 0.5 : 0) : 
            siblings[index].order + 0.5;
        
        await this.tree.createCollection(name, node.parentId);
        // TODO: 需要后端支持指定 order
        showToast('插入成功', 'success');
    }
}

// 全局导航树实例
let navTree = null;

// 初始化导航树
async function initNavigationTree(projectId, containerId, callbacks = {}) {
    navTree = {
        tree: new NavigationTree(projectId),
        renderer: null
    };
    
    navTree.tree.onNodeSelect = callbacks.onNodeSelect;
    navTree.tree.onDataChange = callbacks.onDataChange;
    
    await navTree.tree.load();
    
    navTree.renderer = new NavigationTreeRenderer(navTree.tree, containerId);
    navTree.renderer.render();
    
    // 绑定全局方法
    window.navTree = {
        ...navTree.tree,
        ...navTree.renderer,
        toggleExpand: (nodeId) => {
            navTree.tree.toggleExpand(nodeId);
            navTree.renderer.render();
        },
        selectNode: (nodeId) => {
            navTree.tree.selectNode(nodeId);
            navTree.renderer.render();
        },
        showNodeMenu: (event, nodeId) => {
            navTree.renderer.showNodeMenu(event, nodeId);
        },
        hideMenu: () => {
            navTree.renderer.hideMenu();
        },
        showCreateCollectionModal: (parentId) => {
            navTree.renderer.showCreateCollectionModal(parentId);
        },
        showCreateHeaderModal: (parentId) => {
            navTree.renderer.showCreateHeaderModal(parentId);
        },
        showRenameModal: (nodeId) => {
            navTree.renderer.showRenameModal(nodeId);
        },
        closeModal: (modalId) => {
            navTree.renderer.closeModal(modalId);
        },
        createCollection: () => {
            navTree.renderer.createCollection();
        },
        createHeader: () => {
            navTree.renderer.createHeader();
        },
        renameNode: (nodeId) => {
            navTree.renderer.renameNode(nodeId);
        },
        insertSibling: (nodeId, position) => {
            navTree.renderer.insertSibling(nodeId, position);
        },
        moveNode: async (nodeId, direction) => {
            await navTree.tree.moveNode(nodeId, direction);
            showToast('移动成功', 'success');
        },
        deleteNode: async (nodeId) => {
            if (confirm('确定要删除这个节点吗？此操作不可恢复。')) {
                await navTree.tree.deleteNode(nodeId);
                showToast('删除成功', 'success');
            }
        },
        refresh: async () => {
            await navTree.tree.load();
            navTree.renderer.render();
        }
    };
    
    return window.navTree;
}

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationTree, NavigationTreeRenderer, initNavigationTree };
}
