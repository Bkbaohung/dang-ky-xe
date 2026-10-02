/* =============================================================================
 * NGHIỆP VỤ DÙNG CHUNG — Quản lý xe công tác Bảo Hưng
 * File này chạy được ở 2 nơi:
 *   1) Google Apps Script (dán vào file "Logic.gs")  → xử lý thật trên Google Sheet
 *   2) Trình duyệt (index.html, chế độ DEMO)          → dữ liệu giả trong localStorage
 * Không sửa tên hàm BH_api / BH_TABLES vì Code.gs và app.js đều gọi tới.
 * ========================================================================== */

var BH_CONFIG = {
  ALLOW_CONFLICT: false,      // true = cho phép xếp xe dù trùng lịch (chỉ cảnh báo)
  SESSION_DAYS: 30,           // số ngày giữ đăng nhập
  MAX_NOTIFS: 40
};

// Mỗi bảng = 1 sheet. Cột theo đúng thứ tự dưới đây (hàng 1 là tiêu đề tiếng Việt).
var BH_TABLES = {
  users:    { sheet: 'NguoiDung',   cols: [['id','Mã'],['username','Tên đăng nhập'],['name','Họ tên'],['role','Vai trò'],['dept','Phòng ban'],['phone','Điện thoại'],['email','Email'],['driverId','Mã lái xe liên kết'],['active','Hoạt động'],['passHash','Mật khẩu (mã hoá)'],['salt','Salt'],['createdAt','Ngày tạo']] },
  sessions: { sheet: 'PhienDangNhap', cols: [['id','Token'],['userId','Mã người dùng'],['expires','Hết hạn']] },
  cars:     { sheet: 'Xe',          cols: [['id','Mã'],['plate','Biển số'],['model','Dòng xe'],['seats','Số chỗ'],['odo','Km hiện tại'],['dk','Hạn đăng kiểm'],['bh','Hạn bảo hiểm'],['svcKm','Mốc bảo dưỡng (km)'],['active','Hoạt động']] },
  drivers:  { sheet: 'LaiXe',       cols: [['id','Mã'],['name','Họ tên'],['phone','Điện thoại'],['lic','Hạng bằng'],['licExp','Hạn bằng lái'],['active','Hoạt động']] },
  trips:    { sheet: 'ChuyenDi',    cols: [['id','Mã chuyến'],['createdBy','Người tạo (mã)'],['name','Người đặt'],['dept','Phòng ban'],['phone','Điện thoại'],['dest','Điểm đến'],['purpose','Mục đích'],['start','Ngày đi'],['end','Ngày về'],['time','Giờ đi'],['pax','Số người'],['status','Trạng thái'],['carId','Mã xe'],['drvId','Mã lái xe'],['kmStart','Km đầu'],['kmEnd','Km cuối'],['fuel','Nhiên liệu'],['toll','Cầu đường'],['park','Gửi xe'],['other','Chi phí khác'],['rejectReason','Lý do từ chối/huỷ'],['driverReject','Lái xe từ chối'],['createdAt','Thời điểm tạo'],['updatedAt','Cập nhật lúc']] },
  maint:    { sheet: 'BaoDuong',    cols: [['id','Mã'],['date','Ngày'],['carId','Mã xe'],['type','Loại'],['content','Nội dung'],['km','Km'],['cost','Chi phí'],['createdBy','Người ghi']] },
  notifs:   { sheet: 'ThongBao',    cols: [['id','Mã'],['to','Gửi tới'],['text','Nội dung'],['tripId','Mã chuyến'],['t','Thời điểm'],['readBy','Đã đọc bởi']] }
};

var BH_ROLES = { admin: 'Quản trị', dispatch: 'Điều phối', bgd: 'Ban Giám đốc', sales: 'Nhân viên', driver: 'Lái xe' };
var BH_STATUS = { pending: 'Chờ xếp xe', assigned: 'Chờ lái xe nhận', accepted: 'Sẵn sàng', ongoing: 'Đang đi', done: 'Hoàn thành', rejected: 'Từ chối', cancelled: 'Đã huỷ' };
var BH_ACTIVE = ['assigned', 'accepted', 'ongoing'];

