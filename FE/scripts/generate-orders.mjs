// Sinh phiên bàn, đơn, yêu cầu từ bàn 89 ngày trước và các phiên đã đóng hôm nay (sessions)
// cho src/mock/seed/demo-data.json.
// Xác định: bộ sinh số ngẫu nhiên có hạt giống cố định, chạy lại cho đúng kết quả cũ.
// Giữ nguyên phần viết tay (categories, optionGroups, menuItems, tables, liveSessions), chỉ ghi đè sessions.
// Khóa gọn của phiên bàn và đơn, cách suy ra trường, ánh xạ thứ trong tuần: docs/06-THIET-KE-CSDL.md §5.
// Tiền không ghi vào file: seeder và FE mock tính lại theo docs/07-DANH-SACH-API.md §3 (script tính cùng
// công thức để kiểm ràng buộc test và in số đối chiếu).
// Chạy: pnpm seed:orders  (hoặc node scripts/generate-orders.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mock', 'seed', 'demo-data.json')
const data = JSON.parse(readFileSync(file, 'utf8'))

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261015)
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const chance = (p) => rand() < p
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of entries) {
    r -= w
    if (r < 0) return value
  }
  return entries[entries.length - 1][0]
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const vnd = (n) => n.toLocaleString('vi-VN') + ' ₫'

// ---------- Thực đơn, công thức tiền (docs/07 §3) ----------
const itemByCode = new Map(data.menuItems.map((m) => [m.code, m]))
const groupByKey = new Map(data.optionGroups.map((g) => [g.key, g]))
const choiceByKey = new Map(data.optionGroups.flatMap((g) => g.choices.map((c) => [c.key, { ...c, group: g.key }])))

/** Đơn giá một dòng = giá món + Σ giá cộng thêm của lựa chọn (BR-03) */
const unitPrice = (code, choices = []) => itemByCode.get(code).price + choices.reduce((s, k) => s + choiceByKey.get(k).price, 0)
const lineTotal = (code, qty, choices = []) => unitPrice(code, choices) * qty

/** Kiểm lựa chọn của một dòng theo BR-04; trả về chuỗi lỗi hoặc null */
function choiceError(code, choices = []) {
  const m = itemByCode.get(code)
  if (!m) return `món ${code} không tồn tại`
  for (const k of choices) {
    const c = choiceByKey.get(k)
    if (!c) return `${code}: lựa chọn ${k} không tồn tại`
    if (!m.groups.includes(c.group)) return `${code}: lựa chọn ${k} không thuộc nhóm của món`
  }
  if (new Set(choices).size !== choices.length) return `${code}: lựa chọn trùng`
  for (const gk of m.groups) {
    const g = groupByKey.get(gk)
    const n = choices.filter((k) => choiceByKey.get(k).group === gk).length
    if (g.type === 'ChonMot' && g.required && n !== 1) return `${code}: nhóm ${g.name} bắt buộc chọn 1`
    if (g.type === 'ChonMot' && n > 1) return `${code}: nhóm ${g.name} chọn tối đa 1`
    if (g.type === 'ChonNhieu' && n > g.max) return `${code}: nhóm ${g.name} chọn tối đa ${g.max}`
  }
  return null
}

/** Phân tích một đơn gọn → dòng có trạng thái, tiền (docs/06 §5.4) */
function expandOrder(o) {
  const confirmed = o.s === 'N' || o.cf != null
  const lines = []
  for (const [code, qty, choices = [], ex = {}] of o.it) {
    const unit = unitPrice(code, choices)
    if (ex.rm) {
      lines.push({ code, qty, choices, unit, status: 'BiBo' })
      continue
    }
    const cxQty = ex.cx ? ex.cx[0] : 0
    const sv = ex.sv ?? o.sv
    const keep = qty - cxQty
    const base = !confirmed ? 'ChoXacNhan' : sv != null ? 'DaPhucVu' : 'DaXacNhan'
    if (keep > 0) lines.push({ code, qty: keep, choices, unit, status: base })
    if (cxQty > 0) lines.push({ code, qty: cxQty, choices, unit, status: 'DaHuy' })
  }
  let status
  if (o.rj) status = 'BiTuChoi'
  else if (!confirmed) status = 'ChoXacNhan'
  else {
    const valid = lines.filter((l) => l.status !== 'BiBo' && l.status !== 'DaHuy')
    if (valid.length === 0) status = 'DaHuy'
    else status = valid.every((l) => l.status === 'DaPhucVu') ? 'DaPhucVu' : 'DaXacNhan'
  }
  const total = lines.filter((l) => l.status !== 'BiBo' && l.status !== 'DaHuy').reduce((s, l) => s + l.unit * l.qty, 0)
  return { status, lines, total }
}
/** Tạm tính phiên (BR-11): dòng DaXacNhan, DaPhucVu của đơn DaXacNhan, DaPhucVu */
function sessionSubtotal(s) {
  let sum = 0
  for (const o of s.od) {
    const e = expandOrder(o)
    if (e.status !== 'DaXacNhan' && e.status !== 'DaPhucVu') continue
    sum += e.lines.filter((l) => l.status === 'DaXacNhan' || l.status === 'DaPhucVu').reduce((a, l) => a + l.unit * l.qty, 0)
  }
  return sum
}

