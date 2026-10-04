/* Đề xuất & thanh toán bảo dưỡng, sửa chữa, đăng kiểm, bảo hiểm */
const MR_ST = {
  proposed: ['Chờ duyệt đề xuất', '#7A5410', '#F5ECD7'], rejected: ['Không duyệt', '#8C1A1D', '#F6E1E1'], approved: ['Đã duyệt · chờ chứng từ', '#1F4E79', '#E1ECF6'],
  reported: ['Chờ xác nhận chi phí', '#7A5410', '#F5ECD7'], confirmed: ['Chờ thanh toán', '#1F4E79', '#E1ECF6'], paid: ['Đã thanh toán', '#245B3A', '#E0EFE5']
};
const MTYPES = ['Bảo dưỡng định kỳ', 'Sửa chữa', 'Thay lốp, ắc quy', 'Đăng kiểm', 'Bảo hiểm', 'Phí đường bộ, đăng ký xe', 'Khác'];
const FILE_LABELS = ['Hoá đơn', 'Báo giá', 'Ảnh hiện trạng', 'Biên bản nghiệm thu', 'Giấy đăng kiểm / bảo hiểm', 'Khác'];
const reqOf = id => (S.data.mreqs || []).find(r => String(r.id) === String(id));
const mrTag = s => tag(MR_ST[s][0], MR_ST[s][1], MR_ST[s][2]);
const isImg = f => (f.mime || '').startsWith('image/') || /^data:image/.test(f.url || '');
const sumL = arr => (arr || []).reduce((s, x) => s + N(x.amount), 0);
const nextDueDefault = (type, km) => type === 'Bảo dưỡng định kỳ' ? String(N(km) + 5000) : (type === 'Đăng kiểm' || type === 'Bảo hiểm') ? addD(today(), 365) : '';
const defaultReqFilter = () => ({ ketoan: 'confirmed', bgd: 'proposed' })[S.data.me.role] || 'proposed';
const canDisp = () => ['dispatch', 'admin'].includes(S.data.me.role);

