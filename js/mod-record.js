/* ========== 2. 影剧书记录 / 3. 备考计划 ========== */
(function () {
  'use strict';
  var esc = U.esc, num = U.num, TF = window.TF, D = function () { return Store.data; };

  /* =========================================================
     2. 🎬 影剧书记录
  ========================================================= */
  var MT = { movie: { t: '电影', i: '🎬', v: '观看' }, tv: { t: '电视剧', i: '📺', v: '观看' }, book: { t: '书籍', i: '📖', v: '阅读' } };

  // 影剧书列表排序键（与历史记录一致：点同一项在高→低 / 低→高间切换）
  var mediaSortKeys = [
    { k: 'end', t: '按完结时间', get: function (x) { return x.end || ''; } },
    { k: 'score', t: '按评分', get: function (x) { return num(x.score); } },
    { k: 'start', t: '按开始时间', get: function (x) { return x.start || ''; } }
  ];
  var mediaExpanded = null; // 当前展开的影剧书 id

  function renderMediaItem(x) {
    var total = (x.readLogs || []).reduce(function (s, l) { return s + num(l.mins); }, 0);
    var expanded = mediaExpanded === x.id;
    var statusBadge = x.end ? '<span class="badge">已完结</span>' : '<span class="badge info">进行中</span>';
    // 折叠态：只显示核心信息
    if (!expanded) {
      return '<div class="item" data-act="mexp" data-id="' + x.id + '">' +
        '<div class="item-main">' +
        '<div class="row between"><span class="item-title">' + MT[x.type].i + ' ' + esc(x.title) + '</span>' +
        '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' + UI.scoreTag(x.score) + ' <span style="font-size:11px;color:#999">▸</span></span></div>' +
        '<div class="item-meta">' + statusBadge +
        (x.tag ? '<span class="badge grey">' + esc(x.tag) + '</span>' : '') +
        pageBadge(x) +
        '<span>' + (x.start ? U.fmtDate(x.start) : '—') + ' → ' + (x.end ? U.fmtDate(x.end) : '进行中') + '</span>' +
        '</div></div></div>';
    }
    // 展开态：显示完整信息 + 操作按钮
    return '<div class="item open" data-act="mexp" data-id="' + x.id + '">' +
      '<div class="item-main" style="cursor:pointer">' +
      '<div class="row between" style="gap:10px">' +
      '<span class="item-title">' + esc(x.title) + '</span>' +
      '<span class="row" style="gap:6px;align-items:center;flex-shrink:0">' + UI.scoreTag(x.score) + ' <span style="font-size:11px;color:#999">▾</span></span></div>' +
      '<div class="item-meta">' +
      (x.end ? '<span class="badge">已完结</span>' : '<span class="badge info">进行中</span>') +
      (x.type === 'book' && x.status ? '<span class="badge ' + (x.status === '在读' ? 'info' : x.status === '已读' ? '' : 'grey') + '">' + esc(x.status) + '</span>' : '') +
      (x.tag ? '<span class="badge grey">' + esc(x.tag) + '</span>' : '') +
      pageBadge(x) +
      '<span>' + (x.start ? U.fmtDate(x.start) : '—') + ' → ' + (x.end ? U.fmtDate(x.end) : '进行中') + '</span>' +
      (x.start && x.end ? '<span class="badge grey">历时 ' + (U.dayDiff(x.start, x.end) + 1) + ' 天</span>' : '') +
      (total > 0 ? '<span class="badge">⏱ 累计' + dur(total) + '</span>' : '') +
      '</div>' +
      (x.review ? '<div class="item-note">' + esc(x.review) + '</div>' : '') +
      '</div>' +
      UI.ops(x.id, 'edit', 'del',
        (x.type === 'book' ? '<button class="link-btn tap" data-act="logtime" data-id="' + x.id + '">记阅读</button>' : '') +
        (x.end ? '' : '<button class="link-btn tap" data-act="finish" data-id="' + x.id + '">完结</button>') +
        '<button class="link-btn tap" data-act="minfo" data-id="' + x.id + '">详情</button>') +
      '</div>';
  }

  function mFields(type) {
    var f = [
      { k: 'title', label: '作品名称', req: true, full: true, ph: MT[type].t + '名称' },
      { k: 'start', label: '开始' + MT[type].v + '日期', type: 'date', def: U.today() },
      { k: 'end', label: '完结日期', type: 'date', clearable: true, hint: '留空表示进行中' },
      { k: 'score', label: '评分（10 分制）', type: 'number', min: 0, max: 10, step: 0.5, ph: '0 - 10' },
      { k: 'tag', label: '类型标签', ph: '如：悬疑 / 纪录片 / 心理学' },
      { k: 'review', label: '观后感 · 短评 · 备注', type: 'textarea', rows: 5, ph: '写点什么，日后回看会很有意思' }
    ];
    if (type === 'book') {
      f.splice(3, 0, { k: 'status', label: '阅读状态', type: 'select', options: ['想读', '在读', '已读'], def: '在读', hint: '「在读」的书会出现在首页「记录读书时长」的快捷选择里' });
      f.splice(4, 0, { k: 'pages', label: '总页数', type: 'number', min: 0, ph: '如：320' });
      f.splice(5, 0, { k: 'page', label: '当前读到第几页', type: 'number', min: 0, ph: '如：120' });
    }
    return f;
  }

  function dur(mins) {
    mins = Math.round(num(mins));
    if (!mins) return '0 分钟';
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + ' 小时' : '') + (m ? m + ' 分钟' : (h ? '' : '0 分钟'));
  }
  function pageBadge(x) {
    if (x.type !== 'book') return '';
    var p = num(x.page) || 0, total = num(x.pages);
    if (!p && !total) return '';
    var txt = '📄 ' + p + (total ? ' / ' + total : '') + ' 页';
    if (total) txt += ' · ' + Math.min(100, Math.round(p / total * 100)) + '%';
    return '<span class="badge grey">' + txt + '</span>';
  }
  function addReadLog(id) {
    var x = D().media.filter(function (a) { return a.id === id; })[0];
    if (!x) return;
    var isBook = x.type === 'book';
    var fields = [
      { k: 'd', label: '日期', type: 'date', req: true, def: U.today() }
    ];
    if (isBook) {
      fields.push(
        { k: 'from', label: '从（第几页）', type: 'number', min: 0, ph: '如：100' },
        { k: 'to', label: '到（第几页）', type: 'number', min: 0, ph: '如：130' }
      );
    }
    fields.push({ k: 'mins', label: (isBook ? '本次阅读' : MT[x.type].v) + '时长（分钟）', type: 'number', min: 1, req: true, ph: '如：30' });
    UI.form({
      title: '记录' + MT[x.type].v,
      desc: isBook ? '记录某天从哪页读到哪页、读了多久，自动更新当前页数' : '记录某天' + MT[x.type].v + '了多久',
      values: { d: U.today() },
      fields: fields
    }).then(function (v) {
      if (!v) return;
      var log = { id: U.uid(), d: v.d, mins: num(v.mins) };
      if (isBook) {
        log.from = num(v.from) || 0;
        log.to = num(v.to) || 0;
        if (log.to) x.page = log.to;   // 自动更新当前读到第几页
      }
      (x.readLogs = x.readLogs || []).push(log);
      Store.save(); App.refresh(); U.toast('已记录');
    });
  }

  function removeLog(xid, lid) {
    var x = D().media.filter(function (m) { return m.id === xid; })[0];
    if (!x) return;
    x.readLogs = (x.readLogs || []).filter(function (l) { return l.id !== lid; });
    Store.save();
  }

  /* 阅读日志单条：日期 · 第X→Y页 · 读Z */
  function renderLogItem(l, withDel, xid) {
    var parts = [U.fmtDate(l.d, true)];
    if (l.from || l.to) parts.push('第 ' + (l.from || '0') + ' → ' + (l.to || '0') + ' 页');
    if (l.mins) parts.push('读 ' + dur(l.mins));
    return '<div class="item rl-item"><div class="item-main"><div class="item-meta">' +
      parts.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') +
      '</div></div>' + (withDel ? '<button class="link-btn del tap" data-act="rmlog" data-id="' + xid + '" data-lid="' + l.id + '">×</button>' : '') + '</div>';
  }

  /* 全部阅读记录弹窗（点击「更多」后打开） */
  function openReadLogsAll(x) {
    if (!x) return;
    var sorted = (x.readLogs || []).slice().sort(function (a, b) { return b.d.localeCompare(a.d); });
    var body = sorted.length
      ? '<div class="list">' + sorted.map(function (l) { return renderLogItem(l, true, x.id); }).join('') + '</div>'
      : UI.empty('还没有阅读记录', '📖');
    var el = UI.sheet('阅读记录 ·《' + x.title + '》', body,
      '<button class="btn ghost tap" data-x>关闭</button><button class="btn primary tap" data-act="addlog2" data-id="' + x.id + '">+ 记阅读</button>');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'rmlog') {
        var x2 = D().media.filter(function (m) { return m.id === b.dataset.id; })[0];
        removeLog(b.dataset.id, b.dataset.lid);
        openReadLogsAll(x2);
      } else if (a === 'addlog2') { el.remove(); UI.unlock(); addReadLog(b.dataset.id); }
    });
  }

  var media = {
    id: 'media', icon: '🎬', name: '影剧书记录',

    render: function () {
      var type = App.tab('media', 'type', 'movie');
      var arr = D().media.filter(function (x) { return x.type === type; });
      var yStr = U.yr();
      var yArr = arr.filter(function (x) { return x.end && U.yr(x.end) === yStr; });
      var scored = arr.filter(function (x) { return x.score !== '' && x.score !== undefined && x.score !== null; });
      var avg = scored.length ? (scored.reduce(function (s, x) { return s + num(x.score); }, 0) / scored.length).toFixed(1) : '—';

      return UI.head('🎬 影剧书记录', '电影 / 电视剧 / 书籍，统一管理观影与阅读轨迹') +
        UI.tabs(Object.keys(MT).map(function (k) { return { k: k, t: MT[k].t, i: MT[k].i }; }), type, 'type') +
        UI.stats([
          ['今年完结', yArr.length + ' 部', true],
          ['累计记录', arr.length + ' 部'],
          ['进行中', arr.filter(function (x) { return !x.end; }).length + ' 部'],
          ['平均评分', avg]
        ]) +
        UI.card({
          title: MT[type].i + ' ' + MT[type].t + '记录',
          right: '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button>' +
            '<button class="btn primary sm tap" data-act="new">+ 添加' + MT[type].t + '</button>',
          body: this.filters(arr) + '<div style="margin-top:18px">' + this.list(arr) + '</div>'
        }) +
        this.yearly(D().media, type) +
        Cal.card({
          modId: 'media', title: '📅 媒体日历', sub: '数字 = 当天开始的作品数，点日期查看当天',
          cell: function (date) { return D().media.filter(function (x) { return x.start === date; }).length; },
          day: function (date) {
            var arr2 = D().media.filter(function (x) { return x.start === date; });
            if (!arr2.length) return { title: U.fmtDate(date, true) + ' · 影剧书', body: UI.empty('这一天没有开始新的影剧书记录', '🎬') };
            var body = '<div class="list">' + arr2.map(function (x) {
              var total = (x.readLogs || []).reduce(function (s, l) { return s + num(l.mins); }, 0);
              return '<div class="item"><div class="item-main">' +
                '<div class="item-title">' + MT[x.type].i + ' ' + esc(x.title) + '</div>' +
                '<div class="item-meta"><span class="badge grey">' + MT[x.type].t + '</span>' +
                pageBadge(x) +
                (x.tag ? '<span class="badge">' + esc(x.tag) + '</span>' : '') +
                (x.score !== '' && x.score !== undefined ? '<span>评分 ' + num(x.score) + '</span>' : '') +
                (total > 0 ? '<span class="badge">⏱ 累计' + dur(total) + '</span>' : '') +
                '</div>' + (x.review ? '<div class="item-note">' + esc(x.review) + '</div>' : '') +
                '</div></div>';
            }).join('') + '</div>';
            return { title: U.fmtDate(date, true) + ' · ' + arr2.length + ' 部', body: body };
          }
        });
    },

    filters: function (arr) {
      var type = App.tab('media', 'type', 'movie');
      var stPills = type === 'book'
        ? [{ k: 'all', t: '全部' }, { k: 'wish', t: '想读' }, { k: 'reading', t: '在读' }, { k: 'done', t: '已完结' }]
        : [{ k: 'all', t: '全部' }, { k: 'doing', t: '进行中' }, { k: 'done', t: '已完结' }];
      return '<div class="row" style="gap:12px;align-items:flex-start;flex-direction:column">' +
        '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' + TF.btn('media_list') + UI.pills(stPills, App.tab('media', 'st', 'all'), 'st') + '</div>' +
        ListPager.sortPills('media:list', mediaSortKeys) +
        '</div>';
    },

    list: function (arr) {
      var st = App.tab('media', 'st', 'all');
      var type = arr.length ? arr[0].type : App.tab('media', 'type', 'movie');
      var list = arr.filter(function (x) {
        if (type === 'book') {
          if (st === 'wish' && x.status !== '想读') return false;
          if (st === 'reading' && x.status !== '在读') return false;
          if (st === 'done' && !x.end) return false;
        } else {
          if (st === 'doing' && x.end) return false;
          if (st === 'done' && !x.end) return false;
        }
        if (!TF.inRange('media_list', x.end || x.start)) return false;
        return true;
      });
      return ListPager.out({
        ns: 'media:list', items: list, sortKeys: mediaSortKeys, defSize: 5,
        empty: '还没有记录，添加第一部吧', emptyIcon: '🍿', emptyDesc: '看书、追剧、看电影都能记，自动生成年度回顾',
        render: renderMediaItem
      });
    },

    yearly: function (arr, type) {
      var aType = App.tab('media', 'archType', 'all');
      var map = {};
      arr.forEach(function (x) {
        if (!x.end) return;
        if (aType !== 'all' && x.type !== aType) return;
        var y = U.yr(x.end); (map[y] = map[y] || []).push(x);
      });
      var years = Object.keys(map).sort().reverse();
      if (!years.length) return '';
      var apills = [{ k: 'all', t: '全部' }].concat(Object.keys(MT).map(function (k) { return { k: k, t: MT[k].t }; }));
      return UI.card({
        title: '📅 年度归档', sub: '点击「查看」浏览该年完结作品',
        body: UI.pills(apills, aType, 'archType') + '<div style="height:10px"></div>' +
          '<details class="yr-archive" open><summary class="yr-archive-sum">📅 各年度归档（点击' + (aType === 'all' ? '收起' : '展开') + '）</summary>' +
          years.map(function (y) {
            var l = map[y], sc = l.filter(function (x) { return x.score !== '' && x.score !== undefined; });
            var av = sc.length ? (sc.reduce(function (s, x) { return s + num(x.score); }, 0) / sc.length).toFixed(1) : '—';
            var top = U.sortBy(sc, 'score', true)[0];
            return '<button class="opt-row tap" data-act="viewYear" data-k="' + y + '">' +
              '<span class="oi">📅</span>' +
              '<span class="grow">' + y + ' 年 · ' + l.length + ' 部 · 均分 ' + av + (top ? ' · 最高《' + esc(top.title) + '》' : '') + '</span>' +
              '<span class="badge grey">查看 ›</span></button>';
          }).join('') + '</details>'
      });
    },

    acts: {
      type: function (t) { App.setTab('media', 'type', t.dataset.k); App.setTab('media', 'st', 'all'); ListPager.resetPg('media:list'); App.refresh(); },
      archType: function (t) { App.setTab('media', 'archType', t.dataset.k); App.refresh(); },
      st: function (t) { App.setTab('media', 'st', t.dataset.k); ListPager.resetPg('media:list'); App.refresh(); },
      mexp: function (t) {
        var id = t.dataset.id, was = mediaExpanded === id;
        if (!was) App.rememberScroll('exp:' + id);
        mediaExpanded = was ? null : id;
        App.refresh();
        if (was) App.returnToScroll('exp:' + id);
      },
      hist: function () {
        var curType = App.tab('media', 'type', 'movie');
        Hist.open({
          modId: 'media',
          title: MT[curType].i + ' ' + MT[curType].t + '历史记录',
          searchPh: '🔍 搜索' + MT[curType].t + '名 / 短评…',
          pager: true,
          items: function () { return D().media.filter(function (x) { return x.type === curType; }); },
          date: function (x) { return x.start || x.end; },
          match: function (x, q) { return (x.title + ' ' + (x.tag || '') + ' ' + (x.review || '') + ' ' + MT[x.type].t).toLowerCase().indexOf(q) >= 0; },
          extraBar: function (cur) {
            var pills = curType === 'book'
              ? [{ k: '', t: '全部' }, { k: 'wish', t: '想读' }, { k: 'reading', t: '在读' }, { k: 'done', t: '已完结' }]
              : [{ k: '', t: '全部' }, { k: 'doing', t: '进行中' }, { k: 'done', t: '已完结' }];
            return UI.pills(pills, cur, 'histFilter');
          },
          extraMatch: function (x, val) {
            if (curType === 'book') {
              if (val === 'wish') return x.status === '想读';
              if (val === 'reading') return x.status === '在读';
              if (val === 'done') return !!x.end;
              return true;
            }
            if (val === 'doing') return !x.end;
            if (val === 'done') return !!x.end;
            return true;
          },
          sortKeys: [
            { k: 'end', t: '按完结时间', get: function (x) { return x.end || ''; } },
            { k: 'score', t: '按评分', get: function (x) { return num(x.score); } },
            { k: 'start', t: '按开始时间', get: function (x) { return x.start || ''; } }
          ],
          render: function (x) {
            var total = (x.readLogs || []).reduce(function (s, l) { return s + num(l.mins); }, 0);
            return '<div class="item"><div class="item-main">' +
              '<div class="row between"><span class="item-title">' + MT[x.type].i + ' ' + esc(x.title) + '</span>' + UI.scoreTag(x.score) + '</div>' +
              '<div class="item-meta">' +
              (x.end ? '<span class="badge">已完结</span>' : '<span class="badge info">进行中</span>') +
              (x.tag ? '<span class="badge grey">' + esc(x.tag) + '</span>' : '') +
              '<span>' + (x.start ? U.fmtDate(x.start) : '—') + ' → ' + (x.end ? U.fmtDate(x.end) : '进行中') + '</span>' +
              (total > 0 ? '<span class="badge">⏱ 累计' + dur(total) + '</span>' : '') +
              '</div>' +
              (x.review ? '<div class="item-note">' + esc(x.review) + '</div>' : '') +
              '</div>' + UI.ops(x.id, null, 'hdel') + '</div>';
          },
          acts: {
            hdel: function (t, e, redraw) {
              var x = D().media.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!x) return;
              UI.del(esc(x.title), function () {
                D().media = D().media.filter(function (a) { return a.id !== x.id; });
                Store.save();
                if (redraw) redraw();
              });
            }
          }
        });
      },
      viewYear: function (t) {
        var y = t.dataset.k;
        var aType = App.tab('media', 'archType', 'all');
        UI.sheet(y + ' 年归档', viewYearContent(y, aType), '<button class="btn ghost tap" data-x>关闭</button>');
      },
      new: function () {
        var type = App.tab('media', 'type', 'movie');
        UI.form({ title: '添加' + MT[type].t, fields: mFields(type), values: { start: U.today() } }).then(function (v) {
          if (!v) return;
          v.id = U.uid(); v.type = type;
          D().media.push(v); Store.save(); App.refresh(); U.toast('已添加');
        });
      },
      edit: function (t) {
        var x = D().media.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({ title: '编辑记录', fields: mFields(x.type), values: x }).then(function (v) {
          if (!v) return;
          Object.keys(v).forEach(function (k) { x[k] = v[k]; });
          Store.save(); App.refresh();
        });
      },
      finish: function (t) {
        var x = D().media.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({
          title: '标记完结 ·《' + x.title + '》',
          desc: '留空完结日期表示仍在进行中',
          fields: [
            { k: 'end', label: '完结日期', type: 'date', clearable: true, def: U.today() },
            { k: 'score', label: '评分（10 分制）', type: 'number', min: 0, max: 10, step: 0.5 },
            { k: 'review', label: '观后感', type: 'textarea', rows: 5 }
          ], values: { end: U.today(), score: x.score, review: x.review }
        }).then(function (v) {
          if (!v) return;
          x.end = v.end; x.score = v.score; x.review = v.review;
          Store.save(); App.refresh(); U.toast('已完结 🎉');
        });
      },
      del: function (t) {
        var x = D().media.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.title, function () {
          D().media = D().media.filter(function (a) { return a.id !== x.id; });
          Store.save(); App.refresh();
        });
      },
      minfo: function (t) { openMediaInfo(t.dataset.id); },
      logtime: function (t) { addReadLog(t.dataset.id); },
      calPrev: function (t) { Cal.act(t); },
      calNext: function (t) { Cal.act(t); },
      calToday: function (t) { Cal.act(t); },
      calDay: function (t) { Cal.act(t); }
    },

    mount: function () {},
  };
  TF.def('media_list', 'all');
  TF.hook('media_list', function () { ListPager.resetPg('media:list'); App.refresh(); });
  App.register(media);

  /* 备考：科目 / 内容分类 —— 两个独立字段，任填其一即可 */
  function examCatBadges(x) {
    return (x.subject ? '<span class="badge">' + esc(x.subject) + '</span>' : '') +
      (x.contentCat ? '<span class="badge grey">' + esc(x.contentCat) + '</span>' : '');
  }
  function examCatText(x) {
    return [x.subject, x.contentCat].filter(function (s) { return s; }).join(' · ');
  }
  /* 科目 / 内容分类表单字段（可留空） */
  function examCatFields(k1, k2) {
    return [
      Cats.field('examSubject', '科目', { k: k1 || 'subject', def: '', ph: '不选' }),
      Cats.field('examContent', '内容分类', { k: k2 || 'contentCat', def: '', ph: '不选', hint: '科目与内容分类任填其一即可' })
    ];
  }

  /* 备考筛选：科目 / 内容分类，复用与任务待办一致的「灵活胶囊 + 更多 ▾」筛选条。
     直接显示数由各自命名空间的 catPin 控制，可在「分类管理」里调整。 */
  function examCatFilter() {
    var subj = Cats.get('examSubject'), con = Cats.get('examContent');
    if (!subj.length && !con.length) return '';
    return '<div class="exam-filter">' +
      (subj.length ? Cats.filterBar('examSubject', { label: '科目', margin: '4px' }) : '') +
      (con.length ? Cats.filterBar('examContent', { label: '内容', margin: '0' }) : '') +
      '</div>';
  }
  function examFilterFn(x) {
    var subj = Cats.sel('examSubject');
    var cont = Cats.sel('examContent');
    if (subj.length && subj.indexOf(x.subject) < 0) return false;
    if (cont.length && cont.indexOf(x.contentCat) < 0) return false;
    return true;
  }

  /* ---------- 学习计划：显示区间 + 状态 ---------- */
  function planSt() { return App.tab('exam', 'pst', 'all'); }
  // 计划从「设立当天」(created) 一直显示到「预计完成日」(due)；完成后显示到完成日(doneAt)
  function planVisibleOnDay(x, day) {
    var start = x.created || x.due || '';
    var end = x.done ? (x.doneAt || x.due || '') : (x.due || '');
    if (!start || !end) return false;
    return day >= start && day <= end;
  }
  function planStatusOf(x) {
    if (x.done) return 'done';
    if (x.due && U.dayDiff(U.today(), x.due) < 0) return 'overdue';
    return 'doing';
  }

  /* ---------- 艾宾浩斯复习（与学习记录联动） ---------- */
  var EB_INTERVALS = [1, 2, 4, 7, 15, 30];   // 复习间隔（天）
  function reviewStage(x) { return x.reviewStage || 0; }
  function nextReviewDate(x) {
    var s = reviewStage(x);
    if (s >= EB_INTERVALS.length) return null;
    return U.shiftDay(x.date, EB_INTERVALS[s]);
  }
  function reviewStatus(x) {
    if (reviewStage(x) >= EB_INTERVALS.length) return 'done';
    var nd = nextReviewDate(x);
    if (nd && U.dayDiff(U.today(), nd) < 0) return 'overdue';
    return 'doing';
  }

  /* 备考编辑（学习计划 / 学习记录 共用）：after 为保存后的回调（如历史弹窗重绘） */
  function editExamItem(it, after) {
    var x = it.x, kind = it.k;
    var fields = kind === 'plan'
      ? [{ k: 'text', label: '计划内容', req: true, full: true }].concat(examCatFields()).concat([{ k: 'due', label: '预计完成日期', type: 'date' }])
      : [{ k: 'date', label: '日期', type: 'date', req: true }, { k: 'mins', label: '时长（分钟）', type: 'number', min: 0, req: true }].concat(examCatFields()).concat([{ k: 'content', label: '学了什么', type: 'textarea', rows: 4 }]);
    UI.form({
      title: kind === 'plan' ? '编辑学习计划' : '编辑学习记录',
      values: x, fields: fields
    }).then(function (v) { if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); if (after) after(); });
  }

  function renderPlanItem(x) {
    var overdue = x.due && !x.done && U.dayDiff(U.today(), x.due) < 0;
    var cb = examCatBadges(x);
    return '<div class="item' + (x.done ? ' done' : '') + '">' + UI.check(x.done, 'ptoggle', x.id) +
      '<div class="item-main"><div class="item-title">' + esc(x.text) + '</div>' +
      (x.due || cb ? '<div class="item-meta">' + cb +
        (x.due ? '<span class="badge ' + (overdue ? 'danger' : 'grey') + '">📅 ' + U.fmtDate(x.due) + '</span>' : '') + '</div>' : '') +
      '</div>' + UI.ops(x.id, 'pedit', 'pdel') + '</div>';
  }
  function studyContentHtml(c) {
    if (!c) return '';
    return '<div class="item-note study-content">' + esc(c) + '</div>';
  }
  function renderReviewItem(x) {
    var nd = nextReviewDate(x);
    var od = U.dayDiff(U.today(), nd);
    var cls = od < 0 ? 'danger' : od === 0 ? 'warn' : 'grey';
    var txt = od < 0 ? '逾期 ' + Math.abs(od) + ' 天' : od === 0 ? '今天' : od + ' 天后';
    var canMark = nd <= U.today();
    return '<div class="item"><div class="item-main">' +
      '<div class="item-title">' + esc(examCatText(x) || '学习') + (x.content ? ' · ' + esc(x.content.slice(0, 24)) : '') + '</div>' +
      '<div class="item-meta">' + examCatBadges(x) +
      '<span>' + U.fmtDate(x.date, true) + ' 学习</span>' +
      '<span class="badge ' + cls + '">复习 ' + txt + '</span>' +
      '<span class="badge grey">第 ' + (reviewStage(x) + 1) + '/' + EB_INTERVALS.length + ' 次</span>' +
      '</div></div>' +
      (canMark ? '<div class="row" style="margin-top:6px;gap:8px"><button class="link-btn tap" data-act="rmark" data-id="' + x.id + '">✓ 标记已复习</button></div>' : '') +
      '</div>';
  }
  function renderExamRecordItem(x) {
    return '<div class="item"><div class="item-main">' +
      '<div class="row between"><span class="item-title">' + esc(examCatText(x) || '学习') + '</span>' +
      '<span class="badge">' + num(x.mins) + ' 分钟</span></div>' +
      '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span></div>' +
      studyContentHtml(x.content) +
      '</div>' + UI.ops(x.id, 'redit', 'rdel') + '</div>';
  }

  function viewYearContent(y, type) {
    type = type || 'all';
    var l = D().media.filter(function (x) { return x.end && U.yr(x.end) === y && (type === 'all' || x.type === type); });
    var byType = { movie: 0, tv: 0, book: 0 };
    l.forEach(function (x) { byType[x.type] = (byType[x.type] || 0) + 1; });
    var bookPages = l.filter(function (x) { return x.type === 'book'; }).reduce(function (s, x) { return s + (num(x.page) || 0); }, 0);
    var sc = l.filter(function (x) { return x.score !== '' && x.score !== undefined && x.score !== null; });
    var av = sc.length ? (sc.reduce(function (s, x) { return s + num(x.score); }, 0) / sc.length).toFixed(1) : '—';
    var top = U.sortBy(sc, 'score', true)[0];
    var body = UI.stats([
      ['完结', l.length + ' 部', true],
      ['平均评分', av],
      ['年度最佳', top ? num(top.score) : '—'],
      ['影 / 剧 / 书', byType.movie + ' / ' + byType.tv + ' / ' + byType.book],
      ['读书页数', bookPages ? bookPages + ' 页' : '—']
    ]) + '<div style="height:14px"></div>';
    if (top) body += '<div class="muted small" style="margin-bottom:10px">⭐ 年度最高分：《' + esc(top.title) + '》 ' + num(top.score) + ' 分</div>';
    var sorted = l.slice().sort(function (a, b) { return String(b.end).localeCompare(String(a.end)); });
    body += '<div class="small muted" style="margin-bottom:8px">按完结时间倒序 · 共 ' + sorted.length + ' 部</div><div class="list">' +
      sorted.map(function (x) {
        var total = (x.readLogs || []).reduce(function (s, ll) { return s + num(ll.mins); }, 0);
        return '<div class="item"><div class="item-main">' +
          '<div class="row between"><span class="item-title">' + MT[x.type].i + ' ' + esc(x.title) + '</span>' + UI.scoreTag(x.score) + '</div>' +
          '<div class="item-meta">' +
          '<span class="badge">' + MT[x.type].t + '</span>' +
          (x.type === 'book' && x.status ? '<span class="badge ' + (x.status === '在读' ? 'info' : x.status === '已读' ? '' : 'grey') + '">' + esc(x.status) + '</span>' : '') +
          (x.tag ? '<span class="badge grey">' + esc(x.tag) + '</span>' : '') +
          pageBadge(x) +
          '<span>' + (x.start ? U.fmtDate(x.start) : '—') + ' → ' + U.fmtDate(x.end) + '</span>' +
          (total > 0 ? '<span class="badge">⏱ ' + dur(total) + '</span>' : '') +
          '</div>' +
          (x.review ? '<div class="item-note">' + esc(x.review) + '</div>' : '') +
          '</div></div>';
      }).join('') + '</div>';
    return body;
  }

  function openMediaInfo(id) {
    var x = D().media.filter(function (a) { return a.id === id; })[0];
    if (!x) return;
    var logs = x.readLogs || [];
    var total = logs.reduce(function (s, l) { return s + num(l.mins); }, 0);
    var body = '<div class="item" style="margin-bottom:12px"><div class="item-main">' +
      '<div class="item-title">' + MT[x.type].i + ' ' + esc(x.title) + '</div>' +
      '<div class="item-meta"><span class="badge">' + MT[x.type].t + '</span>' +
      (x.end ? '<span class="badge info">已完结</span>' : '<span class="badge grey">进行中</span>') +
      pageBadge(x) +
      (x.tag ? '<span class="badge">' + esc(x.tag) + '</span>' : '') + '</div>' +
      (x.review ? '<div class="item-note">' + esc(x.review) + '</div>' : '') + '</div></div>' +
      '<div class="row between" style="margin:6px 0 10px"><strong>累计' + MT[x.type].v + '时长</strong><span class="badge">' + dur(total) + '</span></div>';
    if (logs.length) {
      var sorted = logs.slice().sort(function (a, b) { return b.d.localeCompare(a.d); });
      var show = sorted.slice(0, 5);
      body += '<div class="small muted" style="margin:10px 0 6px">阅读记录（' + logs.length + ' 次）</div>' +
        '<div class="list rl-list">' + show.map(function (l) { return renderLogItem(l, true, x.id); }).join('') + '</div>';
      if (logs.length > 5) {
        body += '<button class="link-btn tap" data-act="morelogs" data-id="' + x.id + '" style="margin-top:6px">更多（' + logs.length + ' 次）›</button>';
      }
    } else {
      body += '<p class="small muted" style="margin-top:8px">还没有阅读记录，点下面按钮添加。</p>';
    }
    var el = UI.sheet(MT[x.type].v + '记录 ·《' + x.title + '》', body,
      '<button class="btn ghost tap" data-x>关闭</button><button class="btn primary tap" data-act="addlog" data-id="' + x.id + '">+ 记阅读</button>');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'addlog') { el.remove(); UI.unlock(); addReadLog(b.dataset.id); }
      else if (a === 'morelogs') {
        el.remove(); UI.unlock();
        openReadLogsAll(D().media.filter(function (m) { return m.id === b.dataset.id; })[0]);
      } else if (a === 'rmlog') {
        removeLog(b.dataset.id, b.dataset.lid);
        openMediaInfo(id);
      }
    });
  }

  /* =========================================================
     3. 📚 备考计划
  ========================================================= */
  // 备考「学习计划 / 学习记录」当前查看的日期（与打卡/任务/工作留痕一致的前一天·后一天导航）
  var eCur = { day: U.today() };
  function eDayNav() {
    var d = eCur.day, isToday = d === U.today();
    return '<div class="row between" style="margin-bottom:14px">' +
      '<button class="btn sm ghost tap" data-act="eprev">‹ 前一天</button>' +
      '<div style="text-align:center"><div style="font-weight:650">' + U.fmtDate(d, true) + '</div>' +
      '<div class="small muted">' + (isToday ? '今天' : U.relDay(d)) + '</div></div>' +
      '<button class="btn sm ghost tap" data-act="enext">后一天 ›</button></div>' +
      (isToday ? '' : '<div class="row" style="margin-bottom:12px"><button class="link-btn tap" data-act="etoday">↩ 回到今天</button></div>');
  }
  var exam = {
    id: 'exam', icon: '📚', name: '备考计划',

    render: function () {
      var t = App.tab('exam', 'main', 'plan');
      return UI.head('📚 备考计划', '设定考试日期，自由安排计划、记录，按遗忘曲线复习') +
        this.countdown() +
        UI.tabs([{ k: 'plan', t: '学习计划', i: '🗓' }, { k: 'record', t: '学习记录', i: '⏱' }, { k: 'review', t: '复习提醒', i: '🔔' }], t, 'tab') +
        examCatFilter() +
        '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px">' +
        Cats.btn('examSubject', '科目分类', '🗂 科目管理') + Cats.btn('examContent', '内容分类', '🗂 内容管理') +
        '</div>' +
        (t === 'plan' ? this.plans() : t === 'record' ? this.records() : this.review()) +
        Cal.card({
          modId: 'exam', title: '📅 备考日历', sub: '数字 = 当天学习次数，点日期查看当天',
          cell: function (date) { return D().exam.records.filter(function (x) { return x.date === date; }).length; },
          day: function (date) {
            var arr = D().exam.records.filter(function (x) { return x.date === date; });
            if (!arr.length) return { title: U.fmtDate(date, true) + ' · 学习记录', body: UI.empty('这一天没有学习记录', '⏱') };
            var body = '<div class="list">' + arr.map(function (x) {
              return '<div class="item"><div class="item-main">' +
                '<div class="item-title">' + esc(examCatText(x) || '学习') + '</div>' +
                '<div class="item-meta"><span class="badge">' + num(x.mins) + ' 分钟</span></div>' +
                studyContentHtml(x.content) +
                '</div></div>';
            }).join('') + '</div>';
            return { title: U.fmtDate(date, true) + ' · ' + arr.length + ' 次学习', body: body };
          }
        });
    },

    countdown: function () {
      var arr = U.sortBy(D().exam.exams, 'date');
      var body = arr.length ? '<div class="list">' + arr.map(function (x) {
        var n = U.dayDiff(U.today(), x.date);
        var cls = n < 0 ? 'grey' : n <= 7 ? 'danger' : n <= 30 ? 'warn' : '';
        return '<div class="item' + (n >= 0 && n <= 30 ? ' hl' : '') + '">' +
          '<div class="item-main"><div class="item-title">' + esc(x.name) + '</div>' +
          '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span></div>' +
          (x.note ? '<div class="note-text">' + esc(x.note) + '</div>' : '') + '</div>' +
          '<div style="text-align:center"><div class="big-num" style="color:' + (n < 0 ? '#9A8A85' : '#6E8A28') + '">' + (n < 0 ? '已结束' : n === 0 ? '就是今天' : n) + '</div>' +
          (n > 0 ? '<div class="small muted">天后开考</div>' : '') + '</div>' +
          UI.ops(x.id, 'eedit', 'edel') + '</div>';
      }).join('') + '</div>' : UI.empty('还没有设置目标考试，先加一个来看倒计时', '⏳');

      return UI.card({ title: '⏳ 考试倒计时', right: '<button class="btn ghost sm tap" data-act="hist">📜 历史记录</button><button class="btn primary sm tap" data-act="enew">+ 目标考试</button>', body: body });
    },

    plans: function () {
      var day = eCur.day, isToday = day === U.today();
      var st = planSt();
      var arr = D().exam.plans.filter(function (x) {
        if (!planVisibleOnDay(x, day)) return false;     // 从设立当天一直显示到预计完成（或完成日）
        if (st === 'doing' && planStatusOf(x) !== 'doing') return false;
        if (st === 'overdue' && planStatusOf(x) !== 'overdue') return false;
        if (st === 'done' && planStatusOf(x) !== 'done') return false;
        return examFilterFn(x);
      });
      // 概览统计（不随日期切换）
      var all = D().exam.plans;
      var doing = all.filter(function (x) { return planStatusOf(x) === 'doing'; }).length;
      var overdue = all.filter(function (x) { return planStatusOf(x) === 'overdue'; }).length;
      var doneAll = all.filter(function (x) { return x.done; }).length;
      return UI.stats([
        ['总计划', all.length, true], ['进行中', doing], ['已逾期', overdue, overdue > 0], ['已完成', doneAll]
      ]) +
        UI.card({
          title: '🗓 学习计划', sub: isToday ? '今天' : U.fmtDate(day, true),
          right: '<button class="btn ghost sm tap" data-act="planHist">📜 历史记录</button><button class="btn primary sm tap" data-act="pnew">+ 新增计划</button>',
          body: eDayNav() +
            UI.tabs([
              { k: 'doing', t: '进行中' }, { k: 'overdue', t: '逾期' },
              { k: 'done', t: '已完成' }, { k: 'all', t: '全部' }
            ], st, 'pst') +
            '<div style="height:12px"></div>' +
            (arr.length ? UI.bar(doneAll / Math.max(1, all.length) * 100) + '<div style="height:16px"></div>' : '') +
            ListPager.out({ ns: 'exam:plan', items: arr, defSize: 5, empty: '「' + U.fmtDate(day, true) + '」没有对应的学习计划', emptyIcon: '🗓', render: renderPlanItem })
        });
    },

    records: function () {
      var day = eCur.day, isToday = day === U.today();
      var arr = D().exam.records.filter(function (x) {
        if (x.date !== day) return false;            // 按「学习日期」锚定到当天
        return examFilterFn(x);
      }).sort(function (a, b) { return (b.mins || 0) - (a.mins || 0); });
      var tot = arr.reduce(function (s, x) { return s + num(x.mins); }, 0);
      // 概览统计（不随日期切换）
      var all = D().exam.records;
      var totAll = all.reduce(function (s, x) { return s + num(x.mins); }, 0);
      var w0 = U.shiftDay(U.today(), -6);
      var wk = all.filter(function (x) { return x.date >= w0; }).reduce(function (s, x) { return s + num(x.mins); }, 0);
      return UI.stats([
        ['当天学习', (tot / 60).toFixed(1) + ' 小时', true],
        ['近 7 天', (wk / 60).toFixed(1) + ' 小时'],
        ['累计学习', (totAll / 60).toFixed(1) + ' 小时'],
        ['记录条数', all.length]
      ]) +
        UI.card({
          title: '⏱ 学习记录', sub: isToday ? '今天' : U.fmtDate(day, true),
          right: '<button class="btn ghost sm tap" data-act="recordHist">📜 历史记录</button><button class="btn primary sm tap" data-act="rnew">+ 记录一次</button>',
          body: eDayNav() +
            (arr.length
              ? ListPager.out({ ns: 'exam:record', items: arr, defSize: 5, empty: '记录每次学习，日积月累看得见', emptyIcon: '⏱', render: renderExamRecordItem })
              : UI.empty(isToday ? '今天还没有学习记录，点「记录一次」开始' : '「' + U.fmtDate(day, true) + '」没有学习记录', '⏱'))
        });
    },

    /* 复习提醒：与学习记录联动，按艾宾浩斯曲线给出待复习清单 */
    review: function () {
      var pending = D().exam.records.filter(function (x) {
        return reviewStage(x) < EB_INTERVALS.length;   // 未巩固
      }).map(function (x) {
        return { x: x, nd: nextReviewDate(x) };
      }).filter(function (o) { return o.nd; }).sort(function (a, b) { return a.nd.localeCompare(b.nd); });
      var dueToday = pending.filter(function (o) { return o.nd === U.today(); }).length;
      var overdue = pending.filter(function (o) { return U.dayDiff(U.today(), o.nd) < 0; }).length;
      var consolidated = D().exam.records.filter(function (x) { return reviewStage(x) >= EB_INTERVALS.length; }).length;
      return UI.stats([
        ['待复习', pending.length, true], ['今天', dueToday], ['已逾期', overdue, overdue > 0], ['已巩固', consolidated]
      ]) +
        UI.card({
          title: '🔔 复习提醒（艾宾浩斯）', sub: '在学习后第 ' + EB_INTERVALS.join(' / ') + ' 天复习，记忆最牢固',
          right: '<button class="btn ghost sm tap" data-act="rHist">📜 历史记录</button>',
          body: pending.length
            ? ListPager.out({ ns: 'exam:review', items: pending.map(function (o) { return o.x; }), defSize: 8, empty: '', render: renderReviewItem })
            : UI.empty('暂无待复习内容，去学习并记录一条吧', '🔔')
        });
    },

    acts: {
      tab: function (t) { App.setTab('exam', 'main', t.dataset.k); App.refresh(); },
      pst: function (t) { App.setTab('exam', 'pst', t.dataset.k); ListPager.resetPg('exam:plan'); App.refresh(); },
      eprev: function () { eCur.day = U.shiftDay(eCur.day, -1); ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record'); App.refresh(); },
      enext: function () { eCur.day = U.shiftDay(eCur.day, 1); ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record'); App.refresh(); },
      etoday: function () { eCur.day = U.today(); ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record'); App.refresh(); },
      eday: function (t) { eCur.day = t.dataset.d; ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record'); App.refresh(); },
      enew: function () {
        UI.form({
          title: '目标考试', fields: [
            { k: 'name', label: '考试名称', req: true, full: true, ph: '如：初级会计职称' },
            { k: 'date', label: '考试日期', type: 'date', req: true, def: U.today() },
            { k: 'note', label: '备注', full: true, ph: '考点、科目安排…' }
          ]
        }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().exam.exams.push(v); Store.save(); App.refresh();
        });
      },
      eedit: function (t) {
        var x = D().exam.exams.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.form({
          title: '编辑考试', values: x, fields: [
            { k: 'name', label: '考试名称', req: true, full: true },
            { k: 'date', label: '考试日期', type: 'date', req: true },
            { k: 'note', label: '备注', full: true }
          ]
        }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      edel: function (t) {
        var x = D().exam.exams.filter(function (a) { return a.id === t.dataset.id; })[0];
        UI.del(x.name, function () { D().exam.exams = D().exam.exams.filter(function (a) { return a.id !== x.id; }); Store.save(); App.refresh(); });
      },
      pnew: function () {
        UI.form({
          title: '新增学习计划', fields: [
            { k: 'text', label: '计划内容', req: true, full: true, ph: '如：刷完第三章课后题' }
          ].concat(examCatFields()).concat([
            { k: 'due', label: '预计完成日期', type: 'date' }
          ])
        }).then(function (v) {
          if (!v) return; v.id = U.uid(); v.done = false;
          if (!v.due) v.due = eCur.day;   // 不填预计完成日期时，默认锚定到当前查看日，确保在对应列表显示
          v.created = v.created || U.today();   // 从设立当天起显示，直到预计完成日
          D().exam.plans.push(v); Store.save(); App.refresh(); U.toast('已添加');
        });
      },
      pedit: function (t) {
        var x = D().exam.plans.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        UI.form({
          title: '编辑学习计划', values: x, fields: [
            { k: 'text', label: '计划内容', req: true, full: true }
          ].concat(examCatFields()).concat([
            { k: 'due', label: '预计完成日期', type: 'date' }
          ])
        }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      ptoggle: function (t) {
        D().exam.plans.forEach(function (x) {
          if (x.id === t.dataset.id) { x.done = !x.done; x.doneAt = x.done ? U.today() : ''; }
        });
        Store.save(); App.refresh();
      },
      pdel: function (t) {
        D().exam.plans = D().exam.plans.filter(function (a) { return a.id !== t.dataset.id; });
        Store.save(); App.refresh();
      },
      rnew: function () {
        UI.form({
          title: '学习记录', values: { date: eCur.day }, fields: [
            { k: 'date', label: '日期', type: 'date', req: true, def: U.today() },
            { k: 'mins', label: '时长（分钟）', type: 'number', min: 0, req: true }
          ].concat(examCatFields()).concat([
            { k: 'content', label: '学了什么', type: 'textarea', rows: 4 }
          ])
        }).then(function (v) {
          if (!v) return; v.id = U.uid(); D().exam.records.push(v); Store.save(); App.refresh(); U.toast('已记录');
        });
      },
      redit: function (t) {
        var x = D().exam.records.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        UI.form({
          title: '编辑学习记录', values: x, fields: [
            { k: 'date', label: '日期', type: 'date', req: true },
            { k: 'mins', label: '时长（分钟）', type: 'number', min: 0, req: true }
          ].concat(examCatFields()).concat([
            { k: 'content', label: '学了什么', type: 'textarea', rows: 4 }
          ])
        }).then(function (v) {
          if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); App.refresh();
        });
      },
      rdel: function (t) {
        D().exam.records = D().exam.records.filter(function (a) { return a.id !== t.dataset.id; });
        Store.save(); App.refresh();
      },
      /* 标记已复习：推进艾宾浩斯复习阶段（与学习记录联动） */
      rmark: function (t) {
        var x = D().exam.records.filter(function (a) { return a.id === t.dataset.id; })[0];
        if (!x) return;
        x.reviewStage = (x.reviewStage || 0) + 1;
        Store.save(); App.refresh(); U.toast('已记录第 ' + (x.reviewStage + 1) + ' 次复习');
      },
      /* 复习进度总览（艾宾浩斯）：所有学习记录的复习阶段一览 */
      rHist: function () {
        var modId = 'exam_review';
        var ST = [
          { k: 'all', t: '全部' }, { k: 'doing', t: '待复习' },
          { k: 'overdue', t: '已逾期' }, { k: 'done', t: '已巩固' }
        ];
        Hist.open({
          modId: modId, title: '🔔 复习进度总览', searchPh: '🔍 搜索科目 / 内容…',
          pager: true, defSize: 8, items: function () { return D().exam.records; },
          date: function (x) { return x.date; },
          match: function (x, q) { return ((x.subject || '') + ' ' + (x.contentCat || '') + ' ' + (x.content || '')).toLowerCase().indexOf(q) >= 0; },
          sort: function (a, b) { return String(b.date).localeCompare(String(a.date)); },
          empty: '还没有学习记录',
          extraBar: function (cur) { return UI.pills(ST, cur, 'histFilter'); },
          extraMatch: function (x, v) { if (!v || v === 'all') return true; return reviewStatus(x) === v; },
          render: function (x) {
            var st = reviewStatus(x);
            var nd = nextReviewDate(x);
            var stBadge = st === 'done' ? '<span class="badge">已巩固</span>'
              : st === 'overdue' ? '<span class="badge danger">已逾期</span>'
              : '<span class="badge warn">待复习</span>';
            var ndTxt = nd ? ('复习 ' + U.fmtDate(nd)) : '已巩固';
            return '<div class="item"><div class="item-main">' +
              '<div class="row between"><span class="item-title">' + esc(examCatText(x) || '学习') + (x.content ? ' · ' + esc(x.content.slice(0, 24)) : '') + '</span>' +
              '<span class="badge">' + num(x.mins) + ' 分钟</span></div>' +
              '<div class="item-meta">' + examCatBadges(x) + '<span>' + U.fmtDate(x.date, true) + ' 学习</span>' +
              stBadge + '<span class="badge grey">第 ' + (reviewStage(x) + 1) + '/' + EB_INTERVALS.length + ' 次</span>' +
              '<span>' + ndTxt + '</span></div>' +
              studyContentHtml(x.content) + '</div></div>';
          }
        });
      },
      /* 学习计划 · 独立历史记录（只搜学习计划） */
      planHist: function () {
        var modId = 'exam_plan';
        var STATUS = [
          { k: 'all', t: '全部' }, { k: 'doing', t: '进行中' },
          { k: 'overdue', t: '逾期' }, { k: 'done', t: '已完成' }
        ];
        Hist.open({
          modId: modId, title: '🗓 学习计划历史记录', searchPh: '🔍 搜索计划内容 / 科目…',
          pager: true, defSize: 5, items: function () { return D().exam.plans; },
          date: function (x) { return x.due; },
          match: function (x, q) { return ((x.text || '') + ' ' + (x.subject || '') + ' ' + (x.contentCat || '')).toLowerCase().indexOf(q) >= 0; },
          sort: function (a, b) { return String(b.due || '').localeCompare(String(a.due || '')); },
          empty: '没有符合条件的学习计划',
          extraBar: function (cur) { return UI.pills(STATUS, cur, 'histFilter'); },
          extraMatch: function (x, v) { if (!v || v === 'all') return true; return planStatusOf(x) === v; },
          extraBar2: function (cur) { return Hist.catPills('examSubject', cur, 'histFilter2', '2', modId, '科目'); },
          extraMatch2: function (x, v) { if (!v) return true; return x.subject === v; },
          extraBar3: function (cur) { return Hist.catPills('examContent', cur, 'histFilter3', '3', modId, '内容'); },
          extraMatch3: function (x, v) { if (!v) return true; return x.contentCat === v; },
          render: function (x) {
            var overdue = x.due && !x.done && U.dayDiff(U.today(), x.due) < 0;
            var cb = examCatBadges(x);
            return '<div class="item' + (x.done ? ' done' : '') + '">' +
              '<div class="item-main"><div class="item-title">' + esc(x.text) + '</div>' +
              (cb || x.due || !x.done ? '<div class="item-meta">' + cb +
                (x.due ? '<span class="badge ' + (overdue ? 'danger' : 'grey') + '">📅 ' + U.fmtDate(x.due) + '</span>' : '') +
                (x.done ? '<span class="badge">已完成</span>' : (overdue ? '' : '<span class="badge info">进行中</span>')) + '</div>' : '') +
              '</div>' + UI.ops(x.id, 'pedit', 'hdel') + '</div>';
          },
          acts: {
            pedit: function (t, e, redraw) {
              var x = D().exam.plans.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!x) return;
              UI.form({ title: '编辑学习计划', values: x, fields: [
                { k: 'text', label: '计划内容', req: true, full: true }
              ].concat(examCatFields()).concat([{ k: 'due', label: '预计完成日期', type: 'date' }]) })
                .then(function (v) { if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); if (redraw) redraw(); });
            },
            hdel: function (t, e, redraw) {
              var x = D().exam.plans.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!x) return;
              UI.del(esc(x.text || '学习计划'), function () {
                D().exam.plans = D().exam.plans.filter(function (a) { return a.id !== x.id; });
                Store.save();
                if (redraw) redraw();
              });
            }
          }
        });
      },
      /* 学习记录 · 独立历史记录（只搜学习记录） */
      recordHist: function () {
        var modId = 'exam_record';
        Hist.open({
          modId: modId, title: '⏱ 学习记录历史记录', searchPh: '🔍 搜索科目 / 内容 / 日期…',
          pager: true, defSize: 5, items: function () { return D().exam.records; },
          date: function (x) { return x.date; },
          match: function (x, q) { return ((x.subject || '') + ' ' + (x.contentCat || '') + ' ' + (x.content || '') + ' ' + (x.date || '')).toLowerCase().indexOf(q) >= 0; },
          sort: function (a, b) { return String(b.date).localeCompare(String(a.date)); },
          empty: '该时间段内没有学习记录',
          extraBar2: function (cur) { return Hist.catPills('examSubject', cur, 'histFilter2', '2', modId, '科目'); },
          extraMatch2: function (x, v) { if (!v) return true; return x.subject === v; },
          extraBar3: function (cur) { return Hist.catPills('examContent', cur, 'histFilter3', '3', modId, '内容'); },
          extraMatch3: function (x, v) { if (!v) return true; return x.contentCat === v; },
          render: function (x) {
            return '<div class="item"><div class="item-main">' +
              '<div class="row between"><span class="item-title">' + esc(examCatText(x) || '学习') + '</span>' +
              '<span class="badge">' + num(x.mins) + ' 分钟</span></div>' +
              '<div class="item-meta"><span>' + U.fmtDate(x.date, true) + '</span></div>' +
              studyContentHtml(x.content) +
              '</div>' + UI.ops(x.id, 'redit', 'hdel') + '</div>';
          },
          acts: {
            redit: function (t, e, redraw) {
              var x = D().exam.records.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!x) return;
              UI.form({ title: '编辑学习记录', values: x, fields: [
                { k: 'date', label: '日期', type: 'date', req: true },
                { k: 'mins', label: '时长（分钟）', type: 'number', min: 0, req: true }
              ].concat(examCatFields()).concat([{ k: 'content', label: '学了什么', type: 'textarea', rows: 4 }]) })
                .then(function (v) { if (!v) return; Object.keys(v).forEach(function (k) { x[k] = v[k]; }); Store.save(); if (redraw) redraw(); });
            },
            hdel: function (t, e, redraw) {
              var x = D().exam.records.filter(function (a) { return a.id === t.dataset.id; })[0];
              if (!x) return;
              UI.del(esc(examCatText(x) || '学习记录'), function () {
                D().exam.records = D().exam.records.filter(function (a) { return a.id !== x.id; });
                Store.save();
                if (redraw) redraw();
              });
            }
          }
        });
      },
      calPrev: function (t) { Cal.act(t); },
      calNext: function (t) { Cal.act(t); },
      calToday: function (t) { Cal.act(t); },
      calDay: function (t) { eCur.day = t.dataset.d; ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record'); Cal.act(t); },
      hist: function () {
        var items = function () {
          var a = [];
          (D().exam.records || []).forEach(function (x) { a.push({ k: 'record', x: x }); });
          (D().exam.plans || []).forEach(function (x) { a.push({ k: 'plan', x: x }); });
          return a;
        };
        Hist.open({
          modId: 'exam',
          title: '📚 备考历史记录',
          searchPh: '🔍 搜索内容 / 科目 / 标题…',
          pager: true,
          items: items,
          date: function (it) { return it.k === 'plan' ? it.x.due : it.x.date; },
          match: function (it, q) {
            var x = it.x;
            var hay = (it.k === 'plan' ? (x.text || '') : '') + ' ' + (x.subject || '') + ' ' + (x.contentCat || '') + ' ' + (x.content || '');
            return hay.toLowerCase().indexOf(q) >= 0;
          },
          sort: function (a, b) { return String(b.x.date || b.x.due || '').localeCompare(String(a.x.date || a.x.due || '')); },
          render: function (it) {
            var x = it.x;
            var label = it.k === 'record' ? '⏱ 学习' : '🗓 计划';
            var dd = it.k === 'plan' ? x.due : x.date;
            return '<div class="item"><div class="item-main">' +
              '<div class="row between"><span class="item-title">' + esc(it.k === 'plan' ? (x.text || '计划') : (examCatText(x) || '学习')) + '</span>' +
              '<span class="badge grey">' + label + '</span></div>' +
              '<div class="item-meta">' + examCatBadges(x) +
              (dd ? '<span>' + U.fmtDate(dd) + (it.k === 'plan' ? '（计划）' : '') + '</span>' : '') + '</div>' +
              studyContentHtml(x.content) +
              '</div>' + UI.ops(x.id, it.k === 'plan' ? 'pedit' : 'redit', 'hdel') + '</div>';
          },
          acts: {
            pedit: function (t, e, redraw) { var it = items().filter(function (a) { return a.x && a.x.id === t.dataset.id; })[0]; if (it) editExamItem(it, redraw); },
            redit: function (t, e, redraw) { var it = items().filter(function (a) { return a.x && a.x.id === t.dataset.id; })[0]; if (it) editExamItem(it, redraw); },
            hdel: function (t, e, redraw) {
              var it = items().filter(function (a) { return a.x && a.x.id === t.dataset.id; })[0];
              if (!it) return;
              UI.del(esc(it.k === 'plan' ? (it.x.text || '计划') : (examCatText(it.x) || '记录')), function () {
                if (it.k === 'plan') D().exam.plans = D().exam.plans.filter(function (a) { return a.id !== it.x.id; });
                else if (it.k === 'record') D().exam.records = D().exam.records.filter(function (a) { return a.id !== it.x.id; });
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
  /* 备考科目 / 内容分类筛选：多选回调（全部/固定/更多 复用全局 catPick 委托） */
  Cats.setPicker('examSubject', function () {
    ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record');
    App.refresh();
  });
  Cats.setPicker('examContent', function () {
    ListPager.resetPg('exam:plan'); ListPager.resetPg('exam:record');
    App.refresh();
  });

  App.register(exam);


})();
