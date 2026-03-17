/**
 * 通知系统 - Notification System
 * 支持站内通知中心、未读计数、标记已读
 */

class NotificationManager {
  constructor() {
    this.NOTIFICATIONS_KEY = 'user_notifications';
    this.UNREAD_KEY = 'user_notifications_unread';
    
    // 通知列表
    this.notifications = [];
    
    // 未读通知 IDs
    this.unreadIds = new Set();
    
    // 通知中心元素
    this.notificationCenter = null;
    this.badgeElement = null;
    
    // 轮询间隔（毫秒）
    this.pollInterval = 30000; // 30 秒
    this.pollTimer = null;
    
    // 初始化
    this.init();
  }
  
  /**
   * 初始化通知管理器
   */
  async init() {
    this.loadNotifications();
    this.createNotificationCenter();
    this.setupEventListeners();
    this.startPolling();
    
    // 从服务器加载最新通知
    await this.loadFromServer();
  }
  
  /**
   * 加载本地通知
   */
  loadNotifications() {
    try {
      const saved = localStorage.getItem(this.NOTIFICATIONS_KEY);
      if (saved) {
        this.notifications = JSON.parse(saved);
      }
      
      const unreadSaved = localStorage.getItem(this.UNREAD_KEY);
      if (unreadSaved) {
        this.unreadIds = new Set(JSON.parse(unreadSaved));
      }
    } catch (error) {
      console.error('加载通知失败:', error);
      this.notifications = [];
      this.unreadIds = new Set();
    }
  }
  
  /**
   * 保存本地通知
   */
  saveNotifications() {
    try {
      localStorage.setItem(this.NOTIFICATIONS_KEY, JSON.stringify(this.notifications));
      localStorage.setItem(this.UNREAD_KEY, JSON.stringify([...this.unreadIds]));
      this.updateBadge();
    } catch (error) {
      console.error('保存通知失败:', error);
    }
  }
  
  /**
   * 从服务器加载通知
   */
  async loadFromServer() {
    try {
      const response = await fetch('/api/notifications');
      
      if (response.ok) {
        const data = await response.json();
        
        // 合并服务器通知
        if (data.notifications && Array.isArray(data.notifications)) {
          this.notifications = data.notifications;
          
          // 标记未读
          this.unreadIds = new Set(
            data.notifications.filter(n => !n.read).map(n => n.id)
          );
          
          this.saveNotifications();
          this.renderNotifications();
        }
      }
    } catch (error) {
      console.warn('从服务器加载通知失败:', error);
    }
  }
  
  /**
   * 创建通知中心 UI
   */
  createNotificationCenter() {
    // 检查是否已存在
    if (document.getElementById('notification-center')) {
      return;
    }
    
    // 创建通知铃铛按钮
    const bellButton = document.createElement('button');
    bellButton.id = 'notification-bell';
    bellButton.className = 'btn';
    bellButton.style.cssText = 'position: relative; background: none; border: none; font-size: 20px; cursor: pointer; padding: 8px;';
    bellButton.innerHTML = `
      <span style="color: var(--text-secondary);">🔔</span>
      <span id="notification-badge" class="badge" style="position: absolute; top: 0; right: 0; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; border-radius: 8px; display: none;">0</span>
    `;
    bellButton.onclick = () => this.toggle();
    
    // 添加到导航栏或指定位置
    const navBar = document.querySelector('.navbar') || document.querySelector('header') || document.body;
    navBar.appendChild(bellButton);
    
    this.badgeElement = document.getElementById('notification-badge');
    
    // 创建通知中心面板
    const center = document.createElement('div');
    center.id = 'notification-center';
    center.className = 'notification-center';
    center.innerHTML = `
      <div class="notification-header">
        <span class="notification-title">通知</span>
        <div class="notification-actions">
          <button class="btn" onclick="notificationManager.markAllAsRead()" style="padding: 4px 8px; font-size: 12px;">全部已读</button>
          <button class="btn" onclick="notificationManager.clearAll()" style="padding: 4px 8px; font-size: 12px;">清空</button>
          <button class="btn" onclick="notificationManager.toggle()" style="padding: 4px 8px; font-size: 12px;">×</button>
        </div>
      </div>
      <div class="notification-list" id="notification-list">
        <!-- 通知列表将在这里渲染 -->
      </div>
    `;
    
    document.body.appendChild(center);
    this.notificationCenter = center;
    
    // 初始更新徽章
    this.updateBadge();
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 点击外部关闭通知中心
    document.addEventListener('click', (e) => {
      if (this.notificationCenter && 
          this.notificationCenter.classList.contains('show') &&
          !this.notificationCenter.contains(e.target) &&
          e.target.id !== 'notification-bell') {
        this.hide();
      }
    });
    
    // 监听自定义通知事件
    window.addEventListener('notification', (e) => {
      if (e.detail) {
        this.add(e.detail);
      }
    });
  }
  
  /**
   * 开始轮询服务器
   */
  startPolling() {
    this.stopPolling();
    
    this.pollTimer = setInterval(() => {
      this.loadFromServer();
    }, this.pollInterval);
  }
  
  /**
   * 停止轮询
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  
  /**
   * 切换通知中心显示
   */
  toggle() {
    if (this.notificationCenter) {
      this.notificationCenter.classList.toggle('show');
      
      if (this.notificationCenter.classList.contains('show')) {
        this.renderNotifications();
      }
    }
  }
  
  /**
   * 显示通知中心
   */
  show() {
    if (this.notificationCenter) {
      this.notificationCenter.classList.add('show');
      this.renderNotifications();
    }
  }
  
  /**
   * 隐藏通知中心
   */
  hide() {
    if (this.notificationCenter) {
      this.notificationCenter.classList.remove('show');
    }
  }
  