function reqBadges(role, badges) {
  const R = S.data.mreqs || [];
  if (role === 'driver') badges.mreq = R.filter(r => r.status === 'approved').length;
  if (role === 'ketoan') badges.mreq = R.filter(r => r.status === 'confirmed').length;
  if (role === 'dispatch' || role === 'admin') badges.maint = (badges.maint || 0) + R.filter(r => r.status === 'proposed' || r.status === 'reported').length;
}
function fileChip(f, i, rm, g) {
  return `<div class="fchip" data-fview="${g || 'f'}" data-fu="${esc(f.url)}" data-fl="${esc(f.label || 'Chứng từ')}" data-fn="${esc(f.name || '')}" data-fm="${esc(f.mime || '')}" title="Bấm để xem">${isImg(f) ? `<img class="thumb" data-fsrc="${esc(f.url)}" alt="">` : '<span class="fdoc">PDF</span>'}
    <div class="small" style="min-width:0"><b>${esc(f.label || 'Chứng từ')}</b><div class="muted ell" style="max-width:150px">${esc(f.name || '')}</div>${rm ? `<button type="button" class="link" data-a="reqDelFile" data-v="${i}">Xoá</button>` : '<span class="link" style="font-size:12px">Xem</span>'}</div></div>`;
}
function reqCard(r) {
  const dt = r.doneDate || r.planDate || iso(new Date(Number(r.createdAt) || Date.now())), sd = parse(dt);
  return `<div class="trip" data-a="reqOpen" data-v="${esc(r.id)}">
    <div class="trip-d"><small>${WD[sd.getDay()]}</small><b>${pad(sd.getDate())}</b><small>Th${sd.getMonth() + 1}</small></div>
    <div class="trip-b">
      <div class="row-w"><span class="mono muted small">${esc(r.id)}</span>${mrTag(r.status)}${String(r.urgent) === 'true' ? tag('Khẩn cấp', '#FFFFFF', '#A31E22') : ''}</div>
      <div class="trip-t">${esc(r.type)} · <span class="mono">${esc(r.plate)}</span></div>
      <div class="muted small ell">${esc(r.actualText || r.itemsText || r.reason)}</div>
      <div class="row-w muted small"><span>${esc(r.createdName)}</span>${N(r.estimate) ? `<span>Dự toán ${vnd(N(r.estimate))}</span>` : ''}${N(r.actualTotal) ? `<span style="color:#221C18;font-weight:600">Thực tế ${vnd(N(r.actualTotal))}</span>` : ''}</div>
    </div><div class="chev">›</div></div>`;
}
function visibleReqs() {
  const f = S.reqFilter || defaultReqFilter();
  return (S.data.mreqs || []).filter(r => r.status === f).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
}
function vReqs() {
  const d = S.data, role = d.me.role, R = d.mreqs || [], canCreate = ['driver', 'dispatch', 'admin'].includes(role);
  const head = `<div class="row-b"><div><b class="h2">${role === 'ketoan' ? 'Thanh toán bảo dưỡng, sửa chữa' : 'Đề xuất bảo dưỡng, sửa chữa, đăng kiểm'}</b><div class="muted small">Đề xuất → Điều phối duyệt → làm xong nộp chứng từ → Điều phối xác nhận → Kế toán thanh toán.</div></div>
    ${canCreate ? `<div class="row-w"><button class="btn btn-s" data-a="reqNew" data-v="urgent">Sửa khẩn cấp (đã làm)</button><button class="btn btn-p" data-a="reqNew" data-v="">+ Đề xuất</button></div>` : ''}</div>`;
  if (role === 'driver') {
    const used = new Set(d.trips.filter(t => String(t.drvId) === String(d.me.driverId)).map(t => String(t.carId)).concat((d.logs || []).filter(l => String(l.drvId) === String(d.me.driverId)).map(l => String(l.carId))));
    const dues = [];
    d.cars.filter(c => !used.size || used.has(String(c.id))).forEach(c => [['Đăng kiểm', dateCell(c.dk)], ['Bảo dưỡng định kỳ', kmCell(c)], ['Bảo hiểm', dateCell(c.bh)]].forEach(([t, x]) => {
      if (x.lvl >= 1 && !R.some(r => String(r.carId) === String(c.id) && r.type === t && !['paid', 'rejected'].includes(r.status))) dues.push({ c, t, x });
    }));
    const grp = (title, list, empty) => `<section class="grp"><div class="grp-h"><b>${title}</b><span>${list.length || ''}</span></div>${list.length ? `<div class="trip-grid">${list.map(reqCard).join('')}</div>` : `<div class="empty">${empty}</div>`}</section>`;
    const by = s => R.filter(r => s.includes(r.status)).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    return head + (dues.length ? `<div class="alert" style="display:flex;flex-direction:column;gap:8px"><b>Xe sắp đến hạn</b>${dues.map(x => `<div class="row-w"><span style="flex:1;min-width:200px"><span class="mono">${esc(x.c.plate)}</span> · ${esc(x.t)}: ${esc(x.x.tag)}</span><button class="btn btn-s btn-sm" data-a="reqNew" data-v="due:${esc(x.c.id)}:${esc(x.t)}">Lập đề xuất</button></div>`).join('')}</div>` : '')
      + grp('Đã duyệt, cần nộp chứng từ', by(['approved']), 'Không có việc cần nộp chứng từ.')
      + grp('Đang chờ xử lý', by(['proposed', 'reported', 'confirmed']), 'Không có đề xuất nào đang chờ.')
      + grp('Đã xong', by(['paid', 'rejected']).slice(0, 30), 'Chưa có.');
  }
  const F = [['proposed', 'Chờ duyệt đề xuất'], ['approved', 'Chờ chứng từ'], ['reported', 'Chờ xác nhận chi phí'], ['confirmed', 'Chờ thanh toán'], ['paid', 'Đã thanh toán'], ['rejected', 'Không duyệt']];
  const f = S.reqFilter || defaultReqFilter(), list = visibleReqs(), cnt = k => R.filter(r => r.status === k).length, sum = list.reduce((s, r) => s + N(r.actualTotal), 0);
  const canPay = ['ketoan', 'admin'].includes(role) && f === 'confirmed' && list.length;
  const printBtns = `${['reported', 'confirmed', 'paid'].includes(f) && list.length ? `<button class="btn btn-s btn-sm" data-a="printReqDnAll">In giấy đề nghị (${Math.min(list.length, 50)})</button>` : ''}${f === 'paid' && list.some(r => r.payee !== 'vendor') ? `<button class="btn btn-s btn-sm" data-a="printReqChiAll">In phiếu chi</button>` : ''}${['proposed', 'approved'].includes(f) && list.length ? `<button class="btn btn-s btn-sm" data-a="printReqDxAll">In phiếu đề xuất (${Math.min(list.length, 50)})</button>` : ''}`;
  return head + `<div class="chips">${F.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="reqFilter" data-v="${k}">${l} · ${cnt(k)}</button>`).join('')}</div>
    ${printBtns ? `<div class="row-w">${printBtns}</div>` : ''}
    ${canPay ? `<div class="card panel"><b class="h3">Thanh toán hàng loạt</b><div class="muted small">${list.length} đề xuất, tổng ${vnd(sum)}.</div><div class="row-w"><input id="reqBatchRef" class="sel-in" placeholder="Số phiếu chi / UNC (không bắt buộc)" style="flex:1;min-width:180px"><button class="btn btn-p" data-a="reqPayBatch" ${S.busy ? 'disabled' : ''}>Xác nhận đã thanh toán</button></div></div>` : ''}
    ${list.length ? `<div class="trip-grid">${list.slice(0, 80).map(reqCard).join('')}</div>` : '<div class="empty">Không có đề xuất nào.</div>'}`;
}

function vReqDrawer() {
  const d = S.data, u = d.me, r = reqOf(S.reqSel); if (!r) return '';
  const RA = S.reqAct || {}, dis = S.busy ? 'disabled' : '', car = carById(r.carId), own = String(r.createdBy) === String(u.id);
  const idx = { proposed: 0, approved: 1, reported: 2, confirmed: 3, paid: 4 }[r.status];
  const err = RA.err ? `<div class="warn">${esc(RA.err)}</div>` : '';
  const reasonBox = (title, a, ph) => `<div class="card panel"><b class="h3">${title}</b>${err}<label class="fld"><span>Lý do</span><textarea data-rq="reason" rows="2" placeholder="${ph}">${esc(RA.reason || '')}</textarea></label><div class="row-w"><button class="btn btn-d grow" data-a="${a}" ${dis}>Xác nhận</button><button class="btn btn-s" data-a="reqActReset">Quay lại</button></div></div>`;
  let act = '';
  if ((own || canDisp()) && (r.status === 'proposed' || r.status === 'rejected')) act = `<div class="card panel"><button class="btn btn-s btn-lg" data-a="reqEditProp">${r.status === 'rejected' ? 'Sửa và gửi lại đề xuất' : 'Sửa đề xuất'}</button></div>`;
  if ((own || canDisp()) && r.status === 'approved') act = `<div class="card panel"><b class="h3">Đã làm xong?</b><div class="muted small">Nhập chi phí thực tế và đính kèm hoá đơn, biên bản để Điều phối xác nhận.</div><button class="btn btn-p btn-lg" data-a="reqReport">Nhập chi phí &amp; chứng từ</button></div>`;
  if (canDisp() && r.status === 'proposed') act = RA.mode === 'reject' ? reasonBox('Không duyệt đề xuất', 'reqReject', 'VD: Chưa đến mốc bảo dưỡng') : `<div class="card panel"><b class="h3">Duyệt đề xuất</b>${err}<div class="row-w"><button class="btn btn-p grow" data-a="reqApprove" ${dis}>${S.busy ? 'Đang lưu…' : 'Duyệt đề xuất'}</button><button class="btn btn-s" data-a="reqRejShow">Không duyệt</button></div></div>`;
  if (canDisp() && r.status === 'reported') act = RA.mode === 'return' ? reasonBox('Trả lại chứng từ', 'reqReturn', 'VD: Thiếu hoá đơn VAT thay dầu') : `<div class="card panel"><b class="h3">Xác nhận chi phí ${vnd(N(r.actualTotal))}</b><div class="muted small">Sau khi xác nhận, lịch sử bảo dưỡng và hạn của xe được cập nhật, Kế toán nhận yêu cầu thanh toán.</div>${err}<div class="row-w"><button class="btn btn-p grow" data-a="reqConfirm" ${dis}>${S.busy ? 'Đang lưu…' : 'Xác nhận, chuyển Kế toán'}</button><button class="btn btn-s" data-a="reqRetShow">Trả lại</button></div></div>`;
  if (['ketoan', 'admin'].includes(u.role) && r.status === 'confirmed') act = `<div class="card panel"><b class="h3">Thanh toán ${vnd(N(r.actualTotal))}</b><div class="muted small">${r.payee === 'vendor' ? 'Chuyển khoản cho ' + esc(r.vendor) + (r.vendorBank ? ' · ' + esc(r.vendorBank) : '') : 'Hoàn ứng cho ' + esc(r.createdName)}</div>${err}<label class="fld"><span>Số phiếu chi / UNC</span><input data-rq="payRef" value="${esc(RA.payRef || '')}" placeholder="VD: PC-0125 hoặc UNC-031"></label><button class="btn btn-p btn-lg" data-a="reqPay" ${dis}>${S.busy ? 'Đang lưu…' : 'Xác nhận đã thanh toán'}</button></div>`;
  const tbl = (title, rows, inv) => `<div class="ed-sec"><b class="h3">${title}</b><div class="card list">${rows.map(x => `<div class="li"><div style="flex:1;min-width:150px">${esc(x.name || '—')}${inv && String(x.invoice) === 'true' ? ' <span class="muted small">· có HĐ</span>' : ''}</div><b>${vnd(N(x.amount))}</b></div>`).join('')}<div class="li"><b style="flex:1">Cộng</b><b style="color:#A31E22">${vnd(sumL(rows))}</b></div></div></div>`;
  const prints = `<div class="row-w"><button class="btn btn-s" data-a="printReqDx">In phiếu đề xuất</button>${['reported', 'confirmed', 'paid'].includes(r.status) ? '<button class="btn btn-s" data-a="printReqDn">In giấy đề nghị thanh toán</button>' : ''}${r.status === 'paid' && r.payee !== 'vendor' ? '<button class="btn btn-s" data-a="printReqChi">In phiếu chi</button>' : ''}</div>`;
  return `<div class="scrim" data-a="reqCloseSel"></div><aside class="drawer">
    <div class="dr-h"><span class="mono" style="font-weight:600">${esc(r.id)}</span>${mrTag(r.status)}${String(r.urgent) === 'true' ? tag('Khẩn cấp', '#FFFFFF', '#A31E22') : ''}<span style="flex:1"></span><button class="btn btn-s btn-sm" data-a="reqCloseSel">Đóng</button></div>
    <div class="dr-b">
      <div><div class="dr-t">${esc(r.type)} · <span class="mono">${esc(r.plate)}</span></div><div class="muted" style="margin-top:4px">${esc(r.createdName)}${car ? ' · ' + esc(car.model) : ''}</div></div>
      ${idx !== undefined ? `<div class="steps">${['Đề xuất', 'Duyệt', 'Nộp chứng từ', 'Xác nhận', 'Thanh toán'].map((s, i) => `<div class="${i <= idx ? 'on' : ''} ${i === idx ? 'cur' : ''}"><i></i><small>${s}</small></div>`).join('')}</div>` : ''}
      ${r.reviewNote ? `<div class="note" style="background:${r.status === 'rejected' || /^Trả lại/.test(r.reviewNote) ? '#F6E1E1;color:#5E1214' : '#E1ECF6;color:#1F4E79'}"><b>Ý kiến Điều phối:</b> ${esc(r.reviewNote)}</div>` : ''}
      <div class="card kv"><div><span>Hiện trạng / lý do</span><b>${esc(r.reason)}</b></div><div><span>Km lúc đề xuất</span><b>${num(r.km)}</b></div>${r.vendor ? `<div><span>Đơn vị thực hiện</span><b>${esc(r.vendor)}</b></div>` : ''}${r.planDate && String(r.urgent) !== 'true' ? `<div><span>Ngày dự kiến</span><b>${dmy(r.planDate)}</b></div>` : ''}</div>
      ${(r.items || []).length ? tbl('Hạng mục &amp; dự toán', r.items, false) : ''}
      ${(r.actual || []).length ? tbl('Chi phí thực tế', r.actual, true) + `<div class="card kv"><div><span>Ngày thực hiện</span><b>${dmy(r.doneDate)}</b></div><div><span>Km lúc thực hiện</span><b>${num(r.doneKm)}</b></div><div><span>Thanh toán</span><b>${r.payee === 'vendor' ? 'Chuyển khoản cho đơn vị' + (r.vendorBank ? ' · ' + esc(r.vendorBank) : '') : 'Hoàn ứng cho ' + esc(r.createdName)}</b></div>${r.nextDue ? `<div><span>Hạn / mốc tiếp theo</span><b>${isDate(r.nextDue) ? dmy(r.nextDue) : num(r.nextDue) + ' km'}</b></div>` : ''}</div>` : ''}
      <div class="ed-sec"><b class="h3">Chứng từ đính kèm · ${(r.files || []).length}</b>${(r.files || []).length ? `<div class="fgrid">${r.files.map((f, i) => fileChip(f, i, false, 'req')).join('')}</div>` : '<div class="muted small">Chưa có chứng từ.</div>'}</div>
      <div class="card kv"><div><span>Tạo lúc</span><b>${fmtTs(r.createdAt)}</b></div>${r.approvedAt ? `<div><span>Duyệt đề xuất</span><b>${esc(r.approvedBy)} · ${fmtTs(r.approvedAt)}</b></div>` : ''}${r.reportedAt ? `<div><span>Nộp chứng từ</span><b>${fmtTs(r.reportedAt)}</b></div>` : ''}${r.confirmedAt ? `<div><span>Xác nhận chi phí</span><b>${esc(r.confirmedBy)} · ${fmtTs(r.confirmedAt)}</b></div>` : ''}${r.paidAt ? `<div><span>Thanh toán</span><b>${esc(r.paidBy)} · ${fmtTs(r.paidAt)}${r.payRef ? ' · ' + esc(r.payRef) : ''}</b></div>` : ''}</div>
      ${prints}
      ${act}
    </div></aside>`;
}

/* ------------------------------------------------------------ nhập đề xuất / chứng từ */
function reqReportFields(src, km) {
  const named = (src.items || []).filter(x => x.name);
  return { doneDate: today(), doneKm: km ? String(km) : '', actual: named.length ? named.map(x => ({ name: x.name, amount: String(N(x.amount) || ''), invoice: true })) : [{ name: '', amount: '', invoice: true }], payee: 'driver', vendorBank: '', nextDue: nextDueDefault(src.type, km) };
}
function reqBlank(urgent, carId, type) {
  const d = S.data, recent = d.trips.filter(t => String(t.drvId) === String(d.me.driverId) && t.carId).sort((a, b) => a.start < b.start ? 1 : -1)[0];
  const cid = carId || (recent && recent.carId) || (d.cars[0] && d.cars[0].id) || '', car = carById(cid);
  const v = { carId: cid, type: type || MTYPES[0], km: car ? String(N(car.odo)) : '', reason: '', vendor: '', planDate: addD(today(), 2), items: [{ name: '', amount: '' }], files: [] };
  if (urgent) { v.items = []; Object.assign(v, reqReportFields(v, car ? N(car.odo) : 0)); }
  return v;
}
function reqTotals(E) {
  const v = E.vals;
  return E.mode === 'propose' ? `<div class="kv-t"><span>Tổng dự toán</span><b>${vnd(sumL(v.items))}</b></div>`
    : `${E.mode === 'report' && N(v.estimate) ? `<div><span>Dự toán đã duyệt</span><b>${vnd(N(v.estimate))}</b></div>` : ''}<div class="kv-t"><span>Tổng chi phí thực tế</span><b>${vnd(sumL(v.actual))}</b></div>`;
}
function vReqEdit() {
  const E = S.reqEdit, v = E.vals, d = S.data, m = E.mode, car = carById(v.carId);
  const F = (k, label, o = {}) => `<label class="fld ${o.full ? 'full' : ''}"><span>${label}</span>${o.area ? `<textarea data-r="${k}" rows="2" placeholder="${esc(o.ph || '')}">${esc(v[k] || '')}</textarea>`
    : o.sel ? `<select data-r="${k}">${o.sel.map(x => { const val = Array.isArray(x) ? x[0] : x, lb = Array.isArray(x) ? x[1] : x; return `<option value="${esc(val)}" ${String(val) === String(v[k]) ? 'selected' : ''}>${esc(lb)}</option>`; }).join('')}</select>`
    : `<input data-r="${k}" type="${o.type || 'text'}" ${o.num ? 'inputmode="numeric"' : ''} value="${esc(v[k] ?? '')}" placeholder="${esc(o.ph || '')}" ${o.max ? `max="${o.max}"` : ''}>`}</label>`;
  const nd = v.type === 'Bảo dưỡng định kỳ' ? F('nextDue', 'Mốc bảo dưỡng tiếp theo (km)', { num: 1 }) : (v.type === 'Đăng kiểm' || v.type === 'Bảo hiểm') ? F('nextDue', 'Hạn ' + v.type.toLowerCase() + ' mới', { type: 'date' }) : '';
  const top = m === 'report'
    ? `<div class="card kv"><div><span>Đề xuất</span><b>${esc(v.id)} · ${esc(v.type)}</b></div><div><span>Xe</span><b class="mono">${esc(car ? car.plate : '')}</b></div></div>`
    : `<div class="fgrid">${F('carId', 'Xe', { sel: d.cars.map(c => [c.id, c.plate + ' · ' + c.model]) })}${F('type', 'Loại công việc', { sel: MTYPES })}${F('km', 'Số km hiện tại', { num: 1 })}${m === 'propose' ? F('planDate', 'Ngày dự kiến thực hiện', { type: 'date' }) : F('doneDate', 'Ngày thực hiện', { type: 'date', max: today() })}${F('vendor', 'Garage / đơn vị thực hiện', { full: 1, ph: 'VD: Toyota Long Biên' })}${F('reason', m === 'urgent' ? 'Sự cố / lý do phải sửa ngay' : 'Hiện trạng / lý do đề xuất', { full: 1, area: 1 })}</div>`;
  const items = m === 'propose' ? `<div class="ed-sec"><b class="h3">Hạng mục &amp; chi phí dự kiến</b>
      ${v.items.map((x, i) => `<div class="ed-row ed-2"><input data-ri="${i}.name" value="${esc(x.name)}" placeholder="Hạng mục (thay dầu, lọc gió…)"><input data-ri="${i}.amount" inputmode="numeric" value="${esc(x.amount)}" placeholder="Dự kiến (đ)"><button type="button" class="x-btn" data-a="reqDelItem" data-v="${i}">×</button></div>`).join('')}
      <button type="button" class="btn btn-s" data-a="reqAddItem">+ Thêm hạng mục</button></div>` : '';
  const rep = m !== 'propose' ? `<div class="ed-sec"><b class="h3">Chi phí thực tế</b>
      <div class="fgrid">${m === 'report' ? F('doneDate', 'Ngày thực hiện', { type: 'date', max: today() }) : ''}${F('doneKm', 'Km lúc thực hiện', { num: 1 })}${m === 'report' ? F('vendor', 'Garage / đơn vị thực hiện', { full: 1 }) : ''}</div>
      ${v.actual.map((x, i) => `<div class="ed-row ed-3"><input data-rx="${i}.name" value="${esc(x.name)}" placeholder="Hạng mục"><input data-rx="${i}.amount" inputmode="numeric" value="${esc(x.amount)}" placeholder="Số tiền (đ)"><label class="chk"><input type="checkbox" data-rx="${i}.invoice" ${x.invoice ? 'checked' : ''}>HĐ</label><button type="button" class="x-btn" data-a="reqDelAct" data-v="${i}">×</button></div>`).join('')}
      <button type="button" class="btn btn-s" data-a="reqAddAct">+ Thêm khoản chi</button>
      <div class="fgrid">${F('payee', 'Hình thức thanh toán', { full: 1, sel: [['driver', 'Lái xe đã trả, đề nghị hoàn ứng'], ['vendor', 'Công ty chuyển khoản cho đơn vị sửa chữa']] })}${v.payee === 'vendor' ? F('vendorBank', 'Số tài khoản, ngân hàng của đơn vị', { full: 1, ph: 'VD: 0123456789 – Vietcombank – Cty TNHH ABC' }) : ''}${nd}</div></div>` : '';
  const files = `<div class="ed-sec"><b class="h3">Chứng từ đính kèm</b><div class="muted small">${m === 'propose' ? 'Ảnh hiện trạng, báo giá của garage (nếu có).' : 'Bắt buộc ít nhất 1 chứng từ: hoá đơn, biên bản nghiệm thu, giấy đăng kiểm…'}</div>
      ${v.files.length ? `<div class="fgrid">${v.files.map((f, i) => fileChip(f, i, true, 'edit')).join('')}</div>` : ''}
      ${E.uploading ? '<div class="row"><span class="spin"></span><span class="muted small">Đang tải lên…</span></div>' : ''}
      <div class="row-w"><select data-rlabel="1" class="sel-in">${FILE_LABELS.map(x => `<option ${x === E.fileLabel ? 'selected' : ''}>${x}</option>`).join('')}</select><label class="photo-btn"><input type="file" accept="image/*,application/pdf" multiple data-rfile="1" hidden>+ Thêm ảnh / PDF</label></div></div>`;
  const title = m === 'propose' ? (v.id ? 'Sửa đề xuất ' + esc(v.id) : 'Đề xuất bảo dưỡng, sửa chữa') : m === 'urgent' ? 'Sửa chữa khẩn cấp (đã làm)' : 'Nộp chi phí &amp; chứng từ';
  return `<div class="scrim" data-a="reqClose"></div><aside class="drawer">
    <div class="dr-h"><b style="font-size:15px">${title}</b><span style="flex:1"></span><button class="btn btn-s btn-sm" data-a="reqClose">Đóng</button></div>
    <div class="dr-b">${top}${items}${rep}${files}
      <div class="card kv" id="reqTotals">${reqTotals(E)}</div>
      ${E.err ? `<div class="warn">${esc(E.err)}</div>` : ''}
      <div class="row-w"><button class="btn btn-p grow" data-a="reqSubmit" ${S.busy || E.uploading ? 'disabled' : ''}>${S.busy ? 'Đang gửi…' : m === 'propose' ? 'Gửi đề xuất' : 'Gửi Điều phối xác nhận'}</button><button class="btn btn-s" data-a="reqClose">Huỷ</button></div>
    </div></aside>`;
}
async function reqUpload(files) {
  const E = S.reqEdit, label = E.fileLabel;
  E.uploading = (E.uploading || 0) + files.length; render();
  for (const f of files) {
    try {
      let mime = f.type || 'application/octet-stream', name = f.name, b64;
      if (mime.startsWith('image/')) { b64 = await compressImg(f, API_URL ? 1600 : 600, API_URL ? 0.75 : 0.6); mime = 'image/jpeg'; name = name.replace(/\.\w+$/, '') + '.jpg'; }
      else {
        if (f.size > (API_URL ? 3e6 : 6e5)) throw new Error('File ' + f.name + ' quá lớn (tối đa ' + (API_URL ? '3MB' : '600KB khi dùng thử') + ').');
        b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Không đọc được file.')); r.readAsDataURL(f); });
      }
      const r = await call('file.upload', { name: (E.vals.id || 'BD') + '_' + name, mime, data: b64 });
      E.vals.files.push({ url: r.url, label, name: f.name, mime });
    } catch (e) { toast(e.message, true); }
    E.uploading--; render();
  }
}

/* ------------------------------------------------------------ in */
function hdPlain(no) {
  const C = window.COMPANY || {};
  return `<div class="hd"><div class="co"><img src="${absUrl('logo.png')}" alt=""><div><b>${esc(C.name || '')}</b><div>Địa chỉ: ${C.address ? esc(C.address) : DOTS}</div><div>Mã số thuế: ${C.taxCode ? esc(C.taxCode) : DOTS}</div></div></div><div class="form"><div>Số: <b>${esc(no)}</b></div></div></div>`;
}
const sig4 = (a, b) => `<div class="sig s4"><div>Người đề xuất<small>(Ký, họ tên)</small><div class="nm">${esc(a || '')}</div></div><div>Điều phối xe<small>(Ký, họ tên)</small><div class="nm">${esc(b || '')}</div></div><div>Kế toán<small>(Ký, họ tên)</small><div class="nm"></div></div><div>Giám đốc phê duyệt<small>(Ký, họ tên)</small><div class="nm"></div></div></div>`;
function docReqDx(r) {
  const C = window.COMPANY || {}, car = carById(r.carId), items = r.items || [], est = sumL(items);
  return `<section class="page">${hdPlain(r.id)}
    <h1>PHIẾU ĐỀ XUẤT BẢO DƯỠNG, SỬA CHỮA XE</h1><div class="c i">${ngay(r.createdAt)}</div>
    <p style="margin-top:16px">Kính gửi: Ban Giám đốc ${esc(C.short || C.name || '')}; Bộ phận điều phối xe.</p>
    <p>Người đề xuất: <b>${esc(r.createdName)}</b> – Bộ phận: Đội xe</p>
    <p>Xe: <b>${esc(r.plate)}</b>${car ? ' – ' + esc(car.model) : ''}. Số km hiện tại: ${num(r.km)} km.</p>
    <p>Nội dung đề xuất: <b>${esc(r.type)}</b>${String(r.urgent) === 'true' ? ' (sửa chữa khẩn cấp, đã thực hiện trước khi duyệt)' : ''}.</p>
    <p>Hiện trạng / lý do: ${esc(r.reason)}</p>
    <p>Đơn vị dự kiến thực hiện: ${r.vendor ? esc(r.vendor) : DOTS}. Thời gian dự kiến: ${r.planDate && String(r.urgent) !== 'true' ? dmy(r.planDate) : DOTS}.</p>
    <table><thead><tr><th style="width:40px">STT</th><th>Hạng mục</th><th style="width:130px">Chi phí dự kiến (đ)</th></tr></thead><tbody>
      ${items.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.name)}</td><td class="n">${num(x.amount)}</td></tr>`).join('') || `<tr><td colspan="3" class="c">${String(r.urgent) === 'true' ? 'Xem chi phí thực tế trên giấy đề nghị thanh toán' : '—'}</td></tr>`}
      <tr><td colspan="2" class="c"><b>Tổng dự toán</b></td><td class="n"><b>${num(est)}</b></td></tr></tbody></table>
    ${est ? `<p>Viết bằng chữ: <i>${docSo(est)}.</i></p>` : ''}
    <p>Ý kiến của Điều phối: ${r.approvedBy ? 'Đồng ý – ' + esc(r.approvedBy) + ', ' + fmtTs(r.approvedAt) + (r.reviewNote && !/^Trả lại/.test(r.reviewNote) ? '. ' + esc(r.reviewNote) : '') : r.status === 'rejected' ? 'Không duyệt – ' + esc(r.reviewNote) : DOTS + DOTS}</p>
    ${sig4(r.createdName, r.approvedBy)}
  </section>${(r.files || []).length ? `<section class="page"><h2>PHỤ LỤC CHỨNG TỪ KÈM THEO</h2><div class="c">Phiếu đề xuất số ${esc(r.id)} – ${esc(r.type)} xe ${esc(r.plate)}</div><div class="ph">${r.files.map((f, i) => attFigs(f.url, (i + 1) + '. ' + (f.label || '') + (f.name ? ' – ' + f.name : ''))).join('')}</div></section>` : ''}`;
}
function docReqDn(r) {
  const C = window.COMPANY || {}, act = r.actual || [], est = r.items || [], total = sumL(act), imgs = (r.files || []);
  const to = r.payee === 'vendor' ? 'Chuyển khoản cho ' + esc(r.vendor) + (r.vendorBank ? ' – ' + esc(r.vendorBank) : '') : 'Hoàn ứng cho người đề nghị (đã thanh toán bằng tiền mặt)';
  return `<section class="page">${vHead('Mẫu số 05 - TT')}
    <h1>GIẤY ĐỀ NGHỊ THANH TOÁN</h1><div class="c i">${ngay(r.reportedAt)}</div><div class="c">Số: ${esc(r.id)}</div>
    <p style="margin-top:16px">Kính gửi: Ban Giám đốc ${esc(C.short || C.name || '')}</p>
    <p>Họ và tên người đề nghị thanh toán: <b>${esc(r.createdName)}</b></p>
    <p>Bộ phận: Đội xe</p>
    <p>Nội dung thanh toán: Chi phí ${esc(r.type.toLowerCase())} xe <b>${esc(r.plate)}</b>${r.vendor ? ' tại ' + esc(r.vendor) : ''}, ngày ${dmy(r.doneDate)}, km ${num(r.doneKm)}, theo phiếu đề xuất số ${esc(r.id)}${String(r.urgent) === 'true' ? ' (sửa chữa khẩn cấp)' : ''}.</p>
    <p>Hình thức thanh toán: ${to}.</p>
    <table><thead><tr><th style="width:40px">STT</th><th>Hạng mục</th><th style="width:66px">Hoá đơn</th><th style="width:110px">Dự toán (đ)</th><th style="width:110px">Thực tế (đ)</th></tr></thead><tbody>
      ${act.map((x, i) => { const e = est.find(y => y.name === x.name); return `<tr><td class="c">${i + 1}</td><td>${esc(x.name)}</td><td class="c">${String(x.invoice) === 'true' ? 'Có' : 'Không'}</td><td class="n">${e ? num(e.amount) : '–'}</td><td class="n">${num(x.amount)}</td></tr>`; }).join('')}
      <tr><td colspan="3" class="c"><b>Cộng</b></td><td class="n"><b>${est.length ? num(sumL(est)) : '–'}</b></td><td class="n"><b>${num(total)}</b></td></tr></tbody></table>
    <p>Số tiền đề nghị thanh toán: <b>${num(total)} đồng</b></p>
    <p>Viết bằng chữ: <i>${docSo(total)}.</i></p>
    <p>Kèm theo: ${(r.files || []).length || DOTS} chứng từ gốc.</p>
    <p class="small">Xác nhận trên hệ thống: ${r.approvedBy ? 'đề xuất duyệt bởi ' + esc(r.approvedBy) + ' (' + fmtTs(r.approvedAt) + ')' : 'sửa chữa khẩn cấp'}${r.confirmedBy ? '; chi phí xác nhận bởi ' + esc(r.confirmedBy) + ' (' + fmtTs(r.confirmedAt) + ')' : ''}${r.paidAt ? '; đã thanh toán bởi ' + esc(r.paidBy) + ' (' + fmtTs(r.paidAt) + (r.payRef ? ', ' + esc(r.payRef) : '') + ')' : ''}.</p>
    <div class="sig s4"><div>Người đề nghị thanh toán<small>(Ký, họ tên)</small><div class="nm">${esc(r.createdName)}</div></div><div>Điều phối xác nhận<small>(Ký, họ tên)</small><div class="nm">${esc(r.confirmedBy || '')}</div></div><div>Kế toán trưởng<small>(Ký, họ tên)</small><div class="nm"></div></div><div>Giám đốc duyệt<small>(Ký, họ tên)</small><div class="nm"></div></div></div>
  </section>${imgs.length ? `<section class="page"><h2>PHỤ LỤC CHỨNG TỪ KÈM THEO</h2><div class="c">Giấy đề nghị thanh toán số ${esc(r.id)} – ${esc(r.type)} xe ${esc(r.plate)}</div>
    <div class="ph">${imgs.map((f, i) => `${attFigs(f.url, (i + 1) + '. ' + (f.label || '') + (f.name ? ' – ' + f.name : ''))}`).join('')}</div></section>` : ''}`;
}
function docReqChi(r) {
  const total = N(r.actualTotal);
  return `<section class="page">${vHead('Mẫu số 02 - TT')}
    <div class="pc-top"><div></div><div class="c"><h1 style="margin:18px 0 4px">PHIẾU CHI</h1><div class="i">${ngay(r.paidAt)}</div></div><div class="pc-no"><div>Quyển số: ${DOTS}</div><div>Số: ${r.payRef ? esc(r.payRef) : DOTS}</div><div>Nợ: ${DOTS}</div><div>Có: ${DOTS}</div></div></div>
    <p style="margin-top:16px">Họ và tên người nhận tiền: <b>${esc(r.createdName)}</b></p>
    <p>Địa chỉ: Đội xe</p>
    <p>Lý do chi: Hoàn ứng chi phí ${esc(r.type.toLowerCase())} xe ${esc(r.plate)}${r.vendor ? ' tại ' + esc(r.vendor) : ''}, theo giấy đề nghị thanh toán số ${esc(r.id)}.</p>
    <p>Số tiền: <b>${num(total)} đồng</b></p>
    <p>Viết bằng chữ: <i>${docSo(total)}.</i></p>
    <p>Kèm theo: ${(r.files || []).length || DOTS} chứng từ gốc.</p>
    <div class="r i" style="margin-top:14px">${ngay(r.paidAt)}</div>
    <div class="sig s5"><div>Giám đốc<small>(Ký, họ tên, đóng dấu)</small><div class="nm"></div></div><div>Kế toán trưởng<small>(Ký, họ tên)</small><div class="nm"></div></div><div>Người lập phiếu<small>(Ký, họ tên)</small><div class="nm">${esc(r.paidBy || '')}</div></div><div>Người nhận tiền<small>(Ký, họ tên)</small><div class="nm">${esc(r.createdName)}</div></div><div>Thủ quỹ<small>(Ký, họ tên)</small><div class="nm"></div></div></div>
    <p style="margin-top:18px">Đã nhận đủ số tiền (viết bằng chữ): ${DOTS}${DOTS}</p>
  </section>`;
}
function printReqs(ids, kind) {
  let rs = ids.map(reqOf).filter(Boolean);
  if (kind === 'chi') rs = rs.filter(r => r.status === 'paid' && r.payee !== 'vendor');
  if (kind === 'dn') rs = rs.filter(r => (r.actual || []).length);
  if (!rs.length) return toast('Không có chứng từ phù hợp để in.', true);
  const urls = kind === 'chi' ? [] : rs.flatMap(r => (r.files || []).map(f => f.url));
  runPrint(({ dx: 'Phieu de xuat', dn: 'Giay de nghi thanh toan', chi: 'Phieu chi' })[kind] + ' ' + rs.map(r => r.id).join('_').slice(0, 60), urls,
    () => rs.map(r => kind === 'dx' ? docReqDx(r) : kind === 'chi' ? docReqChi(r) : docReqDn(r)).join(''));
}

