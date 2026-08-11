/* ================= 集中式分类管理（所有板块共用） ================= */
(function (w) {
  'use strict';
  var UI = w.UI, Store = w.Store, App = w.App, U = w.U;
  var D = function () { return Store.data; };

  var Cats = {
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

    /* ---------- 筛选条（首页/列表通用，节省屏幕空间） ----------
       规则：「全部」固定显示；除「全部」外，同一行直接显示 catPin 个胶囊。
       其中最后一个（第 catPin 个）是「灵活胶囊」：默认显示「更多 ▾」，点击后
       打开选择器可选「无分类」（取消筛选）或剩余分类；选中后该胶囊名称变为该分类名。
       再次点击灵活胶囊可重新选择其他分类，或选「无分类」取消筛选。
       分类管理里可调整顺序，常用分类排到前面即可直接显示为固定胶囊。 */
    _onPick: {},                 // ns -> function(k)
    setPicker: function (ns, fn) { Cats._onPick[ns] = fn; },
    pick: function (ns, k) { if (Cats._onPick[ns]) Cats._onPick[ns](k); },

    /* 渲染筛选条。cur：当前选中的分类（'' = 全部）。opts.label：左侧小标题。
       catPin 表示「除全部外直接显示的胶囊数量」，默认 3（= 2 固定 + 1 灵活）。 */
    filterBar: function (ns, cur, opts) {
      opts = opts || {};
      var all = Cats.get(ns);
      var catPin = opts.pin || Cats.pin(ns);
      var fixedN = Math.max(0, catPin - 1);          // 固定分类数
      var pinned = all.slice(0, fixedN);
      var rest = all.slice(fixedN);
      var html = '<button class="pill tap' + (cur === '' ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="">全部</button>';
      pinned.forEach(function (c) {
        html += '<button class="pill tap' + (cur === c ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="' + U.esc(c) + '">' + U.esc(c) + '</button>';
      });
      var flexOn = cur && rest.indexOf(cur) >= 0;
      var flexLabel = flexOn ? cur : '更多 ▾';
      html += '<button class="pill tap' + (flexOn ? ' on' : '') + '" data-act="catMore" data-ns="' + ns + '" data-cur="' + U.esc(cur || '') + '">' + U.esc(flexLabel) + '</button>';
      return '<div class="row cat-filter-row" style="gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px">' +
        (opts.label ? '<span class="small muted">' + U.esc(opts.label) + '</span>' : '') + html + '</div>';
    },

    /* 打开「剩余分类」选择器（固定分类之后的剩余分类 + 无分类）。
       onPick 可选；不传时走 setPicker 注册的回调（主视图场景）。 */
    openPicker: function (ns, cur, onPick) {
      var catPin = Cats.pin(ns);
      var rest = Cats.get(ns).slice(Math.max(0, catPin - 1));
      var cb = onPick || Cats._onPick[ns];
      var render = function () {
        var pills = '<button class="pill tap' + (cur === '' ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="">无分类</button>';
        if (rest.length) {
          pills += rest.map(function (c) {
            return '<button class="pill tap' + (cur === c ? ' on' : '') + '" data-act="catPick" data-ns="' + ns + '" data-k="' + U.esc(c) + '">' + U.esc(c) + '</button>';
          }).join('');
        } else {
          pills += '<span class="small muted" style="margin-left:8px">没有更多分类，去「分类管理」新增后会显示在这里</span>';
        }
        return '<div class="row" style="gap:8px;flex-wrap:wrap">' + pills + '</div>';
      };
      var el = UI.sheet('选择分类', render(), '<button class="btn ghost tap" data-x>关闭</button>');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act="catPick"]');
        if (!b) return;
        e.preventDefault();
        var k = b.dataset.k;
        el.remove(); UI.unlock();
        if (cb) cb(k);
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
