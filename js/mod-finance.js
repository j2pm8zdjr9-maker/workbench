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
    return '<div class="item"><div class="item-main">' +
      '<div class="row between" style="gap:10px">' +
      '<span class="item-title">' + esc(f.type === 'transfer' ? accName(f.acc) + ' → ' + accName(f.acc2) : (f.cat || '未分类')) + '</span>' +
      '<span style="font-weight:700;color:' + color + '">' + sign + money(f.amount).replace('¥', '¥') + '</span></div>' +
      '<div class="item-meta"><span>' + U.fmtDate(f.date, true) + '</span>' +
      (f.type !== 'transfer' ? '<span class="badge grey">' + esc(accName(f.acc)) + '</span>' : '<span class="badge info">转账</span>') +
      (f.note ? '<span>' + esc(f.note) + '</span>' : '') + '</div>' +
      '</div>' + UI.ops(f.id, 'fedit', 'fdel') + '</div>';
  }

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
          ['总资产', money(asset), true],
          ['本月收入', money(inc)],
          ['本月支出', money(exp)],
          ['本月结余', money(inc - exp)]
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
        title: '🏦 我的账户', sub: '总资产 ' + money(totalAsset()),
        right: '<button class="btn sm ghost tap" data-act="tnew">↔ 转账</button><button class="btn primary sm tap" data-act="anew">+ 新建账户</button>',
        body: '<div class="list">' + (arr.length ? arr.map(function (a) {
          var b = balance(a.id);
          var isDebt = a.type === '信用卡' && b < 0;
          return '<div class="item"><div class="item-main">' +
            '<div class="row between"><span class="item-title">' + esc(a.name) + '</span>' +
            '<span class="big-num" style="font-size:19px;color:' + (b < 0 ? '#B4553F' : '#331915') + '">' + money(b) + '</span></div>' +
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
      }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); });

      var inc = sumBy(arr.filter(function (f) { return f.type === 'in'; }), 'amount');
      var exp = sumBy(arr.filter(function (f) { return f.type === 'out'; }), 'amount');

      return UI.card({
        title: '🧾 收支流水', sub: '收 ' + money(inc) + ' · 支 ' + money(exp),
        right: TF.btn('finance_flow', { sm: true }) + '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button><button class="btn primary sm tap" data-act="fnew">+ 记一笔</button>',
        body: '<div class="row" style="flex-direction:column;align-items:flex-start;gap:12px">' +
          UI.pills([{ k: '', t: '全部类型' }, { k: 'in', t: '收入' }, { k: 'out', t: '支出' }, { k: 'transfer', t: '转账' }], type, 'ftype') +
          (F().accounts.length ? UI.pills([{ k: '', t: '全部账户' }].concat(F().accounts.map(function (a) { return { k: a.id, t: a.name }; })), acc, 'facc') : '') +
          '</div><div style="height:18px"></div>' +
          ListPager.out({ ns: 'finance:flow', items: arr, defSize: 5, empty: '这个时间段还没有流水记录', emptyIcon: '🧾', render: renderFlowItem })
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
            '<span>已存 <b>' + money(saved) + '</b> / ' + money(g.target) + '</span>' +
            (left > 0 ? '<span class="badge grey">还差 ' + money(left) + '</span>' : '<span class="badge">已达成</span>') +
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
      var y = App.tab('finance', 'sy', U.yr());
      var years = {}; flows.forEach(function (f) { years[U.yr(f.date)] = 1; }); years[U.yr()] = 1;
      var yl = Object.keys(years).sort().reverse();

      // 近 6 个月
      var months = [], d = new Date();
      for (var i = 5; i >= 0; i--) {
        var dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push(dd.getFullYear() + '-' + U.pad(dd.getMonth() + 1));
      }
      var barRows = months.map(function (m) {
        var mf = flows.filter(function (f) { return U.ym(f.date) === m; });
        return {
          t: (+m.slice(5)) + '月',
          a: sumBy(mf.filter(function (f) { return f.type === 'in'; }), 'amount'),
          b: sumBy(mf.filter(function (f) { return f.type === 'out'; }), 'amount')
        };
      });

      // 年度分类占比
      var yf = flows.filter(function (f) { return U.yr(f.date) === y; });
      var expMap = {}, incMap = {};
      yf.forEach(function (f) {
        if (f.type === 'out') expMap[f.cat || '未分类'] = (expMap[f.cat || '未分类'] || 0) + num(f.amount);
        if (f.type === 'in') incMap[f.cat || '未分类'] = (incMap[f.cat || '未分类'] || 0) + num(f.amount);
      });
      var toRows = function (m) {
        return Object.keys(m).map(function (k) { return { t: k, v: m[k] }; }).sort(function (a, b) { return b.v - a.v; });
      };
      var yInc = sumBy(yf.filter(function (f) { return f.type === 'in'; }), 'amount');
      var yExp = sumBy(yf.filter(function (f) { return f.type === 'out'; }), 'amount');

      // 资产净值趋势（近 12 个月末）
      var netPts = [], init = F().accounts.reduce(function (s, a) { return s + num(a.init); }, 0);
      var d2 = new Date();
      for (var j = 11; j >= 0; j--) {
        var end = new Date(d2.getFullYear(), d2.getMonth() - j + 1, 0);
        var key = end.getFullYear() + '-' + U.pad(end.getMonth() + 1) + '-' + U.pad(end.getDate());
        var v = init;
        flows.forEach(function (f) {
          if (String(f.date) > key) return;
          if (f.type === 'in') v += num(f.amount);
          if (f.type === 'out') v -= num(f.amount);
        });
        netPts.push({ t: key.slice(0, 7), v: Math.round(v) });
      }

      return UI.card({ title: '📊 近 6 个月收支', body: UI.bars2(barRows) }) +
        UI.card({
          title: '🥧 ' + y + ' 年分类占比',
          right: yl.length > 1 ? UI.pills(yl.map(function (x) { return { k: x, t: x + '年' }; }), y, 'sy') : '',
          body: '<div class="row between" style="margin-bottom:6px"><strong class="small">支出 ' + money(yExp) + '</strong></div>' +
            UI.hbars(toRows(expMap), yExp, money) +
            '<div class="hr" style="margin:18px 0"></div>' +
            '<div class="row between" style="margin-bottom:6px"><strong class="small">收入 ' + money(yInc) + '</strong></div>' +
            UI.hbars(toRows(incMap), yInc, money)
        }) +
        UI.card({ title: '📈 资产净值变化', sub: '近 12 个月', body: UI.line(netPts, { dec: 0 }) }) +
        UI.card({
          title: '⚙️ 收支分类管理',
          body: '<div class="small muted" style="margin-bottom:10px">支出分类</div>' +
            '<div class="pills">' + F().catExpense.map(function (c) {
              return '<span class="pill">' + esc(c) + '<button class="link-btn del tap" data-act="catdel" data-t="out" data-c="' + esc(c) + '">×</button></span>';
            }).join('') + '<button class="pill tap" data-act="catadd" data-t="out">+ 新增</button></div>' +
            '<div class="small muted" style="margin:16px 0 10px">收入分类</div>' +
            '<div class="pills">' + F().catIncome.map(function (c) {
              return '<span class="pill">' + esc(c) + '<button class="link-btn del tap" data-act="catdel" data-t="in" data-c="' + esc(c) + '">×</button></span>';
            }).join('') + '<button class="pill tap" data-act="catadd" data-t="in">+ 新增</button></div>'
        });
    },

    acts: {
      tab: function (t) { App.setTab('finance', 'main', t.dataset.k); ListPager.resetPg('finance:flow'); App.refresh(); },
      ftype: function (t) { App.setTab('finance', 'ftype', t.dataset.k); ListPager.resetPg('finance:flow'); App.refresh(); },
      facc: function (t) { App.setTab('finance', 'facc', t.dataset.k); ListPager.resetPg('finance:flow'); App.refresh(); },
      sy: function (t) { App.setTab('finance', 'sy', t.dataset.k); App.refresh(); },

      anew: function () {
        UI.form({
          title: '新建账户', fields: [
            { k: 'name', label: '账户名称', req: true, full: true, ph: '如：招行储蓄卡 / 微信零钱' },
            { k: 'type', label: '账户类型', type: 'select', options: ACC_TYPE, def: '储蓄卡' },
            { k: 'balance', label: '当前余额', type: 'number', def: 0, hint: '信用卡欠钱可填负数，如 -2000' },
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
            { k: 'balance', label: '当前余额', type: 'number', hint: '直接调整余额，不影响已有记账；信用卡欠钱填负数' },
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
          title: '账户转账', values: { date: U.today() }, fields: [
            { k: 'acc', label: '转出账户', type: 'select', options: opts, req: true },
            { k: 'acc2', label: '转入账户', type: 'select', options: opts, req: true },
            { k: 'amount', label: '金额', type: 'number', min: 0, req: true },
            { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
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
          title: '存入 ·' + g.name, desc: '已存 ' + money(saved) + ' / 目标 ' + money(g.target),
          values: { date: U.today() }, fields: [
            { k: 'amount', label: '存入金额', type: 'number', min: 0, req: true },
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

      catadd: function (t) {
        var type = t.dataset.t;
        UI.form({ title: '新增' + (type === 'out' ? '支出' : '收入') + '分类', fields: [{ k: 'c', label: '分类名称', req: true, full: true }] })
          .then(function (v) { if (!v) return; addCat(type, v.c); Store.save(); App.refresh(); });
      },
      catdel: function (t) {
        var type = t.dataset.t, c = t.dataset.c;
        var k = type === 'out' ? 'catExpense' : 'catIncome';
        F()[k] = F()[k].filter(function (x) { return x !== c; });
        Store.save(); App.refresh();
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
          sort: function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); },
          extraBar: function (cur) {
            var io = '<div class="row" style="gap:8px;margin-bottom:4px">' +
              '<button class="btn sm ghost tap" data-act="finImport">📥 导入 xlsx</button>' +
              '<button class="btn sm ghost tap" data-act="finExport">📤 导出 xlsx</button>' +
              '<input type="file" id="finXlsx" accept=".xlsx,.xls" style="display:none">' +
              '</div>';
            var cats = {};
            F().flows.forEach(function (f) { if (f.cat) cats[f.cat] = 1; });
            var ps = [{ k: '', t: '全部分类' }].concat(Object.keys(cats).sort().map(function (c) { return { k: c, t: c }; }));
            return io + UI.pills(ps, cur, 'histFilter');
          },
          extraMatch: function (f, val) {
            if (!val) return true;
            if (f.type === 'transfer') return false;
            return f.cat === val;
          },
          summary: function (arr) {
            var inc = arr.filter(function (f) { return f.type === 'in'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
            var exp = arr.filter(function (f) { return f.type === 'out'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
            var tr = arr.filter(function (f) { return f.type === 'transfer'; }).reduce(function (s, f) { return s + num(f.amount); }, 0);
            return UI.stats([
              ['收入', money(inc), true],
              ['支出', money(exp)],
              ['转账', money(tr)]
            ]);
          },
          render: function (f) {
            var sign = f.type === 'in' ? '+' : f.type === 'out' ? '-' : '';
            var color = f.type === 'in' ? '#6E8A28' : f.type === 'out' ? '#B4553F' : '#6E8A9B';
            return '<div class="item"><div class="item-main">' +
              '<div class="row between" style="gap:10px"><span class="item-title">' + esc(f.type === 'transfer' ? accName(f.acc) + ' → ' + accName(f.acc2) : (f.cat || '未分类')) + '</span>' +
              '<span style="font-weight:700;color:' + color + '">' + sign + money(f.amount) + '</span></div>' +
              '<div class="item-meta"><span>' + U.fmtDate(f.date, true) + '</span>' +
              (f.type !== 'transfer' ? '<span class="badge grey">' + esc(accName(f.acc)) + '</span>' : '<span class="badge info">转账</span>') +
              (f.note ? '<span>' + esc(f.note) + '</span>' : '') + '</div></div>' +
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
      if (cat) addCat(type, cat);
      F().flows.push({
        id: U.uid(), type: type, amount: Math.abs(num(r['金额'])),
        acc: get(r['账户']), date: normDate(r['日期']),
        cat: cat || '', note: [r['二级分类'], r['备注']].filter(function (x) { return x != null && x !== ''; }).join(' · ')
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
        '日期': f.date, '时间': '00:00:00',
        '类型': f.type === 'in' ? '收入' : '支出',
        '金额': Math.abs(num(f.amount)),
        '一级分类': f.cat || '', '二级分类': '', '标签': '',
        '账户': accName(f.acc),
        '计入收支': '是', '计入预算': '是', '所属账本': '总账本',
        '备注': f.note || ''
      };
    });
    var rows2 = [];
    F().flows.filter(function (f) { return f.type === 'transfer'; }).forEach(function (f) {
      rows2.push({ '日期': f.date, '时间': '00:00:00', '类型': '账户互转', '金额': Math.abs(num(f.amount)), '转入账户': accName(f.acc2), '转出账户': accName(f.acc), '备注': f.note || '' });
    });
    F().flows.filter(function (f) { return f.cat === '余额调整'; }).forEach(function (f) {
      rows2.push({ '日期': f.date, '时间': '00:00:00', '类型': '余额调整', '金额': (f.type === 'in' ? '' : '-') + Math.abs(num(f.amount)), '转入账户': f.type === 'in' ? accName(f.acc) : '', '转出账户': f.type === 'out' ? accName(f.acc) : '', '备注': f.note || '' });
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
    if (c && F()[k].indexOf(c) < 0) F()[k].push(c);
  }

  function flowFields(type) {
    var cats = (type === 'in' ? F().catIncome : F().catExpense);
    return [
      { k: 'type', label: '类型', type: 'select', options: [{ v: 'out', t: '支出' }, { v: 'in', t: '收入' }], def: type || 'out', hint: '改类型后请重新选择分类' },
      { k: 'amount', label: '金额', type: 'number', min: 0, req: true },
      { k: 'acc', label: '账户', type: 'select', req: true, options: F().accounts.map(function (a) { return { v: a.id, t: a.name }; }) },
      { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
      { k: 'cat', label: '分类', type: 'select', ph: '请选择', options: F().catExpense.concat(F().catIncome).filter(function (v, i, s) { return s.indexOf(v) === i; }) },
      { k: 'newcat', label: '或新增分类', ph: '填了会自动加入分类库' },
      { k: 'note', label: '备注', type: 'textarea', rows: 3 }
    ];
  }
  function goalFields() {
    return [
      { k: 'name', label: '目标名称', req: true, full: true, ph: '如：旅行基金' },
      { k: 'target', label: '目标金额', type: 'number', min: 0, req: true },
      { k: 'due', label: '计划完成日期', type: 'date' },
      { k: 'note', label: '备注', full: true }
    ];
  }

  TF.def('finance_flow', 'month');
  TF.hook('finance_flow', function () { ListPager.resetPg('finance:flow'); App.refresh(); });

  App.register(finance);
})();