/* ------------------------------------------------------------ thao tác */
const REQ_ACTIONS = {
  reqNew: v => {
    S.sel = null; S.logSel = null; S.reqSel = null; S.notifOpen = false;
    if (v === 'urgent') S.reqEdit = { mode: 'urgent', vals: reqBlank(true), fileLabel: 'Hoá đơn' };
    else { const p = String(v || '').split(':'); S.reqEdit = { mode: 'propose', vals: reqBlank(false, p[0] === 'due' ? p[1] : '', p[0] === 'due' ? p[2] : ''), fileLabel: 'Báo giá' }; }
  },
  reqOpen: v => { if (!reqOf(v)) return; S.reqSel = v; S.reqAct = {}; S.reqEdit = null; S.sel = null; S.logSel = null; S.notifOpen = false; },
  reqCloseSel: () => { S.reqSel = null; S.reqAct = {}; },
  reqClose: () => { S.reqEdit = null; },
  reqEditProp: () => {
    const r = reqOf(S.reqSel); if (!r) return;
    S.reqEdit = { mode: 'propose', fileLabel: 'Báo giá', vals: { id: r.id, carId: r.carId, type: r.type, km: String(N(r.km)), reason: r.reason, vendor: r.vendor || '', planDate: r.planDate || '', items: (r.items || []).map(x => ({ name: x.name, amount: String(N(x.amount)) })), files: (r.files || []).slice() } };
    S.reqSel = null;
  },
  reqReport: () => {
    const r = reqOf(S.reqSel); if (!r) return;
    const car = carById(r.carId), km = car ? N(car.odo) : N(r.km);
    S.reqEdit = { mode: 'report', fileLabel: 'Hoá đơn', vals: Object.assign({ id: r.id, carId: r.carId, type: r.type, vendor: r.vendor || '', estimate: r.estimate, items: r.items || [], files: (r.files || []).slice() }, reqReportFields(r, km)) };
    S.reqSel = null;
  },
  reqAddItem: () => { S.reqEdit.vals.items.push({ name: '', amount: '' }); },
  reqDelItem: i => { S.reqEdit.vals.items.splice(+i, 1); },
  reqAddAct: () => { S.reqEdit.vals.actual.push({ name: '', amount: '', invoice: true }); },
  reqDelAct: i => { S.reqEdit.vals.actual.splice(+i, 1); },
  reqDelFile: i => { S.reqEdit.vals.files.splice(+i, 1); },
  reqSubmit: () => {
    const E = S.reqEdit, v = E.vals; E.err = '';
    if (E.uploading) { E.err = 'Đang tải chứng từ lên, vui lòng đợi.'; return; }
    if (E.mode === 'propose') return mutate('mreq.save', { id: v.id, carId: v.carId, type: v.type, km: v.km, reason: v.reason, vendor: v.vendor, planDate: v.planDate, items: v.items, files: v.files }, v.id ? 'Đã gửi lại đề xuất' : 'Đã gửi đề xuất tới Điều phối', () => { S.reqEdit = null; });
    const rep = { doneDate: v.doneDate, doneKm: v.doneKm, vendor: v.vendor, actual: v.actual, payee: v.payee, vendorBank: v.vendorBank, nextDue: v.nextDue, files: v.files };
    if (E.mode === 'urgent') return mutate('mreq.save', Object.assign({ urgent: true, carId: v.carId, type: v.type, km: v.km, reason: v.reason, items: [] }, rep), 'Đã gửi Điều phối xác nhận', () => { S.reqEdit = null; });
    return mutate('mreq.report', Object.assign({ id: v.id }, rep), 'Đã nộp chứng từ', () => { S.reqEdit = null; });
  },
  reqApprove: () => mutate('mreq.review', { id: S.reqSel, decision: 'approve' }, 'Đã duyệt đề xuất', () => { S.reqAct = {}; }),
  reqRejShow: () => { S.reqAct = { mode: 'reject' }; },
  reqRetShow: () => { S.reqAct = { mode: 'return' }; },
  reqActReset: () => { S.reqAct = {}; },
  reqReject: () => { if (!(S.reqAct.reason || '').trim()) { S.reqAct.err = 'Nhập lý do.'; return; } return mutate('mreq.review', { id: S.reqSel, decision: 'reject', note: S.reqAct.reason }, 'Đã từ chối đề xuất', () => { S.reqAct = {}; }); },
  reqConfirm: () => mutate('mreq.confirm', { id: S.reqSel, decision: 'approve' }, 'Đã xác nhận chi phí, chuyển Kế toán', () => { S.reqAct = {}; }),
  reqReturn: () => { if (!(S.reqAct.reason || '').trim()) { S.reqAct.err = 'Nhập lý do.'; return; } return mutate('mreq.confirm', { id: S.reqSel, decision: 'return', note: S.reqAct.reason }, 'Đã trả lại chứng từ', () => { S.reqAct = {}; }); },
  reqPay: () => mutate('mreq.pay', { ids: [S.reqSel], payRef: S.reqAct.payRef || '' }, 'Đã ghi nhận thanh toán', () => { S.reqAct = {}; }),
  reqPayBatch: () => {
    const ids = visibleReqs().map(r => r.id); if (!ids.length) return;
    const ref = (document.getElementById('reqBatchRef') || {}).value || '';
    if (!confirm('Xác nhận đã thanh toán ' + ids.length + ' đề xuất?')) return;
    return mutate('mreq.pay', { ids, payRef: ref }, 'Đã ghi nhận thanh toán ' + ids.length + ' đề xuất');
  },
  reqFilter: v => { S.reqFilter = v; },
  printReqDx: () => printReqs([S.reqSel], 'dx'),
  printReqDn: () => printReqs([S.reqSel], 'dn'),
  printReqChi: () => printReqs([S.reqSel], 'chi'),
  printReqDxAll: () => printReqs(visibleReqs().slice(0, 50).map(r => r.id), 'dx'),
  printReqDnAll: () => printReqs(visibleReqs().slice(0, 50).map(r => r.id), 'dn'),
  printReqChiAll: () => printReqs(visibleReqs().slice(0, 50).map(r => r.id), 'chi')
};

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.rq) { S.reqAct[t.dataset.rq] = t.value; return; }
  const E = S.reqEdit; if (!E) return;
  if (t.dataset.rlabel) { E.fileLabel = t.value; return; }
  if (t.dataset.r) E.vals[t.dataset.r] = t.value;
  else if (t.dataset.ri) { const [i, k] = t.dataset.ri.split('.'); E.vals.items[i][k] = t.value; }
  else if (t.dataset.rx) { const [i, k] = t.dataset.rx.split('.'); E.vals.actual[i][k] = t.type === 'checkbox' ? t.checked : t.value; }
  else return;
  const box = document.getElementById('reqTotals'); if (box) box.innerHTML = reqTotals(E);
});
document.addEventListener('change', e => {
  const t = e.target, E = S.reqEdit; if (!E) return;
  if (t.dataset.rfile && t.files && t.files.length) { reqUpload([...t.files]); return; }
  const k = t.dataset.r;
  if (k === 'type') { const km = E.mode === 'report' ? E.vals.doneKm : (E.vals.doneKm || E.vals.km); E.vals.nextDue = nextDueDefault(t.value, km); render(); }
  if (k === 'payee') render();
  if (k === 'carId') { const c = carById(t.value); if (c) { E.vals.km = String(N(c.odo)); if (E.mode === 'urgent') { E.vals.doneKm = String(N(c.odo)); E.vals.nextDue = nextDueDefault(E.vals.type, N(c.odo)); } } render(); }
});

