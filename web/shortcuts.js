/**
 * 快捷键管理系统 - Shortcut Management System
 * 支持自定义快捷键和快捷键列表显示
 */

class ShortcutManager {
  constructor() {
    this.SHORTCUT_KEY = 'user_shortcuts';
    
    // 默认快捷键
    this.defaultShortcuts = {
      'save': { key: 's', ctrl: true, description: '保存' },
      'search': { key: 'k', ctrl: true, description: '全局搜索' },
      'new': { key: 'n', ctrl: true, description: '新建' },
      'help': { key: '/', ctrl: true, description: '快捷键列表' },
      'theme': { key: 't', ctrl: true, description: '切换主题' },
      'find': { key: 'f', ctrl: true, description: '查找' },
      'undo': { key: 'z', ctrl: true, description: '撤销' },
      'redo': { key: 'z', ctrl: true, shift: true, description: '重做' },
      'copy': { key: 'c', ctrl: true, description: '复制' },
      'paste': { key: 'v', ctrl: true, description: '粘贴' }
    };
    
    // 当前快捷键
    this.shortcuts = { ...this.defaultShortcuts };
    
    // 快捷键回调
    this.callbacks = {};
    
    // 是否显示快捷键列表
    this.showingHelp = false;
    
    // 初始化
    this.init();
  }
  
  /**
   * 初始化快捷键管理器
   */
  init() {
    this.loadShortcuts();
    this.setupEventListeners();
  }
  
