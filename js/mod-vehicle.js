/* ========== 车辆管理：电车充电 / 油车加油 / 保养提醒 ========== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, D = function () { return Store.data; };
  var TF = window.TF;

  var evPg = 1, evSz = 5;    // 充电记录分页
  var fuelPg = 1, fuelSz = 5; // 加油记录分页
  var PAGE_SIZES = [5, 10, 20, 50, 100];
  var evExpanded = null, fuelExpanded = null;  // 当前展开的记录 id
  var EV_PLACES = ['在家充', '公用充电桩', '单位充'];  // 充电地点选项
  function evPlaceSet() { var s = App.tab('vehicle', 'evPlaces', ''); return s ? String(s).split(',') : []; }
  function placeMatch(c) { return placeMatchSet(c, evPlaceSet()); }
  function placeBadge(c) { return c.place ? '<span class="badge purple">' + esc(c.place) + '</span>' : ''; }
  /* 充电地点多选筛选条（可任选一类或两类）
     setArr: 当前选中的地点数组；当不传入时读取主列表的状态（App.tab） */
  function evPlaceFilterBar(setArr) {
    var set = setArr || evPlaceSet();
    var inHist = Array.isArray(setArr); // 传入数组表示在历史弹窗内渲染
    var act = inHist ? 'histFilter' : 'evPlace';
    var clearAct = inHist ? 'histFilter' : 'evPlaceClear';
    var clearKAttr = inHist ? ' data-k=""' : '';
    var btns = EV_PLACES.map(function (p) {
      return '<button class="pill tap' + (set.indexOf(p) >= 0 ? ' on' : '') + '" data-act="' + act + '" data-k="' + esc(p) + '"' + (inHist ? ' data-multi="1"' : '') + '>' + esc(p) + '</button>';
    }).join('');
    var clear = '';
    if (set.length) {
      clear = '<button class="link-btn tap" data-act="' + clearAct + '"' + clearKAttr + '>清除</button>';
    }
    return '<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 14px">' +
      '<span class="small muted">充电地点</span>' + btns + clear + '</div>';
  }
  /* 通用地点匹配：set 为空则全部通过 */
  function placeMatchSet(c, set) { return !set.length || set.indexOf(c.place) >= 0; }

  function pagerHtml(total, pgRef, szRef, pgAct, szAct) {
    var sz = szRef.v, pages = Math.max(1, Math.ceil(total / sz));
    var pg = Math.min(pgRef.v, pages); pgRef.v = pg;
    return UI.pager({
      pg: pg, pages: pages, total: total, size: sz, sizes: PAGE_SIZES,
      pageAct: pgAct, sizeChg: szAct
    });
  }

  /* ---------- 折叠式记录行：折叠只留最关键信息，点开看全部 ---------- */
  function caret(open) { return '<span style="font-size:11px;color:#999">' + (open ? '▾' : '▸') + '</span>'; }

  function renderChargeItem(c, km) {
    var dv = chargeDerived(c);
    var open = evExpanded === c.id;
    var act = 'evexp';
    var head = '<div class="row between"><span class="item-title">' + U.fmtDate(c.date) + '</span>' +
      '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
      '<span class="badge">' + U.money(dv.fee) + '</span>' + caret(open) + '</span></div>';
    if (!open) {
      return '<div class="item" data-act="' + act + '" data-id="' + c.id + '"><div class="item-main">' + head +
        '<div class="item-meta">' + placeBadge(c) + '<span class="badge grey">' + num(c.fromPct) + '% → ' + num(c.toPct) + '%</span>' +
        '<span>充入 ' + dv.charged.toFixed(2) + ' 度</span>' +
        (km != null ? '<span>' + km + ' km</span>' : '') + '</div></div></div>';
    }
    return '<div class="item open" data-act="' + act + '" data-id="' + c.id + '"><div class="item-main">' + head +
      '<div class="item-meta">' + placeBadge(c) + '<span class="badge grey">' + num(c.fromPct) + '% → ' + num(c.toPct) + '%</span>' +
      '<span class="badge">充入 ' + dv.charged.toFixed(2) + ' 度</span>' +
      '<span class="badge grey">电表 ' + dv.meter.toFixed(2) + ' 度</span>' +
      '<span class="badge ' + (dv.loss > 20 ? 'danger' : 'grey') + '">损耗 ' + dv.loss.toFixed(1) + '%</span></div>' +
      '<div class="item-meta">' +
      '<span>电价 ' + U.money(num(c.price) || num(ev().price)) + ' /度</span>' +
      (num(c.odoBefore) ? '<span>充前总里程 ' + num(c.odoBefore) + ' km</span>' : '') +
      (km != null ? '<span>本次行驶 ' + km + ' km</span>' : '') +
      '</div></div>' + UI.ops(c.id, 'eedit', 'edel') + '</div>';
  }

  function renderRefuelItem(c, km) {
    var open = fuelExpanded === c.id;
    var act = 'fuelexp';
    var head = '<div class="row between"><span class="item-title">' + U.fmtDate(c.date) + '</span>' +
      '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' +
      '<span class="badge">' + U.money(num(c.cost)) + '</span>' + caret(open) + '</span></div>';
    if (!open) {
      return '<div class="item" data-act="' + act + '" data-id="' + c.id + '"><div class="item-main">' + head +
        '<div class="item-meta"><span class="badge grey">' + num(c.liters).toFixed(2) + ' 升</span>' +
        '<span>' + U.money(num(c.price)) + ' /升</span>' +
        (km != null ? '<span>' + km + ' km</span>' : '') + '</div></div></div>';
    }
    return '<div class="item open" data-act="' + act + '" data-id="' + c.id + '"><div class="item-main">' + head +
      '<div class="item-meta"><span class="badge grey">' + num(c.liters).toFixed(2) + ' 升</span>' +
      '<span class="badge grey">' + U.money(num(c.price)) + ' /升</span>' +
      (km != null ? '<span class="badge">行驶 ' + km + ' km</span>' : '') +
      (km != null && km > 0 ? '<span class="badge">' + U.money(num(c.cost) / km) + ' /km</span>' : '') + '</div>' +
      (num(c.odo) ? '<div class="item-meta"><span>加油时总里程 ' + num(c.odo) + ' km</span></div>' : '') +
      '</div>' + UI.ops(c.id, 'fedit', 'fdel') + '</div>';
  }

  function ev() { return D().vehicles.ev; }
  function fuel() { return D().vehicles.fuel; }
  function uid() { return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* 单条充电的派生值：实际充入电池 / 电表度数 / 电费 / 损耗率 */
  function chargeDerived(c) {
    var battery = num(ev().battery) || 45;
    var from = num(c.fromPct), to = num(c.toPct);
    var charged = Math.max(0, (to - from) / 100 * battery);   // 实际充入电池（度）
    var meter = num(c.meterKwh);
    var price = num(c.price || ev().price || 0.3353);
    var fee = meter * price;
    var loss = (meter > 0 && charged > 0) ? (meter - charged) / charged * 100 : 0;
    return { charged: charged, meter: meter, fee: fee, loss: loss };
  }

  function sortedCharges() { return U.sortBy(ev().charges || [], 'date'); }
  function sortedRefuels() { return U.sortBy(fuel().refuels || [], 'date'); }

  /* 保养状态：里程 + 日期，自动判断是否需关注 */
  function serviceStatus(cfg, curOdo) {
    var lines = [], warn = false;
    if (num(cfg.serviceMile) > 0) {
      var left = num(cfg.serviceMile) - num(curOdo);
      if (left <= 0) { warn = true; lines.push('里程已到（' + num(curOdo) + '/' + num(cfg.serviceMile) + 'km），建议保养'); }
      else lines.push('距保养里程还有 ' + left + ' km（当前 ' + num(curOdo) + ' km）');
    }
    if (cfg.serviceDate) {
      var nd = U.dayDiff(U.today(), cfg.serviceDate);
      if (nd < 0) { warn = true; lines.push('保养已逾期 ' + (-nd) + ' 天'); }
      else if (nd <= 30) { warn = true; lines.push('距保养日期还有 ' + nd + ' 天'); }
      else lines.push('距保养日期还有 ' + nd + ' 天');
    }
    if (!lines.length) lines.push('未设置保养提醒');
    return { warn: warn, text: lines.join('；') };
  }

  function currentOdo(kind) {
    if (kind === 'ev') {
      var cs = sortedCharges();
      return cs.length ? Math.max.apply(null, cs.map(function (c) { return num(c.odoBefore); })) : 0;
    }
    var rs = sortedRefuels();
    return rs.length ? Math.max.apply(null, rs.map(function (c) { return num(c.odo); })) : 0;
  }

  /* 充电统计（按统一时间段筛选，可传入已地点筛选的数组）
     口径：
       - 里程 km：整车里程表，永远全量、与地点无关
       - 电费 fee：只累加“花钱的”充电（家充+公充），单位充=0 自然不计入
       - 损耗率 loss：只在“已抄表(meter>0)”的充电上聚合，避免单位充(无表)把损耗算成负数
       - 免费充入 freeCharged：地点为“单位充”的充入电量（免费、未抄表），用于折算等效成本 */
  function evStats(modId, arr, kmMap) {
    arr = arr || sortedCharges();
    kmMap = kmMap || {};
    var meter = 0, charged = 0, fee = 0, km = 0;
    var mMeter = 0, mCharged = 0;   // 仅已抄表充电，用于损耗率
    var freeCharged = 0;            // 单位充（免费、未抄表）
    arr.forEach(function (c) {
      if (!TF.inRange(modId, c.date)) return;
      var dv = chargeDerived(c);
      var metered = dv.meter > 0;
      meter += dv.meter; charged += dv.charged; fee += dv.fee;
      if (kmMap[c.id] != null) km += kmMap[c.id];
      if (metered) { mMeter += dv.meter; mCharged += dv.charged; }
      if (c.place === '单位充') freeCharged += dv.charged;
    });
    var loss = (mMeter > 0 && mCharged > 0) ? (mMeter - mCharged) / mCharged * 100 : 0;
    return { meter: meter, charged: charged, fee: fee, km: km, loss: loss, freeCharged: freeCharged };
  }

  /* 加油统计（按统一时间段筛选） */
  function fuelStats(modId) {
    var arr = sortedRefuels();
    var cost = 0, liters = 0, km = 0;
    arr.forEach(function (c, i) {
      if (!TF.inRange(modId, c.date)) return;
      cost += num(c.cost); liters += num(c.liters);
      if (i < arr.length - 1) {
        var nx = arr[i + 1];
        if (num(c.odo) > 0 && num(nx.odo) > 0) km += num(nx.odo) - num(c.odo);
      }
    });
    var perKm = km > 0 ? cost / km : 0;
    return { cost: cost, liters: liters, km: km, perKm: perKm };
  }

  /* 油车：加油量 / 油价 / 花费 三选二自动换算，返回 null 表示不足两项 */
  function fillFuel(v) {
    var L = (v.liters === '' || v.liters == null) ? null : num(v.liters);
    var P = (v.price === '' || v.price == null) ? null : num(v.price);
    var C = (v.cost === '' || v.cost == null) ? null : num(v.cost);
    var cnt = [L, P, C].filter(function (x) { return x != null; }).length;
    if (cnt < 2) return null;
    if (L == null) L = C / P;
    else if (P == null) P = C / L;
    else if (C == null) C = L * P;
    return { liters: L, price: P, cost: C };
  }

  var vehicles = {
    id: 'vehicle', icon: '🚗', name: '车辆管理',

    render: function () {
      var t = App.tab('vehicle', 'main', 'ev');
      return UI.head('🚗 车辆管理', '电车充电 · 油车加油 · 保养提醒') +
        UI.tabs([
          { k: 'ev', t: '电车管理', i: '⚡' },
          { k: 'fuel', t: '油车管理', i: '⛽' }
        ], t, 'tab') +
        (t === 'ev' ? this.ev() : this.fuel());
    },

    /* ============ 电车管理 ============ */
    ev: function () {
      var e = ev();
      var svc = serviceStatus(e, currentOdo('ev'));
      var cfgSvcCard = UI.card({
        title: '⚙️ 电车配置与保养' + (svc.warn ? ' <span class="badge danger">需关注</span>' : ''),
        sub: '电池、电价、保养里程与日期',
        right: '<button class="btn sm tap" data-act="evcfg">设置</button>',
        body: UI.stats([
          ['电池容量', num(e.battery) + ' 度'],
          ['电价', U.money(num(e.price)) + ' /度'],
          ['保养里程', num(e.serviceMile) > 0 ? num(e.serviceMile) + ' km' : '未设置'],
          ['保养日期', e.serviceDate || '未设置']
        ]) + '<div class="small muted" style="line-height:1.8;margin-top:10px">' + esc(svc.text) + '</div>'
      });
      // 记录列表（按充电前总里程算相邻里程差）—— 先算 kmMap/all，统计才能吃到地点筛选结果
      var srt = sortedCharges();
      var kmMap = {};
      srt.forEach(function (c, i) {
        if (i < srt.length - 1 && num(c.odoBefore) > 0 && num(srt[i + 1].odoBefore) > 0)
          kmMap[c.id] = num(srt[i + 1].odoBefore) - num(c.odoBefore);
      });
      var all = srt.slice().reverse().filter(function (c) { return placeMatch(c) && TF.inRange('vehicle_ev_list', c.date); });
      var s = evStats('vehicle_ev_list', srt.slice().reverse().filter(placeMatch), kmMap);
      var homePrice = num(e.price) || 0.3353;              // 家充电价，用于折算单位充的等效成本
      var perKm = s.km > 0 ? s.fee / s.km : 0;             // 实付每公里（含免费电，真实花多少）
      var eqCost = s.fee + s.freeCharged * homePrice;      // 等效成本：免费电按家充价折算
      var eqPerKm = s.km > 0 ? eqCost / s.km : 0;          // 等效每公里（没有免费充电时本该花多少）
      var freePct = s.charged > 0 ? s.freeCharged / s.charged * 100 : 0;
      var statCard = UI.card({
        title: '📊 充电统计',
        right: TF.btn('vehicle_ev_list'),
        body: UI.stats([
          ['总里程', s.km > 0 ? s.km + ' km' : '—'],
          ['电费合计', U.money(s.fee), true, U.moneyFull(s.fee)],
          ['实付每公里', s.km > 0 ? U.money(perKm) : '—', true, s.km > 0 ? U.moneyFull(perKm) : ''],
          ['等效每公里', s.km > 0 ? U.money(eqPerKm) : '—', false, s.km > 0 ? U.moneyFull(eqPerKm) : ''],
          ['免费充电占比', freePct.toFixed(0) + '%'],
          ['已抄表电量', s.meter.toFixed(2) + ' 度'],
          ['充入电量', s.charged.toFixed(2) + ' 度（含免费）'],
          ['平均损耗率', s.loss.toFixed(1) + ' %']
        ]) + (s.km > 0
          ? '<div class="small muted" style="margin-top:8px">平均能耗：' + (s.charged / s.km * 100).toFixed(2) + ' 度/100km · ' +
            '实付每公里 ' + U.money(perKm) + '（已含单位免费电）；若无免费电，等效每公里 ' + U.money(eqPerKm) + '</div>'
          : '<div class="small muted" style="margin-top:8px">记录相邻两次充电的「充电前总里程」后，即可自动推算每公里花费</div>')
      });
      var sz = evSz, pages = Math.max(1, Math.ceil(all.length / sz));
      var pg = Math.min(evPg, pages); evPg = pg;
      var pageList = all.slice((pg - 1) * sz, pg * sz);
      var rows = pageList.length
        ? '<div class="list">' + pageList.map(function (c) {
          return renderChargeItem(c, kmMap[c.id]);
        }).join('') + '</div>'
        : UI.empty('还没有充电记录，点右上角「记充电」开始', '⚡');
      var listCard = UI.card({
        title: '⚡ 充电记录' + (all.length ? '（' + all.length + '）' : ''),
        right: '<button class="btn ghost sm tap" data-act="evHist">📜 历史记录</button><button class="btn primary sm tap" data-act="enew">+ 记充电</button>',
        body: rows + (all.length ? pagerHtml(all.length, { v: evPg }, { v: evSz }, 'evPage', 'evSize') : '')
      });
      return cfgSvcCard + statCard + evPlaceFilterBar() + listCard;
    },

    /* ============ 油车管理 ============ */
    fuel: function () {
      var f = fuel();
      var svc = serviceStatus(f, currentOdo('fuel'));
      var svcCard = UI.card({
        title: '🔧 保养提醒' + (svc.warn ? ' <span class="badge danger">需关注</span>' : ''),
        right: '<button class="btn sm tap" data-act="fsvc">设置</button>',
        body: '<div class="small muted" style="line-height:1.9">' + esc(svc.text) + '</div>'
      });
      var s = fuelStats('vehicle_fuel_list');
      var statCard = UI.card({
        title: '📊 加油统计',
        right: TF.btn('vehicle_fuel_list'),
        body: UI.stats([
          ['累计花费', U.money(s.cost), false, U.moneyFull(s.cost)],
          ['累计加油', s.liters.toFixed(2) + ' 升'],
          ['平均', s.perKm > 0 ? U.money(s.perKm) + ' /km' : '—', false, s.perKm > 0 ? U.moneyFull(s.perKm) : '']
        ]) + (s.km > 0 ? '<div class="small muted" style="margin-top:8px">统计区间内共行驶 ' + s.km + ' km</div>' : '')
      });
      var srt = sortedRefuels();
      var kmMap = {};
      srt.forEach(function (c, i) {
        if (i < srt.length - 1 && num(c.odo) > 0 && num(srt[i + 1].odo) > 0)
          kmMap[c.id] = num(srt[i + 1].odo) - num(c.odo);
      });
      var all = srt.slice().reverse().filter(function (c) { return TF.inRange('vehicle_fuel_list', c.date); });
      var sz = fuelSz, pages = Math.max(1, Math.ceil(all.length / sz));
      var pg = Math.min(fuelPg, pages); fuelPg = pg;
      var pageList = all.slice((pg - 1) * sz, pg * sz);
      var rows = pageList.length
        ? '<div class="list">' + pageList.map(function (c) {
          return renderRefuelItem(c, kmMap[c.id]);
        }).join('') + '</div>'
        : UI.empty('还没有加油记录，点右上角「加油」开始', '⛽');
      var listCard = UI.card({
        title: '⛽ 加油记录' + (all.length ? '（' + all.length + '）' : ''),
        right: '<button class="btn ghost sm tap" data-act="fuelHist">📜 历史记录</button><button class="btn primary sm tap" data-act="fnew">+ 加油</button>',
        body: rows + (all.length ? pagerHtml(all.length, { v: fuelPg }, { v: fuelSz }, 'fuelPage', 'fuelSize') : '')
      });
      return svcCard + statCard + listCard;
    },

    acts: {
      tab: function (t) { App.setTab('vehicle', 'main', t.dataset.k); App.refresh(); },
      evexp: function (t) { evExpanded = evExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },
      fuelexp: function (t) { fuelExpanded = fuelExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },

      /* ---- 电车 ---- */
      evcfg: function () {
        UI.form({
          title: '电车配置与保养',
          values: {
            battery: num(ev().battery) || 45,
            price: num(ev().price) || 0.3353,
            serviceMile: num(ev().serviceMile) || '',
            serviceDate: ev().serviceDate || ''
          },
          fields: [
            { k: 'battery', label: '电池容量（度）', type: 'number', step: 0.1, min: 0.1, req: true, hint: '实际充入电量 = (充电后% − 充电前%) ÷ 100 × 容量' },
            { k: 'price', label: '电价（元/度）', type: 'number', step: 0.0001, min: 0, req: true, hint: '默认 0.3353' },
            { k: 'serviceMile', label: '保养里程（km）', type: 'number', step: 1, min: 0, hint: '到该里程提醒保养，0 表示不按里程' },
            { k: 'serviceDate', label: '保养日期', type: 'date', hint: '到该日期前 30 天提醒' }
          ]
        }).then(function (v) {
          if (!v) return;
          ev().battery = num(v.battery) || 45;
          ev().price = num(v.price) || 0.3353;
          ev().serviceMile = num(v.serviceMile);
          ev().serviceDate = v.serviceDate || '';
          Store.save(); App.refresh();
        });
      },
      enew: function () {
        UI.form({
          title: '记充电',
          values: { date: U.today(), toPct: 100, price: num(ev().price) || 0.3353 },
          fields: [
            { k: 'date', label: '充电日期', type: 'date', req: true },
            { k: 'place', label: '充电地点', type: 'select', options: EV_PLACES, ph: '不记录地点' },
            { k: 'fromPct', label: '充电前电量（%）', type: 'number', min: 0, max: 100, step: 1, req: true, ph: '如 30' },
            { k: 'toPct', label: '充电后电量（%）', type: 'number', min: 0, max: 100, step: 1, def: 100, ph: '默认 100（充满）' },
            { k: 'meterKwh', label: '电表度数（度）', type: 'number', step: 0.01, min: 0, req: false, ph: '本次电表走字', hint: '单位充可留空（免费、不抄表）；家充/公充请填写' },
            { k: 'price', label: '电价（元/度）', type: 'number', step: 0.0001, min: 0, ph: '留空用配置电价' },
            { k: 'odoBefore', label: '充电前总里程（km）', type: 'number', step: 1, min: 0, hint: '用于自动计算两次充电间里程差' }
          ]
        }).then(function (v) {
          if (!v) return;
          if (num(v.fromPct) >= num(v.toPct)) { U.toast('充电后电量需大于充电前电量'); return; }
          if (v.place !== '单位充' && !(num(v.meterKwh) > 0)) { U.toast('家充/公充请填写电表度数'); return; }
          ev().charges.push({
            id: uid(), date: v.date, place: v.place || '',
            fromPct: num(v.fromPct), toPct: num(v.toPct),
            meterKwh: num(v.meterKwh),
            price: (v.price === '' || v.price == null) ? (num(ev().price) || 0.3353) : num(v.price),
            odoBefore: num(v.odoBefore)
          });
          Store.save(); App.refresh();
        });
      },
      eedit: function (t) {
        var c = ev().charges.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!c) return;
        UI.form({
          title: '编辑充电记录',
          values: { date: c.date, place: c.place || '', fromPct: num(c.fromPct), toPct: num(c.toPct), meterKwh: num(c.meterKwh), price: num(c.price), odoBefore: num(c.odoBefore) },
          fields: [
            { k: 'date', label: '充电日期', type: 'date', req: true },
            { k: 'place', label: '充电地点', type: 'select', options: EV_PLACES, ph: '不记录地点' },
            { k: 'fromPct', label: '充电前电量（%）', type: 'number', min: 0, max: 100, step: 1, req: true },
            { k: 'toPct', label: '充电后电量（%）', type: 'number', min: 0, max: 100, step: 1 },
            { k: 'meterKwh', label: '电表度数（度）', type: 'number', step: 0.01, min: 0, req: false, hint: '单位充可留空（免费、不抄表）；家充/公充请填写' },
            { k: 'price', label: '电价（元/度）', type: 'number', step: 0.0001, min: 0 },
            { k: 'odoBefore', label: '充电前总里程（km）', type: 'number', step: 1, min: 0 }
          ]
        }).then(function (v) {
          if (!v) return;
          if (num(v.fromPct) >= num(v.toPct)) { U.toast('充电后电量需大于充电前电量'); return; }
          if (v.place !== '单位充' && !(num(v.meterKwh) > 0)) { U.toast('家充/公充请填写电表度数'); return; }
          c.date = v.date; c.place = v.place || ''; c.fromPct = num(v.fromPct); c.toPct = num(v.toPct);
          c.meterKwh = num(v.meterKwh);
          c.price = (v.price === '' || v.price == null) ? (num(ev().price) || 0.3353) : num(v.price);
          c.odoBefore = num(v.odoBefore);
          Store.save(); App.refresh();
        });
      },
      edel: function (t) {
        var x = ev().charges.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del('充电记录', function () { ev().charges = ev().charges.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      },

      /* ---- 油车 ---- */
      fsvc: function () {
        UI.form({
          title: '油车保养提醒',
          values: { serviceMile: num(fuel().serviceMile), serviceDate: fuel().serviceDate || '' },
          fields: [
            { k: 'serviceMile', label: '保养里程（km）', type: 'number', step: 1, min: 0, hint: '到该里程提醒保养，0 表示不按里程' },
            { k: 'serviceDate', label: '保养日期', type: 'date', hint: '到该日期前 30 天提醒' }
          ]
        }).then(function (v) {
          if (!v) return;
          fuel().serviceMile = num(v.serviceMile);
          fuel().serviceDate = v.serviceDate || '';
          Store.save(); App.refresh();
        });
      },
      fnew: function () {
        UI.form({
          title: '加油记录',
          values: { date: U.today() },
          desc: '加油量、油价、花费 填两个即可自动算出第三个',
          fields: [
            { k: 'date', label: '加油日期', type: 'date', req: true },
            { k: 'liters', label: '加油量（升）', type: 'number', step: 0.01, min: 0 },
            { k: 'price', label: '油价（元/升）', type: 'number', step: 0.01, min: 0 },
            { k: 'cost', label: '花费（元）', type: 'number', step: 0.01, min: 0 },
            { k: 'odo', label: '加油时总里程（km）', type: 'number', step: 1, min: 0, hint: '用于自动计算两次加油间里程差与每公里花费' }
          ]
        }).then(function (v) {
          if (!v) return;
          var out = fillFuel(v);
          if (!out) { U.toast('加油量、油价、花费至少填两项'); return; }
          fuel().refuels.push({ id: uid(), date: v.date, liters: out.liters, price: out.price, cost: out.cost, odo: num(v.odo) });
          Store.save(); App.refresh();
        });
      },
      fedit: function (t) {
        var c = fuel().refuels.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!c) return;
        UI.form({
          title: '编辑加油记录',
          values: { date: c.date, liters: num(c.liters), price: num(c.price), cost: num(c.cost), odo: num(c.odo) },
          desc: '加油量、油价、花费 填两个即可自动算出第三个',
          fields: [
            { k: 'date', label: '加油日期', type: 'date', req: true },
            { k: 'liters', label: '加油量（升）', type: 'number', step: 0.01, min: 0 },
            { k: 'price', label: '油价（元/升）', type: 'number', step: 0.01, min: 0 },
            { k: 'cost', label: '花费（元）', type: 'number', step: 0.01, min: 0 },
            { k: 'odo', label: '加油时总里程（km）', type: 'number', step: 1, min: 0 }
          ]
        }).then(function (v) {
          if (!v) return;
          var out = fillFuel(v);
          if (!out) { U.toast('加油量、油价、花费至少填两项'); return; }
          c.date = v.date; c.liters = out.liters; c.price = out.price; c.cost = out.cost; c.odo = num(v.odo);
          Store.save(); App.refresh();
        });
      },
      fdel: function (t) {
        var x = fuel().refuels.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del('加油记录', function () { fuel().refuels = fuel().refuels.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      },

      /* 充电地点多选筛选（任选一类或两类） */
      evPlace: function (t) {
        var set = evPlaceSet();
        var p = t.dataset.k, i = set.indexOf(p);
        if (i >= 0) set.splice(i, 1); else set.push(p);
        App.setTab('vehicle', 'evPlaces', set.join(','));
        evPg = 1; App.refresh();
      },
      evPlaceClear: function () { App.setTab('vehicle', 'evPlaces', ''); evPg = 1; App.refresh(); },
      /* 充电记录主列表分页 */
      evPage: function (t) { evPg = num(t.dataset.k) || 1; App.refresh(); },
      evSize: function (t) { evSz = num(t.value) || 5; evPg = 1; App.refresh(); },
      /* 加油记录主列表分页 */
      fuelPage: function (t) { fuelPg = num(t.dataset.k) || 1; App.refresh(); },
      fuelSize: function (t) { fuelSz = num(t.value) || 5; fuelPg = 1; App.refresh(); },

      /* 充电历史记录（时间筛选 + 搜索 + 区间汇总） */
      evHist: function () {
        var kmMap = {}; var srt = sortedCharges();
        srt.forEach(function (c, i) {
          if (i < srt.length - 1 && num(c.odoBefore) > 0 && num(srt[i + 1].odoBefore) > 0) kmMap[c.id] = num(srt[i + 1].odoBefore) - num(c.odoBefore);
        });
        var histPlaces = function () { var v = App.tab('vehicle', 'evHistPlaces', ''); return v ? String(v).split(',') : []; };
        Hist.open({
          modId: 'vehicle_ev',
          title: '⚡ 充电历史记录',
          search: false,
          pager: true, defSize: 5,
          items: function () { return sortedCharges(); },
          date: function (c) { return c.date; },
          match: function (c, q) { return (c.date + ' ' + (c.note || '')).toLowerCase().indexOf(q) >= 0; },
          sort: function (a, b) { return String(b.date).localeCompare(String(a.date)); },
          empty: '该时间段内没有充电记录',
          extraBar: function (cur) { return evPlaceFilterBar(cur ? String(cur).split(',') : []); },
          extraMatch: function (c, cur) { return placeMatchSet(c, cur ? String(cur).split(',') : []); },
          summary: function (arr) {
            var sm = {}; sm.arr = arr.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
            var meter = 0, charged = 0, fee = 0, km = 0, mMeter = 0, mCharged = 0, freeCharged = 0;
            sm.arr.forEach(function (c) {
              var dv = chargeDerived(c);
              var metered = dv.meter > 0;
              meter += dv.meter; charged += dv.charged; fee += dv.fee;
              if (kmMap[c.id] != null) km += kmMap[c.id];
              if (metered) { mMeter += dv.meter; mCharged += dv.charged; }
              if (c.place === '单位充') freeCharged += dv.charged;
            });
            var loss = (mMeter > 0 && mCharged > 0) ? (mMeter - mCharged) / mCharged * 100 : 0;
            var homePrice = num(ev().price) || 0.3353;
            var eqCost = fee + freeCharged * homePrice;
            var eqPerKm = km > 0 ? eqCost / km : 0, perKm = km > 0 ? fee / km : 0;
            var freePct = charged > 0 ? freeCharged / charged * 100 : 0;
            return UI.stats([
              ['总里程', km > 0 ? km + ' km' : '—'],
              ['电费合计', U.money(fee), true, U.moneyFull(fee)],
              ['实付每公里', km > 0 ? U.money(perKm) : '—', true, km > 0 ? U.moneyFull(perKm) : ''],
              ['等效每公里', km > 0 ? U.money(eqPerKm) : '—', false, km > 0 ? U.moneyFull(eqPerKm) : ''],
              ['免费充电占比', freePct.toFixed(0) + '%'],
              ['已抄表电量', meter.toFixed(2) + ' 度', true],
              ['充入电量', charged.toFixed(2) + ' 度（含免费）'],
              ['平均损耗率', loss.toFixed(1) + ' %']
            ]);
          },
          render: function (c) {
            var dv = chargeDerived(c); var km = kmMap[c.id];
            return '<div class="item"><div class="item-main">' +
              '<div class="row between"><span class="item-title">' + U.fmtDate(c.date, true) + '</span>' +
              '<span class="badge">电费 ' + U.money(dv.fee) + '</span></div>' +
              '<div class="item-meta">' + placeBadge(c) + '<span>区间 ' + num(c.fromPct) + '%→' + num(c.toPct) + '%</span>' +
              '<span class="badge grey">电表 ' + dv.meter.toFixed(2) + ' 度</span>' +
              (km != null ? '<span class="badge grey">' + km + ' km</span>' : '') + '</div></div>' +
              UI.ops(c.id, null, 'hdel') + '</div>';
          },
          acts: {
            hdel: function (t, e, redraw) {
              var c = (ev().charges || []).filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!c) return;
              UI.del('充电记录 · ' + U.fmtDate(c.date), function () {
                ev().charges = ev().charges.filter(function (a) { return a.id !== c.id; });
                Store.save(); App.refresh();
                if (redraw) redraw();
              });
            }
          }
        });
      },
      /* 加油历史记录（时间筛选 + 搜索 + 区间汇总） */
      fuelHist: function () {
        var kmMap = {}; var srt = sortedRefuels();
        srt.forEach(function (c, i) {
          if (i < srt.length - 1 && num(c.odo) > 0 && num(srt[i + 1].odo) > 0) kmMap[c.id] = num(srt[i + 1].odo) - num(c.odo);
        });
        Hist.open({
          modId: 'vehicle',
          title: '⛽ 加油历史记录',
          search: false,
          pager: true, defSize: 5,
          items: function () { return sortedRefuels(); },
          date: function (c) { return c.date; },
          match: function (c, q) { return (c.date + ' ' + (c.note || '')).toLowerCase().indexOf(q) >= 0; },
          sort: function (a, b) { return String(b.date).localeCompare(String(a.date)); },
          empty: '该时间段内没有加油记录',
          summary: function (arr) {
            var sm = arr.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
            var cost = 0, liters = 0, km = 0;
            sm.forEach(function (c) {
              cost += num(c.cost); liters += num(c.liters);
              if (kmMap[c.id] != null) km += kmMap[c.id];
            });
            var perKm = km > 0 ? cost / km : 0;
            return UI.stats([
              ['累计花费', U.money(cost), true, U.moneyFull(cost)],
              ['累计加油', liters.toFixed(2) + ' 升'],
              ['平均', perKm > 0 ? U.money(perKm) + ' /km' : '—', false, perKm > 0 ? U.moneyFull(perKm) : ''],
              ['里程', km > 0 ? km + ' km' : '—']
            ]);
          },
          render: function (c) {
            var km = kmMap[c.id];
            return '<div class="item"><div class="item-main">' +
              '<div class="row between"><span class="item-title">' + U.fmtDate(c.date, true) + '</span>' +
              '<span class="badge">花费 ' + U.money(num(c.cost)) + '</span></div>' +
              '<div class="item-meta"><span class="badge grey">' + num(c.liters).toFixed(2) + ' 升</span>' +
              '<span class="badge grey">' + U.money(num(c.price)) + '/升</span>' +
              (km != null ? '<span class="badge grey">' + km + ' km</span>' : '') + '</div></div>' +
              UI.ops(c.id, null, 'hdel') + '</div>';
          },
          acts: {
            hdel: function (t, e, redraw) {
              var c = (fuel().refuels || []).filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!c) return;
              UI.del('加油记录 · ' + U.fmtDate(c.date), function () {
                fuel().refuels = fuel().refuels.filter(function (a) { return a.id !== c.id; });
                Store.save(); App.refresh();
                if (redraw) redraw();
              });
            }
          }
        });
      },

      /* 首页快速记一笔：记充电/加油（选择类型） */
      newCharge: function () {
        var body = '<div class="list">' +
          '<button type="button" class="opt-row tap" data-v="ev"><span class="oi">⚡</span><span class="grow"><strong>记充电（电车）</strong></span><span class="badge grey">电量 / 度数</span></button>' +
          '<button type="button" class="opt-row tap" data-v="fuel"><span class="oi">⛽</span><span class="grow"><strong>记加油（油车）</strong></span><span class="badge grey">升 / 花费</span></button>';
        var el = UI.sheet('车辆记录 · 选择类型', body, '<button class="btn ghost tap" data-x>取消</button>');
        el.addEventListener('click', function (e) {
          var b = e.target.closest('[data-v]'); if (!b) return;
          e.stopPropagation(); el.remove(); UI.unlock();
          if (b.dataset.v === 'ev') { App.setTab('vehicle', 'main', 'ev'); App.go('vehicle'); vehicles.acts.enew(); }
          else { App.setTab('vehicle', 'main', 'fuel'); App.go('vehicle'); vehicles.acts.fnew(); }
        });
      }
    },

    mount: function () {}
  };

  /* 统一时间段筛选器：充电默认本月，加油默认全部 */
  TF.def('vehicle_ev_list', 'month');
  TF.hook('vehicle_ev_list', function () { evPg = 1; App.refresh(); });
  TF.def('vehicle_fuel_list', 'all');
  TF.hook('vehicle_fuel_list', function () { fuelPg = 1; App.refresh(); });

  App.register(vehicles);
})();
