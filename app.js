/* Điều khiển ứng dụng: trạng thái, gọi máy chủ, xử lý thao tác. */
const TK = 'bh-xe-token', LU = 'bh-xe-last-user', CK = 'bh-xe-cache';
const S = {
  token: localStorage.getItem(TK) || '', lastUser: localStorage.getItem(LU) || '',
  installHidden: false, logSel: null, logAct: {}, logEdit: null, reqSel: null, reqAct: {}, reqEdit: null, viewer: null, reqFilter: '', logFilter: '', logDrv: '', data: null, tab: '', sel: null, pick: {}, act: {}, form: null, filter: 'pending', week: 0, period: 'm1',
  notifOpen: false, toast: '', toastErr: false, loading: false, busy: false, loginErr: '', seen: null
};
const root = document.getElementById('app');
/* ------------------------------------------------------------ cài app (PWA) */
let _installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canInstall = () => !isStandalone() && (!!_installEvt || isIOS() || !S.installHidden);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEvt = e; render(); });
window.addEventListener('appinstalled', () => { _installEvt = null; S.installHidden = true; toast('Đã cài app lên thiết bị'); });

/* ------------------------------------------------------------ máy chủ */
let _demo = null;
function demoCtx() {
  if (_demo) return _demo;
  const KEY = 'bh-xe-demo-db-v3';
  let db = null; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const ctx = {
    db: {
      all: t => (db[t] || []).map(x => Object.assign({}, x)),
      insert: (t, o) => { (db[t] = db[t] || []).push(Object.assign({}, o)); save(); },
      update: (t, id, p) => { const r = (db[t] || []).find(x => String(x.id) === String(id)); if (r) Object.assign(r, p); save(); },
      remove: (t, id) => { db[t] = (db[t] || []).filter(x => String(x.id) !== String(id)); save(); }
    },
    hash: s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16); },
    uuid: () => (Date.now().toString(16) + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).slice(0, 32),
    now: () => Date.now(), today: () => today(),
    saveFile: (name, mime, b64) => {
      const id = 'DEMO' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem('bh-xe-demo-file-' + id, JSON.stringify({ mime, name, data: b64 })); }
      catch (e) { throw new Error('Bộ nhớ trình duyệt đã đầy (chế độ dùng thử). Bấm "Khôi phục dữ liệu dùng thử" hoặc chọn file nhỏ hơn.'); }
      return 'https://drive.google.com/file/d/' + id + '/view';
    },
    readFile: id => { const s = localStorage.getItem('bh-xe-demo-file-' + id); if (!s) throw new Error('Không tìm thấy chứng từ (dữ liệu dùng thử đã bị xoá).'); return JSON.parse(s); }
  };
  if (!db || !db.users) { db = {}; Object.keys(BH_TABLES).forEach(t => db[t] = []); demoSeed(ctx); save(); }
  _demo = ctx; return ctx;
}
function resetDemo() { localStorage.removeItem('bh-xe-demo-db-v3'); Object.keys(localStorage).filter(k => k.startsWith('bh-xe-demo-file-')).forEach(k => localStorage.removeItem(k)); _demo = null; }

async function call(action, params) {
  const req = { action, params: params || {}, token: S.token };
  let res;
  if (!API_URL) {
    await new Promise(r => setTimeout(r, 120));
    res = BH_api(demoCtx(), JSON.parse(JSON.stringify(req)));
  } else {
    let r;
    const body = JSON.stringify(req), big = action === 'file.upload' || action === 'log.save' || body.length > 1500;
    try { r = big ? await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }) : await fetch(API_URL + '?q=' + encodeURIComponent(body)); }
    catch (e) { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'); }
    if (!r.ok) throw new Error('Máy chủ trả lỗi ' + r.status + '.');
    try { res = await r.json(); } catch (e) { throw new Error('Máy chủ trả dữ liệu không hợp lệ. Kiểm tra lại quyền truy cập của Web App ("Bất kỳ ai").'); }
  }
  if (!res.ok) {
    if (res.auth) { S.token = ''; localStorage.removeItem(TK); localStorage.removeItem(CK); S.data = null; S.loginErr = res.error; }
    const e = new Error(res.error); e.auth = res.auth; throw e;
  }
  return res.data;
}

async function load(silent) {
  if (!S.token) return render();
  S.loading = true; if (!silent) render();
  try {
    const data = await call('bootstrap');
    const unread = data.notifs.filter(n => !n.read);
    if (S.seen) unread.filter(n => !S.seen.has(n.id)).slice(0, 3).forEach(n => pushNotify(n.text));
    S.seen = new Set(data.notifs.map(n => n.id));
    S.data = data; S.bootErr = '';
    try { localStorage.setItem(CK, JSON.stringify(data)); } catch (e) { localStorage.removeItem(CK); }
    const tabs = (TABS[data.me.role] || []).map(x => x[0]);
    if (!tabs.includes(S.tab)) S.tab = tabs[0];
    if (S.sel && !data.trips.find(t => t.id === S.sel)) S.sel = null;
    if (S.reqSel && !(data.mreqs || []).find(r => String(r.id) === String(S.reqSel))) S.reqSel = null;
    if (S.logSel && !(data.logs || []).find(l => String(l.id) === String(S.logSel))) S.logSel = null;
  } catch (e) {
    if (!e.auth) { if (S.data) toast(e.message, true); else S.bootErr = e.message; }
  }
  S.loading = false; render();
}

function pushNotify(text) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: text, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'bh-' + Date.now() };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification('Xe công tác Bảo Hưng', opts)).catch(() => { });
  else try { new Notification('Xe công tác Bảo Hưng', opts); } catch (e) { }
}

