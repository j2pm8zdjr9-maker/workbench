/* ========== 通用日历组件（多模块复用） ==========
   用法：在模块 render 末尾调用 Cal.card(cfg)，并在 acts 中加 4 个委托行为。
   cfg = {
     modId: 'media',                 // 模块 id（用于区分状态与点击路由）
     title: '📅 媒体日历',
     sub:   '数字 = 当天条数，点日期查看当天',
     cell:  function(dateStr){ ... return 数量数字 },   // 当天格子的角标计数
     day:   function(dateStr){ return { title, body }; } // 点击日期的详情面板
   }
   委托行为（每个模块 acts 里加）：
     calPrev/calNext/calToday/calDay: function(t){ Cal.act(t); }
*/
(function (w) {
  'use strict';
  var registry = {};   // modId -> cfg
  var state = {};      // modId -> { y, m }

  function ensure(modId) {
    if (!state[modId]) {
      var d = new Date();
      state[modId] = { y: d.getFullYear(), m: d.getMonth() + 1 };
    }
    return state[modId];
  }
  function nav(modId, n) {
    var s = ensure(modId);
    var d = new Date(s.y, s.m - 1 + n, 1);
    s.y = d.getFullYear(); s.m = d.getMonth() + 1;
    App.refresh();
  }
  function toToday(modId) {
    var s = ensure(modId), d = new Date();
    s.y = d.getFullYear(); s.m = d.getMonth() + 1;
    App.refresh();
  }

  function card(cfg) {
    registry[cfg.modId] = cfg;
    var s = ensure(cfg.modId), y = s.y, m = s.m;
    var first = new Date(y, m - 1, 1), startPad = first.getDay();
    var days = new Date(y, m, 0).getDate(), today = U.today();
    var cells = ['日', '一', '二', '三', '四', '五', '六'].map(function (d) {
      return '<span class="cal-wd">' + d + '</span>';
    }).join('');
    for (var i = 0; i < startPad; i++) cells += '<span class="cal-cell empty"></span>';
    for (var dd = 1; dd <= days; dd++) {
      var ds = y + '-' + U.pad(m) + '-' + U.pad(dd);
      var c = cfg.cell ? (cfg.cell(ds) || 0) : 0;
      var cls = 'cal-cell tap';
      if (c > 0) cls += ' has';
      if (ds === today) cls += ' today';
      cells += '<button class="' + cls + '" data-act="calDay" data-mod="' + cfg.modId + '" data-d="' + ds + '">' +
        '<span class="cal-num">' + dd + '</span>' +
        (c > 0 ? '<i class="cal-count">' + c + '</i>' : '') + '</button>';
    }
    return UI.card({
      title: cfg.title || '日历',
      sub: cfg.sub || '数字 = 当天条数，点日期查看当天',
      body: '<div class="row between" style="margin-bottom:8px">' +
        '<button class="btn ghost sm tap" data-act="calPrev" data-mod="' + cfg.modId + '">‹</button>' +
        '<strong>' + y + ' 年 ' + m + ' 月</strong>' +
        '<span><button class="btn ghost sm tap" data-act="calToday" data-mod="' + cfg.modId + '">今天</button> ' +
        '<button class="btn ghost sm tap" data-act="calNext" data-mod="' + cfg.modId + '">›</button></span></div>' +
        '<div class="cal chk-cal">' + cells + '</div>'
    });
  }

  function act(t) {
    var mod = t.dataset.mod, a = t.dataset.act;
    if (a === 'calPrev') return nav(mod, -1);
    if (a === 'calNext') return nav(mod, 1);
    if (a === 'calToday') return toToday(mod);
    if (a === 'calDay') {
      var cfg = registry[mod];
      if (cfg && cfg.day) {
        var info = cfg.day(t.dataset.d);
        UI.sheet(info.title, info.body, '<button class="btn ghost tap" data-x>关闭</button>');
      }
    }
  }

  w.Cal = { card: card, act: act };
})(window);
