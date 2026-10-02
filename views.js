/* Giao diện — hàm dựng HTML. Trạng thái nằm trong S (app.js). */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const a = String(s).split('-').map(Number); return new Date(a[0], (a[1] || 1) - 1, a[2] || 1); };
const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diffD = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
const today = () => iso(new Date());
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WDL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const dm = s => isDate(s) ? (d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1))(parse(s)) : '—';
const dmy = s => isDate(s) ? dm(s) + '/' + parse(s).getFullYear() : '—';
const N = v => +String(v ?? '').replace(/[^\d]/g, '') || 0;
const num = n => Math.round(+n || 0).toLocaleString('vi-VN');
const vnd = n => num(n) + ' đ';
const tr = n => n >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' tỷ' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' tr' : num(n / 1000) + 'k';
const ini = n => String(n || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
const overlap = (a, b) => a.start <= b.end && b.start <= a.end;
const cost = t => N(t.fuel) + N(t.toll) + N(t.park) + N(t.other);
const relT = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Vừa xong' : m < 60 ? m + ' phút trước' : m < 1440 ? Math.round(m / 60) + ' giờ trước' : Math.round(m / 1440) + ' ngày trước'; };
const DL_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>';
const ACTIVE = ['assigned', 'accepted', 'ongoing'];
const OPEN = ['pending', 'assigned', 'accepted', 'ongoing'];
const DEPTS = ['Kinh doanh', 'Mua hàng', 'Kế toán', 'Sản xuất', 'Cơ điện', 'Hành chính', 'Ban Giám đốc'];
const ROLE_LABEL = { admin: 'Quản trị', dispatch: 'Điều phối', bgd: 'Ban Giám đốc', sales: 'Nhân viên', driver: 'Lái xe' };
const ST = {
  pending: ['Chờ xếp xe', '#7A5410', '#F5ECD7'], assigned: ['Chờ lái xe nhận', '#1F4E79', '#E1ECF6'], accepted: ['Sẵn sàng', '#245B3A', '#E0EFE5'],
  ongoing: ['Đang đi', '#FFFFFF', '#A31E22'], done: ['Hoàn thành', '#5F5750', '#ECE8E2'], rejected: ['Từ chối', '#8C1A1D', '#F6E1E1'], cancelled: ['Đã huỷ', '#5F5750', '#ECE8E2']
};
const BAR = {
  pending: ['#FBF6EA', '#7A5410', '#D9B866', 'dashed'], assigned: ['#E1ECF6', '#1F4E79', '#9DBBDB', 'dashed'], accepted: ['#E0EFE5', '#245B3A', '#9CC7AB', 'solid'],
  ongoing: ['#A31E22', '#FFFFFF', '#A31E22', 'solid'], done: ['#F0EDE8', '#7A706A', '#DDD5CB', 'solid'], conflict: ['#F6E1E1', '#8C1A1D', '#A31E22', 'solid']
};
const TABS = {
  sales: [['mine', 'Chuyến của tôi', 'Chuyến'], ['schedule', 'Lịch xe', 'Lịch xe']],
  dispatch: [['inbox', 'Cần xử lý', 'Xử lý'], ['schedule', 'Lịch xe', 'Lịch'], ['fleet', 'Đội xe & lái xe', 'Đội xe'], ['maint', 'Bảo dưỡng', 'Bảo dưỡng'], ['report', 'Báo cáo', 'Báo cáo']],
  bgd: [['report', 'Tổng quan', 'Tổng quan'], ['inbox', 'Danh sách chuyến', 'Chuyến'], ['schedule', 'Lịch xe', 'Lịch'], ['fleet', 'Đội xe & lái xe', 'Đội xe'], ['maint', 'Bảo dưỡng', 'Bảo dưỡng']],
  driver: [['runs', 'Lịch chạy', 'Lịch chạy'], ['history', 'Lịch sử', 'Lịch sử']]
};
TABS.admin = TABS.dispatch.concat([['users', 'Người dùng', 'Tài khoản']]);

const tag = (label, fg, bg, extra) => `<span class="tag" style="color:${fg};background:${bg};${extra || ''}">${esc(label)}</span>`;
const stTag = s => tag(ST[s][0], ST[s][1], ST[s][2]);
const dateCell = s => { if (!isDate(s)) return { value: '—', tag: 'Chưa nhập', fg: '#5F5750', bg: '#ECE8E2', lvl: 0 }; const n = diffD(today(), s); return n < 0 ? { value: dmy(s), tag: 'Quá hạn ' + (-n) + ' ngày', fg: '#8C1A1D', bg: '#F6E1E1', lvl: 2 } : n <= 30 ? { value: dmy(s), tag: 'Còn ' + n + ' ngày', fg: '#7A5410', bg: '#F5ECD7', lvl: 1 } : { value: dmy(s), tag: 'Còn hạn', fg: '#245B3A', bg: '#E0EFE5', lvl: 0 }; };
const kmCell = c => { const r = N(c.svcKm) - N(c.odo), v = 'Mốc ' + num(c.svcKm) + ' km'; return r < 0 ? { value: v, tag: 'Quá ' + num(-r) + ' km', fg: '#8C1A1D', bg: '#F6E1E1', lvl: 2 } : r <= 1500 ? { value: v, tag: 'Còn ' + num(r) + ' km', fg: '#7A5410', bg: '#F5ECD7', lvl: 1 } : { value: v, tag: 'Còn ' + num(r) + ' km', fg: '#245B3A', bg: '#E0EFE5', lvl: 0 }; };

function conflictsOf(trips) {
  const act = trips.filter(t => ACTIVE.includes(t.status)), set = new Set(), pairs = [];
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j]; if (!overlap(a, b)) continue;
    const kind = a.carId && String(a.carId) === String(b.carId) ? 'car' : a.drvId && String(a.drvId) === String(b.drvId) ? 'drv' : null;
    if (kind) { set.add(a.id); set.add(b.id); pairs.push({ a, b, kind }); }
  }
  return { set, pairs };
}
const busyOf = (trips, t, key, val) => trips.filter(o => o.id !== t.id && ACTIVE.includes(o.status) && String(o[key]) === String(val) && overlap(o, t));

/* ============================================================== LOGIN */
function vLogin() {
  const demo = !API_URL;
  return `<div class="login">
    <form class="login-card" data-submit="login">
      <div class="brand"><div class="logo"></div><div><div class="brand-t">BẢO HƯNG</div><div class="brand-s">Quản lý xe công tác</div></div></div>
      <h1>Đăng nhập</h1>
      <label class="fld"><span>Tên đăng nhập</span><input name="username" autocomplete="username" required autocapitalize="none" value="${esc(S.lastUser || '')}"></label>
      <label class="fld"><span>Mật khẩu</span><input name="password" type="password" autocomplete="current-password" required></label>
      ${S.loginErr ? `<div class="err">${esc(S.loginErr)}</div>` : ''}
      <button class="btn btn-p btn-lg" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      ${canInstall() ? `<button type="button" class="btn btn-s btn-lg" data-a="install">${DL_ICON}Tải app về điện thoại / máy tính</button>` : ''}
      ${demo ? `<div class="demo-box"><b>Chế độ dùng thử</b> (chưa kết nối Google Sheet). Mật khẩu chung: <code>123456</code>
        <div class="demo-users">${['admin', 'dieuphoi', 'nhanvien', 'laixe', 'giamdoc'].map(u => `<button type="button" class="chip" data-a="demoLogin" data-v="${u}">${u}</button>`).join('')}</div></div>` : `<div class="muted small">Quên mật khẩu? Liên hệ quản trị hệ thống để được cấp lại.</div>`}
    </form></div>`;
}