let _tt;
function toast(msg, err) { S.toast = msg; S.toastErr = !!err; render(); clearTimeout(_tt); _tt = setTimeout(() => { S.toast = ''; render(); }, err ? 4500 : 2800); }

async function mutate(action, params, okMsg, after) {
  S.busy = true; render();
  try {
    await call(action, params);
    if (after) after();
    await load(true);
    if (okMsg) toast(okMsg);
  } catch (e) {
    if (e.auth) { S.busy = false; return render(); }
    if (S.form) S.form.err = e.message; else if (S.logEdit) S.logEdit.err = e.message; else if (S.logSel) S.logAct.err = e.message; else if (S.reqEdit) S.reqEdit.err = e.message; else if (S.reqSel) S.reqAct.err = e.message; else if (S.sel) S.act.err = e.message; else toast(e.message, true);
  }
  S.busy = false; render();
}

/* ------------------------------------------------------------ render */
function render() {
  const dr = document.querySelector('.dr-b'), drTop = dr ? dr.scrollTop : 0, y = window.scrollY;
  root.innerHTML = S.data ? vApp() : S.token ? vBoot() : vLogin();
  const dr2 = document.querySelector('.dr-b'); if (dr2) dr2.scrollTop = drTop;
  window.scrollTo(0, y);
}

/* ------------------------------------------------------------ thao tác */
const sel = () => S.data.trips.find(t => t.id === S.sel);
const A = {
  tab: v => { S.tab = v; S.sel = null; window.scrollTo(0, 0); },
  filter: v => { if (v) S.filter = v; },
  week: v => { S.week = v === '0' ? 0 : S.week + Number(v); },
  period: v => { S.period = v; },
  open: v => { const t = S.data.trips.find(x => x.id === v); if (!t || t.limited) return; S.sel = v; S.pick = { car: t.carId || null, drv: t.drvId || null }; S.act = {}; S.notifOpen = false; },
  closeSel: () => { S.sel = null; S.act = {}; },
  pickCar: v => { S.pick.car = v; S.act.err = ''; },
  pickDrv: v => { S.pick.drv = v; S.act.err = ''; },
  actRej: () => { S.act = { rej: true }; },
  actCancel: () => { S.act = { cancel: true }; },
  actReset: () => { S.act = {}; },
  doAssign: () => mutate('trip.assign', { id: S.sel, carId: S.pick.car, drvId: S.pick.drv }, 'Đã xếp xe và gửi thông báo cho lái xe', () => { S.act = {}; }),
  doReject: () => { if (!(S.act.reason || '').trim()) { S.act.err = 'Vui lòng nhập lý do.'; return; } return mutate('trip.reject', { id: S.sel, reason: S.act.reason }, 'Đã từ chối yêu cầu', () => { S.act = {}; }); },
  doCancel: () => mutate('trip.cancel', { id: S.sel, reason: S.act.reason || '' }, 'Đã huỷ chuyến', () => { S.act = {}; }),
  doAccept: () => mutate('trip.accept', { id: S.sel }, 'Đã nhận chuyến', () => { S.act = {}; }),
  doDecline: () => { if (!(S.act.reason || '').trim()) { S.act.err = 'Vui lòng nhập lý do.'; return; } return mutate('trip.decline', { id: S.sel, reason: S.act.reason }, 'Đã báo Điều phối xếp lại', () => { S.act = {}; S.sel = null; }); },
  doStart: () => mutate('trip.start', { id: S.sel, kmStart: S.act.kmStart }, 'Đã bắt đầu chuyến', () => { S.act = {}; }),
  doFinish: () => mutate('trip.finish', { id: S.sel, kmEnd: S.act.kmEnd, fuel: S.act.fuel, toll: S.act.toll, park: S.act.park, other: S.act.other }, 'Đã ghi nhận hoàn thành chuyến', () => { S.act = {}; }),
  newTrip: () => { const u = S.data.me; S.form = { kind: 'trip', vals: { name: u.name, dept: u.dept || 'Kinh doanh', phone: u.phone || '', dest: '', purpose: '', start: addD(today(), 1), end: addD(today(), 1), time: '08:00', pax: '1' } }; },
  addCar: () => { S.form = { kind: 'car', vals: { plate: '', model: '', seats: '7', odo: '', dk: addD(today(), 365), bh: addD(today(), 365), svcKm: '' } }; },
  editCar: v => { const c = S.data.cars.find(x => String(x.id) === v); S.form = { kind: 'car', vals: Object.assign({}, c, { active: 'true' }) }; },
  addDriver: () => { S.form = { kind: 'driver', vals: { name: '', phone: '', lic: 'D', licExp: addD(today(), 365 * 3) } }; },
  editDriver: v => { const c = S.data.drivers.find(x => String(x.id) === v); S.form = { kind: 'driver', vals: Object.assign({}, c, { active: 'true' }) }; },
  addMaint: v => { const c = S.data.cars.find(x => String(x.id) === v) || S.data.cars[0]; if (!c) return toast('Chưa có xe trong danh mục.', true); S.form = { kind: 'maint', vals: { carId: c.id, type: 'Bảo dưỡng', date: today(), km: String(N(c.odo)), content: '', cost: '', next: String(N(c.odo) + 5000) } }; },
  addUser: () => { S.form = { kind: 'user', vals: { name: '', username: '', role: 'sales', dept: 'Kinh doanh', phone: '', email: '', driverId: '', password: '' } }; },
  editUser: v => { const u = S.data.users.find(x => String(x.id) === v); S.form = { kind: 'user', vals: Object.assign({}, u, { password: '', active: String(u.active) }) }; },
  closeForm: () => { S.form = null; },
  account: () => { S.form = { kind: 'account', vals: {} }; S.notifOpen = false; },
  changePass: () => { S.form = { kind: 'password', vals: { old: '', next: '', next2: '' } }; },
  notif: () => { S.notifOpen = !S.notifOpen; },
  readAll: () => { S.data.notifs.forEach(n => n.read = true); call('notif.read', { all: true }).catch(() => { }); },
  openNotif: v => { const n = S.data.notifs.find(x => x.id === v); if (!n) return; n.read = true; call('notif.read', { ids: [v] }).catch(() => { }); S.notifOpen = false; if (String(n.tripId).startsWith('NK-')) A.logOpen(n.tripId); else if (String(n.tripId).startsWith('BD-')) A.reqOpen(n.tripId); else if (n.tripId) A.open(n.tripId); },
  enablePush: () => { if (!('Notification' in window)) return toast('Trình duyệt không hỗ trợ thông báo.', true); Notification.requestPermission().then(p => { toast(p === 'granted' ? 'Đã bật thông báo trên thiết bị này' : 'Bạn đã chặn thông báo. Mở cài đặt trình duyệt để cho phép.', p !== 'granted'); }); },
  refresh: () => load(),
  logout: async () => { try { await call('logout'); } catch (e) { } S.token = ''; S.data = null; S.form = null; S.logSel = null; S.logEdit = null; S.reqSel = null; S.reqEdit = null; S.sel = null; localStorage.removeItem(TK); localStorage.removeItem(CK); render(); },
  resetDemo: () => { resetDemo(); S.token = ''; S.data = null; S.form = null; S.logSel = null; S.logEdit = null; S.reqSel = null; S.reqEdit = null; localStorage.removeItem(TK); localStorage.removeItem(CK); render(); },
  demoLogin: v => doLogin(v, '123456'),
  exportCsv: () => exportCsv(),
  install: () => {
    if (_installEvt) { const ev = _installEvt; ev.prompt(); ev.userChoice.then(c => { if (c.outcome === 'accepted') { _installEvt = null; S.installHidden = true; } S.form = null; render(); }); return Promise.resolve(); }
    S.form = { kind: 'install', vals: {} };
  }
};

