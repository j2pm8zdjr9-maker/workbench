/* ========== 1. 打卡&待办 / 12. 任务待办 / 13. 工作留痕 ========== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, TF = window.TF, D = function () { return Store.data; };

  /* =========================================================
     1. 📋 打卡（习惯打卡追踪）
  ========================================================= */
  var cur = { day: U.today() };
  var ccal = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
  function navC(n) { var d = new Date(ccal.y, ccal.m - 1 + n, 1); ccal.y = d.getFullYear(); ccal.m = d.getMonth() + 1; App.refresh(); }

  var PERIOD = {
    week: { t: '一周', d: 7 },
    month: { t: '一月', d: 30 },
    q3: { t: '三月', d: 90 },
    half: { t: '半年', d: 180 },
    year: { t: '一年', d: 365 },
    long: { t: '长期', d: 36500 }
  };
  var LEGACY = { '一周': 'week', '一个月': 'month', '一年': 'year', '长期': 'year' };
  function periodDays(v) {
    if (v.period === 'custom') return Math.max(1, num(v.customDays) || 1);
    return (PERIOD[v.period] || PERIOD.week).d;
  }
  function periodLabel(h) {
    if (!h) return '';
    if (h.ended) return '🏁 已结束';
    if (h.period === 'long') return '🗓 长期（永久）';
    if (!h.period) return h.slot ? ('🗓 ' + h.slot) : '';
    if (h.period === 'custom') return '🗓 自定义 · ' + (h.days || 0) + ' 天';
    var p = PERIOD[h.period];
    return p ? ('🗓 ' + p.t + '（' + p.d + ' 天）') : '';
  }
  function slotBadge(h) { return periodLabel(h); }
  function ymd(s) { // 永远显示 年/月/日，如 2026年8月9日
    if (!s) return '—';
    var p = ('' + s).split('-');
    return p[0] + '年' + (+p[1]) + '月' + (+p[2]) + '日';
  }
  function CI() { return D().checkin; }
  function logOf(date) { return CI().log[date] || {}; }
  function isDone(date, hid) { return !!logOf(date)[hid]; }
  function doneAt(date, hid) { return logOf(date)[hid] || ''; }
  function dayDone(date) { return Object.keys(logOf(date)).length; }
  function findHabit(id) { return (CI().habits || []).filter(function (x) { return x.id === id; })[0]; }
  function inWindow(h, date) {
    if (!h || !h.start || !h.days) return true; // 旧数据无窗口则始终显示
    if (h.ended) {
      // 已立即结束：未来的打卡任务取消（不出现）；结束当日保留记录；
      // 历史日期仅保留实际打过卡的那几天，未打卡的既往日期不再出现
      if (date > U.today()) return false;
      return date >= h.start && (date < U.today() ? !!logOf(date)[h.id] : true);
    }
    if (h.period === 'long') return date >= h.start; // 长期有效：自建立日起永久显示，建立日之前不出现
    var end = U.shiftDay(h.start, h.days - 1);
    return date >= h.start && date <= end;
  }
  function activeHabits(date) {
    return (CI().habits || []).filter(function (h) { return inWindow(h, date); });
  }

  /* ---------- 历史记录：单条打卡任务的统计与查看 ---------- */
  function habitSpan(h) {
    if (!h || !h.start) return null;
    var today = U.today();
    if (h.period === 'long') return [h.start, today];
    var span = periodDays(h); // 原始周期天数
    var wEnd = U.shiftDay(h.start, span - 1);
    if (h.ended) {
      // 已结束：按原始周期全量统计（应打卡天数=周期长度），提前结束剩余的天数记为未打卡
      return [h.start, wEnd];
    }
    var cap = wEnd < today ? wEnd : today;
    if (cap < h.start) cap = h.start;
    return [h.start, cap];
  }
  function habitStats(h) {
    var sp = habitSpan(h);
    if (!sp) return { expected: 0, done: 0, missed: 0, rate: 0, longest: 0, recent: 0, gaps: 0 };
    return computeStats(h, sp[0], sp[1]);
  }
  function computeStats(h, s, e) {
    var expected = 0, done = 0, missed = 0, longest = 0, cur = 0, gaps = 0, inGap = false;
    var d = s;
    while (d <= e) {
      expected++;
      if (logOf(d)[h.id]) { done++; cur++; if (cur > longest) longest = cur; inGap = false; }
      else { missed++; cur = 0; if (!inGap) { gaps++; inGap = true; } }
      d = U.shiftDay(d, 1);
    }
    var rate = expected ? Math.round(done / expected * 100) : 0;
    return { expected: expected, done: done, missed: missed, rate: rate, longest: longest, recent: cur, gaps: gaps };
  }
  function detailCalHTML(h, cal, s, e) {
    var y = cal.y, m = cal.m;
    var first = new Date(y, m - 1, 1), startPad = first.getDay();
    var days = new Date(y, m, 0).getDate();
    var today = U.today();
    var wd = ['日', '一', '二', '三', '四', '五', '六'].map(function (d) {
      return '<span class="cal-wd">' + d + '</span>';
    }).join('');
    var cells = wd;
    for (var i = 0; i < startPad; i++) cells += '<span class="cal-cell empty"></span>';
    for (var d = 1; d <= days; d++) {
      var ds = y + '-' + U.pad(m) + '-' + U.pad(d);
      var inWin = ds >= s && ds <= e;
      var on = inWin && !!logOf(ds)[h.id];
      var cls = 'cal-cell';
      if (!inWin) cls += ' out';
      else if (on) cls += ' has';
      else cls += ' miss';
      if (ds === today) cls += ' today';
      cells += '<span class="' + cls + '" title="' + ds + (on ? ' · 已打卡' : (inWin ? ' · 未打卡' : ' · 不在周期内')) + '">' +
        '<span class="cal-num">' + d + '</span>' +
        (on ? '<i class="cal-count">✓</i>' : (inWin ? '<i class="cal-count miss-dot">·</i>' : '')) + '</span>';
    }
    return '<div class="row between" style="margin:4px 0 2px">' +
      '<button class="btn ghost sm tap" data-act="dcalPrev">‹</button>' +
      '<strong>' + y + ' 年 ' + m + ' 月</strong>' +
      '<span><button class="btn ghost sm tap" data-act="dcalToday">今天</button>' +
      '<button class="btn ghost sm tap" data-act="dcalNext">›</button></span></div>' +
      '<div class="cal chk-cal detail-cal">' + cells + '</div>';
  }
  var chQ = ''; // 打卡历史搜索词
  var chPg = 1; // 打卡历史当前页
  var chSz = 5; // 打卡历史每页条数
  var CH_SIZES = [5, 10, 20, 50, 100];
  function openHist() {
    var prev = document.getElementById('histSheet'); if (prev) prev.remove();
    chPg = 1;
    var el = UI.sheet('打卡历史记录',
      '<div id="histTf-checkin_hist">' + TF.btn('checkin_hist') + '</div>' +
      '<div style="height:12px"></div>' +
      '<input class="input hist-search" id="histQ-checkin_hist" placeholder="🔍 搜索打卡任务名称…" value="' + esc(chQ) + '">' +
      '<div style="height:14px"></div>' +
      '<div id="histBody-checkin_hist"></div>' +
      '<div id="histPager-checkin_hist"></div>',
      '<button class="btn ghost tap" data-x>关闭</button>');
    el.id = 'histSheet';
    var bodyEl = el.querySelector('#histBody-checkin_hist');
    var pagerEl = el.querySelector('#histPager-checkin_hist');

    function pagerHTML(total, pages, pg) {
      return UI.pager({
        pg: pg, pages: pages, total: total, size: chSz, sizes: CH_SIZES,
        pageAct: 'histPage', sizeChg: 'histSize'
      });
    }

    function drawList() {
      function activeInRange(h) {
        if (TF.isAll('checkin_hist')) return true;
        var log = CI().log || {};
        for (var d in log) {
          if (!TF.inRange('checkin_hist', d)) continue;
          if (log[d] && log[d][h.id]) return true;
        }
        return false;
      }
      var q = chQ.trim().toLowerCase();
      var habits = (CI().habits || []).slice().filter(activeInRange)
        .filter(function (h) { return !q || (h.name || '').toLowerCase().indexOf(q) >= 0; });
      habits.sort(function (a, b) {
        if (!!a.ended !== !!b.ended) return a.ended ? 1 : -1; // 已结束置底
        return (b.start || '').localeCompare(a.start || '');   // 进行中按开始时间倒序
      });
      var total = habits.length;
      var pages = Math.max(1, Math.ceil(total / chSz));
      if (chPg > pages) chPg = pages;
      var pageArr = habits.slice((chPg - 1) * chSz, chPg * chSz);
      var body;
      if (!total) body = UI.empty(!TF.isAll('checkin_hist') ? '该时间段内没有打卡记录' : (!q ? '还没有任何打卡任务' : '没有匹配的打卡任务'), '✅');
      else body = '<div class="list">' + pageArr.map(function (h) {
        var sb = slotBadge(h), st = habitStats(h);
        var daterange = '开始于 ' + ymd(h.start) + (h.ended ? ' · 结束于 ' + ymd(h.end) : '');
        return '<div class="item"><div class="item-main">' +
          '<div class="item-title">' + esc(h.name) + (h.ended ? ' <span class="badge grey">已结束</span>' : '') + '</div>' +
          '<div class="item-meta">' + (sb ? '<span class="badge grey">' + sb + '</span>' : '') +
          '<span class="badge grey">打卡 ' + st.done + '/' + st.expected + ' 天</span>' +
          (st.missed ? '<span class="badge grey">断卡 ' + st.missed + ' 天</span>' : '') + '</div>' +
          '<div class="small muted" style="margin-top:5px">' + daterange + '</div>' +
          '</div>' +
          '<div class="item-ops">' +
          '<button class="link-btn tap" data-act="histView" data-id="' + h.id + '">查看</button>' +
          (h.ended
            ? '<button class="link-btn tap" data-act="histRestore" data-id="' + h.id + '">↩ 恢复</button>'
            : '<button class="link-btn tap" data-act="histEnd" data-id="' + h.id + '">立即结束</button>') +
          '<button class="link-btn del tap" data-act="histDel" data-id="' + h.id + '">删除</button>' +
          '</div></div>';
      }).join('') + '</div>';
      bodyEl.innerHTML = body;
      pagerEl.innerHTML = pagerHTML(total, pages, chPg);
    }

    function renderTf() {
      var tf = el.querySelector('#histTf-checkin_hist');
      if (tf) tf.innerHTML = TF.btn('checkin_hist');
    }

    drawList();

    var qe = el.querySelector('#histQ-checkin_hist');
    if (qe) qe.oninput = function () { chQ = this.value; chPg = 1; drawList(); };

    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      var act = t.dataset.act;
      if (act === 'tfOpen') { e.preventDefault(); TF.open('checkin_hist', { onChange: function () { chPg = 1; renderTf(); drawList(); } }); return; }
      if (act === 'histPage') { e.preventDefault(); chPg = +t.dataset.k; drawList(); return; }
      if (act === 'histView') {
        e.preventDefault();
        var g = TF.get('checkin_hist');
        var rng = (g.from || g.to) ? { from: g.from, to: g.to } : null;
        openHistDetail(t.dataset.id, rng); return;
      }
      /* 历史记录内「恢复 / 立即结束」，与打卡页逻辑保持一致 */
      if (act === 'histRestore') {
        e.preventDefault();
        var hr = findHabit(t.dataset.id); if (!hr) return;
        hr.ended = false; delete hr.end;
        Store.save(); App.refresh(); drawList(); U.toast('已恢复「' + hr.name + '」');
        return;
      }
      if (act === 'histEnd') {
        e.preventDefault();
        var he = findHabit(t.dataset.id); if (!he) return;
        UI.confirm('立即结束该打卡任务？', '「' + he.name + '」结束后，将从今天起不再出现在打卡任务列表中；已产生的历史打卡记录仍然保留，可在日历的历史日期中查看。', '立即结束', true).then(function (ok) {
          if (!ok) return;
          he.ended = true; he.end = U.today();
          Store.save(); App.refresh(); drawList(); U.toast('已结束「' + he.name + '」');
        });
        return;
      }
      if (act === 'histDel') {
        e.preventDefault();
        var id = t.dataset.id, h = findHabit(id); if (!h) return;
        UI.del(h.name, function () {
          CI().habits = CI().habits.filter(function (x) { return x.id !== h.id; });
          Object.keys(CI().log || {}).forEach(function (d) { if (CI().log[d] && CI().log[d][h.id]) delete CI().log[d][h.id]; });
          Store.save(); chPg = 1; drawList(); App.refresh(); U.toast('已删除');
        });
        return;
      }
      var fn = checkin.acts[act]; if (fn) { e.preventDefault(); fn(t, e); }
    });
    if (pagerEl) pagerEl.addEventListener('change', function (e) {
      if (e.target.matches('[data-chg="histSize"]')) { chSz = +e.target.value; chPg = 1; drawList(); }
    });
    return el;
  }
  function openHistDetail(id, rng) {
    var h = findHabit(id); if (!h) return;
    var sp = habitSpan(h);
    var s = (rng && rng.from) ? rng.from : (sp ? sp[0] : h.start);
    var e = (rng && rng.to) ? rng.to : (sp ? sp[1] : h.start);
    var st = computeStats(h, s, e);
    var sb = slotBadge(h);
    var status = h.ended ? '🏁 已结束' : (h.period === 'long' ? '♾ 长期有效' : '🟢 进行中');
    var today = U.today();
    var defDate = (s <= today && today <= e) ? today : e;
    var dp = defDate.split('-');
    var cal = { y: +dp[0], m: +dp[1] };
    function calWrap() { return '<div id="dcalWrap">' + detailCalHTML(h, cal, s, e) + '</div>'; }
    var rngNote = (rng && rng.from) ? '<span class="badge grey">统计区间 ' + U.fmtDate(rng.from) + ' ~ ' + U.fmtDate(rng.to) + '</span>' : '';
    var body =
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      (sb ? '<span class="badge grey">' + sb + '</span>' : '') +
      '<span class="badge info">' + status + '</span>' +
      '<span class="badge grey">开始于 ' + U.fmtDate(h.start) + '</span>' + rngNote + '</div>' +
      UI.stats([
        ['打卡天数', st.done + ' 天', st.done > 0],
        ['应打卡天数', st.expected + ' 天'],
        ['断卡天数', st.missed + ' 天', st.missed > 0],
        ['断卡次数', st.gaps + ' 次'],
        ['完成率', st.rate + '%'],
        ['最长连续', st.longest + ' 天'],
        ['最近连续', st.recent + ' 天']
      ]) +
      '<div class="small muted" style="margin:12px 0 4px">打卡日历 · 绿块=已打卡，灰块=未打卡，暗块=不在周期内</div>' +
      calWrap();
    var sheet = UI.sheet('打卡详情 · ' + h.name, body, '<button class="btn ghost tap" data-x>关闭</button>');
    sheet.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]'); if (!t) return;
      var a = t.dataset.act;
      if (a === 'dcalPrev') { var d = new Date(cal.y, cal.m - 2, 1); cal.y = d.getFullYear(); cal.m = d.getMonth() + 1; }
      else if (a === 'dcalNext') { var d2 = new Date(cal.y, cal.m, 1); cal.y = d2.getFullYear(); cal.m = d2.getMonth() + 1; }
      else if (a === 'dcalToday') { cal.y = new Date().getFullYear(); cal.m = new Date().getMonth() + 1; }
      else return;
      ev.preventDefault();
      var w = sheet.querySelector('#dcalWrap'); if (w) w.innerHTML = detailCalHTML(h, cal, s, e);
    });
  }
  function totalChecks() {
    var s = 0, log = CI().log || {};
    Object.keys(log).forEach(function (k) { s += Object.keys(log[k] || {}).length; });
    return s;
  }
  function streakDays() {
    var n = 0, d = U.today();
    while (true) {
      var rec = CI().log[d];
      if (rec && Object.keys(rec).length > 0) { n++; d = U.shiftDay(d, -1); }
      else break;
    }
    return n;
  }
  function habitFields() {
    return [
      { k: 'name', label: '打卡任务', req: true, ph: '如：喝水 / 运动 / 读书 / 护肤', full: true },
      { k: 'period', label: '打卡时间段', type: 'select', def: 'week', options: [
        { v: 'week', t: '一周（7 天）' },
        { v: 'month', t: '一月（30 天）' },
        { v: 'q3', t: '三月（90 天）' },
        { v: 'half', t: '半年（180 天）' },
        { v: 'year', t: '一年（365 天）' },
        { v: 'long', t: '长期（永久有效，从建立起一直持续）' },
        { v: 'custom', t: '自定义天数' }
      ] },
      { k: 'customDays', label: '自定义打卡天数', type: 'number', min: 1, ph: '如：100', hint: '选择「自定义天数」时填写' }
    ];
  }

  var checkin = {
    id: 'checkin', icon: '✅', name: '打卡',

    render: function () {
      var active = activeHabits(U.today());
      var total = active.length;
      var tDone = active.filter(function (h) { return isDone(U.today(), h.id); }).length;
      return UI.head('✅ 打卡', '坚持每天的小习惯，积少成多') +
        UI.stats([
          ['打卡任务', total],
          ['今日完成', tDone + '/' + total, total > 0 && tDone === total],
          ['连续打卡', streakDays() + ' 天'],
          ['累计打卡', totalChecks()]
        ]) + this.daily();
    },

    /* 时间段打卡明细：逐日列出区间内每天的打卡完成情况 */
    rangeView: function (from, to) {
      if (!from || !to) return UI.empty('请选择开始与结束日期', '🗓');
      var d = from, html = '';
      while (d <= to) {
        var day = d;
        var habits = (CI().habits || []).filter(function (h) { return inWindow(h, day); });
        var done = habits.filter(function (h) { return isDone(day, h.id); }).length;
        var total = habits.length;
        var items = habits.length ? habits.map(function (h) {
          var on = isDone(day, h.id);
          return '<div class="item' + (on ? ' done' : '') + '">' +
            UI.check(on, 'noop', h.id) +
            '<div class="item-main"><div class="item-title">' + esc(h.name) + '</div>' +
            '<div class="item-meta"><span class="badge' + (on ? '' : ' grey') + '">' + (on ? '已打卡' : '未打卡') + '</span>' +
            (h.ended ? '<span class="badge grey">已结束</span>' : '') + '</div></div></div>';
        }).join('') : '<div class="small muted" style="padding:6px 0">无进行中的打卡任务</div>';
        html += '<div class="tl-day">📅 ' + U.fmtDate(day, true) + ' · 完成 ' + done + '/' + total + '</div>' + items;
        d = U.shiftDay(d, 1);
      }
      return html || UI.empty('该时间段没有打卡记录', '🌿');
    },

    daily: function () {
      var all = CI().habits || [];
      var habits = all.filter(function (h) { return inWindow(h, cur.day); });
      // 已完成（当日已打卡）沉底，未完成排前，方便一眼看到哪些没完成
      habits.sort(function (a, b) {
        var da = isDone(cur.day, a.id) ? 1 : 0;
        var db = isDone(cur.day, b.id) ? 1 : 0;
        if (da !== db) return da - db;
        return (a.start || '').localeCompare(b.start || '');
      });
      var total = habits.length;
      var isToday = cur.day === U.today();
      var done = habits.filter(function (h) { return isDone(cur.day, h.id); }).length;

      function renderHabit(h) {
        var on = isDone(cur.day, h.id), at = doneAt(cur.day, h.id), sb = slotBadge(h);
        if (!isToday) {
          return '<div class="item' + (on ? ' done' : '') + '">' +
            '<span class="tl-dot"></span>' +
            '<div class="item-main"><div class="item-title">' + esc(h.name) + '</div>' +
            '<div class="item-meta">' + (sb ? '<span class="badge grey">' + sb + '</span>' : '') +
            (on && at ? '<span class="badge grey">⏰ ' + at + '</span>' : '') + '</div></div>' +
            '<span class="badge' + (on ? '' : ' grey') + '">' + (on ? '已打卡' : '未打卡') + '</span></div>';
        }
        var endBtn = h.ended
          ? '<button class="link-btn tap" data-act="restoreHabit" data-id="' + h.id + '">↩ 恢复</button>'
          : '<button class="link-btn tap" data-act="endHabit" data-id="' + h.id + '">立即结束</button>';
        return '<div class="item' + (on ? ' done' : '') + '">' + UI.check(on, 'toggle', h.id) +
          '<div class="item-main"><div class="item-title">' + esc(h.name) + '</div>' +
          '<div class="item-meta">' + (sb ? '<span class="badge grey">' + sb + '</span>' : '') +
          (on && at ? '<span class="badge grey">⏰ ' + at + '</span>' : '') + '</div></div>' +
          UI.ops(h.id, 'editHabit', 'delHabit', endBtn) + '</div>';
      }

      var body =
        '<div class="row between" style="margin-bottom:4px">' +
        '<button class="btn sm ghost tap" data-act="prev">‹ 前一天</button>' +
        '<div style="text-align:center"><div style="font-weight:650">' + U.fmtDate(cur.day, true) + '</div>' +
        '<div class="small muted">' + (isToday ? '今天' : U.relDay(cur.day)) + '</div></div>' +
        '<button class="btn sm ghost tap" data-act="next"' + (isToday ? ' disabled' : '') + '>后一天 ›</button></div>' +
        (isToday ? '' : '<div class="row" style="margin-bottom:8px"><button class="link-btn tap" data-act="today">↩ 回到今天</button></div>') +
        (habits.length ?
          '<div class="list" style="margin-top:4px">' + ListPager.slice('checkin:list', habits).map(renderHabit).join('') + '</div>' + ListPager.pager('checkin:list', habits.length) :
          (all.length ? UI.empty('「' + U.fmtDate(cur.day, true) + '」没有进行中的打卡任务', '🌿')
                      : UI.empty('还没有打卡任务，点右上角「+ 新增打卡」开始', '🌿', { desc: '每天完成一个小习惯，长期积累就是质变' }))) +
        (total && isToday && done === total ? '<div class="accent-note" style="margin-top:8px">🎉 今日全部打卡完成，继续保持！</div>' : '');

      return UI.card({
        title: '我的打卡任务', sub: isToday ? '点击左侧圆圈完成今日打卡' : '历史记录（只读）',
        right:           '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button>' +
          '<button class="btn primary sm tap" data-act="newHabit">+ 新增打卡</button>',
        body: body, cls: 'section-gap'
      }) + this.calCard();
    },

    calCard: function () {
      var y = ccal.y, m = ccal.m;
      var first = new Date(y, m - 1, 1), startPad = first.getDay();
      var days = new Date(y, m, 0).getDate();
      var today = U.today();
      var cells = ['日', '一', '二', '三', '四', '五', '六'].map(function (d) {
        return '<span class="cal-wd">' + d + '</span>';
      }).join('');
      for (var i = 0; i < startPad; i++) cells += '<span class="cal-cell empty"></span>';
      for (var d = 1; d <= days; d++) {
        var ds = y + '-' + U.pad(m) + '-' + U.pad(d);
        var c = dayDone(ds);
        var cls = 'cal-cell tap';
        if (c > 0) cls += ' has';
        if (ds === today) cls += ' today';
        if (ds === cur.day) cls += ' on';
        cells += '<button class="' + cls + '" data-act="cday" data-d="' + ds + '">' +
          '<span class="cal-num">' + d + '</span>' +
          (c > 0 ? '<i class="cal-count">' + c + '</i>' : '') + '</button>';
      }
      return UI.card({
        title: '打卡日历', sub: '数字 = 当天打卡次数，点日期查看当天',
        body: '<div class="row between" style="margin-bottom:8px">' +
          '<button class="btn ghost sm tap" data-act="calPrev">‹</button>' +
          '<strong>' + y + ' 年 ' + m + ' 月</strong>' +
          '<span><button class="btn ghost sm tap" data-act="calToday">今天</button> ' +
          '<button class="btn ghost sm tap" data-act="calNext">›</button></span></div>' +
          '<div class="cal chk-cal">' + cells + '</div>'
      });
    },

    acts: {
      hist: function () { openHist(); },
      newHabit: function () {
        UI.form({ title: '新增打卡任务', fields: habitFields() }).then(function (v) {
          if (!v) return;
          v.id = U.uid(); v.start = U.today(); v.days = periodDays(v);
          CI().habits.push(v); Store.save(); App.refresh(); U.toast('已添加');
        });
      },
      editHabit: function (t) {
        var h = findHabit(t.dataset.id);
        if (!h) return;
        var vals = {
          name: h.name,
          period: h.period || LEGACY[h.slot] || 'week',
          customDays: h.period === 'custom' ? (h.days || '') : ''
        };
        UI.form({ title: '编辑打卡任务', fields: habitFields(), values: vals }).then(function (v) {
          if (!v) return;
          h.name = v.name; h.period = v.period; h.days = periodDays(v);
          if (!h.start) h.start = U.today();
          Store.save(); App.refresh();
        });
      },
      delHabit: function (t) {
        var h = findHabit(t.dataset.id);
        if (!h) return;
        UI.del(h.name, function () {
          CI().habits = CI().habits.filter(function (x) { return x.id !== h.id; });
          Object.keys(CI().log).forEach(function (d) { if (CI().log[d] && CI().log[d][h.id]) delete CI().log[d][h.id]; });
          Store.save(); App.refresh();
        });
      },
      endHabit: function (t) {
        var h = findHabit(t.dataset.id);
        if (!h) return;
        UI.confirm('立即结束该打卡任务？', '「' + h.name + '」结束后，将从今天起不再出现在打卡任务列表中；已产生的历史打卡记录仍然保留，可在日历的历史日期中查看。', '立即结束', true).then(function (ok) {
          if (!ok) return;
          h.ended = true; h.end = U.today();
          Store.save(); App.refresh(); U.toast('已结束「' + h.name + '」');
        });
      },
      restoreHabit: function (t) {
        var h = findHabit(t.dataset.id);
        if (!h) return;
        h.ended = false; delete h.end;
        Store.save(); App.refresh(); U.toast('已恢复「' + h.name + '」');
      },
      toggle: function (t) {
        if (cur.day !== U.today()) return;
        var id = t.dataset.id, L = CI().log, rec = L[cur.day] || (L[cur.day] = {});
        if (rec[id]) delete rec[id]; else rec[id] = U.nowTime();
        Store.save(); App.refresh();
      },
      prev: function () { cur.day = U.shiftDay(cur.day, -1); App.refresh(); },
      next: function () { if (cur.day < U.today()) { cur.day = U.shiftDay(cur.day, 1); App.refresh(); } },
      today: function () { cur.day = U.today(); App.refresh(); },
      jump: function (t) { cur.day = t.dataset.d; App.refresh(); },
      calPrev: function () { navC(-1); },
      calNext: function () { navC(1); },
      calToday: function () { cur.day = U.today(); ccal.y = new Date().getFullYear(); ccal.m = new Date().getMonth() + 1; App.refresh(); },
      cday: function (t) { cur.day = t.dataset.d; App.refresh(); }
    },

    mount: function () {}
  };
  App.register(checkin);

  /* =========================================================
     12. 📌 任务待办（全功能）
  ========================================================= */
  var PRIO = { high: { t: '高', c: 'danger' }, mid: { t: '中', c: 'warn' }, low: { t: '低', c: 'grey' } };
  var REPEAT = { none: '不重复', day: '每天', week: '每周', month: '每月' };
  function taskDate(x) { return x.due || x.doneAt || x.created || ''; }

  /* 任务筛选态：待办 / 进行中 / 已完成 / 全部。逾期任务仍按「待办」展示，并在统计中标红。 */
  function taskSt() {
    return App.tab('tasks', 'st', 'all');
  }

  function renderTaskItem(x) {
    var isDone = x.status === 'done';
    var expanded = !!taskExp[x.id];
    var dueTag = '';
    if (x.due) {
      var n = U.dayDiff(U.today(), x.due);
      var cls = isDone ? 'grey' : n < 0 ? 'danger' : n <= 1 ? 'warn' : 'grey';
      dueTag = '<span class="badge ' + cls + '">📅 ' + U.fmtDate(x.due) + (isDone ? '' : ' · ' + U.relDay(x.due)) + '</span>';
    }
    var subs = x.subs || [];
    var sd = subs.filter(function (s) { return s.done; }).length;
    var meta = '<div class="item-meta">' +
      '<span class="badge ' + PRIO[x.prio || 'mid'].c + '">' + PRIO[x.prio || 'mid'].t + '优先</span>' +
      (x.status === 'doing' ? '<span class="badge info">进行中</span>' : '') +
      (x.tag ? '<span class="badge">#' + esc(x.tag) + '</span>' : '') +
      dueTag +
      (x.repeat && x.repeat !== 'none' ? '<span class="badge grey">🔁 ' + REPEAT[x.repeat] + '</span>' : '') +
      (subs.length ? '<span class="badge grey">子任务 ' + sd + '/' + subs.length + '</span>' : '') +
      '</div>';
    var caret = '<span style="flex-shrink:0;color:#bbb;font-size:12px;margin-left:6px">' + (expanded ? '▾' : '▸') + '</span>';
    var titleRow = '<div class="row between" style="align-items:center"><div class="item-title" style="min-width:0">' + esc(x.title) + '</div>' + caret + '</div>';
    if (!expanded) {
      return '<div class="item' + (isDone ? ' done' : '') + '" data-act="texpand" data-id="' + x.id + '">' +
        UI.check(isDone, 'done', x.id) +
        '<div class="item-main">' + titleRow + meta + '</div></div>';
    }
    var subHtml = subs.length ? '<div class="subs">' + subs.map(function (s) {
      return '<div class="sub' + (s.done ? ' done' : '') + '">' + UI.check(s.done, 'sub', x.id + '|' + s.id, true) +
        '<span class="grow">' + esc(s.t) + '</span>' +
        '<button class="link-btn del tap" data-act="subdel" data-id="' + x.id + '|' + s.id + '">×</button></div>';
    }).join('') + '</div>' : '';
    return '<div class="item' + (isDone ? ' done' : '') + ' open" data-act="texpand" data-id="' + x.id + '">' +
      UI.check(isDone, 'done', x.id) +
      '<div class="item-main">' + titleRow + meta +
      (x.desc ? '<div class="item-note">' + esc(x.desc) + '</div>' : '') +
      subHtml +
      '<div class="row" style="margin-top:8px;gap:4px">' +
      '<button class="link-btn tap" data-act="subadd" data-id="' + x.id + '">+ 子任务</button>' +
      (x.status !== 'doing' && !isDone ? '<button class="link-btn tap" data-act="doing" data-id="' + x.id + '">标为进行中</button>' : '') +
      '</div></div>' + UI.ops(x.id, 'edit', 'del') + '</div>';
  }

  function nextDue(due, rep) {
    if (!due || rep === 'none' || !rep) return '';
    var d = U.parseDate(due);
    if (rep === 'day') d.setDate(d.getDate() + 1);
    if (rep === 'week') d.setDate(d.getDate() + 7);
    if (rep === 'month') d.setMonth(d.getMonth() + 1);
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  }

  function taskFields(v) {
    return [
      { k: 'title', label: '任务名称', req: true, ph: '要做什么', full: true },
      { k: 'prio', label: '优先级', type: 'select', options: [{ v: 'high', t: '高' }, { v: 'mid', t: '中' }, { v: 'low', t: '低' }], def: 'mid' },
      { k: 'status', label: '状态', type: 'select', options: [{ v: 'todo', t: '待办' }, { v: 'doing', t: '进行中' }, { v: 'done', t: '已完成' }], def: 'todo' },
      { k: 'due', label: '截止日期', type: 'date' },
      { k: 'repeat', label: '重复周期', type: 'select', options: Object.keys(REPEAT).map(function (k) { return { v: k, t: REPEAT[k] }; }), def: 'none' },
      Cats.field('taskTags', '分类标签', { k: 'tag' }),
      { k: 'desc', label: '备注说明', type: 'textarea', ph: '补充信息、执行思路…' }
    ];
  }

  var tcal = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
  function navT(n) { var d = new Date(tcal.y, tcal.m - 1 + n, 1); tcal.y = d.getFullYear(); tcal.m = d.getMonth() + 1; App.refresh(); }
  var tCur = { day: U.today() };   // 任务列表当前查看的日期
  var taskExp = {};                // 任务列表展开状态（按 id）
  function tDayNav() {
    var d = tCur.day, isToday = d === U.today();
    return '<div class="row between" style="margin-bottom:14px">' +
      '<button class="btn sm ghost tap" data-act="tprev">‹ 前一天</button>' +
      '<div style="text-align:center"><div style="font-weight:650">' + U.fmtDate(d, true) + '</div>' +
      '<div class="small muted">' + (isToday ? '今天' : U.relDay(d)) + '</div></div>' +
      '<button class="btn sm ghost tap" data-act="tnext"' + (isToday ? ' disabled' : '') + '>后一天 ›</button></div>' +
      (isToday ? '' : '<div class="row" style="margin-bottom:12px"><button class="link-btn tap" data-act="ttoday">↩ 回到今天</button></div>');
  }
  // 某一天相关的任务：未完成的（todo/doing）自创建日起延续显示，直到点击完成；
  // 已完成任务仅在该完成日（doneAt=day）当天显示，此前显示为未完成、此后不再出现在当日
  function tasksForDay(day) {
    return (D().tasks || []).filter(function (x) {
      if ((x.created || '') > day) return false;
      if (x.status === 'done') return (x.doneAt || '') >= day; // 完成日当日及之后才算完成；之前按未完成显示
      return true; // todo/doing 均为未完成态，当日有效
    });
  }
  function tasksDoneOn(date) {
    return (D().tasks || []).filter(function (x) { return x.status === 'done' && x.doneAt === date; });
  }
  function taskDaySheet(date) {
    var arr = tasksDoneOn(date);
    var body = arr.length ? '<div class="list">' + arr.map(function (x) {
      return '<div class="item done">' +
        '<div class="item-main">' +
        '<div class="item-title">' + esc(x.title) + '</div>' +
        '<div class="item-meta">' +
        '<span class="badge ' + PRIO[x.prio || 'mid'].c + '">' + PRIO[x.prio || 'mid'].t + '优先</span>' +
        (x.tag ? '<span class="badge">#' + esc(x.tag) + '</span>' : '') +
        (x.due ? '<span class="badge grey">📅 ' + U.fmtDate(x.due) + '</span>' : '') +
        '</div>' +
        (x.desc ? '<div class="item-note">' + esc(x.desc) + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div>' : UI.empty('「' + U.fmtDate(date, true) + '」没有完成任务', '📌');
    UI.sheet(U.fmtDate(date, true) + ' · 完成任务', body,
      '<button class="btn ghost tap" data-x>关闭</button>');
  }

  var tasks = {
    id: 'tasks', icon: '📌', name: '任务待办',

    render: function () {
      var st = taskSt();
      var tag = Cats.sel('taskTags');
      var all = D().tasks;
      var overdue = all.filter(function (x) { return x.due && x.status !== 'done' && U.dayDiff(U.today(), x.due) < 0; }).length;
      var todayN = all.filter(function (x) { return x.due === U.today() && x.status !== 'done'; }).length;

      return UI.head('📌 任务待办', '待办 = 还没开始办；逾期的任务会在此处标红') +
        UI.stats([
          ['进行中', all.filter(function (x) { return x.status === 'doing'; }).length],
          ['今日到期', todayN, todayN > 0],
          ['已逾期', overdue],
          ['已完成', all.filter(function (x) { return x.status === 'done'; }).length]
        ]) +
        UI.card({
          title: '任务列表',
          right: Cats.btn('taskTags', '分类标签') +
            '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button>' +
            '<button class="btn primary sm tap" data-act="new">+ 新建任务</button>',
          body: tDayNav() +
            UI.tabs([
              { k: 'todo', t: '待办' }, { k: 'doing', t: '进行中' },
              { k: 'done', t: '已完成' }, { k: 'all', t: '全部' }
            ], st, 'st') +
            '<div style="height:14px"></div>' +
            Cats.filterBar('taskTags', { label: '标签' }) +
            '<div id="tlist">' + this.list() + '</div>'
        }) + this.calCard();
    },

    calCard: function () {
      var y = tcal.y, m = tcal.m;
      var first = new Date(y, m - 1, 1), startPad = first.getDay();
      var days = new Date(y, m, 0).getDate();
      var today = U.today();
      var cells = ['日', '一', '二', '三', '四', '五', '六'].map(function (d) {
        return '<span class="cal-wd">' + d + '</span>';
      }).join('');
      for (var i = 0; i < startPad; i++) cells += '<span class="cal-cell empty"></span>';
      for (var d = 1; d <= days; d++) {
        var ds = y + '-' + U.pad(m) + '-' + U.pad(d);
        var c = tasksDoneOn(ds).length;
        var cls = 'cal-cell tap';
        if (c > 0) cls += ' has';
        if (ds === today) cls += ' today';
        cells += '<button class="' + cls + '" data-act="tday" data-d="' + ds + '">' +
          '<span class="cal-num">' + d + '</span>' +
          (c > 0 ? '<i class="cal-count">' + c + '</i>' : '') + '</button>';
      }
      return UI.card({
        title: '任务日历', sub: '数字 = 当天完成任务数，点日期查看当天',
        body: '<div class="row between" style="margin-bottom:8px">' +
          '<button class="btn ghost sm tap" data-act="tcalPrev">‹</button>' +
          '<strong>' + y + ' 年 ' + m + ' 月</strong>' +
          '<span><button class="btn ghost sm tap" data-act="tcalToday">今天</button> ' +
          '<button class="btn ghost sm tap" data-act="tcalNext">›</button></span></div>' +
          '<div class="cal chk-cal">' + cells + '</div>'
      });
    },

    list: function () {
      var st = taskSt(), tag = Cats.sel('taskTags');
      var day = tCur.day;
      var arr = tasksForDay(day).filter(function (x) {
        if (st === 'done') {
          if (!(x.status === 'done' && (x.doneAt || '') === day)) return false; // 仅「当日完成」
        } else if (st !== 'all') {
          if (x.status !== st) return false;
        }
        if (tag.length && tag.indexOf(x.tag) < 0) return false;
        return true;
      });
      var od = { high: 0, mid: 1, low: 2 };
      arr.sort(function (a, b) {
        var s = (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0);
        if (s) return s;
        var d = (a.due || '9999').localeCompare(b.due || '9999');
        if (d) return d;
        return (od[a.prio] || 1) - (od[b.prio] || 1);
      });
      return ListPager.out({
        ns: 'tasks:list', items: arr, defSize: 5,
        empty: tCur.day === U.today() ? '没有符合条件的任务' : '「' + U.fmtDate(day, true) + '」没有符合条件的任务',
        emptyIcon: '📌',
        render: renderTaskItem
      });
    },

    mount: function () {},

    acts: {
      st: function (t) { App.setTab('tasks', 'st', t.dataset.k); ListPager.resetPg('tasks:list'); App.refresh(); },
      texpand: function (t) { taskExp[t.dataset.id] = !taskExp[t.dataset.id]; App.refresh(); },
      hist: function () {
        Hist.open({
          modId: 'tasks',
          title: '📌 任务历史记录',
          searchPh: '🔍 搜索任务名称、备注、标签…',
          pager: true, defSize: 5,
          items: function () { return D().tasks; },
          date: function (x) { return taskDate(x); },
          match: function (x, q) { return (x.title + ' ' + (x.desc || '') + ' ' + (x.tag || '')).toLowerCase().indexOf(q) >= 0; },
          sort: function (a, b) { return String(taskDate(b)).localeCompare(String(taskDate(a))); },
          empty: '没有符合条件的任务',
          extraBar: function (cur) {
            var ps = [
              { k: '', t: '全部' }, { k: 'todo', t: '待办' },
              { k: 'doing', t: '进行中' }, { k: 'done', t: '已完成' }
            ];
            return UI.pills(ps, cur === 'open' ? '' : cur, 'histFilter');
          },
          extraMatch: function (x, val) {
            if (!val || val === 'open') return true;   // 'open' 为旧值，等同全部
            return x.status === val;
          },
          extraBar2: function (cur) {
            var sel = String(cur || '').split(',').filter(Boolean);
            var all = Cats.get('taskTags');
            return '<div class="row" style="gap:8px;flex-wrap:wrap;margin:0 0 4px">' +
              '<span class="small muted">标签</span>' +
              '<button class="pill tap' + (sel.length === 0 ? ' on' : '') + '" data-act="histFilter" data-multi="1" data-k="*">全部</button>' +
              all.map(function (c) {
                return '<button class="pill tap' + (sel.indexOf(c) >= 0 ? ' on' : '') + '" data-act="histFilter" data-multi="1" data-k="' + U.esc(c) + '">' + U.esc(c) + '</button>';
              }).join('') + '</div>';
          },
          extraMatch2: function (x, val) {
            var s = String(val || '').split(',').filter(Boolean);
            return !s.length || s.indexOf(x.tag) >= 0;
          },
          render: function (x) {
            var isDone = x.status === 'done';
            return '<div class="item' + (isDone ? ' done' : '') + '">' +
              '<div class="item-main"><div class="item-title">' + esc(x.title) + '</div>' +
              '<div class="item-meta">' +
              '<span class="badge ' + PRIO[x.prio || 'mid'].c + '">' + PRIO[x.prio || 'mid'].t + '优先</span>' +
              (x.status === 'doing' ? '<span class="badge info">进行中</span>' : '') +
                      (x.tag ? '<span class="badge">#' + esc(x.tag) + '</span>' : '') +
              (x.due ? '<span class="badge grey">📅 ' + U.fmtDate(x.due) + '</span>' : '') +
              '</div>' +
              (x.desc ? '<div class="item-note">' + esc(x.desc) + '</div>' : '') +
              '</div>' + UI.ops(x.id, null, 'hdel') + '</div>';
          },
          acts: {
            hdel: function (t, e, redraw) {
              var x = D().tasks.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!x) return;
              UI.del(esc(x.title), function () {
                D().tasks = D().tasks.filter(function (a) { return a.id !== x.id; });
                Store.save();
                if (redraw) redraw();
              });
            }
          }
        });
      },
      tprev: function () { tCur.day = U.shiftDay(tCur.day, -1); ListPager.resetPg('tasks:list'); App.refresh(); },
      tnext: function () { tCur.day = U.shiftDay(tCur.day, 1); ListPager.resetPg('tasks:list'); App.refresh(); },
      ttoday: function () { tCur.day = U.today(); ListPager.resetPg('tasks:list'); App.refresh(); },
      tcalPrev: function () { navT(-1); },
      tcalNext: function () { navT(1); },
      tcalToday: function () { tcal.y = new Date().getFullYear(); tcal.m = new Date().getMonth() + 1; tCur.day = U.today(); App.refresh(); },
      tday: function (t) { tCur.day = t.dataset.d; ListPager.resetPg('tasks:list'); App.refresh(); },
      new: function () {
        UI.form({ title: '新建任务', fields: taskFields() }).then(function (v) {
          if (!v) return;
          v.id = U.uid(); v.subs = []; v.created = U.today();
          D().tasks.push(v); Store.save(); App.refresh(); U.toast('任务已添加');
        });
      },
      edit: function (t) {
        var x = D().tasks.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑任务', fields: taskFields(), values: x }).then(function (v) {
          if (!v) return;
          Object.keys(v).forEach(function (k) { x[k] = v[k]; });
          Store.save(); App.refresh();
        });
      },
      del: function (t) {
        var x = D().tasks.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        UI.del(x.title, function () {
          D().tasks = D().tasks.filter(function (a) { return a.id !== x.id; });
          Store.save(); App.refresh();
        });
      },
      done: function (t) {
        var x = D().tasks.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        if (x.status === 'done') { x.status = 'todo'; x.doneAt = ''; }
        else {
          x.status = 'done'; x.doneAt = U.today();
          if (x.repeat && x.repeat !== 'none' && x.due) {
            var nd = nextDue(x.due, x.repeat);
            D().tasks.push({
              id: U.uid(), title: x.title, desc: x.desc, prio: x.prio, tag: x.tag,
              due: nd, repeat: x.repeat, status: 'todo', created: nd,
              subs: (x.subs || []).map(function (s) { return { id: U.uid(), t: s.t, done: false }; })
            });
            U.toast('已完成，下一周期任务已生成（' + U.fmtDate(nd) + '）');
          }
        }
        Store.save(); App.refresh();
      },
      doing: function (t) {
        var x = D().tasks.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        x.status = 'doing'; Store.save(); App.refresh();
      },
      subadd: function (t) {
        var x = D().tasks.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '添加子任务', fields: [{ k: 't', label: '子任务内容', req: true, full: true }] }).then(function (v) {
          if (!v) return;
          (x.subs = x.subs || []).push({ id: U.uid(), t: v.t, done: false });
          Store.save(); App.refresh();
        });
      },
      sub: function (t) {
        var p = t.dataset.id.split('|');
        var x = D().tasks.filter(function (a) { return a.id === p[0]; })[0];
        (x.subs || []).forEach(function (s) { if (s.id === p[1]) s.done = !s.done; });
        Store.save(); App.refresh();
      },
      subdel: function (t) {
        var p = t.dataset.id.split('|');
        var x = D().tasks.filter(function (a) { return a.id === p[0]; })[0];
        x.subs = (x.subs || []).filter(function (s) { return s.id !== p[1]; });
        Store.save(); App.refresh();
      }
    }
  };
  /* 任务标签筛选：多选回调（全部/固定/更多 复用全局 catPick 委托） */
  Cats.setPicker('taskTags', function () { ListPager.resetPg('tasks:list'); App.refresh(); });

  App.register(tasks);

  /* =========================================================
     13. 📝 工作留痕
  ========================================================= */
  var wState = { q: '', cat: '' };
  var wCur = { day: U.today() };   // 工作留痕当前查看的日期
  var wfMore = false;              // 历史记录分类筛选「更多」展开态
  function wDayNav() {
    var d = wCur.day, isToday = d === U.today();
    return '<div class="row between" style="margin-bottom:14px">' +
      '<button class="btn sm ghost tap" data-act="wprev">‹ 前一天</button>' +
      '<div style="text-align:center"><div style="font-weight:650">' + U.fmtDate(d, true) + '</div>' +
      '<div class="small muted">' + (isToday ? '今天' : U.relDay(d)) + '</div></div>' +
      '<button class="btn sm ghost tap" data-act="wnext"' + (isToday ? ' disabled' : '') + '>后一天 ›</button></div>' +
      (isToday ? '' : '<div class="row" style="margin-bottom:12px"><button class="link-btn tap" data-act="wtoday">↩ 回到今天</button></div>');
  }

  function wCats() { return (Store.data.workCats || []).slice(); }
  function addWCat(name) {
    name = (name || '').trim();
    if (!name) return;
    var c = wCats();
    if (c.indexOf(name) < 0) { c.push(name); Store.data.workCats = c; Store.save(); }
  }

  function wFields() {
    return [
      { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
      { k: 'cat', label: '分类', type: 'select', catns: 'workCats', options: Cats.get('workCats').map(function (c) { return { v: c, t: c }; }), def: Cats.get('workCats')[0] || '' },
      { k: 'start', label: '开始时间（几点几分）', type: 'time' },
      { k: 'end', label: '结束时间（几点几分）', type: 'time' },
      { k: 'mins', label: '时长（分钟）', type: 'number', min: 0, hint: '填了起止时间会自动计算，也可直接填' },
      { k: 'content', label: '工作内容', type: 'textarea', req: true, ph: '做了什么、进展如何、结论是什么…', rows: 5 }
    ];
  }
  function calcMins(v) {
    if (v.start && v.end) {
      var a = v.start.split(':'), b = v.end.split(':');
      var m = (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]);
      if (m < 0) m += 1440;
      return m;
    }
    return num(v.mins);
  }
  function hm(m) {
    m = Math.round(num(m));
    if (!m) return '—';
    var h = Math.floor(m / 60), mm = m % 60;
    return (h ? h + '小时' : '') + (mm ? mm + '分' : (h ? '' : '0分'));
  }

  var worklog = {
    id: 'worklog', icon: '📝', name: '工作留痕',

    render: function () {
      var all = D().worklog;
      var tot = all.reduce(function (s, x) { return s + num(x.mins); }, 0);
      var m = U.ym(), mArr = all.filter(function (x) { return U.ym(x.date) === m; });
      var mTot = mArr.reduce(function (s, x) { return s + num(x.mins); }, 0);
      var w0 = U.shiftDay(U.today(), -6);
      var wTot = all.filter(function (x) { return x.date >= w0; }).reduce(function (s, x) { return s + num(x.mins); }, 0);
      var todayArr = this.wFilteredToday();
      var dayTot = todayArr.reduce(function (s, x) { return s + num(x.mins); }, 0);
      var isToday = wCur.day === U.today();

      return UI.head('📝 工作留痕', '时间线式记录，随时回溯做过什么、花了多少时间') +
        UI.stats([[isToday ? '今日时长' : '当天时长', hm(dayTot), true], ['近 7 天', hm(wTot)], ['本月时长', hm(mTot)], ['累计时长', hm(tot)]]) +
        UI.card({
          title: '当天工作内容',
          right: Cats.btn('workCats', '工作分类') +
            '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button>' +
            '<button class="btn primary sm tap" data-act="new">+ 记一笔</button>',
          body: wDayNav() + Cats.filterBar('workCats', { label: '分类' }) + (todayArr.length ? this.list() : UI.empty(isToday ? '今天还没有工作记录，点「记一笔」开始' : '这一天还没有工作记录，点「记一笔」开始', '📝'))
        }) +
        (todayArr.length ? UI.card({ title: (isToday ? '今日' : '当天') + '分类时长占比', body: this.catStat() }) : '') +
        Cal.card({
          modId: 'worklog', title: '📅 工作日历', sub: '数字 = 当天记录条数，点日期查看当天',
          cell: function (date) { return D().worklog.filter(function (x) { return x.date === date; }).length; },
          day: function (date) {
            var arr = D().worklog.filter(function (x) { return x.date === date; })
              .sort(function (a, b) { return (b.start || '').localeCompare(a.start || ''); });
            if (!arr.length) return { title: U.fmtDate(date, true) + ' · 工作留痕', body: UI.empty('这一天没有工作记录', '📝') };
            var body = '<div class="list">' + arr.map(function (x) {
              return '<div class="item"><div class="item-main">' +
                '<div class="item-title">' + (x.cat ? esc(x.cat) : '（未分类）') + '</div>' +
                '<div class="item-meta">' +
                (x.start ? '<span>' + esc(x.start) + (x.end ? '–' + esc(x.end) : '') + '</span>' : '') +
                (num(x.mins) ? '<span class="badge grey">' + hm(x.mins) + '</span>' : '') +
                '</div>' + (x.content ? '<div class="item-note">' + esc(x.content) + '</div>' : '') +
                '</div></div>';
            }).join('') + '</div>';
            return { title: U.fmtDate(date, true) + ' · ' + arr.length + ' 条记录', body: body };
          }
        });
    },

    todayArr: function () {
      var day = wCur.day;
      return D().worklog.filter(function (x) { return x.date === day; })
        .sort(function (a, b) { return (b.start || '').localeCompare(a.start || ''); });
    },

    /* 当天记录按当前选中的分类（多选）过滤 */
    wFilteredToday: function () {
      var arr = this.todayArr();
      var wsel = Cats.sel('workCats');
      if (wsel.length) arr = arr.filter(function (x) { return wsel.indexOf(x.cat) >= 0; });
      return arr;
    },

    openHist: function () {
      var self = this;
      function workHistExtra(cur) {
        var sel = String(cur || '').split(',').filter(Boolean);
        var all = Cats.get('workCats');
        var catPin = Cats.pin('workCats');
        var fixedN = Math.max(0, catPin - 1);
        var pinned = all.slice(0, fixedN), rest = all.slice(fixedN);
        var html = '<button class="pill tap' + (sel.length === 0 ? ' on' : '') + '" data-act="histFilter" data-multi="1" data-k="*">全部分类</button>';
        pinned.forEach(function (c) {
          html += '<button class="pill tap' + (sel.indexOf(c) >= 0 ? ' on' : '') + '" data-act="histFilter" data-multi="1" data-k="' + U.esc(c) + '">' + U.esc(c) + '</button>';
        });
        if (rest.length) {
          if (wfMore) {
            html += rest.map(function (c) {
              return '<button class="pill tap' + (sel.indexOf(c) >= 0 ? ' on' : '') + '" data-act="histFilter" data-multi="1" data-k="' + U.esc(c) + '">' + U.esc(c) + '</button>';
            }).join('');
          }
          html += '<button class="pill tap' + (wfMore ? ' on' : '') + '" data-act="wfmore">更多 ▾</button>';
        }
        return '<div class="row" style="gap:8px;flex-wrap:wrap;margin:0 0 4px">' + html + '</div>';
      }
      var sheet = Hist.open({
        modId: 'worklog',
        title: '📝 工作留痕历史记录',
        searchPh: '🔍 搜内容 / 分类 / 日期 / 时间段（如 2026-08-09、09:30）',
        pager: true, defSize: 5,
        items: function () { return D().worklog; },
        date: function (x) { return x.date; },
        match: function (x, q) {
          var hay = ((x.content || '') + ' ' + (x.cat || '') + ' ' + (x.date || '') + ' ' + (x.start || '') + ' ' + (x.end || '')).toLowerCase();
          return hay.indexOf(q) >= 0;
        },
        sort: function (a, b) { return (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')); },
        empty: '该时间段内没有工作记录',
        extraBar: workHistExtra,
        extraMatch: function (x, val) {
          var s = String(val || '').split(',').filter(Boolean);
          return !s.length || s.indexOf(x.cat) >= 0;
        },
        summary: function (arr) {
          var tot = arr.reduce(function (s, x) { return s + num(x.mins); }, 0);
          return UI.stats([['记录条数', arr.length, true], ['总时长', hm(tot)]]);
        },
        render: function (x) {
          return '<div class="item"><div class="item-main">' +
            '<div class="item-meta">' +
            (x.cat ? '<span class="badge">' + esc(x.cat) + '</span>' : '') +
            (x.start ? '<span>' + esc(x.start) + (x.end ? '–' + esc(x.end) : '') + '</span>' : '') +
            (num(x.mins) ? '<span class="badge grey">' + hm(x.mins) + '</span>' : '') +
            '</div>' +
            '<div class="item-note" style="margin-top:4px">' + esc(x.content) + '</div>' +
            '</div>' + UI.ops(x.id, null, 'hdel') + '</div>';
        },
        acts: {
          hdel: function (t, e, redraw) {
            var x = D().worklog.filter(function (a) { return a.id === t.dataset.id; })[0];
            if (!x) return;
            UI.del((x.content || '').slice(0, 20), function () {
              D().worklog = D().worklog.filter(function (a) { return a.id !== x.id; });
              Store.save();
              if (redraw) redraw();
            });
          }
        }
      });
      /* 历史记录分类筛选「更多」展开/收起：切换 wfMore 并重渲染筛选条 */
      sheet.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act="wfmore"]');
        if (!t) return;
        e.preventDefault();
        wfMore = !wfMore;
        var extraEl = sheet.querySelector('#histExtra-worklog');
        if (extraEl) extraEl.innerHTML = workHistExtra(Store ? Hist.getFilter('worklog') : '');
      });
    },

    list: function () {
      var arr = this.wFilteredToday();
      if (!arr.length) return UI.empty('今天还没有工作记录', '📝');
      var dayMin = arr.reduce(function (s, a) { return s + num(a.mins); }, 0);
      var pageRows = ListPager.slice('worklog:list', arr);
      var html = '<div class="timeline"><div class="tl-day">当天工作内容 · ' + hm(dayMin) + '</div>';
      html += pageRows.map(function (x) {
        return '<div class="tl-item"><div class="tl-rail"><span class="tl-dot"></span><span class="tl-line"></span></div>' +
          '<div class="tl-body"><div class="item">' +
          '<div class="item-main">' +
          '<div class="item-meta">' +
          (x.cat ? '<span class="badge">' + esc(x.cat) + '</span>' : '') +
          (x.start ? '<span>' + esc(x.start) + (x.end ? '–' + esc(x.end) : '') + '</span>' : '') +
          (num(x.mins) ? '<span class="badge grey">' + hm(x.mins) + '</span>' : '') +
          '</div>' +
          '<div class="item-note" style="margin-top:4px">' + esc(x.content) + '</div>' +
          '</div>' + UI.ops(x.id, 'edit', 'del') + '</div></div></div>';
      }).join('');
      return html + '</div>' + ListPager.pager('worklog:list', arr.length);
    },

    catStat: function () {
      var map = {};
      this.wFilteredToday().forEach(function (x) { map[x.cat || '未分类'] = (map[x.cat || '未分类'] || 0) + num(x.mins); });
      var rows = Object.keys(map).map(function (k) { return { t: k, v: map[k] }; })
        .filter(function (r) { return r.v > 0; }).sort(function (a, b) { return b.v - a.v; });
      return UI.hbars(rows, 0, function (v) { return hm(v); });
    },

    mount: function (view) {
      // 主视图不再内嵌搜索 / 时间段筛选 / 分类筛选（已全部并入「历史记录」弹窗）
    },

    acts: {
      hist: function () { worklog.openHist(); },
      new: function () {
        UI.form({ title: '记录工作', fields: wFields(), values: { date: U.today(), end: U.nowTime() } }).then(function (v) {
          if (!v) return;
          if (v.cat) addWCat(v.cat);
          v.id = U.uid(); v.mins = calcMins(v);
          D().worklog.push(v); Store.save(); App.refresh(); U.toast('已记录');
        });
      },
      edit: function (t) {
        var x = D().worklog.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑记录', fields: wFields(), values: x }).then(function (v) {
          if (!v) return;
          if (v.cat) addWCat(v.cat);
          Object.keys(v).forEach(function (k) { x[k] = v[k]; });
          x.mins = calcMins(x); Store.save(); App.refresh();
        });
      },
      del: function (t) {
        var x = D().worklog.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del((x.content || '').slice(0, 12) + '…', function () {
          D().worklog = D().worklog.filter(function (a) { return a.id !== x.id; });
          Store.save(); App.refresh();
        });
      },
      wprev: function () { wCur.day = U.shiftDay(wCur.day, -1); App.refresh(); },
      wnext: function () { if (wCur.day < U.today()) { wCur.day = U.shiftDay(wCur.day, 1); App.refresh(); } },
      wtoday: function () { wCur.day = U.today(); App.refresh(); },
      wday: function (t) { wCur.day = t.dataset.d; App.refresh(); },
      calPrev: function (t) { Cal.act(t); },
      calNext: function (t) { Cal.act(t); },
      calToday: function (t) { Cal.act(t); },
      calDay: function (t) { Cal.act(t); }
    }
  };
  /* 工作分类筛选：多选回调（全部/固定/更多 复用全局 catPick 委托） */
  Cats.setPicker('workCats', function () { ListPager.resetPg('worklog:list'); App.refresh(); });
  App.register(worklog);

})();