// ---------- Kiểm tra ràng buộc test (docs/05 §1) trước khi sinh ----------
const item = (code) => itemByCode.get(code)
const byName = (name) => data.menuItems.find((m) => m.name === name)
const tableByName = (name) => data.tables.find((t) => t.name === name)
const groupOf = (name) => data.optionGroups.find((g) => g.name === name)
const codeRe = /^[A-HJKMNP-Z2-9]{6}$/
const live = data.liveSessions
const liveByNo = new Map(live.map((s) => [s.tb, s]))
const allLiveOrders = live.flatMap((s) => s.od.map((o) => ({ s, o, e: expandOrder(o) })))
const pendingLive = allLiveOrders.filter((x) => x.e.status === 'ChoXacNhan')
const liveRequests = live.flatMap((s) => (s.rq ?? []).map((r) => ({ s, r })))

const thuy = (name, price, ok = true) => byName(name)?.price === price && ok
const checks = [
  [data.categories.length === 6, '6 danh mục'],
  [data.menuItems.length === 50, '50 món'],
  [data.menuItems.every((m, i) => m.code === `M${String(i + 1).padStart(3, '0')}`) && !itemByCode.has('M051'), 'mã món M001–M050 liên tục, M051 chưa có (TC-31)'],
  [data.menuItems.every((m) => m.price > 0 && m.price % 1000 === 0), 'giá món bội số 1.000, lớn hơn 0 (BR-16)'],
  [data.optionGroups.every((g) => g.choices.every((c) => c.price >= 0 && c.price % 1000 === 0)), 'giá lựa chọn bội số 1.000, từ 0'],
  [data.optionGroups.every((g) => (g.type === 'ChonMot' ? g.max === 1 : g.max >= 1 && g.max <= 10 && g.max <= g.choices.length)), 'số chọn tối đa hợp lệ (BR-04)'],
  [data.optionGroups.every((g) => g.choices.filter((c) => c.default).length <= (g.type === 'ChonMot' ? 1 : 0)), 'chỉ nhóm chọn một có tối đa 1 mặc định'],
  [!groupOf('Mức đá'), 'chưa có nhóm "Mức đá" (TC-31)'],
  [!byName('Cà phê sữa đá'), 'chưa có món "Cà phê sữa đá" (TC-31)'],
  [data.menuItems.every((m) => m.groups.every((k) => groupByKey.has(k)) && itemByCode.get(m.code).image === `${m.code}.webp`), 'nhóm của món tồn tại, ảnh {mã}.webp'],
  [thuy('Gỏi cuốn tôm thịt', 45000), 'Gỏi cuốn tôm thịt 45.000'],
  [thuy('Bánh xèo miền Tây', 75000, byName('Bánh xèo miền Tây').groups.length === 0), 'Bánh xèo miền Tây 75.000, không tùy chọn'],
  [thuy('Cơm chiên dương châu', 65000, byName('Cơm chiên dương châu').groups.join() === 'THEM_COM'), 'Cơm chiên dương châu 65.000, nhóm Thêm'],
  [(() => { const g = groupByKey.get('THEM_COM'); return g.name === 'Thêm' && g.type === 'ChonNhieu' && g.max === 2 && g.choices.map((c) => `${c.name}:${c.price}`).join() === 'Trứng ốp la:10000,Lạp xưởng:15000,Chả lụa:12000' })(), 'nhóm Thêm: chọn nhiều tối đa 2, Trứng ốp la +10.000, Lạp xưởng +15.000, Chả lụa +12.000'],
  [thuy('Mì xào hải sản', 85000, byName('Mì xào hải sản').groups.join() === 'MUC_CAY'), 'Mì xào hải sản 85.000, nhóm Mức cay'],
  [(() => { const g = groupByKey.get('MUC_CAY'); return g.name === 'Mức cay' && g.type === 'ChonMot' && g.required && !g.choices.some((c) => c.default) && g.choices.map((c) => `${c.name}:${c.price}`).join() === 'Không cay:0,Cay vừa:0,Cay nhiều:0' })(), 'nhóm Mức cay: chọn một, bắt buộc, không mặc định, đều +0'],
  [thuy('Trà tắc', 20000, byName('Trà tắc').groups.join() === 'SIZE'), 'Trà tắc 20.000, nhóm Size'],
  [(() => { const g = groupByKey.get('SIZE'); return g.name === 'Size' && g.type === 'ChonMot' && g.required && g.choices.map((c) => `${c.name}:${c.price}:${!!c.default}`).join() === 'M:0:true,L:5000:false' })(), 'nhóm Size: bắt buộc, mặc định M, L +5.000'],
  [thuy('Bia Sài Gòn Special', 22000, byName('Bia Sài Gòn Special').unit === 'lon'), 'Bia Sài Gòn Special 22.000/lon'],
  [thuy('Khoai tây chiên', 45000, byName('Khoai tây chiên').soldOut === 'HetToiKhiMoLai'), 'Khoai tây chiên 45.000 đang hết'],
  [data.menuItems.filter((m) => m.soldOut).length === 1, 'đúng 1 món đang hết (NFR-07)'],
  [data.optionGroups.every((g) => g.choices.every((c) => !c.soldOut)), 'không có lựa chọn đang hết'],
  [data.tables.length === 20 && data.tables.every((t, i) => t.no === i + 1 && t.name === `Bàn ${String(i + 1).padStart(2, '0')}`), '20 bàn Bàn 01–Bàn 20'],
  [data.tables.every((t) => t.zone === (t.no <= 12 ? 'Trong nhà' : 'Ngoài sân') && t.capacity >= 1 && t.capacity <= 20), 'khu Trong nhà 01–12, Ngoài sân 13–20; sức chứa 1–20'],
  [data.tables.every((t) => codeRe.test(t.code)) && new Set(data.tables.map((t) => t.code)).size === 20, 'mã bàn 6 ký tự A–Z, 2–9 bỏ O, I, L, không trùng (BR-01)'],
  [!data.tables.some((t) => t.code === 'ABCDEF'), 'không bàn nào có mã ABCDEF (TC-02)'],
  [tableByName('Bàn 05').code === 'K7M2QX' && tableByName('Bàn 08').code === 'P9C4WV' && tableByName('Bàn 12').code === 'R4TZ8N' && tableByName('Bàn 14').code === 'M3XH7B' && tableByName('Bàn 20').code === 'H3WP6D', 'mã bàn 05, 08, 12, 14, 20 đúng 05 §1'],
  [data.tables.filter((t) => t.active === false).map((t) => t.no).join() === '20', 'chỉ Bàn 20 đang tắt'],
  [!tableByName('Bàn 21'), 'chưa có Bàn 21 (TC-37)'],
  // Trạng thái lúc nạp (NFR-07, 05 §1)
  [live.length >= 6 && live.length <= 8, '6–8 bàn đang mở phiên'],
  [!liveByNo.has(5) && !liveByNo.has(12) && !liveByNo.has(20), 'Bàn 05, 12 trống; Bàn 20 không có phiên'],
  [new Set(live.map((s) => s.tb)).size === live.length, 'mỗi bàn tối đa một phiên đang mở (BR-02)'],
  [pendingLive.length === 2 && pendingLive.filter((x) => x.o.t <= -10).length === 1, '2 đơn chờ xác nhận, 1 đơn chờ hơn 10 phút'],
  [(() => { const s = liveByNo.get(8); return s && s.od.length === 1 && expandOrder(s.od[0]).status === 'ChoXacNhan' && s.od[0].t === -11 })(), 'Bàn 08: 1 đơn chờ xác nhận gửi 11 phút trước'],
  [liveRequests.filter((x) => x.r.ty === 'G' && x.r.h == null).length === 1 && liveRequests.some((x) => x.s.tb === 14 && x.r.ty === 'G' && x.r.r === 'ThemDa' && x.r.h == null && x.r.t === -4), 'đúng 1 yêu cầu gọi nhân viên đang chờ: Bàn 14 Thêm đá 4 phút'],
  [allLiveOrders.every((x) => x.o.it.every(([code]) => !item(code).soldOut && !item(code).hidden)), 'đơn đang mở không có món đang hết, món ẩn'],
  [allLiveOrders.every((x) => x.o.it.every(([, , , ex]) => !ex?.rm || ex.rm[0] !== 'HetMon')), 'không bỏ món lý do Hết món trong phiên đang mở (BR-10)'],
  [allLiveOrders.every((x) => x.o.it.every(([code, qty, ch]) => qty >= 1 && qty <= 20 && !choiceError(code, ch))), 'dòng đơn đang mở đúng BR-03, BR-04'],
  [live.every((s) => s.od.filter((o) => o.cf === 'a').every((o) => s.od.some((p) => p.t < o.t && (p.s === 'N' || typeof p.cf === 'number')))), 'đơn tự xác nhận chỉ khi phiên đã có đơn được xác nhận (BR-08)'],
]

