/* ========== 通用时间段筛选器 v2 ==========
   统一全站「按时间段查看内容」的交互：
   - 一个紧凑按钮显示当前区间，如「2026年7月 ▼」；
   - 点击弹出面板，可选快捷预设 / 起止日期；
   - 区间持久化到 Store.ui.timefilter[modId]，刷新保持；
   - 筛选精度统一为天级闭区间 [from, to]。

   API：
   TF.state(modId)          读取状态 {span, from, to, on}
   TF.applySpan(modId, k)   应用快捷预设
   TF.setRange(modId, f, t) 应用自定义区间
   TF.inRange(modId, date)  判断日期是否命中
   TF.label(modId)          按钮显示文案
   TF.btn(modId, opt)       渲染触发按钮
   TF.open(modId, opt)      打开选择面板
   TF.hook(modId, fn)       注册筛选变化回调
   TF.def(modId, span)      声明默认 span（仅未持久化时生效）

   兼容 shim（旧调用方不报错）：
   TF.render(modId, opts)   等价于 TF.btn(modId)
   TF.bind(view, modId)     空函数
   TF.onSpan(modId, k)      applySpan + App.refresh()
================================================ */
(function (w) {
  'use strict';
  var U = w.U, Store = w.Store, App = w.App;

  var SPANS = [
    { k: 'all', t: '全部' },
    { k: 'today', t: '今天' },
    { k: '10d', t: '近10天' },
    { k: 'week', t: '本周' },
    { k: 'month', t: '本月' },
    { k: 'year', t: '本年' }
  ];
  var REL_SPANS = ['today', '10d', 'week', 'month', 'year'];
  var hooks = {};
  var DEFS = {};   // 各模块声明的默认 span（仅当无持久化值时生效）

  function today() { return U.today(); }

  function monthLast(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function normDate(d) {
    return d ? String(d).slice(0, 10) : '';
  }

  function parseYMD(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }

  function fmtYMD(y, m, d) {
    return y + '-' + U.pad(m) + '-' + U.pad(d);
  }

  // 计算某预设对应的 [from, to]
  function spanDates(span) {
    var t = today();
    if (span === 'all') return ['', ''];
    if (span === 'today') return [t, t];
    if (span === '10d') return [U.shiftDay(t, -9), t];
    if (span === 'week') {
      var day = (new Date().getDay() + 6) % 7; // 周一=0
      var from = U.shiftDay(t, -day);
      return [from, U.shiftDay(from, 6)];
    }
    if (span === 'month') {
      var d = new Date();
      var y = d.getFullYear(), m = d.getMonth() + 1;
      return [fmtYMD(y, m, 1), fmtYMD(y, m, monthLast(y, m))];
    }
    if (span === 'year') {
      var y2 = new Date().getFullYear();
      return [fmtYMD(y2, 1, 1), fmtYMD(y2, 12, 31)];
    }
    return ['', ''];
  }

  // 尝试把 [from,to] 归属为某个预设；配不上则返回 custom
  function detectSpan(from, to) {
    if (!from && !to) return 'all';
    for (var i = 0; i < SPANS.length; i++) {
      var k = SPANS[i].k;
      if (k === 'all' || k === 'custom') continue;
      var ds = spanDates(k);
      if (ds[0] === from && ds[1] === to) return k;
    }
    return 'custom';
  }

  // 读取状态；若不存在则惰性初始化（采用模块声明的默认 span）；相对预设跨天自动重算
  function state(modId) {
    var tf = Store.data.ui.timefilter || (Store.data.ui.timefilter = {});
    if (!tf[modId]) {
      var defSpan = DEFS[modId] || 'all';
      var ds0 = spanDates(defSpan);
      tf[modId] = { span: defSpan, from: ds0[0], to: ds0[1], on: today() };
    }
    var s = tf[modId];
    if (REL_SPANS.indexOf(s.span) >= 0 && s.on !== today()) {
      var ds = spanDates(s.span);
      s.from = ds[0]; s.to = ds[1]; s.on = today();
      Store.save(true);
    }
    return s;
  }

  function setState(modId, patch, silent) {
    var s = state(modId);
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    Store.save(silent !== false);
  }

  function applySpan(modId, span, opt) {
    opt = opt || {};
    var ds = spanDates(span);
    setState(modId, { span: span, from: ds[0], to: ds[1], on: today() }, opt.silent);
    if (!opt.silent && hooks[modId]) hooks[modId]();
    else if (!opt.silent && App) App.refresh();
  }

  function setRange(modId, from, to, opt) {
    opt = opt || {};
    from = normDate(from); to = normDate(to);
    if (from && to && from > to) {
      var tmp = from; from = to; to = tmp;
      U.toast('已自动交换起止日期');
    }
    var span = detectSpan(from, to);
    setState(modId, { span: span, from: from, to: to, on: today() }, opt.silent);
    if (!opt.silent && hooks[modId]) hooks[modId]();
    else if (!opt.silent && App) App.refresh();
  }

  function inRange(modId, date) {
    var s = state(modId);
    if (!date) return true;
    date = String(date).slice(0, 10);
    if (s.from && date < s.from) return false;
    if (s.to && date > s.to) return false;
    return true;
  }

  function isAll(modId) {
    var s = state(modId);
    return s.span === 'all' || (!s.from && !s.to);
  }

  function get(modId) {
    var s = state(modId);
    return { from: s.from, to: s.to, span: s.span };
  }

  function days(modId) {
    var s = state(modId);
    if (!s.from || !s.to) return null;
    return U.dayDiff(s.from, s.to) + 1;
  }

  // 标签格式化
  function rangeLabel(from, to) {
    if (!from && !to) return '全部时间';
    if (from && !to) {
      var a = parseYMD(from);
      return a.y + '年' + a.m + '月' + a.d + '日 起';
    }
    if (!from && to) {
      var b = parseYMD(to);
      return '截至 ' + b.y + '年' + b.m + '月' + b.d + '日';
    }
    var A = parseYMD(from), B = parseYMD(to);
    // 整年
    if (from === B.y + '-01-01' && to === B.y + '-12-31') {
      if (A.y === B.y) return B.y + '年';
      return A.y + '年至' + B.y + '年';
    }
    // 整月
    var aLast = monthLast(A.y, A.m), bLast = monthLast(B.y, B.m);
    if (A.d === 1 && B.d === bLast) {
      if (A.y === B.y && A.m === B.m) return A.y + '年' + A.m + '月';
      return A.y + '年' + A.m + '月至' + B.y + '年' + B.m + '月';
    }
    // 同一天
    if (from === to) return A.y + '年' + A.m + '月' + A.d + '日';
    // 同年同月
    if (A.y === B.y && A.m === B.m) return A.y + '年' + A.m + '月' + A.d + '日至' + B.d + '日';
    // 同年跨月
    if (A.y === B.y) return A.y + '年' + A.m + '月' + A.d + '日至' + B.m + '月' + B.d + '日';
    // 跨年
    return A.y + '年' + A.m + '月' + A.d + '日至' + B.y + '年' + B.m + '月' + B.d + '日';
  }

  // 自定义区间的紧凑文案：8.1-8.3 / 8.1-8.3（跨年 2026.8.1-2027.8.3）
  function compactRange(from, to) {
    var A = parseYMD(from), B = parseYMD(to);
    if (!A || !B) return '';
    var a = A.m + '.' + A.d, b = B.m + '.' + B.d;
    if (from === to) return a;
    if (A.y === B.y) return a + '-' + b;
    return A.y + '.' + a + '-' + B.y + '.' + b;
  }

  function label(modId) {
    var s = state(modId);
    if (s.span === 'all') return '全部时间';
    if (s.span === 'today') return '今天';
    if (s.span === '10d') return '近10天';
    if (s.span === 'week') return '本周';
    if (s.span === 'custom') {
      var c = compactRange(s.from, s.to);
      return c || '自定义';
    }
    return rangeLabel(s.from, s.to);   // 本月 / 本年 → 2026年8月 / 2026年
  }

  function rangeText(modId) {
    var s = state(modId);
    if (!s.from && !s.to) return '全部时间';
    var from = s.from || '—', to = s.to || '—';
    return from + ' ~ ' + to + (s.from && s.to ? ' · 共 ' + days(modId) + ' 天' : '');
  }

  function def(modId, span) {
    // 仅登记默认 span，绝不在模块注册阶段 save（那时 Store.load 尚未执行，save 会用空 defaults 覆盖真实数据）。
    // 实际默认填充交给 state() 在首次访问时按 DEFS 应用，既保留默认行为，又不会清掉持久化数据。
    DEFS[modId] = span;
    var tf = Store.data.ui.timefilter || (Store.data.ui.timefilter = {});
    if (!tf[modId] && Store._loaded) {
      var ds = spanDates(span);
      tf[modId] = { span: span, from: ds[0], to: ds[1], on: today() };
    }
  }

  function hook(modId, fn) {
    hooks[modId] = fn;
  }

  // 触发按钮
  function btn(modId, opt) {
    opt = opt || {};
    var s = state(modId);
    var txt = label(modId);
    var title = rangeText(modId);
    var empty = s.span === 'all' || (!s.from && !s.to);
    var cls = 'tf-btn tap' + (empty ? ' tf-btn-empty' : '') + (opt.block ? ' block' : '') + (opt.sm ? ' sm' : '');
    var icon = opt.icon || '🗓';
    return '<button class="' + cls + '" data-act="tfOpen" data-tf="' + U.esc(modId) + '" title="' + U.esc(title) + '">' +
      '<span class="tf-btn-ico">' + icon + '</span>' +
      '<span class="tf-btn-txt">' + U.esc(txt) + '</span>' +
      '<span class="tf-btn-caret">▾</span></button>';
  }

  // 选择弹窗
  var activePicker = null;
  function closePicker() {
    if (!activePicker) return;
    var el = activePicker.el;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (w.UI && w.UI.modalA11y) w.UI.modalA11y.close(el);
    activePicker = null;
    if (w.UI && w.UI.unlock) w.UI.unlock();
  }

  function open(modId, opt) {
    opt = opt || {};
    var s = state(modId);
    var draft = { span: s.span, from: s.from, to: s.to };
    var presets = opt.presets || SPANS.map(function (x) { return x.k; });

    // 内联日历可见月份
    var calY, calM;
    function initCal() {
      var base = parseYMD(draft.to) || parseYMD(draft.from) || parseYMD(today());
      calY = base.y; calM = base.m;
    }
    initCal();

    // 生成某月日历 HTML（周一为首列）
    function buildCal(y, m) {
      var wd = ['一', '二', '三', '四', '五', '六', '日'];
      var html = '<div class="tf-cal-head">' +
        '<button type="button" class="chip tap" data-tf-pm aria-label="上个月">‹</button>' +
        '<span class="tf-cal-title">' + y + '年' + m + '月</span>' +
        '<button type="button" class="chip tap" data-tf-nm aria-label="下个月">›</button></div>';
      html += '<div class="cal">';
      wd.forEach(function (d) { html += '<div class="cal-wd">' + d + '</div>'; });
      var first = new Date(y, m - 1, 1).getDay();
      var lead = (first + 6) % 7;
      var total = monthLast(y, m);
      for (var i = 0; i < lead; i++) html += '<div class="cal-cell empty"></div>';
      for (var d = 1; d <= total; d++) {
        var ds = fmtYMD(y, m, d);
        var cls = 'cal-cell tap';
        if (ds === today()) cls += ' today';
        html += '<div class="' + cls + '" data-tfd="' + ds + '">' + d + '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderCal() {
      var wrap = activePicker.el.querySelector('[data-tf-cal]');
      if (!wrap) return;
      wrap.innerHTML = buildCal(calY, calM);
      applyRange();
    }

    function applyRange() {
      var wrap = activePicker.el.querySelector('[data-tf-cal]');
      if (!wrap) return;
      [].forEach.call(wrap.querySelectorAll('.cal-cell[data-tfd]'), function (c) {
        var ds = c.dataset.tfd;
        c.classList.remove('in-range', 'range-start', 'range-end');
        if (!draft.from) return;
        if (draft.to && ds >= draft.from && ds <= draft.to) {
          if (ds === draft.from) c.classList.add('range-start');
          else if (ds === draft.to) c.classList.add('range-end');
          else c.classList.add('in-range');
        } else if (ds === draft.from) {
          c.classList.add('range-start');
        }
      });
    }

    function refreshUI() {
      if (!activePicker || activePicker.modId !== modId) return;
      var el = activePicker.el;
      [].forEach.call(el.querySelectorAll('[data-tfk]'), function (b) {
        b.classList.toggle('on', b.dataset.tfk === draft.span);
      });
      // 单框文案
      var box = el.querySelector('[data-tf-box]');
      if (box) {
        var txt = box.querySelector('.tf-box-txt');
        if (draft.from && draft.to) txt.textContent = draft.from + ' ~ ' + draft.to;
        else if (draft.from) txt.textContent = draft.from + ' 起';
        else txt.textContent = '选择日期范围';
      }
      applyRange();
      // 预览
      var preview = el.querySelector('.tf-preview');
      if (preview) {
        var bad = draft.from && draft.to && draft.from > draft.to;
        preview.className = 'tf-preview' + (bad ? ' bad' : '');
        preview.innerHTML = '<b>' + U.esc(rangeLabel(draft.from, draft.to)) + '</b>' +
          '<span class="small muted">' + U.esc(rangeTextRaw(draft.from, draft.to)) + '</span>';
      }
    }

    function rangeTextRaw(from, to) {
      if (!from && !to) return '全部时间';
      var f = from || '—', t = to || '—';
      if (from && to) return f + ' ~ ' + t + ' · 共 ' + (U.dayDiff(from, to) + 1) + ' 天';
      return f + ' ~ ' + t;
    }

    function applyDraftSpan(k) {
      draft.span = k;
      if (k !== 'custom') {
        var ds = spanDates(k);
        draft.from = ds[0]; draft.to = ds[1];
      } else if (!draft.from && !draft.to) {
        // 自定义且无起止时，默认本月，便于在此基础上微调，而不是退回到「全部时间」
        var d = new Date();
        draft.from = fmtYMD(d.getFullYear(), d.getMonth() + 1, 1);
        draft.to = fmtYMD(d.getFullYear(), d.getMonth() + 1, monthLast(d.getFullYear(), d.getMonth() + 1));
        initCal();
      }
      // 选自定义时直接展开日历，便于点选起止
      var cal = activePicker.el.querySelector('[data-tf-cal]');
      if (cal) cal.hidden = false;
      refreshUI();
    }

    function submit(clear) {
      if (clear) {
        closePicker();
        applySpan(modId, 'all', { silent: false });
        if (opt.onChange) opt.onChange();
        return;
      }
      var f = draft.from, t = draft.to;
      if (f && t && f > t) { var tmp = f; f = t; t = tmp; U.toast('已自动交换起止日期'); }
      closePicker();
      setRange(modId, f, t, { silent: false });
      if (opt.onChange) opt.onChange();
    }

    closePicker();
    if (w.UI && w.UI.lock) w.UI.lock();

    var presetsHtml = '<div class="tf-presets pills">' + SPANS.filter(function (sp) {
      return presets.indexOf(sp.k) >= 0;
    }).map(function (sp) {
      return '<button class="pill tap" data-tfk="' + sp.k + '">' + sp.t + '</button>';
    }).join('') + '</div>';

    var html = '<div class="modal-mask tf-pop-mask" role="dialog" aria-modal="true" aria-label="选择时间段">' +
      '<div class="modal tf-pop">' +
      '<div class="modal-head"><h3>' + (opt.title || '选择时间段') + '</h3>' +
      '<button class="x-btn tap" data-tfx>✕</button></div>' +
      '<div class="modal-body">' + presetsHtml +
      '<div class="tf-range">' +
      '<div class="tf-box tap" data-tf-box>' +
      '<span class="tf-box-ico">📅</span>' +
      '<span class="tf-box-txt">选择日期范围</span>' +
      '<span class="tf-box-caret">▾</span>' +
      '</div>' +
      '<div class="tf-cal-wrap" data-tf-cal hidden>' + buildCal(calY, calM) + '</div>' +
      '</div>' +
      '<div class="tf-preview"><b>' + U.esc(rangeLabel(draft.from, draft.to)) + '</b>' +
      '<span class="small muted">' + U.esc(rangeTextRaw(draft.from, draft.to)) + '</span></div>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn ghost tap" data-tfclear>清除</button>' +
      '<button class="btn primary tap" data-tfok>确定</button>' +
      '</div></div></div>';

    var root = document.getElementById('modalRoot');
    if (!root) { if (w.UI && w.UI.unlock) w.UI.unlock(); return; }
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var el = wrap.firstChild;
    root.appendChild(el);
    if (w.UI && w.UI.modalA11y) w.UI.modalA11y.open(el);
    activePicker = { modId: modId, el: el };

    // 事件绑定
    el.addEventListener('click', function (e) {
      // 仅点击遮罩背景（弹窗本身）才关闭；点弹窗内部任何元素都不应误关
      if (e.target === el) { e.preventDefault(); closePicker(); return; }
      var tfx = e.target.closest('[data-tfx]');
      if (tfx) { e.preventDefault(); closePicker(); return; }
      var tfk = e.target.closest('[data-tfk]');
      if (tfk) { e.preventDefault(); applyDraftSpan(tfk.dataset.tfk); return; }
      var box = e.target.closest('[data-tf-box]');
      if (box) { e.preventDefault(); var cal = el.querySelector('[data-tf-cal]'); if (cal) cal.hidden = !cal.hidden; return; }
      var pm = e.target.closest('[data-tf-pm]');
      if (pm) { e.preventDefault(); calY--; if (calY < 1970) calY = 1970; renderCal(); return; }
      var nm = e.target.closest('[data-tf-nm]');
      if (nm) { e.preventDefault(); calY++; if (calY > 2100) calY = 2100; renderCal(); return; }
      var dcell = e.target.closest('[data-tfd]');
      if (dcell) {
        e.preventDefault();
        var ds = dcell.dataset.tfd;
        if (!draft.from || (draft.from && draft.to)) {
          // 开始新的选择
          draft.from = ds; draft.to = '';
        } else {
          // 选择结束日期，自动交换起止
          draft.to = ds;
          if (draft.from > draft.to) { var tmp = draft.from; draft.from = draft.to; draft.to = tmp; }
        }
        draft.span = 'custom';
        refreshUI();
        return;
      }
      var ok = e.target.closest('[data-tfok]');
      if (ok) { e.preventDefault(); submit(false); return; }
      var clr = e.target.closest('[data-tfclear]');
      if (clr) { e.preventDefault(); submit(true); return; }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePicker();
    });

    refreshUI();
  }

  // 兼容 shim
  function render(modId, opts) {
    return '<div class="tf-bar tf-bar-v2">' + btn(modId, opts) + '</div>';
  }
  function bind(view, modId) { /* 旧接口，已无内联 date 输入需要绑定 */ }
  function onSpan(modId, k) { applySpan(modId, k); }

  w.TF = {
    SPANS: SPANS,
    state: state, get: get, isAll: isAll, days: days,
    applySpan: applySpan, setRange: setRange, inRange: inRange,
    label: label, rangeLabel: rangeLabel, rangeText: rangeText,
    btn: btn, render: render, open: open, hook: hook, def: def,
    bind: bind, onSpan: onSpan
  };
})(window);