  /**
   * 添加通知
   * @param {object} notification - 通知对象
   */
  add(notification) {
    const id = notification.id || `notif_${Date.now()}`;
    
    const newNotification = {
      id,
      title: notification.title || '新通知',
      content: notification.content || '',
      type: notification.type || 'info', // info, success, warning, error
      time: notification.time || new Date().toISOString(),
      read: false,
      ...notification
    };
    
    // 添加到列表开头
    this.notifications.unshift(newNotification);
    
    // 标记为未读
    if (!notification.read) {
      this.unreadIds.add(id);
    }
    
    // 限制通知数量
    if (this.notifications.length > 100) {
      this.notifications.pop();
    }
    
    this.saveNotifications();
    
    // 如果通知中心打开，重新渲染
    if (this.notificationCenter && this.notificationCenter.classList.contains('show')) {
      this.renderNotifications();
    }
    
    // 显示桌面通知（如果权限允许）
    this.showDesktopNotification(newNotification);
    
    return newNotification;
  }
  
  /**
   * 显示桌面通知
   * @param {object} notification - 通知对象
   */
  showDesktopNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.content,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }
  }
  
  /**
   * 请求桌面通知权限
   */
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }
  
  /**
   * 标记通知为已读
   * @param {string} id - 通知 ID
   */
  async markAsRead(id) {
    try {
      // 发送到服务器
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT'
      });
    } catch (error) {
      console.warn('同步到服务器失败:', error);
    }
    
    // 本地更新
    this.unreadIds.delete(id);
    
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
    
    this.saveNotifications();
    this.renderNotifications();
  }
  
  /**
   * 标记所有通知为已读
   */
  async markAllAsRead() {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT'
      });
    } catch (error) {
      console.warn('同步到服务器失败:', error);
    }
    
    // 本地更新
    this.unreadIds.clear();
    this.notifications.forEach(n => n.read = true);
    
    this.saveNotifications();
    this.renderNotifications();
    this.hide();
  }
  
  /**
   * 删除通知
   * @param {string} id - 通知 ID
   */
  remove(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.unreadIds.delete(id);
    
    this.saveNotifications();
    this.renderNotifications();
  }
  
  /**
   * 清空所有通知
   */
  clearAll() {
    this.notifications = [];
    this.unreadIds.clear();
    
    this.saveNotifications();
    this.renderNotifications();
  }
  
  /**
   * 更新未读徽章
   */
  updateBadge() {
    if (this.badgeElement) {
      const count = this.unreadIds.size;
      
      if (count > 0) {
        this.badgeElement.textContent = count > 99 ? '99+' : count;
        this.badgeElement.style.display = 'inline-flex';
      } else {
        this.badgeElement.style.display = 'none';
      }
    }
  }
  
  /**
   * 渲染通知列表
   */
  renderNotifications() {
    const list = document.getElementById('notification-list');
    if (!list) return;
    
    if (this.notifications.length === 0) {
      list.innerHTML = `
        <div style="padding: 48px 24px; text-align: center; color: var(--text-tertiary);">
          <div style="font-size: 48px; margin-bottom: 16px;">🔔</div>
          <div>暂无通知</div>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    this.notifications.forEach(notification => {
      const time = this.formatTime(notification.time);
      const typeClass = `notification-type-${notification.type || 'info'}`;
      
      html += `
        <div class="notification-item ${notification.read ? '' : 'unread'}" 
             onclick="notificationManager.handleNotificationClick('${notification.id}')">
          <div class="notification-item-title">
            ${notification.title}
            ${!notification.read ? '<span class="badge" style="float: right; min-width: 8px; height: 8px; padding: 0; border-radius: 4px;"></span>' : ''}
          </div>
          <div class="notification-item-content">${notification.content || ''}</div>
          <div class="notification-item-time">${time}</div>
        </div>
      `;
    });
    
    list.innerHTML = html;
  }
  
  /**
   * 处理通知点击
   * @param {string} id - 通知 ID
   */
  handleNotificationClick(id) {
    this.markAsRead(id);
    
    // 触发自定义事件
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      const event = new CustomEvent('notificationClick', { detail: notification });
      window.dispatchEvent(event);
    }
  }
  
  /**
   * 格式化时间
   * @param {string} timeStr - 时间字符串
   * @returns {string} 格式化后的时间
   */
  formatTime(timeStr) {
    const time = new Date(timeStr);
    const now = new Date();
    const diff = now - time;
    
    // 小于 1 分钟
    if (diff < 60000) {
      return '刚刚';
    }
    
    // 小于 1 小时
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    }
    
    // 小于 24 小时
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    }
    
    // 小于 7 天
    if (diff < 604800000) {
      return `${Math.floor(diff / 86400000)}天前`;
    }
    
    // 显示日期
    return time.toLocaleDateString('zh-CN');
  }
  
  /**
   * 获取未读通知数量
   * @returns {number} 未读数量
   */
  getUnreadCount() {
    return this.unreadIds.size;
  }
  
  /**
   * 获取所有通知
   * @returns {array} 通知数组
   */
  getNotifications() {
    return [...this.notifications];
  }
  
  /**
   * 获取未读通知
   * @returns {array} 未读通知数组
   */
  getUnreadNotifications() {
    return this.notifications.filter(n => this.unreadIds.has(n.id));
  }
  
  /**
   * 设置通知设置
   * @param {object} settings - 设置对象
   */
  async updateSettings(settings) {
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notifications: settings
        })
      });
    } catch (error) {
      console.warn('更新通知设置失败:', error);
    }
  }
}

// 创建全局实例
const notificationManager = new NotificationManager();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotificationManager, notificationManager };
}