// Đơn chuẩn Bàn 05 và các số test tính sẵn (05 §1, 07 §3)
const std = [['M001', 2], ['M011', 1, ['TC_TRUNG', 'TC_LAP']], ['M036', 2, ['SZ_L']]]
const stdTotal = std.reduce((s, [c, q, ch]) => s + lineTotal(c, q, ch), 0)
const stdAfterRemove = stdTotal - lineTotal('M036', 2, ['SZ_L'])
const beer4 = lineTotal('M043', 4)
const sessionStd = stdAfterRemove + beer4
checks.push(
  [lineTotal('M011', 1, ['TC_TRUNG', 'TC_LAP']) === 90000, 'TC-04 Cơm chiên + Trứng + Lạp xưởng = 90.000'],
  [lineTotal('M036', 2, ['SZ_L']) === 50000, 'TC-04 2 Trà tắc size L = 50.000'],
  [stdTotal === 230000, 'Đơn chuẩn 230.000'],
  [stdAfterRemove === 180000, 'Đơn chuẩn bỏ Trà tắc 180.000 (TC-19)'],
  [beer4 === 88000 && sessionStd === 268000, '4 Bia 88.000; Phiên chuẩn 268.000 (TC-12, TC-16, TC-22)'],
  [300000 - sessionStd === 32000 && sessionStd - 200000 === 68000, 'Tiền thối 32.000 (TC-27), còn thiếu 68.000 (TC-29)'],
  [sessionStd - lineTotal('M043', 1) === 246000 && lineTotal('M043', 3) === 66000, 'Hủy 1 Bia: dòng 66.000, tạm tính 246.000 (TC-30)'],
  [lineTotal('M010', 2) === 150000, '2 Bánh xèo 150.000 (TC-26)'],
  [lineTotal('M036', 1, ['SZ_M']) === 20000, 'Trà tắc size M 20.000 (TC-35)']
)

const failed = checks.filter(([ok]) => !ok)
if (failed.length) {
  console.error('Dữ liệu viết tay không khớp ràng buộc test:\n' + failed.map(([, m]) => '  - ' + m).join('\n'))
  process.exit(1)
}

