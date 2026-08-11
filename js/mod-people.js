/* ===== 8.纪念日 9.人情台账 10.愿望清单 11.家人档案 14.猫咪档案 15.设置 ===== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, money = U.money, D = function () { return Store.data; };
  var anQ = '', soQ = '', wiQ = '', faQ = '';   // 各模块搜索关键词
  var annivExpanded = null; // 当前展开的纪念日 id
  var annivCat = '';        // 纪念日分类筛选
  var wishExpanded = null; // 当前展开的愿望 id
  var familyExpanded = null; // 当前展开的家人 id
  var socialExpanded = null; // 当前展开的人情记录 id
  var socialCat = '';       // 人情台账人际关系分类筛选

  /* =========================================================
     8. 🎀 纪念日
  ========================================================= */
  function nextDate(x) {
    if (x.cal === 'lunar') {
      var m = +x.lmonth, d = +x.lday, leap = !!x.lisLeap, y = new Date().getFullYear();
      var s = U.parseDate(window.Lunar.toSolar(y, m, d, leap));
      var t = U.parseDate(U.today());
      if (s < t) s = U.parseDate(window.Lunar.toSolar(y + 1, m, d, leap));
      return s.getFullYear() + '-' + U.pad(s.getMonth() + 1) + '-' + U.pad(s.getDate());
    }
    if (!x.yearly) return x.date;
    var dd = U.parseDate(x.date), now = new Date();
    var yy = now.getFullYear();
    var c = new Date(yy, dd.getMonth(), dd.getDate());
    var tt = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (c < tt) c = new Date(yy + 1, dd.getMonth(), dd.getDate());
    return c.getFullYear() + '-' + U.pad(c.getMonth() + 1) + '-' + U.pad(c.getDate());
  }

  // 列表排序键：按「下次到期日」升序；已过的一次性纪念日（无未来日期）置底
  function sortKey(x) {
    var nd = U.parseDate(nextDate(x)), today = U.parseDate(U.today());
    if (nd < today && !(x.yearly || x.cal === 'lunar')) return Infinity;
    return nd.getTime();
  }

  // 已过多少年多少天：从原日期到今天，按整年 + 剩余天数展示
  function passedText(dateStr) {
    var d0 = U.parseDate(dateStr), d1 = U.parseDate(U.today());
    if (!d0 || !(d0 < d1)) return '已过';
    var years = d1.getFullYear() - d0.getFullYear();
    var anchor = new Date(d0.getFullYear() + years, d0.getMonth(), d0.getDate());
    if (anchor > d1) { years--; anchor = new Date(d0.getFullYear() + years, d0.getMonth(), d0.getDate()); }
    var days = Math.round((d1 - anchor) / 86400000);
    if (years > 0) return '已过 ' + years + ' 年' + (days > 0 ? ' ' + days + ' 天' : '');
    return '已过 ' + days + ' 天';
  }

  function renderAnnivItem(x) {
    var nd = nextDate(x), n = U.dayDiff(U.today(), nd);
    var isLunar = x.cal === 'lunar';
    var lunarTxt = isLunar ? window.Lunar.label(+x.lmonth, +x.lday, !!x.lisLeap) : '';
    var years = (!isLunar && x.yearly) ? U.parseDate(nd).getFullYear() - U.parseDate(x.date).getFullYear() : 0;
    var expanded = annivExpanded === x.id;
    var countHtml = '<div style="text-align:right;min-width:72px"><div class="big-num" style="' +
      (n < 0 ? 'font-size:13px;line-height:1.35;' : 'font-size:22px;') + 'color:' +
      (n < 0 ? '#B4553F' : (n <= 7 ? '#6E8A28' : '#331915')) + '">' +
      (n === 0 ? '今天' : n < 0 ? passedText(nd) : n) + '</div>' +
      (n > 0 ? '<div class="small muted">天</div>' : '') + '</div>';
    // 折叠态
    if (!expanded) {
      return '<div class="item' + (n >= 0 && n <= 7 ? ' hl' : '') + '" data-act="aexp" data-id="' + x.id + '">' +
        '<div class="item-main"><div class="row between"><span class="item-title">' + esc(x.name) + (n === 0 ? ' 🎉' : '') + '</span>' +
        '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' + countHtml + ' <span style="font-size:11px;color:#999">▸</span></span></div>' +
        '<div class="item-meta"><span class="badge grey">' + esc(x.type || '纪念日') + '</span>' +
        '<span>' + U.fmtDate(nd, true) + '</span>' +
        (isLunar ? '<span class="badge purple">农历</span>' : '') +
        (x.yearly ? '<span class="badge">每年</span>' : '') + '</div></div></div>';
    }
    // 展开态
    return '<div class="item' + (n >= 0 && n <= 7 ? ' hl' : '') + ' open" data-act="aexp" data-id="' + x.id + '">' +
      '<div class="item-main">' +
      '<div class="row between"><span class="item-title">' + esc(x.name) + (n === 0 ? ' 🎉' : '') + '</span>' +
      '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' + countHtml + ' <span style="font-size:11px;color:#999">▾</span></span></div>' +
      '<div class="item-meta">' +
      '<span class="badge grey">' + esc(x.type || '纪念日') + '</span>' +
      (isLunar ? '<span class="badge purple">农历 · ' + lunarTxt + '</span>' : '') +
      '<span>' + U.fmtDate(nd, true) + '</span>' +
      (x.yearly ? '<span class="badge">每年重复' + (years > 0 ? ' · 第 ' + years + ' 年' : '') + '</span>' : '') +
      (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div></div>' +
      UI.ops(x.id, 'edit', 'del') + '</div>';
  }

  var anniv = {
    id: 'anniv', icon: '🎀', name: '纪念日',
    render: function () {
      var arr = D().anniv.slice().sort(function (a, b) {
        return sortKey(a) - sortKey(b);
      });
      if (annivCat) arr = arr.filter(function (x) { return (x.type || '纪念日') === annivCat; });
      var soon = arr.filter(function (x) { var n = U.dayDiff(U.today(), nextDate(x)); return n >= 0 && n <= 30; });
      return UI.head('🎀 纪念日', '生日、节日、关键节点，自动倒数不错过') +
        UI.stats([['全部记录', arr.length], ['30 天内', soon.length, true],
        ['最近一个', soon.length ? soon[0].name : '—'], ['还有', soon.length ? U.dayDiff(U.today(), nextDate(soon[0])) + ' 天' : '—']]) +
        UI.card({
          title: '纪念日列表',
          right: Cats.btn('annivTypes', '分类管理', '🗂 分类管理') + '<button class="btn primary sm tap" data-act="new">+ 添加纪念日</button>',
          body: Cats.filterBar('annivTypes', annivCat, { label: '类型' }) +
            '<input class="input" id="anSearch" placeholder="🔍 搜索名称 / 类型 / 备注" value="' + esc(anQ) + '" style="margin-bottom:14px">' +
            '<div id="anList">' + this.items(anQ) + '</div>'
        });
    },
    items: function (q) {
      var qq = (q || '').trim().toLowerCase();
      var arr = D().anniv.slice().sort(function (a, b) { return sortKey(a) - sortKey(b); });
      if (annivCat) arr = arr.filter(function (x) { return (x.type || '纪念日') === annivCat; });
      if (qq) arr = arr.filter(function (x) {
        return (x.name || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.type || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.note || '').toLowerCase().indexOf(qq) >= 0;
      });
      return ListPager.out({
        ns: 'people:anniv', items: arr, defSize: 5,
        empty: qq ? '没有匹配的纪念日' : '把重要的日子记下来', emptyIcon: '🎀',
        render: renderAnnivItem
      });
    },
    mount: function (view) {
      var q = view.querySelector('#anSearch');
      if (q) q.oninput = function () { anQ = this.value; ListPager.resetPg('people:anniv'); var b = view.querySelector('#anList'); if (b) b.innerHTML = anniv.items(anQ); };
    },
    acts: {
      aexp: function (t) { annivExpanded = annivExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },
      new: function () {
        UI.form({ title: '添加纪念日', values: { yearly: true, cal: 'solar', date: U.today(), lmonth: 7, lday: 7, lisLeap: false }, fields: aFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().anniv.push(v); Store.save(); App.refresh();
        });
      },
      edit: function (t) {
        var x = D().anniv.filter(function (a) { return a.id === t.dataset.id; })[0];
        var vals = Object.assign({ cal: 'solar', lmonth: 7, lday: 7, lisLeap: false }, x);
        UI.form({ title: '编辑纪念日', values: vals, fields: aFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      del: function (t) {
        var x = D().anniv.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { D().anniv = D().anniv.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      }
    }
  };
  function aFields() {
    return [
      { k: 'name', label: '名称', req: true, full: true, ph: '如：妈妈生日 / 七夕节' },
      Cats.field('annivTypes', '类型', { k: 'type', def: '生日' }),
      { k: 'cal', label: '历法', type: 'select', options: [{ v: 'solar', t: '公历' }, { v: 'lunar', t: '农历' }], def: 'solar', hint: '农历节日（如七夕、除夕）每年自动对应公历日期，无需手动改' },
      { k: 'date', label: '日期', type: 'date', req: true, def: U.today(), when: { key: 'cal', val: 'solar' } },
      { k: 'lmonth', label: '农历月', type: 'select', options: window.Lunar.monthOptions(), req: true, when: { key: 'cal', val: 'lunar' } },
      { k: 'lisLeap', label: '闰月', type: 'checkbox', cbText: '本年闰月（如闰七月）', when: { key: 'cal', val: 'lunar' } },
      { k: 'lday', label: '农历日', type: 'select', options: window.Lunar.dayOptions(), req: true, when: { key: 'cal', val: 'lunar' } },
      { k: 'yearly', label: '每年重复', type: 'checkbox', cbText: '每年重复提醒', def: true },
      { k: 'note', label: '备注', full: true, ph: '送礼想法、注意事项…' }
    ];
  }
  Cats.setPicker('annivTypes', function (k) { annivCat = k; ListPager.resetPg('people:anniv'); App.refresh(); });

  App.register(anniv);

  /* =========================================================
     9. 🤝 人情台账
  ========================================================= */
  var social = {
    id: 'social', icon: '🤝', name: '人情台账',
    render: function () {
      var arr = U.sortBy(D().social, 'date', true);
      if (socialCat) arr = arr.filter(function (x) { return (x.cat || '') === socialCat; });
      var out = arr.reduce(function (s, x) { return s + num(x.outAmt); }, 0);
      var back = arr.reduce(function (s, x) { return s + num(x.inAmt); }, 0);
      return UI.head('🤝 人情台账', '来往清清楚楚，随礼有据可依') +
        UI.stats([['记录条数', arr.length], ['送出合计', money(out), false, U.moneyFull(out)], ['收到合计', money(back), false, U.moneyFull(back)],
        ['净往来', money(back - out), true, U.moneyFull(back - out)]]) +
        UI.card({
          title: '往来明细',
          right: Cats.btn('socialCats', '分类管理', '🗂 分类管理') + '<button class="btn primary sm tap" data-act="new">+ 添加记录</button>',
          body: Cats.filterBar('socialCats', socialCat, { label: '人际' }) +
            '<input class="input" id="soSearch" placeholder="🔍 搜索对方姓名 / 关系 / 事由 / 备注" value="' + esc(soQ) + '" style="margin-bottom:14px">' +
            '<div id="soList">' + this.items(soQ) + '</div>'
        });
    },
    items: function (q) {
      var qq = (q || '').trim().toLowerCase();
      var arr = U.sortBy(D().social, 'date', true);
      if (socialCat) arr = arr.filter(function (x) { return (x.cat || '') === socialCat; });
      if (qq) arr = arr.filter(function (x) {
        return (x.name || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.rel || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.reason || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.note || '').toLowerCase().indexOf(qq) >= 0;
      });
      return ListPager.out({
        ns: 'people:social', items: arr, defSize: 5,
        empty: qq ? '没有匹配的人情记录' : '还没有人情往来记录，点上方「添加记录」', emptyIcon: '🤝',
        render: renderSocialItem
      });
    },
    mount: function (view) {
      var q = view.querySelector('#soSearch');
      if (q) q.oninput = function () { soQ = this.value; ListPager.resetPg('people:social'); var b = view.querySelector('#soList'); if (b) b.innerHTML = social.items(soQ); };
    },
    acts: {
      soexp: function (t) { socialExpanded = socialExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },
      new: function () {
        UI.form({ title: '添加人情记录', values: { date: U.today() }, fields: soFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().social.push(v); Store.save(); App.refresh();
        });
      },
      edit: function (t) {
        var x = D().social.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑记录', values: x, fields: soFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      del: function (t) {
        var x = D().social.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { D().social = D().social.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      }
    }
  };
  function renderSocialItem(x) {
    var open = socialExpanded === x.id;
    var out = num(x.outAmt), back = num(x.inAmt), net = back - out;
    var netHtml = (out || back)
      ? '<span class="badge grey" title="净 ' + U.moneyFull(net) + '">净 ' + (net > 0 ? '+' : '') + money(net) + '</span>' : '';
    var head = '<div class="row between"><span class="item-title">' + esc(x.name) +
      (x.rel ? ' <span class="badge grey">' + esc(x.rel) + '</span>' : '') + '</span>' +
      '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' + netHtml +
      ' <span style="font-size:11px;color:#999">' + (open ? '▾' : '▸') + '</span></span></div>';
    if (!open) {
      return '<div class="item" data-act="soexp" data-id="' + x.id + '"><div class="item-main">' + head +
        '<div class="item-meta"><span>' + U.fmtDate(x.date) + '</span>' +
        (x.cat ? '<span class="badge">' + esc(x.cat) + '</span>' : '') +
        (x.reason ? '<span class="badge grey">' + esc(x.reason) + '</span>' : '') +
        (out ? '<span title="送出 ' + U.moneyFull(out) + '">送出 ' + money(out) + '</span>' : '') +
        (back ? '<span title="回赠 ' + U.moneyFull(back) + '">回赠 ' + money(back) + '</span>' : '') + '</div></div></div>';
    }
    return '<div class="item open" data-act="soexp" data-id="' + x.id + '"><div class="item-main">' + head +
      '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span>' +
      (x.cat ? '<span class="badge">' + esc(x.cat) + '</span>' : '') +
      (x.reason ? '<span class="badge grey">' + esc(x.reason) + '</span>' : '') + '</div>' +
      '<div class="item-note">📤 我方送出：' + (x.outGift ? esc(x.outGift) : '—') + (out ? ' · <span title="' + U.moneyFull(out) + '">' + money(out) + '</span>' : '') + '</div>' +
      '<div class="item-note">📥 对方回赠：' + (x.inGift ? esc(x.inGift) : '—') + (back ? ' · <span title="' + U.moneyFull(back) + '">' + money(back) + '</span>' : '') + '</div>' +
      (x.note ? '<div class="item-note">📝 ' + esc(x.note) + '</div>' : '') +
      '</div>' + UI.ops(x.id, 'edit', 'del') + '</div>';
  }

  function soFields() {
    return [
      { k: 'name', label: '对方姓名', req: true },
      { k: 'rel', label: '关系', ph: '如：表姐 / 同事' },
      Cats.field('socialCats', '人际关系分类', { k: 'cat', ph: '可选分类（如亲戚 / 朋友）' }),
      { k: 'date', label: '发生日期', type: 'date', req: true, def: U.today() },
      { k: 'reason', label: '事由', ph: '如：结婚 / 满月 / 乔迁' },
      { k: 'outGift', label: '我方送出（礼物）', ph: '如：礼金 / 果篮' },
      { k: 'outAmt', label: '送出金额', type: 'number', min: 0 },
      { k: 'inGift', label: '对方回赠（礼品）' },
      { k: 'inAmt', label: '回赠金额', type: 'number', min: 0 },
      { k: 'note', label: '备注事项', type: 'textarea', rows: 3 }
    ];
  }
  Cats.setPicker('socialCats', function (k) { socialCat = k; ListPager.resetPg('people:social'); App.refresh(); });

  App.register(social);

  /* =========================================================
     10. ✈️ 愿望清单
  ========================================================= */
  var wish = {
    id: 'wish', icon: '✈️', name: '愿望清单',
    render: function () {
      var all = D().wish, f = App.tab('wish', 'f', 'all'), cat = App.tab('wish', 'cat', '');
      var done = all.filter(function (x) { return x.done; });
      var pct = all.length ? done.length / all.length * 100 : 0;
      return UI.head('✈️ 愿望清单', '人生梦想、旅行目的地、想做的事，一件件实现') +
        UI.card({
          title: '整体进度', sub: done.length + ' / ' + all.length + ' 已实现',
          body: UI.bar(pct) + '<div class="small muted" style="margin-top:8px">已完成 ' + pct.toFixed(0) + '%，继续加油</div>'
        }) +
        UI.card({
          title: '愿望列表', right: Cats.btn('wishCats', '愿望分类') + '<button class="btn primary sm tap" data-act="new">+ 添加愿望</button>',
          body: '<div class="row" style="flex-direction:column;align-items:flex-start;gap:12px">' +
            UI.pills([{ k: 'all', t: '全部' }, { k: 'todo', t: '待实现' }, { k: 'done', t: '已实现' }], f, 'f') +
            Cats.filterBar('wishCats', cat, { label: '分类' }) +
            '</div><div style="height:14px"></div>' +
            '<input class="input" id="wiSearch" placeholder="🔍 搜索愿望内容 / 分类 / 备注" value="' + esc(wiQ) + '">' +
            '<div style="height:14px"></div>' +
            '<div id="wiList">' + this.items(wiQ) + '</div>'
        });
    },
    items: function (q) {
      var qq = (q || '').trim().toLowerCase();
      var f = App.tab('wish', 'f', 'all'), cat = App.tab('wish', 'cat', '');
      var arr = D().wish.filter(function (x) {
        if (f === 'done' && !x.done) return false;
        if (f === 'todo' && x.done) return false;
        if (cat && x.cat !== cat) return false;
        if (qq && (x.title || '').toLowerCase().indexOf(qq) < 0 && (x.note || '').toLowerCase().indexOf(qq) < 0 && (x.cat || '').toLowerCase().indexOf(qq) < 0) return false;
        return true;
      });
      return ListPager.out({
        ns: 'people:wish', items: arr, defSize: 5,
        empty: qq ? '没有匹配的愿望' : '写下第一个愿望吧', emptyIcon: '✨',
        render: renderWishItem
      });
    },
    mount: function (view) {
      var q = view.querySelector('#wiSearch');
      if (q) q.oninput = function () { wiQ = this.value; ListPager.resetPg('people:wish'); var b = view.querySelector('#wiList'); if (b) b.innerHTML = wish.items(wiQ); };
    },
    acts: {
      wexp: function (t) { wishExpanded = wishExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },
      f: function (t) { App.setTab('wish', 'f', t.dataset.k); ListPager.resetPg('people:wish'); App.refresh(); },
      new: function () {
        UI.form({ title: '添加愿望', fields: wiFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.done = false; D().wish.push(v); Store.save(); App.refresh();
        });
      },
      edit: function (t) {
        var x = D().wish.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑愿望', values: x, fields: wiFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      toggle: function (t) {
        var x = D().wish.filter(function (a) { return a.id === t.dataset.id; })[0];
        x.done = !x.done; x.doneAt = x.done ? U.today() : '';
        Store.save(); App.refresh(); if (x.done) U.toast('又实现一个 🎉');
      },
      del: function (t) {
        var x = D().wish.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.title, function () { D().wish = D().wish.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      }
    }
  };
  function wiFields() {
    return [
      { k: 'title', label: '愿望内容', req: true, full: true, ph: '如：去一次冰岛看极光' },
      Cats.field('wishCats', '分类', { k: 'cat' }),
      { k: 'when', label: '计划时间', ph: '如：2027 年前 / 明年春天' },
      { k: 'note', label: '备注', type: 'textarea', rows: 3 }
    ];
  }
  function renderWishItem(x) {
    var expanded = wishExpanded === x.id;
    if (!expanded) {
      return '<div class="item' + (x.done ? ' done' : '') + '" data-act="wexp" data-id="' + x.id + '">' +
        '<div class="item-main"><div class="row between"><span class="item-title">' + (x.done ? '✅ ' : '') + esc(x.title) + '</span>' +
        '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
        (x.when ? '<span class="badge grey">' + esc(x.when) + '</span>' : '') +
        ' <span style="font-size:11px;color:#999">▸</span></span></div>' +
        '<div class="item-meta"><span class="badge' + (x.done ? '' : ' grey') + '">' + esc(x.cat || '目标') + '</span>' +
        (x.done && x.doneAt ? '<span class="badge">🎉 已实现</span>' : '') + '</div></div></div>';
    }
    return '<div class="item' + (x.done ? ' done' : '') + ' open" data-act="wexp" data-id="' + x.id + '">' + UI.check(x.done, 'toggle', x.id) +
      '<div class="item-main"><div class="row between"><span class="item-title">' + esc(x.title) + '</span>' +
      '<span style="font-size:11px;color:#999">▾</span></div>' +
      '<div class="item-meta"><span class="badge' + (x.done ? '' : ' grey') + '">' + esc(x.cat || '目标') + '</span>' +
      (x.done && x.doneAt ? '<span class="badge">🎉 ' + U.fmtDate(x.doneAt) + ' 实现</span>' : '') +
      (x.when ? '<span>计划 ' + esc(x.when) + '</span>' : '') + '</div>' +
      (x.note ? '<div class="item-note">' + esc(x.note) + '</div>' : '') + '</div>' +
      UI.ops(x.id, 'edit', 'del') + '</div>';
  }
  Cats.setPicker('wishCats', function (k) { App.setTab('wish', 'cat', k); ListPager.resetPg('people:wish'); App.refresh(); });

  App.register(wish);

  /* =========================================================
     11. 👥 家人档案
  ========================================================= */
  var family = {
    id: 'family', icon: '👥', name: '家人档案',
    render: function () {
      var arr = D().family;
      return UI.head('👥 家人档案', '尺码、喜好、忌口一目了然，送礼买衣不出错') +
        UI.card({
          title: '成员档案', sub: arr.length + ' 位', right: '<button class="btn primary sm tap" data-act="new">+ 添加成员</button>',
          body: '<input class="input" id="faSearch" placeholder="🔍 搜索姓名 / 关系 / 喜好 / 忌口 / 备注" value="' + esc(faQ) + '" style="margin-bottom:14px">' +
            '<div id="faList">' + this.items(faQ) + '</div>'
        });
    },
    items: function (q) {
      var qq = (q || '').trim().toLowerCase();
      var arr = D().family;
      if (qq) arr = arr.filter(function (x) {
        return (x.name || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.rel || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.like || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.avoid || '').toLowerCase().indexOf(qq) >= 0 ||
          (x.note || '').toLowerCase().indexOf(qq) >= 0 ||
          familyBirthSearch(x).toLowerCase().indexOf(qq) >= 0;
      });
      return ListPager.out({
        ns: 'people:family', items: arr, defSize: 5,
        empty: qq ? '没有匹配的家人档案' : '添加家人档案，买东西不再靠猜', emptyIcon: '👥',
        render: renderFamilyItem
      });
    },
    mount: function (view) {
      var q = view.querySelector('#faSearch');
      if (q) q.oninput = function () { faQ = this.value; ListPager.resetPg('people:family'); var b = view.querySelector('#faList'); if (b) b.innerHTML = family.items(faQ); };
    },
    acts: {
      fexp: function (t) { familyExpanded = familyExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },
      new: function () {
        UI.form({ title: '添加成员', fields: fFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().family.push(v); Store.save(); App.refresh();
        });
      },
      edit: function (t) {
        var x = D().family.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑档案', values: x, fields: fFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      del: function (t) {
        var x = D().family.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { D().family = D().family.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      }
    }
  };
  function fFields() {
    return [
      { k: 'name', label: '姓名', req: true },
      { k: 'rel', label: '关系', ph: '如：妈妈 / 弟弟' },
      { k: 'fcal', label: '生日历法', type: 'select', options: [{ v: 'solar', t: '公历' }, { v: 'lunar', t: '农历' }], def: 'solar' },
      { k: 'birth', label: '公历生日', type: 'date', when: { key: 'fcal', val: 'solar' } },
      { k: 'flmonth', label: '农历月', type: 'select', options: window.Lunar.monthOptions(), when: { key: 'fcal', val: 'lunar' } },
      { k: 'flday', label: '农历日', type: 'select', options: window.Lunar.dayOptions(), when: { key: 'fcal', val: 'lunar' } },
      { k: 'flisLeap', label: '闰月', type: 'checkbox', cbText: '本年闰月（如闰七月）', when: { key: 'fcal', val: 'lunar' } },
      { k: 'height', label: '身高 (cm)', type: 'number' },
      { k: 'weight', label: '体重 (kg)', type: 'number' },
      { k: 'top', label: '上衣尺码', ph: '如：M / 165-88A' },
      { k: 'pants', label: '裤装尺码', ph: '如：29 / L' },
      { k: 'shoe', label: '鞋码', ph: '如：38' },
      { k: 'waist', label: '腰围 (cm)', type: 'number' },
      { k: 'shoulder', label: '肩宽 (cm)', type: 'number' },
      { k: 'ring', label: '戒指尺寸', ph: '如：12 号' },
      { k: 'like', label: '喜好', type: 'textarea', rows: 3, ph: '喜欢的颜色、品牌、口味…' },
      { k: 'avoid', label: '忌口 / 忌讳', type: 'textarea', rows: 3, ph: '过敏源、不吃什么…' },
      { k: 'note', label: '其他备注', type: 'textarea', rows: 3 }
    ];
  }
  /* 家人生日：兼容公历 / 农历，返回 {lunar,label,next,days} */
  function familyBirth(x) {
    var L = window.Lunar, t = U.today();
    if (x.fcal === 'lunar') {
      var m = +x.flmonth, d = +x.flday;
      if (!m || !d) return null;
      var leap = !!x.flisLeap, y = new Date().getFullYear();
      var s = U.parseDate(L.toSolar(y, m, d, leap));
      if (s < U.parseDate(t)) s = U.parseDate(L.toSolar(y + 1, m, d, leap));
      var nd = s.getFullYear() + '-' + U.pad(s.getMonth() + 1) + '-' + U.pad(s.getDate());
      return { lunar: true, label: '农历 ' + L.label(m, d, leap), next: nd, days: U.dayDiff(t, nd) };
    }
    if (!x.birth) return null;
    var dd = U.parseDate(x.birth), now = new Date();
    var c = new Date(now.getFullYear(), dd.getMonth(), dd.getDate());
    if (c < new Date(now.getFullYear(), now.getMonth(), now.getDate())) c = new Date(now.getFullYear() + 1, dd.getMonth(), dd.getDate());
    var nds = c.getFullYear() + '-' + U.pad(c.getMonth() + 1) + '-' + U.pad(c.getDate());
    return { lunar: false, label: U.fmtDate(x.birth), next: nds, days: U.dayDiff(t, nds) };
  }
  function familyBirthHtml(x, full) {
    var b = familyBirth(x);
    if (!b) return '';
    var soon = b.days >= 0 && b.days <= 30;
    var cd = b.days === 0 ? '今天生日 🎉' : b.days + ' 天后';
    return '<div class="item-meta"><span>🎂 ' + esc(b.label) + '</span>' +
      (b.lunar ? '<span class="badge purple">农历</span>' : '') +
      (full ? '<span class="badge grey">' + U.fmtDate(b.next) + ' · ' + cd + '</span>'
        : (soon ? '<span class="badge' + (b.days <= 7 ? '' : ' grey') + '">' + cd + '</span>' : '')) +
      '</div>';
  }
  function familyBirthSearch(x) {
    var b = familyBirth(x);
    return b ? b.label + ' ' + b.next : (x.birth || '');
  }

  function renderFamilyItem(x) {
    var rows = [
      ['身高', x.height, 'cm'], ['体重', x.weight, 'kg'], ['上衣', x.top, ''], ['裤装', x.pants, ''],
      ['鞋码', x.shoe, ''], ['腰围', x.waist, 'cm'], ['肩宽', x.shoulder, 'cm'], ['戒指', x.ring, '号']
    ].filter(function (r) { return r[1] !== '' && r[1] !== undefined && r[1] !== null; });
    var expanded = familyExpanded === x.id;
    if (!expanded) {
      return '<div class="item" data-act="fexp" data-id="' + x.id + '"><div class="item-main">' +
        '<div class="row between"><span class="item-title">' + esc(x.name) + '</span>' +
        '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
        '<span class="badge grey">' + esc(x.rel || '家人') + '</span>' +
        ' <span style="font-size:11px;color:#999">▸</span></span></div>' +
        familyBirthHtml(x, false) +
        (rows.length ? '<div class="pills" style="margin-top:6px">' + rows.slice(0, 3).map(function (r) {
          return '<span class="pill" style="pointer-events:none;font-size:11px">' + r[0] + ' ' + esc(r[1]) + r[2] + '</span>';
        }).join('') + (rows.length > 3 ? '<span class="pill" style="pointer-events:none;font-size:11px">…+' + (rows.length - 3) + '</span>' : '') + '</div>' : '') +
        '</div></div>';
    }
    return '<div class="item open" data-act="fexp" data-id="' + x.id + '"><div class="item-main">' +
      '<div class="row between"><span class="item-title">' + esc(x.name) + '</span>' +
      '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
      '<span class="badge grey">' + esc(x.rel || '家人') + '</span>' +
      ' <span style="font-size:11px;color:#999">▾</span></span></div>' +
      familyBirthHtml(x, true) +
      (rows.length ? '<div class="pills" style="margin-top:8px">' + rows.map(function (r) {
        return '<span class="pill" style="pointer-events:none">' + r[0] + ' ' + esc(r[1]) + r[2] + '</span>';
      }).join('') + '</div>' : '') +
      (x.like ? '<div class="item-note" style="margin-top:8px">💚 喜好：' + esc(x.like) + '</div>' : '') +
      (x.avoid ? '<div class="item-note">🚫 忌口 / 忌讳：' + esc(x.avoid) + '</div>' : '') +
      (x.note ? '<div class="item-note">📝 ' + esc(x.note) + '</div>' : '') +
      '</div>' + UI.ops(x.id, 'edit', 'del') + '</div>';
  }
  App.register(family);

  /* =========================================================
     14. 🐱 猫咪档案
  ========================================================= */
  var CSUB = [
    { k: 'deworm', t: '驱虫记录', i: '💊' },
    { k: 'vaccine', t: '疫苗记录', i: '💉' },
    { k: 'food', t: '猫粮记录', i: '🐟' },
    { k: 'litter', t: '猫砂记录', i: '🧺' }
  ];

  var cat = {
    id: 'cat', icon: '🐱', name: '猫咪档案',
    render: function () {
      var pets = D().cat.pets;
      var pid = App.tab('cat', 'pet', pets.length ? pets[0].id : '');
      if (pets.length && !pets.some(function (p) { return p.id === pid; })) { pid = pets[0].id; App.setTab('cat', 'pet', pid); }
      var sub = App.tab('cat', 'sub', 'deworm');

      return UI.head('🐱 猫咪档案', '驱虫、疫苗、猫粮、猫砂，主子的一切都在这儿') +
        UI.card({
          title: '我的猫咪', right: '<button class="btn primary sm tap" data-act="pnew">+ 添加猫咪</button>',
          body: pets.length ? '<div class="list">' + pets.map(function (p) {
            return '<button class="opt-row tap' + (p.id === pid ? ' on' : '') + '" data-act="psel" data-id="' + p.id + '">' +
              '<span class="oi">🐾</span>' +
              '<span class="grow"><strong>' + esc(p.name) + '</strong>' +
              '<span class="small muted"> · ' + [p.breed, p.sex, p.birth ? U.fmtDate(p.birth) : '', num(p.weight) ? p.weight + 'kg' : ''].filter(Boolean).join(' · ') + '</span></span>' +
              '<span class="link-btn tap" data-act="pedit" data-id="' + p.id + '">编辑</span>' +
              '<span class="link-btn del tap" data-act="pdel" data-id="' + p.id + '">删除</span>' +
              '</button>';
          }).join('') + '</div>' : UI.empty('先添加一只猫咪', '🐱')
        }) +
        (pets.length ? UI.tabs(CSUB, sub, 'sub') + this.sub(sub, pid) : '');
    },

    sub: function (sub, pid) {
      var arr = D().cat[sub].filter(function (x) { return x.pet === pid; });
      arr = U.sortBy(arr, 'date', true);
      var meta = CSUB.filter(function (c) { return c.k === sub; })[0];
      var body;
      var listHtml = '<div class="list">' + (arr.length ? ListPager.slice('cat:' + sub, arr).map(renderCatRecItem).join('') : UI.empty('还没有' + meta.t, meta.i)) + '</div>' + ListPager.pager('cat:' + sub, arr.length);

      if (sub === 'deworm' || sub === 'vaccine') {
        var next = arr.filter(function (x) { return x.next; }).sort(function (a, b) { return String(a.next).localeCompare(String(b.next)); })[0];
        body = (next ? '<div class="item ' + (U.dayDiff(U.today(), next.next) <= 14 ? 'alert' : 'hl') + '" style="margin-bottom:16px">' +
          '<div class="item-main"><div class="item-title">下次' + (sub === 'deworm' ? '驱虫' : '接种') + '：' + U.fmtDate(next.next, true) + '</div>' +
          '<div class="item-meta"><span>' + U.relDay(next.next) + '</span><span class="badge grey">' + esc(next.name || '') + '</span></div></div></div>' : '') +
          listHtml;
      } else {
        body = listHtml;
      }

      return UI.card({
        title: meta.i + ' ' + meta.t,
        right: '<button class="btn primary sm tap" data-act="rnew">+ 添加' + meta.t.replace('记录', '') + '</button>',
        body: body
      });
    },

    acts: {
      psel: function (t, e) {
        if (e.target.closest('[data-act="pedit"],[data-act="pdel"]')) return;
        App.setTab('cat', 'pet', t.dataset.id); ListPager.resetPg('cat:' + App.tab('cat', 'sub', 'deworm')); App.refresh();
      },
      sub: function (t) { App.setTab('cat', 'sub', t.dataset.k); ListPager.resetPg('cat:' + t.dataset.k); App.refresh(); },
      pnew: function () {
        UI.form({ title: '添加猫咪', fields: petFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().cat.pets.push(v); App.setTab('cat', 'pet', v.id); Store.save(); App.refresh();
        });
      },
      pedit: function (t) {
        var x = D().cat.pets.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑猫咪', values: x, fields: petFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      pdel: function (t) {
        var x = D().cat.pets.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () {
          D().cat.pets = D().cat.pets.filter(function (a) { return a.id !== x.id; });
          ['deworm', 'vaccine', 'food', 'litter'].forEach(function (k) {
            D().cat[k] = D().cat[k].filter(function (r) { return r.pet !== x.id; });
          });
          Store.save(); App.refresh();
        });
      },
      rnew: function () {
        var sub = App.tab('cat', 'sub', 'deworm'), pid = App.tab('cat', 'pet', '');
        UI.form({ title: '添加' + subName(sub), values: { date: U.today() }, fields: recFields(sub) }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.pet = pid; D().cat[sub].push(v); Store.save(); App.refresh(); U.toast('已添加');
        });
      },
      redit: function (t) {
        var sub = App.tab('cat', 'sub', 'deworm');
        var x = D().cat[sub].filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑' + subName(sub), values: x, fields: recFields(sub) }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      rdel: function (t) {
        var sub = App.tab('cat', 'sub', 'deworm');
        var x = D().cat[sub].filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () {
          D().cat[sub] = D().cat[sub].filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh();
        });
      }
    }
  };
  function subName(k) { return (CSUB.filter(function (c) { return c.k === k; })[0] || {}).t || '记录'; }
  function renderCatRecItem(x) {
    return '<div class="item"><div class="item-main">' +
      '<div class="row between"><span class="item-title">' + esc(x.name) + '</span>' +
      (x.kind ? '<span class="badge">' + esc(x.kind) + '</span>' : '') +
      (num(x.rate) ? '<span class="score"><span class="s-n">' + num(x.rate) + '</span><span class="s-max">/5 分</span></span>' : '') + '</div>' +
      '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span>' +
      (x.next ? '<span class="badge grey">下次 ' + U.fmtDate(x.next) + '</span>' : '') +
      (x.place ? '<span>' + esc(x.place) + '</span>' : '') +
      (x.spec ? '<span class="badge grey">' + esc(x.spec) + '</span>' : '') +
      (num(x.price) ? '<span class="badge grey">' + money(x.price) + '</span>' : '') + '</div>' +
      (x.note ? '<div class="item-note">' + esc(x.note) + '</div>' : '') +
      '</div>' + UI.ops(x.id, 'redit', 'rdel') + '</div>';
  }
  function petFields() {
    return [
      { k: 'name', label: '猫咪名字', req: true },
      { k: 'breed', label: '品种', ph: '如：中华田园猫 / 布偶' },
      { k: 'sex', label: '性别', type: 'select', options: ['弟弟', '妹妹'], def: '弟弟' },
      { k: 'birth', label: '生日', type: 'date' },
      { k: 'weight', label: '体重 (kg)', type: 'number', step: 0.1 },
      { k: 'fixed', label: '是否绝育', type: 'select', options: ['已绝育', '未绝育'], def: '未绝育' },
      { k: 'note', label: '备注', type: 'textarea', rows: 3, ph: '性格、习惯、注意事项…' }
    ];
  }
  function recFields(sub) {
    if (sub === 'deworm') return [
      { k: 'date', label: '驱虫日期', type: 'date', req: true, def: U.today() },
      { k: 'name', label: '药品名称', req: true, ph: '如：大宠爱' },
      { k: 'kind', label: '驱虫类型', type: 'select', options: ['体外', '体内', '体内外同驱'], def: '体外' },
      { k: 'next', label: '下次驱虫日期', type: 'date' },
      { k: 'price', label: '花费', type: 'number', min: 0 },
      { k: 'note', label: '备注', type: 'textarea', rows: 3 }
    ];
    if (sub === 'vaccine') return [
      { k: 'date', label: '接种日期', type: 'date', req: true, def: U.today() },
      { k: 'name', label: '疫苗名称', req: true, ph: '如：妙三多' },
      { k: 'kind', label: '针次', type: 'select', options: ['首针', '第二针', '第三针', '年度加强', '狂犬'], def: '首针' },
      { k: 'place', label: '接种医院' },
      { k: 'next', label: '下次接种日期', type: 'date' },
      { k: 'price', label: '花费', type: 'number', min: 0 },
      { k: 'note', label: '备注', type: 'textarea', rows: 3 }
    ];
    if (sub === 'food') return [
      { k: 'date', label: '购买日期', type: 'date', req: true, def: U.today() },
      { k: 'name', label: '猫粮品牌 / 名称', req: true },
      { k: 'kind', label: '类型', type: 'select', options: ['主食干粮', '主食冻干', '主食罐头', '零食', '处方粮'], def: '主食干粮' },
      { k: 'spec', label: '规格', ph: '如：2kg / 6 罐' },
      { k: 'price', label: '价格', type: 'number', min: 0 },
      { k: 'rate', label: '爱吃程度（5 分制）', type: 'number', min: 0, max: 5, step: 0.5 },
      { k: 'note', label: '评价备注', type: 'textarea', rows: 3, ph: '接受度、便便情况、是否回购…' }
    ];
    return [
      { k: 'date', label: '购买日期', type: 'date', req: true, def: U.today() },
      { k: 'name', label: '猫砂品牌 / 名称', req: true },
      { k: 'kind', label: '类型', type: 'select', options: ['豆腐砂', '膨润土', '混合砂', '水晶砂', '松木砂'], def: '混合砂' },
      { k: 'spec', label: '规格', ph: '如：2.5kg × 6 包' },
      { k: 'price', label: '价格', type: 'number', min: 0 },
      { k: 'rate', label: '好用程度（5 分制）', type: 'number', min: 0, max: 5, step: 0.5 },
      { k: 'note', label: '评价备注', type: 'textarea', rows: 3, ph: '结团、粉尘、除臭、带砂情况…' }
    ];
  }
  App.register(cat);

  /* =========================================================
     15. ⚙️ 设置
  ========================================================= */
  var settings = {
    id: 'settings', icon: '⚙️', name: '设置',
    render: function () {
      var d = D();
      var fsPct = Math.round((d.settings.fontScale || 1) * 100);
      var bk = window.Backup ? window.Backup.cfg() : { enabled: false, webdav: {}, gist: {}, last: {} };
      function backupRow(title, desc, c) {
        var isW = title === 'WebDAV';
        var status = c.enabled
          ? (isW ? '已启用' : (c.gist ? '已启用 · ' + esc(String(c.gist).slice(0, 8)) + '…' : '已启用'))
          : '未启用';
        return '<div class="bk-target' + (c.enabled ? ' on' : '') + '">' +
          '<div class="bk-t-info"><b>' + title + '</b><span class="small muted">' + esc(desc) + '</span>' +
          '<span class="badge ' + (c.enabled ? 'cream' : 'grey') + '">' + status + '</span></div>' +
          '<div class="bk-t-ops">' +
          '<button class="btn sm tap" data-act="' + (isW ? 'bkWebdav' : 'bkGist') + '">配置</button>' +
          '<button class="btn sm tap" data-act="bkTest" data-t="' + (isW ? 'webdav' : 'gist') + '">测试连接</button>' +
          '</div></div>';
      }
      var counts = [
        ['打卡任务', (d.checkin.habits || []).length],
        ['累计打卡', Object.keys(d.checkin.log || {}).reduce(function (s, k) { return s + Object.keys(d.checkin.log[k] || {}).length; }, 0)],
        ['影剧书', d.media.length], ['备考笔记', d.exam.notes.length + d.exam.plans.length + d.exam.records.length],
        ['车辆记录', (d.vehicles.ev.charges.length + d.vehicles.fuel.refuels.length)], ['身体记录', d.body.measures.length + d.body.sports.length + d.body.meals.length],
        ['物品管理', d.items.stock.length + d.items.buy.length + d.items.consum.length],
        ['财务流水', d.finance.flows.length], ['纪念日', d.anniv.length], ['人情往来', d.social.length],
        ['愿望', d.wish.length], ['家人档案', d.family.length], ['任务', d.tasks.length],
        ['工作留痕', d.worklog.length], ['猫咪记录', d.cat.deworm.length + d.cat.vaccine.length + d.cat.food.length + d.cat.litter.length]
      ];
      var kb = (Store.size() / 1024).toFixed(1);

      return UI.head('⚙️ 设置', '数据备份、基础参数与使用说明') +
        UI.card({
          title: '💾 数据备份',
          sub: '当前占用 ' + kb + ' KB · 自动备份' + (bk.enabled ? '已开启' : '未开启'),
          body:
            '<label class="opt-row tap" style="min-height:50px;margin-bottom:14px"><input type="checkbox" data-act="bkToggle" ' + (bk.enabled ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#8AA832"><span><b>自动备份到云端 / NAS</b><span class="small muted"> · 保存后防抖、启动时、每小时各一次</span></span></label>' +
            '<div class="backup-cfg">' +
              backupRow('WebDAV', '自己的 NAS / 坚果云等支持 WebDAV 的网盘', bk.webdav) +
              backupRow('GitHub', 'GitHub Gist 私密仓库（国际云端，开箱即用）', bk.gist) +
            '</div>' +
            '<div class="row" style="margin-top:12px">' +
            '<button class="btn primary tap" data-act="bkNow">☁ 立即备份一次</button>' +
            '</div>' +
            (bk.last && bk.last.time ? '<p class="small muted" style="margin-top:10px">上次备份：' + esc(bk.last.time) + ' · ' + (bk.last.ok ? '✅ 成功' : '⚠️ 失败') + (bk.last.msg ? '<br>' + esc(bk.last.msg) : '') + '</p>' : '') +
            '<p class="small muted" style="margin-top:12px">手动导出仍建议保留，换设备前再导一份留底。<b>115 / 百度 / 阿里云盘</b>等无公开 WebDAV 或 CORS 接口，无法纯前端直连；国内可改用坚果云 WebDAV（配置时选「服务商预设」一键填地址），国际可用 GitHub Gist。NAS 需在 WebDAV 服务端允许本应用域名跨域。</p>' +
            '<div class="row" style="margin-top:8px">' +
            '<button class="btn tap" data-act="export">⬇ 导出全部数据备份</button>' +
            '<button class="btn tap" data-act="import">⬆ 导入备份文件</button>' +
            '</div>' +
            '<input type="file" id="fileIn" accept="application/json,.json" style="display:none">'
        }) +
        UI.card({
          title: '📊 数据概览',
          body: '<div class="stat-grid">' + counts.map(function (c) {
            return '<div class="stat"><span class="k">' + c[0] + '</span><span class="v">' + c[1] + '</span></div>';
          }).join('') + '</div>'
        }) +
        UI.card({
          title: '🧮 基础参数',
          body: '<div class="list">' +
            '<button class="opt-row tap" data-act="bmr"><span class="oi">🔥</span><span class="grow">基础代谢 BMR' +
            '<span class="small muted"> · 用于饮食热量缺口计算</span></span>' +
            '<span class="badge">' + (num(d.body.bmr) > 0 ? num(d.body.bmr) + ' kcal' : '自动估算') + '</span></button>' +
            '<button class="opt-row tap" data-act="wgoal"><span class="oi">💧</span><span class="grow">每日饮水目标</span>' +
            '<span class="badge">' + (num(d.body.waterGoal) || 2000) + ' ml</span></button>' +
            '<button class="opt-row tap" data-act="privacy"><span class="oi">🔒</span><span class="grow">隐私说明</span>' +
            '<span class="badge grey">查看</span></button>' +
            '</div>'
        }) +
        UI.card({
          title: '🔤 字体大小',
          sub: '调节后全站（含弹窗）即时生效，会自动保存',
          body:
            '<div class="row" style="gap:12px;align-items:center">' +
            '<span class="small muted">小</span>' +
            '<input type="range" class="font-range" min="85" max="175" step="5" value="' + fsPct + '" data-chg="fontScale" style="flex:1">' +
            '<span class="small muted">大</span>' +
            '<span class="badge" id="fsLabel">' + fsPct + '%</span>' +
            '</div>' +
            '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">' +
            [85, 100, 115, 130, 150, 175].map(function (v) {
              return '<button class="chip tap' + (v === fsPct ? ' on' : '') + '" data-act="fsPreset" data-k="' + v + '">' + v + '%</button>';
            }).join('') +
            '</div>'
        }) +
        UI.card({
          title: '🌗 外观主题',
          sub: '可选择跟随系统自动切换浅色 / 深色',
          body: '<div class="row" style="gap:8px;flex-wrap:wrap">' +
            [['auto', '🌗 跟随系统'], ['light', '☀️ 浅色'], ['dark', '🌙 深色']].map(function (o) {
              return '<button class="chip tap' + ((d.settings.theme || 'auto') === o[0] ? ' on' : '') + '" data-act="themeSet" data-k="' + o[0] + '">' + o[1] + '</button>';
            }).join('') + '</div>'
        }) +
        UI.card({
          title: '📱 添加到手机桌面',
          body: '<div class="privacy"><ul>' +
            '<li><b>iPhone：</b>Safari 打开本页 → 底部「分享」→「添加到主屏幕」</li>' +
            '<li><b>Android：</b>Chrome 打开本页 → 右上角菜单 →「添加到主屏幕 / 安装应用」</li>' +
            '<li>添加后可像 App 一样全屏打开，数据依然保存在本机。</li>' +
            '</ul></div>'
        }) +
        UI.card({
          title: '⚠️ 危险操作',
          body: '<p class="small muted" style="margin-bottom:14px">清空后所有板块数据都会被删除且无法恢复，请务必先导出备份。</p>' +
            '<button class="btn danger tap" data-act="clear">清空全部数据</button>'
        });
    },

    mount: function (view) {
      var f = view.querySelector('#fileIn');
      if (!f) return;
      // 字体大小滑块：拖动时实时预览（不写盘），松开后由 fontScale 写入
      view.addEventListener('input', function (e) {
        var t = e.target.closest('[data-chg="fontScale"]');
        if (!t) return;
        var pct = num(t.value);
        UI.applyFont(pct / 100);
        var lab = view.querySelector('#fsLabel');
        if (lab) lab.textContent = pct + '%';
      });
      f.onchange = function () {
        var file = this.files[0]; if (!file) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var obj = JSON.parse(r.result);
            var payload = obj.data || obj;
            if (typeof payload !== 'object') throw new Error('格式错误');
            UI.confirm('导入备份？', '将用备份文件覆盖当前所有数据' + (obj.exportedAt ? '（备份时间 ' + obj.exportedAt + '）' : '') + '。', '确认导入')
              .then(function (ok) {
                if (!ok) return;
                Store.data = payload;
                if (!Store.data.ui) Store.data.ui = { last: 'settings', tabs: {} };
                Store.data.settings = Store.data.settings || {};
                Store.data.settings.privacy = true;
                Store.save(); Store.load(); App.refresh(); U.toast('导入成功 ✅');
              });
          } catch (e) { U.toast('文件解析失败，请确认是本应用导出的备份'); }
        };
        r.readAsText(file);
        this.value = '';
      };
    },

    acts: {
      fontScale: function (t) {
        var pct = num(t.value);
        Store.data.settings.fontScale = pct / 100;
        Store.save();
      },
      fsPreset: function (t) {
        var pct = num(t.dataset.k);
        Store.data.settings.fontScale = pct / 100;
        UI.applyFont(pct / 100);
        Store.save(); App.refresh();
      },
      themeSet: function (t) {
        var k = t.dataset.k;
        Store.data.settings.theme = k;
        Store.save();
        var de = document.documentElement;
        if (k === 'dark') de.setAttribute('data-theme', 'dark');
        else if (k === 'light') de.setAttribute('data-theme', 'light');
        else de.removeAttribute('data-theme');
        var tc = document.querySelector('meta[name="theme-color"]');
        if (tc) tc.setAttribute('content', (k === 'light') ? '#FDFCF4' : '#16130E');
        U.toast(k === 'dark' ? '已切换深色 🌙' : k === 'light' ? '已切换浅色 ☀️' : '已跟随系统 🌗');
        App.refresh();
      },
      bkToggle: function () {
        var b = window.Backup.cfg();
        b.enabled = !b.enabled;
        Store.save(true);
        if (b.enabled) { window.Backup.init(); U.toast('自动备份已开启'); }
        else U.toast('自动备份已关闭');
        App.refresh();
      },
      bkWebdav: function () {
        var b = window.Backup.cfg();
        var PRESETS = {
          '': '自定义',
          'https://dav.jianguoyun.com/dav/': '坚果云',
          'https://你的域名/remote.php/dav/files/用户名/': 'Nextcloud',
          'https://你的域名:5006/dav/': '群晖 NAS',
          'https://你的域名:5006/': '威联通 NAS'
        };
        var cur = b.webdav.url || '';
        var presetVal = '';
        for (var k in PRESETS) { if (k && cur && cur.indexOf(k) === 0) { presetVal = k; break; } }
        UI.form({
          title: '配置 WebDAV 备份', desc: '选常用服务商可一键填入地址；密码仅存本机。',
          values: { preset: presetVal, url: cur, user: b.webdav.user, pass: b.webdav.pass, file: b.webdav.file, enabled: b.webdav.url ? b.webdav.enabled : true },
          fields: [
            { k: 'preset', label: '服务商预设', type: 'select', options: [
              { v: '', t: '自定义' },
              { v: 'https://dav.jianguoyun.com/dav/', t: '坚果云' },
              { v: 'https://你的域名/remote.php/dav/files/用户名/', t: 'Nextcloud' },
              { v: 'https://你的域名:5006/dav/', t: '群晖 NAS' },
              { v: 'https://你的域名:5006/', t: '威联通 NAS' }
            ] },
            { k: 'url', label: 'WebDAV 地址', req: true, full: true, ph: 'https://NAS:5006/dav/ 或 https://dav.jianguoyun.com/dav/' },
            { k: 'user', label: '用户名', req: true, full: true },
            { k: 'pass', label: '密码', type: 'password', req: true, full: true },
            { k: 'file', label: '备份文件名', full: true, ph: '英文文件名', hint: '建议英文，中文名在部分网盘可能异常' },
            { k: 'enabled', label: '启用 WebDAV 备份', type: 'checkbox', cbText: '启用此目标', def: true }
          ],
          onMount: function (el) {
            var sel = el.querySelector('[name="preset"]');
            var urlInput = el.querySelector('[name="url"]');
            if (sel && urlInput) sel.addEventListener('change', function () {
              if (sel.value) { urlInput.value = sel.value; var lab = PRESETS[sel.value] || ''; if (lab) urlInput.placeholder = lab + ' 地址'; }
            });
          }
        }).then(function (v) {
          if (!v) return;
          b.webdav = { enabled: !!v.enabled, url: v.url, user: v.user, pass: v.pass, file: v.file || 'workbench-backup.json' };
          Store.save(true); App.refresh(); U.toast('WebDAV 配置已保存');
        });
      },
      bkGist: function () {
        var b = window.Backup.cfg();
        UI.form({
          title: '配置 GitHub Gist 备份', desc: '用有 gist 权限的 Token（ghp_...），数据写入私密 Gist。',
          values: { token: b.gist.token, gist: b.gist.gist, file: b.gist.file, api: b.gist.api, enabled: b.gist.token ? b.gist.enabled : true },
          fields: [
            { k: 'token', label: 'GitHub Token', type: 'password', req: true, full: true, ph: 'ghp_xxx 需 gist 权限' },
            { k: 'gist', label: 'Gist ID（可选）', full: true, ph: '留空自动新建并记住' },
            { k: 'file', label: '备份文件名', full: true, ph: '英文文件名' },
            { k: 'api', label: 'API 地址（可选）', full: true, ph: '留空用 github.com，企业版/自托管填地址', hint: 'GitHub Enterprise 或自托管实例填完整地址' },
            { k: 'enabled', label: '启用 GitHub 备份', type: 'checkbox', cbText: '启用此目标', def: true }
          ]
        }).then(function (v) {
          if (!v) return;
          b.gist = { enabled: !!v.enabled, token: v.token, gist: v.gist, file: v.file || 'workbench-backup.json', api: v.api || 'https://api.github.com' };
          Store.save(true); App.refresh(); U.toast('GitHub 配置已保存');
        });
      },
      bkTest: function (t) { window.Backup.test(t.dataset.t); },
      bkNow: function () {
        var b = window.Backup.cfg();
        if (!b.enabled) { U.toast('请先在上方开启自动备份并配置目标'); return; }
        U.toast('正在备份…');
        window.Backup.run({ silent: false });
      },
      export: function () {
        var payload = { app: '个人工作台', version: 1, exportedAt: new Date().toLocaleString('zh-CN'), data: Store.data };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '工作台备份-' + U.today() + '.json';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        U.toast('备份文件已导出');
      },
      import: function () { document.getElementById('fileIn').click(); },
      bmr: function () {
        UI.form({
          title: '基础代谢 BMR', desc: '留空或填 0 表示按「体重 × 22」自动估算',
          values: { v: num(D().body.bmr) }, fields: [{ k: 'v', label: '每日基础代谢 (kcal)', type: 'number', min: 0, full: true }]
        }).then(function (r) { if (!r) return; D().body.bmr = num(r.v); Store.save(); App.refresh(); });
      },
      wgoal: function () {
        UI.form({
          title: '每日饮水目标', values: { g: num(D().body.waterGoal) || 2000 },
          fields: [{ k: 'g', label: '目标 (ml)', type: 'number', min: 200, req: true, full: true }]
        }).then(function (r) { if (!r) return; D().body.waterGoal = num(r.g); Store.save(); App.refresh(); });
      },
      privacy: function () { window.showPrivacy(true); },
      clear: function () {
        UI.confirm('确认清空全部数据？', '这会删除所有板块的记录，且无法恢复。建议先导出备份。', '我确定，清空', true).then(function (ok) {
          if (!ok) return;
          UI.confirm('最后确认', '真的要清空吗？', '清空', true).then(function (ok2) {
            if (!ok2) return;
            Store.reset(); Store.load(); Store.data.settings.privacy = true; Store.save(true);
            App.refresh(); U.toast('已清空');
          });
        });
      }
    }
  };
  App.register(settings);

})();
