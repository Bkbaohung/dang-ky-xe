/* Báo cáo lịch trình hằng ngày & chi phí thanh toán của lái xe */
const LOG_ST = { submitted: ['Chờ duyệt', '#7A5410', '#F5ECD7'], returned: ['Trả lại', '#8C1A1D', '#F6E1E1'], approved: ['Chờ thanh toán', '#1F4E79', '#E1ECF6'], paid: ['Đã thanh toán', '#245B3A', '#E0EFE5'] };
const COST_TYPES = ['Nhiên liệu', 'Cầu đường / BOT', 'Gửi xe', 'Rửa xe', 'Sửa chữa nhỏ', 'Công tác phí / ăn uống', 'Nghỉ đêm', 'Khác'];
const CASH = 'Tiền mặt (lái xe ứng)';
const PAY_METHODS = [CASH, 'Thẻ xăng công ty', 'Công ty chuyển khoản'];
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtTs = t => { if (!t) return '—'; const x = new Date(Number(t)); return pad(x.getHours()) + ':' + pad(x.getMinutes()) + ' ' + dmy(iso(x)); };
const logOf = id => (S.data.logs || []).find(l => String(l.id) === String(id));
const costsOf = id => (S.data.costs || []).filter(c => String(c.logId) === String(id));
const carById = id => S.data.cars.find(c => String(c.id) === String(id));
const dayTrips = (drvId, date) => S.data.trips.filter(t => !t.limited && String(t.drvId) === String(drvId) && (t.status === 'done' || t.status === 'ongoing') && t.start <= date && t.end >= date);
const dayTripCost = (trips, date) => trips.filter(t => t.status === 'done' && t.end === date).reduce((s, t) => s + cost(t), 0);
const logTag = s => tag(LOG_ST[s][0], LOG_ST[s][1], LOG_ST[s][2]);
const photoSrc = u => { if (!u) return ''; if (u.startsWith('data:')) return u; const m = u.match(/\/d\/([^/?]+)/) || u.match(/[?&]id=([^&]+)/); return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400' : u; };
const defaultLogFilter = () => S.data.me.role === 'ketoan' ? 'approved' : S.data.me.role === 'bgd' ? 'paid' : 'submitted';

function missingDays() {
  const u = S.data.me; if (u.role !== 'driver') return [];
  const have = new Set((S.data.logs || []).filter(l => String(l.drvId) === String(u.driverId)).map(l => l.date)), out = [];
  for (let i = 1; i <= 7; i++) { const d = addD(today(), -i); if (!have.has(d) && dayTrips(u.driverId, d).length) out.push(d); }
  return out;
}
function logBadges(role) {
  const L = S.data.logs || [];
  if (role === 'driver') return { daily: missingDays().length + L.filter(l => String(l.drvId) === String(S.data.me.driverId) && l.status === 'returned').length };
  if (role === 'ketoan') return { logs: L.filter(l => l.status === 'approved').length };
  if (role === 'dispatch' || role === 'admin') return { logs: L.filter(l => l.status === 'submitted').length };
  return {};
}
function extraCosts(from, to, carId) {
  const ok = new Set((S.data.logs || []).filter(l => l.status !== 'returned').map(l => String(l.id)));
  return (S.data.costs || []).filter(c => ok.has(String(c.logId)) && c.date >= from && c.date <= to && (!carId || String(c.carId) === String(carId))).reduce((s, c) => s + N(c.amount), 0);
}
function logReminder() {
  const m = missingDays();
  return m.length ? `<div class="alert row-w"><span style="flex:1;min-width:200px">Bạn chưa gửi báo cáo lịch trình &amp; chi phí ngày ${m.map(dm).join(', ')}.</span><button class="btn btn-p btn-sm" data-a="logNew" data-v="${m[0]}">Báo cáo ngay</button></div>` : '';
}

function logCard(l, showDriver) {
  const sd = parse(l.date);
  return `<div class="trip" data-a="logOpen" data-v="${esc(l.id)}">
    <div class="trip-d"><small>${WD[sd.getDay()]}</small><b>${pad(sd.getDate())}</b><small>Th${sd.getMonth() + 1}</small></div>
    <div class="trip-b">
      <div class="row-w"><span class="mono muted small">${esc(l.id)}</span>${logTag(l.status)}</div>
      <div class="trip-t">${showDriver ? esc(l.drvName) + ' · ' : ''}<span class="mono">${esc(l.plate)}</span></div>
      <div class="muted small ell">${esc(l.routeText || '—')}</div>
      <div class="row-w muted small"><span>${num(l.km)} km</span><span>Chi phí ${vnd(N(l.total))}</span><span style="color:#221C18;font-weight:600">Hoàn ứng ${vnd(N(l.reimburse))}</span></div>
    </div><div class="chev">›</div></div>`;
}

/* ------------------------------------------------------------ lái xe */
function vDaily() {
  const d = S.data, u = d.me, T = today(), ms = T.slice(0, 8) + '01';
  const mine = (d.logs || []).filter(l => String(l.drvId) === String(u.driverId)).sort((a, b) => a.date < b.date ? 1 : -1);
  const todayLog = mine.find(l => l.date === T), miss = missingDays(), mm = mine.filter(l => l.date >= ms), ret = mine.filter(l => l.status === 'returned');
  const waiting = mine.filter(l => l.status === 'submitted' || l.status === 'approved').reduce((s, l) => s + N(l.reimburse), 0);
  const paid = mm.filter(l => l.status === 'paid').reduce((s, l) => s + N(l.reimburse), 0);
  return `<div class="row-b"><div><b class="h2">Lịch trình &amp; chi phí hằng ngày</b><div class="muted small">Gửi cuối mỗi ngày chạy xe. Điều phối duyệt, Kế toán hoàn ứng.</div></div>
      <button class="btn btn-p" data-a="logNew" data-v="${T}">${todayLog ? 'Xem báo cáo hôm nay' : '+ Báo cáo hôm nay'}</button></div>
    ${miss.length ? `<div class="alert row-w"><b style="margin-right:4px">Chưa gửi báo cáo:</b>${miss.map(x => `<button class="chip" data-a="logNew" data-v="${x}">${WD[parse(x).getDay()]} ${dm(x)}</button>`).join('')}</div>` : ''}
    ${ret.length ? `<div class="alert alert-r"><b>${ret.length} báo cáo bị trả lại, mở ra để sửa và gửi lại.</b></div>` : ''}
    <div class="kpis">${[['Ngày đã báo cáo tháng này', mm.length], ['Km tháng này', num(mm.reduce((s, l) => s + N(l.km), 0))], ['Chờ hoàn ứng', vnd(waiting)], ['Đã hoàn ứng tháng này', vnd(paid)]].map(k => `<div class="card kpi"><small>${k[0]}</small><b>${k[1]}</b></div>`).join('')}</div>
    <section class="grp"><div class="grp-h"><b>Báo cáo đã gửi</b><span>${mine.length ? mine.length + ' ngày' : ''}</span></div>
    ${mine.length ? `<div class="trip-grid">${mine.slice(0, 40).map(l => logCard(l, false)).join('')}</div>` : '<div class="empty">Chưa có báo cáo nào. Bấm "Báo cáo hôm nay" để bắt đầu.</div>'}</section>`;
}

/* ------------------------------------------------------------ điều phối / kế toán / BGĐ */
function visibleLogs() {
  const f = S.logFilter || defaultLogFilter();
  return (S.data.logs || []).filter(l => l.status === f && (!S.logDrv || String(l.drvId) === S.logDrv)).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
function vLogs() {
  const d = S.data, role = d.me.role, L = d.logs || [], f = S.logFilter || defaultLogFilter();
  const F = [['submitted', 'Chờ duyệt'], ['approved', 'Chờ thanh toán'], ['paid', 'Đã thanh toán'], ['returned', 'Trả lại']];
  const cnt = k => L.filter(l => l.status === k).length, amt = k => L.filter(l => l.status === k).reduce((s, l) => s + N(l.reimburse), 0);
  const list = visibleLogs(), sum = list.reduce((s, l) => s + N(l.reimburse), 0);
  const canPay = (role === 'ketoan' || role === 'admin') && f === 'approved' && list.length;
  return `<div class="tiles">${F.map(([k, l]) => `<button class="card tile ${k === f ? 'sel' : ''}" data-a="logFilter" data-v="${k}"><b style="color:${k === 'paid' ? '#245B3A' : k === 'returned' ? '#8C1A1D' : k === 'approved' ? '#1F4E79' : '#7A5410'}">${cnt(k)}</b><small>${l}${k !== 'returned' ? ' · ' + tr(amt(k)) : ''}</small></button>`).join('')}</div>
    <div class="row-b"><div class="row-w"><select id="logDrvSel" class="sel-in"><option value="">Tất cả lái xe</option>${d.drivers.map(x => `<option value="${esc(x.id)}" ${S.logDrv === String(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span class="muted small">${list.length} báo cáo · hoàn ứng ${vnd(sum)}</span></div><div class="row-w">${f !== 'returned' && list.length ? `<button class="btn btn-s btn-sm" data-a="printDnAll">In giấy đề nghị (${Math.min(list.length, 50)})</button>` : ''}${f === 'paid' && list.length ? `<button class="btn btn-s btn-sm" data-a="printChiAll">In phiếu chi (${Math.min(list.length, 50)})</button>` : ''}<button class="btn btn-s btn-sm" data-a="logCsv">Xuất CSV</button></div></div>
    ${canPay ? `<div class="card panel"><b class="h3">Thanh toán hàng loạt</b><div class="muted small">Ghi nhận đã chi tiền cho ${list.length} báo cáo đang hiển thị, tổng ${vnd(sum)}.</div><div class="row-w"><input id="batchRef" class="sel-in" placeholder="Số phiếu chi (không bắt buộc)" style="flex:1;min-width:180px"><button class="btn btn-p" data-a="payBatch" ${S.busy ? 'disabled' : ''}>Xác nhận đã thanh toán</button></div></div>` : ''}
    ${list.length ? `<div class="trip-grid">${list.slice(0, 80).map(l => logCard(l, true)).join('')}</div>` : '<div class="empty">Không có báo cáo nào.</div>'}`;
}

function vLogDrawer() {
  const d = S.data, u = d.me, l = logOf(S.logSel); if (!l) return '';
  const LA = S.logAct || {}, dis = S.busy ? 'disabled' : '', car = carById(l.carId), cs = costsOf(l.id);
  const trips = String(l.tripIds || '').split(',').filter(Boolean).map(id => d.trips.find(t => t.id === id) || { id, dest: '', time: '' });
  const tcs = trips.filter(t => t.status === 'done' && t.end === l.date && cost(t) > 0);
  const stepIdx = { submitted: 0, approved: 1, paid: 2 }[l.status];
  const err = LA.err ? `<div class="warn">${esc(LA.err)}</div>` : '';
  let act = '';
  if (u.role === 'driver' && String(l.drvId) === String(u.driverId) && (l.status === 'submitted' || l.status === 'returned'))
    act = `<div class="card panel"><button class="btn btn-p btn-lg" data-a="logEdit">${l.status === 'returned' ? 'Sửa và gửi lại' : 'Sửa báo cáo'}</button></div>`;
  if ((u.role === 'dispatch' || u.role === 'admin') && l.status === 'submitted')
    act = LA.ret ? `<div class="card panel"><b class="h3">Trả lại cho lái xe</b>${err}<label class="fld"><span>Lý do</span><textarea data-la="reason" rows="2" placeholder="VD: Thiếu ảnh hoá đơn nhiên liệu">${esc(LA.reason || '')}</textarea></label><div class="row-w"><button class="btn btn-d grow" data-a="logReturn" ${dis}>Xác nhận trả lại</button><button class="btn btn-s" data-a="logRetHide">Quay lại</button></div></div>`
      : `<div class="card panel"><b class="h3">Duyệt báo cáo</b>${err}<div class="row-w"><button class="btn btn-p grow" data-a="logApprove" ${dis}>${S.busy ? 'Đang lưu…' : 'Duyệt, chuyển Kế toán'}</button><button class="btn btn-s" data-a="logRetShow">Trả lại</button></div></div>`;
  if ((u.role === 'ketoan' || u.role === 'admin') && l.status === 'approved')
    act = `<div class="card panel"><b class="h3">Hoàn ứng ${vnd(N(l.reimburse))} cho ${esc(l.drvName)}</b>${err}<label class="fld"><span>Số phiếu chi / ghi chú</span><input data-la="payRef" value="${esc(LA.payRef || '')}" placeholder="VD: PC-0125"></label><button class="btn btn-p btn-lg" data-a="logPay" ${dis}>${S.busy ? 'Đang lưu…' : 'Xác nhận đã thanh toán'}</button></div>`;
  return `<div class="scrim" data-a="logCloseSel"></div><aside class="drawer">
    <div class="dr-h"><span class="mono" style="font-weight:600">${esc(l.id)}</span>${logTag(l.status)}<span style="flex:1"></span><button class="btn btn-s btn-sm" data-a="logCloseSel">Đóng</button></div>
    <div class="dr-b">
      <div><div class="dr-t">Báo cáo ngày ${dmy(l.date)}</div><div class="muted" style="margin-top:4px">${esc(l.drvName)} · <span class="mono">${esc(l.plate)}</span>${car ? ' · ' + esc(car.model) : ''}</div></div>
      ${stepIdx !== undefined ? `<div class="steps" style="grid-template-columns:repeat(3,minmax(0,1fr))">${['Lái xe gửi', 'Điều phối duyệt', 'Kế toán thanh toán'].map((s, i) => `<div class="${i <= stepIdx ? 'on' : ''} ${i === stepIdx ? 'cur' : ''}"><i></i><small>${s}</small></div>`).join('')}</div>` : ''}
      ${l.status === 'returned' && l.reviewNote ? `<div class="note" style="background:#F6E1E1;color:#5E1214"><b>Lý do trả lại:</b> ${esc(l.reviewNote)}</div>` : ''}
      <div class="card kv"><div><span>Km đầu ngày</span><b>${num(l.kmStart)}</b></div><div><span>Km cuối ngày</span><b>${num(l.kmEnd)}</b></div><div><span>Quãng đường</span><b>${num(l.km)} km</b></div></div>
      <div class="ed-sec"><b class="h3">Lịch trình</b><div class="card list">
        ${trips.map(t => `<div class="li"><span class="mono small" style="width:64px">${esc(t.id)}</span><div style="flex:1;min-width:150px"><b>${esc(t.dest || '—')}</b><div class="muted small">Chuyến công tác${t.time ? ' · ' + esc(t.time) : ''}${t.name ? ' · ' + esc(t.name) : ''}</div></div></div>`).join('')}
        ${(l.route || []).map(r => `<div class="li"><span class="mono small" style="width:64px">${esc(r.time || '—')}</span><div style="flex:1;min-width:150px"><b>${esc([r.from, r.to].filter(Boolean).join(' → ') || '—')}</b>${r.purpose ? `<div class="muted small">${esc(r.purpose)}</div>` : ''}</div></div>`).join('')}
      </div></div>
      <div class="ed-sec"><b class="h3">Chi phí</b><div class="card list">
        ${tcs.map(t => `<div class="li"><div style="flex:1;min-width:150px"><b>Chi phí chuyến ${esc(t.id)}</b><div class="muted small">Nhiên liệu ${vnd(N(t.fuel))} · Cầu đường ${vnd(N(t.toll))} · Gửi xe ${vnd(N(t.park))}${N(t.other) ? ' · Khác ' + vnd(N(t.other)) : ''}</div></div><b>${vnd(cost(t))}</b></div>`).join('')}
        ${cs.map(c => `<div class="li">${c.photo ? `<span data-fview="log" data-fu="${esc(c.photo)}" data-fl="${esc(c.type)}" data-fn="${esc(c.note || '')}" data-fm="image/jpeg" style="cursor:pointer" title="Bấm để xem"><img class="thumb" data-fsrc="${esc(c.photo)}" alt="Chứng từ"></span>` : ''}<div style="flex:1;min-width:150px"><b>${esc(c.type)}</b><div class="muted small">${esc(c.method)}${String(c.invoice) === 'true' ? ' · Có hoá đơn' : ''}${c.note ? ' · ' + esc(c.note) : ''}</div></div><b>${vnd(N(c.amount))}</b></div>`).join('')}
        ${!tcs.length && !cs.length ? '<div class="li muted small">Không phát sinh chi phí.</div>' : ''}
      </div>
      <div class="card kv"><div><span>Tổng chi phí</span><b>${vnd(N(l.total))}</b></div><div class="kv-t"><span>Đề nghị hoàn ứng</span><b>${vnd(N(l.reimburse))}</b></div></div></div>
      ${l.note ? `<div class="card small"><b>Ghi chú của lái xe:</b> ${esc(l.note)}</div>` : ''}
      <div class="card kv"><div><span>Gửi lúc</span><b>${fmtTs(l.submittedAt)}</b></div>${l.approvedAt ? `<div><span>Duyệt</span><b>${esc(l.approvedBy)} · ${fmtTs(l.approvedAt)}</b></div>` : ''}${l.paidAt ? `<div><span>Thanh toán</span><b>${esc(l.paidBy)} · ${fmtTs(l.paidAt)}${l.payRef ? ' · ' + esc(l.payRef) : ''}</b></div>` : ''}</div>
      ${['submitted', 'approved', 'paid'].includes(l.status) ? `<div class="row-w"><button class="btn btn-s" data-a="printDn">In giấy đề nghị thanh toán</button>${l.status === 'paid' ? '<button class="btn btn-s" data-a="printChi">In phiếu chi</button>' : ''}</div>` : ''}
      ${act}
    </div></aside>`;
}

/* ------------------------------------------------------------ màn hình nhập báo cáo */
function logDefaults(date, carOverride) {
  const d = S.data, u = d.me, trips = dayTrips(u.driverId, date);
  const desc = (a, b) => a.date < b.date ? 1 : -1;
  const prevMine = (d.logs || []).filter(l => String(l.drvId) === String(u.driverId) && l.date < date).sort(desc)[0];
  const carId = carOverride || (trips[0] && trips[0].carId) || (prevMine && prevMine.carId) || (d.cars[0] && d.cars[0].id) || '';
  const car = carById(carId), prevCar = (d.logs || []).filter(l => String(l.carId) === String(carId) && l.date < date).sort(desc)[0];
  const ts = trips.filter(t => String(t.carId) === String(carId)), kss = ts.map(t => N(t.kmStart)).filter(Boolean), kes = ts.map(t => N(t.kmEnd)).filter(Boolean);
  const ks = kss.length ? Math.min(...kss) : prevCar ? N(prevCar.kmEnd) : car ? N(car.odo) : 0;
  const ke = kes.length ? Math.max(...kes) : 0;
  return { date, carId, kmStart: ks ? String(ks) : '', kmEnd: ke ? String(ke) : '', route: trips.length ? [] : [{ time: '', from: '', to: '', purpose: '' }], costs: [], note: '' };
}
function logCalc(v, tc) {
  const lines = v.costs.filter(c => N(c.amount) > 0), extra = lines.reduce((s, c) => s + N(c.amount), 0), cash = lines.filter(c => c.method === CASH).reduce((s, c) => s + N(c.amount), 0);
  return { km: Math.max(0, N(v.kmEnd) - N(v.kmStart)), extra, total: tc + extra, reimburse: tc + cash };
}
function totalsHtml(v, tc) {
  const c = logCalc(v, tc);
  return `<div><span>Quãng đường trong ngày</span><b>${N(v.kmEnd) ? num(c.km) + ' km' : '—'}</b></div>${tc ? `<div><span>Chi phí đã khai theo chuyến</span><b>${vnd(tc)}</b></div>` : ''}<div><span>Chi phí phát sinh</span><b>${vnd(c.extra)}</b></div><div><span>Tổng chi phí</span><b>${vnd(c.total)}</b></div><div class="kv-t"><span>Đề nghị hoàn ứng</span><b>${vnd(c.reimburse)}</b></div>`;
}
function vLogEdit() {
  const E = S.logEdit, v = E.vals, d = S.data, u = d.me, trips = dayTrips(u.driverId, v.date), tc = dayTripCost(trips, v.date);
  const prev = (d.logs || []).filter(l => String(l.carId) === String(v.carId) && l.date < v.date && String(l.id) !== String(v.id || '')).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const gap = prev && N(v.kmStart) && N(prev.kmEnd) ? N(v.kmStart) - N(prev.kmEnd) : 0;
  const o = (arr, cur) => arr.map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const stops = v.route.map((r, i) => `<div class="ed-row">
      <input type="time" data-lr="${i}.time" value="${esc(r.time)}" aria-label="Giờ">
      <input data-lr="${i}.purpose" value="${esc(r.purpose)}" placeholder="Nội dung (đưa đón, chở hàng…)" style="grid-column:span 2">
      <button type="button" class="x-btn" data-a="logDelStop" data-v="${i}" title="Xoá">×</button>
      <input data-lr="${i}.from" value="${esc(r.from)}" placeholder="Từ" style="grid-column:span 2">
      <input data-lr="${i}.to" value="${esc(r.to)}" placeholder="Đến" style="grid-column:span 2">
    </div>`).join('');
  const costs = v.costs.map((c, i) => `<div class="ed-row">
      <select data-lc="${i}.type" style="grid-column:span 2">${o(COST_TYPES, c.type)}</select>
      <input data-lc="${i}.amount" inputmode="numeric" value="${esc(c.amount)}" placeholder="Số tiền (đ)">
      <button type="button" class="x-btn" data-a="logDelCost" data-v="${i}" title="Xoá">×</button>
      <select data-lc="${i}.method" style="grid-column:span 2">${o(PAY_METHODS, c.method)}</select>
      <label class="chk" style="grid-column:span 2"><input type="checkbox" data-lc="${i}.invoice" ${c.invoice ? 'checked' : ''}>Có hoá đơn</label>
      <input data-lc="${i}.note" value="${esc(c.note)}" placeholder="Diễn giải (tên cây xăng, trạm BOT…)" style="grid-column:1/-1">
      <div class="photo-line" style="grid-column:1/-1">${c.uploading ? '<span class="spin"></span><span class="muted small">Đang tải ảnh…</span>' : c.photo ? `<span data-fview="log" data-fu="${esc(c.photo)}" data-fl="${esc(c.type)}" data-fn="${esc(c.note || '')}" data-fm="image/jpeg" style="cursor:pointer" title="Bấm để xem"><img class="thumb" data-fsrc="${esc(c.photo)}" alt="Chứng từ"></span><button type="button" class="link" data-a="logDelPhoto" data-v="${i}">Xoá ảnh</button>` : `<label class="photo-btn"><input type="file" accept="image/*" data-photo="${i}" hidden>+ Ảnh hoá đơn / chứng từ</label>`}</div>
    </div>`).join('');
  return `<div class="scrim" data-a="logClose"></div><aside class="drawer">
    <div class="dr-h"><b style="font-size:15px">${v.id ? 'Sửa báo cáo ' + esc(v.id) : 'Báo cáo lịch trình &amp; chi phí'}</b><span style="flex:1"></span><button class="btn btn-s btn-sm" data-a="logClose">Đóng</button></div>
    <div class="dr-b">
      <div class="fgrid">
        <label class="fld"><span>Ngày</span><input type="date" data-l="date" value="${esc(v.date)}" max="${today()}" ${v.id ? 'disabled' : ''}></label>
        <label class="fld"><span>Xe sử dụng</span><select data-l="carId">${d.cars.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(v.carId) ? 'selected' : ''}>${esc(c.plate)} · ${esc(c.model)}</option>`).join('')}</select></label>
        <label class="fld"><span>Km đầu ngày</span><input data-l="kmStart" inputmode="numeric" value="${esc(v.kmStart)}"></label>
        <label class="fld"><span>Km cuối ngày</span><input data-l="kmEnd" inputmode="numeric" value="${esc(v.kmEnd)}" placeholder="Số trên đồng hồ khi kết thúc"></label>
      </div>
      ${gap ? `<div class="warn">Km đầu ngày ${gap > 0 ? 'cao hơn' : 'thấp hơn'} ${num(Math.abs(gap))} km so với km cuối báo cáo trước của xe này (${dm(prev.date)}: ${num(prev.kmEnd)}). Nếu đúng, ghi rõ lý do ở phần ghi chú.</div>` : ''}
      <div class="ed-sec"><b class="h3">Lịch trình trong ngày</b>
        ${trips.length ? `<div class="card list">${trips.map(t => `<div class="li"><span class="mono small" style="width:64px">${esc(t.id)}</span><div style="flex:1;min-width:150px"><b>${esc(t.dest)}</b><div class="muted small">Chuyến công tác · ${esc(t.time)} · ${esc(t.name)}</div></div></div>`).join('')}</div><div class="muted small">Chuyến công tác được giao tự đưa vào báo cáo. Thêm các điểm chạy khác (nếu có) bên dưới.</div>` : ''}
        ${stops}
        <button type="button" class="btn btn-s" data-a="logAddStop">+ Thêm điểm chạy</button>
      </div>
      <div class="ed-sec"><b class="h3">Chi phí phát sinh</b>
        ${tc ? `<div class="muted small">Đã khai ${vnd(tc)} khi kết thúc chuyến, không nhập lại các khoản này.</div>` : ''}
        ${costs}
        <button type="button" class="btn btn-s" data-a="logAddCost">+ Thêm khoản chi</button>
      </div>
      <label class="fld"><span>Ghi chú</span><textarea data-l="note" rows="2" placeholder="Không bắt buộc">${esc(v.note)}</textarea></label>
      <div class="card kv" id="logTotals">${totalsHtml(v, tc)}</div>
      <div class="muted small">Chỉ các khoản trả bằng "${CASH}" được tính vào số tiền hoàn ứng.</div>
      ${E.err ? `<div class="warn">${esc(E.err)}</div>` : ''}
      <div class="row-w"><button class="btn btn-p grow" data-a="logSubmit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Đang gửi…' : v.id ? 'Lưu và gửi lại' : 'Gửi báo cáo'}</button><button class="btn btn-s" data-a="logClose">Huỷ</button></div>
    </div></aside>`;
}

function compressImg(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q).split(',')[1]); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Không đọc được ảnh.')); };
    img.src = url;
  });
}
async function uploadPhoto(k, file) {
  const E = S.logEdit, row = () => E.vals.costs.find(c => c.k === k);
  if (!row()) return;
  row().uploading = true; render();
  try {
    const b64 = await compressImg(file, API_URL ? 1400 : 520, API_URL ? 0.72 : 0.6);
    const r = await call('file.upload', { name: E.vals.date + '_' + S.data.me.username + '_' + k + '.jpg', mime: 'image/jpeg', data: b64 });
    if (row()) row().photo = r.url;
  } catch (e) { toast(e.message, true); }
  if (row()) row().uploading = false;
  render();
}

