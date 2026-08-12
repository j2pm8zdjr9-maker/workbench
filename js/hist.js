/* ========== 通用「历史记录」弹出窗口（时间筛选 + 搜索 + 可选分类/状态筛选 + 分页 + 汇总） ==========
   点「历史记录」按钮 → 弹出窗口，内含：
   - 紧凑时间段筛选按钮（复用 TF v2）：显示如「2026年7月 ▼」，点击弹出选择面板
   - 关键词搜索框
   - 可选「额外筛选」（如任务状态、收支分类）药丸，放在搜索框下方
   - 可选「汇总」区：筛选后展示该区间的合计信息
   - 可选「分页」：每页 5/10/20/50/100 条，翻页查看
   用于任务待办 / 影剧书 / 备考 / 身材 / 物品 / 财务 / 车辆 / 工作留痕 / 私人日记 等模块。

   用法：
   Hist.open({
     modId:    'tasks',                 // 与 TF 共用命名空间
     title:    '📌 任务历史记录',
     searchPh: '🔍 搜索…',
     items:    function(){ return [...] },                    // 返回全部记录
     date:     function(it){ return it.date },                // 取时间筛选用的日期
     match:    function(it, q){ return ... },                 // q 已小写
     sort:     function(a,b){ return ... },                   // 可选
     render:   function(it){ return '<div class="item">…</div>' },
     empty:    '没有符合条件的记录',
     defSpan:  '10d',                 // 可选：该 modId 首次未持久化时的默认时间跨度（不填=全部）
     defSize:  10,                    // 可选：默认每页条数
     pager:    true,                  // 可选：是否开启分页
     summary:  function(arr){ return '...' },  // 可选：筛选后汇总 HTML（arr 为已筛选未分页数组）
     extraBar: function(cur){ return UI.pills([...], cur, 'histFilter'); }, // 可选：额外筛选药丸
     extraMatch: function(it, val){ return ... },              // 可选：额外筛选命中
     acts:     { ... }                // 可选：列表项内的按钮（如编辑/删除）回调
   });
================================================ */
(function (w) {
  'use strict';
  var U = w.U, TF = w.TF, UI = w.UI, esc = U.esc;

  var qMap = {};   // 搜索词
  var fMap = {};   // 额外筛选当前值
  var fMap2 = {};  // 第二个额外筛选当前值（如任务分类 / 科目）
  var fMap3 = {};  // 第三个额外筛选当前值（如内容分类）
  var pgMap = {};  // 当前页
  var szMap = {};  // 每页条数
  var SIZES = [5, 10, 20, 50, 100];
  var hrKeyMap = {};   // 当前排序键（按 modId）
  var hrDirMap = {};   // 当前排序方向 'desc' | 'asc'
  var instances = {};  // 已打开弹窗实例（modId -> {extraEl, renderExtra, redraw}）
  var moreState = {};  // 分类胶囊「更多」展开态（key = modId + '|' + bar）
  function getF2(m) { return fMap2[m] || ''; }
  function setF2(m, v) { fMap2[m] = v; }
  function getF3(m) { return fMap3[m] || ''; }
  function setF3(m, v) { fMap3[m] = v; }
  function getKey(m) { return hrKeyMap[m] || ''; }
  function setKey(m, v) { hrKeyMap[m] = v; }
  function getDir(m) { return hrDirMap[m] || 'desc'; }
  function setDir(m, v) { hrDirMap[m] = v; }

  function getQ(m) { return qMap[m] || ''; }
  function setQ(m, v) { qMap[m] = v; }
  function getF(m) { return fMap[m] || ''; }
  function setF(m, v) { fMap[m] = v; }
  function getPg(m) { return pgMap[m] || 1; }
  function setPg(m, v) { pgMap[m] = v; }
  function getSz(m) { return szMap[m] || 0; }
  function setSz(m, v) { szMap[m] = v; }

  function open(cfg) {
    var modId = cfg.modId;
    var prev = document.getElementById('histSheet-' + modId);
    if (prev) prev.remove();

    if (getSz(modId) === 0) setSz(modId, cfg.defSize || 5);
    setPg(modId, 1);
    if (getF(modId) === '' && cfg.defFilter != null) setF(modId, cfg.defFilter);
    if (getF2(modId) === '' && cfg.defFilter2 != null) setF2(modId, cfg.defFilter2);
    if (cfg.sortKeys && cfg.sortKeys.length) {
      if (!getKey(modId)) setKey(modId, cfg.defSortKey || cfg.sortKeys[0].k);
      if (!hrDirMap[modId]) setDir(modId, cfg.defSortDir || 'desc');
    }

    if (cfg.defSpan) TF.def(modId, cfg.defSpan);

    function renderExtra() { return cfg.extraBar ? cfg.extraBar(getF(modId)) : ''; }
    function renderExtra2() { return cfg.extraBar2 ? cfg.extraBar2(getF2(modId)) : ''; }
    function renderExtra3() { return cfg.extraBar3 ? cfg.extraBar3(getF3(modId)) : ''; }

    function renderSort() {
      if (!cfg.sortKeys || !cfg.sortKeys.length) return '';
      var cur = getKey(modId), dir = getDir(modId);
      var pills = '<div class="tf-pills pills">' + cfg.sortKeys.map(function (sk) {
        var on = sk.k === cur;
        var arrow = on ? (dir === 'desc' ? ' ↓' : ' ↑') : '';
        return '<button class="pill tap' + (on ? ' on' : '') + '" data-act="histSort" data-k="' + sk.k + '">' + sk.t + arrow + '</button>';
      }).join('') + '</div>';
      return '<div style="height:10px"></div><div class="hist-sort">' + pills + '</div>';
    }

    function compute() {
      var items = cfg.items ? cfg.items() : [];
      var q = getQ(modId).trim().toLowerCase();
      return items.filter(function (it) {
        if (cfg.date && !TF.inRange(modId, cfg.date(it))) return false;
        if (q && cfg.match && !cfg.match(it, q)) return false;
        if (cfg.extraMatch && !cfg.extraMatch(it, getF(modId))) return false;
        if (cfg.extraMatch2 && !cfg.extraMatch2(it, getF2(modId))) return false;
        if (cfg.extraMatch3 && !cfg.extraMatch3(it, getF3(modId))) return false;
        return true;
      });
    }

    var el = UI.sheet(
      cfg.title || '历史记录',
      '<div id="histTf-' + modId + '">' + TF.btn(modId) + '</div>' +
      (cfg.search === false ? '' : '<div style="height:12px"></div><input class="input hist-search" id="histQ-' + modId + '" placeholder="' + esc(cfg.searchPh || '🔍 搜索…') + '" value="' + esc(getQ(modId)) + '">') +
      (cfg.extraBar ? '<div style="height:10px"></div><div id="histExtra-' + modId + '">' + renderExtra() + '</div>' : '') +
      (cfg.extraBar2 ? '<div style="height:10px"></div><div id="histExtra2-' + modId + '">' + renderExtra2() + '</div>' : '') +
      (cfg.extraBar3 ? '<div style="height:10px"></div><div id="histExtra3-' + modId + '">' + renderExtra3() + '</div>' : '') +
      '<div id="histSort-' + modId + '">' + renderSort() + '</div>' +
      (cfg.summary ? '<div id="histSum-' + modId + '" style="margin-top:12px"></div>' : '') +
      '<div style="height:14px"></div>' +
      '<div id="histList-' + modId + '"></div>' +
      (cfg.pager ? '<div id="histPager-' + modId + '"></div>' : ''),
      '<button class="btn ghost tap" data-x>关闭</button>'
    );
    el.id = 'histSheet-' + modId;

    var listEl = el.querySelector('#histList-' + modId);
    var tfEl = el.querySelector('#histTf-' + modId);
    var qe = el.querySelector('#histQ-' + modId);
    var extraEl = cfg.extraBar ? el.querySelector('#histExtra-' + modId) : null;
    var extraEl2 = cfg.extraBar2 ? el.querySelector('#histExtra2-' + modId) : null;
    var extraEl3 = cfg.extraBar3 ? el.querySelector('#histExtra3-' + modId) : null;
    var sumEl = cfg.summary ? el.querySelector('#histSum-' + modId) : null;
    var pagerEl = cfg.pager ? el.querySelector('#histPager-' + modId) : null;
    instances[modId] = { extraEl: extraEl, extraEl2: extraEl2, extraEl3: extraEl3, renderExtra: renderExtra, renderExtra2: renderExtra2, renderExtra3: renderExtra3, redraw: draw };

    function renderTf() { tfEl.innerHTML = TF.btn(modId); }

    function pagerHTML(total, pages, pg) {
      return UI.pager({
        pg: pg, pages: pages, total: total, size: getSz(modId), sizes: SIZES,
        pageAct: 'histPage', sizeChg: 'histSize'
      });
    }

    function draw() {
      var arr = compute();
      if (cfg.sortKeys && cfg.sortKeys.length) {
        var key = getKey(modId), dir = getDir(modId);
        var sk = cfg.sortKeys.filter(function (s) { return s.k === key; })[0];
        if (sk) {
          var g = sk.get, dirN = dir === 'desc' ? -1 : 1;
          arr = arr.slice().sort(function (a, b) {
            var va = g(a), vb = g(b);
            if (va < vb) return -1 * dirN;
            if (va > vb) return 1 * dirN;
            return 0;
          });
        }
      } else if (cfg.sort) {
        arr = arr.slice().sort(cfg.sort);
      }
      if (sumEl && cfg.summary) sumEl.innerHTML = cfg.summary(arr);
      var total = arr.length;
      var size = cfg.pager ? getSz(modId) : total;
      var pages = cfg.pager ? Math.max(1, Math.ceil(total / size)) : 1;
      var pg = cfg.pager ? Math.min(getPg(modId), pages) : 1;
      if (cfg.pager) setPg(modId, pg);
      var pageArr = cfg.pager ? arr.slice((pg - 1) * size, pg * size) : arr;
      listEl.innerHTML = pageArr.length
        ? '<div class="list">' + pageArr.map(cfg.render).join('') + '</div>'
        : UI.empty(cfg.empty || '该时间段内没有匹配的记录', '🔍');
      if (pagerEl) pagerEl.innerHTML = pagerHTML(total, pages, pg);
      w.U.foldNotes(listEl);
    }

    renderTf();
    draw();

    if (qe) qe.oninput = function () { setQ(modId, this.value); setPg(modId, 1); draw(); };

    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      var act = t.dataset.act;
      if (act === 'tfOpen') {
        e.preventDefault();
        TF.open(modId, { onChange: function () { renderTf(); setPg(modId, 1); draw(); } });
        return;
      }
      if (act === 'histFilter') {
        e.preventDefault();
        var k = t.dataset.k;
        if (t.dataset.multi === '1') {
          var cur = String(getF(modId) || '').split(',').filter(function (v) { return v; });
          var idx = cur.indexOf(k);
          if (idx >= 0) cur.splice(idx, 1); else cur.push(k);
          setF(modId, cur.join(','));
        } else {
          setF(modId, k);
        }
        if (extraEl) extraEl.innerHTML = renderExtra();
        setPg(modId, 1); draw();
        return;
      }
      if (act === 'histFilter2') {
        e.preventDefault();
        setF2(modId, t.dataset.k);
        if (extraEl2) extraEl2.innerHTML = renderExtra2();
        setPg(modId, 1); draw();
        return;
      }
      if (act === 'histFilter3') {
        e.preventDefault();
        setF3(modId, t.dataset.k);
        if (extraEl3) extraEl3.innerHTML = renderExtra3();
        setPg(modId, 1); draw();
        return;
      }
      /* 分类胶囊「更多 ▾」：切换展开/收起（受分类管理显示个数控制） */
      if (act === 'histCatMore') {
        e.preventDefault();
        var mb = t.dataset.bar, mk = modId + '|' + mb;
        moreState[mk] = !moreState[mk];
        if (mb === '2' && extraEl2) extraEl2.innerHTML = renderExtra2();
        if (mb === '3' && extraEl3) extraEl3.innerHTML = renderExtra3();
        return;
      }
      /* 第二个筛选条用「分类管理」灵活胶囊：固定分类 + 更多（打开选择器） */
      if (cfg.extraNs2 && t.dataset.act === 'catPick' && t.dataset.ns === cfg.extraNs2) {
        e.preventDefault();
        if (cfg.extraPick2) cfg.extraPick2(t.dataset.k);
        setF2(modId, t.dataset.k);
        if (extraEl2) extraEl2.innerHTML = renderExtra2();
        setPg(modId, 1); draw();
        return;
      }
      if (cfg.extraNs2 && t.dataset.act === 'catMore' && t.dataset.ns === cfg.extraNs2) {
        e.preventDefault();
        if (w.Cats) w.Cats.openPicker(cfg.extraNs2, getF2(modId), function (kk) {
          if (cfg.extraPick2) cfg.extraPick2(kk);
          setF2(modId, kk);
          if (extraEl2) extraEl2.innerHTML = renderExtra2();
          setPg(modId, 1); draw();
        });
        return;
      }
      if (act === 'histPage') { e.preventDefault(); setPg(modId, +t.dataset.k); draw(); return; }
      if (act === 'histSort') {
        e.preventDefault();
        var k = t.dataset.k;
        if (getKey(modId) === k) setDir(modId, getDir(modId) === 'desc' ? 'asc' : 'desc');
        else { setKey(modId, k); setDir(modId, cfg.defSortDir || 'desc'); }
        var sb = el.querySelector('#histSort-' + modId); if (sb) sb.innerHTML = renderSort();
        setPg(modId, 1); draw();
        return;
      }
      if (cfg.acts && cfg.acts[act]) { e.preventDefault(); cfg.acts[act](t, e, draw); }
    });
    if (pagerEl) {
      pagerEl.addEventListener('change', function (e) {
        if (e.target.matches('[data-chg="histSize"]')) { setSz(modId, +e.target.value); setPg(modId, 1); draw(); }
      });
    }
    return el;
  }

  /* 分类胶囊（受分类管理显示个数控制）：直接显示前 N-1 个固定分类，其余收进「更多 ▾」。
     单击胶囊为单选（与备考历史「科目 / 内容」场景匹配）。ns 命名空间，bar 为第几个筛选条。 */
  function catPills(ns, cur, act, bar, modId, label) {
    var all = w.Cats.get(ns);
    if (!all.length) return '';
    var pin = w.Cats.pin(ns);
    var fixedN = Math.max(0, pin - 1);
    var pinned = all.slice(0, fixedN), rest = all.slice(fixedN);
    var open = moreState[modId + '|' + bar];
    var html = '<button class="pill tap' + (!cur ? ' on' : '') + '" data-act="' + act + '" data-k="">全部</button>';
    html += pinned.map(function (c) {
      return '<button class="pill tap' + (cur === c ? ' on' : '') + '" data-act="' + act + '" data-k="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    if (rest.length) {
      html += '<button class="pill tap' + (open ? ' on' : '') + '" data-act="histCatMore" data-bar="' + bar + '" data-ns="' + ns + '">' + (open ? '收起 ▴' : '更多 ▾') + '</button>';
      if (open) html += rest.map(function (c) {
        return '<button class="pill tap' + (cur === c ? ' on' : '') + '" data-act="' + act + '" data-k="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
    }
    return '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 4px"><span class="small muted">' + esc(label) + '</span>' + html + '</div>';
  }

  w.Hist = {
    open: open,
    catPills: catPills,
    getFilter: function (m) { return fMap[m] || ''; },
    setFilter: function (m, v) {
      setF(m, v);
      var inst = instances[m];
      if (inst) { if (inst.extraEl) inst.extraEl.innerHTML = inst.renderExtra(); if (inst.redraw) inst.redraw(); }
    }
  };
})(window);
