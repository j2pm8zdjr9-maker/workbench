/* ================= 自动备份引擎 ================= */
/* 纯前端实现：把 localStorage 中的整份数据 PUT 到远端（NAS 的 WebDAV / GitHub Gist）。
   所有凭据仅存于本机 localStorage，不会离开浏览器，也不会上传到任何服务器。 */
(function () {
  'use strict';
  var w = window;

  // UTF-8 安全的 Base64（用于 HTTP Basic Auth）
  function b64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function def() {
    return {
      enabled: false,
      webdav: { enabled: false, url: '', user: '', pass: '', file: 'workbench-backup.json' },
      gist: { enabled: false, token: '', gist: '', file: 'workbench-backup.json', api: 'https://api.github.com' },
      last: { time: '', ok: false, msg: '' }
    };
  }

  function cfg() {
    var s = Store.data.settings;
    if (!s.backup) s.backup = def();
    return s.backup;
  }

  function payload() {
    return JSON.stringify({
      app: '个人工作台', version: 1,
      exportedAt: new Date().toLocaleString('zh-CN'),
      data: Store.data
    }, null, 2);
  }

  function record(ok, msg) {
    var c = cfg();
    c.last = { time: new Date().toLocaleString('zh-CN'), ok: ok, msg: msg || '' };
    Store.save(true);
  }

  // ---------- WebDAV (NAS / 支持 WebDAV 的网盘) ----------
  function uploadWebdav(c) {
    if (!c.url) return Promise.reject(new Error('未填写 WebDAV 地址'));
    if (!/^https?:\/\//i.test(c.url)) return Promise.reject(new Error('地址需以 http(s):// 开头'));
    if (!c.user) return Promise.reject(new Error('未填写用户名'));
    if (c.pass === '' || c.pass === undefined) return Promise.reject(new Error('未填写密码'));
    var base = c.url.replace(/\/+$/, '') + '/';
    var file = (c.file || 'workbench-backup.json').replace(/\/+/g, '');
    var target = base + encodeURIComponent(file);
    var auth = 'Basic ' + b64(c.user + ':' + c.pass);
    return fetch(target, {
      method: 'PUT',
      mode: 'cors',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: payload()
    }).then(function (r) {
      if (r.ok || r.status === 201 || r.status === 204) return true;
      if (r.status === 401 || r.status === 403) throw new Error('认证失败（用户名/密码错误，或该路径无写入权限）');
      if (r.status === 0) throw new Error('无法连接：多半是跨域 CORS 被拦截，请在 WebDAV 服务端允许本应用域名跨域');
      throw new Error('HTTP ' + r.status);
    });
  }

  // ---------- GitHub Gist ----------
  function uploadGist(c) {
    if (!c.token) return Promise.reject(new Error('未填写 GitHub Token'));
    var api = (c.api || 'https://api.github.com').replace(/\/+$/, '');
    var fn = c.file || 'workbench-backup.json';
    var headers = {
      'Authorization': 'Bearer ' + c.token,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json'
    };
    var url, method, body = { files: {} };
    body.files[fn] = { content: payload() };
    if (c.gist) {
      method = 'PATCH';
      url = api + '/gists/' + c.gist;
    } else {
      method = 'POST';
      url = api + '/gists';
      body.description = '个人工作台自动备份';
      body.public = false;
    }
    return fetch(url, { method: method, headers: headers, body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + String(t).slice(0, 140)); });
      return r.json();
    }).then(function (j) {
      if (!c.gist && j && j.id) { c.gist = j.id; Store.save(true); }
      return j;
    });
  }

  function runOne(name, fn) {
    return Promise.resolve().then(fn).then(function () {
      return { name: name, ok: true, msg: '成功' };
    }, function (e) {
      return { name: name, ok: false, msg: (e && e.message) || String(e) };
    });
  }

  // 三件套触发：保存防抖(30s) + 启动(延迟4s) + 每小时定时
  var runTimer = null, hourTimer = null;

  function schedule() {
    var c = cfg();
    if (!c.enabled) return;
    if (runTimer) clearTimeout(runTimer);
    runTimer = setTimeout(function () { run({ silent: true }); }, 30000);
  }

  function run(opts) {
    opts = opts || {};
    var c = cfg();
    if (!c.enabled) return Promise.resolve();
    var jobs = [];
    if (c.webdav.enabled) jobs.push(runOne('WebDAV(NAS)', function () { return uploadWebdav(c.webdav); }));
    if (c.gist.enabled) jobs.push(runOne('GitHub', function () { return uploadGist(c.gist); }));
    if (!jobs.length) {
      if (!opts.silent) U.toast('请先在设置里启用至少一个备份目标');
      return Promise.resolve();
    }
    var silent = !!opts.silent;
    return Promise.all(jobs).then(function (res) {
      var ok = res.every(function (r) { return r.ok; });
      var msg = res.map(function (r) { return r.name + (r.ok ? ' ✓' : ' ✗(' + r.msg + ')'); }).join('，');
      record(ok, msg);
      if (!silent) {
        U.toast(ok ? '备份完成 ✅' : '部分备份失败：' + msg);
        if (w.App && App.current === 'settings') App.refresh();
      }
      return res;
    });
  }

  // 仅对单个目标做一次真实备份，用于「测试连接」
  function test(target) {
    var c = cfg();
    var p;
    if (target === 'webdav') {
      if (!c.webdav.url) { U.toast('请先填写 WebDAV 配置'); return; }
      p = runOne('WebDAV', function () { return uploadWebdav(c.webdav); });
    } else if (target === 'gist') {
      if (!c.gist.token) { U.toast('请先填写 GitHub Token'); return; }
      p = runOne('GitHub', function () { return uploadGist(c.gist); });
    }
    if (!p) return;
    return p.then(function (r) {
      U.toast(r.ok ? target === 'webdav' ? 'WebDAV 连接成功 ✅' : 'GitHub 连接成功 ✅' : '连接失败：' + r.msg);
      if (w.App && App.current === 'settings') App.refresh();
      return r;
    });
  }

  function init() {
    var c = cfg();
    if (!c.enabled) return;
    setTimeout(function () { run({ silent: true }); }, 4000);
    if (hourTimer) clearInterval(hourTimer);
    hourTimer = setInterval(function () { run({ silent: true }); }, 3600000);
  }

  w.Backup = { run: run, schedule: schedule, test: test, init: init, cfg: cfg, def: def };
})();