function logCsv() {
  const list = visibleLogs(), q = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const head = ['Mã báo cáo', 'Ngày', 'Lái xe', 'Biển số', 'Km đầu', 'Km cuối', 'Số km', 'Lịch trình', 'Chi phí theo chuyến', 'Chi phí phát sinh', 'Tổng chi phí', 'Đề nghị hoàn ứng', 'Trạng thái', 'Người duyệt', 'Người thanh toán', 'Số phiếu chi'];
  const lines = [head.map(q).join(',')].concat(list.map(l => [l.id, dmy(l.date), l.drvName, l.plate, N(l.kmStart), N(l.kmEnd), N(l.km), l.routeText, N(l.tripCost), N(l.extraCost), N(l.total), N(l.reimburse), LOG_ST[l.status][0], l.approvedBy, l.paidBy, l.payRef].map(q).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bao-cao-lai-xe-' + (S.logFilter || defaultLogFilter()) + '-' + today() + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const LOG_ACTIONS = {
  logNew: v => {
    const date = v || today(), u = S.data.me, ex = (S.data.logs || []).find(l => String(l.drvId) === String(u.driverId) && l.date === date);
    if (ex) return LOG_ACTIONS.logOpen(ex.id);
    S.sel = null; S.logSel = null; S.notifOpen = false; S.logEdit = { vals: logDefaults(date), auto: true };
  },
  logOpen: v => { if (!logOf(v)) return; S.logSel = v; S.logAct = {}; S.logEdit = null; S.sel = null; S.notifOpen = false; },
  logCloseSel: () => { S.logSel = null; S.logAct = {}; },
  logEdit: () => {
    const l = logOf(S.logSel); if (!l) return;
    S.logEdit = { auto: false, vals: { id: l.id, date: l.date, carId: l.carId, kmStart: String(N(l.kmStart)), kmEnd: String(N(l.kmEnd)), note: l.note || '', route: (l.route || []).map(r => Object.assign({}, r)),
      costs: costsOf(l.id).map(c => ({ k: uid(), type: c.type, amount: String(N(c.amount)), method: c.method, invoice: String(c.invoice) === 'true', note: c.note || '', photo: c.photo || '' })) } };
    S.logSel = null;
  },
  logClose: () => { S.logEdit = null; },
  logAddStop: () => { S.logEdit.vals.route.push({ time: '', from: '', to: '', purpose: '' }); },
  logDelStop: i => { S.logEdit.vals.route.splice(+i, 1); },
  logAddCost: () => { S.logEdit.vals.costs.push({ k: uid(), type: COST_TYPES[0], amount: '', method: CASH, invoice: false, note: '', photo: '' }); },
  logDelCost: i => { S.logEdit.vals.costs.splice(+i, 1); },
  logDelPhoto: i => { S.logEdit.vals.costs[+i].photo = ''; },
  logSubmit: () => {
    const E = S.logEdit; E.err = '';
    if (E.vals.costs.some(c => c.uploading)) { E.err = 'Ảnh đang tải lên, vui lòng đợi.'; return; }
    const p = Object.assign({}, E.vals, { costs: E.vals.costs.map(c => ({ type: c.type, amount: c.amount, method: c.method, invoice: !!c.invoice, note: c.note, photo: c.photo })) });
    return mutate('log.save', p, E.vals.id ? 'Đã gửi lại báo cáo' : 'Đã gửi báo cáo ngày ' + dm(E.vals.date), () => { S.logEdit = null; if (S.data.me.role === 'driver') S.tab = 'daily'; });
  },
  logApprove: () => mutate('log.review', { id: S.logSel, decision: 'approve' }, 'Đã duyệt báo cáo', () => { S.logAct = {}; }),
  logRetShow: () => { S.logAct = { ret: true }; },
  logRetHide: () => { S.logAct = {}; },
  logReturn: () => { if (!(S.logAct.reason || '').trim()) { S.logAct.err = 'Nhập lý do trả lại.'; return; } return mutate('log.review', { id: S.logSel, decision: 'return', note: S.logAct.reason }, 'Đã trả lại cho lái xe', () => { S.logAct = {}; }); },
  logPay: () => mutate('log.pay', { ids: [S.logSel], payRef: S.logAct.payRef || '' }, 'Đã ghi nhận thanh toán', () => { S.logAct = {}; }),
  payBatch: () => {
    const ids = visibleLogs().map(l => l.id); if (!ids.length) return;
    const ref = (document.getElementById('batchRef') || {}).value || '';
    if (!confirm('Xác nhận đã thanh toán ' + ids.length + ' báo cáo?')) return;
    return mutate('log.pay', { ids, payRef: ref }, 'Đã ghi nhận thanh toán ' + ids.length + ' báo cáo');
  },
  logFilter: v => { S.logFilter = v; },
  logCsv: () => logCsv()
};

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.la) { S.logAct[t.dataset.la] = t.value; return; }
  const E = S.logEdit; if (!E) return;
  if (t.dataset.l) { E.vals[t.dataset.l] = t.value; if (t.dataset.l === 'kmStart' || t.dataset.l === 'kmEnd') E.auto = false; }
  else if (t.dataset.lr) { const [i, k] = t.dataset.lr.split('.'); E.vals.route[i][k] = t.value; }
  else if (t.dataset.lc) { const [i, k] = t.dataset.lc.split('.'); E.vals.costs[i][k] = t.type === 'checkbox' ? t.checked : t.value; }
  else return;
  const box = document.getElementById('logTotals');
  if (box) box.innerHTML = totalsHtml(E.vals, dayTripCost(dayTrips(S.data.me.driverId, E.vals.date), E.vals.date));
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'logDrvSel') { S.logDrv = t.value; render(); return; }
  const E = S.logEdit; if (!E) return;
  if (t.dataset.photo !== undefined && t.files && t.files[0]) { const c = E.vals.costs[+t.dataset.photo]; if (c) uploadPhoto(c.k, t.files[0]); return; }
  if (t.dataset.l === 'date' && isDate(t.value)) {
    const ex = (S.data.logs || []).find(l => String(l.drvId) === String(S.data.me.driverId) && l.date === t.value);
    if (ex) { S.logEdit = null; LOG_ACTIONS.logOpen(ex.id); toast('Ngày ' + dm(t.value) + ' đã có báo cáo'); return; }
    const df = logDefaults(t.value), keepRoute = E.vals.route.some(r => r.from || r.to || r.purpose);
    E.vals = Object.assign(df, E.auto ? {} : { kmStart: E.vals.kmStart, kmEnd: E.vals.kmEnd }, { costs: E.vals.costs, note: E.vals.note, route: keepRoute ? E.vals.route : df.route });
    render();
  }
  if (t.dataset.l === 'carId') { if (E.auto) { const df = logDefaults(E.vals.date, t.value); E.vals.kmStart = df.kmStart; E.vals.kmEnd = df.kmEnd; } render(); }
});

