/* ========== 7. 💰 财务记账 ========== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, money = U.money, D = function () { return Store.data; };
  var F = function () { return Store.data.finance; };
  var TF = window.TF;

  var ACC_TYPE = ['现金', '储蓄卡', '信用卡', '微信', '支付宝', '理财账户', '其他'];

  function accById(id) { return F().accounts.filter(function (a) { return a.id === id; })[0]; }
  function accName(id) { var a = accById(id); return a ? a.name : '—'; }

  function balance(accId) {
    var a = accById(accId);
    if (!a) return 0;
    var b = num(a.init);
    F().flows.forEach(function (f) {
      if (f.type === 'in' && f.acc === accId) b += num(f.amount);
      if (f.type === 'out' && f.acc === accId) b -= num(f.amount);
      if (f.type === 'transfer') {
        if (f.acc === accId) b -= num(f.amount);
        if (f.acc2 === accId) b += num(f.amount);
      }
    });
    return b;
  }
  // 账户经流水计算的净变动（不含 init）。用于「直接编辑当前余额」时反算 init，
  // 从而在不改动任何收支/转账流水的前提下，把账户余额调到目标值。
  function netFlow(accId) {
    var b = 0;
    F().flows.forEach(function (f) {
      if (f.type === 'in' && f.acc === accId) b += num(f.amount);
      if (f.type === 'out' && f.acc === accId) b -= num(f.amount);
      if (f.type === 'transfer') {
        if (f.acc === accId) b -= num(f.amount);
        if (f.acc2 === accId) b += num(f.amount);
      }
    });
    return b;
  }
  // 把账户当前余额设定为目标值：只调整 init（基准），流水保持不变。
  function setBalance(acc, target) {
    acc.init = Math.round((num(target) - netFlow(acc.id)) * 100) / 100;
  }
  function totalAsset() {
    return F().accounts.reduce(function (s, a) { return s + balance(a.id); }, 0);
  }
  function sumBy(arr, key) { return arr.reduce(function (s, x) { return s + num(x[key]); }, 0); }

  function renderFlowItem(f) {
    var sign = f.type === 'in' ? '+' : f.type === 'out' ? '-' : '';
    var color = f.type === 'in' ? '#6E8A28' : f.type === 'out' ? '#B4553F' : '#6E8A9B';
    var title = f.type === 'transfer' ? accName(f.acc) + ' → ' + accName(f.acc2) : (f.cat || '未分类');
    var main = '<div class="row between" style="gap:10px;align-items:center"><span class="item-title">' + esc(title) + '</span>' +
      '<div class="row" style="gap:12px;align-items:center;flex-shrink:0;margin-left:8px">' +
      '<span style="font-weight:700;color:' + color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + U.moneyFull(f.amount) + '">' + sign + money(f.amount) + '</span>' +
      UI.ops(f.id, 'fedit', 'fdel') + '</div></div>';
    var meta = '<div class="item-meta"><span>' + U.fmtDate(f.date, true) + (f.time ? ' · ' + esc(f.time) : '') + '</span>' +
      (f.type !== 'transfer' ? '<span class="badge grey">' + esc(accName(f.acc)) + '</span>' : '<span class="badge info">转账</span>') +
      (f.sub ? '<span class="badge grey">' + esc(f.sub) + '</span>' : '') +
      (f.note ? '<span class="item-chev tap" title="展开备注">▸</span>' : '') + '</div>';
    var note = f.note ? '<div class="item-detail"><div class="item-note-line">' + esc(f.note) + '</div></div>' : '';
    var cls = 'item' + (f.note ? ' clickable' : '');
    var tog = f.note ? ' data-toggle' : '';
    return '<div class="' + cls + '"' + tog + ' data-id="' + esc(f.id) + '">' +
      '<div class="item-main">' + main + meta + '</div>' + note + '</div>';
  }

  // 分类名（兼容扁平字符串与 {name,subs} 两种结构）
  function catName(c) { return typeof c === 'string' ? c : (c && c.name) || ''; }
  function catList(arr) { return (arr || []).map(catName); }
  function catSubs(arr, name) {
    for (var i = 0; i < (arr || []).length; i++) {
      if (catName(arr[i]) === name) return (arr[i].subs || []).slice();
    }
    return [];
  }
  function finCategories() {
    var s = {};
    catList(F().catExpense).forEach(function (c) { s[c] = 1; });
    catList(F().catIncome).forEach(function (c) { s[c] = 1; });
    F().flows.forEach(function (f) { if (f.cat) s[f.cat] = 1; });
    return Object.keys(s).sort();
  }
  // 'YYYY-MM' ~ 'YYYY-MM' 闭区间，逐月展开
  function monthList(from, to) {
    var out = [], p = from.split('-'), y = +p[0], m = +p[1];
    var q = to.split('-'), ty = +q[0], tm = +q[1];
    while (y < ty || (y === ty && m <= tm)) {
      out.push(y + '-' + (m < 10 ? '0' + m : '' + m));
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  // 分类占比行（可点击展开明细）
  function propList(map, total, type) {
    var rows = Object.keys(map).map(function (k) { return { t: k, v: map[k] }; }).sort(function (a, b) { return b.v - a.v; });
    if (!rows.length) return UI.empty('暂无数据', '📊');
    return rows.map(function (r) {
      var p = total ? r.v / total * 100 : 0;
      return '<div class="cat-prop-row tap" data-act="finCatDetail" data-cat="' + esc(r.t) + '" data-io="' + type + '">' +
        '<div class="row between"><span>' + esc(r.t) + '</span>' +
        '<span class="small muted" title="' + U.moneyFull(r.v) + '">' + money(r.v) + ' · ' + p.toFixed(1) + '%</span></div>' +
        UI.bar(p, true) + '</div>';
    }).join('');
  }
  // 明细弹窗里的单条渲染（不带编辑/删除，避免弹窗内死按钮）
  function renderDetailItem(f) {
    var sign = f.type === 'in' ? '+' : f.type === 'out' ? '-' : '';
    var color = f.type === 'in' ? '#6E8A28' : f.type === 'out' ? '#B4553F' : '#6E8A9B';
    return '<div class="item"><div class="item-main">' +
      '<div class="row between" style="gap:10px"><span class="item-title">' + esc(f.note || accName(f.acc) || '未分类') + '</span>' +
      '<span style="font-weight:700;color:' + color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;margin-left:8px;" title="' + U.moneyFull(f.amount) + '">' + sign + money(f.amount) + '</span></div>' +
      '<div class="item-meta"><span>' + U.fmtDate(f.date, true) + (f.time ? ' · ' + esc(f.time) : '') + '</span>' +
      '<span class="badge grey">' + esc(accName(f.acc)) + '</span>' +
      (f.cat ? '<span class="badge grey">' + esc(f.cat) + '</span>' : '') +
      (f.sub ? '<span class="badge grey">' + esc(f.sub) + '</span>' : '') + '</div>' +
      '</div></div>';
  }
  // 图表点击放大：把图表 html 存进 store，点击时以更大尺寸灯箱展示
  var FIN_CHARTS = {};
  function wrapChart(html, id) {
    FIN_CHARTS[id] = html;
    return '<div class="chart-zoom tap" data-act="chartZoom" data-cid="' + id + '">' + html +
      '<span class="chart-zoom-hint">🔍 点击放大</span></div>';
  }
  window.FinChart = {
    store: FIN_CHARTS,
    wrap: wrapChart,
    zoom: function (html) {
      var root = document.getElementById('modalRoot');
      var el = document.createElement('div');
      el.className = 'modal-mask chart-lightbox';
      el.innerHTML = '<div class="chart-lightbox-inner">' +
        '<button class="di-lightbox-x tap" data-cx>✕</button>' +
        '<div class="chart-lightbox-scroll"><div class="chart-lightbox-card">' + html + '</div></div></div>';
      root.appendChild(el);
      UI.lock();
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('[data-cx]')) { el.remove(); UI.unlock(); }
      });
    }
  };

  var finance = {
    id: 'finance', icon: '💰', name: '财务记账',

    render: function () {
      var t = App.tab('finance', 'main', 'flow');
      var asset = totalAsset();
      var m = U.ym();
      var mf = F().flows.filter(function (f) { return U.ym(f.date) === m; });
      var inc = sumBy(mf.filter(function (f) { return f.type === 'in'; }), 'amount');
      var exp = sumBy(mf.filter(function (f) { return f.type === 'out'; }), 'amount');

      return UI.head('💰 财务记账', '账户 · 收支 · 存钱目标 · 统计分析') +
        UI.stats([
          ['总资产', U.moneyFull(asset), true, U.moneyFull(asset)],
          ['本月收入', U.moneyFull(inc), false, U.moneyFull(inc)],
          ['本月支出', U.moneyFull(exp), false, U.moneyFull(exp)],
          ['本月结余', U.moneyFull(inc - exp), false, U.moneyFull(inc - exp)]
        ]) +
        UI.tabs([
          { k: 'flow', t: '收支记账', i: '🧾' }, { k: 'acc', t: '账户管理', i: '🏦' },
          { k: 'goal', t: '存钱目标', i: '🎯' }, { k: 'stat', t: '统计分析', i: '📊' }
        ], t, 'tab') +
        (t === 'acc' ? this.accounts() : t === 'goal' ? this.goals() : t === 'stat' ? this.stat() : this.flows());
    },

    /* ---------- 账户 ---------- */
    accounts: function () {
      var arr = F().accounts;
      return UI.card({
        title: '🏦 我的账户', sub: '总资产 ' + money(totalAsset()) + (Math.abs(totalAsset()) >= 1e4 ? '（' + U.moneyFull(totalAsset()) + '）' : ''),
        right: '<button class="btn sm ghost tap" data-act="tnew">↔ 转账</button><button class="btn primary sm tap" data-act="anew">+ 新建账户</button>',
        body: '<div class="list">' + (arr.length ? arr.map(function (a) {
          var b = balance(a.id);
          var isDebt = a.type === '信用卡' && b < 0;
          return '<div class="item"><div class="item-main">' +
            '<div class="row between"><span class="item-title">' + esc(a.name) + '</span>' +
            '<span class="big-num" style="font-size:19px;color:' + (b < 0 ? '#B4553F' : '#331915') + '" title="' + U.moneyFull(b) + '">' + money(b) + '</span></div>' +
            '<div class="item-meta"><span class="badge grey">' + esc(a.type || '其他') + '</span>' +
            (isDebt ? '<span class="badge danger">欠 ' + money(-b) + '</span>' : '') +
            (a.note ? '<span>' + esc(a.note) + '</span>' : '') + '</div>' +
            '</div>' + UI.ops(a.id, 'aedit', 'adel') + '</div>';
        }).join('') : UI.empty('先建一个账户，比如「微信零钱」', '🏦')) + '</div>'
      });
    },

    /* ---------- 流水 ---------- */
    flows: function () {
      var type = App.tab('finance', 'ftype', '');
      var acc = App.tab('finance', 'facc', '');
      var arr = F().flows.filter(function (f) {
        if (!TF.inRange('finance_flow', f.date)) return false;
        if (type && f.type !== type) return false;
        if (acc && f.acc !== acc && f.acc2 !== acc) return false;
        return true;
      }).sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date)) ||
          String(b.time || '00:00').localeCompare(String(a.time || '00:00')) ||
          String(b.id).localeCompare(String(a.id));
      });

      var inc = sumBy(arr.filter(function (f) { return f.type === 'in'; }), 'amount');
      var exp = sumBy(arr.filter(function (f) { return f.type === 'out'; }), 'amount');

      return UI.card({
        title: '🧾 收支流水', sub: '收 ' + money(inc) + ' · 支 ' + money(exp),
        right: TF.btn('finance_flow', { sm: true }) + '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button><button class="btn primary sm tap" data-act="fnew">+ 记一笔</button>',
        body: '<div class="row" style="flex-direction:column;align-items:flex-start;gap:12px">' +
          UI.pills([{ k: '', t: '全部类型' }, { k: 'in', t: '收入' }, { k: 'out', t: '支出' }, { k: 'transfer', t: '转账' }], type, 'ftype') +
          (F().accounts.length ? UI.pills([{ k: '', t: '全部账户' }].concat(F().accounts.map(function (a) { return { k: a.id, t: a.name }; })), acc, 'facc') : '') +
          '</div><div style="height:18px"></div>' +
          ListPager.out({ ns: 'finance:flow', items: arr, defSize: 5, empty: '这个时间段还没有流水记录', emptyIcon: '🧾', emptyDesc: '点右上角「+ 记一笔」记录你的第一笔收支', render: renderFlowItem })
      });
    },

    /* ---------- 存钱目标 ---------- */
    goals: function () {
      var arr = F().goals;
      return UI.card({
        title: '🎯 存钱目标', right: '<button class="btn primary sm tap" data-act="gnew">+ 新建目标</button>',
        body: '<div class="list">' + (arr.length ? arr.map(function (g) {
          var saved = (g.logs || []).reduce(function (s, l) { return s + num(l.amount); }, 0);
          var pct = num(g.target) ? saved / num(g.target) * 100 : 0;
          var left = num(g.target) - saved;
          var days = g.due ? U.dayDiff(U.today(), g.due) : null;
          return '<div class="item' + (pct >= 100 ? ' hl' : '') + '"><div class="item-main">' +
            '<div class="row between"><span class="item-title">' + esc(g.name) + (pct >= 100 ? ' 🎉' : '') + '</span>' +
            '<span class="badge' + (pct >= 100 ? '' : ' grey') + '">' + pct.toFixed(1) + '%</span></div>' +
            '<div style="margin:8px 0">' + UI.bar(pct) + '</div>' +
            '<div class="item-meta">' +
            '<span title="已存 ' + U.moneyFull(saved) + ' / 目标 ' + U.moneyFull(g.target) + '">已存 <b>' + money(saved) + '</b> / ' + money(g.target) + '</span>' +
            (left > 0 ? '<span class="badge grey" title="还差 ' + U.moneyFull(left) + '">还差 ' + money(left) + '</span>' : '<span class="badge">已达成</span>') +
            (days !== null ? '<span class="badge ' + (days < 0 ? 'danger' : days < 30 ? 'warn' : 'grey') + '">' + (days < 0 ? '已过期限' : '剩 ' + days + ' 天') + '</span>' : '') +
            ((g.logs || []).length ? '<span class="badge grey">' + g.logs.length + ' 次存入</span>' : '') +
            '</div>' +
            ((g.logs || []).length ? '<div class="subs">' + g.logs.slice().reverse().slice(0, 4).map(function (l) {
              return '<div class="sub"><span class="grow">' + U.fmtDate(l.date) + ' 存入 ' + money(l.amount) + (l.acc ? ' · ' + esc(accName(l.acc)) : '') + (l.note ? ' · ' + esc(l.note) : '') + '</span>' +
                '<button class="link-btn del tap" data-act="ldel" data-id="' + g.id + '|' + l.id + '">×</button></div>';
            }).join('') + '</div>' : '') +
            '<div class="row" style="margin-top:8px;gap:4px"><button class="link-btn tap" data-act="gsave" data-id="' + g.id + '">+ 记一笔存入</button></div>' +
            '</div>' + UI.ops(g.id, 'gedit', 'gdel') + '</div>';
        }).join('') : UI.empty('设一个存钱目标，比如「旅行基金 8000」', '🎯')) + '</div>'
      });
    },

    /* ---------- 统计 ---------- */
    stat: function () {
      var flows = F().flows;
      var now = new Date();

      // 柱状图：可选月份时间段（近3/6/12月、本年）
      var barMon = App.tab('finance', 'barmon', '6');
      var months = [];
      if (barMon === 'year') {
        for (var mm = 1; mm <= now.getMonth() + 1; mm++) months.push(now.getFullYear() + '-' + U.pad(mm));
      } else {
        var n = +barMon || 6;
        for (var i = n - 1; i >= 0; i--) {
          var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(d.getFullYear() + '-' + U.pad(d.getMonth() + 1));
        }
      }
      var barRows = months.map(function (m) {
        var mf = flows.filter(function (f) { return U.ym(f.date) === m; });
        return {
          t: (+m.slice(5)) + '月',
          a: sumBy(mf.filter(function (f) { return f.type === 'in'; }), 'amount'),
          b: sumBy(mf.filter(function (f) { return f.type === 'out'; }), 'amount')
        };
      });

      // 分类占比：按 finance_stat 时间段筛选
      var statFlows = flows.filter(function (f) { return TF.inRange('finance_stat', f.date); });
      var expMap = {}, incMap = {};
      statFlows.forEach(function (f) {
        if (f.type === 'out') expMap[f.cat || '未分类'] = (expMap[f.cat || '未分类'] || 0) + num(f.amount);
        if (f.type === 'in') incMap[f.cat || '未分类'] = (incMap[f.cat || '未分类'] || 0) + num(f.amount);
      });
      var yInc = sumBy(statFlows.filter(function (f) { return f.type === 'in'; }), 'amount');
      var yExp = sumBy(statFlows.filter(function (f) { return f.type === 'out'; }), 'amount');

      // 资产净值：按 finance_net 时间段逐月末计算
      var netR = TF.get('finance_net');
      var fromM = netR.from ? netR.from.slice(0, 7) : (flows.length ? flows.map(function (f) { return f.date.slice(0, 7); }).sort()[0] : U.ym());
      var toM = netR.to ? netR.to.slice(0, 7) : U.ym();
      var netMonths = monthList(fromM, toM);
      var netInit = F().accounts.reduce(function (s, a) { return s + num(a.init); }, 0);
      var netPts = netMonths.map(function (m) {
        var y = +m.slice(0, 4), mo = +m.slice(5, 7);
        var end = m + '-' + U.pad(new Date(y, mo, 0).getDate());
        var v = netInit;
        flows.forEach(function (f) { if (String(f.date) > end) return; if (f.type === 'in') v += num(f.amount); if (f.type === 'out') v -= num(f.amount); });
        return { t: m, v: Math.round(v) };
      });

      return UI.card({
        title: '📊 收支柱状图',
        right: UI.pills([{ k: '3', t: '近3月' }, { k: '6', t: '近6月' }, { k: '12', t: '近12月' }, { k: 'year', t: '本年' }], barMon, 'barmon'),
        body: wrapChart(UI.bars2(barRows), 'finBar')
      }) +
        UI.card({
          title: '🥧 分类占比',
          right: TF.btn('finance_stat', { sm: true }),
          body: '<div class="row between" style="margin-bottom:6px"><strong class="small" title="支出 ' + U.moneyFull(yExp) + '">支出 ' + money(yExp) + '</strong><span class="small muted">点击分类看明细</span></div>' +
            propList(expMap, yExp, 'out') +
            '<div class="hr" style="margin:18px 0"></div>' +
            '<div class="row between" style="margin-bottom:6px"><strong class="small" title="收入 ' + U.moneyFull(yInc) + '">收入 ' + money(yInc) + '</strong></div>' +
            propList(incMap, yInc, 'in')
        }) +
        UI.card({
          title: '📈 资产净值变化',
          right: TF.btn('finance_net', { sm: true }),
          body: wrapChart(UI.line(netPts, { dec: 0 }), 'finNet')
        }) +
        UI.card({
          title: '⚙️ 收支分类管理',
          right: '<button class="btn ghost sm tap" data-act="finCatManage">🗂 分类管理</button>',
          body: '<div class="small muted">支出 / 收入分类可在「分类管理」里新增或删减，记账时选择使用。</div>'
        });
    },

    acts: {
      tab: function (t) { App.setTab('finance', 'main', t.dataset.k); ListPager.resetPg('finance:flow'); App.refresh(); },
      ftype: function (t) { App.setTab('finance', 'ftype', t.dataset.k); ListPager.resetPg('finance:flow'); App.refresh(); },
      facc: function (t) { App.setTab('finance', 'facc', t.dataset.k); ListPager.resetPg('finance:flow'); App.refresh(); },
      barmon: function (t) { App.setTab('finance', 'barmon', t.dataset.k); App.refresh(); },

      anew: function () {
        UI.form({
          title: '新建账户', fields: [
            { k: 'name', label: '账户名称', req: true, full: true, ph: '如：招行储蓄卡 / 微信零钱' },
            { k: 'type', label: '账户类型', type: 'select', options: ACC_TYPE, def: '储蓄卡' },
            { k: 'balance', label: '当前余额', type: 'number', def: 0, money: true, hint: '信用卡欠钱可填负数，如 -2000' },
            { k: 'note', label: '备注', full: true }
          ]
        }).then(function (v) {
          if (!v) return;
          v.id = U.uid();
          v.init = Math.round(num(v.balance) * 100) / 100; // 新建时无流水，当前余额即基准
          delete v.balance;
          F().accounts.push(v); Store.save(); App.refresh(); U.toast('账户已创建');
        });
      },
      aedit: function (t) {
        var x = accById(t.dataset.id);
        UI.form({
          title: '编辑账户 · ' + x.name,
          values: { name: x.name, type: x.type, balance: Math.round(balance(x.id) * 100) / 100, note: x.note },
          fields: [
            { k: 'name', label: '账户名称', req: true, full: true },
            { k: 'type', label: '账户类型', type: 'select', options: ACC_TYPE },
            { k: 'balance', label: '当前余额', type: 'number', money: true, hint: '直接调整余额，不影响已有记账；信用卡欠钱填负数' },
            { k: 'note', label: '备注', full: true }
          ]
        }).then(function (v) {
          if (!v) return;
          x.name = v.name; x.type = v.type; x.note = v.note;
          // 反算 init：当前余额 = 输入值，且任何收支/转账流水都不被改动
          setBalance(x, v.balance);
          Store.save(); App.refresh(); U.toast('余额已更新');
        });
      },
      adel: function (t) {
        var x = accById(t.dataset.id);
        UI.del(x.name, function () {
          F().accounts = F().accounts.filter(function (a) { return a.id !== x.id; });
          Store.save(); App.refresh();
        });
      },
      tnew: function () {
        if (F().accounts.length < 2) { U.toast('至少需要两个账户才能转账'); return; }
        var opts = F().accounts.map(function (a) { return { v: a.id, t: a.name }; });
        UI.form({
          title: '账户转账', values: { date: U.today(), time: U.nowTime() }, fields: [
            { k: 'acc', label: '转出账户', type: 'select', options: opts, req: true },
            { k: 'acc2', label: '转入账户', type: 'select', options: opts, req: true },
            { k: 'amount', label: '金额', type: 'number', min: 0, req: true, money: true },
            { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
            { k: 'time', label: '时间', type: 'time', req: true, def: U.nowTime() },
            { k: 'note', label: '备注', full: true }
          ]
        }).then(function (v) {
          if (!v) return;
          if (v.acc === v.acc2) { U.toast('转出与转入账户不能相同'); return; }
          v.id = U.uid(); v.type = 'transfer'; F().flows.push(v); Store.save(); App.refresh(); U.toast('已转账');
        });
      },

      fnew: function () {
        if (!F().accounts.length) {
          UI.confirm('还没有账户', '记账前先建一个账户（如「微信零钱」），方便统计资产。', '去新建').then(function (ok) {
            if (ok) finance.acts.anew();
          });
          return;
        }
        UI.form({ title: '记一笔', values: { date: U.today(), type: 'out' }, fields: flowFields('out') }).then(function (v) {
          if (!v) return;
          v.id = U.uid();
          if (v.newcat) { addCat(v.type, v.newcat); v.cat = v.newcat; delete v.newcat; }
          if (v.newsub && v.cat) { addSub(v.type, v.cat, v.newsub); v.sub = v.newsub; delete v.newsub; }
          F().flows.push(v); Store.save(); App.refresh(); U.toast('已记录');
        });
      },
      fedit: function (t) {
        var x = F().flows.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (x.type === 'transfer') {
          var opts = F().accounts.map(function (a) { return { v: a.id, t: a.name }; });
          UI.form({
            title: '编辑转账', values: x, fields: [
              { k: 'acc', label: '转出账户', type: 'select', options: opts, req: true },
              { k: 'acc2', label: '转入账户', type: 'select', options: opts, req: true },
              { k: 'amount', label: '金额', type: 'number', req: true },
              { k: 'date', label: '日期', type: 'date', req: true },
              { k: 'time', label: '时间', type: 'time', req: true, def: U.nowTime() },
              { k: 'note', label: '备注', full: true }
            ]
          }).then(function (v) {
            if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
          });
          return;
        }
        UI.form({ title: '编辑记录', values: x, fields: flowFields(x.type) }).then(function (v) {
          if (!v) return;
          if (v.newcat) { addCat(v.type, v.newcat); v.cat = v.newcat; }
          delete v.newcat;
          if (v.newsub && v.cat) { addSub(v.type, v.cat, v.newsub); v.sub = v.newsub; }
          delete v.newsub;
          Object.keys(v).forEach(function (k) { x[k] = v[k]; });
          Store.save(); App.refresh();
        });
      },
      fdel: function (t) {
        F().flows = F().flows.filter(function (a) { return a.id !== t.dataset.id; });
        Store.save(); App.refresh(); U.toast('已删除');
      },

      gnew: function () {
        UI.form({ title: '新建存钱目标', fields: goalFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.logs = []; F().goals.push(v); Store.save(); App.refresh();
        });
      },
      gedit: function (t) {
        var x = F().goals.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑目标', values: x, fields: goalFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      gdel: function (t) {
        var x = F().goals.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { F().goals = F().goals.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      },
      gsave: function (t) {
        var g = F().goals.filter(function (a) { return a.id === t.dataset.id; })[0];
        var saved = (g.logs || []).reduce(function (s, l) { return s + num(l.amount); }, 0);
        UI.form({
          title: '存入 ·' + g.name, desc: '已存 ' + money(saved) + ' / 目标 ' + money(g.target) + '（' + U.moneyFull(saved) + ' / ' + U.moneyFull(g.target) + '）',
          values: { date: U.today() }, fields: [
            { k: 'amount', label: '存入金额', type: 'number', min: 0, req: true, money: true },
            { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
            { k: 'acc', label: '关联账户', type: 'select', ph: '不关联', options: F().accounts.map(function (a) { return { v: a.id, t: a.name }; }) },
            { k: 'note', label: '备注', full: true }
          ]
        }).then(function (v) {
          if (!v) return;
          v.id = U.uid(); (g.logs = g.logs || []).push(v); Store.save(); App.refresh();
          var now = g.logs.reduce(function (s, l) { return s + num(l.amount); }, 0);
          U.toast(now >= num(g.target) ? '目标达成，太棒了 🎉' : '已存入，还差 ' + money(num(g.target) - now));
        });
      },
      ldel: function (t) {
        var p = t.dataset.id.split('|');
        var g = F().goals.filter(function (a) { return a.id === p[0]; })[0];
        g.logs = (g.logs || []).filter(function (l) { return l.id !== p[1]; });
        Store.save(); App.refresh();
      },

      finCatDetail: function (t) {
        var cat = t.dataset.cat, io = t.dataset.io;
        var arr = F().flows.filter(function (f) {
          if (f.type !== io) return false;
          if ((f.cat || '') !== cat) return false;
          if (!TF.inRange('finance_stat', f.date)) return false;
          return true;
        }).sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date)) ||
          String(b.time || '00:00').localeCompare(String(a.time || '00:00')) ||
          String(b.id).localeCompare(String(a.id));
      });
        var el = UI.sheet('「' + cat + '」' + (io === 'out' ? '支出' : '收入') + '明细 · ' + arr.length + ' 笔',
          '<div id="finCatDetailList"></div>', '<button class="btn ghost tap" data-x>关闭</button>');
        var listEl = el.querySelector('#finCatDetailList');
        function draw() {
          listEl.innerHTML = ListPager.out({ ns: 'finance:catdetail', items: arr, defSize: 10, empty: '该时间段内没有「' + cat + '」记录', render: renderDetailItem });
        }
        draw();
        el.addEventListener('click', function (e) {
          var togg = e.target.closest('.item.clickable');
          if (togg && togg.hasAttribute('data-toggle') && !e.target.closest('[data-act]') && !e.target.closest('.item-ops')) {
            e.preventDefault(); togg.classList.toggle('open'); return;
          }
          var b = e.target.closest('[data-act]'); if (!b) return;
          if (b.dataset.act === 'listPg') { e.preventDefault(); ListPager.handle('listPg', b); }
        });
        el.addEventListener('change', function (e) {
          if (e.target.matches('[data-chg="listSize"]')) ListPager.handleSize(e.target);
        });
      },
      finCatManage: function () {
        function section(key, title) {
          var arr = F()[key];
          var blocks = (arr || []).map(function (c) {
            var name = catName(c);
            var subs = c.subs || [];
            var subPills = subs.length ? subs.map(function (s) {
              return '<span class="pill" style="display:inline-flex;align-items:center;gap:6px">' + esc(s) +
                '<button class="link-btn del tap" data-act="finSubDel" data-k="' + key + '" data-c="' + esc(name) + '" data-s="' + esc(s) + '">×</button></span>';
            }).join('') : '<span class="small muted">暂无二级分类</span>';
            return '<div class="cat-blk">' +
              '<div class="row between" style="margin-bottom:6px"><strong>' + esc(name) + '</strong>' +
              '<button class="link-btn del tap" data-act="finCatDel" data-k="' + key + '" data-c="' + esc(name) + '">删除</button></div>' +
              '<div class="pills" style="margin-bottom:6px">' + subPills + '</div>' +
              '<div class="row" style="gap:8px;margin-bottom:14px"><input class="input" placeholder="新增二级分类" style="flex:1;min-width:0">' +
              '<button class="btn primary sm tap" data-act="finSubAdd" data-k="' + key + '" data-c="' + esc(name) + '">+ 添加</button></div>' +
              '</div>';
          }).join('');
          return '<div class="small muted" style="margin:0 0 8px">' + title + '（一级分类）</div>' +
            (blocks || UI.empty('还没有分类')) +
            '<div class="field full" style="margin-top:4px"><div class="field-r"><input class="input" id="newcat-' + key + '" placeholder="新增' + title + '"></div></div>' +
            '<button class="btn primary sm tap" data-act="finCatAdd" data-k="' + key + '" style="margin-bottom:14px">+ 添加' + title + '</button>';
        }
        function renderAll() { return section('catExpense', '支出分类') + '<div style="height:6px"></div>' + section('catIncome', '收入分类'); }
        var el = UI.sheet('🗂 收支分类管理', renderAll(), '<button class="btn ghost tap" data-x>关闭</button>');
        var body = el.querySelector('.modal-body');
        el.addEventListener('click', function (e) {
          var b = e.target.closest('[data-act]'); if (!b) return;
          var a = b.dataset.act, key = b.dataset.k;
          if (a === 'finCatAdd') {
            var inp = el.querySelector('#newcat-' + key), v = (inp.value || '').trim();
            if (!v) return;
            if (!catList(F()[key]).some(function (x) { return x === v; })) { F()[key].push({ name: v, subs: [] }); Store.save(); }
            inp.value = ''; body.innerHTML = renderAll(); App.refresh();
          } else if (a === 'finCatDel') {
            F()[key] = F()[key].filter(function (x) { return catName(x) !== b.dataset.c; });
            Store.save(); body.innerHTML = renderAll(); App.refresh();
          } else if (a === 'finSubAdd') {
            var blk = b.closest('.cat-blk'), si = blk ? blk.querySelector('input') : null, sv = (si ? si.value : '').trim();
            if (!sv || !b.dataset.c) return;
            var cc = F()[key].filter(function (x) { return catName(x) === b.dataset.c; })[0];
            if (cc) { if (!cc.subs) cc.subs = []; if (cc.subs.indexOf(sv) < 0) cc.subs.push(sv); Store.save(); }
            if (si) si.value = ''; body.innerHTML = renderAll(); App.refresh();
          } else if (a === 'finSubDel') {
            var cd = F()[key].filter(function (x) { return catName(x) === b.dataset.c; })[0];
            if (cd && cd.subs) cd.subs = cd.subs.filter(function (s) { return s !== b.dataset.s; });
            Store.save(); body.innerHTML = renderAll(); App.refresh();
          }
        });
      },
      hist: function () {
        Hist.open({
          modId: 'finance',
          title: '💰 财务历史记录',
          searchPh: '🔍 搜索分类 / 账户 / 备注…',
          pager: true, defSize: 5,
          items: function () { return F().flows; },
          date: function (f) { return f.date; },
          match: function (f, q) {
            var hay = (f.type === 'transfer' ? (accName(f.acc) + ' ' + accName(f.acc2)) : (f.cat || '')) + ' ' + accName(f.acc) + ' ' + (f.note || '');
            return hay.toLowerCase().indexOf(q) >= 0;
          },
          sort: function (a, b) {
            return String(b.date).localeCompare(String(a.date)) ||
              String(b.time || '00:00').localeCompare(String(a.time || '00:00')) ||
              String(b.id).localeCompare(String(a.id));
          },
          extraBar: function (cur) {
            var io = '<div class="row" style="gap:8px;margin-bottom:4px">' +
              '<button class="btn sm ghost tap" data-act="finImport">📥 导入 xlsx</button>' +
              '<button class="btn sm ghost tap" data-act="finExport">📤 导出 xlsx</button>' +
              '<input type="file" id="finXlsx" accept=".xlsx,.xls" style="display:none">' +
              '</div>';
            var sel = (cur || '').split(',').filter(Boolean);
            var label = sel.length ? ('🏷 已选 ' + sel.length + ' 项 ▾') : '🏷 全部分类 ▾';
            var pill = '<button class="btn sm ghost tap" data-act="finCatOpen">' + U.esc(label) + '</button>';
            return io + '<div class="row" style="margin-bottom:6px">' + pill + '</div>';
          },
          extraMatch: function (f, val) {
            if (!val) return true;
            if (f.type === 'transfer') return false;
            var set = val.split(',');
            return set.indexOf(f.cat) >= 0;
          },
          summary: function (arr) {
            var inc = arr.filter(function (f) { return f.type === 'in'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
            var exp = arr.filter(function (f) { return f.type === 'out'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
            var tr = arr.filter(function (f) { return f.type === 'transfer'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
            return UI.stats([
              ['收入', money(inc), true, U.moneyFull(inc)],
              ['支出', money(exp), false, U.moneyFull(exp)],
              ['转账', money(tr), false, U.moneyFull(tr)]
            ]);
          },
          render: function (f) {
            var sign = f.type === 'in' ? '+' : f.type === 'out' ? '-' : '';
            var color = f.type === 'in' ? '#6E8A28' : f.type === 'out' ? '#B4553F' : '#6E8A9B';
            var hasNote = !!f.note;
            var meta = '<div class="item-meta"><span>' + U.fmtDate(f.date, true) + (f.time ? ' · ' + esc(f.time) : '') + '</span>' +
              (f.type !== 'transfer' ? '<span class="badge grey">' + esc(accName(f.acc)) + '</span>' : '<span class="badge info">转账</span>') +
              (f.sub ? '<span class="badge grey">' + esc(f.sub) + '</span>' : '') +
              (hasNote ? '<span class="item-chev tap" title="展开备注">▸</span>' : '') + '</div>';
            var note = hasNote ? '<div class="item-detail"><div class="item-note-line">' + esc(f.note) + '</div></div>' : '';
            var cls = 'item' + (hasNote ? ' clickable' : '');
            var tog = hasNote ? ' data-toggle' : '';
            return '<div class="' + cls + '"' + tog + ' data-id="' + esc(f.id) + '"><div class="item-main">' +
              '<div class="row between" style="gap:10px"><span class="item-title">' + esc(f.type === 'transfer' ? accName(f.acc) + ' → ' + accName(f.acc2) : (f.cat || '未分类')) + '</span>' +
              '<span style="font-weight:700;color:' + color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;margin-left:8px;" title="' + U.moneyFull(f.amount) + '">' + sign + money(f.amount) + '</span></div>' +
              meta + '</div>' + note +
              UI.ops(f.id, null, 'hdel') + '</div>';
          },
          acts: {
            hdel: function (t, e, redraw) {
              var f = F().flows.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!f) return;
              UI.del(esc(f.cat || '未分类'), function () {
                F().flows = F().flows.filter(function (a) { return a.id !== f.id; });
                Store.save();
                if (redraw) redraw();
              });
            },
            finImport: function () {
              var inp = document.getElementById('finXlsx');
              if (!inp) { U.toast('导入控件未就绪，请重新打开历史记录'); return; }
              inp.value = '';
              inp.onchange = function () {
                var file = inp.files && inp.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (ev) {
                  UI.lock();
                  try {
                    var wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                    var r = importKaPi(wb);
                    Store.save();
                    App.refresh();
                    U.toast('导入完成 ✅ 收支 ' + r.flow + ' 笔 · 转账 ' + r.trans + ' 笔 · 余额调整 ' + r.adj + ' 笔 · 新建账户 ' + r.acc + ' 个', 3600);
                  } catch (err) {
                    U.toast('导入失败：' + (err && err.message ? err.message : err));
                  } finally {
                    UI.unlock();
                  }
                };
                reader.readAsArrayBuffer(file);
              };
              inp.click();
            },
            finExport: function () {
              try {
                exportKaPi();
              } catch (err) {
                U.toast('导出失败：' + (err && err.message ? err.message : err));
              }
            },
            finCatOpen: function () {
              var modId = 'finance';
              var cats = finCategories();
              var sel = (window.Hist.getFilter(modId) || '').split(',').filter(Boolean);
              var render = function () {
                return '<div class="small muted" style="margin-bottom:10px">点击可多选分类，查看所选分类的收支</div>' +
                  '<div class="pills">' + cats.map(function (c) {
                    var on = sel.indexOf(c) >= 0;
                    return '<button class="pill tap' + (on ? ' on' : '') + '" data-cat="' + U.esc(c) + '">' + (on ? '✓ ' : '') + U.esc(c) + '</button>';
                  }).join('') + '</div>' +
                  '<div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost sm tap" data-cat-act="finCatAll">全选</button><button class="btn ghost sm tap" data-cat-act="finCatNone">清空</button></div>';
              };
              var el = UI.sheet('选择分类（可多选）', '<div id="finCatPickBody">' + render() + '</div>', '<button class="btn primary tap" data-ok style="width:100%">确定</button>');
              var body = el.querySelector('#finCatPickBody');
              body.addEventListener('click', function (ev) {
                var b = ev.target.closest('[data-cat]'); if (!b) return;
                var c = b.dataset.cat, i = sel.indexOf(c);
                if (i >= 0) sel.splice(i, 1); else sel.push(c);
                body.innerHTML = render();
              });
              el.querySelector('[data-cat-act="finCatAll"]').addEventListener('click', function () { sel = cats.slice(); body.innerHTML = render(); });
              el.querySelector('[data-cat-act="finCatNone"]').addEventListener('click', function () { sel = []; body.innerHTML = render(); });
              el.querySelector('[data-ok]').addEventListener('click', function () {
                window.Hist.setFilter(modId, sel.join(','));
                el.remove(); UI.unlock();
              });
            }
          }
        });
      }
    },

    mount: function () {}
  };

  /* ---------- 导入导出（兼容「咔皮记账」xlsx） ---------- */
  function guessAccType(name) {
    var n = String(name || '');
    if (n.indexOf('信用') >= 0) return '信用卡';
    if (n.indexOf('微信') >= 0) return '微信';
    if (n.indexOf('支付宝') >= 0) return '支付宝';
    if (n.indexOf('现金') >= 0) return '现金';
    if (n.indexOf('理财') >= 0) return '理财账户';
    if (n.indexOf('储蓄') >= 0 || n.indexOf('银行') >= 0 || n.indexOf('卡') >= 0) return '储蓄卡';
    return '其他';
  }
  function normDate(d) {
    if (d instanceof Date) {
      var y = d.getFullYear(), m = U.pad(d.getMonth() + 1), day = U.pad(d.getDate());
      return y + '-' + m + '-' + day;
    }
    return String(d || '').slice(0, 10);
  }
  function buildAccMap() {
    var map = {};
    function get(name) {
      if (name == null || name === '') return null;
      name = String(name);
      if (map[name] != null) return map[name];
      var ex = F().accounts.filter(function (a) { return a.name === name; })[0];
      if (ex) { map[name] = ex.id; return ex.id; }
      var id = U.uid();
      F().accounts.push({ id: id, name: name, type: guessAccType(name), init: 0 });
      map[name] = id; stat.acc++;
      return id;
    }
    var stat = { flow: 0, trans: 0, adj: 0, acc: 0 };
    return { get: get, stat: stat };
  }
  function importKaPi(wb) {
    var ctx = buildAccMap();
    var get = ctx.get, stat = ctx.stat;
    var names = wb.SheetNames || [];
    var sheet = function (n) { return names.indexOf(n) >= 0 ? XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' }) : []; };

    // 先预建账户，避免流水引用到 null
    var s1 = sheet('收支账单'), s2 = sheet('内部转账');
    s1.forEach(function (r) { get(r['账户']); });
    s2.forEach(function (r) { get(r['转入账户']); get(r['转出账户']); });

    s1.forEach(function (r) {
      var type = r['类型'] === '收入' ? 'in' : 'out';
      var cat = r['一级分类'];
      var sub = r['二级分类'];
      if (cat) addCat(type, cat);
      if (cat && sub) addSub(type, cat, sub);
      F().flows.push({
        id: U.uid(), type: type, amount: Math.abs(num(r['金额'])),
        acc: get(r['账户']), date: normDate(r['日期']),
        cat: cat || '', sub: sub || '', note: r['备注'] || ''
      });
      stat.flow++;
    });

    s2.forEach(function (r) {
      var amt = num(r['金额']);
      if (r['类型'] === '账户互转') {
        F().flows.push({
          id: U.uid(), type: 'transfer', amount: Math.abs(amt),
          acc: get(r['转出账户']), acc2: get(r['转入账户']),
          date: normDate(r['日期']), note: r['备注'] || ''
        });
        stat.trans++;
      } else { /* 余额调整：转为收支流水，保留金额符号，不丢数据 */
        var positive = amt >= 0;
        F().flows.push({
          id: U.uid(), type: positive ? 'in' : 'out', amount: Math.abs(amt),
          acc: get(r['转入账户'] || r['转出账户']),
          date: normDate(r['日期']), cat: '余额调整', note: (r['备注'] || '余额调整')
        });
        stat.adj++;
      }
    });
    return stat;
  }
  function exportKaPi() {
    if (typeof XLSX === 'undefined') { U.toast('表格库未加载'); return; }
    var rows1 = F().flows.filter(function (f) { return f.type === 'in' || f.type === 'out'; }).map(function (f) {
      return {
        '日期': f.date, '时间': (f.time || '00:00:00') + (f.time && f.time.length === 5 ? ':00' : ''),
        '类型': f.type === 'in' ? '收入' : '支出',
        '金额': Math.abs(num(f.amount)),
        '一级分类': f.cat || '', '二级分类': f.sub || '', '标签': '',
        '账户': accName(f.acc),
        '计入收支': '是', '计入预算': '是', '所属账本': '总账本',
        '备注': f.note || ''
      };
    });
    var rows2 = [];
    F().flows.filter(function (f) { return f.type === 'transfer'; }).forEach(function (f) {
      var tm = f.time || '00:00:00';
      if (f.time && f.time.length === 5) tm += ':00';
      rows2.push({ '日期': f.date, '时间': tm, '类型': '账户互转', '金额': Math.abs(num(f.amount)), '转入账户': accName(f.acc2), '转出账户': accName(f.acc), '备注': f.note || '' });
    });
    F().flows.filter(function (f) { return f.cat === '余额调整'; }).forEach(function (f) {
      var tm = f.time || '00:00:00';
      if (f.time && f.time.length === 5) tm += ':00';
      rows2.push({ '日期': f.date, '时间': tm, '类型': '余额调整', '金额': (f.type === 'in' ? '' : '-') + Math.abs(num(f.amount)), '转入账户': f.type === 'in' ? accName(f.acc) : '', '转出账户': f.type === 'out' ? accName(f.acc) : '', '备注': f.note || '' });
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows1), '收支账单');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows2), '内部转账');
    var buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
    var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '工作台记账_' + U.ym() + '_' + Date.now() + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function addCat(type, c) {
    var k = type === 'out' ? 'catExpense' : 'catIncome';
    if (c && !catList(F()[k]).some(function (x) { return x === c; })) F()[k].push({ name: c, subs: [] });
  }
  function addSub(type, cat, sub) {
    var k = type === 'out' ? 'catExpense' : 'catIncome';
    var c = F()[k].filter(function (x) { return catName(x) === cat; })[0];
    if (!c) return;
    if (!c.subs) c.subs = [];
    if (c.subs.indexOf(sub) < 0) c.subs.push(sub);
  }

  function flowFields(type) {
    return [
      { k: 'type', label: '类型', type: 'select', options: [{ v: 'out', t: '支出' }, { v: 'in', t: '收入' }], def: type || 'out', hint: '选择类型后分类会自动切换' },
      { k: 'amount', label: '金额', type: 'number', min: 0, req: true, money: true },
      { k: 'acc', label: '账户', type: 'select', req: true, options: F().accounts.map(function (a) { return { v: a.id, t: a.name }; }) },
      { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
      { k: 'time', label: '时间', type: 'time', req: true, def: U.nowTime() },
      { k: 'cat', label: '一级分类', type: 'select', ph: '请选择', depends: ['type'], options: function (all) { return catList(all.type === 'in' ? F().catIncome : F().catExpense); } },
      { k: 'newcat', label: '或新增一级分类', ph: '填了会自动加入分类库' },
      { k: 'sub', label: '二级分类', type: 'select', ph: '可选', depends: ['cat'], options: function (all) { return catSubs(all.type === 'in' ? F().catIncome : F().catExpense, all.cat); } },
      { k: 'newsub', label: '或新增二级分类', ph: '填了会归入上方一级分类' },
      { k: 'note', label: '备注', type: 'textarea', rows: 3 }
    ];
  }
  function goalFields() {
    return [
      { k: 'name', label: '目标名称', req: true, full: true, ph: '如：旅行基金' },
      { k: 'target', label: '目标金额', type: 'number', min: 0, req: true, money: true },
      { k: 'due', label: '计划完成日期', type: 'date' },
      { k: 'note', label: '备注', full: true }
    ];
  }

  TF.def('finance_flow', 'month');
  TF.hook('finance_flow', function () { ListPager.resetPg('finance:flow'); App.refresh(); });

  // 统计分析：分类占比时间段、资产净值时间段
  TF.def('finance_stat', 'year');
  TF.hook('finance_stat', function () { App.refresh(); });
  TF.def('finance_net', 'year');
  TF.hook('finance_net', function () { App.refresh(); });

  App.register(finance);
})();