// ---------- Tham số ----------
const SLOTS = 89 // ô ngày lịch sử d = -89..-1; d = 0 là hôm nay (giờ tương đối theo phút)
const BASE_SESSIONS_PER_DAY = 14.3
// Hệ số theo "vai thứ" của ô ngày (1 = Thứ Hai … 7 = Chủ nhật), 0 = ô lẻ không ánh xạ (docs/06 §5.3)
const roleFactor = { 0: 1.0, 1: 0.8, 2: 0.78, 3: 0.82, 4: 0.9, 5: 1.15, 6: 1.45, 7: 1.35 }
const roleOf = (d) => (d <= -1 && d >= -84 ? ((-d - 1) % 7) + 1 : 0)
// Giờ mở phiên, đông 11–13h và 18–21h (NFR-07)
const hourWeights = [[9, 0.5], [10, 0.8], [11, 2.4], [12, 2.6], [13, 1.0], [14, 0.4], [15, 0.35], [16, 0.5], [17, 1.0], [18, 2.4], [19, 2.8], [20, 2.0], [21, 0.5]]
const isPeak = (min) => (min >= 660 && min < 810) || (min >= 1080 && min < 1260)
const LAST_CLOSE = 23 * 60 + 30

const pools = {
  lunch: [['M010', 3], ['M011', 3], ['M012', 1.5], ['M013', 2.5], ['M014', 1.5], ['M015', 2.5], ['M016', 2.5], ['M017', 1.2], ['M018', 1], ['M023', 1.2]],
  nhau: [['M001', 2.5], ['M002', 1.5], ['M003', 1.5], ['M004', 1.2], ['M005', 2], ['M006', 1], ['M007', 1.2], ['M008', 1], ['M009', 2.5], ['M019', 2], ['M020', 1.8], ['M021', 1.5], ['M022', 1.2], ['M024', 1.5], ['M023', 2], ['M010', 1.5], ['M013', 1]],
  hotpot: [['M025', 3], ['M026', 2], ['M027', 1.5], ['M028', 1.5], ['M029', 1]],
  coffee: [['M030', 3], ['M031', 2.5], ['M032', 3], ['M033', 1.5], ['M034', 1], ['M035', 1]],
  tea: [['M036', 4], ['M037', 2.5], ['M038', 2], ['M039', 2], ['M040', 1.5], ['M041', 1.5], ['M042', 1.5]],
  beer: [['M043', 4], ['M044', 2.5], ['M045', 2], ['M046', 3], ['M047', 1.5], ['M048', 2]],
  soft: [['M049', 2], ['M050', 1.5]],
  snack: [['M001', 2], ['M003', 2], ['M006', 1], ['M009', 1.5], ['M002', 1]],
}
// Món có trong lịch sử theo ngày: Khoai tây chiên hết từ 3 ngày nay; Lẩu cá kèo (món mùa) ẩn từ 45 ngày nay
const availableOn = (code, d) => !(code === 'M003' && d >= -3) && !(code === 'M029' && d > -45)
const guestNames = ['Anh Tuấn', 'Chị Hoa', 'Anh Hải', 'Chị Thảo', 'Bạn Nam', 'Anh Phong', 'Chị Ngọc', 'Bạn Vy', 'Anh Khánh', 'Chị Trang', 'Anh Lộc', 'Bạn Duy', 'Chị My', 'Anh Bình', 'Bạn Quỳnh', 'Anh Sơn']
const rmNotes = ['Khách đổi ý trước khi làm', 'Bếp quá tải món nướng', 'Khách gọi trùng với đơn khác']
const cancelReasons = ['Khách đổi ý', 'Lên món chậm, khách không dùng nữa', 'Gọi nhầm món', 'Món không đúng yêu cầu']
const requestReasons = [['ThemDa', 4], ['LayChenBat', 3], ['DonBan', 2], ['TuVanMon', 1], ['Khac', 1]]
const requestNotes = ['Xin thêm khăn lạnh', 'Mở giúp quạt', 'Lấy thêm chén nước chấm', 'Hỏi mật khẩu wifi']
const rejectReasons = [['BanKhongCoKhach', 3], ['HetMon', 1], ['Khac', 1]]
const staffAt = (min) => (min < 900 ? weighted([['nhanvien', 6], ['nhanvien3', 4]]) : weighted([['nhanvien2', 55], ['nhanvien', 25], ['nhanvien3', 20]]))

function pickChoices(code) {
  const out = []
  for (const gk of item(code).groups) {
    const g = groupByKey.get(gk)
    if (g.type === 'ChonMot') {
      const def = g.choices.find((c) => c.default)
      if (g.required) {
        if (def) out.push(chance(0.65) ? def.key : pick(g.choices.filter((c) => !c.default)).key)
        else out.push(gk === 'MUC_CAY' ? weighted([['MC_KHONG', 3], ['MC_VUA', 4], ['MC_NHIEU', 2]]) : pick(g.choices).key)
      } else if (chance(0.35)) out.push(pick(g.choices).key)
    } else {
      const k = Math.min(g.max, weighted([[0, 50], [1, 35], [2, 15]]))
      const pool = [...g.choices]
      for (let i = 0; i < k; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].key)
      out.sort((a, b) => g.choices.findIndex((c) => c.key === a) - g.choices.findIndex((c) => c.key === b))
    }
  }
  return out
}
/** Chọn k món khác nhau từ một nhóm có trọng số, bỏ món không bán vào ngày d */
function pickItems(pool, k, d, exclude = new Set()) {
  const avail = pool.filter(([c]) => availableOn(c, d) && !exclude.has(c))
  const out = []
  for (let i = 0; i < k && avail.length; i++) {
    const c = weighted(avail)
    out.push(c)
    avail.splice(avail.findIndex(([x]) => x === c), 1)
  }
  return out
}
const line = (code, qty) => {
  const ch = pickChoices(code)
  return ch.length ? [code, qty, ch] : [code, qty]
}

