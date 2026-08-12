/* ================= 启动 ================= */
(function () {
  'use strict';

  /* 隐私提醒 */
  window.showPrivacy = function (manual) {
    var body = '<div class="privacy">' +
      '<p>这是一个<b>纯本地优先</b>的个人工作台：默认没有服务器、没有账号，任何数据都不会主动上传。</p>' +
      '<ul>' +
      '<li>📦 <span><b>存在哪里：</b>你录入的全部内容都保存在本设备浏览器的本地存储（localStorage）中，刷新、关闭页面都不会丢失。</span></li>' +
      '<li>🔒 <span><b>谁能看到：</b>默认只有本设备浏览器能读取。只有当你在「⚙️ 设置」主动开启自动备份并填写了 NAS / GitHub 后，数据才会按你的配置上传到这些指定位置；相关账号密码只存在本机，不会被任何人获取。</span></li>' +
      '<li>⚠️ <span><b>什么情况会丢：</b>清理浏览器缓存/网站数据、卸载浏览器、使用无痕模式、更换设备。</span></li>' +
      '<li>💾 <span><b>建议：</b>在「⚙️ 设置 → 数据备份」开启自动备份（WebDAV / GitHub Gist），或定期导出一份 JSON 留底，换设备时一键导入。</span></li>' +
      '</ul></div>';
    var el = UI.sheet('🔒 使用前请先了解', body,
      '<button class="btn primary tap" data-ok style="flex:1">' + (manual ? '知道了' : '我已了解，开始使用') + '</button>');
    el.querySelector('[data-ok]').onclick = function () {
      el.remove(); UI.unlock();
      if (!manual) { Store.data.settings.privacy = true; Store.save(true); }
    };
  };

  function start() {
    Store.load();

    // 主题（auto=跟随系统 / light / dark）
    (function () {
      var th = (Store.data.settings && Store.data.settings.theme) || 'auto';
      var de = document.documentElement;
      if (th === 'dark') de.setAttribute('data-theme', 'dark');
      else if (th === 'light') de.setAttribute('data-theme', 'light');
      else de.removeAttribute('data-theme');
      var tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', (th === 'light') ? '#FDFCF4' : '#16130E');
    })();

    // 应用全局字体大小设置
    if (window.UI && UI.applyFont) UI.applyFont(Store.data.settings.fontScale || 1.15);

    // 清理已移除的 AI 助手遗留的本地数据
    try { localStorage.removeItem('workbench.ai.chat'); } catch (e) {}


    // 顶部日期
    var d = new Date();
    var bd = document.getElementById('brandDate');
    if (bd) bd.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + '日一二三四五六'[d.getDay()];

    App.renderNav();

    // 顶部品牌点击 → 进入首页总览
    var brand = document.querySelector('.brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.onclick = function () { App.go('home'); };
    }

    var hash = location.hash.replace('#', '');
    App.go(hash && App.modules[hash] ? hash : 'home', true);

    window.addEventListener('hashchange', function () {
      var h = location.hash.replace('#', '');
      if (h && App.modules[h] && h !== App.current) App.go(h, true);
    });

    // 侧边栏开关
    var menu = document.getElementById('menuBtn'), scrim = document.getElementById('scrim');
    menu.onclick = function () { document.body.classList.toggle('nav-open'); };
    scrim.onclick = function () { document.body.classList.remove('nav-open'); };
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.body.classList.remove('nav-open');
    });

    // 侧栏模块过滤
    var navSearch = document.getElementById('navSearch');
    if (navSearch) navSearch.addEventListener('input', function () { App.filterNav(navSearch.value); });

    // 存储不可用提示
    if (!Store.ok) U.toast('浏览器本地存储不可用，数据将无法保存');

    // 首次隐私提醒
    if (!Store.data.settings.privacy) setTimeout(function () { window.showPrivacy(false); }, 380);

    // 自动备份（设置页启用后：启动备份一次 + 每小时定时）
    if (window.Backup) window.Backup.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
