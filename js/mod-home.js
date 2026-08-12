/* ========== 0. 🏠 首页总览（快捷入口 / 今日概览） ========== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, D = function () { return Store.data; };

  /* ---------- 取数辅助 ---------- */
  function nextDate(x) {
    if (x.cal === 'lunar' && window.Lunar) {
      var m = +x.lmonth, d = +x.lday, leap = !!x.lisLeap, y = new Date().getFullYear();
      var s = U.parseDate(window.Lunar.toSolar(y, m, d, leap));
      var t = U.parseDate(U.today());
      if (s < t) s = U.parseDate(window.Lunar.toSolar(y + 1, m, d, leap));
      return s.getFullYear() + '-' + U.pad(s.getMonth() + 1) + '-' + U.pad(s.getDate());
    }
    if (!x.yearly) return x.date;
    var dd = U.parseDate(x.date), now = new Date();
    var y = now.getFullYear();
    var c = new Date(y, dd.getMonth(), dd.getDate());
    var tt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (c < tt) c = new Date(y + 1, dd.getMonth(), dd.getDate());
    return c.getFullYear() + '-' + U.pad(c.getMonth() + 1) + '-' + U.pad(c.getDate());
  }
  function consumDue(x) { return U.dayDiff(U.today(), U.shiftDay(x.open, num(x.cycle))); }
  function activeHabits() {
    return (D().checkin.habits || []).filter(function (h) {
      if (h.ended) return false; // 已立即结束，不再出现
      if (h.period === 'long') return true; // 长期有效
      if (!h.start || !h.days) return true; // 旧数据无窗口则始终显示
      var end = U.shiftDay(h.start, h.days - 1);
      return U.today() >= h.start && U.today() <= end;
    });
  }
  function isHabitDone(id) { var L = D().checkin.log[U.today()]; return !!(L && L[id]); }
  function fmtDur(mins) {
    mins = Math.round(num(mins));
    if (!mins) return '0分';
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return h + '小时' + m + '分';
    if (h) return h + '小时';
    return m + '分';
  }

  /* ---------- 快速记一笔 ---------- */
  var QUICK = [
    { mod: 'worklog', act: 'new', i: '📝', t: '工作留痕' },
    { mod: 'vehicle', act: 'newCharge', i: '⚡', t: '记充电/加油' },
    { mod: 'home', act: 'homeWater', i: '💧', t: '记喝水' },
    { mod: 'home', act: 'quickRead', i: '📖', t: '记录读书时长' },
    { mod: 'tasks', act: 'new', i: '📌', t: '新建待办' },
    { mod: 'finance', act: 'fnew', i: '💰', t: '记一笔' }
  ];

  var home = {
    id: 'home', icon: '🏠', name: '首页总览',

    render: function () {
      return UI.head('🏠 首页总览', '每天从这里开始，一步直达高频操作') +
        this.overview() +
        UI.card({ title: '⚡ 快速记一笔', body: '<div class="home-quick">' + QUICK.map(function (q) {
          return '<button class="qbtn tap" data-act="qnew" data-mod="' + q.mod + '" data-mact="' + q.act + '">' +
            '<span class="qi">' + q.i + '</span><span class="qt">' + q.t + '</span></button>';
        }).join('') + '</div>' }) +
        this.modulesNav();
    },

    /* ---------- 模块快速导航：一览全部模块，点击直达 ---------- */
    modulesNav: function () {
      var ids = (App.order || []).filter(function (id) { return id !== 'home' && App.modules[id]; });
      var cells = ids.map(function (id) {
        var m = App.modules[id];
        return '<button class="nav-card tap" data-act="goModule" data-id="' + id + '">' +
          '<span class="nc-ico">' + m.icon + '</span><span class="nc-name">' + esc(m.name) + '</span></button>';
      }).join('');
      return UI.card({ title: '🧭 全部模块', body: '<div class="nav-grid">' + cells + '</div>' });
    },

    /* ---------- 概览方块（16 个，可点击跳转） ---------- */
    overview: function () {
      var t = U.today(), ym = U.ym(), yr = U.yr();

      var habits = activeHabits();
      var hDone = habits.filter(function (h) { return isHabitDone(h.id); }).length;
      var streak = 0;
      for (var d = 0; d < 3650; d++) {
        var dd = U.shiftDay(t, -d), L = D().checkin.log[dd];
        if (L && Object.keys(L).length) streak++; else break;
      }

      var tasks = D().tasks || [];
      var st = function (x) { return x.status; };
      var dueCnt = tasks.filter(function (x) { return st(x) !== 'done' && x.due && U.dayDiff(t, x.due) >= 0; }).length;
      var overCnt = tasks.filter(function (x) { return st(x) !== 'done' && x.due && U.dayDiff(t, x.due) < 0; }).length;

      var ann = D().anniv.filter(function (x) {
        var n = U.dayDiff(t, nextDate(x));
        return n >= 0 && n <= 30;
      }).length;

      var consum = D().items.consum.slice().sort(function (a, b) { return consumDue(a) - consumDue(b); })
        .filter(function (x) { var n = consumDue(x); return n <= 3 && n >= -14; }).length;

      var workToday = (D().worklog || []).filter(function (x) { return x.date === t; }).length;
      var mediaY = (D().media || []).filter(function (x) { return x.end && U.yr(x.end) === yr; }).length;

      var wm = U.sortBy((D().body.measures || []).filter(function (x) { return num(x.weight) > 0; }), 'date', true)[0];
      var weight = wm ? wm.weight + 'kg' : '—';

      var water = num(D().body.water[t]);
      var wGoal = num(D().body.waterGoal) || 2000;

      var buy = (D().items.buy || []).filter(function (x) { return !x.done; }).length;
      var stockLow = (D().items.stock || []).filter(function (x) { return U.itemLow(x); }).length;

      var flows = D().finance.flows || [];
      var mf = flows.filter(function (f) { return U.ym(f.date) === ym; });
      var inc = mf.filter(function (f) { return f.type === 'in'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
      var exp = mf.filter(function (f) { return f.type === 'out'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
      var balance = inc - exp;

      var examUp = (D().exam.exams || []).filter(function (x) { return x.date >= t; }).length;
      var diaryM = (D().diary.entries || []).filter(function (x) { return U.ym(x.date) === ym; }).length;

      // 今天看书时长（书籍 readLogs 当日分钟合计）
      var readMins = (D().media || []).filter(function (x) { return x.type === 'book'; }).reduce(function (s, x) {
        return s + (x.readLogs || []).filter(function (l) { return l.d === t; }).reduce(function (a, l) { return a + num(l.mins); }, 0);
      }, 0);

      var items = [
        { v: hDone + '/' + habits.length, k: '今日打卡', go: 'checkin', ok: habits.length > 0 && hDone === habits.length },
        { v: dueCnt, k: '今日待办', go: 'tasks' },
        { v: overCnt, k: '逾期待办', go: 'tasks', warn: overCnt > 0 },
        { v: ann, k: '30天纪念日', go: 'anniv' },
        { v: consum, k: '近3天耗材', go: 'items', tk: 'main', tv: 'consum', warn: consum > 0 },
        { v: workToday, k: '今日工作', go: 'worklog' },
        { v: mediaY, k: '今年影剧书', go: 'media' },
        { v: weight, k: '最新体重', go: 'body', tk: 'main', tv: 'measure' },
        { v: water + 'ml', k: '今日饮水', go: 'body', tk: 'main', tv: 'water', ok: wGoal && water >= wGoal },
        { v: buy, k: '待购清单', go: 'items', tk: 'main', tv: 'buy' },
        { v: stockLow, k: '库存预警', go: 'items', tk: 'main', tv: 'stock', warn: stockLow > 0 },
        { k: '本月收支', go: 'finance', dual: [
          ['支', U.money(exp), false, U.moneyFull(exp)],
          ['余', U.money(balance), balance < 0, U.moneyFull(balance)]
        ] },
        { v: examUp, k: '备考进行', go: 'exam' },
        { v: fmtDur(readMins), k: '今天看书时长', go: 'media', tk: 'type', tv: 'book' },
        { v: diaryM, k: '本月日记', go: 'diary' }
      ];
      return '<div class="ov-grid">' + items.map(function (o) {
        var inner = o.dual
          ? '<span class="ov-vs">' + o.dual.map(function (p) {
              return '<span class="ov-line">' + esc(p[0]) + ' <b' + (p[2] ? ' class="neg"' : '') + (p[3] ? ' title="' + esc(p[3]) + '"' : '') + '>' + esc('' + p[1]) + '</b></span>';
            }).join('') + '</span>'
          : '<span class="ov-v"' + (o.full ? ' title="' + esc(o.full) + '"' : '') + '>' + esc('' + o.v) + '</span>';
        return '<button class="ov tap' + (o.dual ? ' dual' : '') + (o.warn ? ' warn' : '') + (o.ok ? ' ok' : '') + (o.neg ? ' neg' : '') + '" data-act="goStat" data-go="' + o.go + '"' +
          (o.tk ? ' data-tk="' + o.tk + '" data-tv="' + o.tv + '"' : '') + '>' +
          inner + '<span class="ov-k">' + o.k + '</span></button>';
      }).join('') + '</div>';
    },

    acts: {
      qnew: function (t) {
        var m = App.modules[t.dataset.mod];
        var fn = (m && m.acts && m.acts[t.dataset.mact]) || (App.modules.home && App.modules.home.acts[t.dataset.mact]);
        if (fn) fn();
      },
      // 记喝水：累计模式 + 预设水量快捷胶囊 + 自定义（可负数）+ 明细列表
      // 明细写入 body.waterLog，实时同步到「身材管理 · 饮水打卡」
      homeWater: function () {
        var today = U.today();
        var el = UI.sheet('💧 记喝水', '', '<button class="btn ghost tap" data-x>关闭</button>');
        var expanded = false;
        function presetsHtml() {
          var presets = Water.presets();
          if (!presets.length) return '<div class="small muted" style="text-align:center">暂无快捷水量预设，请在下方「管理预设」添加</div>';
          return presets.map(function (n) { return '<button class="chip tap" data-act="hwadd" data-n="' + n + '">+' + n + ' ml</button>'; }).join('');
        }
        function paint() {
          var cur = num(D().body.water[today]);
          var goal = num(D().body.waterGoal) || 2000;
          var pct = goal ? Math.min(100, cur / goal * 100) : 0;
          var logHtml = Water.renderLog(today, { expanded: expanded, act: 'hwExpAll', delAct: 'hwdel' });
          el.querySelector('.modal-body').innerHTML =
            '<div style="text-align:center;margin-bottom:14px">' +
            '<div style="font-size:30px;font-weight:700;color:#3E7D26">' + cur + '<span style="font-size:14px;color:#9A8A85"> / ' + goal + ' ml</span></div>' +
            '<div style="margin:8px 0 6px">' + UI.bar(pct, true) + '</div>' +
            '<div class="small muted">今日已喝 <b>' + cur + ' ml</b>，点快捷水量累计添加（可多次）</div></div>' +
            '<div class="chip-row" style="gap:8px;flex-wrap:wrap;justify-content:center">' + presetsHtml() + '</div>' +
            '<div style="height:12px"></div>' +
            '<div class="quick-add" style="margin-bottom:6px">' +
            '<input class="input" id="hwCustom" type="number" inputmode="numeric" placeholder="自定义水量（可填负数，如 -200）">' +
            '<button class="btn primary tap" data-act="hwcustom">添加</button></div>' +
            '<div class="row between" style="margin:2px 0 4px;align-items:center">' +
            '<span class="small muted">今日喝水明细（同步到「身材管理」）</span>' +
            '<button class="link-btn tap small" data-act="hwPreset">管理预设</button></div>' +
            logHtml;
        }
        paint();
        el.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-x]')) { el.remove(); UI.unlock(); App.refresh(); return; }
          var hw = ev.target.closest('[data-act="hwadd"]');
          if (hw) {
            ev.stopPropagation();
            var n = num(hw.dataset.n);
            Water.add(today, n);
            U.toast('已记录 +' + n + ' ml');
            paint(); App.refresh();
            return;
          }
          if (ev.target.closest('[data-act="hwcustom"]')) {
            ev.stopPropagation();
            var inp = el.querySelector('#hwCustom');
            var v = num(inp.value);
            if (!inp.value.trim() || v === 0) { U.toast('请输入本次水量'); inp.focus(); return; }
            Water.add(today, v);
            U.toast((v < 0 ? '已减少 ' : '已记录 +') + Math.abs(v) + ' ml');
            paint(); App.refresh();
            return;
          }
          var dl = ev.target.closest('[data-act="hwdel"]');
          if (dl) {
            ev.stopPropagation();
            Water.del(today, dl.dataset.id);
            paint(); App.refresh();
            return;
          }
          if (ev.target.closest('[data-act="hwExpAll"]')) {
            ev.stopPropagation();
            expanded = !expanded;
            paint();
            return;
          }
          if (ev.target.closest('[data-act="hwPreset"]')) {
            ev.stopPropagation();
            App.modules.life.acts.waterPreset && App.modules.life.acts.waterPreset();
            return;
          }
        });
      },
      mnew: function () {
        var types = [{ k: 'movie', t: '电影', i: '🎬' }, { k: 'tv', t: '电视剧', i: '📺' }, { k: 'book', t: '书籍', i: '📖' }];
        var body = '<div class="list">' + types.map(function (o) {
          return '<button type="button" class="opt-row tap pick-m" data-k="' + o.k + '"><span class="oi">' + o.i + '</span>' +
            '<span class="grow"><strong>' + o.t + '</strong></span><span class="badge grey">记录</span></button>';
        }).join('') + '</div>';
        var el = UI.sheet('影剧书记录 · 选择类型', '<p class="small muted" style="margin-bottom:10px">要记录哪一种？</p>' + body,
          '<button class="btn ghost tap" data-x>取消</button>');
        el.addEventListener('click', function (e) {
          var b = e.target.closest('.pick-m'); if (!b) return;
          e.stopPropagation();
          el.remove(); UI.unlock();
          App.setTab('media', 'type', b.dataset.k);
          App.modules.media.acts.new();
        });
      },
      goStat: function (t) {
        var goM = t.dataset.go;
        if (t.dataset.tk) App.setTab(goM, t.dataset.tk, t.dataset.tv);
        App.go(goM);
      },
      goModule: function (t) { App.go(t.dataset.id); },
      go: function (t) { App.go(t.dataset.id); },

      // 记录读书时长：选择正在阅读（在读）的书，再记今日分钟数
      quickRead: function () {
        var books = (D().media || []).filter(function (x) { return x.type === 'book'; });
        if (!books.length) {
          var e0 = UI.sheet('记录读书时长', '<p class="small muted">还没有书籍记录，先去添加一本吧。</p>',
            '<button class="btn ghost tap" data-x>取消</button><button class="btn primary tap" data-act="goMedia">+ 去添加书籍</button>');
          e0.addEventListener('click', function (ev) {
            if (ev.target.closest('[data-x]')) { e0.remove(); UI.unlock(); return; }
            if (ev.target.closest('[data-act="goMedia"]')) { e0.remove(); UI.unlock(); App.setTab('media', 'type', 'book'); App.go('media'); }
          });
          return;
        }
        var reading = books.filter(function (x) { return x.status === '在读'; });
        var list = reading.length ? reading : books;
        var note = reading.length ? '' :
          '<p class="small muted" style="margin-bottom:10px">没有标记为「在读」的书，下面列出全部书籍；建议去影剧书记录把正在看的标记为「在读」，下次这里只显在看的。</p>';
        var body = note + '<div class="list">' + list.map(function (x) {
          var total = (x.readLogs || []).reduce(function (s, l) { return s + num(l.mins); }, 0);
          var sb = x.status === '在读' ? '<span class="badge info">在读</span>' :
            x.status === '已读' ? '<span class="badge">已读</span>' :
            (x.status ? '<span class="badge grey">' + esc(x.status) + '</span>' : '');
          return '<div class="item tap pick-book" data-id="' + x.id + '"><div class="item-main">' +
            '<div class="item-title">📖 ' + esc(x.title) + '</div>' +
            '<div class="item-meta">' + sb + (total > 0 ? '<span class="badge">⏱ 累计' + fmtDur(total) + '</span>' : '') + '</div></div></div>';
        }).join('') + '</div>';
        var el = UI.sheet('记录读书时长 · 选择正在阅读的书', body, '<button class="btn ghost tap" data-x>取消</button>');
        el.addEventListener('click', function (ev) {
          var b = ev.target.closest('.pick-book'); if (!b) return;
          ev.stopPropagation();
          el.remove(); UI.unlock();
          App.modules.media.acts.logtime({ dataset: { id: b.dataset.id } });
        });
      }
    }
  };
  App.register(home);

})();
