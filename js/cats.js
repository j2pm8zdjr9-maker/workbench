/* ================= 集中式分类管理（所有板块共用） ================= */
(function (w) {
  'use strict';
  var UI = w.UI, Store = w.Store, App = w.App, U = w.U;
  var D = function () { return Store.data; };

  var Cats = {
    /* 多选状态：ns -> 已选分类名数组（空数组 = 全部） */
    _sel: {},
    sel: function (ns) { return Cats._sel[ns] || (Cats._sel[ns] = []); },
    has: function (ns, c) { return Cats.sel(ns).indexOf(c) >= 0; },
    toggle: function (ns, c) { var s = Cats.sel(ns); var i = s.indexOf(c); if (i >= 0) s.splice(i, 1); else s.push(c); return s; },
    clear: function (ns) { Cats._sel[ns] = []; },

    /* 读取某命名空间下的分类列表（副本） */
    get: function (ns) { return (D()[ns] || []).slice(); },

    /* 新增分类，已存在或空返回 false */
    add: function (ns, name) {
      name = (name || '').trim();
      if (!name) return false;
      if (!D()[ns]) D()[ns] = [];
      if (D()[ns].indexOf(name) >= 0) return false;
      D()[ns].push(name);
      Store.save();
      return true;
    },

    /* 删除分类 */
    del: function (ns, name) {
      if (!D()[ns]) return;
      D()[ns] = D()[ns].filter(function (c) { return c !== name; });
      Store.save();
    },

    /* 生成表单里的「分类下拉 + 自定义选项」字段 */
    field: function (ns, label, opts) {
      opts = opts || {};
      var list = Cats.get(ns);
      var f = {
        k: opts.k || 'cat',
        label: label,
        type: 'select',
        catns: ns,
        options: list.map(function (c) { return { v: c, t: c }; }),
        def: opts.def !== undefined ? opts.def : (list[0] || '')
      };
      if (opts.ph) f.ph = opts.ph;          // 允许留空（占位选项）
      if (opts.hint) f.hint = opts.hint;
      if (opts.full) f.full = true;
      return f;
    },

    /* 列表头部的「分类管理」按钮 */
    btn: function (ns, title, text) {
      return '<button class="btn ghost sm tap" data-act="catManage" data-ns="' + ns +
        '" data-title="' + U.esc(title || '分类') + '">' + U.esc(text || '分类管理') + '</button>';
    },

    /* 表单内选「自定义」时弹窗新增，返回 Promise<名称|null> */
    addDialog: function (ns) {
      return new Promise(function (resolve) {
        var el = UI.sheet('新增分类',
          '<div class="field full"><input class="input" id="nc" placeholder="输入分类名称" maxlength="20"></div>',
          '<button class="btn primary tap" data-ok style="width:100%">添加</button>');
        var input = el.querySelector('#nc');
        setTimeout(function () { input.focus(); }, 60);
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-x]')) { el.remove(); UI.unlock(); resolve(null); }
          if (e.target.closest('[data-ok]')) {
            var name = input.value.trim();
            if (!name) { input.focus(); return; }
            Cats.add(ns, name);
            el.remove(); UI.unlock();
            resolve(name);
          }
        });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-ok]').click(); } });
      });
    },

    /* 供 UI.form 内 select[data-catns] 的 change 事件调用 */
    onSelect: function (sel) {
      var ns = sel.dataset.catns;
      var prev = sel.dataset.prev || (Cats.get(ns)[0] || '');
      Cats.addDialog(ns).then(function (name) {
        if (!name) { sel.value = prev; return; }
        sel.innerHTML = Cats.optionHtml(ns) + '<option value="__custom">＋ 自定义…</option>';
        sel.value = name;
        sel.dataset.prev = name;
      });
    },

    optionHtml: function (ns) {
      return Cats.get(ns).map(function (c) { return '<option value="' + U.esc(c) + '">' + U.esc(c) + '</option>'; }).join('');
    },

    /* 各命名空间独立的「直接显示分类数」（catPin）。全局默认 3，可逐命名空间覆盖。
       切换某命名空间后只影响该命名空间，其他命名空间仍取默认 3。 */
    pin: function (ns) {
      var m = Store.data.ui && Store.data.ui.catPin;
      if (m && typeof m === 'object') return Math.max(2, Math.min(10, m[ns] || 3));
      return Math.max(2, Math.min(10, (typeof m === 'number' ? m : 3)));
    },
    setPin: function (ns, v) {
      var m = Store.data.ui && Store.data.ui.catPin;
      if (!m || typeof m !== 'object') m = {};
      m[ns] = Math.max(2, Math.min(10, v));
      Store.data.ui.catPin = m;
      Store.save();
    },

    /* ---------- 筛选条（首页/列表通用，多选） ----------
       多选规则：「全部」固定显示（点击清空）；其余分类以药丸形式展示，点击切换选中。
       除「全部」外同一行直接显示 catPin-1 个固定分类（catPin 由分类管理控制，
       可统一作用于主视图与历史记录）；最后一个为「更多 ▾」胶囊，点击打开全部分类
       的多选选择器。被选中的非固定分类会在「更多」上以计数提示。
       分类管理里可调整顺序与显示个数，常用分类排前面即直接显示为固定药丸。 */
    _onPick: {},                 // ns -> function(selArray)
    setPicker: function (ns, fn) { Cats._onPick[ns] = fn; },
    pick: function (ns, k) {
      if (k === '*') Cats.clear(ns);
      else Cats.toggle(ns, k);
      if (Cats._onPick[ns]) Cats._onPick[ns](Cats.sel(ns));
    },

    /* 渲染多选筛选条。opts.label：左侧小标题。catPin 控制除「全部」外直接显示的分类数。 */
    filterBar: function (ns, opts) {
      opts = opts || {};
      var all = Cats.get(ns);
      var sel = Cats.sel(ns);
      var catPin = opts.pin || Cats.pin(ns);
      var fixedN = Math.max(0, catPin - 1);          // 固定分类数（其余收进「更多」）
      var pinned = all.slice(0, fixedN);
      var rest = all.slice(fixedN);
      var html = '<button class="pill tap' + (sel.length === 0 ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="*">全部</button>';
      pinned.forEach(function (c) {
        html += '<button class="pill tap' + (Cats.has(ns, c) ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="' + U.esc(c) + '">' + U.esc(c) + '</button>';
      });
      var restSel = sel.filter(function (c) { return rest.indexOf(c) >= 0; });
      var flexLabel = restSel.length ? ('更多(' + restSel.length + ')') : '更多 ▾';
      html += '<button class="pill tap' + (restSel.length ? ' on' : '') + '" data-act="catMore" data-ns="' + ns + '" data-cur="' + U.esc(sel.join(',')) + '">' + U.esc(flexLabel) + '</button>';
      var mb = opts.margin !== undefined ? opts.margin : '8px';
      return '<div class="row cat-filter-row" style="gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 ' + mb + '">' +
        (opts.label ? '<span class="small muted">' + U.esc(opts.label) + '</span>' : '') + html + '</div>';
    },

    /* 打开「全部分类」多选选择器（点击切换，✓ 标记，完成后关闭）。
       不传 onPick 时走 setPicker 注册的回调（主视图场景）。 */
    openPicker: function (ns, cur, onPick) {
      var cb = onPick || Cats._onPick[ns];
      function render() {
        var pills = '<button class="pill tap' + (Cats.sel(ns).length === 0 ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="*">无分类 / 全部</button>';
        pills += Cats.get(ns).map(function (c) {
          var on = Cats.has(ns, c);
          return '<button class="pill tap' + (on ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="' + U.esc(c) + '">' + (on ? '✓ ' : '') + U.esc(c) + '</button>';
        }).join('');
        return '<div class="row" style="gap:8px;flex-wrap:wrap">' + pills + '</div>';
      }
      var foot = '<div style="height:12px"></div><button class="btn primary tap" data-done style="width:100%">完成</button><div style="height:6px"></div><button class="btn ghost tap" data-x>关闭</button>';
      var el = UI.sheet('选择分类（可多选）', render(), foot);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act="catPick"]');
        if (b) {
          e.preventDefault();
          Cats.pick(ns, b.dataset.k);                 // 切换选中并触发主视图刷新
          var body = el.querySelector('.modal-body');
          if (body) body.innerHTML = render();        // 仅刷新选择区，底部按钮保持在 modal-foot
          return;
        }
        if (e.target.closest('[data-done]') || e.target.closest('[data-x]')) {
          el.remove();
          UI.unlock();
          if (UI.modalA11y) UI.modalA11y.close(el);   // 还原 .app 可交互（避免界面卡死）
        }
      });
    },

    /* ---------- 分类管理弹窗（新增 / 删除 / 上移 / 下移） ---------- */
    manage: function (ns, title) {
      var render = function () {
        var cats = Cats.get(ns);
        var pin = Cats.pin(ns);
        return '<div class="cat-pin-box">' +
          '<div class="cat-pin-label">除「全部」外直接显示的分类数<span class="small muted">（最后一个为灵活胶囊，其余收进「更多」）</span></div>' +
          '<div class="row" style="gap:10px;align-items:center">' +
          '<button class="chip tap" data-act="pinMinus" aria-label="减少">−</button>' +
          '<b class="cat-pin-val">' + pin + '</b>' +
          '<button class="chip tap" data-act="pinPlus" aria-label="增加">＋</button>' +
          '</div></div>' +
          '<p class="small muted" style="margin:12px 0">自定义分类，新增或删除都会自动保存；上下箭头可调整顺序，常用的排前面（按上面数量直接显示为固定胶囊）。</p>' +
          '<div class="form-grid">' +
          '<div class="field full"><input class="input" id="newCat" placeholder="输入新分类名称" maxlength="20"></div>' +
          '<div class="field full"><button class="btn primary tap" data-act="catAdd" style="width:100%">+ 添加分类</button></div>' +
          '</div><div style="height:8px"></div>' +
          (cats.length ? '<div class="list">' + cats.map(function (c, i) {
            return '<div class="item" style="padding:10px 12px"><div class="item-main"><div class="item-title">' + U.esc(c) + '</div></div>' +
              '<div class="row" style="gap:6px">' +
              (i > 0 ? '<button class="link-btn tap" data-act="catUp" data-c="' + U.esc(c) + '">↑</button>' : '') +
              (i < cats.length - 1 ? '<button class="link-btn tap" data-act="catDown" data-c="' + U.esc(c) + '">↓</button>' : '') +
              '<button class="link-btn del tap" data-act="catDel" data-c="' + U.esc(c) + '">删除</button></div></div>';
          }).join('') : UI.empty('还没有分类，先添加一个吧')) + '</div>';
      };
      var el = UI.sheet(title || '分类管理', render(), '<button class="btn ghost tap" data-x>关闭</button>');
      var body = el.querySelector('.modal-body');
      function setPin(delta) {
        var cur = Cats.pin(ns);
        Cats.setPin(ns, cur + delta);
        body.innerHTML = render(); App.refresh();
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.dataset.act;
        if (act === 'pinMinus') { setPin(-1); return; }
        if (act === 'pinPlus') { setPin(1); return; }
        if (act === 'catAdd') {
          var inp = el.querySelector('#newCat');
          if (Cats.add(ns, inp.value)) { inp.value = ''; body.innerHTML = render(); App.refresh(); }
          else U.toast('已存在或为空');
        } else if (act === 'catDel') {
          Cats.del(ns, b.dataset.c); body.innerHTML = render(); App.refresh();
        } else if (act === 'catUp' || act === 'catDown') {
          var arr = D()[ns]; if (!arr) return;
          var idx = arr.indexOf(b.dataset.c); if (idx < 0) return;
          var j = act === 'catUp' ? idx - 1 : idx + 1;
          if (j < 0 || j >= arr.length) return;
          var tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
          Store.save(); body.innerHTML = render();
        }
      });
      return el;
    }
  };

  w.Cats = Cats;
})(window);