Object.assign(A, typeof LOG_ACTIONS !== 'undefined' ? LOG_ACTIONS : {}, typeof REQ_ACTIONS !== 'undefined' ? REQ_ACTIONS : {});

async function doLogin(username, password) {
  S.busy = true; S.loginErr = ''; render();
  try {
    const r = await call('login', { username, password });
    S.token = r.token; localStorage.setItem(TK, r.token); localStorage.setItem(LU, username); S.lastUser = username;
    S.tab = ''; S.seen = null; await load(true);
  } catch (e) { S.loginErr = e.message; }
  S.busy = false; render();
}

function submitForm() {
  const f = S.form, v = f.vals, bool = x => String(x) !== 'false';
  f.err = '';
  if (f.kind === 'trip') return mutate('trip.create', v, 'Đã gửi yêu cầu tới Điều phối', () => { S.form = null; if (['sales', 'ketoan'].includes(S.data.me.role)) S.tab = 'mine'; else { S.tab = 'inbox'; S.filter = 'pending'; } });
  if (f.kind === 'car') return mutate('car.save', Object.assign({}, v, { active: bool(v.active) }), v.id ? 'Đã cập nhật xe' : 'Đã thêm xe', () => { S.form = null; });
  if (f.kind === 'driver') return mutate('driver.save', Object.assign({}, v, { active: bool(v.active) }), v.id ? 'Đã cập nhật lái xe' : 'Đã thêm lái xe', () => { S.form = null; });
  if (f.kind === 'maint') return mutate('maint.add', v, 'Đã ghi nhận ' + v.type.toLowerCase(), () => { S.form = null; });
  if (f.kind === 'user') return mutate('user.save', Object.assign({}, v, { active: bool(v.active) }), v.id ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản ' + v.username, () => { S.form = null; });
  if (f.kind === 'password') {
    if (v.next !== v.next2) { f.err = 'Hai lần nhập mật khẩu mới không khớp.'; return render(); }
    return mutate('me.password', { old: v.old, next: v.next }, 'Đã đổi mật khẩu', () => { S.form = null; });
  }
}

function exportCsv() {
  const d = S.data, T = today();
  const from = S.period === 'm1' ? T.slice(0, 8) + '01' : addD(T, -(S.period === 'm3' ? 90 : 180) + 1);
  const carOf = id => (d.cars.find(c => String(c.id) === String(id)) || {}).plate || '', drvOf = id => (d.drivers.find(c => String(c.id) === String(id)) || {}).name || '';
  const rows = d.trips.filter(t => !t.limited && t.end >= from && t.end <= T).sort((a, b) => a.start < b.start ? -1 : 1);
  const head = ['Mã chuyến', 'Người đặt', 'Phòng ban', 'Điểm đến', 'Mục đích', 'Ngày đi', 'Ngày về', 'Trạng thái', 'Xe', 'Lái xe', 'Km đầu', 'Km cuối', 'Quãng đường', 'Nhiên liệu', 'Cầu đường', 'Gửi xe', 'Khác', 'Tổng chi phí'];
  const q = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const lines = [head.map(q).join(',')].concat(rows.map(t => [t.id, t.name, t.dept, t.dest, t.purpose, dmy(t.start), dmy(t.end), ST[t.status][0], carOf(t.carId), drvOf(t.drvId), t.kmStart, t.kmEnd, N(t.kmEnd) ? N(t.kmEnd) - N(t.kmStart) : '', N(t.fuel), N(t.toll), N(t.park), N(t.other), cost(t)].map(q).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chuyen-di-' + from + '_' + T + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------ sự kiện */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault();
  const r = fn(el.dataset.v);
  if (!(r && r.then)) render();
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const k = e.target.dataset.submit;
  if (k === 'login') { const fd = new FormData(e.target); doLogin(String(fd.get('username')).trim(), String(fd.get('password'))); }
  if (k === 'form') submitForm();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.act) {
    S.act[t.dataset.act] = t.value;
    const c = document.getElementById('calc'), tr0 = sel();
    if (c && tr0) { const A2 = S.act, km = N(A2.kmEnd) - N(tr0.kmStart), tot = N(A2.fuel) + N(A2.toll) + N(A2.park) + N(A2.other); c.textContent = (km > 0 ? 'Quãng đường ' + num(km) + ' km · ' : '') + 'Tổng chi phí ' + vnd(tot); }
  }
  if (t.dataset.f && S.form) {
    S.form.vals[t.dataset.f] = t.value;
    const h = document.getElementById('fhint'); if (h) h.innerHTML = formHint();
  }
});
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset.f; if (!k || !S.form) return;
  const v = S.form.vals; v[k] = t.value;
  if (t.tagName !== 'SELECT') { const h = document.getElementById('fhint'); if (h) h.innerHTML = formHint(); return; }
  if (S.form.kind === 'maint' && (k === 'type' || k === 'carId')) {
    const c = S.data.cars.find(x => String(x.id) === String(v.carId));
    if (k === 'carId' && c) v.km = String(N(c.odo));
    v.next = v.type === 'Bảo dưỡng' ? String(N(v.km) + 5000) : v.type === 'Sửa chữa' ? '' : addD(today(), 365);
    render();
  }
  if (S.form.kind === 'user' && k === 'role') render();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.viewer) S.viewer = null; else if (S.form) S.form = null; else if (S.reqEdit) S.reqEdit = null; else if (S.reqSel) S.reqSel = null; else if (S.logEdit) S.logEdit = null; else if (S.logSel) S.logSel = null; else if (S.sel) S.sel = null; else if (S.notifOpen) S.notifOpen = false; render(); } });
