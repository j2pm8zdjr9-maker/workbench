/* ========== 通用「列表分页 + 排序切换」组件 ==========
   用于各模块的列表页（影剧书 / 备考 / 物品 / 记账 / 车辆 / 身材 / 日记 / 工作留痕 等）。
   - 排序：点同一排序项在高→低 / 低→高之间切换（与历史记录一致），带 ↓/↑ 箭头。
   - 分页：默认 5 条/页，可在「每页 N 条」下拉选择 5/10/20/50/100。
   状态按命名空间（ns，如 'media:list' / 'exam:plan'）存入 App.tab，跨刷新保留。

   用法：
   1) 在列表渲染处：
      ListPager.out({ ns:'media:list', items: 数组, sortKeys:[{k,t,get}], render:function(it){return '<div class="item">…</div>'}, empty:'没有记录' })
      返回 已排序+分页 的列表 HTML + 分页条。
   2) 在筛选区需要排序药丸处：
      ListPager.sortPills('media:list', sortKeys)
   3) 事件委托已在 core.js 全局处理（data-act=listPg/listSort，data-chg=listSize），无需各模块单独挂 handler。
================================================ */
(function (w) {
  'use strict';
  var UI = w.UI, num = w.U.num;
  var SIZES = [5, 10, 20, 50, 100];

  function get(ns, k, def) { return w.App.tab(ns, k, def); }
  function set(ns, k, v) { w.App.setTab(ns, k, v); }

  function getSort(ns) {
    return { key: get(ns, 'sort', ''), dir: get(ns, 'dir', 'desc') };
  }
  function getPg(ns) {
    return { pg: +get(ns, 'pg', 1) || 1, sz: +get(ns, 'sz', 0) || 0 };
  }
  function resetPg(ns) { set(ns, 'pg', 1); }

  function sortItems(items, sortKeys, cur) {
    if (!sortKeys || !sortKeys.length) return items;
    var sk = sortKeys.filter(function (s) { return s.k === cur.key; })[0] || sortKeys[0];
    if (!sk || !sk.get) return items;
    var g = sk.get, dirN = cur.dir === 'desc' ? -1 : 1;
    return items.slice().sort(function (a, b) {
      var va = g(a), vb = g(b);
      if (va < vb) return -1 * dirN;
      if (va > vb) return 1 * dirN;
      return 0;
    });
  }

  function pagerHTML(ns, total, pages, pg, sz) {
    return UI.pager({
      pg: pg, pages: pages, total: total, size: sz, sizes: SIZES,
      pageAct: 'listPg', sizeChg: 'listSize', data: { ns: ns }
    });
  }

  /* 排序药丸（带方向箭头），放在筛选区 */
  function sortPills(ns, sortKeys) {
    if (!sortKeys || !sortKeys.length) return '';
    var cur = getSort(ns);
    if (!cur.key && sortKeys[0]) { cur.key = sortKeys[0].k; cur.dir = 'desc'; }
    var pills = sortKeys.map(function (sk) {
      var on = sk.k === cur.key;
      var arrow = on ? (cur.dir === 'desc' ? ' ↓' : ' ↑') : '';
      return '<button class="pill tap' + (on ? ' on' : '') + '" data-act="listSort" data-ns="' + ns + '" data-k="' + sk.k + '">' + sk.t + arrow + '</button>';
    }).join('');
    return '<div class="pills">' + pills + '</div>';
  }

  /* 渲染「已排序+分页」的列表 + 分页条 */
  function out(o) {
    var ns = o.ns, items = o.items || [];
    var sortKeys = o.sortKeys;
    var cur = sortKeys && sortKeys.length ? getSort(ns) : null;
    var arr = sortKeys && sortKeys.length ? sortItems(items, sortKeys, cur) : items;
    var total = arr.length;
    var sz = getPg(ns).sz || (o.defSize || 5);
    if (getPg(ns).sz === 0) set(ns, 'sz', sz);
    var pages = Math.max(1, Math.ceil(total / sz));
    var pg = Math.min(Math.max(1, getPg(ns).pg), pages);
    if (getPg(ns).pg > pages) set(ns, 'pg', pg);
    var pageArr = arr.slice((pg - 1) * sz, pg * sz);
    var listHtml = pageArr.length
      ? '<div class="list">' + pageArr.map(o.render).join('') + '</div>'
      : (UI.empty(o.empty || '还没有记录', o.emptyIcon || '🪶'));
    return listHtml + pagerHTML(ns, total, pages, pg, sz);
  }

  /* 仅取当前页数据（供自定义布局复用，如库存总览） */
  function slice(ns, items) {
    var sz = getPg(ns).sz || 5;
    if (getPg(ns).sz === 0) set(ns, 'sz', sz);
    var total = items.length;
    var pages = Math.max(1, Math.ceil(total / sz));
    var pg = Math.min(Math.max(1, getPg(ns).pg), pages);
    if (getPg(ns).pg > pages) set(ns, 'pg', pg);
    return items.slice((pg - 1) * sz, pg * sz);
  }

  /* 仅渲染分页条（供自定义布局复用） */
  function pager(ns, total) {
    var sz = getPg(ns).sz || 5;
    if (getPg(ns).sz === 0) set(ns, 'sz', sz);
    var pages = Math.max(1, Math.ceil(total / sz));
    var pg = Math.min(Math.max(1, getPg(ns).pg), pages);
    return pagerHTML(ns, total, pages, pg, sz);
  }

  /* 全局事件处理（由 core.js 调用） */
  function handle(act, t) {
    var ns = t.dataset.ns;
    if (act === 'listSort') {
      var k = t.dataset.k, cur = getSort(ns);
      if (cur.key === k && cur.dir) set(ns, 'dir', cur.dir === 'desc' ? 'asc' : 'desc');
      else { set(ns, 'sort', k); set(ns, 'dir', 'desc'); }
      resetPg(ns);
      w.App.refresh();
    } else if (act === 'listPg') {
      var k2 = t.dataset.k, pg = +get(ns, 'pg', 1) || 1;
      if (k2 === 'prev') pg = Math.max(1, pg - 1);
      else if (k2 === 'next') pg = pg + 1;
      else pg = +k2;
      set(ns, 'pg', pg);
      w.App.refresh();
    }
  }
  function handleSize(t) {
    var ns = t.dataset.ns;
    set(ns, 'sz', +t.value);
    resetPg(ns);
    w.App.refresh();
  }

  w.ListPager = {
    out: out,
    sortPills: sortPills,
    handle: handle,
    handleSize: handleSize,
    resetPg: resetPg,
    getSort: getSort,
    slice: slice,
    pager: pager,
    SIZES: SIZES
  };
})(window);