function BH_num(v) { var n = String(v === undefined || v === null ? '' : v).replace(/[^\d]/g, ''); return n ? Number(n) : 0; }
function BH_pad(n) { return (n < 10 ? '0' : '') + n; }
function BH_iso(d) { return d.getFullYear() + '-' + BH_pad(d.getMonth() + 1) + '-' + BH_pad(d.getDate()); }
function BH_dm(s) { var p = String(s).split('-'); return p[2] + '/' + p[1]; }
function BH_overlap(a, b) { return a.start <= b.end && b.start <= a.end; }
function BH_vnd(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ'; }

/**
 * ctx = { db, hash(str), uuid(), now(), today(), onNotify(notif, users) }
 * db  = { all(table), insert(table,obj), update(table,id,patch), remove(table,id) }
 */
function BH_api(ctx, req) {
  try {
    var action = req.action, p = req.params || {};
    if (action === 'login') return { ok: true, data: login(p) };
    var me = auth(req.token);
    var H = handlers();
    if (!H[action]) throw new Error('Thao tác không hợp lệ: ' + action);
    return { ok: true, data: H[action](p) };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e), auth: !!(e && e.auth) };
  }

  // ---------------------------------------------------------------- helpers
  function fail(msg) { throw new Error(msg); }
  function find(table, id) { var r = ctx.db.all(table).filter(function (x) { return String(x.id) === String(id); })[0]; return r || null; }
  function need(cond, msg) { if (!cond) fail(msg || 'Bạn không có quyền thực hiện thao tác này.'); }
  function isRole() { for (var i = 0; i < arguments.length; i++) if (me.role === arguments[i]) return true; return false; }
  function canDispatch() { return isRole('admin', 'dispatch'); }
  function canViewAll() { return isRole('admin', 'dispatch', 'bgd'); }
  function publicUser(u) { return { id: u.id, username: u.username, name: u.name, role: u.role, dept: u.dept, phone: u.phone, email: u.email, driverId: u.driverId, active: String(u.active) !== 'false' }; }
  function nextTripId() {
    var max = 1000; ctx.db.all('trips').forEach(function (t) { var n = BH_num(t.id); if (n > max) max = n; });
    return 'BH-' + (max + 1);
  }
  function str(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 300); }

  function login(p) {
    var u = ctx.db.all('users').filter(function (x) { return String(x.username).toLowerCase() === str(p.username).toLowerCase(); })[0];
    if (!u || String(u.active) === 'false' || ctx.hash(str(p.password, 100) + u.salt) !== u.passHash) fail('Sai tên đăng nhập hoặc mật khẩu.');
    var token = ctx.uuid(), exp = ctx.now() + BH_CONFIG.SESSION_DAYS * 86400000;
    // dọn phiên hết hạn của người này
    ctx.db.all('sessions').forEach(function (s) { if (Number(s.expires) < ctx.now()) ctx.db.remove('sessions', s.id); });
    ctx.db.insert('sessions', { id: token, userId: u.id, expires: exp });
    return { token: token, user: publicUser(u) };
  }
  function auth(token) {
    var s = token && find('sessions', token);
    if (!s || Number(s.expires) < ctx.now()) { var e = new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'); e.auth = true; throw e; }
    var u = find('users', s.userId);
    if (!u || String(u.active) === 'false') { var e2 = new Error('Tài khoản đã bị khoá.'); e2.auth = true; throw e2; }
    return u;
  }

  function notify(to, text, tripId) {
    if (!to) return;
    var n = { id: ctx.uuid(), to: to, text: text, tripId: tripId || '', t: ctx.now(), readBy: '' };
    ctx.db.insert('notifs', n);
    if (ctx.onNotify) {
      var users = ctx.db.all('users').filter(function (u) { return String(u.active) !== 'false' && matchTo(u, to); });
      try { ctx.onNotify(n, users); } catch (e) { }
    }
  }
  function matchTo(u, to) {
    if (to === 'role:dispatch') return u.role === 'dispatch' || u.role === 'admin';
    if (to.indexOf('role:') === 0) return u.role === to.slice(5);
    if (to.indexOf('user:') === 0) return String(u.id) === to.slice(5);
    if (to.indexOf('driver:') === 0) return String(u.driverId) === to.slice(7) && u.role === 'driver';
    return false;
  }
  function busy(trip, key, val) {
    return ctx.db.all('trips').filter(function (o) { return String(o.id) !== String(trip.id) && BH_ACTIVE.indexOf(o.status) >= 0 && String(o[key]) === String(val) && BH_overlap(o, trip); });
  }
  function touch(id, patch) { patch.updatedAt = ctx.now(); ctx.db.update('trips', id, patch); return find('trips', id); }
  function getTrip(id) { var t = find('trips', id); if (!t) fail('Không tìm thấy chuyến ' + id); return t; }
  function ownerTo(t) { return t.createdBy ? 'user:' + t.createdBy : ''; }

  // ---------------------------------------------------------------- handlers
  function handlers() {
    return {
      logout: function () { ctx.db.remove('sessions', req.token); return true; },

      bootstrap: function () {
        var trips = ctx.db.all('trips');
        if (me.role === 'sales') {
          // Nhân viên: thấy đầy đủ chuyến của mình; chuyến người khác chỉ để xem lịch xe (ẩn chi tiết)
          trips = trips.map(function (t) {
            if (String(t.createdBy) === String(me.id)) return t;
            if (BH_ACTIVE.indexOf(t.status) < 0) return null;
            return { id: t.id, start: t.start, end: t.end, status: t.status, carId: t.carId, drvId: t.drvId, dest: t.dest, name: t.name, dept: t.dept, time: t.time, pax: t.pax, limited: true };
          }).filter(Boolean);
        } else if (me.role === 'driver') {
          trips = trips.filter(function (t) { return String(t.drvId) === String(me.driverId) && t.status !== 'pending'; });
        }
        var notifs = ctx.db.all('notifs').filter(function (n) { return matchTo(me, n.to); })
          .sort(function (a, b) { return Number(b.t) - Number(a.t); }).slice(0, BH_CONFIG.MAX_NOTIFS)
          .map(function (n) { return { id: n.id, text: n.text, tripId: n.tripId, t: Number(n.t), read: String(n.readBy).split(',').indexOf(String(me.id)) >= 0 }; });
        return {
          me: publicUser(me),
          cars: ctx.db.all('cars').filter(function (c) { return String(c.active) !== 'false'; }),
          drivers: ctx.db.all('drivers').filter(function (d) { return String(d.active) !== 'false'; }),
          trips: trips,
          maint: canViewAll() ? ctx.db.all('maint') : [],
          notifs: notifs,
          users: me.role === 'admin' ? ctx.db.all('users').map(publicUser) : [],
          config: { allowConflict: BH_CONFIG.ALLOW_CONFLICT },
          serverTime: ctx.now()
        };
      },

      'trip.create': function (p) {
        need(isRole('sales', 'admin', 'dispatch', 'bgd'));
        var t = {
          id: nextTripId(), createdBy: me.id, name: str(p.name || me.name, 80), dept: str(p.dept || me.dept, 60), phone: str(p.phone || me.phone, 20),
          dest: str(p.dest, 150), purpose: str(p.purpose, 500), start: str(p.start, 10), end: str(p.end, 10), time: str(p.time, 5), pax: BH_num(p.pax) || 1,
          status: 'pending', carId: '', drvId: '', kmStart: '', kmEnd: '', fuel: '', toll: '', park: '', other: '', rejectReason: '', driverReject: '',
          createdAt: ctx.now(), updatedAt: ctx.now()
        };
        if (!t.dest || !t.purpose) fail('Nhập điểm đến và mục đích chuyến đi.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t.start) || !/^\d{4}-\d{2}-\d{2}$/.test(t.end)) fail('Ngày đi/về không hợp lệ.');
        if (t.end < t.start) fail('Ngày về phải sau ngày đi.');
        if (t.start < ctx.today()) fail('Ngày đi không được ở quá khứ.');
        ctx.db.insert('trips', t);
        notify('role:dispatch', t.name + ' gửi yêu cầu đặt xe đi ' + t.dest + ' ngày ' + BH_dm(t.start) + '.', t.id);
        return t;
      },

      'trip.assign': function (p) {
        need(canDispatch());
        var t = getTrip(p.id);
        need(['pending', 'assigned', 'accepted'].indexOf(t.status) >= 0, 'Chuyến này không thể xếp xe ở trạng thái hiện tại.');
        var car = find('cars', p.carId), dr = find('drivers', p.drvId);
        if (!car || !dr) fail('Chọn xe và lái xe.');
        if (!BH_CONFIG.ALLOW_CONFLICT) {
          var bc = busy(t, 'carId', car.id), bd = busy(t, 'drvId', dr.id);
          if (bc.length) fail('Xe ' + car.plate + ' đã có chuyến ' + bc[0].id + ' cùng thời gian.');
          if (bd.length) fail('Lái xe ' + dr.name + ' đã có chuyến ' + bd[0].id + ' cùng thời gian.');
        }
        var drvChanged = String(t.drvId) !== String(dr.id), wasPending = t.status === 'pending';
        var patch = { carId: car.id, drvId: dr.id, driverReject: '' };
        if (wasPending || drvChanged) patch.status = 'assigned';
        t = touch(t.id, patch);
        if (wasPending || drvChanged) notify('driver:' + dr.id, 'Bạn được phân công chuyến ' + t.id + ' đi ' + t.dest + ' ngày ' + BH_dm(t.start) + ' lúc ' + t.time + ', xe ' + car.plate + '.', t.id);
        notify(ownerTo(t), 'Chuyến ' + t.id + ' đi ' + t.dest + ' đã được xếp xe ' + car.plate + ', lái xe ' + dr.name + ' (' + dr.phone + ').', t.id);
        return t;
      },

      'trip.reject': function (p) {
        need(canDispatch());
        var t = getTrip(p.id), r = str(p.reason, 300);
        need(t.status === 'pending', 'Chỉ từ chối được yêu cầu đang chờ xếp xe.');
        if (!r) fail('Vui lòng nhập lý do.');
        t = touch(t.id, { status: 'rejected', rejectReason: r });
        notify(ownerTo(t), 'Yêu cầu ' + t.id + ' đi ' + t.dest + ' bị từ chối: ' + r, t.id);
        return t;
      },

      'trip.cancel': function (p) {
        var t = getTrip(p.id);
        need(String(t.createdBy) === String(me.id) || canDispatch());
        need(['pending', 'assigned', 'accepted'].indexOf(t.status) >= 0, 'Không thể huỷ chuyến ở trạng thái hiện tại.');
        var hadDriver = t.drvId && BH_ACTIVE.indexOf(t.status) >= 0, r = str(p.reason, 300);
        t = touch(t.id, { status: 'cancelled', rejectReason: (me.name + ' huỷ') + (r ? ': ' + r : '') });
        notify('role:dispatch', me.name + ' đã huỷ chuyến ' + t.id + ' đi ' + t.dest + '.', t.id);
        if (hadDriver) notify('driver:' + t.drvId, 'Chuyến ' + t.id + ' ngày ' + BH_dm(t.start) + ' đã bị huỷ.', t.id);
        return t;
      },

      'trip.accept': function (p) {
        var t = getTrip(p.id);
        need(me.role === 'driver' && String(t.drvId) === String(me.driverId) && t.status === 'assigned');
        t = touch(t.id, { status: 'accepted' });
        notify('role:dispatch', 'Lái xe ' + me.name + ' đã nhận chuyến ' + t.id + '.', t.id);
        notify(ownerTo(t), 'Lái xe ' + me.name + ' đã xác nhận chuyến ' + t.id + ' ngày ' + BH_dm(t.start) + '.', t.id);
        return t;
      },

      'trip.decline': function (p) {
        var t = getTrip(p.id), r = str(p.reason, 300);
        need(me.role === 'driver' && String(t.drvId) === String(me.driverId) && t.status === 'assigned');
        if (!r) fail('Vui lòng nhập lý do.');
        t = touch(t.id, { status: 'pending', drvId: '', driverReject: 'Lái xe ' + me.name + ' từ chối: ' + r });
        notify('role:dispatch', 'Lái xe ' + me.name + ' từ chối chuyến ' + t.id + ': ' + r + '. Cần xếp lại.', t.id);
        return { id: t.id, removed: true };
      },

      'trip.start': function (p) {
        var t = getTrip(p.id), ks = BH_num(p.kmStart);
        need(me.role === 'driver' && String(t.drvId) === String(me.driverId) && t.status === 'accepted');
        if (!ks) fail('Nhập số km lúc xuất phát.');
        t = touch(t.id, { status: 'ongoing', kmStart: ks });
        notify('role:dispatch', 'Chuyến ' + t.id + ' đã xuất phát (km ' + ks + ').', t.id);
        notify(ownerTo(t), 'Xe đã xuất phát cho chuyến ' + t.id + '.', t.id);
        return t;
      },

      'trip.finish': function (p) {
        var t = getTrip(p.id), ke = BH_num(p.kmEnd);
        need(me.role === 'driver' && String(t.drvId) === String(me.driverId) && t.status === 'ongoing');
        if (!ke || ke <= BH_num(t.kmStart)) fail('Km kết thúc phải lớn hơn km xuất phát (' + t.kmStart + ').');
        var patch = { status: 'done', kmEnd: ke, fuel: BH_num(p.fuel), toll: BH_num(p.toll), park: BH_num(p.park), other: BH_num(p.other) };
        t = touch(t.id, patch);
        var car = find('cars', t.carId);
        if (car && ke > BH_num(car.odo)) ctx.db.update('cars', car.id, { odo: ke });
        var total = patch.fuel + patch.toll + patch.park + patch.other;
        notify('role:dispatch', 'Chuyến ' + t.id + ' hoàn thành: ' + (ke - BH_num(t.kmStart)) + ' km, chi phí ' + BH_vnd(total) + '.', t.id);
        notify(ownerTo(t), 'Chuyến ' + t.id + ' đã hoàn thành.', t.id);
        return t;
      },

      'car.save': function (p) {
        need(canDispatch());
        var c = { plate: str(p.plate, 20).toUpperCase(), model: str(p.model, 60), seats: BH_num(p.seats) || 4, odo: BH_num(p.odo), dk: str(p.dk, 10), bh: str(p.bh, 10), svcKm: BH_num(p.svcKm) || (BH_num(p.odo) + 5000), active: p.active === false ? false : true };
        if (!c.plate || !c.model) fail('Nhập biển số và dòng xe.');
        if (p.id) { need(find('cars', p.id), 'Không tìm thấy xe.'); ctx.db.update('cars', p.id, c); return find('cars', p.id); }
        c.id = 'X' + ctx.uuid().slice(0, 6).toUpperCase(); ctx.db.insert('cars', c); return c;
      },

      'driver.save': function (p) {
        need(canDispatch());
        var d = { name: str(p.name, 80), phone: str(p.phone, 20), lic: str(p.lic, 4), licExp: str(p.licExp, 10), active: p.active === false ? false : true };
        if (!d.name || !d.phone) fail('Nhập họ tên và số điện thoại.');
        if (p.id) { need(find('drivers', p.id), 'Không tìm thấy lái xe.'); ctx.db.update('drivers', p.id, d); return find('drivers', p.id); }
        d.id = 'LX' + ctx.uuid().slice(0, 6).toUpperCase(); ctx.db.insert('drivers', d); return d;
      },

      'maint.add': function (p) {
        need(canDispatch());
        var car = find('cars', p.carId); if (!car) fail('Chọn xe.');
        var m = { id: ctx.uuid().slice(0, 8), date: str(p.date, 10) || ctx.today(), carId: car.id, type: str(p.type, 20), content: str(p.content, 300), km: BH_num(p.km), cost: BH_num(p.cost), createdBy: me.id };
        if (!m.content) fail('Nhập nội dung công việc.');
        ctx.db.insert('maint', m);
        var patch = {};
        if (m.km > BH_num(car.odo)) patch.odo = m.km;
        if (m.type === 'Bảo dưỡng') patch.svcKm = BH_num(p.next) || (m.km + 5000);
        if (m.type === 'Đăng kiểm' && p.next) patch.dk = str(p.next, 10);
        if (m.type === 'Bảo hiểm' && p.next) patch.bh = str(p.next, 10);
        ctx.db.update('cars', car.id, patch);
        return m;
      },

      'notif.read': function (p) {
        var ids = p.all ? null : (p.ids || []).map(String);
        ctx.db.all('notifs').forEach(function (n) {
          if (!matchTo(me, n.to)) return;
          if (ids && ids.indexOf(String(n.id)) < 0) return;
          var rb = String(n.readBy || '').split(',').filter(Boolean);
          if (rb.indexOf(String(me.id)) < 0) { rb.push(String(me.id)); ctx.db.update('notifs', n.id, { readBy: rb.join(',') }); }
        });
        return true;
      },

      'me.password': function (p) {
        if (ctx.hash(str(p.old, 100) + me.salt) !== me.passHash) fail('Mật khẩu hiện tại không đúng.');
        if (str(p.next, 100).length < 6) fail('Mật khẩu mới tối thiểu 6 ký tự.');
        var salt = ctx.uuid().slice(0, 8);
        ctx.db.update('users', me.id, { salt: salt, passHash: ctx.hash(str(p.next, 100) + salt) });
        return true;
      },

      'user.save': function (p) {
        need(me.role === 'admin');
        var u = { username: str(p.username, 40).toLowerCase(), name: str(p.name, 80), role: str(p.role, 10), dept: str(p.dept, 60), phone: str(p.phone, 20), email: str(p.email, 100), driverId: str(p.driverId, 20), active: p.active === false ? false : true };
        if (!u.username || !u.name) fail('Nhập tên đăng nhập và họ tên.');
        if (!/^[a-z0-9._-]{3,40}$/.test(u.username)) fail('Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch (3–40 ký tự).');
        if (!BH_ROLES[u.role]) fail('Vai trò không hợp lệ.');
        if (u.role === 'driver' && !find('drivers', u.driverId)) fail('Tài khoản lái xe cần liên kết với một lái xe trong danh mục.');
        if (u.role !== 'driver') u.driverId = '';
        var dup = ctx.db.all('users').filter(function (x) { return x.username.toLowerCase() === u.username && String(x.id) !== String(p.id || ''); })[0];
        if (dup) fail('Tên đăng nhập đã tồn tại.');
        if (p.id) {
          var old = find('users', p.id); need(old, 'Không tìm thấy người dùng.');
          if (String(old.id) === String(me.id) && (u.role !== 'admin' || !u.active)) fail('Không thể tự hạ quyền hoặc khoá chính mình.');
          if (p.password) { if (str(p.password).length < 6) fail('Mật khẩu tối thiểu 6 ký tự.'); u.salt = ctx.uuid().slice(0, 8); u.passHash = ctx.hash(str(p.password, 100) + u.salt); }
          ctx.db.update('users', p.id, u);
          if (!u.active) ctx.db.all('sessions').forEach(function (s) { if (String(s.userId) === String(p.id)) ctx.db.remove('sessions', s.id); });
          return publicUser(find('users', p.id));
        }
        if (str(p.password).length < 6) fail('Mật khẩu tối thiểu 6 ký tự.');
        u.id = 'U' + ctx.uuid().slice(0, 6).toUpperCase(); u.salt = ctx.uuid().slice(0, 8); u.passHash = ctx.hash(str(p.password, 100) + u.salt); u.createdAt = ctx.now();
        ctx.db.insert('users', u);
        return publicUser(u);
      }
    };
  }
}

/** Tạo tài khoản quản trị ban đầu (dùng cho setup trên server và demo). */
function BH_makeUser(ctx, o, password) {
  var salt = ctx.uuid().slice(0, 8);
  var u = { id: o.id || ('U' + ctx.uuid().slice(0, 6).toUpperCase()), username: o.username, name: o.name, role: o.role, dept: o.dept || '', phone: o.phone || '', email: o.email || '', driverId: o.driverId || '', active: true, salt: salt, passHash: ctx.hash(password + salt), createdAt: ctx.now() };
  ctx.db.insert('users', u);
  return u;
}

if (typeof module !== 'undefined') module.exports = { BH_api: BH_api, BH_TABLES: BH_TABLES };