/* ------------------------------------------------------------ xem & in chứng từ đính kèm */
var PRINT_ATT = {};
const FCACHE = new Map();
function fetchFile(url) {
  if (FCACHE.has(url)) return FCACHE.get(url);
  const p = (async () => {
    let r;
    if (url.startsWith('data:')) { const m = url.match(/^data:([^;,]+);base64,(.*)$/); if (!m) throw new Error('Chứng từ lỗi.'); r = { mime: m[1], b64: m[2] }; }
    else {
      const id = (url.match(/\/d\/([^/?]+)/) || url.match(/[?&]id=([^&]+)/) || [])[1];
      if (!id) throw new Error('Link chứng từ không hợp lệ.');
      const d = await call('file.get', { id }); r = { mime: d.mime, b64: d.data, name: d.name };
    }
    r.dataUrl = 'data:' + r.mime + ';base64,' + r.b64;
    return r;
  })();
  FCACHE.set(url, p); p.catch(() => FCACHE.delete(url));
  return p;
}
const blobUrl = f => { if (!f.blob) { const b = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)); f.blob = URL.createObjectURL(new Blob([b], { type: f.mime })); } return f.blob; };
let _pdfjs = null;
function pdfjs() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { _pdfjs = null; rej(new Error('Không tải được bộ đọc PDF.')); };
    document.head.appendChild(s);
  });
  return _pdfjs;
}
async function pdfPages(b64) {
  const lib = await pdfjs(), doc = await lib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }).promise, out = [];
  for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1.6 }), c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    out.push(c.toDataURL('image/jpeg', 0.85));
  }
  return out;
}
function attFigs(url, cap) {
  const a = PRINT_ATT[url];
  if (!a || !a.pages.length) return `<figure><div style="padding:30px;text-align:center;border:1px dashed #999">Không tải được chứng từ này để in</div><figcaption>${esc(cap)}</figcaption></figure>`;
  return a.pages.map((p, k) => `<figure class="${a.pdf ? 'full' : ''}"><img src="${p}" alt=""><figcaption>${esc(cap)}${a.pages.length > 1 ? ' – trang ' + (k + 1) + '/' + a.pages.length : ''}</figcaption></figure>`).join('');
}
async function runPrint(title, urls, build) {
  let w = null, frame = null;
  try { w = window.open('', '_blank'); } catch (e) { }
  if (!w) { frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(frame); w = frame.contentWindow; }
  if (urls.length) { w.document.open(); w.document.write('<!doctype html><meta charset="utf-8"><title>Đang chuẩn bị…</title><p style="font:16px sans-serif;padding:24px">Đang tải ' + urls.length + ' chứng từ để in…</p>'); w.document.close(); }
  PRINT_ATT = {};
  for (const u of [...new Set(urls)]) {
    try { const f = await fetchFile(u), pdf = f.mime === 'application/pdf'; PRINT_ATT[u] = { pdf, pages: pdf ? await pdfPages(f.b64) : f.mime.startsWith('image/') ? [f.dataUrl] : [] }; }
    catch (e) { PRINT_ATT[u] = null; }
  }
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PRINT_CSS + '.ph figure.full{grid-column:1/-1}.ph figure.full img{max-height:235mm}</style></head><body>' + build() + '</body></html>';
  const doc = w.document; doc.open(); doc.write(html); doc.close();
  let fired = false;
  const go = () => { if (fired) return; fired = true; w.focus(); w.print(); if (frame) setTimeout(() => frame.remove(), 60000); };
  const pending = [...doc.images].filter(i => !i.complete);
  if (!pending.length) setTimeout(go, 300);
  else { let left = pending.length; pending.forEach(i => i.onload = i.onerror = () => { if (--left <= 0) setTimeout(go, 200); }); setTimeout(go, 8000); }
}
// in giấy đề nghị / phiếu chi của báo cáo ngày: dùng chung cơ chế tải chứng từ
printDocs = function (ids, kind) {
  const logs = ids.map(logOf).filter(Boolean).filter(l => kind !== 'chi' || l.status === 'paid');
  if (!logs.length) return toast('Không có chứng từ để in.', true);
  const urls = kind === 'chi' ? [] : logs.flatMap(l => costsOf(l.id).map(c => c.photo).filter(Boolean));
  runPrint((kind === 'chi' ? 'Phieu chi ' : 'Giay de nghi thanh toan ') + logs.map(l => l.id).join('_').slice(0, 60), urls, () => logs.map(l => kind === 'chi' ? docPhieuChi(l) : docDeNghi(l)).join(''));
};