let _rw = innerWidth >= 900;
window.addEventListener('resize', () => { const w = innerWidth >= 900; if (w !== _rw) { _rw = w; render(); } });
setInterval(() => {
  const ae = document.activeElement, typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if (S.token && S.data && document.visibilityState === 'visible' && !S.busy && !S.form && !S.logEdit && !S.reqEdit && !S.viewer && !typing) load(true);
}, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token && S.data && !S.form && !S.busy) load(true); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));

/* ------------------------------------------------------------ dữ liệu dùng thử */
function demoSeed(ctx) {
  const a = n => addD(today(), n), db = ctx.db;
  [['X01', '29A-123.45', 'Toyota Innova', 7, 84210, a(40), 85000, a(120)], ['X02', '29A-678.90', 'Ford Transit', 16, 132400, a(-3), 135000, a(200)], ['X03', '30H-246.80', 'Kia Carnival', 7, 21500, a(300), 25000, a(18)], ['X04', '30K-135.79', 'Toyota Vios', 5, 56320, a(150), 56800, a(90)], ['X05', '29D-112.23', 'Mitsubishi Xpander', 7, 40110, a(22), 45000, a(260)]]
    .forEach(c => db.insert('cars', { id: c[0], plate: c[1], model: c[2], seats: c[3], odo: c[4], dk: c[5], svcKm: c[6], bh: c[7], active: true }));
  [['LX01', 'Lê Văn Hùng', '0912 345 678', 'D', a(400)], ['LX02', 'Nguyễn Đức Thắng', '0983 222 115', 'E', a(25)], ['LX03', 'Phạm Văn Long', '0904 776 210', 'D', a(700)], ['LX04', 'Trần Quang Huy', '0936 118 452', 'D', a(300)]]
    .forEach(d => db.insert('drivers', { id: d[0], name: d[1], phone: d[2], lic: d[3], licExp: d[4], active: true }));
  const uA = BH_makeUser(ctx, { id: 'U-ADMIN', username: 'admin', name: 'Quản trị hệ thống', role: 'admin' }, '123456');
  BH_makeUser(ctx, { id: 'U-DP', username: 'dieuphoi', name: 'Trần Văn Minh', role: 'dispatch', dept: 'Hành chính', phone: '0917 555 120' }, '123456');
  const uS = BH_makeUser(ctx, { id: 'U-NV', username: 'nhanvien', name: 'Nguyễn Thu Hà', role: 'sales', dept: 'Kinh doanh', phone: '0915 220 486' }, '123456');
  BH_makeUser(ctx, { id: 'U-LX', username: 'laixe', name: 'Lê Văn Hùng', role: 'driver', phone: '0912 345 678', driverId: 'LX01' }, '123456');
  BH_makeUser(ctx, { id: 'U-GD', username: 'giamdoc', name: 'Phạm Quốc Bảo', role: 'bgd', dept: 'Ban Giám đốc', phone: '0913 000 168' }, '123456');
  let sd = 7; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; }, pick = arr => arr[Math.floor(rnd() * arr.length)];
  const DEST = [['Bắc Ninh', 45], ['Hải Phòng', 120], ['Hưng Yên', 60], ['Thái Nguyên', 85], ['Nam Định', 95], ['Quảng Ninh', 160], ['Vĩnh Phúc', 60], ['Thanh Hoá', 160], ['Lạng Sơn', 155], ['Ninh Bình', 95]];
  const PUR = ['Gặp khách hàng, ký hợp đồng', 'Khảo sát nhà cung cấp', 'Giao mẫu sản phẩm', 'Kiểm tra công trình', 'Đối chiếu công nợ', 'Nghiệm thu thiết bị', 'Hội thảo đối tác'];
  const PEOPLE = [['Nguyễn Thu Hà', 'Kinh doanh', uS.id], ['Đỗ Minh Tuấn', 'Kinh doanh', 'x1'], ['Vũ Thị Lan', 'Mua hàng', 'x2'], ['Hoàng Văn Nam', 'Sản xuất', 'x3'], ['Bùi Thanh Mai', 'Kế toán', 'x4'], ['Ngô Đức Anh', 'Cơ điện', 'x5']];
  const hist = [];
  for (let i = 0; i < 72; i++) {
    const back = 3 + Math.floor(rnd() * 178), s = a(-back), p = pick(PEOPLE), dd = pick(DEST), km = Math.round(dd[1] * 2 * (1 + rnd() * .25)), ks = 10000 + Math.floor(rnd() * 80000);
    hist.push({ createdBy: p[2], name: p[0], dept: p[1], phone: '0900 000 000', dest: dd[0], purpose: pick(PUR), start: s, end: addD(s, rnd() < .75 ? 0 : 1), time: pick(['07:00', '07:30', '08:00', '13:30']), pax: 1 + Math.floor(rnd() * 4), status: 'done', carId: 'X0' + (1 + Math.floor(rnd() * 5)), drvId: 'LX0' + (1 + Math.floor(rnd() * 4)), kmStart: ks, kmEnd: ks + km, fuel: Math.round(km * 2.6) * 1000, toll: Math.round(km * .09) * 10000, park: pick([0, 20000, 30000, 50000]), other: rnd() < .2 ? pick([100000, 150000]) : 0, rejectReason: '', driverReject: '', createdAt: Date.now() - back * DAY, updatedAt: Date.now() - back * DAY });
  }
  hist.sort((x, y) => x.start < y.start ? -1 : 1);
  let id = 1001; hist.forEach(t => db.insert('trips', Object.assign({ id: 'BH-' + (id++) }, t)));
  const mk = o => { const t = Object.assign({ id: 'BH-' + (id++), createdBy: 'x9', phone: '0900 000 000', time: '08:00', pax: 2, carId: '', drvId: '', kmStart: '', kmEnd: '', fuel: '', toll: '', park: '', other: '', rejectReason: '', driverReject: '', createdAt: Date.now() - 3600e3, updatedAt: Date.now() - 3600e3 }, o); db.insert('trips', t); return t; };
  const p1 = mk({ createdBy: uS.id, name: 'Nguyễn Thu Hà', dept: 'Kinh doanh', phone: '0915 220 486', dest: 'Bắc Ninh – KCN Yên Phong', purpose: 'Gặp khách hàng, trình bày báo giá quý IV', start: a(1), end: a(1), pax: 3, status: 'pending' });
  mk({ name: 'Vũ Thị Lan', dept: 'Mua hàng', dest: 'Hải Dương', purpose: 'Khảo sát xưởng nhà cung cấp bao bì', start: a(2), end: a(2), status: 'pending' });
  mk({ name: 'Hoàng Văn Nam', dept: 'Sản xuất', dest: 'Hà Nam – KCN Đồng Văn', purpose: 'Nghiệm thu dây chuyền đóng gói', start: a(0), end: a(0), time: '07:30', status: 'accepted', carId: 'X01', drvId: 'LX01' });
  const p4 = mk({ name: 'Đỗ Minh Tuấn', dept: 'Kinh doanh', dest: 'Thái Nguyên', purpose: 'Giao mẫu và chốt đơn hàng', start: a(2), end: a(3), status: 'assigned', carId: 'X04', drvId: 'LX01' });
  mk({ name: 'Ngô Đức Anh', dept: 'Cơ điện', dest: 'Quảng Ninh – Hạ Long', purpose: 'Bảo trì hệ thống điện nhà máy', start: a(-1), end: a(1), pax: 4, status: 'ongoing', carId: 'X02', drvId: 'LX04', kmStart: 132400 });
  mk({ name: 'Phạm Quốc Bảo', dept: 'Ban Giám đốc', dest: 'Hải Phòng – Cảng Lạch Huyện', purpose: 'Làm việc với đối tác logistics', start: a(3), end: a(4), status: 'accepted', carId: 'X03', drvId: 'LX02' });
  const p7 = mk({ name: 'Bùi Thanh Mai', dept: 'Kế toán', dest: 'Bắc Giang', purpose: 'Đối chiếu công nợ đại lý', start: a(4), end: a(4), status: 'assigned', carId: 'X03', drvId: 'LX03' });
  mk({ createdBy: uS.id, name: 'Nguyễn Thu Hà', dept: 'Kinh doanh', dest: 'Vĩnh Phúc', purpose: 'Hội thảo đối tác phân phối', start: a(-2), end: a(-2), status: 'rejected', rejectReason: 'Xe 7 chỗ đã kín lịch, đề nghị đi cùng đoàn Phòng KD.' });
  mk({ createdBy: uS.id, name: 'Nguyễn Thu Hà', dept: 'Kinh doanh', dest: 'Hưng Yên – Phố Nối', purpose: 'Khảo sát nhu cầu khách hàng mới', start: a(5), end: a(5), status: 'accepted', carId: 'X05', drvId: 'LX03' });
  const t = Date.now(), nt = (to, text, tripId, ago) => db.insert('notifs', { id: ctx.uuid(), to, text, tripId: tripId || '', t: t - ago * 60000, readBy: '' });
  nt('role:dispatch', 'Nguyễn Thu Hà gửi yêu cầu đặt xe đi Bắc Ninh ngày ' + dm(p1.start) + '.', p1.id, 20);
  nt('role:dispatch', 'Xe 30H-246.80 trùng lịch ngày ' + dm(p7.start) + ' (' + p7.id + ').', p7.id, 50);
  nt('role:dispatch', 'Xe 29A-678.90 đã quá hạn đăng kiểm 3 ngày.', '', 150);
  nt('driver:LX01', 'Bạn được phân công chuyến ' + p4.id + ' đi Thái Nguyên ngày ' + dm(p4.start) + ', xe 30K-135.79.', p4.id, 40);
  nt('user:' + uS.id, 'Chuyến đi Phố Nối đã có xe 29D-112.23, lái xe Phạm Văn Long.', '', 120);
  [[a(-12), 'X01', 'Bảo dưỡng', 'Bảo dưỡng 80.000 km: thay dầu, lọc gió, má phanh trước', 80050, 4850000], [a(-35), 'X04', 'Sửa chữa', 'Thay ắc quy', 55100, 2300000], [a(-60), 'X03', 'Đăng kiểm', 'Đăng kiểm định kỳ', 19800, 560000]]
    .forEach((m, i) => db.insert('maint', { id: 'M' + i, date: m[0], carId: m[1], type: m[2], content: m[3], km: m[4], cost: m[5], createdBy: uA.id }));
  seedLogs(ctx, a, rnd, pick, mk);
  seedReqs(ctx, a);
}

