/**
 * 移动端交互脚本
 * 功能:
 * - 触摸手势支持 (滑动、双击、捏合、长按)
 * - 移动端导航 (汉堡菜单)
 * - 下拉刷新
 * - PWA 支持
 * - 移动分享
 * - 响应式交互优化
 */

(function() {
  'use strict';

  // ========================================
  // 配置常量
  // ========================================
  const CONFIG = {
    LONG_PRESS_DURATION: 500, // 长按持续时间 (ms)
    SWIPE_THRESHOLD: 50, // 滑动阈值 (px)
    DOUBLE_TAP_INTERVAL: 300, // 双击间隔 (ms)
    PINCH_MIN_DISTANCE: 20, // 捏合最小距离 (px)
    PULL_REFRESH_THRESHOLD: 100, // 下拉刷新阈值 (px)
    TOUCH_TARGET_MIN: 44 // 最小触摸目标尺寸 (px)
  };

  // ========================================
  // 状态管理
  // ========================================
  const state = {
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    currentScale: 1,
    isLongPress: false,
    longPressTimer: null,
    isPulling: false,
    pullStartY: 0,
    currentPullDistance: 0,
    isOffline: !navigator.onLine,
    sidebarOpen: false
  };

  // ========================================
  // 工具函数
  // ========================================
  
  /**
   * 获取两点之间的距离
   */
  function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 获取触摸点中心
   */
  function getCenter(touch1, touch2) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }

  /**
   * 防止默认行为
   */
  function preventDefault(e) {
    if (e.cancelable) {
      e.preventDefault();
    }
  }

  /**
   * 触发事件
   */
  function triggerEvent(element, eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail
    });
    element.dispatchEvent(event);
  }

  /**
   * 检查元素是否可交互
   */
  function isInteractiveElement(element) {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'];
    return interactiveTags.includes(element.tagName) || 
           element.closest('button') || 
           element.closest('a') ||
           element.getAttribute('role') === 'button';
  }

  // ========================================
  // 汉堡菜单
  // ========================================
  
  function initHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (!hamburger) return;

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    if (overlay) {
      overlay.addEventListener('click', toggleSidebar);
    }

    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (state.sidebarOpen && 
          !sidebar.contains(e.target) && 
          !hamburger.contains(e.target)) {
        toggleSidebar(false);
      }
    });
  }

  function toggleSidebar(force) {
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger-menu');

    if (!sidebar) return;

    state.sidebarOpen = force !== undefined ? force : !state.sidebarOpen;

    sidebar.classList.toggle('active', state.sidebarOpen);
    
    if (overlay) {
      overlay.classList.toggle('active', state.sidebarOpen);
    }

    if (hamburger) {
      hamburger.classList.toggle('active', state.sidebarOpen);
    }

    // 防止背景滚动
    document.body.style.overflow = state.sidebarOpen ? 'hidden' : '';
  }

  // ========================================
  // 触摸手势 - 滑动
  // ========================================
  
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      state.touchStartX = touch.clientX;
      state.touchStartY = touch.clientY;
      state.touchStartTime = Date.now();
      
      // 检测下拉刷新
      if (window.scrollY === 0 && e.target.closest('.pull-refresh-enabled')) {
        state.isPulling = true;
        state.pullStartY = touch.clientY;
      }

      // 长按检测
      if (!isInteractiveElement(e.target)) {
        state.longPressTimer = setTimeout(() => {
          state.isLongPress = true;
          showLongPressMenu(e.target, touch.clientX, touch.clientY);
        }, CONFIG.LONG_PRESS_DURATION);
      }
    } else if (e.touches.length === 2) {
      // 捏合手势开始
      state.pinchStartDistance = getDistance(e.touches[0], e.touches[1]);
      state.pinchStartScale = state.currentScale;
      clearTimeout(state.longPressTimer);
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - state.touchStartX;
      const deltaY = touch.clientY - state.touchStartY;
      const timeElapsed = Date.now() - state.touchStartTime;

      // 下拉刷新
      if (state.isPulling && deltaY > 0) {
        preventDefault(e);
        state.currentPullDistance = Math.min(deltaY, CONFIG.PULL_REFRESH_THRESHOLD * 2);
        updatePullRefreshIndicator(state.currentPullDistance);
      }

      // 取消长按
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        clearTimeout(state.longPressTimer);
        state.isLongPress = false;
        hideLongPressMenu();
      }

      // 水平滑动
      if (Math.abs(deltaX) > CONFIG.SWIPE_THRESHOLD && timeElapsed < 300) {
        if (deltaX > 0) {
          triggerEvent(document, 'swiperight', { 
            distance: deltaX, 
            duration: timeElapsed 
          });
        } else {
          triggerEvent(document, 'swipeleft', { 
            distance: Math.abs(deltaX), 
            duration: timeElapsed 
          });
        }
      }

      // 垂直滑动
      if (Math.abs(deltaY) > CONFIG.SWIPE_THRESHOLD && timeElapsed < 300) {
        if (deltaY > 0) {
          triggerEvent(document, 'swipedown', { 
            distance: deltaY, 
            duration: timeElapsed 
          });
        } else {
          triggerEvent(document, 'swipeup', { 
            distance: Math.abs(deltaY), 
            duration: timeElapsed 
          });
        }
      }

      state.lastTapX = touch.clientX;
      state.lastTapY = touch.clientY;
      
    } else if (e.touches.length === 2) {
      // 捏合缩放
      preventDefault(e);
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / state.pinchStartDistance;
      state.currentScale = state.pinchStartScale * scale;
      
      triggerEvent(document, 'pinch', {
        scale: state.currentScale,
        center: getCenter(e.touches[0], e.touches[1])
      });
    }
  }

  function handleTouchEnd(e) {
    clearTimeout(state.longPressTimer);
    
    // 下拉刷新释放
    if (state.isPulling) {
      if (state.currentPullDistance > CONFIG.PULL_REFRESH_THRESHOLD) {
        triggerEvent(document, 'pullrefresh');
      }
      hidePullRefreshIndicator();
      state.isPulling = false;
      state.currentPullDistance = 0;
    }

    // 长按结束
    if (state.isLongPress) {
      state.isLongPress = false;
    }

    // 双击检测
    const touch = e.changedTouches[0];
    const currentTime = Date.now();
    const timeDiff = currentTime - state.lastTapTime;
    const distance = Math.sqrt(
      Math.pow(touch.clientX - state.lastTapX, 2) + 
      Math.pow(touch.clientY - state.lastTapY, 2)
    );

    if (timeDiff < CONFIG.DOUBLE_TAP_INTERVAL && distance < 50) {
      triggerEvent(document, 'doubletap', {
        x: touch.clientX,
        y: touch.clientY
      });
      state.lastTapTime = 0;
    } else {
      state.lastTapTime = currentTime;
      state.lastTapX = touch.clientX;
      state.lastTapY = touch.clientY;
    }
  }

  // ========================================
  // 长按菜单
  // ========================================
  
  function showLongPressMenu(target, x, y) {
    hideLongPressMenu();

    const menu = document.createElement('div');
    menu.className = 'long-press-menu';
    menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';

    // 默认菜单项
    const items = [
      { text: '分享', action: 'share' },
      { text: '复制', action: 'copy' },
      { text: '更多', action: 'more' }
    ];

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'long-press-menu-item';
      div.textContent = item.text;
      div.addEventListener('click', () => {
        triggerEvent(document, 'longpressaction', {
          action: item.action,
          target: target
        });
        hideLongPressMenu();
      });
      menu.appendChild(div);
    });

    document.body.appendChild(menu);
    menu.style.display = 'block';
  }

  function hideLongPressMenu() {
    const menu = document.querySelector('.long-press-menu');
    if (menu) {
      menu.remove();
    }
  }

  // ========================================
  // 下拉刷新
  // ========================================
  
  function initPullToRefresh() {
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.innerHTML = `
      <div class="loading-spinner"></div>
      <span style="margin-left: 12px;">正在刷新...</span>
    `;
    document.body.appendChild(indicator);
  }

  function updatePullRefreshIndicator(distance) {
    const indicator = document.querySelector('.pull-to-refresh');
    if (!indicator) return;

    const progress = Math.min(distance / CONFIG.PULL_REFRESH_THRESHOLD, 1);
    indicator.style.transform = `translateY(${-(1 - progress) * 100}%)`;
    indicator.style.opacity = progress;
  }

  function hidePullRefreshIndicator() {
    const indicator = document.querySelector('.pull-to-refresh');
    if (!indicator) return;

    indicator.style.transform = 'translateY(-100%)';
    indicator.style.opacity = '0';
  }

  // ========================================
  // 双击放大
  // ========================================
  
  function initDoubleTapZoom() {
    document.addEventListener('doubletap', (e) => {
      const { x, y } = e.detail;
      
      // 创建视觉反馈
      const feedback = document.createElement('div');
      feedback.className = 'zoom-feedback';
      feedback.style.left = x + 'px';
      feedback.style.top = y + 'px';
      document.body.appendChild(feedback);

      setTimeout(() => feedback.remove(), 600);

      // 切换缩放
      if (state.currentScale === 1) {
        state.currentScale = 2;
        document.body.style.transform = 'scale(2)';
        document.body.style.transformOrigin = `${x}px ${y}px`;
      } else {
        state.currentScale = 1;
        document.body.style.transform = '';
        document.body.style.transformOrigin = '';
      }

      triggerEvent(document, 'zoomchange', { scale: state.currentScale });
    });
  }

  // ========================================
  // 捏合缩放
  // ========================================
  
  function initPinchZoom() {
    document.addEventListener('pinch', (e) => {
      const { scale, center } = e.detail;
      
      if (scale < 0.5 || scale > 3) return;

      document.body.style.transform = `scale(${scale})`;
      document.body.style.transformOrigin = `${center.x}px ${center.y}px`;
    });

    document.addEventListener('touchend', () => {
      if (state.currentScale < 0.8) {
        state.currentScale = 1;
        document.body.style.transform = '';
      }
    });
  }

  // ========================================
  // PWA 支持
  // ========================================
  
  function initPWA() {
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker 注册成功:', registration.scope);
        })
        .catch(error => {
          console.log('Service Worker 注册失败:', error);
        });
    }

    // 网络状态监听
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // 显示离线指示器
    showOfflineIndicator(state.isOffline);

    // 添加到主屏幕提示
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallPrompt();
    });
  }

  function updateOnlineStatus() {
    state.isOffline = !navigator.onLine;
    showOfflineIndicator(state.isOffline);
    triggerEvent(document, 'networkchange', { online: navigator.onLine });
  }

  function showOfflineIndicator(isOffline) {
    let indicator = document.querySelector('.offline-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'offline-indicator';
      indicator.innerHTML = `
        <span class="offline-status"></span>
        <span>当前处于离线模式</span>
      `;
      document.body.appendChild(indicator);
    }

    indicator.classList.toggle('active', isOffline);
    
    const statusDot = indicator.querySelector('.offline-status, .online-status');
    if (statusDot) {
      statusDot.className = isOffline ? 'offline-status' : 'online-status';
      statusDot.nextElementSibling.textContent = isOffline ? 
        '当前处于离线模式' : '已连接到网络';
    }
  }

  function showInstallPrompt() {
    // 显示安装提示 UI
    const prompt = document.createElement('div');
    prompt.className = 'install-prompt';
    prompt.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      z-index: 3000;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    prompt.innerHTML = `
      <span>📱 添加到主屏幕以获得更好体验</span>
      <button class="btn-install" style="
        background: #667eea;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
      ">安装</button>
      <button class="btn-dismiss" style="
        background: transparent;
        color: #666;
        border: 1px solid #ddd;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
      ">稍后</button>
    `;

    document.body.appendChild(prompt);

    prompt.querySelector('.btn-install').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('用户选择:', outcome);
        deferredPrompt = null;
      }
      prompt.remove();
    });

    prompt.querySelector('.btn-dismiss').addEventListener('click', () => {
      prompt.remove();
    });

    // 5 秒后自动隐藏
    setTimeout(() => prompt.remove(), 5000);
  }

  // ========================================
  // 移动分享
  // ========================================
  
  function initMobileShare() {
    document.addEventListener('longpressaction', async (e) => {
      if (e.detail.action === 'share' && navigator.share) {
        try {
          await navigator.share({
            title: document.title,
            text: '来看看这个！',
            url: window.location.href
          });
        } catch (err) {
          console.log('分享取消:', err);
        }
      }
    });

    // 添加分享按钮
    const shareButton = document.querySelector('.share-btn');
    if (shareButton && navigator.share) {
      shareButton.style.display = 'block';
      shareButton.addEventListener('click', async () => {
        try {
          await navigator.share({
            title: document.title,
            text: document.querySelector('meta[name="description"]')?.content || '来看看这个！',
            url: window.location.href
          });
        } catch (err) {
          console.log('分享取消:', err);
        }
      });
    }
  }

  // ========================================
  // 触摸友好按钮尺寸
  // ========================================
  
  function ensureTouchTargetSize() {
    const interactiveElements = document.querySelectorAll(
      'button, .btn, a, [role="button"], input[type="submit"]'
    );

    interactiveElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      
      if (rect.width < CONFIG.TOUCH_TARGET_MIN || 
          rect.height < CONFIG.TOUCH_TARGET_MIN) {
        el.style.minWidth = CONFIG.TOUCH_TARGET_MIN + 'px';
        el.style.minHeight = CONFIG.TOUCH_TARGET_MIN + 'px';
        el.style.display = 'inline-flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
      }

      // 添加触摸反馈类
      if (!el.classList.contains('touch-feedback')) {
        el.classList.add('touch-feedback');
      }
    });
  }

  // ========================================
  // 移动端表格优化
  // ========================================
  
  function optimizeTablesForMobile() {
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      if (!table.closest('.table-container')) {
        const container = document.createElement('div');
        container.className = 'table-container';
        table.parentNode.insertBefore(container, table);
        container.appendChild(table);
      }

      // 添加卡片视图切换
      if (window.innerWidth < 768) {
        table.classList.add('mobile-table');
      }
    });
  }

  // ========================================
  // 移动端表单优化
  // ========================================
  
  function optimizeFormsForMobile() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="password"], ' +
      'input[type="number"], textarea, select'
    );

    inputs.forEach(input => {
      // 防止 iOS 缩放
      input.style.fontSize = '16px';
      
      // 确保触摸目标尺寸
      input.style.minHeight = CONFIG.TOUCH_TARGET_MIN + 'px';
    });

    // 自动聚焦时滚动到视野
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    });
  }

  // ========================================
  // 滑动切换页面
  // ========================================
  
  function initSwipeNavigation() {
    document.addEventListener('swiperight', () => {
      // 如果有上一页，导航回去
      if (window.history.length > 1) {
        triggerEvent(document, 'swipeback');
      }
    });

    document.addEventListener('swipeleft', () => {
      // 可以导航到下一页
      triggerEvent(document, 'swipeforward');
    });
  }

  // ========================================
  // 初始化
  // ========================================
  
  function init() {
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    console.log('🦞 移动端模块初始化');

    // 基础触摸事件
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    // 初始化各功能模块
    initHamburgerMenu();
    initPullToRefresh();
    initDoubleTapZoom();
    initPinchZoom();
    initPWA();
    initMobileShare();
    initSwipeNavigation();

    // 优化 UI 组件
    ensureTouchTargetSize();
    optimizeTablesForMobile();
    optimizeFormsForMobile();

    // 窗口大小改变时重新优化
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ensureTouchTargetSize();
        optimizeTablesForMobile();
      }, 250);
    });

    // 触发初始化完成事件
    triggerEvent(document, 'mobileinit', {
      isMobile: window.innerWidth < 768,
      isTablet: window.innerWidth >= 768 && window.innerWidth <= 1024,
      isDesktop: window.innerWidth > 1024
    });
  }

  // 启动
  init();

  // 导出 API
  window.MobileUtils = {
    toggleSidebar,
    showOfflineIndicator,
    triggerEvent,
    CONFIG,
    state
  };

})();