function hydrateThumbs() {
  document.querySelectorAll('img[data-fsrc]:not([src])').forEach(img => {
    const u = img.dataset.fsrc;
    if (u.startsWith('data:')) { img.src = u; return; }
    img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    fetchFile(u).then(f => { if (f.mime.startsWith('image/')) img.src = f.dataUrl; }).catch(() => { img.alt = 'Lỗi'; img.style.outline = '1px dashed #A31E22'; });
  });
}
new MutationObserver(() => hydrateThumbs()).observe(document.getElementById('app'), { childList: true, subtree: true });

function openViewer(list, i) {
  S.viewer = { list, i, f: null, err: '' }; render();
  const V = S.viewer;
  fetchFile(list[i].url).then(f => { if (S.viewer === V) { V.f = f; render(); } }).catch(e => { if (S.viewer === V) { V.err = e.message; render(); } });
}
function vViewer() {
  const V = S.viewer, it = V.list[V.i] || {}, f = V.f, n = V.list.length;
  let body = '<span class="spin" style="width:30px;height:30px"></span>';
  if (V.err) body = `<div style="color:#fff;text-align:center;max-width:420px">${esc(V.err)}</div>`;
  else if (f) body = f.mime.startsWith('image/') ? `<img src="${f.dataUrl}" alt="">` : f.mime === 'application/pdf' ? `<iframe src="${blobUrl(f)}" title="PDF"></iframe>` : '<div style="color:#fff">Không xem trước được loại file này. Bấm "Tải về".</div>';
  return `<div class="viewer"><div class="vw-h"><div style="flex:1;min-width:150px"><b>${esc(it.label || 'Chứng từ')}</b> <span style="color:#B4A99D;font-size:12.5px">${esc(it.name || '')}${n > 1 ? ' · ' + (V.i + 1) + '/' + n : ''}</span></div>
    ${n > 1 ? '<button class="btn btn-s btn-sq" data-a="vwPrev">‹</button><button class="btn btn-s btn-sq" data-a="vwNext">›</button>' : ''}
    <button class="btn btn-s btn-sm" data-a="vwOpen" ${f ? '' : 'disabled'}>Mở tab mới</button><button class="btn btn-s btn-sm" data-a="vwDl" ${f ? '' : 'disabled'}>Tải về</button><button class="btn btn-s btn-sm" data-a="vwPrint" ${f ? '' : 'disabled'}>In</button><button class="btn btn-p btn-sm" data-a="vwClose">Đóng</button></div>
    <div class="vw-b">${body}</div></div>`;
}
Object.assign(REQ_ACTIONS, {
  vwClose: () => { S.viewer = null; },
  vwPrev: () => { const V = S.viewer; openViewer(V.list, (V.i - 1 + V.list.length) % V.list.length); return Promise.resolve(); },
  vwNext: () => { const V = S.viewer; openViewer(V.list, (V.i + 1) % V.list.length); return Promise.resolve(); },
  vwOpen: () => { const f = S.viewer && S.viewer.f; if (f) window.open(blobUrl(f), '_blank'); },
  vwDl: () => { const V = S.viewer, f = V && V.f; if (!f) return; const it = V.list[V.i], a = document.createElement('a'); a.href = blobUrl(f); a.download = it.name || f.name || ('chung-tu' + (f.mime === 'application/pdf' ? '.pdf' : '.jpg')); a.click(); },
  vwPrint: () => { const V = S.viewer, it = V.list[V.i]; runPrint('Chung tu ' + (it.name || ''), [it.url], () => `<section class="page"><div class="ph">${attFigs(it.url, (it.label || 'Chứng từ') + (it.name ? ' – ' + it.name : ''))}</div></section>`); }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-fview]'); if (!el) return;
  const act = e.target.closest('[data-a]'); if (act && el.contains(act)) return;
  e.preventDefault(); e.stopPropagation();
  const els = [...document.querySelectorAll('[data-fview="' + el.dataset.fview + '"]')];
  openViewer(els.map(x => ({ url: x.dataset.fu, label: x.dataset.fl, name: x.dataset.fn, mime: x.dataset.fm })), Math.max(0, els.indexOf(el)));
}, true);
