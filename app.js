// app.js
// 在页面加载完成后，将侧边栏从骨架占位替换为真实导航内容。
// 设计要点：
// - 如果找不到侧边栏或 nav，什么也不做（防御性编程）
// - 保留 data-i18n 属性，便于以后做国际化替换
// - 使用简单的淡入效果，避免强动画

(function () {
  function restoreSidebar() {
    try {
      const nav = document.querySelector('.sidebar .nav');
      if (!nav) return;

      // 如果已经被替换过，直接返回
      if (nav.dataset.restored === 'true') return;

      // 先淡出（如果当前可见），再替换内容并淡入
      nav.style.transition = 'opacity 180ms ease';
      nav.style.opacity = '0';

      // 等一次帧再修改内容，保证过渡生效
      requestAnimationFrame(() => {
        // 真实导航的 HTML（保留 data-i18n 以便后续 i18n 替换）
        nav.innerHTML = `
          <a class="nav-item active" href="#" data-i18n="nav.home">主页</a>
          <a class="nav-item" href="#" data-i18n="nav.explore">探索</a>
          <a class="nav-item" href="#" data-i18n="nav.notifications">通知</a>
          <a class="nav-item" href="#" data-i18n="nav.profile">个人资料</a>
          <a class="nav-item" href="#" data-i18n="nav.create">发布</a>
        `;

        // 标记为已恢复，避免重复操作
        nav.dataset.restored = 'true';

        // 触发重绘后淡入
        requestAnimationFrame(() => {
          nav.style.opacity = '1';
        });
      });
    } catch (e) {
      // 安静失败，不抛出异常影响主线程
      console.error('restoreSidebar error', e);
    }
  }

  // 页面主脚本：在 DOMContentLoaded 时执行（app.js 在 head 被 deferred 或者在 load 时被插入）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSidebar);
  } else {
    // 已经解析完成
    restoreSidebar();
  }
})();

(function () {
  // 移动端侧边栏切换（汉堡按钮）
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  if (!hamburger || !sidebar) return;

  // 简单判断是否为移动视口
  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  // 创建遮罩
  function createBackdrop() {
    const el = document.createElement('div');
    el.className = 'sidebar-backdrop';
    el.style.position = 'fixed';
    el.style.top = 'var(--topbar-h)';
    el.style.left = '0';
    el.style.width = '100%';
    el.style.height = 'calc(100% - var(--topbar-h))';
    el.style.background = 'rgba(0,0,0,0.32)';
    el.style.zIndex = '25';
    el.style.opacity = '0';
    el.style.transition = 'opacity 220ms ease';
    el.addEventListener('click', () => closeSidebar());
    return el;
  }

  function openSidebar() {
    if (!isMobile()) return;
    // avoid reopening
    if (hamburger.getAttribute('aria-expanded') === 'true') return;

    // ensure real nav is restored before opening
    const nav = sidebar.querySelector('.nav');
    if (nav && nav.dataset.restored !== 'true') {
      // try to restore (restoreSidebar defined earlier)
      try { if (typeof restoreSidebar === 'function') restoreSidebar(); } catch (e) { /* ignore */ }
    }

    // Prepare inline styles for slide-in panel
    sidebar.style.display = 'block';
    sidebar.style.position = 'fixed';
    sidebar.style.top = 'var(--topbar-h)';
    sidebar.style.left = '0';
    sidebar.style.height = 'calc(100% - var(--topbar-h))';
    sidebar.style.width = '80%';
    sidebar.style.maxWidth = '320px';
    sidebar.style.zIndex = '30';
    sidebar.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
    sidebar.style.background = 'var(--card)';
    sidebar.style.transition = 'transform 220ms ease';
    sidebar.style.transform = 'translateX(-100%)';

    // add backdrop
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = createBackdrop();
      document.body.appendChild(backdrop);
      // force paint then show
      requestAnimationFrame(() => {
        backdrop.style.opacity = '1';
      });
    }

    // animate sidebar in
    requestAnimationFrame(() => {
      sidebar.style.transform = 'translateX(0)';
    });

    hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar(force) {
    const backdrop = document.querySelector('.sidebar-backdrop');
    // if not open, nothing to do
    if (hamburger.getAttribute('aria-expanded') !== 'true' && !force) return;

    if (backdrop) {
      backdrop.style.opacity = '0';
      // remove after transition
      backdrop.addEventListener('transitionend', function onEnd() {
        backdrop.removeEventListener('transitionend', onEnd);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      });
    }

    if (sidebar) {
      // animate out
      sidebar.style.transform = 'translateX(-100%)';
      // after animation, clear inline styles if forced or viewport now desktop
      const cleanup = () => {
        // only remove if exists
        sidebar.style.display = '';
        sidebar.style.position = '';
        sidebar.style.top = '';
        sidebar.style.left = '';
        sidebar.style.height = '';
        sidebar.style.width = '';
        sidebar.style.maxWidth = '';
        sidebar.style.zIndex = '';
        sidebar.style.boxShadow = '';
        sidebar.style.background = '';
        sidebar.style.transition = '';
        sidebar.style.transform = '';
      };
      if (force) {
        cleanup();
      } else {
        // wait for transform transition to end
        sidebar.addEventListener('transitionend', function onEnd() {
          sidebar.removeEventListener('transitionend', onEnd);
          cleanup();
        });
      }
    }

    hamburger.setAttribute('aria-expanded', 'false');
  }

  // 初始化 aria
  hamburger.setAttribute('aria-expanded', 'false');

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isMobile()) return;
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    if (expanded) closeSidebar(); else openSidebar();
  });

  // 在窗口尺寸变化到 desktop 时，确保清理残留样式和遮罩
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      closeSidebar(true);
    }
  });
})();