/** Món của đơn đầu tiên theo kiểu khách */
function firstOrderItems(kind, d) {
  const its = []
  if (kind === 'cafe') {
    for (const c of pickItems([...pools.coffee, ...pools.tea], randInt(1, 3), d)) its.push(line(c, weighted([[1, 5], [2, 4], [3, 1]])))
    if (chance(0.3)) for (const c of pickItems(pools.snack, 1, d)) its.push(line(c, 1))
  } else if (kind === 'lunch') {
    for (const c of pickItems(pools.lunch, randInt(1, 3), d)) its.push(line(c, chance(0.3) ? 2 : 1))
    for (const c of pickItems([...pools.tea, ...pools.coffee, ...pools.soft], randInt(1, 2), d)) its.push(line(c, randInt(1, 3)))
    if (chance(0.25)) for (const c of pickItems(pools.snack, 1, d)) its.push(line(c, 1))
  } else if (kind === 'family') {
    for (const c of pickItems(pools.lunch, randInt(2, 4), d)) its.push(line(c, chance(0.25) ? 2 : 1))
    if (chance(0.3)) for (const c of pickItems(pools.hotpot, 1, d)) its.push(line(c, 1))
    for (const c of pickItems([...pools.tea, ...pools.soft], randInt(1, 3), d)) its.push(line(c, randInt(1, 4)))
  } else {
    for (const c of pickItems(pools.nhau, randInt(2, 4), d)) its.push(line(c, chance(0.15) ? 2 : 1))
    if (chance(0.45)) for (const c of pickItems(pools.hotpot, 1, d)) its.push(line(c, 1))
    for (const c of pickItems(pools.beer, 1, d)) its.push(line(c, randInt(4, 12)))
    if (chance(0.3)) for (const c of pickItems([...pools.soft, ...pools.tea], 1, d)) its.push(line(c, randInt(1, 3)))
  }
  return its
}
/** Món của đơn gọi thêm */
function moreOrderItems(kind, d, prev) {
  const its = []
  if (kind === 'nhau') {
    if (chance(0.8)) {
      const beerCode = prev.flatMap((o) => o.it).map(([c]) => c).find((c) => item(c).category === 'BI') ?? pickItems(pools.beer, 1, d)[0]
      its.push([beerCode, randInt(4, 10)])
    }
    if (its.length === 0 || chance(0.5)) for (const c of pickItems(pools.nhau, 1, d)) its.push(line(c, 1))
  } else if (kind === 'cafe') {
    for (const c of pickItems([...pools.coffee, ...pools.tea], randInt(1, 2), d)) its.push(line(c, randInt(1, 2)))
  } else {
    if (chance(0.6)) for (const c of pickItems([...pools.tea, ...pools.soft], 1, d)) its.push(line(c, randInt(1, 2)))
    if (its.length === 0 || chance(0.4)) for (const c of pickItems(kind === 'family' ? pools.lunch : pools.snack, 1, d)) its.push(line(c, 1))
  }
  return its
}
const sessionKind = (open) => {
  const h = Math.floor(open / 60)
  if (h < 11 || (h >= 14 && h < 17)) return 'cafe'
  if (h < 14) return 'lunch'
  return chance(0.7) ? 'nhau' : 'family'
}
const duration = { cafe: [30, 90], lunch: [35, 65], family: [50, 90], nhau: [70, 150] }