/* ============================================================== SHELL */
function vApp() {
  const d = S.data, u = d.me, role = u.role, tabs = TABS[role] || [], desktop = innerWidth >= 900;
  const cf = conflictsOf(d.trips), T = today();
  const cnt = st => d.trips.filter(t => t.status === st).length;
  const overN = d.cars.reduce((s, c) => s + [dateCell(c.dk), kmCell(c), dateCell(c.bh)].filter(x => x.lvl === 2).length, 0);
  const myAssigned = d.trips.filter(t => String(t.drvId) === String(u.driverId) && t.status === 'assigned').length;
  const badges = { inbox: (role === 'bgd' ? 0 : cnt('pending') + cf.pairs.length), maint: overN, runs: myAssigned };
  const unread = d.notifs.filter(n => !n.read).length;
  const tabLabel = (tabs.find(x => x[0] === S.tab) || [])[1] || '';
  const canBook = role === 'sales' || role === 'bgd';
  const nav = tabs.map(([k, l, sh]) => `<button class="nav-i ${k === S.tab ? 'on' : ''}" data-a="tab" data-v="${k}"><span class="nav-bar"></span><span class="nav-l">${desktop ? esc(l) : esc(sh)}</span>${badges[k] ? `<span class="nav-b">${badges[k]}</span>` : ''}</button>`).join('');
  return `<div class="shell">
  ${desktop ? `<aside class="side">
    <div class="brand"><div class="logo"></div><div><div class="brand-t">BẢO HƯNG</div><div class="brand-s">Quản lý xe công tác</div></div></div>
    <nav class="side-nav">${nav}</nav>
    ${canInstall() ? `<button class="side-install" data-a="install">${DL_ICON}Tải app</button>` : ''}
    <button class="me" data-a="account"><span class="av">${esc(ini(u.name))}</span><span class="me-t"><b>${esc(u.name)}</b><small>${esc(ROLE_LABEL[role])}${u.dept ? ' · ' + esc(u.dept) : ''}</small></span><span class="me-c">⋯</span></button>
  </aside>` : ''}
  <div class="col">
    <header class="top">
      ${desktop ? '' : '<div class="logo sm"></div>'}
      <div class="top-t"><div class="muted small">${WDL[new Date().getDay()]}, ${dmy(T)}${API_URL ? '' : ' · <b style="color:#A31E22">Dùng thử</b>'}</div><div class="h1">${esc(tabLabel)}</div></div>
      ${canBook && desktop ? `<button class="btn btn-p" data-a="newTrip">+ Đặt xe công tác</button>` : ''}
      <button class="icon-btn" data-a="refresh" title="Tải lại">${S.loading ? '<span class="spin"></span>' : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"></path><path d="M21 3v6h-6"></path></svg>'}</button>
      <button class="icon-btn" data-a="notif" title="Thông báo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>${unread ? `<span class="dot-n">${unread}</span>` : ''}</button>
      ${!desktop && canInstall() ? `<button class="icon-btn" data-a="install" title="Tải app">${DL_ICON}</button>` : ''}
      ${desktop ? '' : `<button class="av av-btn" data-a="account">${esc(ini(u.name))}</button>`}
    </header>
    <main class="main">${vTab(cf)}</main>
  </div></div>
  ${canBook && !desktop && !S.sel ? `<button class="fab" data-a="newTrip">+ Đặt xe</button>` : ''}
  ${desktop ? '' : `<nav class="bnav">${nav}</nav>`}
  ${S.notifOpen ? vNotifs() : ''}
  ${S.sel ? vDrawer(cf) : ''}
  ${S.form ? vForm() : ''}
  ${S.toast ? `<div class="toast ${S.toastErr ? 'toast-e' : ''}">${esc(S.toast)}</div>` : ''}`;
}

function vTab(cf) {
  switch (S.tab) {
    case 'mine': case 'runs': case 'history': case 'inbox': return vLists(cf);
    case 'schedule': return vSchedule(cf);
    case 'fleet': return vFleet();
    case 'maint': return vMaint();
    case 'report': return vReport();
    case 'users': return vUsers();
  }
  return '';
}

