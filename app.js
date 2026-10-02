/* Điều khiển ứng dụng: trạng thái, gọi máy chủ, xử lý thao tác. */
const TK = 'bh-xe-token', LU = 'bh-xe-last-user';
const S = {
  token: localStorage.getItem(TK) || '', lastUser: localStorage.getItem(LU) || '',
  data: null, tab: '', sel: null, pick: {}, act: {}, form: null, filter: 'pending', week: 0, period: 'm1',
  notifOpen: false, toast: '', toastErr: false, loading: false, busy: false, loginErr: '', seen: null
};
const root = document.getElementById('app');

/* ------------------------------------------------------------ máy chủ */
let _demo = null;
function demoCtx() {
  if (_demo) return _demo;
  const KEY = 'bh-xe-demo-db-v1';
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
    now: () => Date.now(), today: () => today()
  };
  if (!db || !db.users) { db = {}; Object.keys(BH_TABLES).forEach(t => db[t] = []); demoSeed(ctx); save(); }
  _demo = ctx; return ctx;
}
function resetDemo() { localStorage.removeItem('bh-xe-demo-db-v1'); _demo = null; }

async function call(action, params) {
  const req = { action, params: params || {}, token: S.token };
  let res;
  if (!API_URL) {
    await new Promise(r => setTimeout(r, 120));
    res = BH_api(demoCtx(), JSON.parse(JSON.stringify(req)));
  } else {
    let r;
    try { r = await fetch(API_URL + '?q=' + encodeURIComponent(JSON.stringify(req))); }
    catch (e) { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'); }
    if (!r.ok) throw new Error('Máy chủ trả lỗi ' + r.status + '.');
    try { res = await r.json(); } catch (e) { throw new Error('Máy chủ trả dữ liệu không hợp lệ. Kiểm tra lại quyền truy cập của Web App ("Bất kỳ ai").'); }
  }
  if (!res.ok) {
    if (res.auth) { S.token = ''; localStorage.removeItem(TK); S.data = null; S.loginErr = res.error; }
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
    S.data = data;
    const tabs = (TABS[data.me.role] || []).map(x => x[0]);
    if (!tabs.includes(S.tab)) S.tab = tabs[0];
    if (S.sel && !data.trips.find(t => t.id === S.sel)) S.sel = null;
  } catch (e) {
    if (!e.auth) toast(e.message, true);
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
    if (S.form) S.form.err = e.message; else if (S.sel) S.act.err = e.message; else toast(e.message, true);
  }
  S.busy = false; render();
}

/* ------------------------------------------------------------ render */
function render() {
  const dr = document.querySelector('.dr-b'), drTop = dr ? dr.scrollTop : 0, y = window.scrollY;
  root.innerHTML = S.data ? vApp() : vLogin();
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
  openNotif: v => { const n = S.data.notifs.find(x => x.id === v); if (!n) return; n.read = true; call('notif.read', { ids: [v] }).catch(() => { }); S.notifOpen = false; if (n.tripId) A.open(n.tripId); },
  enablePush: () => { if (!('Notification' in window)) return toast('Trình duyệt không hỗ trợ thông báo.', true); Notification.requestPermission().then(p => { toast(p === 'granted' ? 'Đã bật thông báo trên thiết bị này' : 'Bạn đã chặn thông báo. Mở cài đặt trình duyệt để cho phép.', p !== 'granted'); }); },
  refresh: () => load(),
  logout: async () => { try { await call('logout'); } catch (e) { } S.token = ''; S.data = null; S.form = null; S.sel = null; localStorage.removeItem(TK); render(); },
  resetDemo: () => { resetDemo(); S.token = ''; S.data = null; S.form = null; localStorage.removeItem(TK); render(); },
  demoLogin: v => doLogin(v, '123456'),
  exportCsv: () => exportCsv()
};

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
  if (f.kind === 'trip') return mutate('trip.create', v, 'Đã gửi yêu cầu tới Điều phối', () => { S.form = null; if (S.data.me.role === 'sales') S.tab = 'mine'; else { S.tab = 'inbox'; S.filter = 'pending'; } });
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.form) S.form = null; else if (S.sel) S.sel = null; else if (S.notifOpen) S.notifOpen = false; render(); } });
let _rw = innerWidth >= 900;
window.addEventListener('resize', () => { const w = innerWidth >= 900; if (w !== _rw) { _rw = w; render(); } });
setInterval(() => {
  const ae = document.activeElement, typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if (S.token && S.data && document.visibilityState === 'visible' && !S.busy && !S.form && !typing) load(true);
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
}

load();
