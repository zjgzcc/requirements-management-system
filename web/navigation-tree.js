/**
 * 左侧导航树组件 - Navigation Tree Component (增强版)
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
 * - 【增强】拖拽排序（调整顺序/层级）
 * - 【增强】批量操作
 * - 【增强】节点复制/导入/导出
 * - 【增强】节点搜索定位
 */

// 导航树数据结构
class NavigationTree {
    constructor(projectId) {
        this.projectId = projectId;
        this.nodes = []; // 所有节点
        this.expandedNodes = new Set(); // 展开的节点 ID
        this.selectedNode = null; // 当前选中的节点
        this.selectedNodes = new Set(); // 批量选中的节点 ID
        this.onNodeSelect = null; // 节点选择回调
        this.onDataChange = null; // 数据变化回调
        this.draggedNode = null; // 拖拽中的节点
        this.dragOverNode = null; // 拖拽目标节点
        this.searchQuery = ''; // 搜索关键词
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
    selectNode(nodeId, multiSelect = false) {
        if (multiSelect) {
            if (this.selectedNodes.has(nodeId)) {
                this.selectedNodes.delete(nodeId);
            } else {
                this.selectedNodes.add(nodeId);
            }
        } else {
            this.selectedNodes.clear();
            this.selectedNode = nodeId;
        }
        if (this.onNodeSelect) {
            const node = this.nodes.find(n => n.id === nodeId);
            this.onNodeSelect(node);
        }
    }

    // 清空批量选择
    clearSelection() {
        this.selectedNodes.clear();
    }

    // 切换节点选择状态
    toggleNodeSelection(nodeId) {
        if (this.selectedNodes.has(nodeId)) {
            this.selectedNodes.delete(nodeId);
        } else {
            this.selectedNodes.add(nodeId);
        }
    }

    // 全选节点
    selectAll() {
        this.nodes.forEach(n => this.selectedNodes.add(n.id));
    }

    // 获取所有选中的节点（包括单选）
    getSelectedNodeIds() {
        const ids = Array.from(this.selectedNodes);
        if (this.selectedNode && !this.selectedNodes.has(this.selectedNode)) {
            ids.push(this.selectedNode);
        }
        return ids;
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

    // 批量删除节点
    async batchDelete(nodeIds) {
        try {
            const response = await fetch(`${API_BASE}/navigation/batch-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeIds })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return true;
            }
        } catch (error) {
            console.error('批量删除失败:', error);
        }
        return false;
    }

    // 批量移动节点
    async batchMove(nodeIds, targetParentId) {
        try {
            const response = await fetch(`${API_BASE}/navigation/batch-move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeIds, targetParentId })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return true;
            }
        } catch (error) {
            console.error('批量移动失败:', error);
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

    // 拖拽重新排序
    async reorderNode(draggedNodeId, targetNodeId, position) {
        try {
            const response = await fetch(`${API_BASE}/navigation/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    draggedNodeId,
                    targetNodeId,
                    position // 'before', 'after', 'into'
                })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return true;
            }
        } catch (error) {
            console.error('重新排序失败:', error);
        }
        return false;
    }

    // 复制节点
    async duplicateNode(nodeId, newName = null) {
        try {
            const response = await fetch(`${API_BASE}/navigation/duplicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId, newName })
            });
            const data = await response.json();
            if (data.success) {
                await this.load();
                if (this.onDataChange) this.onDataChange();
                return data.data;
            }
        } catch (error) {
            console.error('复制节点失败:', error);
        }
        return null;
    }

    // 搜索节点
    searchNodes(query) {
        if (!query) return [];
        this.searchQuery = query.toLowerCase();
        return this.nodes.filter(n => n.name.toLowerCase().includes(this.searchQuery));
    }

    // 高亮搜索结果的节点
    highlightSearchResults(query) {
        const results = this.searchNodes(query);
        // 展开所有结果节点的父节点
        results.forEach(node => {
            let parentId = node.parentId;
            while (parentId) {
                this.expandedNodes.add(parentId);
                const parent = this.getParent(parentId);
                parentId = parent?.parentId;
            }
        });
        return results;
    }

    // 导出节点数据
    exportNodes(nodeIds) {
        const nodes = this.nodes.filter(n => nodeIds.includes(n.id));
        return JSON.stringify(nodes, null, 2);
    }

    // 导入节点数据
    async importNodes(jsonData, parentId = null) {
        try {
            const nodes = JSON.parse(jsonData);
            if (!Array.isArray(nodes)) return false;
            
            for (const node of nodes) {
                await this.createCollection(node.name, parentId);
            }
            await this.load();
            if (this.onDataChange) this.onDataChange();
            return true;
        } catch (error) {
            console.error('导入节点失败:', error);
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
        this.draggedElement = null;
        this.dragOverElement = null;
        this.dragPosition = null; // 'before', 'after', 'into'
    }

    // 渲染整个导航树
    render() {
        if (!this.container) return;
        
        const rootNodes = this.tree.nodes.filter(n => n.level === 1).sort((a, b) => a.order - b.order);
        
        this.container.innerHTML = `
            <div class="nav-tree-header">
                <div class="nav-tree-title">📁 需求集合</div>
                <div class="nav-tree-header-actions">
                    <button class="nav-tree-action-btn" onclick="navTree.showSearchPanel()" title="搜索节点">🔍</button>
                    <button class="nav-tree-action-btn" onclick="navTree.showAdvancedPanel()" title="高级操作">⚙️</button>
                    <button class="nav-tree-action-btn" onclick="navTree.showCreateCollectionModal(null)" title="新建集合">+</button>
                </div>
            </div>
            <div class="nav-tree-search-bar" id="navTreeSearchBar" style="display: none;">
                <input type="text" id="navTreeSearchInput" placeholder="搜索节点..." class="nav-tree-search-input">
                <button class="nav-tree-search-close" onclick="navTree.closeSearch()">×</button>
            </div>
            <div class="nav-tree-content" id="navTreeContent">
                ${this.renderNodes(rootNodes, 0)}
            </div>
            <div class="nav-tree-footer" id="navTreeFooter" style="display: none;">
                <span id="navTreeSelectedCount">已选择 0 项</span>
                <div class="nav-tree-footer-actions">
                    <button class="nav-tree-footer-btn" onclick="navTree.batchDelete()">🗑️ 删除</button>
                    <button class="nav-tree-footer-btn" onclick="navTree.batchMove()">📁 移动</button>
                    <button class="nav-tree-footer-btn" onclick="navTree.clearSelection()">取消</button>
                </div>
            </div>
        `;

        // 绑定搜索事件
        const searchInput = document.getElementById('navTreeSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    // 处理搜索
    handleSearch(query) {
        if (!query) {
            this.tree.nodes.forEach(n => n.highlighted = false);
            this.render();
            return;
        }
        
        const results = this.tree.highlightSearchResults(query);
        this.tree.nodes.forEach(n => n.highlighted = results.some(r => r.id === n.id));
        this.render();
        
        // 滚动到第一个结果
        if (results.length > 0) {
            const firstResult = document.querySelector(`[data-id="${results[0].id}"]`);
            if (firstResult) {
                firstResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstResult.classList.add('search-highlight');
            }
        }
    }

    // 递归渲染节点
    renderNodes(nodes, depth) {
        if (!nodes || nodes.length === 0) return '';
        
        return nodes.map(node => {
            const hasChildren = this.tree.hasChildren(node.id);
            const isExpanded = this.tree.expandedNodes.has(node.id);
            const isSelected = this.tree.selectedNode === node.id || this.tree.selectedNodes.has(node.id);
            const isHighlighted = node.highlighted;
            const paddingLeft = depth * 20 + 10;
            
            return `
                <div class="nav-tree-node ${isSelected ? 'selected' : ''} ${isHighlighted ? 'search-highlight' : ''}" 
                     data-id="${node.id}" 
                     style="padding-left: ${paddingLeft}px"
                     draggable="true"
                     ondragstart="navTree.handleDragStart(event, '${node.id}')"
                     ondragend="navTree.handleDragEnd(event)"
                     ondragover="navTree.handleDragOver(event, '${node.id}')"
                     ondragleave="navTree.handleDragLeave(event)"
                     ondrop="navTree.handleDrop(event, '${node.id}')">
                    <div class="nav-tree-item">
                        <div class="nav-tree-item-left">
                            <input type="checkbox" class="nav-tree-checkbox" 
                                   ${this.tree.selectedNodes.has(node.id) ? 'checked' : ''}
                                   onclick="event.stopPropagation(); navTree.toggleNodeSelection('${node.id}')">
                            
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

    // 拖拽开始
    handleDragStart(event, nodeId) {
        this.tree.draggedNode = nodeId;
        this.draggedElement = event.target;
        event.target.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', nodeId);
    }

    // 拖拽结束
    handleDragEnd(event) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }
        // 清除所有 drag-over 样式
        document.querySelectorAll('.nav-tree-node.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        this.tree.draggedNode = null;
        this.dragOverNode = null;
        this.dragPosition = null;
    }

    // 拖拽经过
    handleDragOver(event, nodeId) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        const targetElement = event.target.closest('.nav-tree-node');
        if (!targetElement || nodeId === this.tree.draggedNode) return;
        
        // 清除之前的样式
        document.querySelectorAll('.nav-tree-node.drag-over').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after', 'drag-over-into');
        });
        
        // 计算放置位置
        const rect = targetElement.getBoundingClientRect();
        const offsetY = event.clientY - rect.top;
        const height = rect.height;
        
        if (offsetY < height * 0.25) {
            this.dragPosition = 'before';
            targetElement.classList.add('drag-over', 'drag-over-before');
        } else if (offsetY > height * 0.75) {
            this.dragPosition = 'after';
            targetElement.classList.add('drag-over', 'drag-over-after');
        } else {
            this.dragPosition = 'into';
            targetElement.classList.add('drag-over', 'drag-over-into');
        }
        
        this.dragOverElement = targetElement;
        this.dragOverNode = nodeId;
    }

    // 拖拽离开
    handleDragLeave(event) {
        const targetElement = event.target.closest('.nav-tree-node');
        if (targetElement) {
            targetElement.classList.remove('drag-over', 'drag-over-before', 'drag-over-after', 'drag-over-into');
        }
    }

    // 拖拽放置
    async handleDrop(event, targetNodeId) {
        event.preventDefault();
        
        const draggedNodeId = this.tree.draggedNode;
        if (!draggedNodeId || draggedNodeId === targetNodeId) return;
        
        // 防止拖拽到自己的子节点
        const draggedNode = this.tree.nodes.find(n => n.id === draggedNodeId);
        const targetNode = this.tree.nodes.find(n => n.id === targetNodeId);
        
        if (this.isDescendant(draggedNodeId, targetNodeId)) {
            showToast('不能将节点拖拽到自己的子节点', 'error');
            return;
        }
        
        let newParentId = targetNode.parentId;
        let position = this.dragPosition;
        
        if (position === 'into') {
            newParentId = targetNodeId;
        } else if (position === 'after') {
            // 找到目标节点的父节点，放在目标节点之后
            newParentId = targetNode.parentId;
        }
        
        const success = await this.tree.reorderNode(draggedNodeId, targetNodeId, position);
        if (success) {
            showToast('排序已保存', 'success');
        } else {
            showToast('排序失败', 'error');
        }
    }

    // 判断是否是后代节点
    isDescendant(nodeId, ancestorId) {
        const node = this.tree.nodes.find(n => n.id === nodeId);
        if (!node || !node.parentId) return false;
        if (node.parentId === ancestorId) return true;
        return this.isDescendant(node.parentId, ancestorId);
    }

    // 切换节点选择状态（批量选择）
    toggleNodeSelection(nodeId) {
        this.tree.toggleNodeSelection(nodeId);
        this.updateFooter();
        this.render();
    }

    // 更新底部工具栏
    updateFooter() {
        const footer = document.getElementById('navTreeFooter');
        const countEl = document.getElementById('navTreeSelectedCount');
        const selectedCount = this.tree.selectedNodes.size;
        
        if (selectedCount > 0) {
            footer.style.display = 'flex';
            countEl.textContent = `已选择 ${selectedCount} 项`;
        } else {
            footer.style.display = 'none';
        }
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
            <div class="nav-tree-menu-item" onclick="navTree.duplicateNode('${nodeId}')">
                📋 复制节点
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
            <div class="nav-tree-menu-item" onclick="navTree.exportNode('${nodeId}')">
                📤 导出节点
            </div>
            <div class="nav-tree-menu-item" onclick="navTree.showImportModal('${nodeId}')">
                📥 导入节点
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

    // 显示搜索面板
    showSearchPanel() {
        const searchBar = document.getElementById('navTreeSearchBar');
        if (searchBar) {
            searchBar.style.display = 'flex';
            document.getElementById('navTreeSearchInput').focus();
        }
    }

    // 关闭搜索
    closeSearch() {
        const searchBar = document.getElementById('navTreeSearchBar');
        if (searchBar) {
            searchBar.style.display = 'none';
            document.getElementById('navTreeSearchInput').value = '';
            this.tree.searchQuery = '';
            this.tree.nodes.forEach(n => n.highlighted = false);
            this.render();
        }
    }

    // 显示高级操作面板
    showAdvancedPanel() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'advancedPanelModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>⚙️ 高级操作</h2>
                    <button class="close-btn" onclick="navTree.closeModal('advancedPanelModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="advanced-panel-grid">
                        <div class="advanced-panel-section">
                            <h3>📋 批量操作</h3>
                            <button class="advanced-panel-btn" onclick="navTree.selectAll()">全选所有节点</button>
                            <button class="advanced-panel-btn" onclick="navTree.batchDelete()">批量删除</button>
                            <button class="advanced-panel-btn" onclick="navTree.batchMove()">批量移动</button>
                        </div>
                        <div class="advanced-panel-section">
                            <h3>📤 导入导出</h3>
                            <button class="advanced-panel-btn" onclick="navTree.showImportModal()">导入节点</button>
                            <button class="advanced-panel-btn" onclick="navTree.exportAll()">导出全部</button>
                        </div>
                        <div class="advanced-panel-section">
                            <h3>🔍 搜索定位</h3>
                            <button class="advanced-panel-btn" onclick="navTree.showSearchPanel()">打开搜索</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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

    // 显示导入模态框
    showImportModal(parentId = null) {
        this.hideMenu();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'importModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 600px">
                <div class="modal-header">
                    <h2>📥 导入节点</h2>
                    <button class="close-btn" onclick="navTree.closeModal('importModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>导入到</label>
                        <input type="text" value="${parentId ? this.tree.nodes.find(n => n.id === parentId)?.name : '根目录'}" disabled style="background: #f5f5f5">
                    </div>
                    <div class="form-group">
                        <label>JSON 数据</label>
                        <textarea id="importData" rows="10" placeholder='[{"name": "节点 1"}, {"name": "节点 2"}]' style="width: 100%; font-family: monospace;"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="navTree.closeModal('importModal')">取消</button>
                    <button class="btn-primary" onclick="navTree.importNodes()">导入</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('importData').focus();
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

    // 复制节点
    async duplicateNode(nodeId) {
        this.hideMenu();
        const node = this.tree.nodes.find(n => n.id === nodeId);
        const newName = prompt('请输入新节点名称:', node.name + ' (副本)');
        if (!newName) return;
        
        await this.tree.duplicateNode(nodeId, newName);
        showToast('节点已复制', 'success');
    }

    // 导出节点
    exportNode(nodeId) {
        this.hideMenu();
        const data = this.tree.exportNodes([nodeId]);
        this.downloadFile(data, `node-${nodeId}.json`);
        showToast('节点已导出', 'success');
    }

    // 导出全部
    exportAll() {
        const nodeIds = this.tree.nodes.map(n => n.id);
        const data = this.tree.exportNodes(nodeIds);
        this.downloadFile(data, 'navigation-all.json');
        this.closeModal('advancedPanelModal');
        showToast('全部节点已导出', 'success');
    }

    // 导入节点
    async importNodes() {
        const data = document.getElementById('importData').value.trim();
        if (!data) {
            showToast('请输入 JSON 数据', 'error');
            return;
        }
        
        const menu = document.getElementById('importModal');
        const parentId = menu.querySelector('input[disabled]').value === '根目录' ? null : 
            this.tree.nodes.find(n => n.name === menu.querySelector('input[disabled]').value)?.id;
        
        const success = await this.tree.importNodes(data, parentId);
        if (success) {
            this.closeModal('importModal');
            showToast('节点导入成功', 'success');
        } else {
            showToast('导入失败，请检查 JSON 格式', 'error');
        }
    }

    // 下载文件
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 全选
    selectAll() {
        this.tree.selectAll();
        this.updateFooter();
        this.render();
    }

    // 批量删除
    async batchDelete() {
        const nodeIds = this.tree.getSelectedNodeIds();
        if (nodeIds.length === 0) {
            showToast('请先选择节点', 'error');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${nodeIds.length} 个节点吗？此操作不可恢复。`)) {
            return;
        }
        
        const success = await this.tree.batchDelete(nodeIds);
        if (success) {
            this.tree.clearSelection();
            this.updateFooter();
            showToast('批量删除成功', 'success');
        } else {
            showToast('批量删除失败', 'error');
        }
    }

    // 批量移动
    async batchMove() {
        const nodeIds = this.tree.getSelectedNodeIds();
        if (nodeIds.length === 0) {
            showToast('请先选择节点', 'error');
            return;
        }
        
        // 显示目标选择
        const targetId = prompt('请输入目标父节点 ID:');
        if (!targetId) return;
        
        const success = await this.tree.batchMove(nodeIds, targetId);
        if (success) {
            this.tree.clearSelection();
            this.updateFooter();
            showToast('批量移动成功', 'success');
        } else {
            showToast('批量移动失败', 'error');
        }
    }

    // 清空选择
    clearSelection() {
        this.tree.clearSelection();
        this.updateFooter();
        this.render();
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
        selectNode: (nodeId, multiSelect = false) => {
            navTree.tree.selectNode(nodeId, multiSelect);
            navTree.renderer.render();
        },
        toggleNodeSelection: (nodeId) => {
            if (navTree.tree.selectedNodes.has(nodeId)) {
                navTree.tree.selectedNodes.delete(nodeId);
            } else {
                navTree.tree.selectedNodes.add(nodeId);
            }
            navTree.renderer.updateFooter();
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
        showImportModal: (parentId) => {
            navTree.renderer.showImportModal(parentId);
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
        duplicateNode: (nodeId) => {
            navTree.renderer.duplicateNode(nodeId);
        },
        exportNode: (nodeId) => {
            navTree.renderer.exportNode(nodeId);
        },
        exportAll: () => {
            navTree.renderer.exportAll();
        },
        importNodes: () => {
            navTree.renderer.importNodes();
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
        batchDelete: () => {
            navTree.renderer.batchDelete();
        },
        batchMove: () => {
            navTree.renderer.batchMove();
        },
        selectAll: () => {
            navTree.renderer.selectAll();
        },
        clearSelection: () => {
            navTree.renderer.clearSelection();
        },
        showSearchPanel: () => {
            navTree.renderer.showSearchPanel();
        },
        closeSearch: () => {
            navTree.renderer.closeSearch();
        },
        showAdvancedPanel: () => {
            navTree.renderer.showAdvancedPanel();
        },
        handleDragStart: (event, nodeId) => {
            navTree.renderer.handleDragStart(event, nodeId);
        },
        handleDragEnd: (event) => {
            navTree.renderer.handleDragEnd(event);
        },
        handleDragOver: (event, nodeId) => {
            navTree.renderer.handleDragOver(event, nodeId);
        },
        handleDragLeave: (event) => {
            navTree.renderer.handleDragLeave(event);
        },
        handleDrop: (event, nodeId) => {
            navTree.renderer.handleDrop(event, nodeId);
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