  /**
   * 加载用户快捷键设置
   */
  loadShortcuts() {
    try {
      const saved = localStorage.getItem(this.SHORTCUT_KEY);
      if (saved) {
        this.shortcuts = { ...this.defaultShortcuts, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('加载快捷键设置失败:', error);
      this.shortcuts = { ...this.defaultShortcuts };
    }
  }
  
  /**
   * 保存用户快捷键设置
   */
  saveShortcuts() {
    try {
      localStorage.setItem(this.SHORTCUT_KEY, JSON.stringify(this.shortcuts));
    } catch (error) {
      console.error('保存快捷键设置失败:', error);
    }
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      // 忽略在输入框中的快捷键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        // 但允许 Ctrl+A/C/V/Z 等通用快捷键
        if (!e.ctrlKey && !e.metaKey) {
          return;
        }
      }
      
      // 检查是否匹配任何快捷键
      for (const [action, shortcut] of Object.entries(this.shortcuts)) {
        if (this.matchShortcut(e, shortcut)) {
          e.preventDefault();
          this.executeAction(action, e);
          break;
        }
      }
    });
  }
  
  /**
   * 检查键盘事件是否匹配快捷键
   * @param {KeyboardEvent} e - 键盘事件
   * @param {object} shortcut - 快捷键定义
   * @returns {boolean} 是否匹配
   */
  matchShortcut(e, shortcut) {
    const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatch = (e.ctrlKey || e.metaKey) === !!shortcut.ctrl;
    const shiftMatch = (e.shiftKey === !!shortcut.shift);
    const altMatch = (e.altKey === !!shortcut.alt);
    
    return keyMatch && ctrlMatch && shiftMatch && altMatch;
  }
  
  /**
   * 执行快捷键动作
   * @param {string} action - 动作名称
   * @param {KeyboardEvent} e - 键盘事件
   */
  executeAction(action, e) {
    // 检查是否有注册的回调
    if (this.callbacks[action]) {
      this.callbacks[action](e);
    } else {
      // 默认动作处理
      this.handleDefaultAction(action, e);
    }
  }
  
  /**
   * 处理默认动作
   * @param {string} action - 动作名称
   * @param {KeyboardEvent} e - 键盘事件
   */
  handleDefaultAction(action, e) {
    switch (action) {
      case 'help':
        this.toggleShortcutHelp();
        break;
      case 'theme':
        if (typeof themeManager !== 'undefined') {
          themeManager.toggleTheme();
        }
        break;
      case 'search':
        this.triggerGlobalSearch();
        break;
      default:
        console.log('快捷键动作:', action);
    }
  }
  
  /**
   * 触发自定义搜索
   */
  triggerGlobalSearch() {
    const event = new CustomEvent('globalSearch');
    window.dispatchEvent(event);
  }
  
  /**
   * 切换快捷键帮助显示
   */
  toggleShortcutHelp() {
    this.showingHelp = !this.showingHelp;
    
    if (this.showingHelp) {
      this.showShortcutModal();
    } else {
      this.hideShortcutModal();
    }
  }
  
  /**
   * 显示快捷键模态框
   */
  showShortcutModal() {
    // 检查是否已存在模态框
    let modal = document.getElementById('shortcut-help-modal');
    
    if (modal) {
      modal.classList.add('show');
      return;
    }
    
    // 创建模态框
    modal = document.createElement('div');
    modal.id = 'shortcut-help-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          快捷键列表
          <button onclick="shortcutManager.hideShortcutModal()" 
                  style="float: right; background: none; border: none; font-size: 20px; cursor: pointer;">
            ×
          </button>
        </div>
        <div class="modal-body">
          ${this.generateShortcutList()}
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="shortcutManager.hideShortcutModal()">关闭</button>
          <button class="btn btn-primary" onclick="shortcutManager.exportShortcuts()">导出快捷键</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击遮罩层关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideShortcutModal();
      }
    });
    
    // ESC 键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hideShortcutModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
  
  /**
   * 隐藏快捷键模态框
   */
  hideShortcutModal() {
    const modal = document.getElementById('shortcut-help-modal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
    this.showingHelp = false;
  }
  
  /**
   * 生成快捷键列表 HTML
   * @returns {string} HTML 字符串
   */
  generateShortcutList() {
    let html = '<div style="display: grid; gap: 12px;">';
    
    for (const [action, shortcut] of Object.entries(this.shortcuts)) {
      const keys = this.formatShortcutKeys(shortcut);
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-secondary); border-radius: 4px;">
          <span style="color: var(--text-primary);">${shortcut.description}</span>
          <kbd style="padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; font-family: monospace; font-size: 12px; color: var(--text-secondary);">
            ${keys}
          </kbd>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }
  
  /**
   * 格式化快捷键显示
   * @param {object} shortcut - 快捷键定义
   * @returns {string} 格式化后的快捷键字符串
   */
  formatShortcutKeys(shortcut) {
    const keys = [];
    
    if (shortcut.ctrl) keys.push('Ctrl');
    if (shortcut.shift) keys.push('Shift');
    if (shortcut.alt) keys.push('Alt');
    
    keys.push(shortcut.key.toUpperCase());
    
    return keys.join(' + ');
  }
  
  /**
   * 注册快捷键回调
   * @param {string} action - 动作名称
   * @param {function} callback - 回调函数
   */
  registerCallback(action, callback) {
    this.callbacks[action] = callback;
  }
  
  /**
   * 设置自定义快捷键
   * @param {string} action - 动作名称
   * @param {string} key - 键位
   * @param {object} modifiers - 修饰键 {ctrl, shift, alt}
   * @param {string} description - 描述
   */
  setCustomShortcut(action, key, modifiers = {}, description) {
    this.shortcuts[action] = {
      key: key.toLowerCase(),
      ctrl: !!modifiers.ctrl,
      shift: !!modifiers.shift,
      alt: !!modifiers.alt,
      description: description || action
    };
    this.saveShortcuts();
  }
  
  /**
   * 重置为默认快捷键
   */
  resetToDefaults() {
    this.shortcuts = { ...this.defaultShortcuts };
    this.saveShortcuts();
  }
  
  /**
   * 获取所有快捷键
   * @returns {object} 快捷键对象
   */
  getShortcuts() {
    return { ...this.shortcuts };
  }
  
  /**
   * 导出快捷键为 JSON
   */
  exportShortcuts() {
    const data = JSON.stringify(this.shortcuts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shortcuts.json';
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * 导入快捷键
   * @param {object} importedShortcuts - 导入的快捷键对象
   */
  importShortcuts(importedShortcuts) {
    this.shortcuts = { ...this.defaultShortcuts, ...importedShortcuts };
    this.saveShortcuts();
  }
}

// 创建全局实例
const shortcutManager = new ShortcutManager();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShortcutManager, shortcutManager };
}
