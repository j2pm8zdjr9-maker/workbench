/* ================= 📔 私人日记 ================= */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, TF = window.TF, D = function () { return Store.data; };

  var WEATHER = [
    { v: 'sunny', e: '☀️', t: '晴' }, { v: 'cloud', e: '⛅️', t: '多云' },
    { v: 'overcast', e: '☁️', t: '阴' }, { v: 'rain', e: '🌧️', t: '小雨' },
    { v: 'storm', e: '⛈️', t: '大雨' }, { v: 'snow', e: '❄️', t: '雪' },
    { v: 'fog', e: '🌫️', t: '雾' }, { v: 'wind', e: '🌬️', t: '大风' }
  ];
  var MOOD = [
    { v: 'happy', e: '😊', t: '开心' }, { v: 'calm', e: '😌', t: '平静' },
    { v: 'excited', e: '🤩', t: '兴奋' }, { v: 'relaxed', e: '😎', t: '放松' },
    { v: 'tired', e: '😩', t: '累' }, { v: 'sad', e: '😢', t: '难过' },
    { v: 'angry', e: '😠', t: '生气' }, { v: 'anxious', e: '😟', t: '焦虑' },
    { v: 'moved', e: '🥹', t: '感动' }
  ];
  function wMap(v) { return WEATHER.filter(function (x) { return x.v === v; })[0] || null; }
  function mMap(v) { return MOOD.filter(function (x) { return x.v === v; })[0] || null; }

  var st = { q: '', view: 'list', mood: '', tag: '' };
  var cal = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
  var dh = { q: '', mood: '', tag: '', pg: 1, sz: 5 };   // 历史日记弹窗状态
  var DI_SIZES = [5, 10, 20, 50, 100];
  var diPg = 1, diSz = 10;                                // 主页列表分页
  var diaryExpanded = null; // 当前展开的日记 id
  var unlocked = false;

  // 离开日记模块时重新上锁：无论跳到哪个页面，再回来都要输入密码
  function lockNow() { unlocked = false; }

  function entries() { return D().diary.entries; }
  function byId(id) { return entries().filter(function (x) { return x.id === id; })[0]; }
  function preview(s) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > 60 ? s.slice(0, 60) + '…' : s; }

  function getList() {
    var q = st.q.trim().toLowerCase();
    var arr = entries().filter(function (x) {
      if (!TF.inRange('diary_main', x.date)) return false;
      if (st.mood && x.mood !== st.mood) return false;
      if (st.tag && (x.tags || []).indexOf(st.tag) < 0) return false;
      if (q && (x.title || '').toLowerCase().indexOf(q) < 0 && (x.body || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    arr.sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    return arr;
  }

  function streakDays() {
    var set = {}; entries().forEach(function (e) { set[e.date] = 1; });
    var d = U.today();
    if (!set[d]) d = U.shiftDay(d, -1);
    var n = 0;
    while (set[d]) { n++; d = U.shiftDay(d, -1); }
    return n;
  }

  /* ---------- 导出 ---------- */
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 200);
  }
  function entryMd(x) {
    var L = [];
    L.push('# ' + (x.title || '(无标题)'));
    L.push('');
    L.push('日期：' + (x.date || '') + (wMap(x.weather) ? '　天气 ' + wMap(x.weather).t : '') + (mMap(x.mood) ? '　心情 ' + mMap(x.mood).t : ''));
    if (x.tags && x.tags.length) L.push('标签：' + x.tags.join('、'));
    L.push('');
    L.push(x.body || '');
    return L.join('\n');
  }
  function exportOne(id) {
    var x = byId(id); if (!x) return;
    var txt = entryMd(x);
    if (x.imgs && x.imgs.length) txt += '\n\n（本篇含 ' + x.imgs.length + ' 张图片，图片请使用「导出全部」JSON 备份）';
    download('日记_' + (x.date || '') + '_' + (x.title || '无标题').slice(0, 10) + '.md', txt, 'text/markdown;charset=utf-8');
  }
  function exportAll() {
    var data = { app: '个人工作台-私人日记', exportedAt: new Date().toISOString(), entries: entries() };
    download('私人日记备份_' + U.today() + '.json', JSON.stringify(data, null, 2), 'application/json');
    U.toast('已导出 ' + entries().length + ' 篇');
  }

  /* ---------- 图片压缩 ---------- */
  function fileToB64(file, cb) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var maxW = 1000, w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        try {
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          cb(c.toDataURL('image/jpeg', 0.72));
        } catch (e) { cb(r.result); }
      };
      img.onerror = function () { cb(r.result); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ============ 视图 ============ */
  var diary = {
    id: 'diary', icon: '📔', name: '私人日记',

    // 离开模块即重新上锁
    leave: function () { lockNow(); },

    render: function () {
      if (D().diary.password && !unlocked) return this.lockScreen();
      var protect = D().diary.password
        ? '<div class="di-protect di-set">🔒 日记已加密，离开后再次进入需输入密码。' +
          '<button class="btn ghost sm tap" data-act="lock">修改密码</button></div>'
        : '<div class="di-protect di-unset">⚠️ 日记当前<b>未加密</b>，本设备任何人都可查看。' +
          '<button class="btn primary sm tap" data-act="lock">🔒 设置密码保护</button></div>';
      return UI.head('📔 私人日记', '私密文字日记 · 本地保存不上传 · 随手记录随时回看') +
        protect +
        this.statCard() +
        UI.card({
          title: '我的日记', sub: '日期倒序 · 置顶优先',
          right: '<button class="btn ghost sm tap" data-act="expAll">⬇ 导出全部</button>' +
            (D().diary.password
              ? '<button class="btn ghost sm tap" data-act="lock">🔓 已加密</button>'
              : '<button class="btn ghost sm tap" data-act="lock">🔒 加密</button>') +
            '<button class="btn ghost sm tap" data-act="hist">📜 历史日记</button>' +
            Cats.btn('diaryTags', '日记标签') +
            '<button class="btn primary sm tap" data-act="new">+ 写日记</button>',
          body: this.controls() + '<div id="dbody" style="margin-top:14px">' +
            (st.view === 'calendar' ? this.calBar() : this.listBody()) + '</div>'
        });
    },

    statCard: function () {
      var all = entries(), y = U.yr();
      var total = all.length;
      var ycount = all.filter(function (x) { return U.yr(x.date) === y; }).length;
      var mcount = all.filter(function (x) { return U.ym(x.date) === U.ym(); }).length;
      return UI.card({
        title: '📊 统计看板',
        body: UI.stats([
          ['累计篇数', total, true], ['本年度', ycount], ['本月', mcount], ['连续天数', streakDays() + ' 天']
        ])
      });
    },

    controls: function () {
      return '<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">' + TF.btn('diary_main') + UI.tabs([{ k: 'list', t: '📋 列表' }, { k: 'calendar', t: '📅 日历' }], st.view, 'view') + '</div>';
    },

    recent: function () {
      return entries().filter(function (x) { return TF.inRange('diary_main', x.date); }).sort(function (a, b) {
        if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
    },

    entryItem: function (x) {
      var firstImg = (x.imgs && x.imgs.length) ? x.imgs[0] : '';
      var expanded = diaryExpanded === x.id;
      // 标题：有标题显示标题，无标题则用日期
      var displayTitle = (x.title || '').trim() || U.fmtDate(x.date, true);
      if (!expanded) {
        return '<div class="item diary-item' + (x.pinned ? ' pinned' : '') + '" data-act="diexp" data-id="' + x.id + '">' +
          (firstImg ? '<img class="di-thumb zoomable" data-act="zoom" data-src="' + firstImg + '" src="' + firstImg + '" alt="">'
            : (x.pinned ? '<span class="di-pin">📌</span>' : '')) +
          '<div class="item-main">' +
          '<div class="row between"><span class="item-title">' + esc(displayTitle) + '</span>' +
          '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
          (wMap(x.weather) ? '<span class="di-emoji">' + wMap(x.weather).e + '</span>' : '') +
          (mMap(x.mood) ? '<span class="di-emoji">' + mMap(x.mood).e + '</span>' : '') +
          (x.pinned ? '<span class="badge">📌</span>' : '') +
          ' <span style="font-size:11px;color:#999">▸</span></span></div>' +
          ((x.tags && x.tags.length) ? '<div class="di-tags" style="margin-top:4px">' + x.tags.slice(0, 3).map(function (t) {
            return '<span class="badge grey" style="font-size:11px">' + esc(t) + '</span>'; }).join('') +
            (x.tags.length > 3 ? '<span class="badge grey" style="font-size:11px">+' + (x.tags.length - 3) + '</span>' : '') + '</div>' : '') +
          '</div></div>';
      }
      return '<div class="item diary-item' + (x.pinned ? ' pinned' : '') + ' open" data-act="diexp" data-id="' + x.id + '">' +
        (firstImg ? '<img class="di-thumb zoomable" data-act="zoom" data-src="' + firstImg + '" src="' + firstImg + '" alt="">'
          : (x.pinned ? '<span class="di-pin">📌</span>' : '')) +
        '<div class="item-main" data-act="open" data-id="' + x.id + '">' +
        '<div class="row between"><span class="item-title">' + esc(displayTitle) + '</span>' +
        '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
        (x.pinned ? '<span class="badge">📌置顶</span>' : '') +
        ' <span style="font-size:11px;color:#999">▾</span></span></div>' +
        '<div class="item-meta">' +
        '<span>' + U.fmtDate(x.date, true) + '</span>' +
        (wMap(x.weather) ? '<span class="di-emoji">' + wMap(x.weather).e + '</span>' : '') +
        (mMap(x.mood) ? '<span class="di-emoji">' + mMap(x.mood).e + '</span>' : '') +
        '</div>' +
        (x.body ? '<div class="item-note">' + esc(preview(x.body)) + '</div>' : '') +
        ((x.tags && x.tags.length) ? '<div class="di-tags">' + x.tags.map(function (t) {
          return '<span class="badge grey">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '</div>' + UI.ops(x.id, 'edit', 'del') + '</div>';
    },

    diPager: function (total) {
      var sz = diSz, pages = Math.max(1, Math.ceil(total / sz));
      var pg = Math.min(diPg, pages); diPg = pg;
      return UI.pager({
        pg: pg, pages: pages, total: total, size: sz, sizes: DI_SIZES,
        pageAct: 'diPage', sizeChg: 'diSize'
      });
    },

    listBody: function () {
      var arr = this.recent();
      if (!arr.length) return UI.empty('「' + TF.label('diary_main') + '」还没有日记，点「写日记」记录第一篇', '📔');
      var sz = diSz, pages = Math.max(1, Math.ceil(arr.length / sz));
      var pg = Math.min(diPg, pages); diPg = pg;
      var pageArr = arr.slice((pg - 1) * sz, pg * sz);
      return '<div class="list">' + pageArr.map(function (x) { return diary.entryItem(x); }).join('') + '</div>' +
        this.diPager(arr.length);
    },

    openHist: function () {
      var modId = 'diary_hist';
      var self = this;
      dh.pg = 1;
      var prevEl = document.getElementById('diaryHistSheet');
      if (prevEl) prevEl.remove();
      function compute() {
        var q = dh.q.trim().toLowerCase();
        var arr = entries().filter(function (x) {
          if (!TF.inRange(modId, x.date)) return false;
          if (dh.mood && x.mood !== dh.mood) return false;
          if (dh.tag && (x.tags || []).indexOf(dh.tag) < 0) return false;
          if (q && (x.title || '').toLowerCase().indexOf(q) < 0 && (x.body || '').toLowerCase().indexOf(q) < 0) return false;
          return true;
        });
        arr.sort(function (a, b) {
          if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
        });
        return arr;
      }
      function moodPills() {
        return UI.pills([{ k: '', t: '全部心情' }].concat(MOOD.map(function (m) { return { k: m.v, t: m.e + ' ' + m.t }; })), dh.mood, 'dmood');
      }
      function tagPills() {
        return UI.pills([{ k: '', t: '全部标签' }].concat((D().diaryTags || []).map(function (t) { return { k: t, t: t }; })), dh.tag, 'dtag');
      }
      function pagerHTML(total) {
        var sz = dh.sz, pages = Math.max(1, Math.ceil(total / sz));
        var pg = Math.min(dh.pg, pages); dh.pg = pg;
        return UI.pager({
          pg: pg, pages: pages, total: total, size: sz, sizes: DI_SIZES,
          pageAct: 'dhPage', sizeChg: 'dhSize'
        });
      }
      function draw() {
        var arr = compute();
        var total = arr.length;
        var sz = dh.sz, pages = Math.max(1, Math.ceil(total / sz));
        var pg = Math.min(dh.pg, pages);
        var pageArr = arr.slice((pg - 1) * sz, pg * sz);
        listEl.innerHTML = pageArr.length
          ? '<div class="list">' + pageArr.map(function (x) { return self.entryItem(x); }).join('') + '</div>'
          : UI.empty('没有符合条件的日记', '📔');
        pagerEl.innerHTML = pagerHTML(total);
      }
      function renderTf() { tfEl.innerHTML = TF.btn(modId); }
      var el = UI.sheet('📔 历史日记',
        '<div id="dhTf">' + TF.btn(modId) + '</div>' +
        '<div style="height:12px"></div>' +
        '<input class="input" id="dhq" placeholder="🔍 搜标题或正文关键词" value="' + esc(dh.q) + '">' +
        '<div style="height:12px"></div>' +
        '<div class="small muted" style="margin-bottom:6px">按心情</div><div id="dhMood">' + moodPills() + '</div>' +
        '<div style="height:10px"></div>' +
        '<div class="small muted" style="margin-bottom:6px">按标签</div><div id="dhTag">' + tagPills() + '</div>' +
        '<div style="height:14px"></div>' +
        '<div id="dhList"></div>' +
        '<div id="dhPager"></div>',
        '<button class="btn ghost tap" data-x>关闭</button>');
      el.id = 'diaryHistSheet';
      var listEl = el.querySelector('#dhList');
      var pagerEl = el.querySelector('#dhPager');
      var tfEl = el.querySelector('#dhTf');
      renderTf();
      draw();
      var qe = el.querySelector('#dhq');
      if (qe) qe.oninput = function () { dh.q = this.value; dh.pg = 1; draw(); };
      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act]'); if (!t) return;
        var act = t.dataset.act;
        if (act === 'tfOpen') { e.preventDefault(); TF.open(modId, { onChange: function () { renderTf(); dh.pg = 1; draw(); } }); }
        else if (act === 'dmood') { e.preventDefault(); dh.mood = dh.mood === t.dataset.k ? '' : t.dataset.k; dh.pg = 1; el.querySelector('#dhMood').innerHTML = moodPills(); draw(); }
        else if (act === 'dtag') { e.preventDefault(); dh.tag = dh.tag === t.dataset.k ? '' : t.dataset.k; dh.pg = 1; el.querySelector('#dhTag').innerHTML = tagPills(); draw(); }
        else if (act === 'dhPage') { e.preventDefault(); dh.pg = +t.dataset.k || 1; draw(); }
        else if (act === 'zoom') { openLightbox(t.dataset.src); }
        else if (act === 'open') { el.remove(); UI.unlock(); openDetail(t.dataset.id); }
        else if (act === 'edit') { el.remove(); UI.unlock(); openEditor(byId(t.dataset.id)); }
        else if (act === 'del') {
          var x = byId(t.dataset.id);
          UI.del(x.title || '无标题', function () {
            D().diary.entries = D().diary.entries.filter(function (a) { return a.id !== x.id; });
            Store.save(); draw();
          });
        }
      });
      pagerEl.addEventListener('change', function (e) {
        if (e.target.matches('[data-chg="dhSize"]')) { dh.sz = +e.target.value || 10; dh.pg = 1; draw(); }
      });
    },

    calBar: function () {
      return '<div class="row between" style="margin:12px 0 8px">' +
        '<button class="btn ghost sm tap" data-act="calPrev">‹</button>' +
        '<strong>' + cal.y + ' 年 ' + cal.m + ' 月</strong>' +
        '<span><button class="btn ghost sm tap" data-act="calToday">今天</button> ' +
        '<button class="btn ghost sm tap" data-act="calNext">›</button></span></div>' + this.calGrid();
    },

    calGrid: function () {
      var y = cal.y, m = cal.m;
      var first = new Date(y, m - 1, 1), startPad = first.getDay();
      var days = new Date(y, m, 0).getDate();
      var has = {}; entries().forEach(function (e) { has[e.date] = 1; });
      var today = U.today();
      var cells = ['日', '一', '二', '三', '四', '五', '六'].map(function (d) {
        return '<span class="cal-wd">' + d + '</span>';
      }).join('');
      for (var i = 0; i < startPad; i++) cells += '<button class="cal-cell empty" tabindex="-1" aria-hidden="true"></button>';
      for (var d = 1; d <= days; d++) {
        var ds = y + '-' + U.pad(m) + '-' + U.pad(d);
        var cls = 'cal-cell';
        if (has[ds]) cls += ' has';
        if (ds === today) cls += ' today';
        cells += '<button class="' + cls + ' tap" data-act="calDay" data-d="' + ds + '">' + d +
          (has[ds] ? '<i class="cal-dot"></i>' : '') + '</button>';
      }
      return '<div class="cal">' + cells + '</div>';
    },

    lockScreen: function () {
      return UI.head('📔 私人日记', '私密文字日记') +
        UI.card({
          title: '🔒 已加密', sub: '进入需要密码',
          body: '<p class="small muted">本板块已设置独立访问密码，输入密码后查看。</p>' +
            '<div class="field"><input class="input" id="pw" type="password" data-enter="unlock" placeholder="输入访问密码" autofocus></div>' +
            '<button class="btn primary tap" data-act="unlock" style="width:100%;margin-top:6px">解锁查看</button>' +
            '<p class="small muted" style="margin-top:10px">密码仅保存在本机浏览器，开发者与任何第三方都看不到；若忘记密码将无法恢复日记内容。</p>'
        });
    },

    mount: function (view) {
      var pw = view.querySelector('#pw');
      if (pw) { pw.focus(); }
    },

    acts: {
      diexp: function (t) { diaryExpanded = diaryExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },
      view: function (t) { st.view = t.dataset.k; App.refresh(); },
      dmood: function (t) { st.mood = st.mood === t.dataset.k ? '' : t.dataset.k; App.refresh(); },
      dtag: function (t) { st.tag = st.tag === t.dataset.k ? '' : t.dataset.k; App.refresh(); },
      hist: function () { diary.openHist(); },
      diPage: function (t) { diPg = +t.dataset.k || 1; App.refresh(); },
      diSize: function (t) { diSz = +t.value || 10; diPg = 1; App.refresh(); },
      new: function () { openEditor(null); },
      open: function (t) { openDetail(t.dataset.id); },
      zoom: function (t) { openLightbox(t.dataset.src); },
      edit: function (t) { openEditor(byId(t.dataset.id)); },
      del: function (t) {
        var x = byId(t.dataset.id);
        UI.del((x.title || '无标题'), function () {
          D().diary.entries = entries().filter(function (a) { return a.id !== x.id; });
          Store.save(); App.refresh();
        });
      },
      expOne: function (t) { exportOne(t.dataset.id); },
      expAll: function () { exportAll(); },
      calPrev: function () { navCal(-1); },
      calNext: function () { navCal(1); },
      calToday: function () { cal.y = new Date().getFullYear(); cal.m = new Date().getMonth() + 1; App.refresh(); },
      calDay: function (t) { daySheet(t.dataset.d); },
      unlock: function () {
        var v = document.getElementById('pw');
        if (v && v.value === D().diary.password) { unlocked = true; App.refresh(); }
        else U.toast('密码错误');
      },
      lock: function () { D().diary.password ? openManage() : openSet(); }
    }
  };

  function navCal(n) { var d = new Date(cal.y, cal.m - 1 + n, 1); cal.y = d.getFullYear(); cal.m = d.getMonth() + 1; App.refresh(); }

  /* ============ 编辑器 ============ */
  function openEditor(entry, overrideDate) {
    var isEdit = !!entry;
    var tmp = {
      date: overrideDate || (entry ? entry.date : U.today()),
      title: entry ? entry.title : '',
      body: entry ? entry.body : '',
      weather: entry ? entry.weather : '',
      mood: entry ? entry.mood : '',
      tags: entry ? (entry.tags || []).slice() : [],
      imgs: entry ? (entry.imgs || []).slice() : [],
      pinned: entry ? !!entry.pinned : false
    };
    function wChips() {
      return WEATHER.map(function (w) {
        return '<button type="button" class="chip tap' + (tmp.weather === w.v ? ' on' : '') + '" data-act="wpick" data-v="' + w.v + '"><span class="chip-e">' + w.e + '</span><span>' + w.t + '</span></button>';
      }).join('');
    }
    function mChips() {
      return MOOD.map(function (m) {
        return '<button type="button" class="chip tap' + (tmp.mood === m.v ? ' on' : '') + '" data-act="mpick" data-v="' + m.v + '"><span class="chip-e">' + m.e + '</span><span>' + m.t + '</span></button>';
      }).join('');
    }
    function tChips() {
      var list = D().diaryTags || [];
      return list.map(function (t) {
        return '<button type="button" class="tag-chip tap' + (tmp.tags.indexOf(t) >= 0 ? ' on' : '') + '" data-act="tpick" data-v="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('');
    }
    function iGrid() {
      if (!tmp.imgs.length) return '<p class="small muted">还没有图片</p>';
      return '<div class="img-grid">' + tmp.imgs.map(function (src, i) {
        return '<div class="img-thumb zoomable" data-act="zoom" data-src="' + src + '"><img src="' + src + '" alt=""><button type="button" class="img-x tap" data-act="delimg" data-i="' + i + '">✕</button></div>';
      }).join('') + '</div>';
    }

    var body = '<div class="diary-editor">' +
      '<div class="field"><label>日期</label><input class="input" type="date" name="date" value="' + esc(tmp.date) + '"></div>' +
      '<div class="field"><label>标题</label><input class="input" name="title" value="' + esc(tmp.title) + '" placeholder="今天发生了什么…"></div>' +
      '<div class="field"><label>天气</label><div class="chip-row" id="wbox">' + wChips() + '</div></div>' +
      '<div class="field"><label>心情</label><div class="chip-row" id="mbox">' + mChips() + '</div></div>' +
      '<div class="field"><label>标签（可多选，也可新建）</label><div class="chip-row wrap" id="tbox">' + tChips() + '</div>' +
      '<div class="row" style="gap:8px;margin-top:6px"><input class="input" id="newtag" placeholder="新建标签，如：旅行 / 复盘"><button class="btn ghost sm tap" data-act="addtag">＋ 添加</button></div>' +
      '<div class="field"><label>图片（本地保存，自动压缩）</label>' +
      '<input type="file" accept="image/*" multiple id="diFile" class="di-file">' +
      '<div id="imgs" style="margin-top:8px">' + iGrid() + '</div></div>' +
      '<div class="field full"><label>正文</label><textarea class="textarea di-body" name="body" rows="8" placeholder="写点什么…支持换行书写">' + esc(tmp.body) + '</textarea></div>' +
      '<label class="opt-row tap" style="min-height:50px"><input type="checkbox" name="pinned" ' + (tmp.pinned ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#8AA832"><span>📌 置顶这篇日记</span></label>' +
      '</div>';

    var el = UI.sheet(isEdit ? '编辑日记' : '写日记', body,
      '<button class="btn ghost tap" data-x>取消</button><button class="btn primary tap" data-act="disave">保存</button>');

    function paintW() { el.querySelector('#wbox').innerHTML = wChips(); }
    function paintM() { el.querySelector('#mbox').innerHTML = mChips(); }
    function paintT() { el.querySelector('#tbox').innerHTML = tChips(); }
    function paintI() { el.querySelector('#imgs').innerHTML = iGrid(); }

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'wpick') { tmp.weather = tmp.weather === b.dataset.v ? '' : b.dataset.v; paintW(); }
      else if (a === 'mpick') { tmp.mood = tmp.mood === b.dataset.v ? '' : b.dataset.v; paintM(); }
      else if (a === 'tpick') {
        var v = b.dataset.v, i = tmp.tags.indexOf(v);
        if (i >= 0) tmp.tags.splice(i, 1); else tmp.tags.push(v);
        paintT();
      } else if (a === 'addtag') {
        var inp = el.querySelector('#newtag'), nv = inp.value.trim();
        if (nv) {
          if ((D().diaryTags || []).indexOf(nv) < 0) { D().diaryTags = (D().diaryTags || []).concat(nv); Store.save(); }
          if (tmp.tags.indexOf(nv) < 0) tmp.tags.push(nv);
          inp.value = ''; paintT();
        }
      } else       if (a === 'delimg') { tmp.imgs.splice(+b.dataset.i, 1); paintI(); }
      else if (a === 'zoom') { openLightbox(b.dataset.src); }
      else if (a === 'disave') { doSave(); }
    });

    el.querySelector('#diFile').addEventListener('change', function () {
      var files = this.files; if (!files || !files.length) return;
      var pending = files.length, done = 0;
      [].forEach.call(files, function (f) {
        fileToB64(f, function (b64) { tmp.imgs.push(b64); if (++done >= pending) paintI(); });
      });
      this.value = '';
    });

    function doSave() {
      var title = el.querySelector('[name="title"]').value.trim();
      var bodyTxt = el.querySelector('[name="body"]').value;
      var date = el.querySelector('[name="date"]').value || U.today();
      if (!title && !bodyTxt.trim()) { U.toast('标题和正文至少填一项'); return; }
      if (isEdit) {
        var x = byId(entry.id);
        x.title = title; x.body = bodyTxt; x.date = date; x.weather = tmp.weather;
        x.mood = tmp.mood; x.tags = tmp.tags; x.imgs = tmp.imgs; x.pinned = el.querySelector('[name="pinned"]').checked; x.updatedAt = Date.now();
      } else {
        D().diary.entries.push({
          id: U.uid(), title: title, body: bodyTxt, date: date, weather: tmp.weather,
          mood: tmp.mood, tags: tmp.tags, imgs: tmp.imgs, pinned: el.querySelector('[name="pinned"]').checked,
          createdAt: Date.now(), updatedAt: Date.now()
        });
      }
      Store.save(); el.remove(); UI.unlock();
      App.refresh(); U.toast(isEdit ? '已更新' : '已保存');
    }
  }

  /* ============ 图片放大层 ============ */
  function openLightbox(src) {
    if (!src || document.querySelector('.di-lightbox')) return;
    var lb = document.createElement('div');
    lb.className = 'di-lightbox';
    lb.innerHTML = '<img src="' + src + '" alt=""><button class="di-lightbox-x" data-x>✕</button>';
    var close = function () {
      lb.remove();
      document.removeEventListener('keydown', onKey);
      if (!document.querySelector('.modal-mask')) UI.unlock();
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    lb.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]') || e.target === lb) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(lb);
    UI.lock();
  }

  /* ============ 详情 ============ */
  function openDetail(id) {
    var x = byId(id); if (!x) return;
    var imgs = (x.imgs && x.imgs.length) ? '<div class="img-grid">' + x.imgs.map(function (s) {
      return '<div class="img-thumb big zoomable" data-act="zoom" data-src="' + s + '"><img src="' + s + '" alt=""></div>';
    }).join('') + '</div>' : '';
    var body = '<div class="di-detail">' +
      '<div class="di-dmeta">' +
      '<span>' + U.fmtDate(x.date, true) + '</span>' +
      (wMap(x.weather) ? '<span>' + wMap(x.weather).e + wMap(x.weather).t + '</span>' : '') +
      (mMap(x.mood) ? '<span>' + mMap(x.mood).e + mMap(x.mood).t + '</span>' : '') +
      (x.pinned ? '<span>📌置顶</span>' : '') + '</div>' +
      (x.title ? '<h3 class="di-dtitle">' + esc(x.title) + '</h3>' : '') +
      (x.body ? '<div class="di-dbody">' + esc(x.body).replace(/\n/g, '<br>') + '</div>' : '') +
      ((x.tags && x.tags.length) ? '<div class="di-tags">' + x.tags.map(function (t) {
        return '<span class="badge grey">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      imgs + '</div>';
    var el = UI.sheet('日记详情', body,
      '<button class="btn ghost tap" data-x>关闭</button>' +
      '<button class="btn ghost tap" data-act="expOne" data-id="' + x.id + '">导出</button>' +
      '<button class="btn primary tap" data-act="edit" data-id="' + x.id + '">编辑</button>');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'edit') { el.remove(); UI.unlock(); openEditor(byId(b.dataset.id)); }
      else if (a === 'expOne') { exportOne(b.dataset.id); }
      else if (a === 'zoom') { openLightbox(b.dataset.src); }
    });
  }

  /* ============ 某天日记 ============ */
  function daySheet(date) {
    var arr = entries().filter(function (x) { return x.date === date; }).sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    var body = arr.length ? '<div class="list">' + arr.map(function (x) {
      return '<div class="item diary-item"><div class="item-main" data-act="dopen" data-id="' + x.id + '">' +
        '<div class="item-title">' + esc(x.title || '(无标题)') + '</div>' +
        '<div class="item-meta">' + (mMap(x.mood) ? mMap(x.mood).e + ' ' : '') + (wMap(x.weather) ? wMap(x.weather).e : '') + '</div>' +
        (x.body ? '<div class="item-note">' + esc(preview(x.body)) + '</div>' : '') + '</div></div>';
    }).join('') + '</div>' : '<p class="small muted">这一天还没有日记。</p>';
    var el = UI.sheet(U.fmtDate(date, true) + ' 的日记', body,
      '<button class="btn ghost tap" data-x>关闭</button><button class="btn primary tap" data-act="dnew" data-d="' + date + '">在这天写</button>');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'dopen') { el.remove(); UI.unlock(); openDetail(b.dataset.id); }
      else if (a === 'dnew') { el.remove(); UI.unlock(); openEditor(null, b.dataset.d); }
    });
  }

  /* ============ 密码 ============ */
  function openSet() {
    var el = UI.sheet('🔒 设置访问密码',
      '<div class="field"><label>新密码</label><input class="input" id="p1" type="password" placeholder="设置进入日记的密码"></div>' +
      '<div class="field"><label>确认密码</label><input class="input" id="p2" type="password" placeholder="再输入一次"></div>',
      '<button class="btn ghost tap" data-x>取消</button><button class="btn primary tap" data-act="dosetpw">保存</button>');
    el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="dosetpw"]')) return;
      var p1 = el.querySelector('#p1').value, p2 = el.querySelector('#p2').value;
      if (!p1) { U.toast('密码不能为空'); return; }
      if (p1 !== p2) { U.toast('两次输入不一致'); return; }
      D().diary.password = p1; Store.save(); unlocked = true;
      el.remove(); UI.unlock(); App.refresh(); U.toast('已设置密码');
    });
  }
  function openManage() {
    var el = UI.sheet('🔒 密码管理',
      '<div class="field"><label>当前密码</label><input class="input" id="cp" type="password" placeholder="输入当前密码"></div>' +
      '<div class="field"><label>新密码（留空 = 仅关闭加密）</label><input class="input" id="np" type="password" placeholder="不填则关闭密码"></div>',
      '<button class="btn ghost tap" data-x>取消</button><button class="btn primary tap" data-act="dochgpw">保存</button>');
    el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="dochgpw"]')) return;
      var cp = el.querySelector('#cp').value, np = el.querySelector('#np').value;
      if (cp !== D().diary.password) { U.toast('当前密码错误'); return; }
      D().diary.password = np || '';
      Store.save(); el.remove(); UI.unlock(); App.refresh();
      U.toast(np ? '密码已修改' : '已关闭加密');
    });
  }

  TF.def('diary_main', '10d');
  TF.hook('diary_main', function () { diPg = 1; App.refresh(); });
  App.register(diary);
})();