function seedReqs(ctx, a) {
  const db = ctx.db, t0 = Date.now(), H = 3600e3, J = x => JSON.stringify(x), txt = it => it.map(x => x.name + ': ' + vnd(x.amount)).join('; '), sm = it => it.reduce((s, x) => s + x.amount, 0);
  const U = { LX01: ['U-LX', 'Lê Văn Hùng'], LX02: ['U-LX2', 'Nguyễn Đức Thắng'], LX03: ['U-LX3', 'Phạm Văn Long'], LX04: ['U-LX4', 'Trần Quang Huy'] };
  const plate = id => db.all('cars').find(c => c.id === id).plate;
  const base = (id, dv, car, type, km, reason, vendor, planDate, items, status, extra) => Object.assign({ id, createdBy: U[dv][0], createdName: U[dv][1], drvId: dv, carId: car, plate: plate(car), type, km, reason, vendor, planDate,
    items: J(items), itemsText: txt(items), estimate: sm(items), urgent: false, status, reviewNote: '', approvedBy: '', approvedAt: '', doneDate: '', doneKm: '', actual: '[]', actualText: '', actualTotal: 0, payee: 'driver', vendorBank: '', nextDue: '', files: '[]',
    reportedAt: '', confirmedBy: '', confirmedAt: '', paidBy: '', paidAt: '', payRef: '', createdAt: t0 - 30 * H, updatedAt: t0 - 30 * H }, extra || {});
  const rep = (act, doneDate, doneKm, payee, more) => Object.assign({ doneDate, doneKm, actual: J(act), actualText: txt(act), actualTotal: sm(act), payee, reportedAt: t0 - 20 * H }, more || {});
  const it1 = [{ name: 'Thay dầu máy 5W-30', amount: 850000 }, { name: 'Lọc dầu', amount: 150000 }, { name: 'Lọc gió động cơ', amount: 250000 }, { name: 'Kiểm tra, vệ sinh phanh', amount: 300000 }];
  db.insert('mreqs', base('BD-1001', 'LX01', 'X01', 'Bảo dưỡng định kỳ', 84210, 'Xe sắp đến mốc bảo dưỡng 85.000 km.', 'Toyota Long Biên', a(2), it1, 'proposed', { createdAt: t0 - 3 * H, updatedAt: t0 - 3 * H }));
  db.insert('mreqs', base('BD-1002', 'LX01', 'X01', 'Sửa chữa', 84150, 'Gạt mưa mòn, nước làm mát hao.', 'Garage Minh Phát', a(-1), [{ name: 'Thay bộ gạt mưa', amount: 320000 }, { name: 'Bổ sung nước làm mát', amount: 180000 }], 'approved', { approvedBy: 'Trần Văn Minh', approvedAt: t0 - 26 * H }));
  db.insert('mreqs', base('BD-1003', 'LX04', 'X02', 'Đăng kiểm', 132400, 'Xe quá hạn đăng kiểm 3 ngày.', 'Trung tâm đăng kiểm 29-05V', a(1), [{ name: 'Phí kiểm định', amount: 340000 }, { name: 'Lệ phí cấp giấy chứng nhận', amount: 90000 }], 'approved', { approvedBy: 'Trần Văn Minh', approvedAt: t0 - 20 * H }));
  const a4 = [{ name: 'Ắc quy GS 65Ah', amount: 2150000, invoice: true }, { name: 'Công thay', amount: 100000, invoice: true }];
  db.insert('mreqs', base('BD-1004', 'LX02', 'X03', 'Thay lốp, ắc quy', 21500, 'Xe khó nổ máy buổi sáng, ắc quy yếu.', 'Ắc quy Thành Công', a(-3), [{ name: 'Ắc quy 65Ah', amount: 2300000 }], 'reported', Object.assign({ approvedBy: 'Trần Văn Minh', approvedAt: t0 - 70 * H }, rep(a4, a(-1), 21480, 'driver'))));
  const a5 = [{ name: 'Lốp Michelin 205/55R16 x2', amount: 4600000, invoice: true }, { name: 'Cân bằng động, đảo lốp', amount: 200000, invoice: true }];
  db.insert('mreqs', base('BD-1005', 'LX03', 'X05', 'Thay lốp, ắc quy', 40110, 'Hai lốp trước mòn sát vạch.', 'Lốp Thịnh Phát', a(-6), [{ name: 'Lốp 205/55R16 x2', amount: 4500000 }, { name: 'Cân bằng động', amount: 200000 }], 'confirmed', Object.assign({ approvedBy: 'Trần Văn Minh', approvedAt: t0 - 150 * H, confirmedBy: 'Trần Văn Minh', confirmedAt: t0 - 8 * H }, rep(a5, a(-4), 40020, 'vendor', { vendorBank: '1903 5566 7788 – Techcombank – Cty TNHH Lốp Thịnh Phát' }))));
  const a6 = [{ name: 'Nạp gas điều hoà', amount: 450000, invoice: true }, { name: 'Vệ sinh dàn lạnh', amount: 350000, invoice: false }];
  db.insert('mreqs', base('BD-1006', 'LX01', 'X04', 'Sửa chữa', 56100, 'Điều hoà không mát.', 'Điện lạnh ô tô Hoàng Gia', a(-12), [{ name: 'Nạp gas điều hoà', amount: 450000 }, { name: 'Vệ sinh dàn lạnh', amount: 350000 }], 'paid', Object.assign({ approvedBy: 'Trần Văn Minh', approvedAt: t0 - 300 * H, confirmedBy: 'Trần Văn Minh', confirmedAt: t0 - 250 * H, paidBy: 'Đinh Thị Hoa', paidAt: t0 - 200 * H, payRef: 'PC-0371', createdAt: t0 - 320 * H, updatedAt: t0 - 200 * H }, rep(a6, a(-11), 56180, 'driver'))));
  const nt = (to, text, id, ago) => db.insert('notifs', { id: ctx.uuid(), to, text, tripId: id, t: t0 - ago * 60000, readBy: '' });
  nt('role:dispatch', 'Lê Văn Hùng gửi đề xuất bảo dưỡng định kỳ xe 29A-123.45, dự toán 1.550.000 đ.', 'BD-1001', 15);
  nt('role:dispatch', 'Nguyễn Đức Thắng đã nộp chứng từ BD-1004 (Thay lốp, ắc quy xe 30H-246.80): 2.250.000 đ. Cần xác nhận.', 'BD-1004', 70);
  nt('role:ketoan', 'Cần thanh toán 4.800.000 đ cho BD-1005 (Thay lốp, ắc quy xe 29D-112.23, chuyển khoản Lốp Thịnh Phát).', 'BD-1005', 45);
  nt('driver:LX01', 'Đề xuất BD-1002 (Sửa chữa xe 29A-123.45) đã được duyệt. Sau khi làm xong, nhập chi phí thực tế kèm chứng từ.', 'BD-1002', 25);
}