/* ------------------------------------------------------------ in chứng từ thanh toán */
function docSo(n) {
  n = Math.round(+n || 0); if (!n) return 'Không đồng';
  const cs = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'], un = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ'];
  const ba = (x, full) => {
    const t = Math.floor(x / 100), c = Math.floor(x % 100 / 10), d = x % 10; let s = '';
    if (full || t) s += cs[t] + ' trăm';
    if (c === 0) { if (d && (full || t)) s += ' linh'; } else if (c === 1) s += ' mười'; else s += ' ' + cs[c] + ' mươi';
    if (d) s += d === 1 && c > 1 ? ' mốt' : d === 5 && c > 0 ? ' lăm' : ' ' + cs[d];
    return s.trim();
  };
  const g = []; for (let x = n; x > 0; x = Math.floor(x / 1000)) g.push(x % 1000);
  const parts = []; for (let i = g.length - 1; i >= 0; i--) if (g[i]) parts.push(ba(g[i], i < g.length - 1) + un[i]);
  const s = parts.join(' ') + ' đồng'; return s[0].toUpperCase() + s.slice(1);
}
function voucherLines(l) {
  const rows = []; let tsum = 0;
  String(l.tripIds || '').split(',').filter(Boolean).forEach(id => {
    const t = S.data.trips.find(x => x.id === id); if (!t || t.status !== 'done' || t.end !== l.date) return;
    [['Nhiên liệu', t.fuel], ['Cầu đường / BOT', t.toll], ['Gửi xe', t.park], ['Chi phí khác', t.other]].forEach(([k, v]) => { if (N(v)) { rows.push({ type: k, note: 'Chuyến ' + t.id + ' – ' + t.dest, method: CASH, invoice: '', amount: N(v), reimb: N(v) }); tsum += N(v); } });
  });
  if (N(l.tripCost) > tsum) rows.push({ type: 'Chi phí theo chuyến', note: l.tripIds, method: CASH, invoice: '', amount: N(l.tripCost) - tsum, reimb: N(l.tripCost) - tsum });
  costsOf(l.id).forEach(c => rows.push({ type: c.type, note: c.note || '', method: c.method, invoice: String(c.invoice) === 'true' ? 'Có' : 'Không', amount: N(c.amount), reimb: c.method === CASH ? N(c.amount) : 0, photo: c.photo }));
  return rows;
}
const absUrl = u => new URL(u, location.href).href;
const ngay = t => { const x = t ? new Date(Number(t)) : null; return x ? 'Ngày ' + pad(x.getDate()) + ' tháng ' + pad(x.getMonth() + 1) + ' năm ' + x.getFullYear() : 'Ngày ...... tháng ...... năm ........'; };
const DOTS = '<span class="dots"></span>';
function vHead(form) {
  const C = window.COMPANY || {};
  return `<div class="hd"><div class="co"><img src="${absUrl('logo.png')}" alt=""><div><b>${esc(C.name || '')}</b><div>Địa chỉ: ${C.address ? esc(C.address) : DOTS}</div><div>Mã số thuế: ${C.taxCode ? esc(C.taxCode) : DOTS}</div></div></div>
    <div class="form"><b>${form}</b><div class="i">(Ban hành theo Thông tư số ${esc(C.circular || '200/2014/TT-BTC')} của Bộ Tài chính)</div></div></div>`;
}
function docDeNghi(l) {
  const C = window.COMPANY || {}, rows = voucherLines(l), attach = rows.filter(r => r.invoice === 'Có' || r.photo).length, total = rows.reduce((s, r) => s + r.reimb, 0) || N(l.reimburse);
  const photos = rows.filter(r => r.photo);
  return `<section class="page">${vHead('Mẫu số 05 - TT')}
    <h1>GIẤY ĐỀ NGHỊ THANH TOÁN</h1><div class="c i">${ngay(l.submittedAt)}</div><div class="c">Số: ${esc(l.id)}</div>
    <p style="margin-top:16px">Kính gửi: Ban Giám đốc ${esc(C.short || C.name || '')}</p>
    <p>Họ và tên người đề nghị thanh toán: <b>${esc(l.drvName)}</b></p>
    <p>Bộ phận: Đội xe – Lái xe</p>
    <p>Nội dung thanh toán: Hoàn ứng chi phí vận hành xe công tác ngày ${dmy(l.date)}, xe <b>${esc(l.plate)}</b> (km ${num(l.kmStart)} – ${num(l.kmEnd)}, quãng đường ${num(l.km)} km).</p>
    <p>Lịch trình: ${esc(l.routeText || '')}</p>
    <table><thead><tr><th style="width:34px">STT</th><th>Khoản chi</th><th>Diễn giải</th><th>Hình thức</th><th style="width:58px">Hoá đơn</th><th style="width:92px">Số tiền (đ)</th><th style="width:92px">Đề nghị TT (đ)</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${esc(r.type)}</td><td>${esc(r.note)}</td><td>${esc(r.method)}</td><td class="c">${r.invoice}</td><td class="n">${num(r.amount)}</td><td class="n">${r.reimb ? num(r.reimb) : '–'}</td></tr>`).join('') || '<tr><td colspan="7" class="c">Không phát sinh chi phí</td></tr>'}
    <tr><td colspan="5" class="c"><b>Cộng</b></td><td class="n"><b>${num(rows.reduce((s, r) => s + r.amount, 0))}</b></td><td class="n"><b>${num(total)}</b></td></tr></tbody></table>
    <p>Số tiền đề nghị thanh toán: <b>${num(total)} đồng</b></p>
    <p>Viết bằng chữ: <i>${docSo(total)}.</i></p>
    <p>Kèm theo: ${attach || DOTS} chứng từ gốc.</p>
    <p class="small">Xác nhận trên hệ thống: ${l.approvedBy ? 'Điều phối ' + esc(l.approvedBy) + ' duyệt lúc ' + fmtTs(l.approvedAt) : 'chưa duyệt'}${l.paidAt ? '; ' + esc(l.paidBy) + ' thanh toán lúc ' + fmtTs(l.paidAt) + (l.payRef ? ', phiếu chi ' + esc(l.payRef) : '') : ''}.</p>
    <div class="sig s4"><div>Người đề nghị thanh toán<small>(Ký, họ tên)</small><div class="nm">${esc(l.drvName)}</div></div><div>Điều phối xác nhận<small>(Ký, họ tên)</small><div class="nm">${esc(l.approvedBy || '')}</div></div><div>Kế toán trưởng<small>(Ký, họ tên)</small><div class="nm"></div></div><div>Giám đốc duyệt<small>(Ký, họ tên)</small><div class="nm"></div></div></div>
  </section>${photos.length ? `<section class="page"><h2>PHỤ LỤC CHỨNG TỪ KÈM THEO</h2><div class="c">Giấy đề nghị thanh toán số ${esc(l.id)} – ${esc(l.drvName)} – ngày ${dmy(l.date)}</div>
    <div class="ph">${photos.map((r, i) => `${attFigs(r.photo, (i + 1) + '. ' + r.type + ' – ' + num(r.amount) + ' đ' + (r.note ? ' – ' + r.note : ''))}`).join('')}</div></section>` : ''}`;
}
function docPhieuChi(l) {
  const total = N(l.reimburse), attach = voucherLines(l).filter(r => r.invoice === 'Có' || r.photo).length;
  return `<section class="page">${vHead('Mẫu số 02 - TT')}
    <div class="pc-top"><div></div><div class="c"><h1 style="margin:18px 0 4px">PHIẾU CHI</h1><div class="i">${ngay(l.paidAt)}</div></div><div class="pc-no"><div>Quyển số: ${DOTS}</div><div>Số: ${l.payRef ? esc(l.payRef) : DOTS}</div><div>Nợ: ${DOTS}</div><div>Có: ${DOTS}</div></div></div>
    <p style="margin-top:16px">Họ và tên người nhận tiền: <b>${esc(l.drvName)}</b></p>
    <p>Địa chỉ: Đội xe – Lái xe</p>
    <p>Lý do chi: Hoàn ứng chi phí xe công tác ngày ${dmy(l.date)}, xe ${esc(l.plate)}, theo giấy đề nghị thanh toán số ${esc(l.id)}.</p>
    <p>Số tiền: <b>${num(total)} đồng</b></p>
    <p>Viết bằng chữ: <i>${docSo(total)}.</i></p>
    <p>Kèm theo: ${attach || DOTS} chứng từ gốc.</p>
    <div class="r i" style="margin-top:14px">${ngay(l.paidAt)}</div>
    <div class="sig s5"><div>Giám đốc<small>(Ký, họ tên, đóng dấu)</small><div class="nm"></div></div><div>Kế toán trưởng<small>(Ký, họ tên)</small><div class="nm"></div></div><div>Người lập phiếu<small>(Ký, họ tên)</small><div class="nm">${esc(l.paidBy || '')}</div></div><div>Người nhận tiền<small>(Ký, họ tên)</small><div class="nm">${esc(l.drvName)}</div></div><div>Thủ quỹ<small>(Ký, họ tên)</small><div class="nm"></div></div></div>
    <p style="margin-top:18px">Đã nhận đủ số tiền (viết bằng chữ): ${DOTS}${DOTS}</p>
  </section>`;
}
const PRINT_CSS = `@page{size:A4;margin:14mm 14mm 14mm 18mm}
body{font-family:'Times New Roman',Times,serif;font-size:13pt;color:#000;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}
.hd{display:flex;justify-content:space-between;gap:16px;font-size:11pt;line-height:1.4}
.co{display:flex;gap:10px;align-items:flex-start}.co img{width:54px;height:54px;object-fit:contain;flex:none}
.form{text-align:center;font-size:10.5pt;max-width:250px}
h1{text-align:center;font-size:17pt;margin:22px 0 4px;letter-spacing:.02em}h2{text-align:center;font-size:14pt;margin:4px 0}
.c{text-align:center}.r{text-align:right}.i{font-style:italic}.small{font-size:10.5pt}
p{margin:6px 0;line-height:1.45}
table{width:100%;border-collapse:collapse;font-size:11pt;margin:10px 0}th,td{border:1px solid #000;padding:4px 6px;vertical-align:top}th{text-align:center}td.n{text-align:right;white-space:nowrap}
.sig{display:grid;text-align:center;margin-top:18px;font-size:11.5pt;font-weight:bold;break-inside:avoid}.s4{grid-template-columns:repeat(4,1fr)}.s5{grid-template-columns:repeat(5,1fr)}
.sig small{display:block;font-style:italic;font-weight:normal;font-size:10pt}.sig .nm{margin-top:72px}
.dots{display:inline-block;min-width:150px;border-bottom:1px dotted #000;height:1em;vertical-align:baseline}
.pc-top{display:grid;grid-template-columns:1fr auto 1fr;align-items:start}.pc-no{justify-self:end;font-size:11.5pt;line-height:1.7;margin-top:18px}.pc-no .dots{min-width:90px}
.ph{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.ph figure{margin:0;break-inside:avoid;border:1px solid #999;padding:6px}.ph img{width:100%;max-height:105mm;object-fit:contain;display:block}.ph figcaption{font-size:10.5pt;margin-top:4px}`;
function printDocs(ids, kind) {
  const logs = ids.map(logOf).filter(Boolean).filter(l => kind !== 'chi' || l.status === 'paid'); if (!logs.length) return toast('Không có chứng từ để in.', true);
  const body = logs.map(l => kind === 'chi' ? docPhieuChi(l) : docDeNghi(l)).join('');
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + (kind === 'chi' ? 'Phieu chi' : 'Giay de nghi thanh toan') + ' ' + logs.map(l => l.id).join('_').slice(0, 60) + '</title><style>' + PRINT_CSS + '</style></head><body>' + body + '</body></html>';
  let w = null, frame = null;
  try { w = window.open('', '_blank'); } catch (e) { }
  if (!w) { frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(frame); w = frame.contentWindow; }
  const doc = w.document; doc.open(); doc.write(html); doc.close();
  let fired = false;
  const go = () => { if (fired) return; fired = true; w.focus(); w.print(); if (frame) setTimeout(() => frame.remove(), 60000); };
  const pending = [...doc.images].filter(i => !i.complete);
  if (!pending.length) setTimeout(go, 300);
  else { let left = pending.length; pending.forEach(i => i.onload = i.onerror = () => { if (--left <= 0) setTimeout(go, 200); }); setTimeout(go, 8000); }
}
Object.assign(LOG_ACTIONS, {
  printDn: () => printDocs([S.logSel], 'dn'),
  printChi: () => printDocs([S.logSel], 'chi'),
  printDnAll: () => printDocs(visibleLogs().slice(0, 50).map(l => l.id), 'dn'),
  printChiAll: () => printDocs(visibleLogs().slice(0, 50).map(l => l.id), 'chi')
});