/** Tạo một phiên bàn (giờ là phút trong ngày); trả về null nếu không xếp được */
function makeSession(d, open, tb) {
  const kind = sessionKind(open)
  const peak = isPeak(open)
  const [dMin, dMax] = duration[kind]
  let close = Math.min(open + randInt(dMin, dMax), LAST_CLOSE)
  const od = []

  // Phiên chỉ có một đơn khách gửi rồi bị từ chối → phiên tự hủy (BR-02)
  if (chance(0.018)) {
    const o = { t: open, it: firstOrderItems(kind, d) }
    const r = weighted(rejectReasons)
    o.rj = r === 'Khac' ? [r, randInt(1, 5), 'Khách gọi nhầm bàn'] : [r, randInt(1, 5)]
    o.by = staffAt(open)
    return { kind, cancelled: true, od, s: { d, tb, od: [o] } }
  }

  // Đơn đầu: khách tự gọi hoặc nhân viên gọi hộ
  const first = { t: open, it: firstOrderItems(kind, d) }
  const firstStaff = chance(0.13)
  if (firstStaff) {
    first.s = 'N'
    first.by = staffAt(open)
  } else {
    if (chance(0.4)) first.g = pick(guestNames)
    first.cf = peak ? randInt(1, 6) : randInt(1, 3)
    first.by = staffAt(open)
  }
  od.push(first)
  // Điện thoại thứ hai gửi trước khi đơn đầu được xác nhận (cùng chờ); đôi khi là đơn trùng bị từ chối
  if (!firstStaff && chance(0.06)) {
    first.cf = Math.max(first.cf, 2)
    const t2 = open + 1
    const confirmAt = open + first.cf
    if (chance(0.3)) {
      od.push({ t: t2, it: first.it.map((x) => [...x]), rj: ['DonTrung', confirmAt - t2], by: first.by })
    } else {
      const o2 = { t: t2, it: moreOrderItems(kind, d, od), cf: confirmAt - t2, by: first.by }
      if (chance(0.5)) o2.g = pick(guestNames)
      od.push(o2)
    }
  }
  // Bỏ món khi xác nhận đơn đầu (khách gửi, nhân viên xác nhận)
  for (const o of od) {
    if (typeof o.cf !== 'number') continue
    for (let i = 0; i < o.it.length; i++) {
      const valid = o.it.filter((x) => !x[3]?.rm).length
      if (valid > 1 && chance(0.025)) {
        const ex = chance(0.55) ? { rm: ['HetMon'] } : { rm: ['Khac', pick(rmNotes)] }
        o.it[i] = [o.it[i][0], o.it[i][1], o.it[i][2] ?? [], ex]
      }
    }
  }
  // Gọi thêm
  const moreCount = kind === 'nhau' ? weighted([[0, 25], [1, 40], [2, 25], [3, 10]]) : chance(kind === 'family' ? 0.35 : 0.3) ? 1 : 0
  let tPrev = od[od.length - 1].t + (first.cf ?? 0)
  const payCancelAt = kind === 'nhau' && moreCount >= 1 && chance(0.08) ? randInt(1, moreCount) : 0
  const rq = []
  for (let i = 1; i <= moreCount; i++) {
    const t = tPrev + randInt(10, 35)
    if (t > close - 12) break
    if (i === payCancelAt) rq.push({ ty: 'T', t: t - randInt(2, 5), pm: chance(0.6) ? 'ChuyenKhoan' : 'TienMat', cx: 1 })
    const its = moreOrderItems(kind, d, od)
    const o = { t, it: its }
    if (chance(0.85)) {
      o.cf = 'a'
      if (chance(0.25)) o.g = pick(guestNames)
    } else {
      o.s = 'N'
      o.by = staffAt(t)
    }
    od.push(o)
    tPrev = t
  }
  // Phục vụ: mọi dòng còn hiệu lực đã phục vụ sau sv phút kể từ lúc gửi
  for (const o of od) {
    if (o.rj) continue
    const hasFood = o.it.some(([c]) => !['CF', 'NU', 'BI'].includes(item(c).category))
    const confirmLag = typeof o.cf === 'number' ? o.cf : 0
    o.sv = confirmLag + (hasFood ? randInt(8, peak ? 22 : 15) : randInt(2, 8))
  }
  const lastServe = Math.max(...od.filter((o) => !o.rj).map((o) => o.t + o.sv))
  close = Math.min(Math.max(close, lastServe + randInt(10, 25)), LAST_CLOSE)
  if (close <= lastServe) return null
  // Quản lý hủy món đã xác nhận
  for (const o of od) {
    if (o.rj) continue
    for (let i = 0; i < o.it.length; i++) {
      const [c, q, ch = [], ex = {}] = o.it[i]
      if (ex.rm || !chance(0.007)) continue
      const m = randInt(5, 25)
      if (o.t + m >= close) continue
      o.it[i] = [c, q, ch, { ...ex, cx: [q > 1 ? randInt(1, q) : 1, pick(cancelReasons), m, 'quanly'] }]
    }
  }
  // Gọi nhân viên
  const callCount = chance(0.4) ? (chance(0.2) ? 2 : 1) : 0
  for (let i = 0; i < callCount; i++) {
    const t = randInt(open + 3, Math.max(open + 3, close - 8))
    const r = weighted(requestReasons)
    const req = { ty: 'G', t, r, h: peak ? randInt(1, 6) : randInt(1, 4) }
    if (r === 'Khac') req.n = pick(requestNotes)
    const by = staffAt(t)
    req.by = by
    rq.push(req)
  }
  // Thanh toán
  const by = staffAt(close)
  const pm = chance(0.42) ? 'TienMat' : 'ChuyenKhoan'
  const vat = chance(0.06)
  if (chance(0.65)) {
    const t = close - randInt(2, 8)
    if (t > tPrev + 3) {
      const req = { ty: 'T', t, pm: chance(0.9) ? pm : pm === 'TienMat' ? 'ChuyenKhoan' : 'TienMat' }
      if (vat) req.vat = 1
      if (chance(0.35)) {
        req.h = Math.min(randInt(1, 3), close - t)
        req.by = by
      }
      rq.push(req)
    }
  }
  rq.sort((a, b) => a.t - b.t)
  const s = { d, tb, od, c: close, by }
  const total = sessionSubtotal(s)
  if (pm === 'TienMat') {
    const options = [[total, 3], [Math.ceil(total / 50000) * 50000, 3], [Math.ceil(total / 100000) * 100000, 3], [Math.ceil(total / 500000) * 500000, 2]]
    s.pm = ['TienMat', Math.max(total, weighted(options))]
  } else s.pm = ['ChuyenKhoan']
  if (vat) s.vat = 1
  if (rq.length) s.rq = rq
  return { kind, cancelled: false, od, s }
}

// ---------- Xếp bàn ----------
const overlaps = (list, a, b) => list.some(([x, y]) => a < y && b > x)
function chooseTable(kind, d, occ, a, b) {
  const cands = data.tables.filter((t) => (t.active !== false || d <= -30) && !overlaps(occ.get(t.no) ?? [], a, b))
  if (!cands.length) return null
  return weighted(cands.map((t) => {
    let w = 1
    if (kind === 'nhau') w = (t.zone === 'Ngoài sân' ? 2.2 : 1) * (t.capacity >= 6 ? 1.6 : 1)
    if (kind === 'lunch' || kind === 'cafe') w = t.zone === 'Trong nhà' ? 1.8 : 0.8
    if (kind === 'cafe' && t.capacity <= 2) w *= 1.8
    return [t, w]
  })).no
}
const occupy = (occ, no, a, b) => occ.set(no, [...(occ.get(no) ?? []), [a, b]])