function seedLogs(ctx, a, rnd, pick, mk) {
  const db = ctx.db;
  BH_makeUser(ctx, { id: 'U-KT', username: 'ketoan', name: 'Đinh Thị Hoa', role: 'ketoan', dept: 'Kế toán', phone: '0918 640 225' }, '123456');
  mk({ name: 'Đỗ Minh Tuấn', dept: 'Kinh doanh', dest: 'Bắc Ninh – Từ Sơn', purpose: 'Giao hàng mẫu cho đại lý', start: a(-1), end: a(-1), time: '07:30', status: 'done', carId: 'X01', drvId: 'LX01', kmStart: 84080, kmEnd: 84210, fuel: 350000, toll: 70000, park: 20000, other: 0 });
  const NAMES = { LX01: 'Lê Văn Hùng', LX02: 'Nguyễn Đức Thắng', LX03: 'Phạm Văn Long', LX04: 'Trần Quang Huy' };
  const LOCAL = [['Công ty', 'Kho Đông Anh', 'Chở vật tư'], ['Công ty', 'Ngân hàng Vietcombank', 'Đưa kế toán đi giao dịch'], ['Công ty', 'Sân bay Nội Bài', 'Đón khách'], ['Công ty', 'Garage Toyota Long Biên', 'Kiểm tra xe'], ['Kho Đông Anh', 'Công ty', 'Về công ty'], ['Công ty', 'Bưu điện Long Biên', 'Gửi hồ sơ']];
  const XTRA = [['Rửa xe', 60000, CASH, false, 'Rửa xe sau chuyến'], ['Gửi xe', 30000, CASH, false, 'Gửi xe chờ khách'], ['Công tác phí / ăn uống', 80000, CASH, false, 'Ăn trưa khi chờ khách'], ['Nhiên liệu', 600000, 'Thẻ xăng công ty', true, 'Petrolimex Đông Anh'], ['Cầu đường / BOT', 45000, CASH, true, 'BOT Pháp Vân – Cầu Giẽ'], ['Nhiên liệu', 450000, CASH, true, 'Cây xăng Mipec Long Biên']];
  const trips = db.all('trips'), cars = db.all('cars'), cur = {}, out = [];
  cars.forEach(c => cur[c.id] = N(c.odo)); cur.X01 = 84080;
  const stop = () => { const s = pick(LOCAL); return { time: pick(['07:30', '09:00', '13:30', '15:00']), from: s[0], to: s[1], purpose: s[2] }; };
  for (let i = 1; i <= 14; i++) {
    const day = a(-i), base = parse(day).getTime();
    Object.keys(NAMES).forEach((dv, di) => {
      if (dv === 'LX01' && i === 1) return;
      const ts = trips.filter(t => t.drvId === dv && (t.status === 'done' || t.status === 'ongoing') && t.start <= day && t.end >= day);
      if (!ts.length && rnd() < 0.5) return;
      const route = ts.length ? (rnd() < 0.3 ? [stop()] : []) : [stop(), stop()];
      const carId = ts.length ? ts[0].carId : 'X0' + (di + 1), car = cars.find(c => c.id === carId);
      const km = ts.length ? ts.reduce((s, t) => s + (N(t.kmEnd) ? Math.round((N(t.kmEnd) - N(t.kmStart)) / (diffD(t.start, t.end) + 1)) : 150), 0) + route.length * 15 : 40 + Math.floor(rnd() * 60);
      const ke = cur[carId], ks = ke - km; cur[carId] = ks;
      const lines = []; for (let j = Math.floor(rnd() * 3); j > 0; j--) { const x = pick(XTRA); lines.push({ type: x[0], amount: x[1], method: x[2], invoice: x[3], note: x[4], photo: '' }); }
      let status = i > 5 ? 'paid' : i > 2 ? 'approved' : 'submitted', reviewNote = '';
      if (dv === 'LX01' && i === 3) { status = 'returned'; reviewNote = 'Thiếu ảnh hoá đơn nhiên liệu, bổ sung và gửi lại.'; if (!lines.some(c => c.type === 'Nhiên liệu')) lines.push({ type: 'Nhiên liệu', amount: 450000, method: CASH, invoice: true, note: 'Cây xăng Mipec Long Biên', photo: '' }); }
      const tripCost = ts.filter(t => t.status === 'done' && t.end === day).reduce((s, t) => s + cost(t), 0);
      const extra = lines.reduce((s, c) => s + c.amount, 0), reimb = tripCost + lines.filter(c => c.method === CASH).reduce((s, c) => s + c.amount, 0);
      if (status === 'approved' && !reimb) status = 'paid';
      const ap = status === 'approved' || status === 'paid', pd = status === 'paid';
      out.push({ log: { date: day, drvId: dv, drvName: NAMES[dv], carId, plate: car.plate, kmStart: ks, kmEnd: ke, km, route: JSON.stringify(route),
        routeText: ts.map(t => t.id + ' ' + t.dest).concat(route.map(r => r.time + ' ' + r.from + ' → ' + r.to + ' (' + r.purpose + ')')).join('; '),
        tripIds: ts.map(t => t.id).join(','), tripCost, extraCost: extra, total: tripCost + extra, reimburse: reimb, status, note: '', reviewNote,
        submittedAt: base + 19 * 3600e3, approvedBy: ap ? 'Trần Văn Minh' : '', approvedAt: ap ? base + 33 * 3600e3 : '', paidBy: pd ? 'Đinh Thị Hoa' : '', paidAt: pd ? base + 58 * 3600e3 : '', payRef: pd ? 'PC-' + (400 - i) : '', updatedAt: base + 19 * 3600e3 }, lines });
    });
  }
  out.sort((x, y) => x.log.date < y.log.date ? -1 : 1).forEach((o, n) => {
    const id = 'NK-' + (1001 + n); db.insert('logs', Object.assign({ id }, o.log));
    o.lines.forEach((c, j) => db.insert('costs', Object.assign({ id: id + '-' + (j + 1), logId: id, date: o.log.date, drvId: o.log.drvId, carId: o.log.carId }, c)));
  });
  const L = db.all('logs'), sub = L.filter(l => l.status === 'submitted'), apv = L.filter(l => l.status === 'approved');
  sub.slice(0, 2).forEach((l, i) => db.insert('notifs', { id: ctx.uuid(), to: 'role:dispatch', text: 'Lái xe ' + l.drvName + ' gửi báo cáo ngày ' + dm(l.date) + ': ' + l.km + ' km, đề nghị hoàn ứng ' + vnd(l.reimburse) + '.', tripId: l.id, t: Date.now() - (30 + i * 40) * 60000, readBy: '' }));
  apv.slice(0, 2).forEach((l, i) => db.insert('notifs', { id: ctx.uuid(), to: 'role:ketoan', text: 'Báo cáo ' + l.id + ' của lái xe ' + l.drvName + ' đã duyệt, cần hoàn ứng ' + vnd(l.reimburse) + '.', tripId: l.id, t: Date.now() - (60 + i * 90) * 60000, readBy: '' }));
  const r = L.find(l => l.status === 'returned');
  if (r) db.insert('notifs', { id: ctx.uuid(), to: 'driver:LX01', text: 'Báo cáo ngày ' + dm(r.date) + ' bị trả lại: ' + r.reviewNote, tripId: r.id, t: Date.now() - 200 * 60000, readBy: '' });
}

function vBoot() {
  return `<div class="login"><div class="login-card" style="align-items:center;text-align:center">
    <div class="brand"><img class="logo" src="logo.png" alt="Bảo Hưng"><div style="text-align:left"><div class="brand-t">BẢO HƯNG</div><div class="brand-s">Quản lý xe công tác</div></div></div>
    ${S.bootErr ? `<div class="err">${esc(S.bootErr)}</div><div class="row-w" style="justify-content:center"><button class="btn btn-p" data-a="refresh">Thử lại</button><button class="btn btn-s" data-a="logout">Đăng xuất</button></div>`
      : '<span class="spin" style="width:26px;height:26px"></span><div class="muted small">Đang tải dữ liệu…</div>'}
  </div></div>`;
}
// Mở lại app: hiện ngay dữ liệu lần trước, rồi cập nhật ngầm
if (S.token) {
  try {
    const c = JSON.parse(localStorage.getItem(CK) || 'null');
    if (c && c.me) {
      S.data = c; S.seen = new Set((c.notifs || []).map(n => n.id));
      const tabs = (TABS[c.me.role] || []).map(x => x[0]); S.tab = tabs[0];
    }
  } catch (e) { }
}
render();
load(true);