/* ============================================================== LISTS */
function tripCard(t, cf) {
  const d = S.data, car = d.cars.find(c => String(c.id) === String(t.carId)), dr = d.drivers.find(x => String(x.id) === String(t.drvId)), sd = parse(t.start);
  return `<div class="trip" data-a="open" data-v="${esc(t.id)}">
    <div class="trip-d"><small>${WD[sd.getDay()]}</small><b>${pad(sd.getDate())}</b><small>Th${sd.getMonth() + 1}</small></div>
    <div class="trip-b">
      <div class="row-w"><span class="mono muted small">${esc(t.id)}</span>${stTag(t.status)}${cf.set.has(t.id) ? tag('Trùng lịch', '#FFFFFF', '#A31E22') : ''}</div>
      <div class="trip-t">${esc(t.dest)}</div>
      <div class="muted small ell">${esc(t.name)} · ${esc(t.dept)}${t.purpose ? ' · ' + esc(t.purpose) : ''}</div>
      <div class="row-w muted small"><span>${t.start === t.end ? dm(t.start) : dm(t.start) + ' – ' + dm(t.end)} · ${esc(t.time)}</span><span>${esc(t.pax)} người</span>${car ? `<span class="mono" style="color:#221C18">${esc(car.plate)}</span>` : ''}${dr ? `<span>Lái xe: ${esc(dr.name)}</span>` : ''}</div>
    </div><div class="chev">›</div></div>`;
}
function group(title, list, empty, cf) {
  return `<section class="grp"><div class="grp-h"><b>${esc(title)}</b><span>${list.length ? list.length + ' chuyến' : ''}</span></div>
    ${list.length ? `<div class="trip-grid">${list.map(t => tripCard(t, cf)).join('')}</div>` : `<div class="empty">${esc(empty)}</div>`}</section>`;
}
function vLists(cf) {
  const d = S.data, u = d.me, asc = (a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0, desc = (a, b) => -asc(a, b);
  const full = d.trips.filter(t => !t.limited);
  if (S.tab === 'mine') {
    const mine = full.filter(t => String(t.createdBy) === String(u.id));
    return group('Đang xử lý', mine.filter(t => OPEN.includes(t.status)).sort(asc), 'Chưa có chuyến nào đang xử lý. Bấm "Đặt xe" để tạo yêu cầu.', cf)
      + group('Đã kết thúc', mine.filter(t => !OPEN.includes(t.status)).sort(desc).slice(0, 30), 'Chưa có chuyến nào.', cf);
  }
  if (S.tab === 'runs') {
    const m = full.filter(t => String(t.drvId) === String(u.driverId)), n = m.filter(t => t.status === 'assigned').length;
    return (n ? `<div class="alert">Bạn có ${n} chuyến mới cần xác nhận.</div>` : '')
      + group('Cần xác nhận', m.filter(t => t.status === 'assigned').sort(asc), 'Không có chuyến mới.', cf)
      + group('Sắp tới & đang chạy', m.filter(t => t.status === 'accepted' || t.status === 'ongoing').sort(asc), 'Chưa có lịch chạy.', cf);
  }
  if (S.tab === 'history') {
    const done = full.filter(t => String(t.drvId) === String(u.driverId) && t.status === 'done'), ms = today().slice(0, 8) + '01', mm = done.filter(t => t.end >= ms);
    return `<div class="kpis">${[['Chuyến tháng này', mm.length], ['Km tháng này', num(mm.reduce((s, t) => s + N(t.kmEnd) - N(t.kmStart), 0))], ['Tổng số chuyến', done.length]].map(k => `<div class="card kpi"><small>${k[0]}</small><b>${k[1]}</b></div>`).join('')}</div>`
      + group('Chuyến đã chạy', done.sort(desc).slice(0, 50), 'Chưa có chuyến nào.', cf);
  }
  // inbox
  const FL = [['pending', 'Cần xếp xe'], ['assigned', 'Chờ lái xe'], ['accepted', 'Sắp chạy'], ['ongoing', 'Đang đi'], ['done', 'Hoàn thành'], ['rejected', 'Từ chối/Huỷ']];
  const match = t => S.filter === 'rejected' ? (t.status === 'rejected' || t.status === 'cancelled') : t.status === S.filter;
  const cnt = k => full.filter(t => k === 'rejected' ? (t.status === 'rejected' || t.status === 'cancelled') : t.status === k).length;
  const T = today(), freeToday = d.cars.filter(c => !full.some(t => String(t.carId) === String(c.id) && ACTIVE.includes(t.status) && t.start <= T && t.end >= T)).length;
  const tiles = [[cnt('pending'), 'Chờ xếp xe', 'pending', cnt('pending') > 0], [cf.pairs.length, 'Trùng lịch', '', cf.pairs.length > 0], [cnt('ongoing'), 'Xe đang chạy', 'ongoing', false], [freeToday + '/' + d.cars.length, 'Xe trống hôm nay', 'schedule', false]];
  const list = full.filter(match).sort(S.filter === 'done' || S.filter === 'rejected' ? desc : asc).slice(0, 60);
  const carOf = id => d.cars.find(c => String(c.id) === String(id)) || {}, drvOf = id => d.drivers.find(c => String(c.id) === String(id)) || {};
  return `<div class="tiles">${tiles.map(t => `<button class="card tile ${t[3] ? 'hot' : ''}" data-a="${t[2] === 'schedule' ? 'tab' : 'filter'}" data-v="${t[2] || S.filter}"><b>${t[0]}</b><small>${t[1]}</small></button>`).join('')}</div>
    ${cf.pairs.length ? `<div class="alert alert-r"><b>Phát hiện trùng lịch</b>${cf.pairs.map(p => `<div class="row-w"><span style="flex:1;min-width:200px">${p.kind === 'car' ? 'Xe ' + esc(carOf(p.a.carId).plate) : 'Lái xe ' + esc(drvOf(p.a.drvId).name)}: ${esc(p.a.id)} (${esc(p.a.dest)}) và ${esc(p.b.id)} (${esc(p.b.dest)}) chồng lịch.</span>${S.data.me.role === 'bgd' ? '' : `<button class="btn btn-s btn-sm" data-a="open" data-v="${esc(p.b.id)}">Xử lý ${esc(p.b.id)}</button>`}</div>`).join('')}</div>` : ''}
    <div class="chips">${FL.map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-a="filter" data-v="${k}">${l} · ${cnt(k)}</button>`).join('')}</div>
    ${group((FL.find(x => x[0] === S.filter) || [])[1] || '', list, 'Không có chuyến nào.', cf)}`;
}

/* ============================================================== SCHEDULE */
function vSchedule(cf) {
  const d = S.data, T = today(), dow = (parse(T).getDay() + 6) % 7, ws = addD(T, -dow + 7 * S.week), we = addD(ws, 6), wk = { start: ws, end: we };
  const drvOf = id => d.drivers.find(x => String(x.id) === String(id));
  const bars = list => {
    const lanes = [];
    return list.sort((a, b) => a.start < b.start ? -1 : 1).map(t => {
      const s = Math.max(0, diffD(ws, t.start)), e = Math.min(6, diffD(ws, t.end)); let l = lanes.findIndex(x => x < s); if (l < 0) { l = lanes.length; lanes.push(e); } else lanes[l] = e;
      const b = BAR[cf.set.has(t.id) && t.status !== 'ongoing' ? 'conflict' : t.status], dr = drvOf(t.drvId);
      return `<div class="bar" ${t.limited ? '' : `data-a="open" data-v="${esc(t.id)}"`} title="${esc(t.id + ' · ' + ST[t.status][0] + ' · ' + t.dest)}" style="grid-column:${s + 1} / ${e + 2};grid-row:${l + 1};background:${b[0]};color:${b[1]};border:1.5px ${b[3]} ${b[2]};${t.limited ? 'cursor:default' : ''}"><span class="mono">${esc(String(t.id).slice(3))}</span><span class="ell">${esc(t.dest)}${dr ? ' · ' + esc(dr.name) : ''}</span></div>`;
    }).join('');
  };
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => { const x = addD(ws, i); return `<div class="cal-day ${x === T ? 'today' : ''}"><small>${WD[parse(x).getDay()]}</small><b>${dm(x)}</b></div>`; }).join('');
  const pend = d.trips.filter(t => t.status === 'pending' && overlap(t, wk));
  const rows = [];
  if (pend.length && S.data.me.role !== 'sales') rows.push(`<div class="cal-row"><div class="cal-lab" style="background:#FBF6EA"><b class="mono" style="color:#7A5410">Chưa xếp xe</b><small>${pend.length} yêu cầu</small></div><div class="cal-track">${bars(pend)}</div></div>`);
  d.cars.forEach(c => rows.push(`<div class="cal-row"><div class="cal-lab" style="background:${dateCell(c.dk).lvl === 2 ? '#FBEDED' : '#FFFFFF'}"><b class="mono">${esc(c.plate)}</b><small>${esc(c.model)} · ${esc(c.seats)} chỗ</small></div><div class="cal-track">${bars(d.trips.filter(t => String(t.carId) === String(c.id) && (ACTIVE.includes(t.status) || t.status === 'done') && overlap(t, wk)))}</div></div>`));
  const legend = [['pending', 'Chưa xếp xe'], ['assigned', 'Chờ lái xe nhận'], ['accepted', 'Sẵn sàng'], ['ongoing', 'Đang đi'], ['done', 'Hoàn thành'], ['conflict', 'Trùng lịch']];
  return `<div class="card" style="padding:0;overflow:hidden">
    <div class="cal-head"><b style="flex:1;min-width:180px;font-size:16px">Tuần ${dm(ws)} – ${dmy(we)}</b><div class="row"><button class="btn btn-s btn-sq" data-a="week" data-v="-1">‹</button><button class="btn btn-s btn-sm" data-a="week" data-v="0">Tuần này</button><button class="btn btn-s btn-sq" data-a="week" data-v="1">›</button></div></div>
    <div style="overflow-x:auto"><div style="min-width:820px">
      <div class="cal-row cal-top"><div class="cal-lab"><small>Xe</small></div><div class="cal-days">${days}</div></div>
      ${rows.join('') || '<div class="empty" style="margin:16px">Chưa có xe trong danh mục.</div>'}
    </div></div>
    <div class="legend">${legend.map(([k, l]) => `<span><i style="background:${BAR[k][0]};border:1.5px ${BAR[k][3]} ${BAR[k][2]}"></i>${l}</span>`).join('')}</div>
  </div>`;
}

/* ============================================================== FLEET */
function vFleet() {
  const d = S.data, T = today(), d30 = addD(T, -30), manage = ['dispatch', 'admin'].includes(d.me.role);
  const onTrip = (k, v) => d.trips.find(t => String(t[k]) === String(v) && ACTIVE.includes(t.status) && t.start <= T && t.end >= T);
  const n30 = (k, v) => d.trips.filter(t => String(t[k]) === String(v) && t.start >= d30 && (t.status === 'done' || ACTIVE.includes(t.status))).length;
  const cars = d.cars.map(c => {
    const ot = onTrip('carId', c.id); let now = ['Sẵn sàng', '#245B3A', '#E0EFE5'];
    if (ot && ot.status === 'ongoing') now = ['Đang chạy', '#FFFFFF', '#A31E22']; else if (dateCell(c.dk).lvl === 2) now = ['Quá hạn ĐK', '#8C1A1D', '#F6E1E1']; else if (ot) now = ['Có lịch hôm nay', '#1F4E79', '#E1ECF6'];
    return `<div class="card car"><div class="row-b"><span class="plate">${esc(c.plate)}</span>${tag(now[0], now[1], now[2])}</div><b>${esc(c.model)}</b>
      <div class="car-m"><span>${esc(c.seats)} chỗ</span><span>${num(c.odo)} km</span><span>ĐK đến ${dmy(c.dk)}</span><span>${n30('carId', c.id)} chuyến/30 ngày</span></div>
      ${manage ? `<button class="link" data-a="editCar" data-v="${esc(c.id)}">Sửa thông tin</button>` : ''}</div>`;
  }).join('');
  const drivers = d.drivers.map(v => {
    const ot = onTrip('drvId', v.id); let now = ['Rảnh', '#245B3A', '#E0EFE5'];
    if (ot && ot.status === 'ongoing') now = ['Đang chạy', '#FFFFFF', '#A31E22']; else if (ot) now = ['Có lịch hôm nay', '#1F4E79', '#E1ECF6'];
    if (dateCell(v.licExp).lvl === 2) now = ['Bằng hết hạn', '#8C1A1D', '#F6E1E1'];
    return `<div class="li"><span class="av av-l">${esc(ini(v.name))}</span><div style="flex:1;min-width:160px"><b>${esc(v.name)}</b><div class="muted small">${esc(v.phone)} · Bằng ${esc(v.lic)} · hạn ${dmy(v.licExp)}</div></div><span class="muted small">${n30('drvId', v.id)} chuyến/30 ngày</span>${tag(now[0], now[1], now[2])}${manage ? `<button class="link" data-a="editDriver" data-v="${esc(v.id)}">Sửa</button>` : ''}</div>`;
  }).join('');
  return `<div class="row-b"><b class="h2">Đội xe · ${d.cars.length} xe</b>${manage ? '<button class="btn btn-s" data-a="addCar">+ Thêm xe</button>' : ''}</div>
    ${d.cars.length ? `<div class="car-grid">${cars}</div>` : '<div class="empty">Chưa có xe. Bấm "Thêm xe" để bắt đầu.</div>'}
    <div class="row-b" style="margin-top:8px"><b class="h2">Lái xe · ${d.drivers.length} người</b>${manage ? '<button class="btn btn-s" data-a="addDriver">+ Thêm lái xe</button>' : ''}</div>
    ${d.drivers.length ? `<div class="card list">${drivers}</div>` : '<div class="empty">Chưa có lái xe.</div>'}`;
}

/* ============================================================== MAINT */
function vMaint() {
  const d = S.data, manage = ['dispatch', 'admin'].includes(d.me.role);
  let over = 0, soon = 0;
  const rows = d.cars.map(c => {
    const cells = [dateCell(c.dk), kmCell(c), dateCell(c.bh)]; cells.forEach(x => { if (x.lvl === 2) over++; if (x.lvl === 1) soon++; });
    return `<div class="mt-row"><div><b class="mono">${esc(c.plate)}</b><div class="muted small">${esc(c.model)} · ${num(c.odo)} km</div></div>${cells.map(x => `<div class="mt-cell"><span>${esc(x.value)}</span>${tag(x.tag, x.fg, x.bg)}</div>`).join('')}<div>${manage ? `<button class="btn btn-s btn-sm" data-a="addMaint" data-v="${esc(c.id)}">Ghi nhận</button>` : ''}</div></div>`;
  }).join('');
  const carOf = id => d.cars.find(c => String(c.id) === String(id)) || {};
  const log = d.maint.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 60).map(m => `<div class="li"><span class="muted small" style="width:84px">${dmy(m.date)}</span>${tag(m.type, '#5F5750', '#ECE8E2')}<div style="flex:1;min-width:180px"><div>${esc(m.content)}</div><div class="muted small mono">${esc(carOf(m.carId).plate || '—')} · ${num(m.km)} km</div></div><b>${vnd(m.cost)}</b></div>`).join('');
  return `<div class="row-b"><div><b class="h2">Đăng kiểm, bảo dưỡng, bảo hiểm</b><div class="muted small">${over ? over + ' mục quá hạn' : 'Không có mục quá hạn'} · ${soon} mục sắp đến hạn (30 ngày / 1.500 km)</div></div>${manage ? '<button class="btn btn-p" data-a="addMaint">+ Ghi nhận bảo dưỡng</button>' : ''}</div>
    <div class="card" style="padding:0;overflow-x:auto"><div style="min-width:720px"><div class="mt-row mt-h"><span>Xe</span><span>Đăng kiểm</span><span>Bảo dưỡng định kỳ</span><span>Bảo hiểm</span><span></span></div>${rows}</div></div>
    <b class="h2" style="margin-top:6px">Lịch sử bảo dưỡng &amp; sửa chữa</b>
    ${log ? `<div class="card list">${log}</div>` : '<div class="empty">Chưa có ghi nhận nào.</div>'}`;
}

/* ============================================================== REPORT */
function vReport() {
  const d = S.data, T = today(), now = parse(T), mStart = T.slice(0, 8) + '01';
  let from, label;
  if (S.period === 'm1') { from = mStart; label = 'Tháng ' + (now.getMonth() + 1) + '/' + now.getFullYear(); }
  else { const n = S.period === 'm3' ? 90 : 180; from = addD(T, -n + 1); label = (S.period === 'm3' ? '3' : '6') + ' tháng gần nhất'; }
  const len = diffD(from, T) + 1, pfrom = addD(from, -len), pto = addD(from, -1);
  const done = d.trips.filter(t => t.status === 'done' && !t.limited);
  const cur = done.filter(t => t.end >= from && t.end <= T), prev = done.filter(t => t.end >= pfrom && t.end <= pto);
  const kmS = ts => ts.reduce((s, t) => s + Math.max(0, N(t.kmEnd) - N(t.kmStart)), 0), csS = ts => ts.reduce((s, t) => s + cost(t), 0), cdS = ts => ts.reduce((s, t) => s + diffD(t.start, t.end) + 1, 0);
  const dl = (a, b) => b ? `${a >= b ? '+' : ''}${Math.round((a - b) / b * 100)}% so với kỳ trước` : 'Chưa có số liệu kỳ trước';
  const kc = kmS(cur), cc = csS(cur);
  const kpis = [['Số chuyến', cur.length, dl(cur.length, prev.length)], ['Tổng quãng đường', num(kc) + ' km', dl(kc, kmS(prev))], ['Tổng chi phí', tr(cc), dl(cc, csS(prev))],
    ['Chi phí bình quân', kc ? vnd(cc / kc) + '/km' : '—', 'Nhiên liệu, cầu đường, gửi xe'], ['Tỷ lệ sử dụng xe', (d.cars.length ? Math.round(cdS(cur) / (d.cars.length * len) * 100) : 0) + '%', 'Ngày-xe có chuyến / tổng ngày-xe']];
  const ms = []; for (let i = 5; i >= 0; i--) { const m = new Date(now.getFullYear(), now.getMonth() - i, 1), a = iso(m), b = iso(new Date(m.getFullYear(), m.getMonth() + 1, 0)); ms.push({ l: 'T' + (m.getMonth() + 1), v: csS(done.filter(t => t.end >= a && t.end <= b)), cur: i === 0 }); }
  const mx = Math.max(1, ...ms.map(m => m.v));
  const dg = {}; cur.forEach(t => { const k = t.dept || 'Khác'; dg[k] = dg[k] || { n: 0, c: 0 }; dg[k].n++; dg[k].c += cost(t); });
  const dmx = Math.max(1, ...Object.values(dg).map(x => x.c));
  const P = [['m1', 'Tháng này'], ['m3', '3 tháng'], ['m6', '6 tháng']];
  return `<div class="row-b" style="align-items:flex-end"><div><b class="h2" style="font-size:18px">${label}</b><div class="muted small">Tính từ các chuyến đã hoàn thành</div></div>
      <div class="seg">${P.map(([k, l]) => `<button class="${S.period === k ? 'on' : ''}" data-a="period" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="kpis">${kpis.map(k => `<div class="card kpi"><small>${k[0]}</small><b>${k[1]}</b><small class="muted">${k[2]}</small></div>`).join('')}</div>
    <div class="two">
      <div class="card"><b>Chi phí theo tháng</b><div class="bars">${ms.map(m => `<div class="bcol"><small class="muted">${m.v ? tr(m.v) : '—'}</small><div class="btrack"><div style="height:${Math.max(2, Math.round(m.v / mx * 100))}%;background:${m.cur ? '#A31E22' : '#E2C27A'}"></div></div><small style="font-weight:600;color:${m.cur ? '#A31E22' : '#6F655D'}">${m.l}</small></div>`).join('')}</div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px"><b>Theo phòng ban</b>${Object.keys(dg).length ? Object.entries(dg).sort((a, b) => b[1].c - a[1].c).map(([n, x]) => `<div><div class="row-b small"><span>${esc(n)} <span class="muted">· ${x.n} chuyến</span></span><b>${tr(x.c)}</b></div><div class="meter"><i style="width:${Math.round(x.c / dmx * 100)}%;background:#B8892B"></i></div></div>`).join('') : '<div class="muted small">Chưa có số liệu trong kỳ.</div>'}</div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto"><div style="min-width:620px"><div class="rp-row rp-h"><span>Xe</span><span>Chuyến</span><span>Quãng đường</span><span>Chi phí</span><span>Tỷ lệ sử dụng</span></div>
      ${d.cars.map(c => { const ts = cur.filter(t => String(t.carId) === String(c.id)), u = Math.min(100, Math.round(cdS(ts) / len * 100)); return `<div class="rp-row"><span><b class="mono">${esc(c.plate)}</b> <span class="muted">${esc(c.model)}</span></span><span>${ts.length}</span><span>${num(kmS(ts))} km</span><span>${tr(csS(ts))}</span><span class="row"><span class="meter" style="flex:1;height:6px"><i style="width:${u}%;background:#A31E22"></i></span><span style="width:36px;text-align:right">${u}%</span></span></div>`; }).join('')}
    </div></div>
    <div><button class="btn btn-s" data-a="exportCsv">Tải danh sách chuyến trong kỳ (CSV)</button></div>`;
}

/* ============================================================== USERS (admin) */
function vUsers() {
  const d = S.data, drvOf = id => d.drivers.find(x => String(x.id) === String(id));
  const rows = d.users.slice().sort((a, b) => (a.role + a.name).localeCompare(b.role + b.name)).map(u => `<div class="li">
    <span class="av av-l">${esc(ini(u.name))}</span>
    <div style="flex:1;min-width:180px"><b>${esc(u.name)}</b> <span class="muted small mono">@${esc(u.username)}</span><div class="muted small">${esc(u.dept || '—')}${u.phone ? ' · ' + esc(u.phone) : ''}${u.role === 'driver' && drvOf(u.driverId) ? ' · liên kết lái xe ' + esc(drvOf(u.driverId).name) : ''}</div></div>
    ${tag(ROLE_LABEL[u.role] || u.role, '#221C18', '#ECE8E2')}${u.active ? '' : tag('Đã khoá', '#8C1A1D', '#F6E1E1')}
    <button class="link" data-a="editUser" data-v="${esc(u.id)}">Sửa</button></div>`).join('');
  return `<div class="row-b"><div><b class="h2">Tài khoản người dùng · ${d.users.length}</b><div class="muted small">Mỗi vai trò chỉ thấy và thao tác đúng phần việc của mình.</div></div><button class="btn btn-p" data-a="addUser">+ Thêm tài khoản</button></div>
    <div class="card list">${rows}</div>
    <div class="card small muted" style="line-height:1.6"><b style="color:#221C18">Phân quyền</b><br>
    <b>Nhân viên</b>: đặt xe, xem và huỷ chuyến của mình, xem lịch xe.<br>
    <b>Điều phối</b>: xếp xe/lái xe, từ chối yêu cầu, quản lý đội xe, bảo dưỡng, xem báo cáo.<br>
    <b>Lái xe</b>: nhận/từ chối chuyến được giao, ghi km và chi phí.<br>
    <b>Ban Giám đốc</b>: xem toàn bộ chuyến, lịch xe, báo cáo (chỉ xem), có thể đặt xe.<br>
    <b>Quản trị</b>: toàn quyền Điều phối + quản lý tài khoản.</div>`;
}

/* ============================================================== NOTIFS */
function vNotifs() {
  const n = S.data.notifs, push = 'Notification' in window && Notification.permission === 'default';
  return `<div class="scrim-t" data-a="notif"></div><div class="pop">
    <div class="row-b" style="padding:14px 16px"><b>Thông báo</b><button class="link" data-a="readAll">Đánh dấu đã đọc</button></div>
    ${push ? '<button class="push-ask" data-a="enablePush">Bật thông báo trên thiết bị này</button>' : ''}
    ${n.length ? n.map(x => `<button class="nt ${x.read ? '' : 'un'}" data-a="openNotif" data-v="${esc(x.id)}"><i></i><span><span>${esc(x.text)}</span><small>${relT(x.t)}</small></span></button>`).join('') : '<div class="empty" style="margin:0 16px 16px">Chưa có thông báo.</div>'}
  </div>`;
}

/* ============================================================== DRAWER */
function vDrawer(cf) {
  const d = S.data, u = d.me, t = d.trips.find(x => x.id === S.sel); if (!t) return '';
  const car = d.cars.find(c => String(c.id) === String(t.carId)), dr = d.drivers.find(x => String(x.id) === String(t.drvId));
  const idx = { pending: 0, assigned: 1, accepted: 2, ongoing: 3, done: 4 }[t.status];
  const notes = [];
  if (t.rejectReason) notes.push([(t.status === 'rejected' ? 'Lý do từ chối: ' : '') + t.rejectReason, '#F6E1E1', '#5E1214']);
  if (t.driverReject && t.status === 'pending') notes.push([t.driverReject, '#F5ECD7', '#5C4210']);
  if (cf.set.has(t.id)) { const os = cf.pairs.filter(p => p.a.id === t.id || p.b.id === t.id).map(p => p.a.id === t.id ? p.b.id : p.a.id); notes.push(['Trùng lịch với ' + os.join(', ') + '. Điều phối cần đổi xe hoặc lái xe.', '#F6E1E1', '#5E1214']); }
  const info = [['Người đặt', t.name + ' · ' + t.dept], ['Điện thoại', t.phone || '—'], ['Thời gian', (t.start === t.end ? dmy(t.start) : dm(t.start) + ' – ' + dmy(t.end)) + ' · ' + t.time], ['Số người', t.pax + ' người'],
    ['Xe', car ? car.plate + ' · ' + car.model : 'Chưa xếp'], ['Lái xe', dr ? dr.name + ' · ' + dr.phone : 'Chưa xếp']];
  if (N(t.kmStart)) info.push(['Km xuất phát', num(t.kmStart)]);
  if (N(t.kmEnd)) info.push(['Km kết thúc', num(t.kmEnd) + ' (' + num(N(t.kmEnd) - N(t.kmStart)) + ' km)']);
  const canAssign = ['dispatch', 'admin'].includes(u.role) && ['pending', 'assigned', 'accepted'].includes(t.status);
  const A = S.act, P = S.pick, dis = S.busy ? 'disabled' : '';
  const B = (label, a, kind) => `<button class="btn btn-${kind} ${kind === 's' ? '' : 'grow'}" data-a="${a}" ${dis}>${S.busy && kind !== 's' ? 'Đang lưu…' : label}</button>`;
  const F = (k, label, o = {}) => `<label class="fld ${o.full ? 'full' : ''}"><span>${label}</span>${o.area ? `<textarea data-act="${k}" rows="2" placeholder="${esc(o.ph || '')}">${esc(A[k] || '')}</textarea>` : `<input data-act="${k}" inputmode="numeric" placeholder="${esc(o.ph || '')}" value="${esc(A[k] || '')}">`}</label>`;
  const panel = (title, fields, btns, extra) => `<div class="card panel">${title ? `<b class="h3">${title}</b>` : ''}${A.err ? `<div class="warn">${esc(A.err)}</div>` : ''}${fields ? `<div class="fgrid">${fields}</div>` : ''}${extra || ''}<div class="row-w">${btns}</div></div>`;
  const reason = (title, a, ph) => panel(title, F('reason', 'Lý do', { full: true, area: true, ph }), B('Xác nhận', a, 'd') + B('Quay lại', 'actReset', 's'));
  let assign = '', act = '';
  if (canAssign) {
    const opt = (on, ok, title, sub, tg, a, v) => `<div class="opt ${on ? 'on' : ''}" data-a="${a}" data-v="${esc(v)}"><i></i><div style="flex:1;min-width:0"><b>${esc(title)}</b><small>${esc(sub)}</small></div>${tag(tg, ok ? '#245B3A' : '#8C1A1D', ok ? '#E0EFE5' : '#F6E1E1')}</div>`;
    assign = `<div class="card panel"><b class="h3">Chọn xe</b>${d.cars.map(c => { const b = busyOf(d.trips, t, 'carId', c.id), tg = b.length ? 'Trùng ' + b[0].id : N(c.seats) < N(t.pax) ? 'Thiếu chỗ' : dateCell(c.dk).lvl === 2 ? 'Quá hạn ĐK' : 'Trống'; return opt(String(P.car) === String(c.id), tg === 'Trống', c.plate, c.model + ' · ' + c.seats + ' chỗ', tg, 'pickCar', c.id); }).join('') || '<div class="muted small">Chưa có xe trong danh mục.</div>'}
      <b class="h3" style="margin-top:6px">Chọn lái xe</b>${d.drivers.map(v => { const b = busyOf(d.trips, t, 'drvId', v.id), tg = b.length ? 'Trùng ' + b[0].id : dateCell(v.licExp).lvl === 2 ? 'Hết hạn bằng' : 'Trống'; return opt(String(P.drv) === String(v.id), tg === 'Trống', v.name, v.phone + ' · Bằng ' + v.lic, tg, 'pickDrv', v.id); }).join('') || '<div class="muted small">Chưa có lái xe.</div>'}</div>`;
    if (A.rej) act = reason('Từ chối yêu cầu', 'doReject', 'VD: Hết xe phù hợp trong ngày');
    else {
      const bc = P.car ? busyOf(d.trips, t, 'carId', P.car) : [], bd = P.drv ? busyOf(d.trips, t, 'drvId', P.drv) : [];
      let w = ''; if (bc.length) w += 'Xe đã có chuyến ' + bc.map(x => x.id).join(', ') + ' cùng thời gian. '; if (bd.length) w += 'Lái xe đã có chuyến ' + bd.map(x => x.id).join(', ') + '. ';
      const blocked = (bc.length || bd.length) && !d.config.allowConflict; if (blocked) w += 'Chọn xe hoặc lái xe khác.';
      if (!P.car || !P.drv) w = w || 'Chọn xe và lái xe để tiếp tục.';
      act = `<div class="card panel">${w ? `<div class="warn">${esc(w)}</div>` : ''}${A.err ? `<div class="warn">${esc(A.err)}</div>` : ''}<div class="row-w">${P.car && P.drv && !blocked ? B(t.status === 'pending' ? 'Xếp xe & gửi lái xe' : 'Lưu thay đổi', 'doAssign', 'p') : ''}${t.status === 'pending' ? B('Từ chối', 'actRej', 's') : B('Huỷ chuyến', 'actCancel', 's')}</div></div>`;
      if (A.cancel) act = reason('Huỷ chuyến', 'doCancel', 'Không bắt buộc');
    }
  } else if (u.role === 'driver' && String(t.drvId) === String(u.driverId)) {
    if (t.status === 'assigned') act = A.rej ? reason('Từ chối chuyến', 'doDecline', 'Bận việc khác, xe hỏng…') : panel('Xác nhận lịch trình', '', B('Nhận chuyến', 'doAccept', 'p') + B('Từ chối', 'actRej', 's'));
    if (t.status === 'accepted') act = panel('Bắt đầu chuyến đi', F('kmStart', 'Số km trên đồng hồ lúc xuất phát', { full: true, ph: car ? 'Lần cuối: ' + num(car.odo) : '' }), B('Bắt đầu chuyến', 'doStart', 'p'));
    if (t.status === 'ongoing') {
      const km = N(A.kmEnd) - N(t.kmStart), tot = N(A.fuel) + N(A.toll) + N(A.park) + N(A.other);
      act = panel('Kết thúc chuyến', F('kmEnd', 'Km lúc về', { full: true, ph: 'Xuất phát: ' + num(t.kmStart) }) + F('fuel', 'Nhiên liệu (đ)') + F('toll', 'Phí cầu đường (đ)') + F('park', 'Gửi xe (đ)') + F('other', 'Chi phí khác (đ)'),
        B('Hoàn thành chuyến', 'doFinish', 'p'), `<div class="calc" id="calc">${km > 0 ? 'Quãng đường ' + num(km) + ' km · ' : ''}Tổng chi phí ${vnd(tot)}</div>`);
    }
  } else if (String(t.createdBy) === String(u.id) && ['pending', 'assigned', 'accepted'].includes(t.status)) {
    act = A.cancel ? reason('Huỷ chuyến', 'doCancel', 'Không bắt buộc') : panel('', '', B('Huỷ yêu cầu', 'actCancel', 's'));
  }
  return `<div class="scrim" data-a="closeSel"></div><aside class="drawer">
    <div class="dr-h"><span class="mono" style="font-weight:600">${esc(t.id)}</span>${stTag(t.status)}${cf.set.has(t.id) ? tag('Trùng lịch', '#FFFFFF', '#A31E22') : ''}<span style="flex:1"></span><button class="btn btn-s btn-sm" data-a="closeSel">Đóng</button></div>
    <div class="dr-b">
      <div><div class="dr-t">${esc(t.dest)}</div><div class="muted" style="margin-top:4px">${esc(t.purpose || '')}</div></div>
      ${idx !== undefined ? `<div class="steps">${['Gửi yêu cầu', 'Xếp xe', 'Lái xe nhận', 'Đang đi', 'Hoàn thành'].map((l, i) => `<div class="${i <= idx ? 'on' : ''} ${i === idx ? 'cur' : ''}"><i></i><small>${l}</small></div>`).join('')}</div>` : ''}
      ${notes.map(n => `<div class="note" style="background:${n[1]};color:${n[2]}">${esc(n[0])}</div>`).join('')}
      <div class="card kv">${info.map(r => `<div><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join('')}</div>
      ${t.status === 'done' ? `<div class="card kv">${[['Nhiên liệu', t.fuel], ['Phí cầu đường', t.toll], ['Gửi xe', t.park], ['Chi phí khác', t.other]].map(r => `<div><span>${r[0]}</span><b>${vnd(N(r[1]))}</b></div>`).join('')}<div class="kv-t"><span>Tổng chi phí</span><b>${vnd(cost(t))}</b></div></div>` : ''}
      ${assign}${act}
    </div></aside>`;
}

/* ============================================================== FORM MODAL */
function vForm() {
  const f = S.form, v = f.vals, d = S.data;
  const opts = (arr, cur) => arr.map(o => { const val = typeof o === 'string' ? o : o.v, lab = typeof o === 'string' ? o : o.l; return `<option value="${esc(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('');
  const F = (k, label, type, o = {}) => `<label class="fld ${o.full ? 'full' : ''}"><span>${label}</span>${type === 'select' ? `<select data-f="${k}">${opts(o.options, v[k])}</select>` : type === 'area' ? `<textarea data-f="${k}" rows="2" placeholder="${esc(o.ph || '')}">${esc(v[k] || '')}</textarea>` : `<input data-f="${k}" type="${type}" placeholder="${esc(o.ph || '')}" value="${esc(v[k] ?? '')}" ${o.min ? `min="${o.min}"` : ''}>`}</label>`;
  let title = '', sub = '', fields = '', submit = 'Lưu', hint = '';
  if (f.kind === 'trip') {
    title = 'Đặt xe công tác'; sub = 'Yêu cầu được gửi tới Điều phối để xếp xe và lái xe.'; submit = 'Gửi yêu cầu';
    fields = F('name', 'Người đặt', 'text') + F('dept', 'Phòng ban', 'select', { options: DEPTS }) + F('phone', 'Điện thoại', 'tel') + F('pax', 'Số người đi', 'number')
      + F('dest', 'Điểm đến', 'text', { full: true, ph: 'VD: Bắc Ninh – KCN Yên Phong' }) + F('purpose', 'Mục đích chuyến đi', 'area', { full: true, ph: 'Gặp khách hàng, khảo sát…' })
      + F('start', 'Ngày đi', 'date', { min: today() }) + F('end', 'Ngày về', 'date', { min: v.start }) + F('time', 'Giờ xuất phát', 'time');
    hint = formHint();
  }
  if (f.kind === 'car') { title = v.id ? 'Sửa thông tin xe' : 'Thêm xe'; fields = F('plate', 'Biển số', 'text', { ph: '29A-000.00' }) + F('model', 'Dòng xe', 'text', { ph: 'Toyota Innova' }) + F('seats', 'Số chỗ', 'number') + F('odo', 'Số km hiện tại', 'number') + F('dk', 'Hạn đăng kiểm', 'date') + F('bh', 'Hạn bảo hiểm', 'date') + F('svcKm', 'Mốc bảo dưỡng tiếp theo (km)', 'number') + (v.id ? F('active', 'Trạng thái', 'select', { options: [{ v: 'true', l: 'Đang sử dụng' }, { v: 'false', l: 'Ngừng sử dụng (ẩn)' }] }) : ''); }
  if (f.kind === 'driver') { title = v.id ? 'Sửa thông tin lái xe' : 'Thêm lái xe'; sub = v.id ? '' : 'Sau khi thêm, vào mục Người dùng để tạo tài khoản đăng nhập cho lái xe.'; fields = F('name', 'Họ tên', 'text', { full: true }) + F('phone', 'Điện thoại', 'tel') + F('lic', 'Hạng bằng', 'select', { options: ['B2', 'C', 'D', 'E', 'FC'] }) + F('licExp', 'Hạn bằng lái', 'date') + (v.id ? F('active', 'Trạng thái', 'select', { options: [{ v: 'true', l: 'Đang làm việc' }, { v: 'false', l: 'Nghỉ (ẩn)' }] }) : ''); }
  if (f.kind === 'maint') {
    title = 'Ghi nhận bảo dưỡng'; sub = 'Hạn và mốc km của xe được cập nhật sau khi lưu.';
    fields = F('carId', 'Xe', 'select', { options: d.cars.map(c => ({ v: c.id, l: c.plate + ' · ' + c.model })) }) + F('type', 'Loại công việc', 'select', { options: ['Bảo dưỡng', 'Đăng kiểm', 'Bảo hiểm', 'Sửa chữa'] })
      + F('date', 'Ngày thực hiện', 'date') + F('km', 'Số km lúc thực hiện', 'number') + F('content', 'Nội dung', 'area', { full: true, ph: 'Thay dầu, lọc gió…' }) + F('cost', 'Chi phí (đ)', 'number')
      + (v.type === 'Bảo dưỡng' ? F('next', 'Mốc bảo dưỡng tiếp theo (km)', 'number') : v.type === 'Sửa chữa' ? '' : F('next', 'Hạn mới', 'date'));
  }
  if (f.kind === 'user') {
    title = v.id ? 'Sửa tài khoản' : 'Thêm tài khoản';
    fields = F('name', 'Họ tên', 'text', { full: true }) + F('username', 'Tên đăng nhập', 'text', { ph: 'vd: hanguyen' }) + F('role', 'Vai trò', 'select', { options: Object.keys(ROLE_LABEL).map(k => ({ v: k, l: ROLE_LABEL[k] })) })
      + (v.role === 'driver' ? F('driverId', 'Liên kết lái xe', 'select', { options: [{ v: '', l: '— Chọn lái xe —' }].concat(d.drivers.map(x => ({ v: x.id, l: x.name + ' · ' + x.phone }))) }) : F('dept', 'Phòng ban', 'select', { options: [''].concat(DEPTS) }))
      + F('phone', 'Điện thoại', 'tel') + F('email', 'Email (nhận thông báo)', 'email', { full: true })
      + F('password', v.id ? 'Đặt lại mật khẩu (để trống nếu giữ nguyên)' : 'Mật khẩu (tối thiểu 6 ký tự)', 'text') + (v.id ? F('active', 'Trạng thái', 'select', { options: [{ v: 'true', l: 'Hoạt động' }, { v: 'false', l: 'Khoá tài khoản' }] }) : '');
  }
  if (f.kind === 'password') { title = 'Đổi mật khẩu'; fields = F('old', 'Mật khẩu hiện tại', 'password', { full: true }) + F('next', 'Mật khẩu mới (tối thiểu 6 ký tự)', 'password', { full: true }) + F('next2', 'Nhập lại mật khẩu mới', 'password', { full: true }); submit = 'Đổi mật khẩu'; }
  if (f.kind === 'install') {
    const ios = isIOS();
    const steps = ios
      ? ['Mở trang này bằng <b>Safari</b> (Chrome trên iPhone không cài được).', 'Bấm nút <b>Chia sẻ</b> <span class="kbd">⬆︎</span> ở thanh dưới cùng.', 'Kéo xuống, chọn <b>Thêm vào MH chính</b> (Add to Home Screen).', 'Bấm <b>Thêm</b>. Biểu tượng "Xe công tác" sẽ xuất hiện trên màn hình.']
      : ['Mở trang này bằng <b>Chrome</b> hoặc <b>Edge</b>.', 'Bấm menu <span class="kbd">⋮</span> ở góc trên bên phải.', 'Chọn <b>Cài đặt ứng dụng</b> / <b>Thêm vào màn hình chính</b> (Install app).', 'Bấm <b>Cài đặt</b>. App sẽ mở như một ứng dụng riêng.'];
    return `<div class="scrim" style="z-index:50" data-a="closeForm"></div><div class="modal">
      <div class="row-b" style="padding:18px 20px 6px;align-items:flex-start"><div><b style="font-size:19px">Tải app về ${ios ? 'iPhone / iPad' : 'thiết bị'}</b><div class="muted small" style="margin-top:3px">Cài một lần, mở nhanh từ màn hình chính và nhận thông báo.</div></div><button type="button" class="btn btn-s btn-sq" data-a="closeForm">×</button></div>
      <ol class="steps-ol">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <div style="padding:0 20px 20px;display:flex;justify-content:flex-end"><button class="btn btn-p" data-a="closeForm">Đã hiểu</button></div></div>`;
  }
  if (f.kind === 'account') {
    const u = d.me;
    return `<div class="scrim" style="z-index:50" data-a="closeForm"></div><div class="modal">
      <div class="row" style="gap:12px;padding:20px"><span class="av av-l" style="width:46px;height:46px;font-size:16px">${esc(ini(u.name))}</span><div style="flex:1"><b style="font-size:17px">${esc(u.name)}</b><div class="muted small">@${esc(u.username)} · ${esc(ROLE_LABEL[u.role])}${u.dept ? ' · ' + esc(u.dept) : ''}</div></div><button class="btn btn-s btn-sq" data-a="closeForm">×</button></div>
      <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:8px">
        ${canInstall() ? `<button class="btn btn-p btn-lg" data-a="install">${DL_ICON}Tải app về thiết bị</button>` : ''}
        <button class="btn btn-s btn-lg" data-a="changePass">Đổi mật khẩu</button>
        ${'Notification' in window && Notification.permission !== 'granted' ? '<button class="btn btn-s btn-lg" data-a="enablePush">Bật thông báo trên thiết bị này</button>' : ''}
        <button class="btn btn-d btn-lg" data-a="logout">Đăng xuất</button>
        ${API_URL ? '' : '<button class="link" data-a="resetDemo" style="align-self:center;margin-top:6px">Khôi phục dữ liệu dùng thử</button>'}
      </div></div>`;
  }
  return `<div class="scrim" style="z-index:50" data-a="closeForm"></div><form class="modal" data-submit="form">
    <div class="row-b" style="padding:18px 20px 6px;align-items:flex-start"><div><b style="font-size:19px">${title}</b>${sub ? `<div class="muted small" style="margin-top:3px">${sub}</div>` : ''}</div><button type="button" class="btn btn-s btn-sq" data-a="closeForm">×</button></div>
    <div class="fgrid" style="padding:14px 20px">${fields}</div>
    <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:10px"><div id="fhint">${hint}</div>${f.err ? `<div class="err">${esc(f.err)}</div>` : ''}
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-s" data-a="closeForm">Huỷ</button><button class="btn btn-p" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Đang lưu…' : submit}</button></div></div></form>`;
}

function formHint() {
  const f = S.form; if (!f || f.kind !== 'trip') return '';
  const v = f.vals, d = S.data;
  if (!(isDate(v.start) && isDate(v.end) && v.end >= v.start)) return '';
  const free = d.cars.filter(c => N(c.seats) >= N(v.pax) && !d.trips.some(o => ACTIVE.includes(o.status) && String(o.carId) === String(c.id) && overlap(o, v)));
  return free.length ? `<div class="hint ok">Còn ${free.length}/${d.cars.length} xe đủ chỗ đang trống trong thời gian này.</div>` : `<div class="hint bad">Không còn xe đủ chỗ trống trong thời gian này. Yêu cầu vẫn được gửi, Điều phối sẽ sắp xếp.</div>`;
}