// Chuỗi giờ trong file: lịch sử dạng "HH:mm", hôm nay dạng số phút so với lúc nạp
function serialize(s, toTime) {
  const out = { d: s.d, tb: s.tb, od: s.od.map((o) => {
    const x = { t: toTime(o.t) }
    if (o.s) x.s = o.s
    if (o.g) x.g = o.g
    if (o.cf != null) x.cf = o.cf
    if (o.rj) x.rj = o.rj
    if (o.by) x.by = o.by
    if (o.sv != null && !o.rj) x.sv = o.sv
    x.it = o.it.map((l) => (l[3] ? l : l[2]?.length ? l.slice(0, 3) : l.slice(0, 2)))
    return x
  }) }
  if (s.c != null) {
    out.c = toTime(s.c)
    out.pm = s.pm
    if (s.vat) out.vat = 1
    out.by = s.by
  }
  if (s.rq) out.rq = s.rq.map((r) => ({ ...r, t: toTime(r.t) }))
  if (s.d === 0) delete out.d
  return out
}

const sessions = []
const stats = { sessions: 0, cancelled: 0, orders: 0, byStatus: {}, staffOrders: 0, autoOrders: 0, lines: 0, removed: 0, cancelledLines: 0, revenue: 0, closed: 0, cash: 0, transfer: 0, vat: 0, reqG: 0, reqT: 0, reqTAuto: 0, reqTCancelled: 0, kinds: {} }
function record(s, kind) {
  stats.sessions++
  stats.kinds[kind] = (stats.kinds[kind] ?? 0) + 1
  for (const o of s.od) {
    const e = expandOrder(o)
    stats.orders++
    stats.byStatus[e.status] = (stats.byStatus[e.status] ?? 0) + 1
    if (o.s === 'N') stats.staffOrders++
    if (o.cf === 'a') stats.autoOrders++
    stats.lines += e.lines.length
    stats.removed += e.lines.filter((l) => l.status === 'BiBo').length
    stats.cancelledLines += e.lines.filter((l) => l.status === 'DaHuy').length
    for (const [code, qty, ch] of o.it) {
      const err = choiceError(code, ch ?? [])
      if (err || qty < 1 || qty > 20) throw new Error('Dòng sai: ' + (err ?? `${code} số lượng ${qty}`))
    }
    if (o.it.length > 30) throw new Error('Đơn quá 30 dòng')
  }
  if (s.od.every((o) => o.rj)) stats.cancelled++
  else {
    stats.closed++
    stats.revenue += sessionSubtotal(s)
    if (s.pm[0] === 'TienMat') stats.cash++
    else stats.transfer++
    if (s.vat) stats.vat++
  }
  for (const r of s.rq ?? []) {
    if (r.ty === 'G') stats.reqG++
    else {
      stats.reqT++
      if (r.cx) stats.reqTCancelled++
      else if (r.h == null) stats.reqTAuto++
    }
  }
}

// ---------- Lịch sử d = -89..-1 ----------
const daily = []
for (let d = -SLOTS; d <= -1; d++) {
  const n = Math.round(BASE_SESSIONS_PER_DAY * roleFactor[roleOf(d)] * (0.85 + rand() * 0.3))
  const occ = new Map()
  const day = []
  for (let i = 0; i < n * 3 && day.length < n; i++) {
    const h = weighted(hourWeights)
    const open = h * 60 + randInt(0, 59)
    if (open > 21 * 60 + 40) continue
    const made = makeSession(d, open, 0)
    if (!made) continue
    const s = made.s
    const end = s.c ?? Math.max(...s.od.map((o) => o.t + (o.rj?.[1] ?? 0)))
    const tb = chooseTable(made.kind, d, occ, open - 5, end + 10)
    if (!tb) continue
    s.tb = tb
    occupy(occ, tb, open - 5, end + 10)
    day.push({ s, kind: made.kind })
  }
  day.sort((a, b) => a.s.od[0].t - b.s.od[0].t || a.s.tb - b.s.tb)
  let rev = 0
  for (const { s, kind } of day) {
    record(s, kind)
    if (!s.od.every((o) => o.rj)) rev += sessionSubtotal(s)
    sessions.push(serialize(s, hhmm))
  }
  daily.push({ d, n: day.length, rev })
}
const histStats = JSON.parse(JSON.stringify(stats))

// ---------- Hôm nay: các phiên đã đóng trước lúc nạp (giờ tương đối, phút) ----------
// Sinh như một ngày có "bây giờ" là 20:00 rồi đổi sang số phút so với lúc nạp.
const NOW = 20 * 60
const todayOcc = new Map()
for (const s of live) {
  const open = Math.min(...s.od.map((o) => o.t))
  occupy(todayOcc, s.tb, NOW + open - 15, 24 * 60)
}
occupy(todayOcc, 5, 0, 24 * 60) // Bàn 05, 12 không có phiên nào hôm nay để test bắt đầu từ bàn sạch
occupy(todayOcc, 12, 0, 24 * 60)
const todaySessions = []
for (let i = 0; i < 60 && todaySessions.length < 8; i++) {
  const open = NOW - randInt(70, 360)
  const made = makeSession(0, open, 0)
  if (!made || made.cancelled) continue
  const s = made.s
  if (s.c > NOW - 10) continue
  const tb = chooseTable(made.kind, 0, todayOcc, open - 5, s.c + 10)
  if (!tb || tb === 20) continue
  s.tb = tb
  occupy(todayOcc, tb, open - 5, s.c + 10)
  todaySessions.push({ s, kind: made.kind })
}
todaySessions.sort((a, b) => a.s.od[0].t - b.s.od[0].t || a.s.tb - b.s.tb)
let todayRevenue = 0
for (const { s, kind } of todaySessions) {
  record(s, kind)
  todayRevenue += sessionSubtotal(s)
  sessions.push(serialize(s, (m) => m - NOW))
}

