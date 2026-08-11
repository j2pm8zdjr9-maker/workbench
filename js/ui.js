/* ================= 通用 UI 组件 ================= */
(function (w) {
  'use strict';
  var esc = U.esc, num = U.num;

  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  // 视口变量与字体缩放状态（单例，避免 applyFont 重复绑定监听器）
  var _fs = 1, _vhBound = false, _vhRaf = 0;
  function _setViewportVars() {
    var vv = window.visualViewport;
    var ih = window.innerHeight || 600;
    var iw = window.innerWidth || 400;
    var vvH = (vv && vv.height ? vv.height : ih);
    var vvW = (vv && vv.width ? vv.width : iw);
    // 实时高度（侧边栏用）
    var h = Math.max(200, Math.round((vvH / _fs) * 1000) / 1000);
    // 稳定高度（弹窗/灯箱用，键盘弹出时取 innerHeight 避免缩成一条）
    var sh = Math.max(200, Math.round((Math.max(vvH, ih) / _fs) * 1000) / 1000);
    var w = Math.max(240, Math.round((vvW / _fs) * 1000) / 1000);
    var root = document.documentElement;
    root.style.setProperty('--app-vh-px', h + 'px');
    root.style.setProperty('--app-dvh-px', h + 'px');
    root.style.setProperty('--app-svh-px', sh + 'px');
    root.style.setProperty('--app-vw-px', w + 'px');
  }
  function _scheduleVh() {
    if (_vhRaf) return;
    _vhRaf = requestAnimationFrame(function () {
      _vhRaf = 0;
      _setViewportVars();
    });
  }

  var UI = {

    /* ---------- 基础块 ---------- */
    head: function (title, desc) {
      return '<div class="page-head">' +
        '<div class="page-head-row"><h2>' + title + '</h2>' +
        '<button class="home-pill tap" data-act="goHome" title="返回首页总览">🏠 首页</button></div>' +
        (desc ? '<p>' + esc(desc) + '</p>' : '') + '</div>';
    },

    card: function (o) {
      o = o || {};
      var h = '<div class="card' + (o.cls ? ' ' + o.cls : '') + '">';
      if (o.title || o.right) {
        h += '<div class="card-head"><h3>' + (o.title || '') +
          (o.sub ? ' <span class="sub">' + esc(o.sub) + '</span>' : '') + '</h3>' +
          '<div class="row">' + (o.right || '') + '</div></div>';
      }
      h += o.body || '';
      return h + '</div>';
    },

    empty: function (text, icon) {
      return '<div class="empty"><span class="e-ico">' + (icon || '🪶') + '</span>' + esc(text || '还没有记录，点上方按钮添加吧') + '</div>';
    },

    check: function (on, act, id, mini) {
      return '<button class="check tap' + (on ? ' on' : '') + (mini ? ' mini' : '') + '" data-act="' + act + '" data-id="' + id + '" aria-label="勾选">' + ICON_CHECK + '</button>';
    },

    tabs: function (list, cur, act) {
      return '<div class="tabs">' + list.map(function (t) {
        return '<button class="tab tap' + (t.k === cur ? ' on' : '') + '" data-act="' + act + '" data-k="' + esc(t.k) + '">' +
          (t.i ? '<span>' + t.i + '</span>' : '') + esc(t.t) + '</button>';
      }).join('') + '</div>';
    },

    pills: function (list, cur, act, key) {
      key = key || 'k';
      return '<div class="pills">' + list.map(function (t) {
        return '<button class="pill tap' + (t.k === cur ? ' on' : '') + '" data-act="' + act + '" data-' + key + '="' + esc(t.k) + '">' + esc(t.t) + '</button>';
      }).join('') + '</div>';
    },

    ops: function (id, editAct, delAct, extra) {
      var h = '<div class="item-ops">' + (extra || '');
      if (editAct) h += '<button class="link-btn tap" data-act="' + editAct + '" data-id="' + id + '">编辑</button>';
      if (delAct) h += '<button class="link-btn del tap" data-act="' + delAct + '" data-id="' + id + '">删除</button>';
      return h + '</div>';
    },

    bar: function (pct, thin) {
      pct = Math.max(0, Math.min(100, num(pct)));
      return '<div class="bar' + (thin ? ' thin' : '') + '"><i class="' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></i></div>';
    },

    stat: function (k, v, accent, title) {
      return '<div class="stat' + (accent ? ' accent' : '') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
    },

    stats: function (arr) {
      return '<div class="stat-grid">' + arr.map(function (s) { return UI.stat(s[0], s[1], s[2], s[3]); }).join('') + '</div>';
    },

    badge: function (t, cls) { return '<span class="badge' + (cls ? ' ' + cls : '') + '">' + esc(t) + '</span>'; },

    /* ---------- 通用翻页条（全站唯一样式，手机端自适应、同一水平线） ----------
       o: { pg, pages, total, size, sizes, pageAct, sizeChg, data:{ns:'xx'} }
       - pageAct：翻页按钮的 data-act，按钮上带 data-k = 目标页码
       - sizeChg：每页条数下拉的 data-chg
       - data：附加到按钮与下拉上的 data-* 属性（如 ns） */
    pager: function (o) {
      o = o || {};
      var sizes = o.sizes || [5, 10, 20, 50, 100];
      var pages = Math.max(1, o.pages || 1);
      var pg = Math.min(Math.max(1, o.pg || 1), pages);
      var total = o.total || 0;
      var extra = '';
      if (o.data) Object.keys(o.data).forEach(function (k) { extra += ' data-' + k + '="' + esc(o.data[k]) + '"'; });
      var btn = function (target, inner, on) {
        return on
          ? '<button class="pg-btn tap" data-act="' + o.pageAct + '" data-k="' + target + '"' + extra + '>' + inner + '</button>'
          : '<button class="pg-btn" disabled>' + inner + '</button>';
      };
      var opts = sizes.map(function (s) {
        return '<option value="' + s + '"' + (s === o.size ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      return '<div class="pg-bar">' +
        btn(pg - 1, '‹<span class="pg-t">上一页</span>', pg > 1) +
        '<span class="pg-info">' + pg + '/' + pages + ' · ' + total + ' 条</span>' +
        btn(pg + 1, '<span class="pg-t">下一页</span>›', pg < pages) +
        '<label class="pg-size"><span class="pg-t">每页</span>' +
        '<select data-chg="' + o.sizeChg + '"' + extra + '>' + opts + '</select></label>' +
        '</div>';
    },

    ring: function (pct, main, sub) {
      pct = Math.max(0, Math.min(100, num(pct)));
      var r = 52, c = 2 * Math.PI * r;
      return '<div class="ring"><svg viewBox="0 0 124 124" width="124" height="124">' +
        '<circle cx="62" cy="62" r="' + r + '" fill="none" stroke="rgba(51,25,21,.07)" stroke-width="11"/>' +
        '<circle cx="62" cy="62" r="' + r + '" fill="none" stroke="' + (pct >= 100 ? '#8AA832' : '#9BB055') + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pct / 100)) + '"/>' +
        '</svg><div class="ring-txt"><div><b>' + main + '</b><span>' + esc(sub || '') + '</span></div></div></div>';
    },

    /* 折线图（date/value 数组） */
    line: function (pts, opt) {
      opt = opt || {};
      if (!pts.length) return UI.empty(opt.emptyText || '暂无数据，添加记录后生成趋势图', '📈');
      var W = 640, H = 220, pl = 42, pr = 16, pt2 = 18, pb = 30;
      var vals = pts.map(function (p) { return p.v; });
      var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
      var span = mx - mn; if (span < 1e-6) { mx += 1; mn -= 1; span = mx - mn; }
      mx += span * .15; mn -= span * .15; span = mx - mn;
      var n = pts.length;
      var X = function (i) { return pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)); };
      var Y = function (v) { return pt2 + (1 - (v - mn) / span) * (H - pt2 - pb); };
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ');
      var area = d + ' L' + X(n - 1).toFixed(1) + ' ' + (H - pb) + ' L' + X(0).toFixed(1) + ' ' + (H - pb) + ' Z';
      var g = '';
      for (var i = 0; i <= 3; i++) {
        var yy = pt2 + i * (H - pt2 - pb) / 3, vv = mx - i * span / 3;
        g += '<line x1="' + pl + '" y1="' + yy.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(51,25,21,.07)" stroke-width="1"/>' +
          '<text x="' + (pl - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#9A8A85">' + vv.toFixed(opt.dec === 0 ? 0 : 1) + '</text>';
      }
      var lb = '';
      var step = Math.max(1, Math.ceil(n / 6));
      pts.forEach(function (p, i) {
        if (i % step === 0 || i === n - 1) {
          lb += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11" fill="#9A8A85">' + esc(String(p.t || '').slice(5)) + '</text>';
        }
      });
      var dots = pts.map(function (p, i) {
        return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="3.6" fill="#fff" stroke="#8AA832" stroke-width="2.2"/>';
      }).join('');
      return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8AA832" stop-opacity=".22"/><stop offset="1" stop-color="#8AA832" stop-opacity="0"/></linearGradient></defs>' +
        g + '<path d="' + area + '" fill="url(#lg)"/><path d="' + d + '" fill="none" stroke="#8AA832" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
        dots + lb + '</svg></div>';
    },

    /* 双色柱状图（收入/支出） */
    bars2: function (rows) {
      if (!rows.length) return UI.empty('暂无数据', '📊');
      var W = 640, H = 230, pl = 46, pr = 12, pt2 = 16, pb = 32;
      var mx = 0; rows.forEach(function (r) { mx = Math.max(mx, r.a, r.b); });
      if (!mx) mx = 1;
      mx *= 1.15;
      var n = rows.length, gw = (W - pl - pr) / n, bw = Math.min(20, gw / 3.2);
      var Y = function (v) { return pt2 + (1 - v / mx) * (H - pt2 - pb); };
      var g = '', i;
      for (i = 0; i <= 3; i++) {
        var yy = pt2 + i * (H - pt2 - pb) / 3, vv = mx - i * mx / 3;
        g += '<line x1="' + pl + '" y1="' + yy.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(51,25,21,.07)"/>' +
          '<text x="' + (pl - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#9A8A85">' + Math.round(vv) + '</text>';
      }
      var b = '';
      rows.forEach(function (r, i2) {
        var cx = pl + gw * i2 + gw / 2;
        b += '<rect x="' + (cx - bw - 3).toFixed(1) + '" y="' + Y(r.a).toFixed(1) + '" width="' + bw + '" height="' + (H - pb - Y(r.a)).toFixed(1) + '" rx="4" fill="#9BB055"/>';
        b += '<rect x="' + (cx + 3).toFixed(1) + '" y="' + Y(r.b).toFixed(1) + '" width="' + bw + '" height="' + (H - pb - Y(r.b)).toFixed(1) + '" rx="4" fill="#C9803A" opacity=".72"/>';
        b += '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#9A8A85">' + esc(r.t) + '</text>';
      });
      return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '">' + g + b + '</svg></div>' +
        '<div class="legend"><span><i style="background:#9BB055"></i>收入</span><span><i style="background:#C9803A;opacity:.72"></i>支出</span></div>';
    },

    /* 横向占比条 */
    hbars: function (rows, total, fmt) {
      if (!rows.length) return UI.empty('暂无数据', '📊');
      total = total || rows.reduce(function (s, r) { return s + r.v; }, 0) || 1;
      return rows.map(function (r) {
        var p = r.v / total * 100;
        return '<div class="hbar-row"><div class="row between"><span>' + esc(r.t) + '</span>' +
          '<span class="small muted">' + (fmt ? fmt(r.v) : r.v) + ' · ' + p.toFixed(1) + '%</span></div>' +
          UI.bar(p, true) + '</div>';
      }).join('');
    },

    table: function (cols, rows) {
      if (!rows.length) return UI.empty();
      return '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    },

    td: function (label, val, cls) {
      return '<td data-label="' + esc(label) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + (val === '' || val === undefined || val === null ? '<span class="muted">—</span>' : val) + '</td>';
    },

    /* ---------- 表单弹窗 ---------- */
    form: function (cfg) {
      return new Promise(function (resolve) {
        var root = document.getElementById('modalRoot');
        var fields = cfg.fields || [];
        var vals = cfg.values || {};
        var body = '<div class="form-grid">' + fields.map(function (f) {
          var v = vals[f.k] !== undefined && vals[f.k] !== null ? vals[f.k] : (f.def !== undefined ? f.def : '');
          var cls = 'field' + (f.type === 'textarea' || f.full ? ' full' : '');
          var whenAttr = f.when ? ' data-field="' + f.k + '" data-when="' + f.when.key + '::' + f.when.val + '" style="display:none"' : ' data-field="' + f.k + '"';
          var inner = '';
          if (f.type === 'textarea') {
            inner = '<textarea class="textarea" name="' + f.k + '" placeholder="' + esc(f.ph || '') + '" rows="' + (f.rows || 4) + '">' + esc(v) + '</textarea>';
          } else if (f.type === 'select') {
            var catAttr = f.catns ? ' data-catns="' + f.catns + '" data-prev="' + esc(String(v)) + '"' : '';
            inner = '<select class="select" name="' + f.k + '"' + catAttr + '>' +
              (f.ph ? '<option value="">' + esc(f.ph) + '</option>' : '') +
              (f.options || []).map(function (o) {
                var val = typeof o === 'object' ? o.v : o, txt = typeof o === 'object' ? o.t : o;
                return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(txt) + '</option>';
              }).join('') +
              (f.catns ? '<option value="__custom">＋ 自定义…</option>' : '') + '</select>';
          } else if (f.type === 'checkbox') {
            inner = '<label class="opt-row tap" style="min-height:50px"><input type="checkbox" name="' + f.k + '" ' + (v ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#8AA832">' +
              '<span>' + esc(f.cbText || f.label) + '</span></label>';
          } else {
            var extra = '';
            if (f.type === 'number') extra = ' step="' + (f.step || 'any') + '"' + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + ' inputmode="decimal"';
            var listAttr = f.list ? ' list="' + f.k + '-list"' : '';
            inner = '<input class="input" type="' + (f.type || 'text') + '" name="' + f.k + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '"' + extra + listAttr + '>';
            if (f.list) {
              inner += '<datalist id="' + f.k + '-list">' + f.list.map(function (o) {
                return '<option value="' + esc(o) + '"></option>';
              }).join('') + '</datalist>';
            }
            if (f.quick && f.quick.length) {
              inner += '<div class="chip-row" style="margin-top:8px">' + f.quick.map(function (q) {
                return '<button type="button" class="chip tap" data-quick="' + esc(String(f.k)) + '::' + esc(String(q)) + '">' + esc(String(q)) + (f.quickUnit ? esc(String(f.quickUnit)) : '') + '</button>';
              }).join('') + '</div>';
            }
          }
          return '<div class="' + cls + '"' + whenAttr + '>' + (f.type === 'checkbox' ? '' : '<label>' + esc(f.label) + (f.req ? ' <span style="color:#B4553F">*</span>' : '') + '</label>') + inner +
            (f.hint ? '<span class="small muted">' + esc(f.hint) + '</span>' : '') + '</div>';
        }).join('') + '</div>';

        var el = document.createElement('div');
        el.className = 'modal-mask';
        el.innerHTML = '<div class="modal" role="dialog"><div class="modal-head"><h3>' + esc(cfg.title || '编辑') + '</h3>' +
          '<button class="x-btn tap" data-x>✕</button></div>' +
          '<div class="modal-body">' + (cfg.desc ? '<p class="small muted">' + esc(cfg.desc) + '</p>' : '') + body + '</div>' +
          '<div class="modal-foot"><button class="btn ghost tap" data-x>取消</button><button class="btn primary tap" data-ok>' + esc(cfg.okText || '保存') + '</button></div></div>';
        root.appendChild(el);

        var first = el.querySelector('.input,.textarea,.select');
        if (first && window.matchMedia('(min-width:901px)').matches) setTimeout(function () { first.focus(); }, 90);

        function close(r) { el.remove(); UI.unlock(); resolve(r); }
        UI.lock();

        // 条件字段显隐：依赖 when.key 的值等于 when.val 时显示
        function applyWhen() {
          fields.forEach(function (f) {
            if (!f.when) return;
            var ctrl = el.querySelector('[name="' + f.when.key + '"]');
            var div = el.querySelector('[data-field="' + f.k + '"]');
            if (div) div.style.display = (ctrl && ctrl.value === String(f.when.val)) ? '' : 'none';
          });
        }
        applyWhen();
        el.addEventListener('change', applyWhen);
        if (cfg.onMount) cfg.onMount(el, fields);

        el.addEventListener('click', function (e) {
          if (e.target === el || e.target.closest('[data-x]')) return close(null);
          var qb = e.target.closest('[data-quick]');
          if (qb) {
            var p = qb.dataset.quick.split('::');
            var inp = el.querySelector('[name="' + p[0] + '"]');
            if (inp) { inp.value = p[1]; inp.dispatchEvent(new Event('input')); }
            return;
          }
          if (e.target.closest('[data-ok]')) {
            var out = {}, bad = null;
            fields.forEach(function (f) {
              if (f.when) {
                var ctrl = el.querySelector('[name="' + f.when.key + '"]');
                if (!ctrl || ctrl.value !== String(f.when.val)) { out[f.k] = ''; return; } // 隐藏字段跳过
              }
              var node = el.querySelector('[name="' + f.k + '"]');
              if (!node) return;
              var v = f.type === 'checkbox' ? node.checked : node.value.trim();
              if (f.req && (v === '' || v === undefined)) bad = bad || f.label;
              out[f.k] = f.type === 'number' ? (v === '' ? '' : num(v)) : v;
            });
            if (bad) { U.toast('请填写「' + bad + '」'); return; }
            close(out);
          }
        });
        el.addEventListener('change', function (e) {
          var sel = e.target.closest('select[data-catns]');
          if (!sel) return;
          if (sel.value === '__custom') { w.Cats && w.Cats.onSelect(sel); }
          else { sel.dataset.prev = sel.value; }
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') close(null);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el.querySelector('[data-ok]').click();
        });
      });
    },

    confirm: function (title, desc, okText, danger) {
      return new Promise(function (resolve) {
        var root = document.getElementById('modalRoot');
        var el = document.createElement('div');
        el.className = 'modal-mask';
        el.innerHTML = '<div class="modal" style="max-width:400px"><div class="modal-head"><h3>' + esc(title) + '</h3></div>' +
          '<div class="modal-body"><p class="small muted" style="line-height:1.8">' + esc(desc || '') + '</p></div>' +
          '<div class="modal-foot"><button class="btn ghost tap" data-no>取消</button>' +
          '<button class="btn ' + (danger ? 'danger' : 'primary') + ' tap" data-yes>' + esc(okText || '确定') + '</button></div></div>';
        root.appendChild(el);
        function close(r) { el.remove(); UI.unlock(); resolve(r); }
        UI.lock();
        el.addEventListener('click', function (e) {
          if (e.target === el || e.target.closest('[data-no]')) close(false);
          if (e.target.closest('[data-yes]')) close(true);
        });
      });
    },

    sheet: function (title, bodyHtml, footHtml) {
      var root = document.getElementById('modalRoot');
      var el = document.createElement('div');
      el.className = 'modal-mask';
      el.innerHTML = '<div class="modal"><div class="modal-head"><h3>' + esc(title) + '</h3><button class="x-btn tap" data-x>✕</button></div>' +
        '<div class="modal-body">' + bodyHtml + '</div>' +
        (footHtml ? '<div class="modal-foot">' + footHtml + '</div>' : '<div style="height:22px"></div>') + '</div>';
      root.appendChild(el);
      UI.lock();
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('[data-x]')) { el.remove(); UI.unlock(); }
      });
      return el;
    },

    /* 通用：删除确认 + 执行 */
    del: function (name, fn) {
      UI.confirm('删除「' + name + '」？', '删除后不可恢复。', '删除', true).then(function (ok) {
        if (ok) { fn(); U.toast('已删除'); }
      });
    },

    scoreTag: function (s) {
      if (s === '' || s === undefined || s === null) return '';
      return '<span class="score"><span class="s-n">' + num(s) + '</span><span class="s-max">/10</span></span>';
    },

    /* 滚动锁定/解锁（弹窗套弹窗安全） */
    lock: function () { document.body.style.overflow = 'hidden'; },
    unlock: function () {
      if (!document.querySelector('.modal-mask, .di-lightbox')) document.body.style.overflow = '';
    },

    /* 全局字体大小：写入 --font-scale（html 的 zoom 会整体缩放，含弹窗）。
       同时用 JS 计算真实可视高度/宽度并写入 CSS 变量，避免 zoom 后 100vh/100dvh/100vw
       与真实可视区不一致（尤其 iOS Safari），导致侧边栏/弹窗底部被推出屏幕。 */
    applyFont: function (scale) {
      var s = (scale === '' || scale == null || isNaN(scale)) ? 1 : scale;
      _fs = s;
      document.documentElement.style.setProperty('--font-scale', s);
      _setViewportVars();
      if (!_vhBound) {
        _vhBound = true;
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', _scheduleVh);
          window.visualViewport.addEventListener('scroll', _scheduleVh);
        }
        window.addEventListener('resize', _scheduleVh);
        window.addEventListener('orientationchange', _scheduleVh);
      }
    }
  };

  w.UI = UI;
})(window);
