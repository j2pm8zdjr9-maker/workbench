/* ================= 核心：存储 / 路由 / 工具 ================= */
(function (w) {
  'use strict';

  var KEY = 'workbench.v1';

  /* ---------- 默认数据结构 ---------- */
  function defaults() {
    return {
      checkin: { habits: [], log: {} },
      media: [],
      exam: { exams: [], plans: [], records: [], notes: [] },
      examSubject: ['政治', '英语', '数学', '专业课'],
      examContent: ['刷题', '背诵', '听课', '复盘', '模拟考'],
      body: { measures: [], waterGoal: 2000, water: {}, waterLog: {}, waterPresets: [150, 200, 250, 300, 350, 500], sports: [], meals: [], bmr: 0 },
      vehicles: {
        ev: { battery: 45, price: 0.3353, serviceMile: 0, serviceDate: '', charges: [] },
        fuel: { serviceMile: 0, serviceDate: '', refuels: [] }
      },
      items: { stock: [], buy: [], consum: [] },
      finance: { accounts: [], flows: [], goals: [], catExpense: ['餐饮', '交通', '购物', '居家', '娱乐', '医疗', '学习', '人情'], catIncome: ['工资', '奖金', '理财收益', '兼职', '红包'] },
      anniv: [],
      social: [],
      wish: [],
      family: [],
      tasks: [],
      worklog: [],
      workCats: ['需求沟通', '方案设计', '执行落地', '会议', '复盘总结', '学习调研', '临时事务'],
      diary: { entries: [], password: '' },
      diaryTags: ['工作感悟', '生活随笔', '复盘', '烦心事', '随想'],
      wishCats: ['旅行目的地', '人生梦想', '想要实现的目标', '计划体验的事'],
      itemCats: ['护肤品', '日用品', '食材', '药品', '其他'],
      taskTags: ['工作', '生活', '学习', '健康', '其他'],
      annivTypes: ['生日', '纪念日', '节日', '重要节点'],
      socialCats: ['亲戚', '朋友', '同事', '同学', '合作伙伴', '其他'],
      cat: { pets: [], deworm: [], vaccine: [], food: [], litter: [] },
      settings: { privacy: false, nick: '', created: '', fontScale: 1.15 },
      ui: { last: 'checkin', tabs: {}, timefilter: {}, catPin: 3 }
    };
  }

  /* ---------- 深合并（补齐新增字段） ---------- */
  function merge(base, patch) {
    if (patch === null || patch === undefined) return base;
    if (Object.prototype.toString.call(base) !== '[object Object]') return patch;
    if (Object.prototype.toString.call(patch) !== '[object Object]') return patch;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = merge(base[k], patch[k]); });
    Object.keys(patch).forEach(function (k) { if (!(k in out)) out[k] = patch[k]; });
    return out;
  }

  /* ---------- IndexedDB 兜底镜像（应对部分移动端 webview 退出即清空 localStorage） ---------- */
  var IDB = (function () {
    var DB = 'workbench_kv', STORE = 'kv', VER = 1, dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (resolve, reject) {
        if (!w.indexedDB) { reject('no-idb'); return; }
        try {
          var r = w.indexedDB.open(DB, VER);
          r.onupgradeneeded = function () { try { r.result.createObjectStore(STORE); } catch (e) {} };
          r.onsuccess = function () { resolve(r.result); };
          r.onerror = function () { reject(r.error || 'idb-error'); };
        } catch (e) { reject(e); }
      });
      return dbp;
    }
    function put(k, v) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(v, k);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      }).catch(function () {});
    }
    function get(k) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readonly');
          var rq = tx.objectStore(STORE).get(k);
          rq.onsuccess = function () { resolve(rq.result); };
          rq.onerror = function () { reject(rq.error); };
        });
      }).catch(function () { return undefined; });
    }
    return { put: put, get: get };
  })();

  /* ---------- Store ---------- */
  var Store = {
    data: defaults(),
    ok: true,
    load: function () {
      Store._loaded = true;
      var hadLS = false;
      try { hadLS = !!localStorage.getItem(KEY); } catch (e) {}
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          this.data = merge(defaults(), JSON.parse(raw));
          if (!this.data.settings.created) this.data.settings.created = today();
        } else {
          this.data = defaults();
        }
      } catch (e) {
        this.ok = false; this.data = defaults();
        console.warn('本地存储读取失败', e);
      }
      // 字体基线升级：历史默认 1.0 → 1.15（仅一次性，不覆盖用户后续手动调整）
      try {
        if (!this.data.settings._fsMigrated) {
          this.data.settings.fontScale = 1.15;
          this.data.settings._fsMigrated = true;
          localStorage.setItem(KEY, JSON.stringify(this.data));
        }
      } catch (e) {}
      // 任务「未完成(archive)」功能下线、与「逾期」合并：历史 archive 任务迁回待办（仅一次性）
      try {
        if (!this.data.settings._archiveMigrated) {
          (this.data.tasks || []).forEach(function (x) { if (x.status === 'archive') { x.status = 'todo'; delete x.doneAt; } });
          this.data.settings._archiveMigrated = true;
          localStorage.setItem(KEY, JSON.stringify(this.data));
        }
      } catch (e) {}
      // 兜底：若「加载时」本机 localStorage 为空（或被 webview 清空），尝试用 IndexedDB 镜像恢复
      try {
        Store._restoring = true;
        IDB.get(KEY).then(function (fallback) {
          if (!fallback || typeof fallback !== 'object') { Store._restoring = false; return; }
          if (hadLS) { Store._restoring = false; return; }
          try {
            localStorage.setItem(KEY, JSON.stringify(fallback));
            Store.data = merge(defaults(), fallback);
            if (!Store.data.settings.created) Store.data.settings.created = today();
            Store._restoring = false;
            if (App && App.refresh) App.refresh();
            if (U && U.toast) U.toast('已从本地备份恢复数据');
          } catch (e) { Store._restoring = false; }
        }).catch(function () { Store._restoring = false; });
      } catch (e) { Store._restoring = false; }
      return this.data;
    },
    save: function (silent) {
      // 模块注册阶段（TF.def 等）早于 Store.load() 执行；此时 Store.data 仍是空 defaults，
      // 若写盘会覆盖掉已持久化的真实数据（“数据没了”）。故 load 完成前禁止写盘。
      if (!Store._loaded) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        this.ok = true;
        if (!silent) flashSaved();
      } catch (e) {
        this.ok = false;
        flashSaveError();
        toast('保存失败：' + (e && e.name === 'QuotaExceededError' ? '浏览器存储空间不足' : '存储可能被禁用'));
      }
      try { if (!Store._restoring) IDB.put(KEY, this.data); } catch (e) {}
      if (w.Backup) w.Backup.schedule();
    },
    reset: function () { this.data = defaults(); this.save(true); },
    size: function () {
      try { return new Blob([localStorage.getItem(KEY) || '']).size; } catch (e) { return 0; }
    }
  };

  var saveTimer = null;
  function flashSaved() {
    var el = document.getElementById('saveFlag');
    if (!el) return;
    el.textContent = '已保存';
    el.classList.remove('warn');
    el.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { el.classList.remove('show'); }, 1200);
  }
  function flashSaveError() {
    var el = document.getElementById('saveFlag');
    if (!el) return;
    el.textContent = '⚠️ 保存失败';
    el.classList.add('show', 'warn');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { el.classList.remove('show', 'warn'); el.textContent = '已保存'; }, 2600);
  }

  /* ---------- 工具 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function shiftDay(str, n) {
    var d = parseDate(str); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(s) {
    if (!s) return new Date();
    var p = String(s).slice(0, 10).split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
  }

  function fmtDate(s, withWeek) {
    if (!s) return '—';
    var d = parseDate(s);
    var t = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (d.getFullYear() !== new Date().getFullYear()) t = d.getFullYear() + '年' + t;
    if (withWeek) t += ' 周' + '日一二三四五六'[d.getDay()];
    return t;
  }

  function dayDiff(a, b) { // b - a，单位天
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }

  function relDay(dateStr) {
    var n = dayDiff(today(), dateStr);
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === 2) return '后天';
    if (n === -1) return '昨天';
    return n > 0 ? '还有 ' + n + ' 天' : '已过 ' + (-n) + ' 天';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }

  function money(v) {
    var n = num(v);
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(n);
    if (abs >= 1e8) {
      var yi = abs / 1e8;
      if (abs >= 1e10) return sign + '¥' + yi.toFixed(0) + '亿';
      if (abs >= 1e9) return sign + '¥' + yi.toFixed(1) + '亿';
      return sign + '¥' + yi.toFixed(2) + '亿';
    }
    if (abs >= 1e6) return sign + '¥' + (abs / 1e4).toFixed(0) + '万';
    if (abs >= 1e5) return sign + '¥' + (abs / 1e4).toFixed(1) + '万';
    if (abs >= 1e4) return sign + '¥' + (abs / 1e4).toFixed(2) + '万';
    return sign + '¥' + abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moneyFull(v) {
    var n = num(v);
    return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function ym(s) { return String(s || today()).slice(0, 7); }
  function yr(s) { return String(s || today()).slice(0, 4); }

  function sortBy(arr, key, desc) {
    return arr.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (x === undefined || x === null || x === '') x = desc ? '' : '\uffff';
      if (y === undefined || y === null || y === '') y = desc ? '' : '\uffff';
      if (x < y) return desc ? 1 : -1;
      if (x > y) return desc ? -1 : 1;
      return 0;
    });
  }

  function toast(msg) {
    var root = document.getElementById('toastRoot');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 1900);
  }

  /* ---------- 路由 / 模块注册 ---------- */
  var App = {
    modules: {},
    order: [],
    current: null,
    scrollMap: {},

    register: function (mod) {
      this.modules[mod.id] = mod;
      this.order.push(mod.id);
    },

    tab: function (modId, key, def) {
      var t = Store.data.ui.tabs || (Store.data.ui.tabs = {});
      var k = modId + ':' + (key || 'main');
      if (t[k] === undefined) t[k] = def;
      return t[k];
    },
    setTab: function (modId, key, val) {
      var t = Store.data.ui.tabs || (Store.data.ui.tabs = {});
      t[modId + ':' + (key || 'main')] = val;
      Store.save(true);
    },

    go: function (id, noHash) {
      if (!this.modules[id]) id = this.order[0];
      // 离开当前模块时触发 leave 钩子（如私人日记需重新上锁）
      if (this.current && this.current !== id) {
        var cm = this.modules[this.current];
        if (cm && cm.leave) cm.leave();
      }
      this.current = id;
      if (id !== 'home') {
        var rc = Store.data.ui.recent || (Store.data.ui.recent = []);
        rc = rc.filter(function (x) { return x !== id; });
        rc.unshift(id);
        if (rc.length > 5) rc = rc.slice(0, 5);
        Store.data.ui.recent = rc;
      }
      this.renderNav(); // 重绘侧栏以更新「常用」分组
      Store.data.ui.last = id;
      // 离开搜索态：清空侧栏模块过滤
      var ns = document.getElementById('navSearch');
      if (ns && ns.value) { ns.value = ''; this.filterNav(''); }
      Store.save(true);
      if (!noHash && location.hash !== '#' + id) { location.hash = '#' + id; }
      this.paint();
      document.body.classList.remove('nav-open');
      var v = document.getElementById('view');
      if (v) v.scrollIntoView ? window.scrollTo(0, 0) : 0;
    },

    paint: function () {
      var mod = this.modules[this.current];
      if (!mod) return;
      var view = document.getElementById('view');
      view.innerHTML = mod.render();
      document.getElementById('pageTitle').textContent = mod.icon + ' ' + mod.name;
      // 导航高亮
      [].forEach.call(document.querySelectorAll('.nav-item'), function (n) {
        n.classList.toggle('on', n.dataset.id === mod.current);
      });
      if (mod.mount) mod.mount(view);
      this.bindView(view, mod);
      if (w.UI && UI.swipeActions) UI.swipeActions(view);
    },

    // 局部重绘（保持滚动位置）
    refresh: function () {
      var y = window.scrollY;
      this.paint();
      window.scrollTo(0, y);
    },

    bindView: function (view, mod) {
      if (view._bound === mod.id) return;
      view._bound = mod.id;
      var self = this;
      view.onclick = function (e) {
        var t = e.target.closest('[data-act]');
        if (!t || !view.contains(t)) return;
        // 全局：列表分页 / 排序切换（各模块的列表页共用）
        if (t.dataset.act === 'listPg' || t.dataset.act === 'listSort') {
          if (w.ListPager) { e.preventDefault(); w.ListPager.handle(t.dataset.act, t); }
          return;
        }
        // 全局：分类管理（所有模块的「分类管理」按钮共用）
        if (t.dataset.act === 'catManage' && w.Cats) {
          e.preventDefault(); w.Cats.manage(t.dataset.ns, t.dataset.title); return;
        }
        // 全局：分类筛选条（灵活胶囊 + 固定分类共用）
        if (t.dataset.act === 'catPick' && w.Cats) {
          e.preventDefault(); w.Cats.pick(t.dataset.ns, t.dataset.k); return;
        }
        if (t.dataset.act === 'catMore' && w.Cats) {
          e.preventDefault(); w.Cats.openPicker(t.dataset.ns, t.dataset.cur); return;
        }
        // 全局：返回首页总览（每个模块顶部入口共用）
        if (t.dataset.act === 'goHome') {
          e.preventDefault(); self.go('home'); return;
        }
        // 全局：时间段筛选器触发按钮
        if (t.dataset.act === 'tfOpen' && w.TF) {
          e.preventDefault(); w.TF.open(t.dataset.tf); return;
        }
        // 全局：图表点击放大（财务统计页的柱状图 / 折线图）
        if (t.dataset.act === 'chartZoom' && w.FinChart && w.FinChart.zoom) {
          e.preventDefault(); w.FinChart.zoom(w.FinChart.store[t.dataset.cid]); return;
        }
        var fn = mod.acts && mod.acts[t.dataset.act];
        if (fn) { e.preventDefault(); fn(t, e); }
      };
      view.onchange = function (e) {
        var t = e.target.closest('[data-chg]');
        if (!t || !view.contains(t)) return;
        // 全局：列表「每页条数」选择器
        if (t.dataset.chg === 'listSize' && w.ListPager) { e.preventDefault(); w.ListPager.handleSize(t); return; }
        var fn = mod.acts && mod.acts[t.dataset.chg];
        if (fn) fn(t, e);
      };
      view.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        var t = e.target.closest('[data-enter]');
        if (!t) return;
        var fn = mod.acts && mod.acts[t.dataset.enter];
        if (fn) { e.preventDefault(); fn(t, e); }
      };
    },

    renderNav: function () {
      var nav = document.getElementById('nav');
      var self = this;
      var html = '';
      if (self.modules['home']) {
        html += '<button class="nav-item tap' + (self.current === 'home' ? ' on' : '') + '" data-id="home" data-name="首页总览 home"><span class="ni">🏠</span><span class="nt">首页总览</span></button>';
      }
      // 常用：最近使用过的模块置顶
      var recent = (Store.data.ui.recent || []).filter(function (id) { return self.modules[id] && id !== 'home'; });
      if (recent.length) {
        html += '<div class="nav-group">常用</div>';
        recent.forEach(function (id) {
          var m = self.modules[id];
          html += '<button class="nav-item tap" data-id="' + id + '" data-name="' + esc(m.name) + ' ' + id + '"><span class="ni">' + m.icon + '</span><span class="nt">' + esc(m.name) + '</span></button>';
        });
      }
      var groups = [
        { t: '日常', ids: ['checkin', 'tasks', 'worklog'] },
        { t: '记录', ids: ['media', 'exam', 'body', 'diary'] },
        { t: '生活', ids: ['items', 'finance', 'vehicle', 'anniv', 'social'] },
        { t: '人与愿望', ids: ['wish', 'family', 'cat'] },
        { t: '系统', ids: ['settings'] }
      ];
      groups.forEach(function (g) {
        html += '<div class="nav-group">' + g.t + '</div>';
        g.ids.forEach(function (id) {
          if (recent.indexOf(id) >= 0) return; // 已在「常用」置顶，原分组不再重复
          var m = self.modules[id];
          if (!m) return;
          html += '<button class="nav-item tap" data-id="' + id + '" data-name="' + esc(m.name) + ' ' + id + '"><span class="ni">' + m.icon + '</span><span class="nt">' + esc(m.name) + '</span></button>';
        });
      });
      nav.innerHTML = html;
      nav.onclick = function (e) {
        var b = e.target.closest('.nav-item');
        if (b) self.go(b.dataset.id);
      };
    },

    /* 侧栏模块过滤：按名称隐藏不匹配的导航项与空分组 */
    filterNav: function (q) {
      q = (q || '').trim().toLowerCase();
      var nav = document.getElementById('nav');
      if (!nav) return;
      var items = nav.querySelectorAll('.nav-item');
      items.forEach(function (it) {
        var name = (it.dataset.name || '').toLowerCase();
        it.style.display = (!q || name.indexOf(q) >= 0) ? '' : 'none';
      });
      nav.querySelectorAll('.nav-group').forEach(function (g) {
        var sib = g.nextElementSibling, any = false;
        while (sib && sib.classList.contains('nav-item')) {
          if (sib.style.display !== 'none') { any = true; break; }
          sib = sib.nextElementSibling;
        }
        g.style.display = any ? '' : 'none';
      });
    },

    /* 全局搜索：跨模块检索内容 + 模块跳转 */
    globalSearch: function (q) {
      q = (q || '').trim().toLowerCase();
      if (!q) return [];
      var d = Store.data, self = this, out = [];
      function add(mod, icon, title, sub) {
        var m = self.modules[mod];
        out.push({ mod: mod, modName: m ? m.name : '', icon: icon, title: title, sub: sub || '' });
      }
      self.order.forEach(function (id) {
        var m = self.modules[id];
        if (m && (m.name.toLowerCase().indexOf(q) >= 0 || id.indexOf(q) >= 0)) add(id, m.icon, m.name, '模块');
      });
      (d.tasks || []).forEach(function (t) { if (((t.title || '') + ' ' + (t.note || '') + ' ' + (t.tag || '')).toLowerCase().indexOf(q) >= 0) add('tasks', '📝', t.title || '(无标题)', (t.done ? '已完成' : '待办') + (t.tag ? ' · ' + t.tag : '')); });
      (d.finance.flows || []).forEach(function (f) { if (((f.note || '') + ' ' + (f.cat || '') + ' ' + money(f.amount)).toLowerCase().indexOf(q) >= 0) add('finance', '💰', (f.type === 'out' ? '支出 ' : '收入 ') + money(f.amount), (f.cat || '') + (f.note ? ' · ' + f.note : '') + ' · ' + f.date); });
      (d.media || []).forEach(function (m) { if ((m.title || '').toLowerCase().indexOf(q) >= 0) add('media', '🎬', m.title || '(未命名)', (m.type || '') + (m.status ? ' · ' + m.status : '')); });
      if (d.diary) (d.diary.entries || []).forEach(function (e) { if ((e.text || '').toLowerCase().indexOf(q) >= 0) add('diary', '📔', (e.text || '').slice(0, 40), (e.date || '') + (e.tag ? ' · ' + e.tag : '')); });
      (d.wish || []).forEach(function (w) { if ((w.name || '').toLowerCase().indexOf(q) >= 0) add('wish', '⭐', w.name, w.cat || ''); });
      (d.social || []).forEach(function (s) { if (((s.name || '') + ' ' + (s.note || '')).toLowerCase().indexOf(q) >= 0) add('social', '🤝', s.name, s.cat || ''); });
      (d.anniv || []).forEach(function (a) { if ((a.name || '').toLowerCase().indexOf(q) >= 0) add('anniv', '💞', a.name, a.type || ''); });
      (d.items.stock || []).forEach(function (it) { if ((it.name || '').toLowerCase().indexOf(q) >= 0) add('items', '📦', it.name, '库存'); });
      (d.items.buy || []).forEach(function (it) { if ((it.name || '').toLowerCase().indexOf(q) >= 0) add('items', '🛒', it.name, '采购'); });
      (d.checkin.habits || []).forEach(function (h) { if ((h.name || '').toLowerCase().indexOf(q) >= 0) add('checkin', '✅', h.name, '打卡'); });
      (d.exam.exams || []).forEach(function (x) { if ((x.name || '').toLowerCase().indexOf(q) >= 0) add('exam', '📚', x.name, '考试'); });
      return out.slice(0, 40);
    },

    openSearch: function () {
      var self = this;
      var root = document.getElementById('modalRoot');
      var el = document.createElement('div');
      el.className = 'modal-mask';
      el.innerHTML = '<div class="modal search-modal" role="dialog" aria-modal="true" aria-label="全局搜索与命令">' +
        '<div class="search-bar"><input class="search-input" type="search" placeholder="搜索，或输入命令，如「记一笔」「设置」…" aria-label="搜索"><button class="x-btn tap" data-x aria-label="关闭">✕</button></div>' +
        '<div class="search-results" id="searchResults"></div></div>';
      root.appendChild(el);
      if (w.UI && w.UI.modalA11y) w.UI.modalA11y.open(el);
      var input = el.querySelector('.search-input');
      var box = el.querySelector('#searchResults');
      var items = [], active = 0;
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);

      var COMMANDS = [
        { key: '记一笔 记账 支出 收入', title: '记一笔', icon: '💰', mod: 'finance', act: 'fnew', sub: '快速记账' },
        { key: '新建账户 账户', title: '新建记账账户', icon: '🏦', mod: 'finance', act: 'anew', sub: 'finance' },
        { key: '新建任务 待办', title: '新建任务', icon: '📝', mod: 'tasks', act: 'new', sub: 'tasks' },
        { key: '新建打卡 习惯', title: '新建打卡任务', icon: '✅', mod: 'checkin', act: 'newHabit', sub: 'checkin' },
        { key: '添加愿望 愿望', title: '添加愿望', icon: '⭐', mod: 'wish', act: 'new', sub: 'wish' },
        { key: '写日记 日记', title: '写日记', icon: '📔', mod: 'diary', act: 'new', sub: 'diary' },
        { key: '设置 主题 外观 备份', title: '打开设置', icon: '⚙️', mod: 'settings', act: '', sub: 'settings' },
        { key: '首页 总览', title: '回到首页总览', icon: '🏠', mod: 'home', act: '', sub: 'home' }
      ];

      function close() { el.remove(); if (w.UI && w.UI.modalA11y) w.UI.modalA11y.close(el); }
      function runItem(it) {
        close();
        if (it.mod) self.go(it.mod);
        if (it.act) {
          var m = self.modules[it.mod];
          if (m && m.acts && m.acts[it.act]) setTimeout(function () { m.acts[it.act](); }, 90);
        }
      }
      function render(q) {
        q = (q || '').trim();
        items = [];
        if (!q) {
          items = COMMANDS.map(function (c) { return { cmd: true, icon: c.icon, title: c.title, sub: c.sub, mod: c.mod, act: c.act }; });
        } else {
          var ql = q.toLowerCase();
          COMMANDS.forEach(function (c) { if ((c.key + c.title).toLowerCase().indexOf(ql) >= 0) items.push({ cmd: true, icon: c.icon, title: c.title, sub: c.sub, mod: c.mod, act: c.act }); });
          self.globalSearch(q).forEach(function (r) { items.push({ cmd: false, icon: r.icon, title: r.title, sub: r.sub, mod: r.mod, modName: r.modName }); });
        }
        if (!items.length) { box.innerHTML = '<div class="search-empty">没有找到与「' + esc(q) + '」相关的内容或命令</div>'; return; }
        active = 0;
        box.innerHTML = items.map(function (it, i) {
          return '<button class="search-res tap' + (i === 0 ? ' on' : '') + '" data-idx="' + i + '">' +
            '<span class="sr-ico">' + it.icon + '</span>' +
            '<span class="sr-main"><span class="sr-title">' + esc(it.title) + '</span>' +
            (it.sub ? '<span class="sr-sub">' + esc(it.sub) + '</span>' : '') + '</span>' +
            '<span class="sr-mod">' + (it.cmd ? '命令' : esc(it.modName || '')) + '</span></button>';
        }).join('');
      }
      function setActive(i) {
        if (!items.length) return;
        active = (i + items.length) % items.length;
        [].forEach.call(box.querySelectorAll('.search-res'), function (b, idx) { b.classList.toggle('on', idx === active); });
        var on = box.querySelector('.search-res.on'); if (on) on.scrollIntoView({ block: 'nearest' });
      }
      input.addEventListener('input', function () { render(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) runItem(items[active]); }
      });
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('[data-x]')) return close();
        var r = e.target.closest('.search-res');
        if (r) runItem(items[+r.dataset.idx]);
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      render('');
    }
  };

  // 导航高亮修正
  var _paint = App.paint;
  App.paint = function () {
    _paint.call(this);
    var cur = this.current;
    [].forEach.call(document.querySelectorAll('.nav-item'), function (n) {
      n.classList.toggle('on', n.dataset.id === cur);
    });
  };

  /* ---------- 饮水明细日志（首页「记喝水」与身材管理「饮水打卡」共享同步） ----------
     数据模型：
       body.water[date]      = 当日累计总量（ml，保持原有字段，供概览/日历/历史兼容）
       body.waterLog[date]   = [{ id, amount(可正可负), t(时分) }, ...] 明细列表（新）
     任一入口新增/删除都会同时维护两者，保证首页与身材管理实时一致。 */
  var Water = {
    add: function (date, amount) {
      date = date || U.today();
      amount = U.num(amount);
      var d = Store.data;
      d.body.waterLog = d.body.waterLog || {};
      var arr = d.body.waterLog[date] || (d.body.waterLog[date] = []);
      arr.push({ id: U.uid(), amount: amount, t: U.nowTime() });
      d.body.water[date] = Math.max(0, U.num(d.body.water[date]) + amount);
      Store.save();
    },
    del: function (date, id) {
      date = date || U.today();
      var d = Store.data, lg = d.body.waterLog;
      if (!lg || !lg[date]) return;
      lg[date] = lg[date].filter(function (e) { return e.id !== id; });
      if (!lg[date].length) delete lg[date];
      d.body.water[date] = Math.max(0, (lg[date] || []).reduce(function (s, e) { return s + U.num(e.amount); }, 0));
      Store.save();
    },
    list: function (date) {
      date = date || U.today();
      var lg = Store.data.body.waterLog;
      return (lg && lg[date]) || [];
    },
    presets: function () {
      var arr = Store.data.body.waterPresets;
      if (!Array.isArray(arr) || !arr.length) return [];
      return arr.map(U.num).filter(function (n) { return n > 0; });
    },
    setPresets: function (arr) {
      arr = (arr || []).map(U.num).filter(function (n) { return n > 0 && n <= 2000; });
      var seen = {}, out = [];
      arr.forEach(function (n) { if (!seen[n]) { seen[n] = 1; out.push(n); } });
      Store.data.body.waterPresets = out;
      Store.save();
    },
    /* 渲染今日饮水明细；默认折叠，只显示最近 LIMIT 条
       opts: { expanded, limit, act(展开/收起), delAct(删除) } */
    renderLog: function (date, opts) {
      opts = opts || {};
      var LIMIT = opts.limit || 5;
      var expanded = opts.expanded;
      var act = opts.act || 'wExpAll';
      var delAct = opts.delAct || 'wdel';
      var esc = U.esc, num = U.num;
      var log = Water.list(date).slice().reverse();
      if (!log.length) return '<div class="small muted" style="margin-top:4px">今天还没有喝水记录</div>';
      var show = expanded ? log : log.slice(0, LIMIT);
      var html = '<div class="water-log">';
      html += show.map(function (e) {
        var v = num(e.amount), neg = v < 0;
        return '<div class="water-log-row">' +
          '<span class="wl-time">' + esc(e.t) + '</span>' +
          '<span class="wl-amt' + (neg ? ' neg' : '') + '">' + (neg ? '' : '+') + v + ' ml</span>' +
          '<button class="link-btn del tap" data-act="' + delAct + '" data-id="' + e.id + '">删除</button>' +
          '</div>';
      }).join('');
      if (log.length > LIMIT) {
        html += '<button class="pill tap water-log-more" data-act="' + act + '">' +
          (expanded ? '收起' : '展开全部 (' + log.length + ' 条)') + '</button>';
      }
      html += '</div>';
      return html;
    }
  };

  w.Store = Store;
  w.App = App;
  w.Water = Water;
  w.U = {
    uid: uid, today: today, nowTime: nowTime, pad: pad, shiftDay: shiftDay, parseDate: parseDate,
    fmtDate: fmtDate, dayDiff: dayDiff, relDay: relDay, esc: esc, num: num, money: money, moneyFull: moneyFull,
    ym: ym, yr: yr, sortBy: sortBy, toast: toast
  };

  /* ---------- 一键置顶悬浮按钮（每个界面右下角，下滑后出现） ---------- */
  function initTopFab() {
    var btn = document.createElement('button');
    btn.className = 'top-fab tap';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);
    var TH = 360;
    function update() {
      var y = window.scrollY || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
      btn.classList.toggle('show', y > TH);
    }
    window.addEventListener('scroll', update, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTopFab);
  else initTopFab();

  /* 兜底保存：页面隐藏 / 卸载前再写一次，避免极端情况下漏存导致“数据没了” */
  try {
    function _flush() { try { Store.save(true); } catch (e) {} }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') _flush(); });
    window.addEventListener('pagehide', _flush);
  } catch (e) {}
})(window);