// ---------- Phiên đang mở (liveSessions): thống kê đối chiếu ----------
const liveStats = live.map((s) => ({ tb: s.tb, subtotal: sessionSubtotal(s), orders: s.od.length, pending: s.od.filter((o) => expandOrder(o).status === 'ChoXacNhan').length }))
let liveOrders = 0
let liveLines = 0
for (const s of live) for (const o of s.od) {
  liveOrders++
  liveLines += expandOrder(o).lines.length
}

// ---------- Ghi file: phần viết tay giữ dạng đẹp, mỗi phiên một dòng ----------
// Phần viết tay: mỗi danh mục, món, bàn, lựa chọn một dòng; nhóm tùy chọn một khối nhỏ
const one = (x) => '{ ' + Object.entries(x).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v).replace(/","/g, '", "')}`).join(', ') + ' }'
const arr = (xs, fmt, indent = '    ') => '[\n' + xs.map((x) => indent + fmt(x)).join(',\n') + '\n' + indent.slice(2) + ']'
const groupFmt = ({ choices, ...head }) => one(head).replace(/ \}$/, ', "choices": ' + arr(choices, one, '      ') + ' }')
let out = '{\n  "$comment": ' + JSON.stringify(data.$comment)
out += ',\n  "categories": ' + arr(data.categories, one)
out += ',\n  "optionGroups": ' + arr(data.optionGroups, groupFmt)
out += ',\n  "menuItems": ' + arr(data.menuItems, one)
out += ',\n  "tables": ' + arr(data.tables, one)
out += ',\n  "liveSessions": [\n' + live.map((s) => '    ' + JSON.stringify(s)).join(',\n') + '\n  ]'
out += ',\n  "sessions": [\n' + sessions.map((s) => '    ' + JSON.stringify(s)).join(',\n') + '\n  ]\n}\n'
JSON.parse(out) // bảo đảm JSON hợp lệ
writeFileSync(file, out, 'utf8')

// ---------- In số đối chiếu ----------
const totalOrders = stats.orders + liveOrders
const p = (n, of) => ((n * 100) / of).toFixed(1) + '%'
const customerOrders = stats.orders - stats.staffOrders
console.log('Đã ghi', file)
console.log(`Kích thước: ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`)
console.log(`Phiên trong sessions: ${stats.sessions} (lịch sử ${histStats.sessions}, hôm nay đã đóng ${todaySessions.length}); đã đóng ${stats.closed}, tự hủy ${stats.cancelled}; kiểu: ${JSON.stringify(stats.kinds)}`)
console.log(`Phiên đang mở (liveSessions): ${live.length}, ${liveOrders} đơn, ${liveLines} dòng → tổng phiên ${stats.sessions + live.length}, tổng đơn ${totalOrders}`)
console.log(`Đơn trong sessions: ${stats.orders} theo trạng thái ${JSON.stringify(stats.byStatus)}; nhân viên gọi hộ ${stats.staffOrders} (${p(stats.staffOrders, stats.orders)}), tự xác nhận ${stats.autoOrders} (${p(stats.autoOrders, customerOrders)} đơn khách)`)
console.log(`Dòng đơn: ${stats.lines}; bị bỏ ${stats.removed}; đã hủy ${stats.cancelledLines}`)
console.log(`Yêu cầu: gọi nhân viên ${stats.reqG}; thanh toán ${stats.reqT} (tự xử lý khi đóng ${stats.reqTAuto}, tự hủy khi gọi thêm ${stats.reqTCancelled})`)
console.log(`Thanh toán: tiền mặt ${stats.cash}, chuyển khoản ${stats.transfer}, cần HĐ GTGT ${stats.vat}`)
console.log(`Doanh thu lịch sử 89 ngày: ${vnd(histStats.revenue)} / ${histStats.closed} phiên → TB ${vnd(Math.round(histStats.revenue / histStats.closed))}`)
console.log(`Hôm nay đã đóng: ${todaySessions.length} phiên, doanh thu ${vnd(todayRevenue)}`)
console.log(`Ngày ít nhất/nhiều nhất: ${Math.min(...daily.map((x) => x.n))}/${Math.max(...daily.map((x) => x.n))} phiên`)
console.log('Phiên đang mở:', liveStats.map((x) => `Bàn ${String(x.tb).padStart(2, '0')} ${vnd(x.subtotal)}${x.pending ? ` (${x.pending} đơn chờ)` : ''}`).join('; '))
console.log(`Tạm tính các phiên đang mở: ${vnd(liveStats.reduce((s, x) => s + x.subtotal, 0))}`)
console.log('Đơn chờ xác nhận:', pendingLive.map((x) => `Bàn ${String(x.s.tb).padStart(2, '0')} ${vnd(x.e.total)} gửi ${-x.o.t} phút trước`).join('; '))
console.log('Ba phiên lịch sử đầu tiên:', sessions.filter((s) => s.c != null).slice(0, 3).map((s) => `d${s.d} Bàn ${String(s.tb).padStart(2, '0')} ${s.od[0].t}–${s.c}: ${vnd(sessionSubtotal(s))}`).join('; '))
