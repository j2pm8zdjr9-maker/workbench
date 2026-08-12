/* ========== 5. 身体管理 / 6. 物品管理 ========== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, D = function () { return Store.data; };

  /* =========================================================
     5. 🏃 身体管理
  ========================================================= */
  var MET = {
    '快走': 4.3, '慢跑': 8, '跑步': 10, '骑行': 6.8, '游泳': 7.5, '瑜伽': 2.8,
    '普拉提': 3.5, '力量训练': 5, '跳绳': 11, '健身操': 6.5, '球类运动': 7,
    '爬楼 / 爬山': 8, '拉伸放松': 2.3, '其他': 4.5
  };

  function lastWeight() {
    var m = U.sortBy(D().body.measures.filter(function (x) { return num(x.weight) > 0; }), 'date', true)[0];
    return m ? num(m.weight) : 55;
  }
  function bmr() {
    var b = num(D().body.bmr);
    return b > 0 ? b : Math.round(lastWeight() * 22);
  }
  function todayWater() { return num(D().body.water[U.today()]); }

  var waterLogExpanded = false;

  var MN = { weight: '体重', waist: '腰围', arm: '臂围', hip: '臀围', bust: '胸围' };
  var MU = { weight: 'kg', waist: 'cm', arm: 'cm', hip: 'cm', bust: 'cm' };
  function mMetric() { return App.tab('body', 'metric', 'weight'); }
  function mFields(m) {
    return [
      { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
      { k: m, label: MN[m] + ' (' + MU[m] + ')', type: 'number', step: 0.1, req: true },
      { k: 'note', label: '备注', full: true }
    ];
  }
  // 编辑时用：展示该条记录的全部字段，便于修正任意一项
  function mFieldsAll() {
    var f = [{ k: 'date', label: '日期', type: 'date', req: true, def: U.today() }];
    Object.keys(MN).forEach(function (k) {
      f.push({ k: k, label: MN[k] + ' (' + MU[k] + ')', type: 'number', step: 0.1 });
    });
    f.push({ k: 'note', label: '备注', full: true });
    return f;
  }

  // 运动记录渲染（供 ListPager 复用）
  function renderSportItem(x) {
    return '<div class="item"><div class="item-main">' +
      '<div class="row between"><span class="item-title">' + esc(x.type) + '</span>' +
      '<span class="badge">🔥 ' + Math.round(num(x.kcal)) + ' kcal</span></div>' +
      '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span><span class="badge grey">' + num(x.mins) + ' 分钟</span>' +
      (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div></div>' +
      UI.ops(x.id, null, 'sdel') + '</div>';
  }

  function renderMealItem(x) {
    return '<div class="item"><div class="item-main">' +
      '<div class="row between"><span class="item-title">' + esc(x.food) + '</span>' +
      '<span class="badge">🔥 ' + num(x.kcal) + ' kcal</span></div>' +
      '<div class="item-meta"><span class="badge grey">' + esc(x.slot || '餐食') + '</span>' +
      (x.amount ? '<span>' + esc(x.amount) + '</span>' : '') +
      '<span class="badge grey">📅 ' + U.fmtDate(x.date) + '</span></div></div>' +
      UI.ops(x.id, null, 'fdel') + '</div>';
  }

  var body = {
    id: 'body', icon: '🏃', name: '身体管理',

    render: function () {
      var t = App.tab('body', 'main', 'measure');
      return UI.head('🏃 身体管理', '体重围度 · 饮水 · 运动 · 饮食，四项核心，数据永久留存') +
        UI.tabs([
          { k: 'measure', t: '体重围度', i: '⚖️' }, { k: 'water', t: '饮水打卡', i: '💧' },
          { k: 'sport', t: '运动记录', i: '🏃' }, { k: 'meal', t: '饮食记录', i: '🍽' }
        ], t, 'tab') +
        '<div class="row" style="margin:6px 0 14px"><button class="btn ghost sm tap" data-act="hist">📜 历史记录</button></div>' +
        (t === 'measure' ? this.measure() : t === 'water' ? this.water() : t === 'sport' ? this.sport() : this.meal()) +
        Cal.card({
          modId: 'body', title: '📅 身体日历', sub: '数字 = 当天记录项数，点日期查看当天',
          cell: function (date) {
            var n = D().body.measures.filter(function (x) { return x.date === date; }).length;
            if (num(D().body.water[date]) > 0) n++;
            n += D().body.sports.filter(function (x) { return x.date === date; }).length;
            n += D().body.meals.filter(function (x) { return x.date === date; }).length;
            return n;
          },
          day: function (date) {
            var ms = D().body.measures.filter(function (x) { return x.date === date; });
            var w = num(D().body.water[date]);
            var sp = D().body.sports.filter(function (x) { return x.date === date; });
            var ml = D().body.meals.filter(function (x) { return x.date === date; });
            var parts = [];
            if (ms.length) parts.push('<div class="small muted" style="margin:8px 0 4px">⚖️ 体重围度</div>' + ms.map(function (x) {
              return '<div class="item"><div class="item-main"><div class="item-title">身体数据</div>' +
                '<div class="item-meta">' + (x.weight ? '<span>体重 ' + x.weight + 'kg</span>' : '') +
                (x.waist ? '<span>腰围 ' + x.waist + 'cm</span>' : '') +
                (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div></div></div>';
            }).join(''));
            if (w > 0) parts.push('<div class="small muted" style="margin:8px 0 4px">💧 饮水</div><div class="item"><div class="item-main"><div class="item-meta"><span class="badge">' + w + ' ml</span></div></div></div>');
            if (sp.length) parts.push('<div class="small muted" style="margin:8px 0 4px">🏃 运动</div>' + sp.map(function (x) {
              return '<div class="item"><div class="item-main"><div class="item-title">' + esc(x.type) + '</div>' +
                '<div class="item-meta"><span class="badge">🔥 ' + Math.round(num(x.kcal)) + ' kcal</span><span>' + num(x.mins) + ' 分钟</span></div>' +
                (x.note ? '<div class="item-note">' + esc(x.note) + '</div>' : '') + '</div></div>';
            }).join(''));
            if (ml.length) parts.push('<div class="small muted" style="margin:8px 0 4px">🍽 饮食</div>' + ml.map(function (x) {
              return '<div class="item"><div class="item-main"><div class="item-title">' + esc(x.food) + '</div>' +
                '<div class="item-meta"><span class="badge">' + num(x.kcal) + ' kcal</span>' + (x.slot ? '<span>' + esc(x.slot) + '</span>' : '') + '</div></div></div>';
            }).join(''));
            if (!parts.length) return { title: U.fmtDate(date, true) + ' · 身体管理', body: UI.empty('这一天没有身体管理记录', '🏃') };
            return { title: U.fmtDate(date, true), body: parts.join('') };
          }
        });
    },

    /* --- 体重围度 --- */
    measure: function () {
      var arr = U.sortBy(D().body.measures, 'date');
      var metric = App.tab('body', 'metric', 'weight');
      var pts = arr.filter(function (x) { return num(x[metric]) > 0; }).map(function (x) { return { t: x.date, v: num(x[metric]) }; });
      var first = pts[0], last = pts[pts.length - 1];
      var delta = first && last ? (last.v - first.v) : 0;

      return UI.stats([
        ['当前' + MN[metric], last ? last.v + '' : '—', true],
        ['累计变化', (delta > 0 ? '+' : '') + delta.toFixed(1)],
        ['记录次数', arr.length],
        ['最近记录', last ? U.fmtDate(last.t) : '—']
      ]) +
        UI.card({
          title: '📈 变化趋势', right: '<button class="btn primary sm tap" data-act="mnew">+ 记录数据</button>',
          body: UI.pills(Object.keys(MN).map(function (k) { return { k: k, t: MN[k] }; }), metric, 'metric') +
            '<div style="height:16px"></div>' + UI.line(pts, { emptyText: '记录两次以上即可生成趋势曲线' })
        }) +
        UI.card({
          title: '历史记录' + (metric === 'weight' ? '' : ' · ' + MN[metric]),
          body: (function () {
            // 仅显示当前趋势所选指标有数据的记录
            var list = U.sortBy(arr.filter(function (x) { return num(x[metric]) > 0; }), 'date', true);
            if (!list.length) return UI.empty('还没有「' + MN[metric] + '」的记录，点上方「+ 记录数据」添加吧', '📋');
            var pageRows = ListPager.slice('body:measure', list);
            var itemsHtml = pageRows.map(function (x) {
              var expanded = measureExpanded === x.id;
              if (!expanded) {
                return '<div class="item" data-act="mexp" data-id="' + x.id + '"><div class="item-main">' +
                  '<div class="row between"><span class="item-title">' + U.fmtDate(x.date, true) + '</span>' +
                  '<span class="row" style="gap:6px;align-items:center;flex-shrink:0"><span class="badge">' + num(x[metric]) + ' ' + MU[metric] + '</span>' +
                  ' <span style="font-size:11px;color:#999">▸</span></span></div>' +
                  (x.note ? '<div class="item-meta"><span>' + esc(x.note) + '</span></div>' : '') +
                  '</div></div>';
              }
              return '<div class="item open" data-act="mexp" data-id="' + x.id + '"><div class="item-main">' +
                '<div class="row between"><span class="item-title">' + U.fmtDate(x.date, true) + '</span>' +
                '<span class="row" style="gap:6px;align-items:center;flex-shrink:0"><span class="badge">' + num(x[metric]) + ' ' + MU[metric] + '</span>' +
                ' <span style="font-size:11px;color:#999">▾</span></span></div>' +
                '<div class="item-meta"><span>备注：' + esc(x.note || '—') + '</span></div>' +
                '</div>' + UI.ops(x.id, 'medit', 'mdel') + '</div>';
            }).join('');
            return '<div class="list">' + itemsHtml + '</div>' + ListPager.pager('body:measure', list.length);
          })()
        });
    },

    /* --- 饮水 --- */
    water: function () {
      var goal = num(D().body.waterGoal) || 2000;
      var cur2 = todayWater();
      var pct = goal ? cur2 / goal * 100 : 0;
      var days = Object.keys(D().body.water).sort().reverse().slice(0, 30);
      var okDays = Object.keys(D().body.water).filter(function (k) { return num(D().body.water[k]) >= goal; }).length;
      var t = U.today();
      var presets = Water.presets();
      var logHtml = Water.renderLog(t, { expanded: waterLogExpanded, act: 'wExpAll', delAct: 'wdel' });

      return UI.card({
        title: '💧 今日饮水', sub: U.fmtDate(t, true),
        right: '<button class="btn sm ghost tap" data-act="waterPreset">管理预设</button><button class="btn sm ghost tap" data-act="wgoal">目标：' + goal + ' ml</button>',
        body: '<div class="ring-wrap">' + UI.ring(pct, cur2 + '<span style="font-size:12px">ml</span>', '目标 ' + goal + ' ml') +
          '<div class="grow" style="min-width:200px">' +
          '<div class="row" style="margin-bottom:12px">' +
          (cur2 >= goal ? UI.badge('✅ 今日已达标', '') : UI.badge('还差 ' + Math.max(0, goal - cur2) + ' ml', 'warn')) +
          UI.badge('累计达标 ' + okDays + ' 天', 'grey') + '</div>' +
          '<div class="row" style="flex-wrap:wrap;gap:8px">' +
          (presets.length ? presets.map(function (n) {
            return '<button class="btn sm tap" data-act="wadd" data-n="' + n + '">+' + n + 'ml</button>';
          }).join('') : '<span class="small muted">暂无预设水量，请先「管理预设」</span>') +
          '</div>' +
          '<div class="quick-add" style="margin:12px 0 4px">' +
          '<input class="input" id="wCustom" type="number" inputmode="numeric" placeholder="自定义饮水量（可填负数，如 -200）">' +
          '<button class="btn primary tap" data-act="wcustom">添加</button></div>' +
          '<div class="small muted" style="margin:4px 0 4px">今日喝水明细（同步到首页记喝水）</div>' +
          logHtml +
          '</div></div>'
      }) +
        UI.card({
          title: '近期打卡',
          body: (days.length ?
            '<div class="list">' + ListPager.slice('body:water', days).map(function (k) {
              var v = num(D().body.water[k]), p = goal ? v / goal * 100 : 0;
              return '<div class="item"><div class="item-main">' +
                '<div class="row between"><span class="item-title">' + U.fmtDate(k, true) + '</span>' +
                '<span class="badge' + (v >= goal ? '' : ' grey') + '">' + v + ' / ' + goal + ' ml' + (v >= goal ? ' ✅' : '') + '</span></div>' +
                '<div style="margin-top:8px">' + UI.bar(p, true) + '</div></div></div>';
            }).join('') + '</div>' + ListPager.pager('body:water', days.length) :
            UI.empty('今天喝了多少水？点上面按钮记一下', '💧'))
        });
    },

    /* --- 运动 --- */
    sport: function () {
      var arr = U.sortBy(D().body.sports, 'date', true);
      var t0 = U.today();
      var todayKcal = arr.filter(function (x) { return x.date === t0; }).reduce(function (s, x) { return s + num(x.kcal); }, 0);
      var w0 = U.shiftDay(t0, -6);
      var wk = arr.filter(function (x) { return x.date >= w0; });
      return UI.stats([
        ['今日消耗', Math.round(todayKcal) + ' kcal', true],
        ['近 7 天次数', wk.length],
        ['近 7 天时长', wk.reduce(function (s, x) { return s + num(x.mins); }, 0) + ' 分钟'],
        ['累计次数', arr.length]
      ]) +
        UI.card({
          title: '🏃 运动记录', sub: '按体重自动估算消耗',
          right: '<button class="btn primary sm tap" data-act="snew">+ 添加运动</button>',
          body: ListPager.out({ ns: 'body:sport', items: arr, defSize: 5, empty: '今天动一动了吗？', emptyIcon: '🏃', render: renderSportItem })
        });
    },

    /* --- 饮食 --- */
    meal: function () {
      var d = App.tab('body', 'mday', U.today());
      var all = D().body.meals.filter(function (x) { return x.date === d; });
      var intake = all.reduce(function (s, x) { return s + num(x.kcal); }, 0);
      var sport = D().body.sports.filter(function (x) { return x.date === d; }).reduce(function (s, x) { return s + num(x.kcal); }, 0);
      var burn = bmr() + sport;
      var gap = burn - intake;
      var slotOrder = { '早餐': 0, '午餐': 1, '晚餐': 2, '加餐': 3 };
      var items = all.slice().sort(function (a, b) {
        return (slotOrder[a.slot] || 9) - (slotOrder[b.slot] || 9);
      });

      return UI.card({
        title: '🍽 当日热量', sub: U.fmtDate(d, true),
        right: '<div class="row"><button class="btn sm ghost tap" data-act="mprev">‹</button>' +
          '<button class="btn sm ghost tap" data-act="mnext"' + (d >= U.today() ? ' disabled' : '') + '>›</button>' +
          '<button class="btn primary sm tap" data-act="fnew">+ 记录餐食</button></div>',
        body: UI.stats([
          ['摄入', Math.round(intake) + ' kcal'],
          ['消耗（基代+运动）', Math.round(burn) + ' kcal'],
          [gap >= 0 ? '热量缺口' : '热量盈余', (gap >= 0 ? '-' : '+') + Math.round(Math.abs(gap)) + ' kcal', true],
          ['基础代谢', bmr() + ' kcal']
        ]) +
          '<div class="small muted" style="margin-top:12px">基础代谢默认按体重 × 22 估算，可在 ⚙️ 设置中自定义。运动消耗自动取当日运动记录。</div>' +
          '<div style="height:18px"></div>' +
          ListPager.out({ ns: 'body:meal', items: items, defSize: 5, empty: '记录今天吃了什么，自动核算摄入热量', emptyIcon: '🍽', render: renderMealItem })
      });
    },

    acts: {
      tab: function (t) { App.setTab('body', 'main', t.dataset.k); App.refresh(); },
      metric: function (t) { App.setTab('body', 'metric', t.dataset.k); ListPager.resetPg('body:measure'); measureExpanded = null; App.refresh(); },
      mexp: function (t) { measureExpanded = measureExpanded === t.dataset.id ? null : t.dataset.id; App.refresh(); },

      mnew: function () {
        var m = mMetric();
        UI.form({
          title: '记录' + MN[m],
          desc: '当前趋势：' + MN[m] + '，只需填这一项即可',
          values: { date: U.today() },
          fields: mFields(m)
        }).then(function (v) {
          if (!v) return;
          var ex = D().body.measures.filter(function (x) { return x.date === v.date; })[0];
          if (ex) { Object.keys(v).forEach(function (k) { if (v[k] !== '' || k === 'date') ex[k] = v[k]; }); }
          else { v.id = U.uid();           D().body.measures.push(v); }
          Store.save(); ListPager.resetPg('body:measure'); App.refresh(); U.toast('已记录' + MN[m]);
        });
      },
      medit: function (t) {
        var x = D().body.measures.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        UI.form({
          title: '编辑身体数据',
          desc: '可修改任意字段（日期 / 各项围度 / 备注），保存后更新这条记录',
          values: x,
          fields: mFieldsAll()
        }).then(function (v) {
          if (!v) return;
          Object.keys(v).forEach(function (k) { x[k] = v[k]; });
          Store.save(); App.refresh(); U.toast('已更新');
        });
      },
      mdel: function (t) {
        var x = D().body.measures.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        UI.confirm('删除这条身体记录？', U.fmtDate(x.date) + (x.note ? ' · ' + x.note : '') + '，删除后不可恢复。', '删除', true).then(function (ok) {
          if (!ok) return;
          D().body.measures = D().body.measures.filter(function (a) { return a.id !== t.dataset.id; });
          Store.save(); ListPager.resetPg('body:measure'); App.refresh(); U.toast('已删除');
        });
      },

      wadd: function (t) {
        Water.add(U.today(), num(t.dataset.n));
        App.refresh();
      },
      wcustom: function () {
        var inp = document.getElementById('wCustom');
        var v = num(inp ? inp.value : '');
        if (!inp || !inp.value.trim() || v === 0) { U.toast('请输入本次水量'); if (inp) inp.focus(); return; }
        Water.add(U.today(), v);
        U.toast((v < 0 ? '已减少 ' : '已记录 +') + Math.abs(v) + ' ml');
        App.refresh();
      },
      wdel: function (t) {
        Water.del(U.today(), t.dataset.id);
        App.refresh();
      },
      wExpAll: function () {
        waterLogExpanded = !waterLogExpanded;
        App.refresh();
      },
      waterPreset: function () {
        var arr = Water.presets().slice();
        function render() {
          var rows = arr.length
            ? '<div class="water-preset-list" style="display:flex;flex-direction:column;gap:8px;margin:10px 0">' +
              arr.map(function (n, i) {
                return '<div class="row between" style="padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--cream-soft)">' +
                  '<span style="font-weight:600;color:var(--olive-darker)">' + n + ' ml</span>' +
                  '<span class="row" style="gap:6px">' +
                  '<button class="link-btn tap" data-act="wpUp" data-i="' + i + '">↑</button>' +
                  '<button class="link-btn tap" data-act="wpDown" data-i="' + i + '">↓</button>' +
                  '<button class="link-btn tap del" data-act="wpDel" data-i="' + i + '">删除</button>' +
                  '</span></div>';
              }).join('') + '</div>'
            : '<div class="small muted" style="margin:10px 0">还没有预设水量</div>';
          return '<div>' +
            '<div class="quick-add" style="margin-bottom:6px">' +
            '<input class="input" id="wpNew" type="number" inputmode="numeric" placeholder="例如 225">' +
            '<button class="btn primary tap" data-act="wpAdd">添加</button></div>' +
            '<div class="small muted" style="margin-bottom:8px">预设会同时出现在首页「记喝水」快捷胶囊</div>' +
            rows + '</div>';
        }
        var el = UI.sheet('💧 管理喝水量预设', render(), '<button class="btn ghost tap" data-x>完成</button>');
        el.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-x]')) { el.remove(); UI.unlock(); return; }
          var add = ev.target.closest('[data-act="wpAdd"]');
          if (add) {
            ev.stopPropagation();
            var inp = el.querySelector('#wpNew');
            var v = num(inp.value);
            if (!inp.value.trim() || v <= 0 || v > 2000) { U.toast('请输入 1–2000 ml 的正整数'); inp.focus(); return; }
            if (arr.indexOf(v) >= 0) { U.toast('该水量已存在'); inp.focus(); return; }
            arr.push(v);
            Water.setPresets(arr);
            el.querySelector('.modal-body').innerHTML = render();
            return;
          }
          var del = ev.target.closest('[data-act="wpDel"]');
          if (del) {
            ev.stopPropagation();
            var idx = num(del.dataset.i);
            arr.splice(idx, 1);
            Water.setPresets(arr);
            el.querySelector('.modal-body').innerHTML = render();
            return;
          }
          var up = ev.target.closest('[data-act="wpUp"]');
          if (up) {
            ev.stopPropagation();
            var i2 = num(up.dataset.i);
            if (i2 > 0) { var tmp = arr[i2]; arr[i2] = arr[i2 - 1]; arr[i2 - 1] = tmp; Water.setPresets(arr); }
            el.querySelector('.modal-body').innerHTML = render();
            return;
          }
          var down = ev.target.closest('[data-act="wpDown"]');
          if (down) {
            ev.stopPropagation();
            var i3 = num(down.dataset.i);
            if (i3 < arr.length - 1) { var tmp2 = arr[i3]; arr[i3] = arr[i3 + 1]; arr[i3 + 1] = tmp2; Water.setPresets(arr); }
            el.querySelector('.modal-body').innerHTML = render();
            return;
          }
        });
      },
      wset: function () {
        UI.form({
          title: '今日饮水量', values: { v: todayWater() },
          fields: [{ k: 'v', label: '已喝水量 (ml)', type: 'number', min: 0, req: true, full: true }]
        }).then(function (r) {
          if (!r) return; D().body.water[U.today()] = num(r.v); Store.save(); App.refresh();
        });
      },
      wgoal: function () {
        UI.form({
          title: '设置每日目标', values: { g: num(D().body.waterGoal) || 2000 },
          fields: [{ k: 'g', label: '每日目标饮水量 (ml)', type: 'number', min: 200, req: true, full: true, hint: '常见建议 1500 - 2500 ml' }]
        }).then(function (r) {
          if (!r) return; D().body.waterGoal = num(r.g); Store.save(); App.refresh();
        });
      },

      snew: function () {
        UI.form({
          title: '添加运动', values: { date: U.today() }, fields: [
            { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
            { k: 'type', label: '运动类型', type: 'select', options: Object.keys(MET), def: '快走' },
            { k: 'mins', label: '时长（分钟）', type: 'number', min: 1, req: true },
            { k: 'kcal', label: '消耗热量 (kcal)', type: 'number', min: 0, hint: '留空自动按体重估算' },
            { k: 'note', label: '备注', full: true }
          ]
        }).then(function (v) {
          if (!v) return;
          if (v.kcal === '' || !num(v.kcal)) {
            v.kcal = Math.round((MET[v.type] || 4.5) * lastWeight() * num(v.mins) / 60);
          }
          v.id = U.uid();           D().body.sports.push(v); Store.save(); ListPager.resetPg('body:sport'); App.refresh();
          U.toast('已记录，约消耗 ' + v.kcal + ' kcal');
        });
      },
      sdel: function (t) {
        D().body.sports = D().body.sports.filter(function (a) { return a.id !== t.dataset.id; });
        Store.save(); ListPager.resetPg('body:sport'); App.refresh(); U.toast('已删除');
      },

      mprev: function () { App.setTab('body', 'mday', U.shiftDay(App.tab('body', 'mday', U.today()), -1)); ListPager.resetPg('body:meal'); App.refresh(); },
      mnext: function () {
        var d = App.tab('body', 'mday', U.today());
        if (d < U.today()) { App.setTab('body', 'mday', U.shiftDay(d, 1)); ListPager.resetPg('body:meal'); App.refresh(); }
      },
      fnew: function () {
        var d = App.tab('body', 'mday', U.today());
        UI.form({
          title: '记录餐食', values: { date: d }, fields: [
            { k: 'date', label: '日期', type: 'date', req: true, def: d },
            { k: 'slot', label: '餐次', type: 'select', options: ['早餐', '午餐', '晚餐', '加餐'], def: '早餐' },
            { k: 'food', label: '食物 / 菜品', req: true, full: true, ph: '如：鸡胸肉 + 西兰花' },
            { k: 'amount', label: '分量', ph: '如：150g / 一碗' },
            { k: 'kcal', label: '热量 (kcal)', type: 'number', min: 0, req: true }
          ]
        }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().body.meals.push(v); Store.save(); ListPager.resetPg('body:meal'); App.refresh();
        });
      },
      fdel: function (t) {
        D().body.meals = D().body.meals.filter(function (a) { return a.id !== t.dataset.id; });
        Store.save(); ListPager.resetPg('body:meal'); App.refresh();
      },
      calPrev: function (t) { Cal.act(t); },
      calNext: function (t) { Cal.act(t); },
      calToday: function (t) { Cal.act(t); },
      calDay: function (t) { Cal.act(t); },
      hist: function () {
        Hist.open({
          modId: 'body',
          title: '🏃 身体管理历史记录',
          searchPh: '🔍 搜索备注 / 运动类型 / 食物…',
          pager: true,
          items: function () {
            var a = [];
            (D().body.measures || []).forEach(function (x) { a.push({ k: 'measure', x: x }); });
            (D().body.sports || []).forEach(function (x) { a.push({ k: 'sport', x: x }); });
            var w = D().body.water || {};
            Object.keys(w).forEach(function (d) { if (num(w[d]) > 0) a.push({ k: 'water', x: { date: d, v: num(w[d]) } }); });
            (D().body.meals || []).forEach(function (x) { a.push({ k: 'meal', x: x }); });
            return a;
          },
          date: function (it) { return it.x.date; },
          match: function (it, q) {
            var x = it.x;
            var hay = it.k === 'measure' ? (x.note || '') :
              it.k === 'sport' ? (x.type + ' ' + (x.note || '')) :
              it.k === 'meal' ? (x.food + ' ' + (x.slot || '')) : ('饮水 ' + x.v + 'ml');
            return hay.toLowerCase().indexOf(q) >= 0;
          },
          sort: function (a, b) { return String(b.x.date).localeCompare(String(a.x.date)); },
          render: function (it) {
            var x = it.x;
            if (it.k === 'measure') {
              var m = App.tab('body', 'metric', 'weight');
              return '<div class="item"><div class="item-main">' +
                '<div class="item-title">⚖️ 身体数据' + (x[m] ? ' · ' + num(x[m]) + ' ' + MU[m] : '') + '</div>' +
                '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span>' +
                (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div></div>' +
                UI.ops(x.id, null, 'hdel') + '</div>';
            } else if (it.k === 'sport') {
              return '<div class="item"><div class="item-main">' +
                '<div class="row between"><span class="item-title">🏃 ' + esc(x.type) + '</span><span class="badge">🔥 ' + Math.round(num(x.kcal)) + ' kcal</span></div>' +
                '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span><span class="badge grey">' + num(x.mins) + ' 分钟</span>' +
                (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div></div>' +
                UI.ops(x.id, null, 'hdel') + '</div>';
            } else if (it.k === 'water') {
              return '<div class="item"><div class="item-main">' +
                '<div class="row between"><span class="item-title">💧 饮水记录</span><span class="badge">' + x.v + ' ml</span></div>' +
                '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span></div></div>' +
                UI.ops(x.id, null, 'hdel') + '</div>';
            } else {
              return '<div class="item"><div class="item-main">' +
                '<div class="row between"><span class="item-title">🍽 ' + esc(x.food) + '</span><span class="badge">' + num(x.kcal) + ' kcal</span></div>' +
                '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span>' +
                (x.slot ? '<span class="badge grey">' + esc(x.slot) + '</span>' : '') + '</div></div>' +
                UI.ops(x.id, null, 'hdel') + '</div>';
            }
          },
          acts: {
            hdel: function (t, e, redraw) {
              var it = compute().filter(function (a) { return a.x && a.x.id === t.dataset.id; })[0];
              if (!it) return;
              var label = it.k === 'sport' ? esc(it.x.type || '运动') :
                it.k === 'meal' ? esc(it.x.food || '餐食') :
                it.k === 'water' ? '饮水记录' : '身体数据';
              UI.del(label, function () {
                if (it.k === 'measure') D().body.measures = D().body.measures.filter(function (a) { return a.id !== it.x.id; });
                else if (it.k === 'sport') D().body.sports = D().body.sports.filter(function (a) { return a.id !== it.x.id; });
                else if (it.k === 'meal') D().body.meals = D().body.meals.filter(function (a) { return a.id !== it.x.id; });
                else if (it.k === 'water') { var w = D().body.water || {}; delete w[it.x.date]; D().body.water = w; }
                Store.save();
                if (redraw) redraw();
              });
            }
          }
        });
      }
    },

    mount: function () {}
  };
  App.register(body);

  /* =========================================================
     6. 🗄 物品管理
  ========================================================= */
  var CONSUM_PRESET = [
    { n: '隐形眼镜', d: 30 }, { n: '内衣裤', d: 90 }, { n: '电动牙刷头', d: 90 },
    { n: '美妆粉扑', d: 30 }, { n: '洗脸巾', d: 60 }, { n: '毛巾', d: 90 },
    { n: '枕套床品', d: 14 }, { n: '空气滤芯', d: 180 }, { n: '净水滤芯', d: 180 }
  ];

  var stockFilter = '';      // 分类筛选
  var stockWarnOnly = false; // 只看预警
  var stockExpanded = null;  // 当前展开的物品 id
  var measureExpanded = null; // 当前展开的体重记录 id
  // 库存排序维度（与历史记录一致：点同一键在高→低 / 低→高之间切换）
  var stockSortKeys = [
    { k: 'qty', t: '按数量', get: function (x) { return num(x.left); } },
    { k: 'buy', t: '按补充时间', get: function (x) { return lastBuyDate(x) || ''; } },
    { k: 'pct', t: '按剩余占比', get: function (x) { return pctOf(x); } }
  ];

  // 采购项渲染（供 ListPager 复用）
  function renderBuyItem(x) {
    var done = x.done;
    var priceTxt = num(x.price) ? U.money(num(x.price)) : '';
    var qtyTxt = (num(x.qty) && num(x.qty) !== 1) ? num(x.qty) + ' 件' : '';
    var meta = (qtyTxt ? '<span class="badge grey">' + esc(qtyTxt) + '</span>' : '') +
      (priceTxt ? '<span class="badge">' + esc(priceTxt) + '</span>' : '') +
      (x.note ? '<span>' + esc(x.note) + '</span>' : '');
    return '<div class="item clickable' + (done ? ' done' : '') + '" data-toggle>' +
      '<div class="item-check"><button class="check tap' + (done ? ' on' : '') + '" data-act="btoggle" data-id="' + x.id + '">' + (done ? '✓' : '') + '</button></div>' +
      '<div class="item-main">' +
      '<div class="item-title' + (done ? ' strike' : '') + '">' + esc(x.name) + '</div>' +
      '</div>' +
      '<div class="item-detail"><div class="item-meta">' + meta + '</div>' + UI.ops(x.id, 'bedit', 'bdel') + '</div></div>';
  }

  // 耗材渲染（供 ListPager 复用）
  function renderConsumItem(x) {
    var d = dueDays(x);
    var dueCls = d <= 0 ? 'danger' : d <= 7 ? 'warn' : 'grey';
    var dueTxt = d <= 0 ? '已到期 ' + Math.abs(d) + ' 天' : '剩 ' + d + ' 天';
    var open = x.open, cycle = num(x.cycle) || 1;
    var elapsed = U.dayDiff(open, U.today());
    var pct = Math.max(0, Math.min(100, Math.round(elapsed / cycle * 100)));
    var renewBtn = '<button class="link-btn tap" data-act="crenew" data-id="' + x.id + '">🔄 换新</button>';
    var detail = '<div class="item-meta"><span>开封 ' + U.fmtDate(open) + '</span><span class="badge grey">周期 ' + cycle + ' 天</span>' +
      (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div>' +
      '<div style="margin:8px 0">' + UI.bar(pct) + '</div>';
    return '<div class="item clickable" data-toggle><div class="item-main">' +
      '<div class="row between"><span class="item-title">🔔 ' + esc(x.name) + '</span><span class="badge ' + dueCls + '">📅 ' + dueTxt + '</span></div>' +
      '</div>' +
      '<div class="item-detail">' + detail + UI.ops(x.id, 'cedit', 'cdel', renewBtn) + '</div></div>';
  }

  var items = {
    id: 'items', icon: '🗄', name: '物品管理',

    render: function () {
      var t = App.tab('items', 'main', 'stock');
      var soon = D().items.consum.filter(function (x) { return dueDays(x) <= 7; }).length;
      return UI.head('🗄 物品管理', '库存余量 · 采购清单 · 耗材更换提醒') +
        UI.tabs([
          { k: 'stock', t: '物品库存', i: '📦' },
          { k: 'buy', t: '采购清单', i: '🛒' },
          { k: 'consum', t: '更换提醒' + (soon ? ' ' + soon : ''), i: '🔔' }
        ], t, 'tab') +
        (t === 'stock' ? this.stock() : t === 'buy' ? this.buy() : this.consum());
    },

    stock: function () {
      var all = D().items.stock || [];
      var cats = Cats.get('itemCats');
      var filter = stockFilter && cats.indexOf(stockFilter) >= 0 ? stockFilter : '';
      var lowCount = all.filter(isLow).length;
      var cur = ListPager.getSort('items:stock');
      var sk = stockSortKeys.filter(function (s) { return s.k === cur.key; })[0] || stockSortKeys[0];
      var dirN = cur.dir === 'desc' ? -1 : 1;
      var list = all.slice().sort(function (a, b) {
        var va = sk.get(a), vb = sk.get(b);
        if (va < vb) return -1 * dirN;
        if (va > vb) return 1 * dirN;
        return 0;
      });
      if (filter) list = list.filter(function (x) { return x.cat === filter; });
      if (stockWarnOnly) list = list.filter(isLow);
      var chip = function (label, val) {
        return '<button class="chip tap' + (filter === val ? ' on' : '') + '" data-act="kfilter" data-cat="' + esc(val) + '">' + esc(label) + '</button>';
      };
      var chips = '<div class="chip-row" style="margin:2px 0 10px">' + chip('全部', '') +
        cats.map(function (c) { return chip(c, c); }).join('') + '</div>';
      var toolbar = '<div class="stock-toolbar">' +
        ListPager.sortPills('items:stock', stockSortKeys) +
        '<button class="chip tap' + (stockWarnOnly ? ' on danger' : '') + '" data-act="kwarn">' + (stockWarnOnly ? '🔔 仅看预警' : '🔔 只看预警') + '</button>' +
        '</div>';
      var pageRows = all.length ? ListPager.slice('items:stock', list) : [];
      var pagerHtml = list.length ? ListPager.pager('items:stock', list.length) : '';
      var body = chips + toolbar + (all.length ? '<div class="stock-ov">' + pageRows.map(function (x) {
        x = normItem(x);
        var pct = pctOf(x);
        var low = isLow(x);
        var unit = x.uname && x.uname !== '%' ? x.uname : '%';
        var un = x.uname && x.uname !== '%' ? ' ' + esc(x.uname) : '';
        var expanded = stockExpanded === x.id;
        var row = '<div class="stock-ov-row' + (low ? ' low' : '') + (expanded ? ' open' : '') + '" data-act="kexp" data-id="' + x.id + '">' +
          '<span class="stock-ov-name">' + esc(x.name) + (x.cat ? ' <span class="badge grey">' + esc(x.cat) + '</span>' : '') + (low ? ' <span class="badge danger">预警</span>' : '') + '</span>' +
          '<span class="stock-ov-bar">' + UI.bar(pct, low) + '</span>' +
          '<span class="stock-ov-num">' + num(x.left) + ' / ' + num(x.qty) + un + '</span>' +
          '<span class="stock-ov-caret">' + (expanded ? '▾' : '▸') + '</span>' +
          '</div>';
        if (expanded) {
          var logs = (x.logs || []);
          var buys = (x.buys || []);
          // 使用记录：一行一行显示，最多 3 条
          var useHtml = logs.length ? '<div class="buy-list">' + logs.slice(-3).reverse().map(function (l) {
            return '<div class="buy-row"><span>' + U.fmtDate(l.d) + '</span><span>用 ' + num(l.v) + un + '</span><span></span></div>';
          }).join('') + '</div>' : '<div class="small muted">暂无使用记录</div>';
          // 购买补充记录：一行一行显示，最多 3 条
          var buyHtml = buys.length ? '<div class="buy-list">' + buys.slice(-3).reverse().map(function (b) {
            return '<div class="buy-row"><span>' + U.fmtDate(b.d) + '</span><span>补充 ' + num(b.qty) + un + '</span><span>' + (num(b.price) ? U.money(b.price) : '—') + '</span></div>';
          }).join('') + '</div>' : '<div class="small muted">暂无购买补充记录</div>';
          // 任一记录超过 3 条时显示「更多」，点击弹出新窗口查看全部记录
          var moreBtn = (logs.length > 3 || buys.length > 3) ?
            '<button class="link-btn tap" data-act="kmore" data-id="' + x.id + '">更多 ▾</button>' : '';
          row += '<div class="stock-ov-detail">' +
            '<div class="stock-ov-ops">' +
              '<button class="link-btn tap" data-act="kuse" data-id="' + x.id + '">📉 记使用</button>' +
              '<button class="link-btn tap" data-act="ksup" data-id="' + x.id + '">📥 补充</button>' +
              '<button class="link-btn tap" data-act="kedit" data-id="' + x.id + '">✏️ 编辑</button>' +
              '<button class="link-btn del tap" data-act="kdel" data-id="' + x.id + '">🗑 删除</button>' +
            '</div>' +
            '<div class="rec-sec"><strong class="rec-h">使用记录</strong>' + useHtml + '</div>' +
            '<div class="rec-sec"><strong class="rec-h">购买补充记录</strong>' + buyHtml + '</div>' +
            (moreBtn ? '<div class="rec-more">' + moreBtn + '</div>' : '') +
            '</div>';
        }
        return row;
      }).join('') + '</div>' + pagerHtml : UI.empty('还没有物品，先添加一件吧', '📦'));
      return UI.card({
        title: '📋 库存总览',
        sub: '共 ' + all.length + ' 件 · 预警 ' + lowCount + ' 件' + (filter ? ' · ' + filter : '') + (stockWarnOnly ? ' · 仅预警' : ''),
        right: Cats.btn('itemCats', '物品分类') +
          '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button>' +
          '<button class="btn primary sm tap" data-act="knew">+ 添加物品</button>',
        body: body
      });
    },

    buy: function () {
      var arr = D().items.buy;
      var undone = arr.filter(function (x) { return !x.done; }), done = arr.filter(function (x) { return x.done; });
      var cost = undone.reduce(function (s, x) { return s + num(x.price) * (num(x.qty) || 1); }, 0);
      return UI.card({
        title: '🛒 采购清单', sub: '待购 ' + undone.length + ' 件 · 预计 ' + U.money(cost) + (Math.abs(cost) >= 1e4 ? '（' + U.moneyFull(cost) + '）' : ''),
        right: (done.length ? '<button class="link-btn tap" data-act="bclear">清除已购 (' + done.length + ')</button>' : '') +
          '<button class="btn primary sm tap" data-act="bnew">+ 添加</button>',
        body:           '<div class="quick-add" style="margin-bottom:16px">' +
          '<input class="input" id="bq" placeholder="要买什么？回车快速添加" data-enter="bquick">' +
          '<button class="btn primary tap" data-act="bquick">添加</button></div>' +
          ListPager.out({ ns: 'items:buy', items: arr.length ? undone.concat(done) : [], defSize: 5, empty: '想买的东西先记下来，逛街不忘事', emptyIcon: '🛒', render: renderBuyItem })
      });
    },

    consum: function () {
      var arr = D().items.consum.slice().sort(function (a, b) { return dueDays(a) - dueDays(b); });
      return UI.card({
        title: '🔔 耗材更换提醒', sub: '临近到期自动提醒',
        right: '<button class="btn primary sm tap" data-act="cnew">+ 添加耗材</button>',
        body: ListPager.out({ ns: 'items:consum', items: arr, defSize: 5, empty: '隐形眼镜、牙刷头、粉扑…按时更换更安心', emptyIcon: '🔔', render: renderConsumItem })
      });
    },

    acts: {
      tab: function (t) { App.setTab('items', 'main', t.dataset.k); App.refresh(); },
      kfilter: function (t) { stockFilter = t.dataset.cat || ''; stockExpanded = null; ListPager.resetPg('items:stock'); App.refresh(); },
      kexp: function (t) { var id = t.dataset.id; stockExpanded = stockExpanded === id ? null : id; App.refresh(); },
      kwarn: function () { stockWarnOnly = !stockWarnOnly; stockExpanded = null; ListPager.resetPg('items:stock'); App.refresh(); },
      kmore: function (t) {
        var x = D().items.stock.filter(function (a) { return a.id === t.dataset.id; })[0];
        x = normItem(x);
        var un = x.uname && x.uname !== '%' ? ' ' + esc(x.uname) : '';
        var useRows = (x.logs || []).slice().reverse().map(function (l) {
          return '<div class="buy-row"><span>' + U.fmtDate(l.d) + '</span><span>用 ' + num(l.v) + un + '</span><span></span></div>';
        });
        var buyRows = (x.buys || []).slice().reverse().map(function (b) {
          return '<div class="buy-row"><span>' + U.fmtDate(b.d) + '</span><span>补充 ' + num(b.qty) + un + '</span><span>' + (num(b.price) ? U.money(b.price) : '—') + '</span></div>';
        });
        var sec = function (title, rows, empty) {
          return '<div class="rec-sec"><strong class="rec-h">' + title + '（共 ' + rows.length + ' 条）</strong>' +
            (rows.length ? '<div class="buy-list">' + rows.join('') + '</div>' : '<div class="small muted">' + empty + '</div>') + '</div>';
        };
        var html = sec('使用记录', useRows, '暂无使用记录') + sec('购买补充记录', buyRows, '暂无购买补充记录');
        UI.sheet(esc(x.name) + ' · 全部记录', html);
      },

      knew: function () {
        UI.form({ title: '添加物品', values: { buyDate: U.today(), qty: 1, left: 1 }, fields: stockFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.logs = [];
          if (v.left == null || v.left === '') v.left = num(v.qty);
          v.buys = [{ d: v.buyDate || U.today(), qty: num(v.qty), price: num(v.price) || 0 }];
          D().items.stock.push(v); Store.save(); App.refresh();
        });
      },
      kedit: function (t) {
        var x = D().items.stock.filter(function (a) { return a.id === t.dataset.id; })[0];
        x = normItem(x);
        UI.form({ title: '编辑物品', values: x, fields: stockFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      kuse: function (t) {
        var x = D().items.stock.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        x = normItem(x);
        var un = x.uname && x.uname !== '%' ? x.uname : '%';
        UI.form({
          title: '记录使用 · ' + x.name,
          desc: '当前剩余 ' + num(x.left) + ' / ' + num(x.qty) + (un !== '%' ? ' ' + un : '') + '（约 ' + pctOf(x) + '%）',
          values: { v: 1, d: U.today() },
          fields: [
            { k: 'v', label: '本次消耗数量' + (un !== '%' ? '（' + un + '）' : '（%）'), type: 'number', min: 0, req: true, quick: [1, 2, 5, 10], quickUnit: un !== '%' ? un : '' },
            { k: 'd', label: '日期', type: 'date', def: U.today() }
          ]
        }).then(function (r) {
          if (!r) return;
          var v = num(r.v);
          x.left = Math.max(0, num(x.left) - v);
          (x.logs = x.logs || []).push({ d: r.d, v: v });
          Store.save(); App.refresh();
          if (isLow(x)) U.toast('「' + x.name + '」已低于预警线，记得补货');
        });
      },
      kdel: function (t) {
        var x = D().items.stock.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { D().items.stock = D().items.stock.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      },
      ksup: function (t) {
        var x = D().items.stock.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return; x = normItem(x);
        var un = x.uname && x.uname !== '%' ? x.uname : '';
        UI.form({
          title: '补充库存 · ' + x.name,
          desc: '当前剩余 ' + num(x.left) + ' / ' + num(x.qty) + (un ? ' ' + un : '') + '（约 ' + pctOf(x) + '%）',
          values: { d: U.today(), qty: 1, price: '' },
          fields: [
            { k: 'qty', label: '本次补充数量' + (un ? '（' + un + '）' : '（个）'), type: 'number', min: 0, req: true, def: 1 },
            { k: 'price', label: '补充花费（选填）', type: 'number', min: 0, hint: '留空不记录花费' },
            { k: 'd', label: '日期', type: 'date', def: U.today() }
          ]
        }).then(function (r) {
          if (!r) return;
          var add = num(r.qty);
          x.qty = num(x.qty) + add;
          x.left = num(x.left) + add;
          (x.buys = x.buys || []).push({ d: r.d, qty: add, price: num(r.price) || 0 });
          Store.save(); App.refresh();
          U.toast('已补充 ' + add + (un ? ' ' + un : '') + '「' + x.name + '」');
        });
      },

      bquick: function () {
        var i = document.getElementById('bq'), v = i.value.trim();
        if (!v) { i.focus(); return; }
        D().items.buy.push({ id: U.uid(), name: v, qty: 1, price: '', done: false });
        Store.save(); i.value = ''; App.refresh();
        setTimeout(function () { var n = document.getElementById('bq'); if (n) n.focus(); }, 30);
      },
      bnew: function () {
        UI.form({ title: '添加采购项', fields: buyFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.done = false; D().items.buy.push(v); Store.save(); App.refresh();
        });
      },
      bedit: function (t) {
        var x = D().items.buy.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑采购项', values: x, fields: buyFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      btoggle: function (t) {
        D().items.buy.forEach(function (x) { if (x.id === t.dataset.id) x.done = !x.done; });
        Store.save(); App.refresh();
      },
      bdel: function (t) {
        D().items.buy = D().items.buy.filter(function (a) { return a.id !== t.dataset.id; });
        Store.save(); App.refresh();
      },
      bclear: function () {
        D().items.buy = D().items.buy.filter(function (x) { return !x.done; });
        Store.save(); App.refresh(); U.toast('已清除');
      },

      cnew: function () {
        UI.form({ title: '添加耗材', values: { open: U.today(), cycle: 30 }, fields: consumFields() }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.history = []; D().items.consum.push(v); Store.save(); App.refresh();
        });
      },
      cedit: function (t) {
        var x = D().items.consum.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑耗材', values: x, fields: consumFields() }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      crenew: function (t) {
        var x = D().items.consum.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.confirm('确认已更换「' + x.name + '」？', '会把开封日期重置为今天，并记录一次换新。', '确认换新').then(function (ok) {
          if (!ok) return;
          (x.history = x.history || []).push(U.today());
          x.open = U.today(); Store.save(); App.refresh(); U.toast('已记录换新 ✅');
        });
      },
      cdel: function (t) {
        var x = D().items.consum.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { D().items.consum = D().items.consum.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      },
      hist: function () {
        Hist.open({
          modId: 'items',
          title: '🗄 物品历史记录',
          searchPh: '🔍 搜索物品名 / 分类 / 备注…',
          pager: true,
          items: function () {
            var a = [];
            (D().items.stock || []).forEach(function (x) { a.push({ k: 'stock', x: normItem(x) }); });
            (D().items.consum || []).forEach(function (x) { a.push({ k: 'consum', x: x }); });
            return a;
          },
          date: function (it) { return it.k === 'stock' ? (lastBuyDate(it.x) || '') : it.x.open; },
          match: function (it, q) {
            var x = it.x;
            return ((x.name || '') + ' ' + (x.cat || '') + ' ' + (x.note || '')).toLowerCase().indexOf(q) >= 0;
          },
          sort: function (a, b) {
            var da = a.k === 'stock' ? (lastBuyDate(a.x) || '') : a.x.open;
            var db = b.k === 'stock' ? (lastBuyDate(b.x) || '') : b.x.open;
            return String(db).localeCompare(String(da));
          },
          render: function (it) {
            var x = it.x;
            if (it.k === 'stock') {
              var un = x.uname && x.uname !== '%' ? x.uname : '';
              var detail = '<div class="item-meta"><span>购入 ' + U.fmtDate(lastBuyDate(x)) + '</span>' +
                '<span class="badge grey">余 ' + num(x.left) + '/' + num(x.qty) + (un ? un : '') + '</span>' +
                (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</div>';
              return '<div class="item clickable" data-toggle><div class="item-main">' +
                '<div class="item-title">' + esc(x.name) + (x.cat ? ' <span class="badge grey">' + esc(x.cat) + '</span>' : '') + (isLow(x) ? ' <span class="badge danger">预警</span>' : '') + '</div>' +
                '</div>' +
                '<div class="item-detail">' + detail + UI.ops(x.id, null, 'hdel') + '</div></div>';
            } else {
              var cdetail = '<div class="item-meta"><span>开封 ' + U.fmtDate(x.open) + '</span><span class="badge grey">周期 ' + num(x.cycle) + ' 天</span></div>';
              return '<div class="item clickable" data-toggle><div class="item-main">' +
                '<div class="item-title">🔔 ' + esc(x.name) + '</div>' +
                '</div>' +
                '<div class="item-detail">' + cdetail + UI.ops(x.id, null, 'hdel') + '</div></div>';
            }
          },
          acts: {
            hdel: function (t, e, redraw) {
              var it = compute().filter(function (a) { return a.x && a.x.id === t.dataset.id; })[0];
              if (!it) return;
              UI.del(esc(it.x.name || ''), function () {
                if (it.k === 'stock') D().items.stock = D().items.stock.filter(function (a) { return a.id !== it.x.id; });
                else D().items.consum = D().items.consum.filter(function (a) { return a.id !== it.x.id; });
                Store.save();
                if (redraw) redraw();
              });
            }
          }
        });
      }
    },

    mount: function () {}
  };

  function dueDays(x) { return U.dayDiff(U.today(), U.shiftDay(x.open, num(x.cycle))); }

  // 物品数据兼容与预警：老数据 left 是百分比，自动按 qty=100 / uname='%' 兼容
  function normItem(x) {
    if (x.qty == null || num(x.qty) <= 0) x.qty = 100;
    if (x.uname == null || x.uname === '') x.uname = '%';
    if (x.left == null) x.left = num(x.qty);
    return x;
  }
  function pctOf(x) { x = normItem(x); return x.qty > 0 ? Math.round(num(x.left) / num(x.qty) * 100) : 0; }
  function lastBuyDate(x) {
    var bs = x.buys || [];
    if (bs.length) return bs.map(function (b) { return b.d || ''; }).sort().slice(-1)[0];
    return x.buyDate || '';
  }
  function isLow(x) {
    x = normItem(x);
    var pct = pctOf(x);
    var lowPct = (x.warnPct != null && x.warnPct !== '') && pct <= num(x.warnPct);
    var lowQty = (x.warnQty != null && x.warnQty !== '') && num(x.left) <= num(x.warnQty);
    if ((x.warnPct == null || x.warnPct === '') && (x.warnQty == null || x.warnQty === '')) return pct <= 20; // 未设阈值时沿用旧的剩余≤20%预警
    return lowPct || lowQty;
  }
  U.itemPct = pctOf; U.itemLow = isLow; // 供首页库存预警复用

  function stockFields() {
    return [
      { k: 'name', label: '物品名称', req: true, full: true },
      Cats.field('itemCats', '分类', { k: 'cat' }),
      { k: 'buyDate', label: '购入日期', type: 'date', def: U.today() },
      { k: 'qty', label: '总数量', type: 'number', min: 0, req: true, def: 1, hint: '购买的总量，如 20' },
      { k: 'left', label: '当前剩余数量', type: 'number', min: 0, def: 1, hint: '默认等于总数量，可按实际已用调整' },
      { k: 'uname', label: '单位', ph: '包 / 瓶 / 支 / 个', full: true, hint: '记使用时按此单位计数' },
      { k: 'unit', label: '规格（选填）', ph: '如 500ml / 3 支', full: true },
      { k: 'price', label: '购入价格（选填）', type: 'number', min: 0, hint: '记录首笔购买花费，用于查看累计支出' },
      { k: 'exp', label: '保质期至', type: 'date' },
      { k: 'warnPct', label: '库存预警 · 低于该百分比时提醒', type: 'number', min: 0, max: 100, hint: '如填 20 → 低于 20% 触发首页预警；留空不按百分比' },
      { k: 'warnQty', label: '库存预警 · 低于该数量时提醒', type: 'number', min: 0, hint: '如填 3 → 低于 3 个触发首页预警；留空不按数量' },
      { k: 'note', label: '备注', full: true }
    ];
  }
  function buyFields() {
    return [
      { k: 'name', label: '物品名称', req: true, full: true },
      { k: 'qty', label: '数量', type: 'number', min: 1, def: 1 },
      { k: 'price', label: '预估单价', type: 'number', min: 0 },
      { k: 'note', label: '备注', full: true, ph: '在哪买 / 什么规格' }
    ];
  }
  function consumFields() {
    return [
      { k: 'name', label: '耗材名称', req: true, full: true, ph: CONSUM_PRESET.map(function (p) { return p.n; }).slice(0, 4).join(' / ') + ' …' },
      { k: 'open', label: '开封 / 启用日期', type: 'date', req: true, def: U.today() },
      { k: 'cycle', label: '建议更换周期（天）', type: 'number', min: 1, req: true, def: 30, hint: '隐形眼镜30 / 牙刷头90 / 粉扑30 / 内衣裤90' },
      { k: 'note', label: '备注', full: true }
    ];
  }

  App.register(items);
})();
