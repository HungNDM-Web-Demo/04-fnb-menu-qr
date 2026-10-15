// Sinh ảnh món mẫu (minh họa phẳng, 800×800, WebP ≤ 60 KB) cho các món trong src/mock/seed/demo-data.json
// vào public/seed/menu/{maMon}.webp (tên file lấy từ `menuItems[].image`).
// Mỗi món vẽ bằng SVG hình học theo một "khuôn" (đĩa chả giò, đĩa gỏi, bánh xèo, cơm tấm, tô bún, mì xào,
// gà nướng, sườn, tộ cá kho, nồi lẩu, đĩa cơm chiên, tô canh, ly cà phê, ly trà, trái dừa, lon và chai…)
// biến thể theo màu và chi tiết từng món; nền màu nhạt theo `categories[].color`. Không chữ trên ảnh.
// Xác định: không ngẫu nhiên tự do (bộ sinh số có hạt giống theo mã món), chạy lại cho cùng byte.
// Không ghi gì vào file JSON. Tái dùng script cùng tên của dự án 03-fnb-quan-ly-nha-hang (món ăn) và
// 02-fnb-pos-cafe (ly cà phê); thêm khuôn món miền Tây cho Quán Vườn Dừa.
//
// Chạy:      pnpm seed:images
// Tùy chọn:  --only <chuỗi>       chỉ vẽ món có mã chứa chuỗi
//            --preview <thư mục>  xuất thêm PNG để xem nhanh
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'src', 'mock', 'seed', 'demo-data.json')
const OUT_DIR = join(ROOT, 'public', 'seed', 'menu')
const S = 800
const MAX_BYTES = 60 * 1000

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ONLY = argVal('--only')
const PREVIEW = argVal('--preview')

// ============================================================ Tiện ích
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const r2 = (n) => Math.round(n * 100) / 100
function attrs(o) {
  let out = ''
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === false) continue
    out += ` ${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`
  }
  return out
}
const el = (tag, o = {}, body = '') =>
  body ? `<${tag}${attrs(o)}>${body}</${tag}>` : `<${tag}${attrs(o)}/>`
const rect = (x, y, w, h, o = {}) => el('rect', { x, y, width: w, height: h, ...o })
const circle = (cx, cy, r, o = {}) => el('circle', { cx, cy, r, ...o })
const ellipse = (cx, cy, rx, ry, o = {}) => el('ellipse', { cx, cy, rx, ry, ...o })
const path = (d, o = {}) => el('path', { d, ...o })
const g = (o, body) => el('g', o, body)
const line = (x1, y1, x2, y2, o = {}) => el('line', { x1, y1, x2, y2, ...o })
const rot = (a, x, y) => `rotate(${r2(a)} ${r2(x)} ${r2(y)})`
// Đặt một chi tiết vẽ theo tọa độ cục bộ (tâm 0,0) vào vị trí x, y, xoay a độ, phóng s lần
const at = (x, y, a = 0, s = 1) =>
  `translate(${r2(x)} ${r2(y)})${a ? ` rotate(${r2(a)})` : ''}${s !== 1 ? ` scale(${r2(s)})` : ''}`
const put = (x, y, a, s, body) => g({ transform: at(x, y, a, s) }, body)
const stroke = (color, width, extra = {}) => ({
  fill: 'none',
  stroke: color,
  'stroke-width': width,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  ...extra,
})

const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
const rgbToHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
const mix = (a, b, t) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}
const tint = (c, t) => mix(c, '#FFFFFF', t)
const shade = (c, t) => mix(c, '#000000', t)
const range = (n) => Array.from({ length: n }, (_, i) => i)
const DEG = Math.PI / 180

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return h >>> 0
}

// ============================================================ Định nghĩa dùng chung trong một ảnh
let defs = []
let uid = 0
const newId = (p) => `${p}${++uid}`
function linGrad(stops, dir = 'h') {
  const id = newId('lg')
  const [x2, y2] = dir === 'v' ? [0, 1] : [1, 0]
  defs.push(
    el(
      'linearGradient',
      { id, x1: 0, y1: 0, x2, y2 },
      stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c })).join('')
    )
  )
  return `url(#${id})`
}
// Mặt cong: trái sáng, phải tối một chút
const liq = (c, k = 0.14) =>
  linGrad([
    [0, tint(c, k)],
    [0.55, c],
    [1, shade(c, k)],
  ])
const vGrad = (top, bottom) =>
  linGrad(
    [
      [0, top],
      [1, bottom],
    ],
    'v'
  )
function clipOf(inner) {
  const id = newId('cp')
  defs.push(el('clipPath', { id }, inner))
  return `url(#${id})`
}
function blurFilter(std) {
  const id = newId('bl')
  defs.push(
    el(
      'filter',
      { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
      el('feGaussianBlur', { stdDeviation: std })
    )
  )
  return `url(#${id})`
}
let SHADOW = '#000000'
const softShadow = (cx, cy, rx, ry, op = 0.3) =>
  ellipse(cx, cy, rx, ry, { fill: SHADOW, 'fill-opacity': op, filter: blurFilter(14) })

// Rải n điểm trong elip (rx, ry) quanh (cx, cy), giữ khoảng cách tối thiểu; `h` > 0 thì vun thành ụ
// (điểm gần tâm được nâng lên). Trả về theo thứ tự từ sau ra trước để vẽ chồng đúng.
function scatter(rnd, n, cx, cy, rx, ry, minD = 0, h = 0) {
  const pts = []
  let tries = 0
  while (pts.length < n && tries < n * 80) {
    tries++
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd())
    const x = cx + Math.cos(a) * r * rx
    const y = cy + Math.sin(a) * r * ry
    if (pts.every((p) => Math.hypot(p.bx - x, (p.by - y) * (rx / ry)) >= minD))
      pts.push({ bx: x, by: y, x, y: y - h * (1 - r * r), r, t: rnd() })
  }
  return pts.sort((p, q) => p.by - q.by)
}

// ============================================================ Chi tiết thực phẩm (tọa độ cục bộ, tâm 0,0)
function leaf(len, color, vein = true) {
  const h = len * 0.42
  return (
    path(`M0 0Q${len * 0.5} ${-h} ${len} 0Q${len * 0.5} ${h} 0 0Z`, { fill: color }) +
    (vein ? path(`M6 0L${len - 8} 0`, stroke(tint(color, 0.4), Math.max(1.5, len / 22))) : '')
  )
}
// Nhánh rau thơm: vài lá xòe từ một gốc
function sprig(rnd, color = '#3F9D4A', len = 44, n = 4) {
  let out = ''
  for (let i = 0; i < n; i++) {
    const a = -150 + (i * 120) / Math.max(1, n - 1) + (rnd() - 0.5) * 20
    out += g(
      { transform: `rotate(${r2(a)})` },
      leaf(len * (0.8 + rnd() * 0.3), i % 2 ? tint(color, 0.12) : color)
    )
  }
  return out
}
// Lá rau răm (lá hẹp dài)
const narrowLeaf = (len, color) =>
  path(`M0 0Q${len * 0.5} ${-len * 0.18} ${len} 0Q${len * 0.5} ${len * 0.18} 0 0Z`, { fill: color })
// Tôm: thân cong chữ C gồm các đốt nhỏ dần, đuôi xòe; `peeled` = tôm đã lột (không đầu)
function shrimp(c = '#F07A45', o = {}) {
  const R = 26
  const P = (t, r = R) => [Math.cos(t * DEG) * r, Math.sin(t * DEG) * r]
  const n = o.peeled ? 5 : 6
  const t0 = o.peeled ? 225 : 205
  const t1 = 452
  let out = ''
  const [tx, ty] = P(t1 + 10)
  const tail = o.tail ?? shade(c, 0.12)
  out += g(
    { transform: at(tx, ty, t1 + 100) },
    path('M-2 0L22 -15Q31 -2 25 2Z', { fill: tail }) +
      path('M-2 0L22 15Q31 2 25 -2Z', { fill: tail }) +
      path('M4 0L22 0', stroke(shade(c, 0.3), 2))
  )
  if (!o.peeled) {
    for (const k of [1, 2, 3]) {
      const t = t0 + ((t1 - t0) * k) / (n - 1)
      const [x1, y1] = P(t, R - 12)
      const [x2, y2] = P(t + 6, R - 24)
      out += path(`M${r2(x1)} ${r2(y1)}L${r2(x2)} ${r2(y2)}`, stroke(shade(c, 0.15), 3))
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    const t = t0 + ((t1 - t0) * i) / (n - 1)
    const [x, y] = P(t)
    const rs = (o.peeled ? 15 : 17) - (i / (n - 1)) * 8
    const fill = o.striped && i % 2 ? shade(c, 0.2) : o.peeled && i % 2 ? tint(c, 0.25) : c
    out += circle(x, y, rs, { fill, stroke: shade(c, 0.18), 'stroke-width': 2 })
    const [hx, hy] = P(t, R + rs * 0.35)
    out += ellipse(hx, hy, rs * 0.4, rs * 0.2, {
      fill: '#FFFFFF',
      'fill-opacity': 0.45,
      transform: rot(t + 90, hx, hy),
    })
  }
  if (!o.peeled) {
    const th = t0 - 20
    const [hx, hy] = P(th, R - 1)
    out += ellipse(hx, hy, 21, 15, {
      fill: shade(c, 0.06),
      stroke: shade(c, 0.2),
      'stroke-width': 2,
      transform: rot(th + 90, hx, hy),
    })
    const [ex, ey] = P(th - 4, R + 5)
    out += circle(ex, ey, 3.2, { fill: '#2A1A15' })
    const [ax, ay] = P(th - 22, R + 2)
    out += path(`M${r2(ax)} ${r2(ay)}q-18 26 -8 60`, stroke(shade(c, 0.25), 2.4))
    out += path(`M${r2(ax)} ${r2(ay)}q-28 16 -40 44`, stroke(shade(c, 0.25), 2.4))
  }
  return out
}
function squidRing(r = 22, c = '#E9B25A') {
  return (
    ellipse(0, 0, r, r * 0.74, { fill: 'none', stroke: shade(c, 0.15), 'stroke-width': r * 0.6 }) +
    ellipse(0, -2, r, r * 0.74, { fill: 'none', stroke: c, 'stroke-width': r * 0.48 }) +
    path(
      `M${-r * 0.75} ${-r * 0.55}Q0 ${-r * 1.05} ${r * 0.75} ${-r * 0.55}`,
      stroke(tint(c, 0.45), r * 0.14)
    )
  )
}
// Miếng mực khứa vảy rồng (mực xào, lẩu)
function squidPiece(s = 30) {
  let out = path(
    `M${-s} ${-s * 0.6}Q0 ${-s * 0.9} ${s} ${-s * 0.6}Q${s * 1.1} ${s * 0.2} ${s * 0.7} ${s * 0.6}Q0 ${s * 0.8} ${-s * 0.8} ${s * 0.55}Q${-s * 1.2} 0 ${-s} ${-s * 0.6}Z`,
    {
      fill: '#FBF5EE',
      stroke: '#E8C9BB',
      'stroke-width': 2.5,
    }
  )
  for (let i = -2; i <= 2; i++) {
    out += line(
      i * s * 0.32 - s * 0.2,
      -s * 0.5,
      i * s * 0.32 + s * 0.2,
      s * 0.45,
      stroke('#EBCFC2', 2)
    )
    out += line(-s * 0.8, i * s * 0.2, s * 0.8, i * s * 0.2 + s * 0.1, stroke('#EBCFC2', 2))
  }
  return out
}
// `net`: vỏ bánh tráng rế (lưới mắt cáo giòn) thay cho vỏ trơn
function springRoll(len, w, c = '#E2A13F', fill = '#F2B8A0', net = false) {
  let out = rect(-len / 2, -w / 2, len, w, {
    rx: w / 2,
    fill: vGrad(tint(c, 0.25), shade(c, 0.18)),
  })
  if (net) {
    let mesh = ''
    for (let i = -14; i <= 14; i++) {
      const x = i * w * 0.36
      mesh += line(x - w * 0.6, -w / 2, x + w * 0.6, w / 2, stroke(tint(c, 0.5), w * 0.07))
      mesh += line(x + w * 0.6, -w / 2, x - w * 0.6, w / 2, stroke(tint(c, 0.5), w * 0.07))
    }
    out += g(
      { 'clip-path': clipOf(rect(-len / 2, -w / 2, len, w, { rx: w / 2 })) },
      rect(-len / 2, -w / 2, len, w, { fill: shade(c, 0.3), 'fill-opacity': 0.35 }) + mesh
    )
  }
  for (let i = 0; i < (net ? 0 : 7); i++) {
    const x = -len / 2 + w * 0.6 + ((len - w * 1.2) * i) / 6
    out += ellipse(x, -w * 0.12 + (i % 2) * w * 0.22, w * 0.12, w * 0.07, {
      fill: shade(c, 0.22),
      'fill-opacity': 0.6,
    })
  }
  out += rect(-len / 2 + w * 0.4, -w * 0.32, len - w * 0.8, w * 0.14, {
    rx: w * 0.07,
    fill: '#FFFFFF',
    'fill-opacity': 0.35,
  })
  if (fill) {
    out += ellipse(len / 2 - w * 0.2, 0, w * 0.3, w * 0.5, { fill: shade(c, 0.1) })
    out += ellipse(len / 2 - w * 0.18, 0, w * 0.22, w * 0.4, { fill })
    out += circle(len / 2 - w * 0.2, -w * 0.12, w * 0.07, { fill: '#7FB04A' })
  }
  return out
}
// Khối hộp nhìn chéo (đậu hũ, thịt bò lúc lắc, khúc bạch, xoài)
function cube(s, top, left, right) {
  const T = [0, -s * 0.5]
  const R = [s * 0.6, -s * 0.2]
  const B = [0, s * 0.1]
  const L = [-s * 0.6, -s * 0.2]
  const d = (pts) => 'M' + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L') + 'Z'
  const o = (c) => ({ fill: c, stroke: c, 'stroke-width': s * 0.12, 'stroke-linejoin': 'round' })
  return (
    path(d([L, B, [0, s * 0.62], [-s * 0.6, s * 0.32]]), o(left)) +
    path(d([B, R, [s * 0.6, s * 0.32], [0, s * 0.62]]), o(right)) +
    path(d([T, R, B, L]), o(top))
  )
}
function lettuce(s, c = '#7DBE4A', rnd = () => 0.5) {
  let d = ''
  const N = 40
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const rr = s * (1 + 0.1 * Math.sin(a * 11) + (rnd() - 0.5) * 0.05)
    d += `${i ? 'L' : 'M'}${r2(Math.cos(a) * rr * 1.3)} ${r2(Math.sin(a) * rr * 0.75)}`
  }
  return (
    path(d + 'Z', { fill: c, stroke: shade(c, 0.12), 'stroke-width': 3 }) +
    path(
      `M${-s * 1.1} ${s * 0.1}Q0 ${-s * 0.15} ${s * 1.1} ${-s * 0.05}`,
      stroke(tint(c, 0.45), s * 0.08)
    ) +
    [-0.5, 0, 0.5]
      .map((k) =>
        path(
          `M${k * s} ${-s * 0.02}l${s * 0.25} ${-s * 0.4}M${k * s} ${0}l${s * 0.22} ${s * 0.36}`,
          stroke(tint(c, 0.3), s * 0.04)
        )
      )
      .join('')
  )
}
function chiliRing(r = 9) {
  return (
    circle(0, 0, r, { fill: '#D7262B' }) +
    circle(0, 0, r * 0.62, { fill: '#F0545A' }) +
    circle(-r * 0.2, -r * 0.1, r * 0.13, { fill: '#FCE38A' }) +
    circle(r * 0.22, r * 0.12, r * 0.13, { fill: '#FCE38A' })
  )
}
function limeWedge(r = 30, c = '#8DC63F') {
  let out = path(`M${-r} 0A${r} ${r} 0 0 0 ${r} 0Z`, { fill: shade(c, 0.15) })
  out += path(`M${-r * 0.86} 0A${r * 0.86} ${r * 0.86} 0 0 0 ${r * 0.86} 0Z`, {
    fill: tint(c, 0.55),
  })
  for (const a of [30, 60, 90, 120, 150])
    out += line(
      0,
      0,
      Math.cos(a * DEG) * r * 0.8,
      Math.sin(a * DEG) * r * 0.8,
      stroke(tint(c, 0.2), 2.5)
    )
  return out
}
function cherryTomato(r = 18) {
  return (
    circle(0, 0, r, { fill: '#E23B2E' }) +
    circle(-r * 0.35, -r * 0.35, r * 0.28, { fill: '#FFFFFF', 'fill-opacity': 0.5 }) +
    path(`M0 ${-r}l-6 -4M0 ${-r}l6 -4M0 ${-r}l0 -7`, stroke('#3F8A36', 3))
  )
}
function tomatoWedge(r = 22) {
  return (
    path(`M${-r} 0A${r} ${r * 0.8} 0 0 0 ${r} 0Q0 ${r * 0.3} ${-r} 0Z`, { fill: '#E2442F' }) +
    ellipse(-r * 0.35, r * 0.3, 3, 2, { fill: '#FCE38A' }) +
    ellipse(r * 0.3, r * 0.32, 3, 2, { fill: '#FCE38A' }) +
    ellipse(0, r * 0.45, 3, 2, { fill: '#FCE38A' })
  )
}
function cucumberSlice(r = 22) {
  return (
    ellipse(0, 0, r, r * 0.8, { fill: '#3C7A2E' }) +
    ellipse(0, 0, r * 0.86, r * 0.68, { fill: '#D7EDB0' }) +
    range(5)
      .map((i) =>
        ellipse(Math.cos(i * 72 * DEG) * r * 0.32, Math.sin(i * 72 * DEG) * r * 0.26, 2.6, 1.8, {
          fill: '#B8D88A',
        })
      )
      .join('')
  )
}
const peanut = (s = 7) =>
  ellipse(0, 0, s, s * 0.7, { fill: '#E3B979', stroke: '#B98544', 'stroke-width': 1.5 }) +
  line(-s * 0.1, -s * 0.6, s * 0.1, s * 0.6, stroke('#C9965A', 1.2))
function dots(rnd, n, cx, cy, rx, ry, r, color, op = 1) {
  return range(n)
    .map(() => {
      const a = rnd() * Math.PI * 2
      const k = Math.sqrt(rnd())
      return ellipse(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, r, r * 0.7, {
        fill: color,
        'fill-opacity': op,
        transform: rot(rnd() * 180, cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k),
      })
    })
    .join('')
}
// Rải chi tiết `piece(rnd, i)` lên các điểm trong elip
function strew(rnd, n, cx, cy, rx, ry, minD, piece, h = 0) {
  return scatter(rnd, n, cx, cy, rx, ry, minD, h)
    .map((p, i) => put(p.x, p.y, (p.t - 0.5) * 360, 1, piece(rnd, i, p)))
    .join('')
}
// Sợi ngắn cong (ngó sen, bắp cải bào, sứa, cà rốt, miến): vẽ trên ụ elip
function strands(rnd, n, cx, cy, rx, ry, h, colors, len, width, curl = 0.35) {
  let out = ''
  for (const p of scatter(rnd, n, cx, cy, rx, ry, 0, h)) {
    const a = (p.t - 0.5) * Math.PI
    const L = len * (0.7 + rnd() * 0.5)
    const dx = Math.cos(a) * L
    const dy = Math.sin(a) * L * 0.6
    const c = colors[Math.floor(rnd() * colors.length)]
    out += path(
      `M${r2(p.x - dx / 2)} ${r2(p.y - dy / 2)}q${r2(dx / 2 - dy * curl)} ${r2(dy / 2 + dx * curl * 0.5)} ${r2(dx)} ${r2(dy)}`,
      stroke(c, width)
    )
  }
  return out
}
const scallionRing = (r = 6) => circle(0, 0, r, stroke('#4FA83D', r * 0.5))
const garlicBit = (s = 5) =>
  path(
    `M${-s} 0Q${-s * 0.6} ${-s} 0 ${-s * 0.6}Q${s} ${-s * 0.4} ${s * 0.8} ${s * 0.3}Q0 ${s} ${-s} 0Z`,
    { fill: '#E6B451', stroke: '#C98E2C', 'stroke-width': 1 }
  )
function lemongrass(len = 200, w = 16) {
  let out = rect(-len / 2, -w / 2, len, w, { rx: w / 2, fill: vGrad('#E9EDB3', '#BFC77A') })
  for (let i = 1; i < 6; i++)
    out += line(
      -len / 2 + (len * i) / 6,
      -w / 2 + 2,
      -len / 2 + (len * i) / 6 + 3,
      w / 2 - 2,
      stroke('#A8B064', 2)
    )
  return out + rect(len / 2 - 26, -w / 2, 26, w, { rx: w / 2, fill: '#9DBB5A' })
}
const lemongrassRing = (r = 9) =>
  circle(0, 0, r, { fill: '#F2F0C8', stroke: '#C9C98A', 'stroke-width': 2 }) +
  circle(0, 0, r * 0.45, stroke('#D9D79E', 1.5))
function clam(s = 30, meat = '#F3C48E') {
  const half = (flip) => {
    const k = flip ? -1 : 1
    let o = path(
      `M0 ${s * 0.3}C${k * -s * 0.2} ${-s * 0.4} ${k * s * 0.5} ${-s * 0.9} ${k * s * 1.05} ${-s * 0.35}C${k * s * 1.25} ${s * 0.05} ${k * s * 0.8} ${s * 0.5} 0 ${s * 0.3}Z`,
      {
        fill: '#F2E7D5',
        stroke: '#B9A88E',
        'stroke-width': 2.5,
      }
    )
    for (const t of [0.35, 0.6, 0.85])
      o += path(
        `M${k * s * 0.08} ${s * 0.22}Q${k * s * 0.5 * t * 1.6} ${-s * 0.75 * t} ${k * s * t * 1.05} ${-s * 0.3 * t + s * 0.05}`,
        stroke('#D6C6AA', 2)
      )
    o += ellipse(k * s * 0.5, -s * 0.12, s * 0.33, s * 0.2, {
      fill: meat,
      transform: rot(k * -20, k * s * 0.5, -s * 0.12),
    })
    return o
  }
  return half(true) + half(false)
}
function oyster(s = 62, rnd = () => 0.5) {
  let d = ''
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2
    const rr = s * (1 + 0.1 * Math.sin(a * 7) + (rnd() - 0.5) * 0.1)
    d += `${i ? 'L' : 'M'}${r2(Math.cos(a) * rr)} ${r2(Math.sin(a) * rr * 0.62)}`
  }
  let o = path(d + 'Z', { fill: '#8E8A84', stroke: '#6B6762', 'stroke-width': 3 })
  o += ellipse(0, -3, s * 0.8, s * 0.46, { fill: '#E8E3DA' })
  o += ellipse(0, -2, s * 0.6, s * 0.34, {
    fill: '#F4EBD8',
    stroke: '#A39C90',
    'stroke-width': 2.5,
  })
  o += ellipse(-s * 0.2, -s * 0.1, s * 0.18, s * 0.08, { fill: '#FFFFFF', 'fill-opacity': 0.6 })
  for (let i = 0; i < 10; i++)
    o += circle((rnd() - 0.5) * s * 1, (rnd() - 0.5) * s * 0.5, 4 + rnd() * 3, {
      fill: i % 3 ? '#4CAF3F' : '#7DCB5A',
    })
  for (let i = 0; i < 6; i++)
    o += put((rnd() - 0.5) * s * 0.9, (rnd() - 0.5) * s * 0.45, rnd() * 180, 0.8, peanut(6))
  return o
}
// Cá nguyên con nhìn ngang (đầu bên trái), dài ~420
function fish(o = {}) {
  const body =
    'M-210 10C-190 -50 -110 -80 -30 -78C40 -76 100 -42 136 -14L206 -70Q186 0 206 66L136 14C100 44 40 74 -30 74C-110 74 -190 52 -210 10Z'
  const top = o.top ?? '#7D8A96'
  const belly = o.belly ?? '#E6EAEE'
  let out = ''
  // vây lưng, vây bụng
  const fin = o.fin ?? shade(top, 0.1)
  if (o.spiky) {
    let d = 'M-80 -74'
    for (let i = 0; i < 9; i++)
      d += `L${-68 + i * 18} ${-118 + (i % 2) * 22 + i * 3}L${-60 + i * 18} ${-72 + i * 4}`
    out += path(d + 'Z', {
      fill: fin,
      stroke: shade(fin, 0.2),
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    })
  } else out += path('M-70 -74Q-20 -122 74 -50Z', { fill: fin })
  out += path('M-40 70Q0 112 40 66Z', { fill: fin })
  out += path(body, { fill: vGrad(top, belly), stroke: shade(top, 0.25), 'stroke-width': 3 })
  const clip = clipOf(path(body))
  let tex = ''
  if (o.scales) {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 9; c++) {
        const x = -110 + c * 28 + (r % 2) * 14
        const y = -66 + r * 22
        tex += path(`M${x - 12} ${y}Q${x} ${y + 14} ${x + 12} ${y}`, stroke(o.scales, 3))
      }
  }
  if (o.score)
    for (let i = 0; i < 4; i++)
      tex += path(`M${-90 + i * 50} -62q16 50 -4 118`, stroke(shade(top, 0.3), 4))
  tex += ellipse(-60, -40, 120, 16, {
    fill: '#FFFFFF',
    'fill-opacity': 0.22,
    transform: rot(-6, -60, -40),
  })
  out += g({ 'clip-path': clip }, tex)
  out += path('M-136 -46Q-108 6 -136 52', stroke(shade(top, 0.3), 4))
  out += circle(-166, -10, 12, { fill: '#FFFFFF', stroke: shade(top, 0.3), 'stroke-width': 2 })
  out += circle(-168, -10, 6, { fill: '#1F1A17' })
  out += path('M-210 12q12 6 22 2', stroke(shade(top, 0.35), 3))
  out += path('M150 -8Q176 0 150 8', stroke(shade(fin, 0.2), 2))
  return out
}
// Mực lá nướng (thân dẹt có vây hai bên, râu ngắn cuộn) nhìn từ trên, đầu thân bên trái
function grilledSquid(c = '#D9531E', rnd = () => 0.5) {
  let out = ''
  // râu: tám râu ngắn cuộn đầu
  for (let i = 0; i < 8; i++) {
    const y = -30 + i * 8.5
    const k = i - 3.5
    const len = 70 + (i % 3) * 14
    out += path(
      `M96 ${y}q${len * 0.5} ${k * 4} ${len} ${k * 9}q14 4 6 18`,
      stroke(shade(c, 0.05), 11 - Math.abs(k) * 1.2)
    )
  }
  // vây chạy dọc hai bên thân
  out += path('M-170 0C-150 -96 40 -90 90 -40L90 40C40 90 -150 96 -170 0Z', {
    fill: tint(c, 0.12),
    stroke: shade(c, 0.25),
    'stroke-width': 2,
  })
  const body = 'M-176 0C-176 -40 -120 -54 -30 -52L96 -44Q118 0 96 44L-30 52C-120 54 -176 40 -176 0Z'
  out += path(body, {
    fill: vGrad(tint(c, 0.18), shade(c, 0.12)),
    stroke: shade(c, 0.3),
    'stroke-width': 3,
  })
  let tex = ''
  // khứa caro, sa tế đỏ phết loang, vệt cháy mảnh
  for (let i = 0; i < 12; i++) {
    tex += line(-190 + i * 26, -60, -150 + i * 26, 60, stroke(shade(c, 0.25), 2.5))
    tex += line(-190 + i * 26, 60, -150 + i * 26, -60, stroke(shade(c, 0.25), 2.5))
  }
  for (let i = 0; i < 9; i++)
    tex += ellipse(-150 + rnd() * 230, -30 + rnd() * 60, 18 + rnd() * 20, 10 + rnd() * 8, {
      fill: '#D8401C',
      'fill-opacity': 0.75,
    })
  for (let i = 0; i < 4; i++)
    tex += line(
      -120 + i * 60,
      -60,
      -96 + i * 60,
      60,
      stroke('#5A2410', 4, { 'stroke-opacity': 0.45 })
    )
  for (let i = 0; i < 30; i++)
    tex += circle(-160 + rnd() * 250, -40 + rnd() * 80, 2 + rnd() * 2, { fill: '#9E1B0E' })
  tex += ellipse(-50, -28, 110, 9, { fill: '#FFFFFF', 'fill-opacity': 0.25 })
  out += g({ 'clip-path': clipOf(path(body)) }, tex)
  out += ellipse(104, 0, 18, 30, { fill: shade(c, 0.04), stroke: shade(c, 0.3), 'stroke-width': 2 })
  out += circle(108, -15, 6, { fill: '#1F1A17' }) + circle(108, 15, 6, { fill: '#1F1A17' })
  return out
}
function crab(c = '#D9481E') {
  let out = ''
  const leg = (k, i) => {
    const y = -6 + i * 20
    const x0 = k * 70
    return (
      path(
        `M${x0} ${y}L${x0 + k * 52} ${y - 20 + i * 4}L${x0 + k * 92} ${y + 26 + i * 6}`,
        stroke(shade(c, 0.12), 14 - i)
      ) +
      path(
        `M${x0 + k * 52} ${y - 20 + i * 4}L${x0 + k * 92} ${y + 26 + i * 6}`,
        stroke(tint(c, 0.2), 4)
      )
    )
  }
  for (const k of [-1, 1]) for (let i = 0; i < 4; i++) out += leg(k, i)
  const claw = (k) => {
    let o = path(`M${k * 50} -40L${k * 92} -84`, stroke(shade(c, 0.1), 22))
    o += g(
      { transform: at(k * 104, -104, k * -30) },
      ellipse(0, 0, 32, 46, {
        fill: vGrad(tint(c, 0.15), shade(c, 0.12)),
        stroke: shade(c, 0.3),
        'stroke-width': 3,
      }) +
        path(`M${-14} -36L-4 -78L10 -34Z`, { fill: shade(c, 0.35) }) +
        path('M8 -30L26 -70L30 -26Z', { fill: shade(c, 0.35) }) +
        ellipse(-10, -6, 9, 16, { fill: '#FFFFFF', 'fill-opacity': 0.3 })
    )
    return o
  }
  out += claw(-1) + claw(1)
  out += ellipse(0, 0, 112, 74, {
    fill: vGrad(tint(c, 0.18), shade(c, 0.18)),
    stroke: shade(c, 0.3),
    'stroke-width': 3,
  })
  let sp = ''
  for (let i = -5; i <= 5; i++)
    sp += `${i === -5 ? 'M' : 'L'}${i * 20} ${-72 + Math.abs(i) * 3}l10 -10`
  out += path(sp, stroke(shade(c, 0.25), 4))
  out += ellipse(-30, -30, 44, 18, { fill: '#FFFFFF', 'fill-opacity': 0.28 })
  out += circle(-22, -66, 7, { fill: '#2A1A15' }) + circle(22, -66, 7, { fill: '#2A1A15' })
  out += path('M-60 10Q0 40 60 10', stroke(shade(c, 0.22), 4))
  return out
}
// Lát cá cắt khúc (cá lóc canh chua)
const fishSteak = (r = 26) =>
  ellipse(0, 0, r, r * 0.7, { fill: '#5E6266' }) +
  ellipse(0, 0, r * 0.84, r * 0.56, { fill: '#F7EFE2' }) +
  path(`M0 ${-r * 0.5}V${r * 0.5}M${-r * 0.7} 0H${r * 0.7}`, stroke('#E6D8C2', 2)) +
  circle(0, 0, r * 0.12, { fill: '#D9C8AE' })
// Miếng thịt gà có da vàng
const chickenChunk = (s = 26, skin = '#EFC14A') =>
  path(
    `M${-s} ${s * 0.2}Q${-s} ${-s * 0.6} 0 ${-s * 0.62}Q${s} ${-s * 0.6} ${s} ${s * 0.2}Q0 ${s * 0.6} ${-s} ${s * 0.2}Z`,
    { fill: '#FBF1DF', stroke: '#E2CDAE', 'stroke-width': 2 }
  ) +
  path(
    `M${-s} ${s * 0.1}Q${-s} ${-s * 0.6} 0 ${-s * 0.62}Q${s} ${-s * 0.6} ${s} ${s * 0.1}Q0 ${-s * 0.2} ${-s} ${s * 0.1}Z`,
    { fill: skin }
  ) +
  ellipse(-s * 0.3, -s * 0.35, s * 0.3, s * 0.1, { fill: '#FFFFFF', 'fill-opacity': 0.4 })
// Miếng thịt xào/kho (dê, bò) dạng khối méo
const meatChunk = (s = 22, c = '#7A3B1E') =>
  path(
    `M${-s} ${-s * 0.2}Q${-s * 0.8} ${-s} 0 ${-s * 0.7}Q${s * 1.1} ${-s * 0.8} ${s} 0Q${s * 0.9} ${s * 0.8} 0 ${s * 0.6}Q${-s * 1.1} ${s * 0.7} ${-s} ${-s * 0.2}Z`,
    {
      fill: c,
      stroke: shade(c, 0.25),
      'stroke-width': 2,
    }
  ) + ellipse(-s * 0.2, -s * 0.35, s * 0.4, s * 0.14, { fill: '#FFFFFF', 'fill-opacity': 0.3 })
// Lát bò tươi có vân mỡ
const beefSlice = (s = 50) =>
  path(
    `M${-s} 0Q${-s * 0.9} ${-s * 0.6} 0 ${-s * 0.55}Q${s * 1.1} ${-s * 0.5} ${s} 0Q${s * 0.9} ${s * 0.55} 0 ${s * 0.5}Q${-s * 1.05} ${s * 0.5} ${-s} 0Z`,
    {
      fill: '#C8383E',
      stroke: '#A82A30',
      'stroke-width': 2,
    }
  ) +
  path(
    `M${-s * 0.6} ${-s * 0.2}q${s * 0.3} ${s * 0.2} ${s * 0.6} 0t${s * 0.5} ${s * 0.1}M${-s * 0.5} ${s * 0.22}q${s * 0.3} -${s * 0.12} ${s * 0.7} ${s * 0.02}`,
    stroke('#F1C9C5', 3)
  )
const onionRing = (r = 20, c = '#B4588C') =>
  ellipse(0, 0, r, r * 0.72, { fill: 'none', stroke: c, 'stroke-width': 5 }) +
  ellipse(0, 0, r * 0.72, r * 0.5, { fill: 'none', stroke: '#F4E6EE', 'stroke-width': 4 })
const strawMushroom = (s = 14) =>
  ellipse(0, s * 0.3, s * 0.8, s, { fill: '#F2ECE2' }) +
  path(`M${-s * 0.9} ${s * 0.1}Q0 ${-s * 1.6} ${s * 0.9} ${s * 0.1}Z`, { fill: '#6E655C' })
const shiitake = (s = 24) =>
  ellipse(0, 0, s, s * 0.75, { fill: '#7A4A26', stroke: '#5A3418', 'stroke-width': 2 }) +
  path(
    `M${-s * 0.45} ${-s * 0.3}L${s * 0.45} ${s * 0.3}M${s * 0.45} ${-s * 0.3}L${-s * 0.45} ${s * 0.3}`,
    stroke('#D9B48A', 3)
  ) +
  ellipse(-s * 0.3, -s * 0.35, s * 0.3, s * 0.12, { fill: '#FFFFFF', 'fill-opacity': 0.3 })
const pea = (r = 7) =>
  circle(0, 0, r, { fill: '#6DBB3D', stroke: '#4E9A2A', 'stroke-width': 1.5 }) +
  circle(-r * 0.3, -r * 0.3, r * 0.3, { fill: '#C9EDA8' })
const eggBit = (s = 10) =>
  path(
    `M${-s} 0Q${-s * 0.5} ${-s} ${s * 0.3} ${-s * 0.6}Q${s} 0 ${s * 0.4} ${s * 0.6}Q${-s * 0.5} ${s * 0.8} ${-s} 0Z`,
    { fill: '#F7D449', stroke: '#E6B92A', 'stroke-width': 1 }
  )
const carrotCube = (s = 8) => rect(-s / 2, -s / 2, s, s, { rx: 2, fill: '#F2792B' })
const sausageSlice = (r = 11) =>
  ellipse(0, 0, r, r * 0.8, { fill: '#B4242C' }) +
  range(4)
    .map((i) =>
      circle(Math.cos(i * 1.6) * r * 0.45, Math.sin(i * 1.6) * r * 0.35, 1.8, { fill: '#F2C2B8' })
    )
    .join('')
const okraSlice = (r = 12) => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const rr = i % 2 ? r * 0.82 : r
    d += `${i ? 'L' : 'M'}${r2(Math.cos(a) * rr)} ${r2(Math.sin(a) * rr)}`
  }
  return (
    path(d + 'Z', { fill: '#5E9F3A' }) +
    circle(0, 0, r * 0.6, { fill: '#D9EEB8' }) +
    range(5)
      .map((i) =>
        circle(Math.cos(i * 72 * DEG) * r * 0.32, Math.sin(i * 72 * DEG) * r * 0.32, 2, {
          fill: '#F4F8E8',
        })
      )
      .join('')
  )
}
const pineappleBit = (s = 16) =>
  path(`M${-s} ${s * 0.5}L0 ${-s * 0.7}L${s} ${s * 0.5}Z`, {
    fill: '#F6C83E',
    stroke: '#E3A92A',
    'stroke-width': 2,
    'stroke-linejoin': 'round',
  })

// ============================================================ Đồ đựng
// Đĩa tròn nhìn chéo; o.rim: màu viền hoa văn, o.color: màu men
function dish(cx, cy, rx, ry, o = {}) {
  const base = o.color ?? '#FFFFFF'
  let out = softShadow(cx, cy + ry * 0.28, rx * 0.95, ry * 0.75)
  out += ellipse(cx, cy + ry * 0.1, rx, ry, { fill: shade(base, 0.16) })
  out += ellipse(cx, cy, rx, ry, { fill: base })
  out += ellipse(cx, cy + ry * 0.05, rx * 0.74, ry * 0.7, { fill: shade(base, 0.045) })
  out += path(
    `M${cx - rx * 0.74} ${cy + ry * 0.05}A${rx * 0.74} ${ry * 0.7} 0 0 1 ${cx + rx * 0.74} ${cy + ry * 0.05}`,
    stroke(shade(base, 0.1), 3)
  )
  if (o.rim) {
    out += ellipse(cx, cy, rx * 0.93, ry * 0.91, { fill: 'none', stroke: o.rim, 'stroke-width': 3 })
    out += ellipse(cx, cy, rx * 0.86, ry * 0.83, {
      fill: 'none',
      stroke: o.rim,
      'stroke-width': 6,
      'stroke-dasharray': '18 10',
    })
  }
  return out
}
// Lá chuối lót đĩa
function bananaLeaf(cx, cy, rx, ry, a = -8) {
  const c = '#3E9142'
  let out = path(
    `M${-rx} 0Q${-rx * 0.5} ${-ry * 1.1} ${rx * 0.2} ${-ry}Q${rx * 0.9} ${-ry * 0.8} ${rx} 0Q${rx * 0.6} ${ry * 0.95} 0 ${ry}Q${-rx * 0.8} ${ry * 0.8} ${-rx} 0Z`,
    {
      fill: c,
    }
  )
  out += path(`M${-rx * 0.95} 0L${rx * 0.95} 0`, stroke(tint(c, 0.3), 5))
  for (let i = -6; i <= 6; i++)
    out += path(
      `M${i * rx * 0.13} 0l${rx * 0.12} ${-ry * 0.85}M${i * rx * 0.13} 0l${rx * 0.12} ${ry * 0.85}`,
      stroke(shade(c, 0.12), 2)
    )
  return g({ transform: at(cx, cy, a) }, out)
}
// Thớt gỗ chữ nhật có tay cầm
function board(cx, cy, w, h) {
  const x = cx - w / 2
  const y = cy - h / 2
  let out = softShadow(cx, cy + h * 0.5, w * 0.55, 30)
  out += rect(x + w - 10, cy - 24, 90, 48, { rx: 24, fill: '#A86E3A' })
  out += circle(x + w + 50, cy - 2, 10, { fill: SHADOW, 'fill-opacity': 0.25 })
  out += rect(x, y + 14, w, h, { rx: 26, fill: '#9C6332' })
  out += rect(x, y, w, h, { rx: 26, fill: vGrad('#D9A266', '#BF844A') })
  for (let i = 0; i < 6; i++)
    out += path(
      `M${x + 30} ${y + 24 + (i * (h - 40)) / 5}q${w * 0.25} ${i % 2 ? 10 : -10} ${w * 0.5} 0t${w * 0.42} ${i % 2 ? -6 : 6}`,
      stroke('#B57A42', 3, { 'stroke-opacity': 0.6 })
    )
  return out
}
// Bát/tô/chén nhìn chéo. o.body: men ngoài, o.band: màu hoa văn, o.inner: lòng bát, o.k: độ dẹt miệng,
// o.fill(c): nội dung trong lòng (c = { clip, cx, cy, rx, ry }), o.over: vẽ đè trên miệng
function bowl(cx, top, rx, h, o = {}) {
  const ry = rx * (o.k ?? 0.3)
  const body = o.body ?? '#FFFFFF'
  const d = `M${cx - rx} ${top}C${cx - rx} ${top + h * 0.72} ${cx - rx * 0.52} ${top + h} ${cx} ${top + h}C${cx + rx * 0.52} ${top + h} ${cx + rx} ${top + h * 0.72} ${cx + rx} ${top}Z`
  let out = o.noShadow ? '' : softShadow(cx, top + h + 6, rx * 0.8, 22)
  out += rect(cx - rx * 0.34, top + h - 16, rx * 0.68, 28, { rx: 10, fill: shade(body, 0.22) })
  out += path(d, {
    fill: linGrad([
      [0, tint(body, 0.1)],
      [0.55, body],
      [1, shade(body, 0.2)],
    ]),
  })
  if (o.band) {
    const bc = clipOf(path(d))
    out += g(
      { 'clip-path': bc },
      path(
        `M${cx - rx} ${top + h * 0.2}A${rx} ${ry * 1.2} 0 0 0 ${cx + rx} ${top + h * 0.2}`,
        stroke(o.band, h * 0.08)
      ) +
        path(
          `M${cx - rx} ${top + h * 0.36}A${rx} ${ry * 1.4} 0 0 0 ${cx + rx} ${top + h * 0.36}`,
          stroke(o.band, h * 0.025)
        ) +
        (o.motif
          ? range(7)
              .map((i) => {
                const t = (i + 0.5) / 7
                const x = cx - rx * 0.86 + t * rx * 1.72
                const y = top + h * 0.56 + Math.sin(t * Math.PI) * ry * 0.9
                return (
                  circle(x, y, h * 0.035, { fill: o.band }) +
                  path(
                    `M${x - h * 0.08} ${y}q${h * 0.08} ${-h * 0.08} ${h * 0.16} 0`,
                    stroke(o.band, 2.5)
                  )
                )
              })
              .join('')
          : '')
    )
  }
  out += ellipse(cx, top, rx, ry, {
    fill: tint(body, 0.2),
    stroke: shade(body, 0.15),
    'stroke-width': 3,
  })
  const irx = rx - 9
  const iry = ry - 7
  out += ellipse(cx, top + 2, irx, iry, {
    fill: vGrad(shade(o.inner ?? '#F4F1EA', 0.1), o.inner ?? '#F4F1EA'),
  })
  const clip = clipOf(ellipse(cx, top + 2, irx, iry))
  if (o.fill) out += o.fill({ clip, cx, cy: top + 2, rx: irx, ry: iry })
  if (o.over) out += o.over
  return out
}
// Nước dùng trong lòng bát (lệch xuống một chút để thấy thành bát phía sau)
const brothIn = (c, col, k = 8) =>
  g(
    { 'clip-path': c.clip },
    ellipse(c.cx, c.cy + k, c.rx, c.ry, { fill: liq(col, 0.08) }) +
      ellipse(c.cx - c.rx * 0.3, c.cy + k - c.ry * 0.3, c.rx * 0.35, c.ry * 0.12, {
        fill: '#FFFFFF',
        'fill-opacity': 0.2,
      })
  )
// Chén nước chấm nhỏ
function sauceBowl(cx, top, r, sauce, bits = '') {
  return bowl(cx, top, r, r * 0.62, {
    k: 0.34,
    fill: (c) => brothIn(c, sauce, 3) + g({ 'clip-path': c.clip }, bits),
  })
}
function steam(cx, y, color, n = 3, gap = 44) {
  const d = stroke(color, 9, { 'stroke-opacity': 0.5 })
  return range(n)
    .map((i) => {
      const dx = (i - (n - 1) / 2) * gap
      return path(`M${cx + dx} ${y}c14 -22 -14 -44 0 -66c12 -18 -8 -32 2 -${48 + i * 6}`, d)
    })
    .join('')
}
// Nồi lẩu trên bếp ga mini. o.pot: 'steel' | 'clay' | 'copper'
function hotpot(it, rnd, broth, items) {
  const cx = it.potX ?? 400
  const top = it.potTop ?? 372
  const rx = it.potR ?? 226
  const ry = rx * 0.3
  const h = 128
  const kind = it.pot ?? 'steel'
  const pal = {
    steel: ['#E7EAEE', '#B5BBC4', '#6E7682'],
    clay: ['#C77A4A', '#9C5530', '#6B3519'],
    copper: ['#F0B27A', '#C9773A', '#8A4A1F'],
    enamel: ['#5E6B78', '#3A4550', '#1F262E'],
  }[kind]
  let out = softShadow(cx, top + h + 76, rx * 1.05, 26, 0.35)
  // bếp ga mini
  out += rect(cx - rx - 10, top + h - 6, 2 * rx + 20, 78, { rx: 16, fill: '#2F3640' })
  out += rect(cx - rx + 6, top + h + 10, 2 * rx - 12, 46, { rx: 10, fill: '#434C58' })
  out +=
    circle(cx + rx - 40, top + h + 33, 13, { fill: '#C9CED6' }) +
    rect(cx + rx - 42, top + h + 22, 4, 22, { fill: '#2F3640' })
  out += rect(cx - rx + 26, top + h + 28, 120, 10, { rx: 5, fill: '#5A6573' })
  const d = `M${cx - rx} ${top}L${cx - rx * 0.96} ${top + h - 26}Q${cx - rx * 0.94} ${top + h} ${cx - rx * 0.75} ${top + h}L${cx + rx * 0.75} ${top + h}Q${cx + rx * 0.94} ${top + h} ${cx + rx * 0.96} ${top + h - 26}L${cx + rx} ${top}Z`
  // quai
  for (const k of [-1, 1])
    out += path(
      `M${cx + k * rx * 0.98} ${top + 26}h${k * 34}q${k * 14} 0 ${k * 14} 14v12q0 14 ${-k * 14} 14h${-k * 36}`,
      stroke(pal[2], 13)
    )
  out += path(d, {
    fill: linGrad([
      [0, pal[1]],
      [0.22, pal[0]],
      [0.5, pal[1]],
      [1, pal[2]],
    ]),
  })
  if (kind === 'clay')
    out += g(
      { 'clip-path': clipOf(path(d)) },
      path(`M${cx - rx} ${top + 60}A${rx} ${ry} 0 0 0 ${cx + rx} ${top + 60}`, stroke('#E7B48C', 6))
    )
  out += ellipse(cx, top, rx, ry, { fill: pal[1], stroke: pal[0], 'stroke-width': 8 })
  const clip = clipOf(ellipse(cx, top + 2, rx - 10, ry - 8))
  out += g(
    { 'clip-path': clip },
    ellipse(cx, top + 2, rx - 10, ry - 8, { fill: liq(broth, 0.1) }) +
      range(5)
        .map((i) =>
          ellipse(cx - rx * 0.6 + rnd() * rx * 1.2, top - ry * 0.4 + rnd() * ry, 14 + i * 3, 5, {
            fill: '#FFFFFF',
            'fill-opacity': 0.18,
          })
        )
        .join('')
  )
  out += g({ 'clip-path': clip }, items({ cx, cy: top + 2, rx: rx - 10, ry: ry - 8 }))
  out += steam(cx, top - 50, shade(it.bg, 0.4), 3, 70)
  return out
}

// ============================================================ Ly và đồ uống (lấy từ dự án 02)
function cupPath(cx, top, bot, wT, wB, r) {
  const l1 = cx - wT / 2
  const r1 = cx + wT / 2
  const l2 = cx - wB / 2
  const rr = cx + wB / 2
  return `M${l1} ${top}L${r1} ${top}L${rr} ${bot - r}Q${rr} ${bot} ${rr - r} ${bot}L${l2 + r} ${bot}Q${l2} ${bot} ${l2} ${bot - r}Z`
}
const glassBack = (d) => path(d, { fill: '#FFFFFF', 'fill-opacity': 0.26 })
function glassFront(d, cx, top, bot, wT) {
  const x = cx - wT / 2 + 22
  return (
    path(d, {
      fill: 'none',
      stroke: '#FFFFFF',
      'stroke-opacity': 0.9,
      'stroke-width': 7,
      'stroke-linejoin': 'round',
    }) +
    rect(x, top + 40, 12, Math.max(20, bot - top - 110), {
      rx: 6,
      fill: '#FFFFFF',
      'fill-opacity': 0.4,
    })
  )
}
function liquidLayers(cx, liqTop, bot, wT, layers, clip) {
  const H = bot - liqTop
  let y = bot
  let out = ''
  for (const L of layers) {
    const h = H * L.frac
    out += rect(cx - 200, y - h, 400, h + 1, { fill: liq(L.color) })
    y -= h
  }
  const topLayer = layers[layers.length - 1]
  out += ellipse(cx, liqTop, wT / 2 - 2, 11, { fill: tint(topLayer.color, 0.28) })
  return (
    g({ 'clip-path': clip }, out) +
    ellipse(cx, liqTop, wT / 2 - 2, 11, {
      fill: 'none',
      stroke: '#FFFFFF',
      'stroke-opacity': 0.35,
      'stroke-width': 3,
    })
  )
}
function iceCube(cx, cy, s, a) {
  return g(
    { transform: rot(a, cx, cy) },
    rect(cx - s / 2, cy - s / 2, s, s, {
      rx: s * 0.24,
      fill: '#FFFFFF',
      'fill-opacity': 0.42,
      stroke: '#FFFFFF',
      'stroke-opacity': 0.9,
      'stroke-width': 4,
    }) +
      path(
        `M${cx - s * 0.28} ${cy - s * 0.06}L${cx - s * 0.06} ${cy - s * 0.28}`,
        stroke('#FFFFFF', 5, { 'stroke-opacity': 0.95 })
      )
  )
}
function iceCluster(cx, liqTop, wT, rnd, n = 4) {
  const spots = [
    [-0.26, 0.09, 64, -14],
    [0.22, 0.05, 58, 18],
    [-0.02, 0.26, 56, 8],
    [0.3, 0.3, 50, -26],
    [-0.3, 0.42, 52, 22],
  ]
  return spots
    .slice(0, n)
    .map(([dx, dy, s, a]) =>
      iceCube(
        cx + dx * wT + (rnd() - 0.5) * 8,
        liqTop + 40 + dy * 160,
        s * Math.min(1, wT / 220),
        a + (rnd() - 0.5) * 6
      )
    )
    .join('')
}
function straw(x, yTop, yBot, angle, color, w = 24) {
  return g(
    { transform: rot(angle, x, yBot) },
    rect(x - w / 2, yTop, w, yBot - yTop, { rx: w / 2, fill: color }) +
      rect(x - w / 2 + 5, yTop + 10, 6, yBot - yTop - 20, {
        rx: 3,
        fill: '#FFFFFF',
        'fill-opacity': 0.38,
      })
  )
}
function wheel(cx, cy, s, outer, inner, seg) {
  let o = circle(cx, cy, s, { fill: outer, stroke: shade(outer, 0.2), 'stroke-width': 4 })
  o += circle(cx, cy, s * 0.8, { fill: inner })
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    o += line(cx, cy, cx + Math.cos(a) * s * 0.78, cy + Math.sin(a) * s * 0.78, {
      stroke: seg,
      'stroke-width': 4,
    })
  }
  return o
}
const peachSlice = (s) =>
  path(`M${-s} 0A${s} ${s} 0 0 1 ${s} 0A${s * 0.62} ${s * 0.62} 0 0 0 ${-s} 0Z`, {
    fill: '#F59E4B',
    stroke: '#E07A2D',
    'stroke-width': 4,
    'stroke-linejoin': 'round',
  })
const passionSeed = (s) =>
  ellipse(0, 0, s, s * 0.7, { fill: '#3C2A1E' }) +
  ellipse(0, 0, s * 0.55, s * 0.35, { fill: '#F3C04B', 'fill-opacity': 0.6 })
const tallCup = (top = 246, bot = 590, wT = 236, wB = 196) => {
  const d = cupPath(400, top, bot, wT, wB, 30)
  return { d, clip: clipOf(path(d)), top, bot, wT, wB }
}

// ============================================================ Khuôn món ăn
const CX = 400
const PY = 520 // tâm đĩa chính
const PRX = 290
const PRY = 140

// Chả giò: các cuộn chiên vàng chồng hai lớp, xà lách, chén nước mắm
function moldRolls(it, rnd) {
  let out = dish(CX - 20, PY, PRX, PRY, { rim: it.rim })
  out +=
    put(250, 470, -10, 1, lettuce(70, '#86C451', rnd)) +
    put(330, 440, 8, 1, lettuce(60, '#9BD261', rnd))
  const rolls = [
    [300, 520, -14],
    [400, 548, -8],
    [500, 530, -16],
    [350, 470, 12],
    [460, 478, 8],
  ]
  for (const [x, y, a] of rolls)
    out += put(x, y, a, 1, springRoll(200, 54, it.roll, it.filling, it.net))
  out += put(250, 560, 0, 1, sprig(rnd, '#3F9D4A', 46))
  out += sauceBowl(
    612,
    560,
    70,
    '#E8A85C',
    put(-14, 4, 0, 1, carrotCube(9)) +
      put(12, 0, 0, 1, chiliRing(7)) +
      put(20, 10, 30, 1, carrotCube(8)) +
      put(-30, -4, 0, 1, garlicBit(5))
  )
  return out
}
// Súp cua: chén súp có quai, đĩa lót
function moldSoupCup(it, rnd) {
  let out = dish(CX, 600, 250, 90)
  for (const k of [-1, 1])
    out += ellipse(CX + k * 230, 418, 40, 18, {
      fill: '#F2EEE8',
      stroke: '#CFC8BC',
      'stroke-width': 3,
    })
  out += bowl(CX, 410, 220, 190, {
    body: '#FBF8F2',
    band: it.band,
    motif: true,
    noShadow: true,
    fill: (c) =>
      brothIn(c, it.soup, 6) +
      g(
        { 'clip-path': c.clip },
        strands(
          rnd,
          26,
          c.cx,
          c.cy + 8,
          c.rx * 0.8,
          c.ry * 0.7,
          0,
          ['#E9873F', '#F2A15B', '#DD6E2E'],
          34,
          5,
          0.5
        ) +
          dots(rnd, 10, c.cx, c.cy + 6, c.rx * 0.7, c.ry * 0.6, 7, '#FFFFFF', 0.85) +
          [
            [-70, 4],
            [60, -6],
            [10, 22],
          ]
            .map(([dx, dy]) =>
              put(
                c.cx + dx,
                c.cy + dy + 6,
                0,
                1,
                ellipse(0, 0, 22, 15, { fill: '#FBF7EE', stroke: '#E6DCC8', 'stroke-width': 2 }) +
                  ellipse(4, 0, 9, 7, { fill: '#F2B83A' })
              )
            )
            .join('') +
          put(c.cx - 30, c.cy - 14, 20, 0.9, sprig(rnd, '#3F9D4A', 30, 3)) +
          put(c.cx + 110, c.cy + 6, -30, 0.9, sprig(rnd, '#4FAE55', 28, 3)) +
          dots(rnd, 30, c.cx, c.cy + 6, c.rx * 0.8, c.ry * 0.7, 2, '#3A2A20')
      ),
  })
  out += steam(CX, 330, shade(it.bg, 0.4))
  return out
}
// Đĩa món chiên dạng rời (mực vòng, đậu hũ, tôm lăn cốm) vun thành ụ + chén chấm
function moldFriedPile(it, rnd) {
  let out = dish(CX - 30, PY, PRX, PRY, { rim: it.rim })
  out += put(240, 460, -14, 1, lettuce(62, '#8CC955', rnd))
  const pts = scatter(rnd, it.n ?? 12, CX - 40, PY - 10, 190, 80, it.gap ?? 60, it.mound ?? 70)
  for (const p of pts) {
    const a = (p.t - 0.5) * 70
    if (it.piece === 'ring') out += put(p.x, p.y, a, 1, squidRing(32, '#E3A74A'))
    else if (it.piece === 'tofu')
      out += put(p.x, p.y, 0, 1, cube(66, '#F2C462', '#D9962F', '#C27E22'))
    else if (it.piece === 'comShrimp') out += put(p.x, p.y, a * 1.5, 1.15, comShrimp(rnd))
    else if (it.piece === 'wing')
      out += put(p.x, p.y, a * 1.6, 1.12, chickenWing(rnd, pts.indexOf(p) % 2 === 0))
    else if (it.piece === 'squidGlaze') out += put(p.x, p.y, a, 1, squidRing(30, '#C9782F'))
  }
  if (it.topping === 'garlicChili')
    out +=
      strew(rnd, 40, CX - 40, PY - 60, 170, 60, 14, () => garlicBit(6)) +
      strew(rnd, 10, CX - 40, PY - 60, 160, 50, 30, () => chiliRing(7)) +
      strew(rnd, 10, CX - 40, PY - 50, 160, 50, 26, () => scallionRing(6))
  if (it.topping === 'lemongrass')
    out +=
      dots(rnd, 70, CX - 40, PY - 70, 170, 60, 4, '#D9D86A') +
      strew(rnd, 9, CX - 40, PY - 60, 160, 50, 30, () => chiliRing(7))
  if (it.topping === 'scallion')
    out += strew(rnd, 12, CX - 40, PY - 50, 160, 50, 26, () => scallionRing(6))
  out += put(260, 560, 10, 1, sprig(rnd, '#3F9D4A', 44))
  out += sauceBowl(620, 548, 70, it.sauce, dots(rnd, 6, 620, 552, 40, 12, 3, '#FFFFFF', 0.7))
  return out
}
// Tôm lăn cốm chiên: thân cong phủ lớp cốm xanh lấm tấm, đuôi đỏ cam
function comShrimp(rnd) {
  const body = 'M-56 8C-62 -34 -6 -56 40 -30L46 -16C8 -34 -28 -18 -26 20Q-44 32 -56 8Z'
  let o = g(
    { transform: at(44, -24, -30) },
    path('M-4 0L22 -16Q30 -2 24 2Z', { fill: '#E9542A' }) +
      path('M-4 0L22 16Q30 2 24 -2Z', { fill: '#E9542A' })
  )
  o += path(body, { fill: vGrad('#A6CB55', '#6E9A32'), stroke: '#55802A', 'stroke-width': 3 })
  o += g(
    { 'clip-path': clipOf(path(body)) },
    dots(rnd, 26, -16, -14, 50, 34, 3, '#D3EA8A') + dots(rnd, 12, -16, -14, 50, 34, 2.6, '#4E7A22')
  )
  return o
}
// Cánh gà chiên nước mắm: khúc cánh đầu (có đầu xương) và khúc cánh giữa, áo nước mắm bóng
function chickenWing(rnd, drum) {
  const c = '#C2581A'
  const glaze = {
    fill: vGrad(tint(c, 0.22), shade(c, 0.32)),
    stroke: shade(c, 0.45),
    'stroke-width': 2.5,
  }
  const bone = { fill: '#F6EBD6', stroke: '#D9CBB0', 'stroke-width': 2 }
  let o = ''
  let body
  if (drum) {
    o += rect(30, -8, 34, 16, { rx: 8, ...bone })
    o += circle(64, -8, 10, bone) + circle(64, 8, 10, bone)
    body = 'M-56 0C-56 -38 -12 -42 18 -18L40 -9L40 9L18 18C-12 42 -56 38 -56 0Z'
  } else {
    o += rect(46, -9, 18, 18, { rx: 6, ...bone })
    body = 'M-58 2C-58 -30 -20 -36 10 -32C40 -28 54 -16 54 2C54 24 28 34 0 32C-32 30 -58 26 -58 2Z'
  }
  o += path(body, glaze)
  o += g(
    { 'clip-path': clipOf(path(body)) },
    dots(rnd, 16, -6, 0, 46, 26, 3, shade(c, 0.4), 0.55) +
      ellipse(-16, -18, 30, 7, { fill: '#FFFFFF', 'fill-opacity': 0.4 })
  )
  return o
}
// Khoai tây chiên: rổ lưới, chén sốt cà
function moldFries(it, rnd) {
  let out = dish(CX, 590, 270, 110)
  const cx = 380
  const top = 400
  const w = 250
  // thanh khoai phía sau
  for (let i = 0; i < 26; i++) {
    const x = cx - w / 2 + 20 + rnd() * (w - 40)
    const a = (rnd() - 0.5) * 40
    const len = 150 + rnd() * 70
    out += g(
      { transform: rot(a, x, top + 40) },
      rect(x - 9, top + 40 - len, 18, len, {
        rx: 4,
        fill: vGrad('#F7CF63', '#E9A93A'),
        stroke: '#D49128',
        'stroke-width': 2,
      })
    )
  }
  const d = `M${cx - w / 2} ${top}L${cx - w / 2 + 24} ${top + 170}Q${cx} ${top + 190} ${cx + w / 2 - 24} ${top + 170}L${cx + w / 2} ${top}Q${cx} ${top + 30} ${cx - w / 2} ${top}Z`
  out += path(d, { fill: '#8C939C' })
  let mesh = ''
  for (let i = 0; i < 16; i++)
    mesh += line(
      cx - w / 2 + i * 17,
      top - 10,
      cx - w / 2 + 20 + i * 15,
      top + 200,
      stroke('#D7DBE0', 3)
    )
  for (let i = 0; i < 9; i++)
    mesh += path(
      `M${cx - w / 2} ${top + 10 + i * 20}Q${cx} ${top + 40 + i * 21} ${cx + w / 2} ${top + 10 + i * 20}`,
      stroke('#D7DBE0', 3)
    )
  out += g({ 'clip-path': clipOf(path(d)) }, mesh)
  out += path(`M${cx - w / 2} ${top}Q${cx} ${top + 30} ${cx + w / 2} ${top}`, stroke('#C3C8CF', 10))
  out += sauceBowl(600, 560, 74, '#D63A2A', '')
  return out
}
// Bánh xèo gập đôi, giá đỗ, tôm thò ra mép; đĩa rau rừng phía sau
function moldBanhXeo(it, rnd) {
  let out = dish(CX, PY + 10, 300, 150, { rim: it.rim })
  out += strew(rnd, 9, 320, 420, 160, 40, 44, () => leaf(60, '#3C8E3E'), 0)
  out += strew(rnd, 7, 470, 410, 130, 30, 44, () => narrowLeaf(54, '#5BAA47'), 0)
  const cx = 390
  const cy = 560
  // nhân tràn ở mép gập
  out += strands(rnd, 30, cx, cy - 6, 200, 18, 0, ['#F7F4E6', '#EDE8CF'], 40, 7)
  out +=
    put(cx - 90, cy - 4, 160, 0.8, shrimp('#F28A6A', { peeled: true })) +
    put(cx + 70, cy - 8, 200, 0.75, shrimp('#F28A6A', { peeled: true }))
  const shell = `M${cx - 230} ${cy}Q${cx - 220} ${cy - 210} ${cx} ${cy - 214}Q${cx + 220} ${cy - 210} ${cx + 230} ${cy}Q${cx} ${cy + 26} ${cx - 230} ${cy}Z`
  out += path(shell, { fill: vGrad('#F7D04B', '#E8A92A'), stroke: '#C9801C', 'stroke-width': 4 })
  let tex = ''
  for (let i = 0; i < 46; i++)
    tex += ellipse(cx - 210 + rnd() * 420, cy - 200 + rnd() * 200, 6 + rnd() * 10, 3 + rnd() * 4, {
      fill: '#C9781E',
      'fill-opacity': 0.45,
    })
  tex += ellipse(cx - 60, cy - 150, 120, 20, { fill: '#FFFFFF', 'fill-opacity': 0.22 })
  tex += strew(rnd, 14, cx, cy - 120, 160, 70, 40, () => path('M-8 0h16', stroke('#4FA83D', 6)))
  out += g({ 'clip-path': clipOf(path(shell)) }, tex)
  out += sauceBowl(
    640,
    600,
    62,
    '#E8A85C',
    put(-10, 4, 0, 1, chiliRing(6)) + put(12, 0, 0, 1, carrotCube(8))
  )
  return out
}
// Gỏi trộn vun ụ: các sợi chính, topping, rau thơm, đậu phộng
function moldSalad(it, rnd) {
  let out = dish(CX, PY, PRX, PRY, { rim: it.rim, color: it.plate })
  const cx = CX
  const cy = PY - 10
  if (it.ring === 'cucumber')
    out += strew(rnd, 9, cx, cy + 10, 230, 100, 70, () => cucumberSlice(28))
  if (it.ring === 'lettuce')
    out +=
      put(260, 480, -10, 1, lettuce(66, '#88C653', rnd)) +
      put(540, 470, 12, 1, lettuce(60, '#9BD261', rnd))
  out += ellipse(cx, cy, 190, 80, { fill: it.base, 'fill-opacity': 0.7 })
  out += strands(
    rnd,
    it.nStrands ?? 120,
    cx,
    cy,
    180,
    72,
    80,
    it.colors,
    it.len ?? 50,
    it.width ?? 8,
    it.curl ?? 0.3
  )
  for (const tp of it.tops ?? []) {
    if (tp === 'shrimp')
      out += strew(rnd, 5, cx, cy - 50, 130, 40, 70, () => shrimp('#F28A6A', { peeled: true }), 0)
    if (tp === 'pork')
      out += strew(
        rnd,
        5,
        cx,
        cy - 40,
        140,
        44,
        60,
        () =>
          path('M-30 -8Q0 -16 30 -8L28 8Q0 16 -30 8Z', {
            fill: '#F2C6B8',
            stroke: '#FFFFFF',
            'stroke-width': 4,
          }) + path('M-26 0Q0 -6 26 0', stroke('#E59C8C', 3)),
        0
      )
    if (tp === 'beef')
      out += strew(
        rnd,
        9,
        cx,
        cy - 40,
        150,
        46,
        46,
        () =>
          put(0, 0, 0, 0.6, beefSlice(50)) +
          ellipse(0, 0, 28, 14, { fill: '#8E5A44', 'fill-opacity': 0.55 }),
        0
      )
    if (tp === 'onion') out += strew(rnd, 7, cx, cy - 40, 150, 50, 40, () => onionRing(22), 0)
    if (tp === 'chicken')
      out += strands(rnd, 30, cx, cy - 34, 140, 46, 0, ['#F3E3C2', '#EAD3A6'], 46, 10)
    if (tp === 'carrot')
      out += strands(rnd, 26, cx, cy - 30, 150, 50, 0, ['#F2792B', '#F59A4A'], 40, 5)
    if (tp === 'purple')
      out += strands(rnd, 18, cx, cy - 30, 150, 50, 0, ['#8E3A8C', '#A85AA4'], 40, 6)
    if (tp === 'tuna')
      out += strew(
        rnd,
        6,
        cx,
        cy - 30,
        120,
        40,
        50,
        () =>
          path('M-22 -12L18 -16L24 10L-18 14Z', {
            fill: '#D8B09A',
            stroke: '#B58C78',
            'stroke-width': 2,
            'stroke-linejoin': 'round',
          }) + path('M-14 -6L14 -8M-12 4L16 2', stroke('#C79C86', 2)),
        0
      )
    if (tp === 'driedFish')
      out += strew(
        rnd,
        7,
        cx,
        cy - 44,
        140,
        42,
        56,
        () =>
          path('M-40 0Q-20 -16 22 -12L40 -22L36 0L40 22L22 12Q-20 16 -40 0Z', {
            fill: vGrad('#C27A34', '#7A4318'),
            stroke: '#5E3210',
            'stroke-width': 2,
            'stroke-linejoin': 'round',
          }) + path('M-30 -2Q0 -8 24 -4', stroke('#E2A65E', 3)),
        0
      )
    if (tp === 'tomato') out += strew(rnd, 6, cx, cy - 10, 170, 60, 60, () => cherryTomato(20), 0)
    if (tp === 'dressing') out += strands(rnd, 10, cx, cy - 50, 120, 36, 0, ['#F2DDB0'], 70, 6, 0.6)
  }
  out += strew(
    rnd,
    it.herbs ?? 5,
    cx,
    cy - 50,
    150,
    40,
    50,
    () =>
      it.narrow
        ? narrowLeaf(46, '#2F7F3A') + g({ transform: 'rotate(40)' }, narrowLeaf(40, '#3E9446'))
        : sprig(rnd, '#3F9D4A', 34, 3),
    0
  )
  if (it.peanut) out += strew(rnd, 22, cx, cy - 50, 140, 42, 14, () => peanut(7), 0)
  if (it.sesame) out += dots(rnd, 50, cx, cy - 50, 140, 44, 2.6, '#FFFDF5')
  out += strew(rnd, 4, cx, cy - 40, 140, 40, 60, () => chiliRing(8), 0)
  if (it.lime) out += put(560, 560, 10, 1, limeWedge(32))
  return out
}
// Gỏi cuốn: bốn cuốn bánh tráng trong thấy tôm, rau; chén tương đậu phộng
function moldFreshRolls(it, rnd) {
  let out = dish(CX - 30, PY, PRX, PRY, { rim: it.rim })
  const roll = (rnd2) => {
    const len = 230
    const w = 70
    let o = rect(-len / 2, -w / 2, len, w, { rx: w / 2, fill: '#F5F1E8' })
    o += strands(rnd2, 14, 0, 8, len * 0.4, w * 0.2, 0, ['#FFFFFF', '#EEE9DC'], 50, 5)
    o += rect(-len / 2 + 14, -4, len - 28, 16, { rx: 8, fill: '#8BC34A', 'fill-opacity': 0.75 })
    for (const dx of [-62, 0, 62])
      o += put(
        dx,
        -12,
        0,
        1,
        path('M-26 6Q-24 -16 0 -18Q24 -16 26 6Q12 -4 0 -4Q-12 -4 -26 6Z', { fill: '#F48A6A' }) +
          path('M-16 -8Q0 -14 16 -8', stroke('#FFFFFF', 3))
      )
    o += rect(-len / 2, -w / 2, len, w, {
      rx: w / 2,
      fill: '#FFFFFF',
      'fill-opacity': 0.35,
      stroke: '#E4DED2',
      'stroke-width': 3,
    })
    o += rect(-len / 2 + 30, -w / 2 + 8, len - 70, 7, {
      rx: 3.5,
      fill: '#FFFFFF',
      'fill-opacity': 0.8,
    })
    o += path(`M${len / 2 - 10} -6q30 -14 64 -34`, stroke('#4A9A3A', 5))
    return o
  }
  for (const [x, y, a] of [
    [330, 450, -8],
    [360, 505, -8],
    [390, 560, -8],
  ])
    out += put(x, y, a, 1, roll(rnd))
  out += put(560, 470, 70, 0.85, roll(rnd))
  out += sauceBowl(
    620,
    590,
    66,
    '#8E4B2C',
    dots(rnd, 10, 620, 594, 36, 10, 4, '#E3B979') + put(608, 590, 0, 1, chiliRing(6))
  )
  return out
}
// Cá nguyên con trên đĩa dài
function moldFish(it, rnd) {
  let out = dish(CX, PY + 10, 330, 140, { rim: it.rim })
  if (it.sauce)
    out +=
      ellipse(CX, PY + 20, 260, 92, { fill: it.sauce, 'fill-opacity': 0.9 }) +
      ellipse(CX - 80, PY + 50, 90, 12, { fill: '#FFFFFF', 'fill-opacity': 0.2 })
  if (it.side === 'ricepaper') {
    for (let i = 0; i < 5; i++)
      out += ellipse(560, 430 - i * 4, 90, 34, {
        fill: '#F6F1E4',
        stroke: '#E1D8C2',
        'stroke-width': 2,
      })
    out +=
      put(250, 430, -10, 1, lettuce(56, '#86C451', rnd)) +
      put(200, 470, 20, 0.9, sprig(rnd, '#3F9D4A', 40))
  }
  out += put(
    CX,
    PY - (it.upright ? 40 : 10),
    it.upright ? 0 : -4,
    it.upright ? 0.92 : 1,
    fish(it.fishStyle)
  )
  if (it.toppings) {
    out += strands(rnd, 26, CX - 10, PY - 30, 150, 40, 0, ['#F4D35E', '#F7E08E'], 50, 5)
    out += strands(rnd, 24, CX - 10, PY - 34, 150, 40, 0, ['#3FA34D', '#62BE5A'], 56, 5)
    out += strew(rnd, 6, CX, PY - 30, 140, 30, 40, () => path('M-14 0h28', stroke('#D7262B', 4)))
    out += put(560, 590, 0, 1, sprig(rnd, '#3F9D4A', 40))
  }
  return out
}
// Đĩa tôm hấp (tôm nguyên con xếp ụ), chanh, chén muối tiêu chanh
function moldShrimpPile(it, rnd) {
  let out = dish(CX - 20, PY, PRX, PRY, { rim: it.rim })
  const pts = scatter(rnd, 7, CX - 40, PY - 10, 170, 70, 84, 60)
  for (const p of pts)
    out += put(p.x, p.y, (p.t - 0.5) * 120, 1.3, shrimp(it.shell ?? '#EE5A2C', { striped: true }))
  if (it.salted) {
    // rang muối: tỏi phi vàng, muối hạt, ớt, hành lá phủ khắp; không bốc hơi
    out += strew(rnd, 46, CX - 40, PY - 40, 180, 66, 14, () => garlicBit(6), 30)
    out += dots(rnd, 60, CX - 40, PY - 40, 180, 66, 3, '#FFFBEF')
    out += strew(rnd, 12, CX - 40, PY - 40, 170, 60, 30, () => chiliRing(8), 30)
    out += strew(rnd, 12, CX - 40, PY - 40, 170, 60, 26, () => scallionRing(6), 30)
    out += put(220, 560, -10, 1, limeWedge(30))
    return out
  }
  out += put(220, 550, -10, 1, limeWedge(30)) + put(270, 590, 20, 1, limeWedge(28))
  out += sauceBowl(
    626,
    556,
    66,
    '#EDE8DD',
    dots(rnd, 28, 626, 560, 38, 11, 2, '#2A2522') + put(640, 556, 0, 1, limeWedge(16))
  )
  out += steam(380, 330, shade(it.bg, 0.4))
  return out
}
function moldCrab(it, rnd) {
  let out = dish(CX, PY, 300, 150, { rim: it.rim })
  out += ellipse(CX, PY + 10, 230, 96, { fill: '#9A4A1C', 'fill-opacity': 0.85 })
  out += put(CX, PY - 40, 0, 1.15, crab('#D9481E'))
  out += dots(rnd, 40, CX, PY - 60, 110, 50, 2.5, '#FFF6E0')
  out +=
    put(210, 560, 10, 1, sprig(rnd, '#3F9D4A', 42)) +
    put(600, 560, 180, 1, sprig(rnd, '#3F9D4A', 42))
  out += strew(rnd, 5, CX, PY + 30, 200, 50, 70, () => chiliRing(8))
  return out
}
function moldGrilledSquid(it, rnd) {
  let out = dish(CX, PY, 300, 150)
  out += bananaLeaf(CX, PY - 6, 280, 120, -6)
  out += put(CX - 10, PY - 30, -12, 1.2, grilledSquid('#F0B98E', rnd))
  out +=
    put(250, 600, 0, 1, sprig(rnd, '#2F7F3A', 40)) +
    put(
      560,
      600,
      30,
      1,
      narrowLeaf(46, '#2F7F3A') + g({ transform: 'rotate(40)' }, narrowLeaf(40, '#3E9446'))
    )
  out += put(600, 470, 20, 1, limeWedge(28))
  return out
}
// Nghêu hấp sả: tô rộng, nghêu há miệng vun cao, cây sả, ớt, lá chanh
function moldClams(it, rnd) {
  let over = put(330, 380, -24, 1, lemongrass(240, 22)) + put(480, 370, 18, 1, lemongrass(220, 20))
  const pts = scatter(rnd, 11, CX, 425, 180, 46, 72, 56)
  for (const p of pts) over += put(p.x, p.y, (p.t - 0.5) * 40, 1.45, clam(36))
  over += strew(rnd, 6, CX, 390, 170, 40, 54, () => chiliRing(10))
  over += strew(rnd, 5, CX, 390, 170, 40, 60, () => leaf(46, '#2E6B2E'))
  let out = bowl(CX, 440, 250, 170, {
    body: '#3E4A56',
    inner: '#E8E4DC',
    k: 0.28,
    fill: (c) => brothIn(c, '#EAD18A', 4),
    over,
  })
  out += steam(CX, 290, shade(it.bg, 0.4))
  return out
}
function moldOysters(it, rnd) {
  let out = dish(CX, PY, 300, 150, { color: '#5B6470' })
  out += ellipse(CX, PY, 240, 110, { fill: '#E9E4DA' })
  const spots = [
    [250, 470],
    [400, 455],
    [550, 470],
    [260, 560],
    [400, 575],
    [540, 560],
  ]
  for (const [x, y] of spots) out += put(x, y, (rnd() - 0.5) * 20, 1, oyster(70, rnd))
  return out
}
// Bò lúc lắc trên chảo gang: khối bò, ớt chuông, hành tây; khoai chiên bên cạnh
function moldSizzler(it, rnd) {
  let out = softShadow(CX, PY + 120, 300, 30)
  out +=
    ellipse(CX, PY + 20, 320, 150, { fill: '#8A5530' }) +
    ellipse(CX, PY + 10, 320, 148, { fill: '#B57A47' })
  out +=
    ellipse(CX, PY - 10, 270, 122, { fill: '#26272B' }) +
    ellipse(CX, PY - 14, 248, 106, { fill: '#38393F' })
  out += put(560, 470, 10, 1, lettuce(54, '#86C451', rnd))
  for (const p of scatter(rnd, 11, 545, 535, 70, 50, 22))
    out += put(
      p.x,
      p.y,
      -60 + p.t * 120,
      1,
      rect(-48, -8, 96, 16, {
        rx: 4,
        fill: vGrad('#F7CF63', '#E9A93A'),
        stroke: '#D49128',
        'stroke-width': 2,
      })
    )
  const pts = scatter(rnd, 13, 340, PY - 30, 150, 64, 56, 40)
  pts.forEach((p, i) => {
    if (i % 4 === 1)
      out += put(
        p.x,
        p.y,
        p.t * 90,
        1,
        rect(-20, -16, 40, 32, { rx: 8, fill: i % 8 === 1 ? '#D93A2B' : '#4E9A2A' }) +
          rect(-14, -12, 20, 6, { rx: 3, fill: '#FFFFFF', 'fill-opacity': 0.4 })
      )
    else if (i % 4 === 3) out += put(p.x, p.y, p.t * 90, 1, onionRing(22, '#E8D9C8'))
    else
      out += put(
        p.x,
        p.y,
        0,
        1,
        cube(56, '#5E2E1A', '#3F1C0E', '#2E1409') +
          ellipse(-8, -16, 12, 4, { fill: '#FFFFFF', 'fill-opacity': 0.35 })
      )
  })
  out += put(270, 600, 0, 1, cherryTomato(20)) + put(300, 612, 0, 1, cherryTomato(18))
  out += steam(340, 330, shade(it.bg, 0.4))
  return out
}
// Gà nướng nửa con bóng mật ong + xôi chiên
function moldRoastChicken(it, rnd) {
  let out = dish(CX, PY, 300, 150, { rim: it.rim })
  out += put(240, 470, -12, 1, lettuce(56, '#86C451', rnd))
  const c = it.skin
  const body = 'M-150 20C-170 -80 -40 -130 60 -100C150 -74 170 20 110 60C40 100 -120 100 -150 20Z'
  let ch = path(body, {
    fill: vGrad(tint(c, 0.12), shade(c, 0.22)),
    stroke: shade(c, 0.35),
    'stroke-width': 3,
  })
  ch += path('M60 10C120 -20 190 0 200 40C206 70 170 86 130 74C100 64 70 50 60 10Z', {
    fill: vGrad(tint(c, 0.05), shade(c, 0.28)),
    stroke: shade(c, 0.35),
    'stroke-width': 3,
  })
  ch +=
    rect(196, 34, 36, 20, { rx: 10, fill: '#F4E7CC', transform: rot(18, 196, 34) }) +
    circle(232, 56, 12, { fill: '#F4E7CC' })
  ch += ellipse(-40, -70, 80, 18, {
    fill: '#FFFFFF',
    'fill-opacity': 0.3,
    transform: rot(-12, -40, -70),
  })
  ch += ellipse(120, 18, 34, 9, {
    fill: '#FFFFFF',
    'fill-opacity': 0.3,
    transform: rot(20, 120, 18),
  })
  if (it.chiliSalt) {
    // muối ớt: vệt cháy than và hạt ớt đỏ, muối trắng rắc khắp da
    ch += g(
      { 'clip-path': clipOf(path(body)) },
      range(5)
        .map((i) =>
          line(
            -130 + i * 60,
            -90,
            -100 + i * 60,
            80,
            stroke('#4A1A08', 5, { 'stroke-opacity': 0.25 })
          )
        )
        .join('')
    )
    ch += dots(rnd, 46, -10, -30, 130, 60, 3.4, '#C0180E')
    ch += dots(rnd, 26, -10, -30, 130, 60, 2.6, '#FFF6DA')
  } else ch += dots(rnd, 30, -10, -30, 120, 50, 2.6, '#FFF6DA')
  out += put(350, PY - 30, -6, 1, ch)
  if (it.side === 'herbs') {
    // rau răm, chanh, chén muối tiêu chanh
    out += strew(
      rnd,
      7,
      560,
      590,
      70,
      26,
      34,
      () => narrowLeaf(50, '#2F7F3A') + g({ transform: 'rotate(50)' }, narrowLeaf(42, '#3E9446'))
    )
    out += put(470, 610, 0, 1, limeWedge(28))
    out += sauceBowl(
      640,
      560,
      58,
      '#EDE8DD',
      dots(rnd, 26, 640, 564, 32, 9, 2, '#2A2522') + put(652, 560, 0, 1, chiliRing(6))
    )
  } else {
    // xôi chiên
    for (const [x, y] of [
      [570, 560],
      [500, 600],
    ]) {
      out +=
        ellipse(x, y + 10, 62, 30, { fill: '#C98A2E' }) + ellipse(x, y, 62, 30, { fill: '#F2C75B' })
      out += dots(rnd, 20, x, y, 50, 22, 4, '#FBE7A4')
    }
  }
  out += strew(rnd, 8, 360, PY - 40, 140, 50, 30, () => scallionRing(6))
  return out
}
function moldRibs(it, rnd) {
  let out = board(CX - 30, PY, 520, 230)
  const c = '#8E2A16'
  const x0 = 170
  const y0 = 420
  for (let i = 0; i < 5; i++)
    out += rect(x0 + 34 + i * 78, y0 - 46, 22, 70, {
      rx: 11,
      fill: '#F1E4CB',
      stroke: '#CDB892',
      'stroke-width': 2,
    })
  const rack = `M${x0} ${y0}Q${x0 + 200} ${y0 - 34} ${x0 + 420} ${y0 + 4}L${x0 + 410} ${y0 + 150}Q${x0 + 200} ${y0 + 176} ${x0 + 10} ${y0 + 140}Z`
  out += path(rack, {
    fill: it.honey ? vGrad('#D9822E', '#8A3A10') : vGrad('#A8381E', '#5E170A'),
    stroke: '#4A1206',
    'stroke-width': 3,
  })
  let tex = ''
  for (let i = 1; i < 5; i++)
    tex += path(`M${x0 + i * 82} ${y0 - 10}q8 80 -2 170`, stroke('#4A1206', 6))
  tex += path(
    `M${x0 + 30} ${y0 + 30}Q${x0 + 200} ${y0 + 4} ${x0 + 390} ${y0 + 34}`,
    stroke('#FFFFFF', 12, { 'stroke-opacity': 0.25 })
  )
  tex += dots(rnd, 30, x0 + 210, y0 + 70, 190, 60, 4, '#2E0A04', 0.6)
  out += g({ 'clip-path': clipOf(path(rack)) }, tex)
  out += strew(rnd, 10, x0 + 210, y0 + 60, 180, 50, 40, () => scallionRing(6))
  out += dots(rnd, it.honey ? 70 : 30, x0 + 210, y0 + 60, 180, 60, 2.6, '#FFF6DA')
  if (it.honey) {
    // dưa leo, cà chua ăn kèm; chén mật ong
    for (const [x, y] of [
      [190, 640],
      [240, 652],
      [290, 646],
    ])
      out += put(x, y, 0, 1, cucumberSlice(26))
    out += put(350, 650, 0, 1, tomatoWedge(26)) + put(400, 656, 10, 1, tomatoWedge(24))
    out += sauceBowl(640, 590, 60, '#E9A21E', '')
  } else out += sauceBowl(640, 590, 60, c, '')
  return out
}
// Heo quay: các lát có lớp da giòn, mỡ, nạc xếp hàng trên đĩa dài
function moldPorkBelly(it, rnd) {
  let out = dish(CX, PY + 10, 320, 140, { rim: it.rim })
  const slice = () => {
    let o = rect(-40, -34, 80, 76, { rx: 6, fill: '#F3D9C4' })
    o +=
      rect(-40, -10, 80, 14, { fill: '#D98C78' }) +
      rect(-40, 14, 80, 10, { fill: '#F6E6D8' }) +
      rect(-40, 24, 80, 18, { rx: 4, fill: '#D07E6A' })
    o += rect(-42, -48, 84, 22, { rx: 8, fill: '#E3A43C', stroke: '#B97418', 'stroke-width': 2 })
    o += range(6)
      .map((i) => circle(-30 + i * 12, -40 + (i % 2) * 6, 3, { fill: '#F7D27A' }))
      .join('')
    return o
  }
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 4; i++)
      out += put(232 + i * 96 + r * 40, 466 + r * 84, (i - 1.5) * 3, 1, slice())
  out += put(620, 450, 0, 1, sprig(rnd, '#3F9D4A', 40))
  out += sauceBowl(640, 590, 58, '#7A4A28', dots(rnd, 6, 640, 594, 30, 8, 3, '#F3E3C2'))
  return out
}
// Bò cuốn lá lốt nướng: cuốn xanh sẫm có vệt cháy, mỡ hành, đậu phộng, xiên tre
function moldLaLot(it, rnd) {
  let out = dish(CX, PY, 300, 150)
  out += bananaLeaf(CX, PY - 6, 270, 116, 8)
  const roll = () => {
    let o = rect(-80, -22, 160, 44, { rx: 22, fill: vGrad('#4E7F32', '#2E5420') })
    for (let i = 0; i < 6; i++) o += path(`M${-60 + i * 24} -18q6 18 0 36`, stroke('#6E9E4E', 3))
    for (let i = 0; i < 3; i++)
      o += line(
        -50 + i * 44,
        -22,
        -30 + i * 44,
        22,
        stroke('#1E2E12', 7, { 'stroke-opacity': 0.6 })
      )
    return o
  }
  for (let r = 0; r < 3; r++) {
    const y = 445 + r * 58
    out += line(170, y + 10, 620, y - 20, stroke('#E3C893', 6))
    for (let i = 0; i < 2; i++) out += put(300 + i * 170 + r * 20, y + 2 - i * 11, -4, 1, roll())
  }
  out += strew(rnd, 18, CX, 480, 200, 70, 28, () => circle(0, 0, 6, { fill: '#5DBB46' }))
  out += strew(rnd, 22, CX, 490, 200, 70, 18, () => peanut(7))
  return out
}
// Niêu đất: món xào lăn sệt vàng (dê), sả, ớt, nước cốt dừa
function moldClayPot(it, rnd) {
  const cx = CX
  const top = 400
  const rx = 220
  const h = 200
  let out = softShadow(cx, top + h + 6, rx * 0.95, 26, 0.35)
  const d = `M${cx - rx} ${top}C${cx - rx * 1.16} ${top + h * 0.5} ${cx - rx * 0.8} ${top + h} ${cx} ${top + h}C${cx + rx * 0.8} ${top + h} ${cx + rx * 1.16} ${top + h * 0.5} ${cx + rx} ${top}Z`
  out += path(d, {
    fill: linGrad([
      [0, '#B5683A'],
      [0.4, '#8E4A24'],
      [1, '#4E2410'],
    ]),
  })
  out += g(
    { 'clip-path': clipOf(path(d)) },
    path(
      `M${cx - rx * 1.2} ${top + 70}A${rx * 1.2} 60 0 0 0 ${cx + rx * 1.2} ${top + 70}`,
      stroke('#2E150A', 8, { 'stroke-opacity': 0.4 })
    )
  )
  for (const k of [-1, 1]) out += ellipse(cx + k * (rx + 14), top + 24, 20, 12, { fill: '#7A3A1A' })
  out +=
    ellipse(cx, top, rx + 8, (rx + 8) * 0.3, { fill: '#6B3218' }) +
    ellipse(cx, top - 2, rx, rx * 0.28, { fill: '#A65C30' })
  const c = { cx, cy: top + 4, rx: rx - 14, ry: rx * 0.28 - 10 }
  const clip = clipOf(ellipse(c.cx, c.cy, c.rx, c.ry))
  let inner = ellipse(c.cx, c.cy, c.rx, c.ry, { fill: liq(it.sauce, 0.08) })
  if (it.content === 'fish') {
    // cá kho: khúc cá thấm nước màu, tiêu xanh, ớt, hành lá, váng mỡ bóng
    const kho = () =>
      ellipse(0, 0, 50, 30, { fill: '#3E2210' }) +
      ellipse(0, -3, 44, 24, { fill: vGrad('#C27434', '#8A4518') }) +
      path('M0 -24V20M-36 -4H36', stroke('#6E3410', 2.5)) +
      circle(0, -3, 6, { fill: '#E9C08A' }) +
      ellipse(-16, -14, 16, 4, { fill: '#FFFFFF', 'fill-opacity': 0.35 })
    inner += strew(rnd, 4, c.cx, c.cy, c.rx * 0.62, c.ry * 0.5, 100, kho)
    inner += strew(rnd, 9, c.cx, c.cy - 4, c.rx * 0.8, c.ry * 0.7, 26, () =>
      range(4)
        .map((i) => circle(i * 7 - 10, (i % 2) * 5, 4.5, { fill: '#3F7A2A' }))
        .join('')
    )
    inner += strew(rnd, 6, c.cx, c.cy - 6, c.rx * 0.8, c.ry * 0.7, 40, () => chiliRing(8))
    inner += strew(rnd, 14, c.cx, c.cy - 6, c.rx * 0.8, c.ry * 0.7, 26, () => scallionRing(6))
    inner += dots(rnd, 40, c.cx, c.cy, c.rx * 0.85, c.ry * 0.75, 2.4, '#1F140C')
  } else {
    inner += strands(rnd, 6, c.cx, c.cy, c.rx * 0.7, c.ry * 0.6, 0, ['#FFF8E6'], 70, 8, 0.6)
    inner += strew(rnd, 11, c.cx, c.cy, c.rx * 0.85, c.ry * 0.75, 44, () =>
      meatChunk(24, '#7A3B1E')
    )
    inner += strew(rnd, 10, c.cx, c.cy - 6, c.rx * 0.8, c.ry * 0.7, 30, () => lemongrassRing(8))
    inner += strew(rnd, 6, c.cx, c.cy - 6, c.rx * 0.8, c.ry * 0.7, 40, () => chiliRing(8))
  }
  out += g({ 'clip-path': clip }, inner)
  out +=
    put(cx - 60, top - 26, -10, 1, sprig(rnd, '#3F9D4A', 34, 3)) +
    put(cx + 90, top - 20, 30, 1, sprig(rnd, '#4FAE55', 30, 3))
  out += steam(cx, top - 70, shade(it.bg, 0.4))
  return out
}
// Gà luộc chặt miếng xếp hình nửa con, lá chanh thái chỉ, chén muối tiêu chanh
function moldBoiledChicken(it, rnd) {
  let out = dish(CX - 20, PY, PRX, PRY, { rim: it.rim })
  out += strew(rnd, 6, 330, 470, 180, 50, 60, () => leaf(54, '#2E6B2E'))
  // miếng gà chặt: da vàng óng bo tròn phía trên, thịt trắng ngà phía dưới
  const piece = () =>
    path('M-36 -6Q-34 -34 0 -36Q34 -34 36 -6L32 20Q0 30 -32 20Z', {
      fill: '#FBF1DF',
      stroke: '#E4D2B4',
      'stroke-width': 2,
    }) +
    path('M-36 -6Q-34 -34 0 -36Q34 -34 36 -6Q0 -14 -36 -6Z', {
      fill: '#F2C02E',
      stroke: '#D9A21E',
      'stroke-width': 2,
    }) +
    ellipse(-10, -26, 16, 4, { fill: '#FFFFFF', 'fill-opacity': 0.5 })
  const drum = () =>
    rect(36, -9, 52, 18, { rx: 9, fill: '#F6EBD6', stroke: '#D9CBB0', 'stroke-width': 2 }) +
    circle(90, -9, 12, { fill: '#F6EBD6', stroke: '#D9CBB0', 'stroke-width': 2 }) +
    circle(90, 9, 12, { fill: '#F6EBD6', stroke: '#D9CBB0', 'stroke-width': 2 }) +
    path('M-80 0C-80 -44 -22 -50 18 -20L44 -10L44 10L18 20C-22 50 -80 44 -80 0Z', {
      fill: vGrad('#F6CF4A', '#DDA51E'),
      stroke: '#C98F16',
      'stroke-width': 3,
    }) +
    ellipse(-30, -22, 34, 7, {
      fill: '#FFFFFF',
      'fill-opacity': 0.45,
      transform: 'rotate(-10 -30 -22)',
    })
  out += put(250, 470, 160, 1, drum()) + put(530, 470, 20, 1, drum())
  for (let r = 1; r >= 0; r--)
    for (let i = 0; i < 5; i++)
      out += put(232 + i * 66 + r * 30, 568 - r * 50 - i * 6, -8 + i * 4, 1, piece())
  out += strands(rnd, 40, 360, 470, 150, 50, 0, ['#2E6B2E', '#3E8A3A'], 24, 3)
  out += sauceBowl(
    620,
    566,
    64,
    '#EDE8DD',
    dots(rnd, 30, 620, 570, 36, 10, 2, '#2A2522') +
      put(632, 566, 0, 1, limeWedge(16)) +
      put(604, 566, 0, 1, chiliRing(6))
  )
  return out
}
// Lẩu: nồi + đồ nhúng (danh sách `items`)
function moldHotpot(it, rnd) {
  let out = ''
  if (it.side) {
    it.potX = 360
    it.potR = 200
    it.potTop = 360
  }
  out += hotpot(it, rnd, it.broth, (c) => {
    let o = ''
    for (const kind of it.items) {
      if (kind === 'shrimp')
        o += strew(rnd, 4, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 90, () =>
          put(0, 0, 0, 0.9, shrimp('#EE5A2C'))
        )
      if (kind === 'squid')
        o += strew(rnd, 5, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 60, () => squidRing(20, '#F7F1EA'))
      if (kind === 'clam')
        o += strew(rnd, 4, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 70, () => clam(24))
      if (kind === 'mushroom')
        o += strew(rnd, 6, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 40, () => strawMushroom(13))
      if (kind === 'chili')
        o += strew(rnd, 6, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 40, () => chiliRing(9))
      if (kind === 'lemongrass')
        o += strew(rnd, 3, c.cx, c.cy, c.rx * 0.7, c.ry * 0.6, 90, () => lemongrass(120, 14))
      if (kind === 'limeLeaf')
        o += strew(rnd, 5, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 50, () => leaf(38, '#2E6B2E'))
      if (kind === 'chicken')
        o += strew(rnd, 6, c.cx, c.cy, c.rx * 0.75, c.ry * 0.65, 70, () => chickenChunk(28))
      if (kind === 'herbE')
        o += strew(
          rnd,
          9,
          c.cx,
          c.cy,
          c.rx * 0.85,
          c.ry * 0.75,
          40,
          () => leaf(34, '#4C9A3C') + g({ transform: 'rotate(60)' }, leaf(28, '#5DAE48'))
        )
      if (kind === 'bamboo')
        o += strew(rnd, 7, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 40, () =>
          rect(-26, -5, 52, 10, { rx: 4, fill: '#F1E2A6', stroke: '#D9C47A', 'stroke-width': 2 })
        )
      if (kind === 'onion')
        o += strew(rnd, 6, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 50, () => onionRing(22, '#E9DFC9'))
      if (kind === 'pineapple')
        o += strew(rnd, 5, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 50, () => pineappleBit(16))
      if (kind === 'fishKeo')
        o += strew(rnd, 5, c.cx, c.cy, c.rx * 0.75, c.ry * 0.6, 80, () =>
          put(0, 0, 0, 0.32, fish({ top: '#7A6A4E', belly: '#C9B98E', fin: '#6A5A3E' }))
        )
      if (kind === 'giang')
        o += strew(
          rnd,
          9,
          c.cx,
          c.cy,
          c.rx * 0.85,
          c.ry * 0.75,
          40,
          () => leaf(40, '#6DAE3A') + g({ transform: 'rotate(150)' }, leaf(34, '#7FC24A'))
        )
      if (kind === 'tomato')
        o += strew(rnd, 4, c.cx, c.cy, c.rx * 0.8, c.ry * 0.7, 60, () => tomatoWedge(20))
      if (kind === 'fish')
        o += strew(rnd, 3, c.cx, c.cy, c.rx * 0.7, c.ry * 0.6, 80, () =>
          rect(-26, -14, 52, 28, { rx: 8, fill: '#F7EFE2', stroke: '#E6D3BC', 'stroke-width': 2 })
        )
      if (kind === 'eggplant')
        o += strew(
          rnd,
          5,
          c.cx,
          c.cy,
          c.rx * 0.8,
          c.ry * 0.7,
          50,
          () =>
            ellipse(0, 0, 22, 15, { fill: '#5B2A6E' }) +
            ellipse(0, 0, 18, 11.5, { fill: '#E9DDB8' }) +
            range(5)
              .map((i) =>
                circle(Math.cos(i * 1.26) * 9, Math.sin(i * 1.26) * 5, 2, { fill: '#B9A877' })
              )
              .join('')
        )
      if (kind === 'pork')
        o += strew(
          rnd,
          5,
          c.cx,
          c.cy,
          c.rx * 0.8,
          c.ry * 0.7,
          60,
          () =>
            rect(-28, -10, 56, 20, { rx: 5, fill: '#F3D9C4' }) +
            rect(-28, -10, 56, 6, { rx: 3, fill: '#D98C78' }) +
            rect(-28, 2, 56, 4, { fill: '#F9EDE2' })
        )
    }
    return o
  })
  if (it.side === 'beef') {
    out += dish(560, 600, 170, 70)
    for (let i = 0; i < 6; i++)
      out += put(480 + i * 32, 596 - (i % 2) * 8, -20 + i * 6, 1, beefSlice(46))
    out += put(660, 590, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  }
  if (it.side === 'veggies') {
    // rổ rau đồng: rau muống, bông điên điển vàng, kèo nèo
    out += dish(560, 600, 170, 70)
    for (let i = 0; i < 16; i++) {
      const x0 = 430 + i * 4
      const y0 = 628 - (i % 4) * 4
      const x1 = 560 + i * 9
      const y1 = 560 + ((i * 5) % 7) * 6
      out += path(
        `M${x0} ${y0}Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + 20} ${x1} ${y1}`,
        stroke(i % 2 ? '#5E9E32' : '#7DB547', 7)
      )
    }
    out += strew(rnd, 9, 560, 584, 100, 24, 30, () =>
      path('M0 0L34 -12L28 0L34 12Z', { fill: '#2F7A2A' })
    )
    out += strew(rnd, 16, 600, 594, 90, 28, 22, () =>
      path('M0 0Q10 -14 22 -4Q12 2 0 0Z', {
        fill: '#F6C431',
        stroke: '#D9A21E',
        'stroke-width': 1.5,
      })
    )
  }
  return out
}
// Đĩa rau nhúng lẩu: bó rau muống, cải xanh, bó nấm kim châm, cà chua
function moldVeggiePlatter(it, rnd) {
  let out = dish(CX, PY, 300, 150, { rim: it.rim })
  // cải xanh phía sau bên phải
  for (const [x, y, a] of [
    [660, 470, 205],
    [680, 510, 190],
  ])
    out += put(x, y, a, 0.95, bokChoy())
  // bó rau muống chéo
  for (let i = 0; i < 28; i++) {
    const x0 = 196 + (i % 7) * 6
    const y0 = 600 - (i % 7) * 5
    const x1 = 300 + i * 9 + (i % 3) * 6
    const y1 = 410 + ((i * 7) % 11) * 9
    out += path(
      `M${x0} ${y0}Q${(x0 + x1) / 2 - 10} ${(y0 + y1) / 2 + 30} ${x1} ${y1}`,
      stroke(i % 3 === 0 ? '#9BCB5A' : i % 2 ? '#5E9E32' : '#7DB547', 8)
    )
  }
  out += strew(
    rnd,
    22,
    440,
    440,
    140,
    40,
    30,
    () =>
      path('M0 0L50 -18L42 0L50 18Z', { fill: '#2F7A2A' }) + path('M2 0L42 0', stroke('#5E9E3E', 2))
  )
  out += rect(232, 548, 24, 50, { rx: 6, fill: '#C9A46A', transform: rot(-42, 244, 573) })
  // bó nấm kim châm phía trước
  const ex = 470
  const ey = 610
  for (let i = 0; i < 22; i++) {
    const x2 = ex - 70 + i * 6.6
    out +=
      path(
        `M${ex - 30 + i * 3} ${ey}Q${x2} ${ey - 50} ${x2} ${ey - 90}`,
        stroke(i % 2 ? '#FBF8EE' : '#F1EBDA', 5)
      ) + circle(x2, ey - 92, 6, { fill: '#E9DFC2', stroke: '#CFC2A0', 'stroke-width': 1.5 })
  }
  out +=
    rect(ex - 40, ey - 6, 120, 34, { rx: 12, fill: '#C9A46A' }) +
    rect(ex - 40, ey - 6, 120, 10, { rx: 5, fill: '#B48C52' })
  out += put(640, 560, 0, 1, cherryTomato(22)) + put(650, 600, 0, 1, cherryTomato(20))
  return out
}
// Cơm chiên: ụ cơm vun (hoặc úp khuôn) có hạt, topping theo món
function moldFriedRice(it, rnd) {
  let out = dish(CX, PY + 10, 300, 150, { rim: it.rim })
  const cx = CX - 20
  const base = PY + 20
  const rx = 200
  const hh = it.molded ? 170 : 140
  let d
  if (it.molded)
    d = `M${cx - rx} ${base}C${cx - rx} ${base - hh * 1.2} ${cx + rx} ${base - hh * 1.2} ${cx + rx} ${base}A${rx} 50 0 0 1 ${cx - rx} ${base}Z`
  else {
    d = `M${cx - rx - 20} ${base}`
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const x = cx - rx - 20 + t * (rx * 2 + 40)
      const y = base - Math.sin(t * Math.PI) * hh + (i % 2 ? 10 : -6)
      d += `L${r2(x)} ${r2(y)}`
    }
    d += `A${rx + 20} 56 0 0 1 ${cx - rx - 20} ${base}Z`
  }
  out += path(d, {
    fill: linGrad([
      [0, tint(it.rice, 0.25)],
      [0.5, it.rice],
      [1, shade(it.rice, 0.18)],
    ]),
  })
  const clip = clipOf(path(d))
  let tex = ''
  for (let i = 0; i < 110; i++) {
    const x = cx - rx + rnd() * rx * 2
    const y = base - rnd() * hh * 1.05
    tex += ellipse(x, y, 6, 3, {
      fill: i % 3 ? tint(it.rice, 0.45) : shade(it.rice, 0.12),
      transform: rot(rnd() * 180, x, y),
    })
  }
  const inDome = (n, gap, piece) =>
    strew(rnd, n, cx, base - hh * 0.5, rx * 0.85, hh * 0.45, gap, piece)
  for (const tp of it.tops) {
    if (tp === 'pea') tex += inDome(16, 26, () => pea(7))
    if (tp === 'egg') tex += inDome(12, 30, () => eggBit(11))
    if (tp === 'carrot') tex += inDome(14, 22, () => carrotCube(9))
    if (tp === 'sausage') tex += inDome(12, 34, () => sausageSlice(13))
    if (tp === 'shrimp')
      tex += inDome(5, 70, () => put(0, 0, 0, 0.7, shrimp('#F28A6A', { peeled: true })))
    if (tp === 'squid') tex += inDome(5, 60, () => squidRing(16, '#FBF5EE'))
    if (tp === 'saltFish')
      tex += inDome(14, 34, () =>
        path('M-14 -5L12 -8L16 4L-10 8Z', {
          fill: '#B7864E',
          stroke: '#8A5A2A',
          'stroke-width': 2,
          'stroke-linejoin': 'round',
        })
      )
    if (tp === 'scallion') tex += inDome(26, 20, () => scallionRing(6))
  }
  out += g({ 'clip-path': clip }, tex)
  out +=
    put(CX + 210, PY + 40, 0, 1, cucumberSlice(24)) +
    put(CX + 240, PY + 20, 0, 1, cucumberSlice(22)) +
    put(CX + 200, PY + 70, 0, 1, tomatoWedge(24))
  out += put(cx, base - hh - 12, 0, 1, sprig(rnd, '#3F9D4A', 32, 3))
  return out
}
// Chén cơm trắng vun, đôi đũa
function moldRiceBowl(it, rnd) {
  const cx = CX
  const top = 440
  const rx = 210
  let dome = `M${cx - rx + 14} ${top}C${cx - rx + 10} ${top - 180} ${cx + rx - 10} ${top - 180} ${cx + rx - 14} ${top}A${rx - 14} ${rx * 0.3 - 10} 0 0 1 ${cx - rx + 14} ${top}Z`
  let over = path(dome, {
    fill: linGrad([
      [0, '#FFFFFF'],
      [0.6, '#F7F5EE'],
      [1, '#E2DED2'],
    ]),
  })
  let tex = ''
  for (let i = 0; i < 130; i++) {
    const x = cx - rx + rnd() * rx * 2
    const y = top - 20 - rnd() * 150
    tex += ellipse(x, y, 7, 3.5, {
      fill: 'none',
      stroke: '#E4DFD2',
      'stroke-width': 1.6,
      transform: rot(rnd() * 180, x, y),
    })
  }
  over += g({ 'clip-path': clipOf(path(dome)) }, tex)
  let out = bowl(cx, top, rx, 170, { body: '#FFFFFF', band: '#2F5DA8', motif: true, over })
  out += g(
    { transform: rot(-18, 560, 640) },
    rect(340, 628, 420, 12, { rx: 6, fill: '#8B5A2B' }) +
      rect(340, 650, 420, 12, { rx: 6, fill: '#A0693A' })
  )
  out += steam(cx, top - 190, shade(it.bg, 0.35))
  return out
}
// Mì xào giòn: ổ mì vàng giòn, sốt sệt với cải, cà rốt, tôm, mực
function moldCrispyNoodle(it, rnd) {
  let out = dish(CX, PY, 300, 150, { rim: it.rim })
  const cx = CX
  const cy = PY - 10
  out += ellipse(cx, cy + 10, 230, 104, { fill: '#B8741F' })
  // ổ mì chiên giòn: nhiều vòng sợi xoăn
  for (const p of scatter(rnd, 120, cx, cy + 8, 214, 94, 0)) {
    const r = 10 + rnd() * 12
    out += ellipse(
      p.x,
      p.y,
      r * 1.5,
      r,
      stroke(p.t > 0.5 ? '#F4C863' : '#E4A43A', 4, { transform: rot(p.t * 180, p.x, p.y) })
    )
  }
  out += path(
    `M${cx - 130} ${cy - 6}Q${cx - 110} ${cy - 84} ${cx} ${cy - 80}Q${cx + 120} ${cy - 84} ${cx + 130} ${cy - 2}Q${cx} ${cy + 36} ${cx - 130} ${cy - 6}Z`,
    { fill: '#9A5A26', 'fill-opacity': 0.88 }
  )
  const pts = scatter(rnd, 11, cx, cy - 34, 110, 36, 46, 30)
  pts.forEach((p, i) => {
    const k = i % 5
    if (k === 0) out += put(p.x, p.y, p.t * 90, 0.7, shrimp('#F28A6A', { peeled: true }))
    else if (k === 1) out += put(p.x, p.y, p.t * 90, 0.8, squidPiece(28))
    else if (k === 2)
      out += put(
        p.x,
        p.y,
        p.t * 180,
        1,
        path('M-36 0Q-10 -14 14 -8L14 8Q-10 14 -36 0Z', { fill: '#E9F0D5' }) +
          ellipse(28, 0, 22, 14, { fill: '#3F8A36' })
      )
    else if (k === 3)
      out += put(
        p.x,
        p.y,
        0,
        1,
        circle(0, 0, 14, { fill: '#F2792B' }) + circle(0, 0, 6, { fill: '#F7A35C' })
      )
    else
      out += put(
        p.x,
        p.y,
        p.t * 180,
        1,
        rect(-22, -7, 44, 14, { rx: 7, fill: '#F2D35A' }) +
          range(4)
            .map((j) => line(-14 + j * 9, -6, -14 + j * 9, 6, stroke('#D9B53A', 2)))
            .join('')
      )
  })
  out += path(
    `M${cx - 110} ${cy - 50}Q${cx} ${cy - 76} ${cx + 100} ${cy - 50}`,
    stroke('#FFFFFF', 8, { 'stroke-opacity': 0.25 })
  )
  return out
}
// Miến xào cua: ụ miến nâu hổ phách, thịt cua, nấm mèo, hành
function moldGlassNoodle(it, rnd) {
  let out = dish(CX, PY, PRX, PRY, { rim: it.rim })
  const cx = CX
  const cy = PY - 10
  out += path(
    `M${cx - 200} ${cy + 30}Q${cx - 150} ${cy - 130} ${cx} ${cy - 130}Q${cx + 160} ${cy - 130} ${cx + 200} ${cy + 30}Q${cx} ${cy + 80} ${cx - 200} ${cy + 30}Z`,
    { fill: '#C89552' }
  )
  out += strands(
    rnd,
    150,
    cx,
    cy - 10,
    180,
    70,
    80,
    ['#D9AE6E', '#B98245', '#E6C38D', '#A8733A'],
    70,
    3.5,
    0.6
  )
  out += strew(
    rnd,
    10,
    cx,
    cy - 50,
    150,
    50,
    40,
    () =>
      path('M-18 4Q-20 -14 0 -16Q22 -12 18 6Q6 18 -18 4Z', { fill: '#2B211C' }) +
      path('M-8 -6q6 4 14 0', stroke('#4A3A32', 2)),
    50
  )
  out += strands(rnd, 30, cx, cy - 50, 140, 46, 40, ['#F08C5A', '#F6A57A', '#E9733F'], 24, 6, 0.4)
  out += strew(rnd, 14, cx, cy - 60, 150, 46, 30, () => path('M-10 0h20', stroke('#4FA83D', 6)), 40)
  out += put(cx, cy - 116, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  return out
}
// Cháo/súp trong tô: bề mặt sệt, đồ ăn kèm
function moldPorridge(it, rnd) {
  let out = bowl(CX, 420, 260, 190, {
    body: it.body,
    band: it.band,
    motif: true,
    fill: (c) => {
      let o = brothIn(c, it.soup, 6)
      let s = path(
        `M${c.cx - 140} ${c.cy + 10}q60 -30 120 0t120 0`,
        stroke('#FFFFFF', 6, { 'stroke-opacity': 0.4 })
      )
      s += strew(rnd, 3, c.cx, c.cy + 8, c.rx * 0.65, c.ry * 0.5, 120, () =>
        put(0, 0, 0, 0.85, shrimp('#F28A6A', { peeled: true }))
      )
      s += strew(rnd, 4, c.cx, c.cy + 8, c.rx * 0.7, c.ry * 0.6, 80, () => squidRing(18, '#FBF5EE'))
      s += strew(rnd, 3, c.cx, c.cy + 8, c.rx * 0.7, c.ry * 0.6, 90, () => clam(20))
      s += strew(rnd, 22, c.cx, c.cy + 4, c.rx * 0.75, c.ry * 0.65, 20, () => scallionRing(6))
      s += strands(rnd, 16, c.cx + 40, c.cy, 60, 18, 0, ['#F4D35E'], 30, 4)
      s += put(c.cx - 40, c.cy - 6, 0, 1, sprig(rnd, '#3F9D4A', 32, 3))
      s += dots(rnd, 40, c.cx, c.cy + 6, c.rx * 0.8, c.ry * 0.7, 2, '#3A2A20')
      return o + g({ 'clip-path': c.clip }, s)
    },
  })
  out += steam(CX, 330, shade(it.bg, 0.4))
  return out
}
// Nửa cây cải thìa: cuống trắng xanh bầu, lá xanh đậm to
const bokChoy = () =>
  path('M60 0Q86 -56 150 -50Q192 -30 186 0Q192 30 150 50Q86 56 60 0Z', {
    fill: '#2F7A2E',
    stroke: '#245E22',
    'stroke-width': 2,
  }) +
  path('M0 0Q20 -30 92 -22L100 0L92 22Q20 30 0 0Z', {
    fill: '#E2EFC8',
    stroke: '#C5DCA2',
    'stroke-width': 2,
  }) +
  path('M70 0L180 0M110 0l26 -24M110 0l26 24', stroke('#7DBA5A', 3))
// Rau xào: rau muống (cọng dài + lá mũi tên), bông bí (hoa vàng cam) hoặc cải thìa xếp tròn + nấm
function moldGreens(it, rnd) {
  let out = dish(CX, PY, PRX, PRY, { rim: it.rim })
  const cx = CX
  const cy = PY - 10
  if (it.kind === 'morningGlory') {
    out += ellipse(cx, cy + 10, 200, 80, { fill: '#4E8A2A' })
    out += strands(
      rnd,
      90,
      cx,
      cy,
      190,
      70,
      70,
      ['#6BAA3A', '#82BE4C', '#5A9A2E', '#9BCB5A'],
      110,
      10,
      0.25
    )
    out += strew(
      rnd,
      22,
      cx,
      cy - 30,
      170,
      60,
      34,
      () =>
        path('M0 0L44 -16L36 0L44 16Z', { fill: '#2F6B22' }) +
        path('M2 0L36 0', stroke('#4E8A3A', 2)),
      50
    )
  } else if (it.kind === 'squash') {
    out += ellipse(cx, cy + 10, 200, 80, { fill: '#5A9A2E' })
    out += strands(rnd, 40, cx, cy, 190, 70, 50, ['#6BAA3A', '#82BE4C'], 100, 8, 0.2)
    out += strew(
      rnd,
      12,
      cx,
      cy - 20,
      170,
      60,
      58,
      () => {
        let f = path('M-60 0L-10 0', stroke('#5A9A2E', 8))
        f += path('M-14 0Q10 -26 56 -8Q64 0 56 8Q10 26 -14 0Z', {
          fill: '#F5A623',
          stroke: '#D9821A',
          'stroke-width': 2,
        })
        f += path('M-6 0Q20 -10 52 -4M-6 0Q20 10 52 4', stroke('#F9C55E', 3))
        return f + ellipse(-14, 0, 10, 12, { fill: '#3E7F2A' })
      },
      50
    )
  } else {
    // cải thìa xếp tròn quanh đĩa (vẽ trong hệ nhìn từ trên rồi ép dẹt theo phối cảnh), nấm đông cô ở giữa
    const angles = range(10)
      .map((i) => (i / 10) * 360 + 18)
      .sort((p, q) => Math.sin(p * DEG) - Math.sin(q * DEG))
    let ring = ''
    for (const a of angles)
      ring += put(Math.cos(a * DEG) * 84, Math.sin(a * DEG) * 84, a, 1, bokChoy())
    out += g({ transform: `translate(${cx} ${cy + 6}) scale(1 0.47)` }, ring)
    out +=
      ellipse(cx, cy + 6, 120, 52, { fill: '#6B3A1E' }) +
      ellipse(cx - 30, cy - 10, 50, 8, { fill: '#FFFFFF', 'fill-opacity': 0.25 })
    out += strew(rnd, 8, cx, cy - 4, 90, 34, 40, () => shiitake(26), 20)
  }
  out += strew(rnd, 26, cx, cy - 40, 160, 50, 18, () => garlicBit(5), 50)
  return out
}
// Canh chua: tô lớn, nước đỏ cam trong, cá, cà chua, đậu bắp, thơm, bạc hà, ngò om
function moldCanhChua(it, rnd) {
  let out = bowl(CX, 420, 280, 200, {
    body: '#FFFFFF',
    band: it.band,
    motif: true,
    fill: (c) => {
      let s = strew(rnd, 4, c.cx, c.cy + 6, c.rx * 0.65, c.ry * 0.55, 110, () => fishSteak(34))
      s += strew(rnd, 5, c.cx, c.cy + 6, c.rx * 0.75, c.ry * 0.6, 70, () => tomatoWedge(24))
      s += strew(rnd, 9, c.cx, c.cy + 6, c.rx * 0.8, c.ry * 0.65, 40, () => okraSlice(13))
      s += strew(rnd, 5, c.cx, c.cy + 6, c.rx * 0.8, c.ry * 0.65, 50, () => pineappleBit(18))
      s += strew(rnd, 5, c.cx, c.cy + 6, c.rx * 0.8, c.ry * 0.65, 60, () =>
        path('M-26 0A26 14 0 0 1 26 0Q0 -6 -26 0Z', {
          fill: '#DDEFC0',
          stroke: '#B8D88A',
          'stroke-width': 2,
        })
      )
      s += strew(rnd, 9, c.cx, c.cy, c.rx * 0.8, c.ry * 0.65, 40, () =>
        sprig(rnd, '#2F8A3A', 26, 3)
      )
      s += dots(rnd, 24, c.cx, c.cy + 4, c.rx * 0.8, c.ry * 0.7, 3, '#F2C14E', 0.8)
      return brothIn(c, it.soup, 6) + g({ 'clip-path': c.clip }, s)
    },
  })
  out += steam(CX, 320, shade(it.bg, 0.4))
  return out
}
// Đậu bắp luộc + chén chao
function moldOkra(it, rnd) {
  let out = dish(CX - 30, PY, PRX, PRY, { rim: it.rim })
  const pod = () => {
    let o = path('M-90 -14Q0 -26 80 -4Q96 0 80 4Q0 26 -90 14Z', {
      fill: vGrad('#7DBA4A', '#4E8A2A'),
      stroke: '#3E7A22',
      'stroke-width': 2.5,
    })
    o += path('M-86 -6Q0 -12 84 0M-86 6Q0 12 84 0', stroke('#9ACB64', 2.5))
    o +=
      rect(-112, -14, 26, 28, { rx: 8, fill: '#5E7F2A' }) +
      path('M-112 0h-22', stroke('#7E9A3A', 6))
    return o
  }
  for (let i = 0; i < 8; i++)
    out += put(360 + (i % 2) * 24 - 30, 430 + i * 22, -12 + (i % 3) * 4, 1, pod())
  out += sauceBowl(
    616,
    560,
    74,
    '#E9C3A8',
    strew(rnd, 4, 616, 566, 36, 10, 26, () => cube(18, '#F3D0BE', '#DDB09A', '#CF9F88')) +
      put(640, 560, 0, 1, chiliRing(6))
  )
  return out
}
// Chè khúc bạch: ly chân thấp, khúc bạch, nhãn, hạnh nhân
function moldDessertCup(it, rnd) {
  const cx = CX
  const top = 330
  const bot = 560
  let out = softShadow(cx, 650, 150, 20)
  out += path(`M${cx - 16} ${bot}L${cx - 16} 618L${cx + 16} 618L${cx + 16} ${bot}Z`, {
    fill: '#FFFFFF',
    'fill-opacity': 0.6,
  })
  out += ellipse(cx, 628, 110, 24, {
    fill: '#FFFFFF',
    'fill-opacity': 0.8,
    stroke: '#E8E2E8',
    'stroke-width': 3,
  })
  const d = `M${cx - 190} ${top}C${cx - 190} ${bot - 40} ${cx - 120} ${bot} ${cx} ${bot}C${cx + 120} ${bot} ${cx + 190} ${bot - 40} ${cx + 190} ${top}Z`
  const clip = clipOf(path(d))
  out += path(d, { fill: '#FFFFFF', 'fill-opacity': 0.3 })
  let inner = rect(cx - 200, top + 30, 400, 260, { fill: liq(it.syrup, 0.06) })
  const cubes = scatter(rnd, 14, cx, top + 120, 150, 90, 56, 0)
  cubes.forEach((p, i) => {
    if (i % 3 === 2)
      inner += put(
        p.x,
        p.y,
        0,
        1,
        circle(0, 0, 24, {
          fill: '#F5F1E6',
          'fill-opacity': 0.95,
          stroke: '#E2DACB',
          'stroke-width': 2,
        }) + circle(6, 4, 7, { fill: '#5A4030', 'fill-opacity': 0.5 })
      )
    else
      inner += put(
        p.x,
        p.y,
        (p.t - 0.5) * 30,
        1,
        cube(
          46,
          i % 2 ? '#FFFDF6' : '#FCE8C8',
          i % 2 ? '#EFE9DC' : '#F2D9B0',
          i % 2 ? '#E2DACB' : '#E6C99C'
        )
      )
  })
  out += g({ 'clip-path': clip }, inner)
  out += path(d, stroke('#FFFFFF', 7, { 'stroke-opacity': 0.9 }))
  out += ellipse(cx, top, 190, 40, {
    fill: tint(it.syrup, 0.3),
    stroke: '#FFFFFF',
    'stroke-width': 6,
  })
  out += strew(rnd, 5, cx, top - 4, 130, 22, 50, () => cube(40, '#FFFDF6', '#EFE9DC', '#E2DACB'))
  out += strew(
    rnd,
    3,
    cx,
    top - 6,
    120,
    20,
    70,
    () =>
      circle(0, 0, 22, { fill: '#F5F1E6', stroke: '#E2DACB', 'stroke-width': 2 }) +
      circle(5, 3, 6, { fill: '#5A4030', 'fill-opacity': 0.5 })
  )
  out += strew(rnd, 12, cx, top - 20, 110, 18, 22, () =>
    path('M-12 0Q0 -9 12 0Q0 9 -12 0Z', { fill: '#E9C48A', stroke: '#C99A5A', 'stroke-width': 1.5 })
  )
  out += put(cx + 40, top - 34, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  out +=
    rect(cx + 70, top - 140, 16, 170, {
      rx: 8,
      fill: '#E8E2D6',
      transform: rot(24, cx + 78, top),
    }) +
    ellipse(cx + 126, top - 140, 24, 16, {
      fill: '#E8E2D6',
      transform: rot(24, cx + 126, top - 140),
    })
  out += rect(cx - 160, top + 50, 12, 140, { rx: 6, fill: '#FFFFFF', 'fill-opacity': 0.4 })
  return out
}
// Trái cây thập cẩm: dưa hấu, xoài, thanh long, nho
function moldFruitPlatter(it, rnd) {
  let out = dish(CX, PY, 300, 150, { rim: it.rim })
  const melon = () =>
    path('M-70 30L0 -80L70 30Z', {
      fill: '#EE4B57',
      stroke: '#EE4B57',
      'stroke-width': 8,
      'stroke-linejoin': 'round',
    }) +
    path('M-76 36Q0 54 76 36L72 50Q0 66 -72 50Z', { fill: '#3E8A3A' }) +
    path('M-74 34Q0 50 74 34', stroke('#E9F5D0', 6)) +
    range(7)
      .map((i) =>
        ellipse(-30 + (i % 4) * 20, -20 + Math.floor(i / 4) * 26, 3, 5, { fill: '#2A1A15' })
      )
      .join('')
  out += put(260, 470, -10, 1, melon()) + put(350, 450, 6, 1, melon())
  const dragon = () => {
    let o =
      path('M-56 0A56 56 0 0 1 56 0Z', { fill: '#D6336C' }) +
      path('M-48 -2A48 48 0 0 1 48 -2Z', { fill: '#FFFDF6' })
    for (let i = 0; i < 24; i++)
      o += circle(-36 + rnd() * 72, -6 - rnd() * 34, 1.8, { fill: '#2A1A15' })
    return o
  }
  out += put(500, 470, 0, 1, dragon()) + put(560, 510, 10, 1, dragon())
  out += strew(rnd, 8, 330, 570, 90, 30, 34, () => cube(36, '#FBC93A', '#F2A71E', '#E3961A'))
  out += strew(
    rnd,
    11,
    500,
    590,
    60,
    26,
    24,
    (r2n, i) =>
      circle(0, 0, 15, { fill: i % 2 ? '#7B3FA0' : '#6A2E8E' }) +
      circle(-5, -5, 4, { fill: '#FFFFFF', 'fill-opacity': 0.4 })
  )
  out += put(600, 590, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  return out
}
// Bánh flan + đá bào cà phê
function moldFlan(it, rnd) {
  let out = dish(CX, 560, 260, 110)
  out += strew(rnd, 26, CX, 560, 200, 70, 30, () =>
    path('M-10 -6L8 -10L12 6L-8 10Z', {
      fill: '#E6D2BC',
      'fill-opacity': 0.9,
      stroke: '#FFFFFF',
      'stroke-width': 2,
    })
  )
  out += ellipse(CX, 570, 170, 56, { fill: '#5A341E', 'fill-opacity': 0.55 })
  const cx = CX
  const top = 400
  const bot = 560
  out += path(
    `M${cx - 140} ${bot}L${cx - 110} ${top}L${cx + 110} ${top}L${cx + 140} ${bot}Q${cx} ${bot + 30} ${cx - 140} ${bot}Z`,
    {
      fill: linGrad([
        [0, '#FBE3A0'],
        [0.5, '#F5CF6A'],
        [1, '#D9A43C'],
      ]),
    }
  )
  out += ellipse(cx, top, 110, 32, { fill: '#8A4A16' })
  for (const [dx, len] of [
    [-90, 40],
    [-40, 70],
    [20, 30],
    [70, 56],
  ])
    out += path(`M${cx + dx - 10} ${top + 10}v${len}a10 10 0 0 0 20 0v${-len}Z`, {
      fill: '#8A4A16',
    })
  out += ellipse(cx - 30, top - 6, 50, 9, { fill: '#FFFFFF', 'fill-opacity': 0.3 })
  out += dots(rnd, 10, cx, top + 100, 90, 40, 3, '#E9B54A')
  out += put(cx + 150, top + 80, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  return out
}
// Rau câu dừa: nửa trái dừa đựng thạch hai lớp (mặt khoét lộ lớp trong) + hai miếng cắt
function moldCoconutJelly(it, rnd) {
  let out = dish(CX, 600, 290, 112)
  const cx = 350
  const top = 468
  const rx = 176
  const ry = rx * 0.32
  const d = `M${cx - rx} ${top}C${cx - rx} ${top + 160} ${cx + rx} ${top + 160} ${cx + rx} ${top}Z`
  out += path(d, {
    fill: linGrad([
      [0, '#8C5A34'],
      [0.5, '#6E4325'],
      [1, '#4A2A14'],
    ]),
  })
  let fib = ''
  for (let i = 0; i < 40; i++)
    fib += path(
      `M${cx - rx + rnd() * rx * 2} ${top + 20 + rnd() * 100}q8 4 16 -2`,
      stroke('#A87A4E', 2)
    )
  out += g({ 'clip-path': clipOf(path(d)) }, fib)
  out += ellipse(cx, top, rx, ry, { fill: '#FFFDF6', stroke: '#6E4325', 'stroke-width': 5 })
  const ic = { cx, cy: top + 2, rx: rx - 16, ry: ry - 10 }
  const clip = clipOf(ellipse(ic.cx, ic.cy, ic.rx, ic.ry))
  let jelly = ellipse(ic.cx, ic.cy, ic.rx, ic.ry, { fill: '#FBF8EF' })
  // chỗ đã múc: lộ lớp thạch trong màu nước dừa
  jelly +=
    ellipse(cx + 50, top + 18, 80, 30, { fill: '#E6D7A6' }) +
    ellipse(cx + 50, top + 24, 70, 22, { fill: '#EFE3BC' })
  jelly += ellipse(cx + 30, top + 18, 30, 5, { fill: '#FFFFFF', 'fill-opacity': 0.7 })
  jelly += ellipse(cx - 60, top - 10, 50, 7, { fill: '#FFFFFF', 'fill-opacity': 0.9 })
  out += g({ 'clip-path': clip }, jelly)
  // miếng thạch cắt: lớp trắng trên, lớp trong dưới
  const piece = (x, y, s) => {
    let o = path(
      `M${-s * 0.6} ${s * 0.1}L0 ${s * 0.42}L${s * 0.6} ${s * 0.1}L${s * 0.6} ${s * 0.62}L0 ${s * 0.94}L${-s * 0.6} ${s * 0.62}Z`,
      { fill: '#E6D7A6', 'fill-opacity': 0.95 }
    )
    o += line(0, s * 0.42, 0, s * 0.94, stroke('#D6C48E', 2))
    o += cube(s, '#FFFDF7', '#F1ECDD', '#E3DCC8')
    return put(x, y, 0, 1, o)
  }
  out += piece(580, 520, 84) + piece(640, 576, 74)
  out += put(500, 626, 0, 1, sprig(rnd, '#3F9D4A', 28, 3))
  return out
}

// ============================================================ Khuôn đồ uống
// Nước ép/sinh tố: ly thấp bo tròn + trái cây bên cạnh
function moldJuice(it, rnd) {
  const cx = 450
  const top = 300
  const bot = 600
  const wT = 230
  const wB = 200
  const d = cupPath(cx, top, bot, wT, wB, 58)
  const clip = clipOf(path(d))
  const liqTop = top + 40
  let out = softShadow(cx, bot + 8, 150, 18)
  let inner = liquidLayers(cx, liqTop, bot, wT, it.layers, clip)
  if (it.seeds)
    inner += g(
      { 'clip-path': clip },
      range(28)
        .map(() =>
          put(cx - 100 + rnd() * 200, liqTop + 20 + rnd() * 220, rnd() * 180, 1, passionSeed(6))
        )
        .join('')
    )
  if (it.ice) inner += g({ 'clip-path': clip }, iceCluster(cx, liqTop, wT, rnd, 3))
  else
    inner += g(
      { 'clip-path': clip },
      range(16)
        .map(() =>
          circle(cx - 90 + rnd() * 180, liqTop + 30 + rnd() * 200, 2 + rnd() * 3, {
            fill: '#FFFFFF',
            'fill-opacity': 0.35,
          })
        )
        .join('')
    )
  out +=
    glassBack(d) +
    inner +
    straw(cx + 50, top - 100, bot - 60, 14, it.straw, 22) +
    glassFront(d, cx, top, bot, wT)
  const fx = 236
  const fy = 552
  if (it.fruit === 'orange') {
    out +=
      circle(fx, fy, 78, { fill: '#F39A2B' }) +
      wheel(fx, fy, 66, '#F9B344', '#FFE2B0', '#F9B344') +
      circle(fx, fy, 7, { fill: '#FFE2B0' })
    out += put(fx + 40, fy - 76, -20, 1, leaf(60, '#3F9D4A'))
  } else if (it.fruit === 'watermelon') {
    out += put(
      fx,
      fy,
      -14,
      1,
      path('M-96 0A96 96 0 0 0 96 0Z', { fill: '#3E8A3A' }) +
        path('M-86 0A86 86 0 0 0 86 0Z', { fill: '#E9F5D0' }) +
        path('M-78 0A78 78 0 0 0 78 0Z', { fill: '#EE4B57' }) +
        range(7)
          .map((i) => ellipse(-50 + i * 17, 20 + (i % 2) * 18, 3, 5, { fill: '#2A1A15' }))
          .join('')
    )
  } else if (it.fruit === 'avocado') {
    out += put(
      fx,
      fy - 10,
      -16,
      1,
      path(
        'M0 -96C50 -96 66 -20 70 20C74 70 40 96 0 96C-40 96 -74 70 -70 20C-66 -20 -50 -96 0 -96Z',
        { fill: '#3B5E22' }
      ) +
        path(
          'M0 -86C42 -86 56 -18 60 20C62 62 34 84 0 84C-34 84 -62 62 -60 20C-56 -18 -42 -86 0 -86Z',
          { fill: '#D9E99A' }
        ) +
        circle(0, 26, 34, { fill: '#8A5A34' }) +
        circle(-10, 16, 10, { fill: '#B07A4E' })
    )
  } else if (it.fruit === 'passion') {
    out += put(
      fx,
      fy,
      0,
      1,
      circle(0, 0, 76, { fill: '#5B2A55' }) +
        circle(0, 0, 64, { fill: '#F2E3C0' }) +
        circle(0, 0, 56, { fill: '#F2B22E' }) +
        range(16)
          .map((i) =>
            put(
              Math.cos(i * 2.4) * 34 * ((i % 3) / 2 + 0.3),
              Math.sin(i * 2.4) * 34 * ((i % 3) / 2 + 0.3),
              i * 40,
              1,
              passionSeed(7)
            )
          )
          .join('')
    )
  }
  return out
}
// Ly cao có đá (cà phê sữa, trà đào), trang trí theo món
function moldTallGlass(it, rnd) {
  const c = tallCup(260, 600, 220, 186)
  const liqTop = c.top + 40
  let out = softShadow(CX, c.bot + 8, 140, 18)
  let inner = liquidLayers(CX, liqTop, c.bot, c.wT, it.layers, c.clip)
  if (it.peach)
    inner += g(
      { 'clip-path': c.clip },
      [
        [-50, 120, 20],
        [40, 170, -30],
        [-20, 240, 10],
        [50, 270, -10],
      ]
        .map(([dx, dy, a]) => put(CX + dx, liqTop + dy, a, 1, peachSlice(30)))
        .join('')
    )
  if (it.kumquat)
    inner += g(
      { 'clip-path': c.clip },
      [
        [-50, 130],
        [40, 190],
        [-24, 260],
        [56, 290],
      ]
        .map(([dx, dy]) => wheel(CX + dx, liqTop + dy, 26, '#E9A21E', '#F8DC7A', '#E9A21E'))
        .join('')
    )
  if (it.lychee)
    inner += g(
      { 'clip-path': c.clip },
      [
        [-52, 150],
        [36, 120],
        [-10, 220],
        [54, 260],
        [-50, 280],
      ]
        .map(
          ([dx, dy]) =>
            circle(CX + dx, liqTop + dy, 25, {
              fill: '#FBF4EE',
              stroke: '#EFC9D3',
              'stroke-width': 4,
            }) + circle(CX + dx - 8, liqTop + dy - 8, 6, { fill: '#FFFFFF' })
        )
        .join('') +
        [
          [10, 300],
          [-30, 320],
          [44, 326],
        ]
          .map(([dx, dy]) =>
            rect(CX + dx - 13, liqTop + dy - 13, 26, 26, {
              rx: 6,
              fill: '#E6F2D6',
              'fill-opacity': 0.8,
              stroke: '#C9E0AE',
              'stroke-width': 2,
            })
          )
          .join('')
    )
  inner += g(
    { 'clip-path': c.clip },
    iceCluster(CX, liqTop, c.wT, rnd, it.peach || it.kumquat || it.lychee ? 2 : 4)
  )
  out += glassBack(c.d) + inner + glassFront(c.d, CX, c.top, c.bot, c.wT)
  if (it.kumquat)
    out +=
      wheel(CX - c.wT / 2 + 6, c.top + 4, 36, '#E9A21E', '#F8DC7A', '#E9A21E') +
      put(CX - 30, c.top - 24, -36, 1, leaf(64, '#2E9E4F')) +
      put(CX - 34, c.top - 16, 12, 1, leaf(52, '#43B65F'))
  if (it.lychee)
    out +=
      circle(CX - c.wT / 2 + 14, c.top - 6, 30, {
        fill: '#D9334F',
        stroke: '#B0203A',
        'stroke-width': 3,
      }) +
      dots(rnd, 18, CX - c.wT / 2 + 14, c.top - 6, 22, 22, 2.4, '#8E1A2E') +
      put(CX - c.wT / 2 + 30, c.top - 36, -50, 1, leaf(44, '#3F9D4A'))
  if (it.lemongrass) out += put(CX + 40, c.top - 40, -70, 1, lemongrass(260, 18))
  else out += straw(CX + 52, c.top - 100, c.bot - 60, 12, it.straw, 22)
  if (it.orange) out += wheel(CX - c.wT / 2 + 6, c.top + 4, 44, '#F39A2B', '#FFD08A', '#F39A2B')
  if (it.phin) {
    out += put(
      620,
      520,
      0,
      1,
      rect(-60, -10, 120, 90, { rx: 10, fill: vGrad('#EEF0F4', '#9598A4') }) +
        ellipse(0, -10, 66, 14, { fill: '#DCDEE5', stroke: '#A8ABB6', 'stroke-width': 3 }) +
        circle(0, -22, 9, { fill: '#A8ABB6' }) +
        ellipse(0, 82, 80, 14, { fill: '#C2C5CE' })
    )
  }
  return out
}
// Mojito: ly thẳng, bọt khí, chanh, bạc hà
function moldMojito(it, rnd) {
  const top = 250
  const bot = 600
  const w = 210
  const d = cupPath(CX, top, bot, w, w - 10, 26)
  const clip = clipOf(path(d))
  const liqTop = top + 44
  let out = softShadow(CX, bot + 8, 140, 18)
  let inner = liquidLayers(CX, liqTop, bot, w, it.layers, clip)
  inner += g(
    { 'clip-path': clip },
    range(30)
      .map(() =>
        circle(
          CX - 90 + rnd() * 180,
          liqTop + 20 + rnd() * 300,
          3 + rnd() * 6,
          stroke('#FFFFFF', 3, { 'stroke-opacity': 0.75 })
        )
      )
      .join('')
  )
  inner += g(
    { 'clip-path': clip },
    [
      [-50, 250],
      [30, 200],
      [-10, 120],
    ]
      .map(
        ([dx, dy], i) =>
          wheel(CX + dx, liqTop + dy, 28, '#7DBA3A', '#DCEFB1', '#7DBA3A') + (i ? '' : '')
      )
      .join('')
  )
  inner += g(
    { 'clip-path': clip },
    strew(rnd, 10, CX, liqTop + 260, 80, 50, 30, () => leaf(30, '#2E9E4F'))
  )
  inner += g({ 'clip-path': clip }, iceCluster(CX, liqTop, w, rnd, 3))
  out += glassBack(d) + inner + glassFront(d, CX, top, bot, w)
  out += straw(CX - 44, top - 110, bot - 50, 10, it.straw, 20)
  out += wheel(CX + w / 2 - 2, top, 42, '#7DBA3A', '#DCEFB1', '#7DBA3A')
  out +=
    put(CX - 10, top - 20, -38, 1, leaf(74, '#2E9E4F')) +
    put(CX - 14, top - 10, 14, 1, leaf(60, '#43B65F')) +
    put(CX + 10, top - 26, -80, 1, leaf(56, '#2E9E4F'))
  return out
}
// Ly bia có bọt (đặt cạnh lon/chai)
function beerGlass(cx, top, bot, w, color = '#F2B33A', rnd = () => 0.5, ice = false) {
  const d = cupPath(cx, top, bot, w, w * 0.74, 18)
  const clip = clipOf(path(d))
  let out = glassBack(d)
  let inner = rect(cx - w, top + 46, 2 * w, bot - top, { fill: liq(color, 0.12) })
  inner += range(16)
    .map(() =>
      circle(cx - w * 0.35 + rnd() * w * 0.7, top + 70 + rnd() * (bot - top - 90), 2 + rnd() * 2, {
        fill: '#FFFFFF',
        'fill-opacity': 0.55,
      })
    )
    .join('')
  if (ice) inner += iceCluster(cx, top + 30, w, rnd, 4)
  inner += rect(cx - w, top - 10, 2 * w, ice ? 40 : 60, { fill: '#FFF9EC' })
  out += g({ 'clip-path': clip }, inner)
  out += path(
    `M${cx - w / 2 - 6} ${top + 4}q${w * 0.15} -34 ${w * 0.3} -10q${w * 0.2} -30 ${w * 0.4} -6q${w * 0.2} -24 ${w * 0.3 + 12} 16Z`,
    { fill: '#FFFDF5', stroke: '#F1E6CE', 'stroke-width': 2 }
  )
  out += glassFront(d, cx, top, bot, w)
  return out
}
// Lon nước: thân hình trụ, nắp nhôm, dải màu (không chữ, không logo)
function can(cx, top, bot, w, o) {
  const rx = w / 2
  const ry = rx * 0.26
  let out = softShadow(cx, bot + 6, rx * 1.2, 14)
  const d = `M${cx - rx} ${top + 14}L${cx - rx} ${bot - 10}A${rx} ${ry} 0 0 0 ${cx + rx} ${bot - 10}L${cx + rx} ${top + 14}Z`
  out += path(d, {
    fill: linGrad([
      [0, shade(o.body, 0.05)],
      [0.25, tint(o.body, 0.25)],
      [0.6, o.body],
      [1, shade(o.body, 0.35)],
    ]),
  })
  const clip = clipOf(path(d))
  out += g({ 'clip-path': clip }, o.decor(cx, top, bot, rx, ry))
  out += path(
    `M${cx - rx} ${bot - 10}A${rx} ${ry} 0 0 0 ${cx + rx} ${bot - 10}`,
    stroke('#B9BEC6', 6)
  )
  out += path(
    `M${cx - rx} ${top + 14}L${cx - rx + 10} ${top}L${cx + rx - 10} ${top}L${cx + rx} ${top + 14}Z`,
    {
      fill: linGrad([
        [0, '#9CA3AF'],
        [0.3, '#F1F3F5'],
        [1, '#7B828C'],
      ]),
    }
  )
  out += ellipse(cx, top, rx - 10, ry - 2, {
    fill: '#D7DBE0',
    stroke: '#A3A9B2',
    'stroke-width': 3,
  })
  out +=
    ellipse(cx + 8, top - 2, 20, 7, { fill: '#B9BEC6' }) +
    ellipse(cx - 14, top, 12, 4, { fill: '#6B7280' })
  out += rect(cx - rx + 16, top + 40, 14, bot - top - 80, {
    rx: 7,
    fill: '#FFFFFF',
    'fill-opacity': 0.35,
  })
  return out
}
// Chai: thân, vai, cổ, nắp/nút, nhãn (không chữ)
function bottle(cx, top, bot, w, o) {
  const rx = w / 2
  const neckW = o.neck ?? w * 0.3
  const shoulder = top + (o.shoulder ?? 150)
  let out = softShadow(cx, bot + 6, rx * 1.2, 14)
  const d = `M${cx - neckW / 2} ${top}L${cx - neckW / 2} ${shoulder - 60}C${cx - neckW / 2} ${shoulder - 20} ${cx - rx} ${shoulder - 30} ${cx - rx} ${shoulder + 20}L${cx - rx} ${bot - 16}Q${cx - rx} ${bot} ${cx - rx + 16} ${bot}L${cx + rx - 16} ${bot}Q${cx + rx} ${bot} ${cx + rx} ${bot - 16}L${cx + rx} ${shoulder + 20}C${cx + rx} ${shoulder - 30} ${cx + neckW / 2} ${shoulder - 20} ${cx + neckW / 2} ${shoulder - 60}L${cx + neckW / 2} ${top}Z`
  out += path(d, {
    fill: linGrad([
      [0, shade(o.glass, 0.1)],
      [0.25, tint(o.glass, 0.3)],
      [0.55, o.glass],
      [1, shade(o.glass, 0.35)],
    ]),
    'fill-opacity': o.clear ? 0.55 : 1,
    stroke: o.clear ? '#FFFFFF' : 'none',
    'stroke-width': 4,
  })
  const clip = clipOf(path(d))
  if (o.decor) out += g({ 'clip-path': clip }, o.decor(cx, top, bot, rx, shoulder))
  out += rect(cx - rx + 14, shoulder + 30, 12, bot - shoulder - 70, {
    rx: 6,
    fill: '#FFFFFF',
    'fill-opacity': 0.35,
  })
  out += rect(cx - neckW / 2 - 4, top - 26, neckW + 8, 34, { rx: 6, fill: o.cap })
  return out
}
function moldDrinkCan(it, rnd) {
  let out = beerGlass(540, 340, 600, 150, it.drink ?? '#F2B33A', rnd, it.ice)
  if (it.cola) {
    out = ''
    const d = cupPath(540, 360, 600, 160, 130, 20)
    const clip = clipOf(path(d))
    out +=
      glassBack(d) +
      g(
        { 'clip-path': clip },
        rect(400, 400, 300, 220, { fill: liq('#3A1A12', 0.1) }) +
          iceCluster(540, 400, 150, rnd, 3) +
          range(14)
            .map(() =>
              circle(480 + rnd() * 120, 420 + rnd() * 160, 2 + rnd() * 2, {
                fill: '#FFFFFF',
                'fill-opacity': 0.4,
              })
            )
            .join('')
      ) +
      glassFront(d, 540, 360, 600, 160)
  }
  out = can(320, 290, 610, 170, it.can) + out
  return out
}
function moldDrinkBottle(it, rnd) {
  let out = ''
  if (it.wine) {
    // ly vang chân cao
    const cx = 560
    out += softShadow(cx, 612, 70, 12)
    out +=
      rect(cx - 5, 470, 10, 130, { fill: '#FFFFFF', 'fill-opacity': 0.7 }) +
      ellipse(cx, 604, 66, 14, { fill: '#FFFFFF', 'fill-opacity': 0.75 })
    const d = `M${cx - 80} 300C${cx - 90} 420 ${cx - 50} 476 ${cx} 476C${cx + 50} 476 ${cx + 90} 420 ${cx + 80} 300Z`
    out += path(d, { fill: '#FFFFFF', 'fill-opacity': 0.25 })
    out += g(
      { 'clip-path': clipOf(path(d)) },
      rect(cx - 100, 390, 200, 100, { fill: liq('#7A1028', 0.15) }) +
        ellipse(cx, 390, 86, 12, { fill: '#A42A44' })
    )
    out += path(d, stroke('#FFFFFF', 5, { 'stroke-opacity': 0.9 }))
    out += bottle(340, 210, 610, 140, it.bottle)
    out += put(700, 590, 0, 1, '')
  } else if (it.water) {
    out += bottle(330, 220, 610, 150, it.bottle)
    const d = cupPath(540, 400, 600, 150, 124, 18)
    out +=
      softShadow(540, 606, 90, 12) +
      glassBack(d) +
      g(
        { 'clip-path': clipOf(path(d)) },
        rect(440, 440, 200, 200, { fill: '#DDF1FB', 'fill-opacity': 0.7 }) +
          iceCluster(540, 440, 140, rnd, 2)
      ) +
      glassFront(d, 540, 400, 600, 150)
  } else {
    out += bottle(320, 200, 610, 140, it.bottle)
    out += beerGlass(540, 340, 600, 150, '#F0B032', rnd)
  }
  return out
}

// ============================================================ Khuôn riêng của Quán Vườn Dừa
// Mì/hủ tiếu xào: ụ sợi vun trên đĩa, topping theo món
function moldStirNoodle(it, rnd) {
  let out = dish(CX, PY, PRX, PRY, { rim: it.rim })
  const cx = CX
  const cy = PY - 10
  out += ellipse(cx, cy + 4, 196, 70, { fill: it.base })
  out += ellipse(cx, cy - 40, 160, 76, { fill: it.base })
  out += strands(
    rnd,
    it.n ?? 150,
    cx,
    cy - 10,
    185,
    70,
    80,
    it.colors,
    it.len ?? 70,
    it.width ?? 5,
    it.curl ?? 0.6
  )
  for (const tp of it.tops) {
    if (tp === 'sprouts')
      out += strands(rnd, 34, cx, cy - 40, 160, 50, 30, ['#F7F4E6', '#EDE8CF'], 40, 6, 0.2)
    if (tp === 'chives')
      out += strands(rnd, 26, cx, cy - 44, 160, 50, 30, ['#3F8A2E', '#4E9A36'], 80, 4, 0.1)
    if (tp === 'beef')
      out += strew(
        rnd,
        11,
        cx,
        cy - 46,
        150,
        46,
        44,
        () =>
          path('M-28 -2Q-22 -14 -4 -12Q6 -16 20 -10Q30 -4 26 4Q20 12 2 10Q-20 12 -28 -2Z', {
            fill: '#6A3218',
            stroke: '#4A200C',
            'stroke-width': 2,
          }) + ellipse(-8, -6, 12, 3, { fill: '#FFFFFF', 'fill-opacity': 0.28 }),
        40
      )
    if (tp === 'shrimp')
      out += strew(
        rnd,
        4,
        cx,
        cy - 50,
        140,
        40,
        80,
        () => put(0, 0, 0, 0.8, shrimp('#F28A6A', { peeled: true })),
        40
      )
    if (tp === 'squid')
      out += strew(rnd, 4, cx, cy - 46, 150, 44, 70, () => put(0, 0, 0, 0.8, squidPiece(28)), 40)
    if (tp === 'greens')
      out += strew(
        rnd,
        6,
        cx,
        cy - 40,
        160,
        50,
        60,
        () =>
          path('M-40 0Q-14 -12 8 -6L8 6Q-14 12 -40 0Z', { fill: '#E2EFC8' }) +
          ellipse(24, 0, 24, 14, { fill: '#3F8A36' }) +
          path('M8 0H40', stroke('#7DBA5A', 2)),
        40
      )
    if (tp === 'carrot')
      out += strew(
        rnd,
        7,
        cx,
        cy - 44,
        150,
        46,
        40,
        () => circle(0, 0, 13, { fill: '#F2792B' }) + circle(0, 0, 5, { fill: '#F7A35C' }),
        40
      )
  }
  out += put(cx - 10, cy - 132, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  return out
}
// Bún thịt nướng chả giò: tô rộng, bún trắng, thịt nướng, chả giò cắt khoanh, rau, đồ chua, đậu phộng
function moldBunBowl(it, rnd) {
  let out = bowl(CX - 20, 420, 270, 190, {
    body: '#FFFFFF',
    band: it.band,
    motif: true,
    k: 0.34,
    fill: (c) => {
      let s = ellipse(c.cx, c.cy + 6, c.rx, c.ry, { fill: '#F4F1E8' })
      s += strands(
        rnd,
        150,
        c.cx,
        c.cy + 6,
        c.rx * 0.9,
        c.ry * 0.8,
        0,
        ['#FFFFFF', '#ECE7DA'],
        36,
        4,
        0.8
      )
      s += put(c.cx - c.rx * 0.6, c.cy - 4, -10, 0.75, lettuce(60, '#86C451', rnd))
      s += strew(rnd, 4, c.cx - c.rx * 0.62, c.cy + 6, 50, 24, 30, () =>
        sprig(rnd, '#3F9D4A', 28, 3)
      )
      s += strands(
        rnd,
        26,
        c.cx + c.rx * 0.6,
        c.cy,
        60,
        26,
        0,
        ['#F2792B', '#F59A4A', '#FFFDF4'],
        30,
        5
      )
      s += strew(rnd, 7, c.cx + 6, c.cy, c.rx * 0.38, c.ry * 0.5, 46, () => {
        let m = meatChunk(26, '#A8541E')
        m += line(-16, -10, -4, 12, stroke('#4A1A08', 4, { 'stroke-opacity': 0.55 }))
        return m + line(4, -12, 16, 10, stroke('#4A1A08', 4, { 'stroke-opacity': 0.55 }))
      })
      s += strew(rnd, 4, c.cx + c.rx * 0.34, c.cy + c.ry * 0.4, 70, 18, 52, () => {
        let r = ellipse(0, 0, 26, 18, { fill: '#D9902E', stroke: '#B06A1A', 'stroke-width': 2 })
        r += ellipse(0, 0, 19, 12, { fill: '#C98A6A' })
        return r + circle(-6, -3, 3, { fill: '#7FB04A' }) + circle(6, 3, 2.6, { fill: '#F2792B' })
      })
      s += strew(rnd, 18, c.cx, c.cy, c.rx * 0.6, c.ry * 0.6, 18, () => peanut(6))
      s += strew(rnd, 14, c.cx, c.cy - 4, c.rx * 0.6, c.ry * 0.6, 22, () => scallionRing(5))
      return g({ 'clip-path': c.clip }, s)
    },
  })
  out += sauceBowl(
    650,
    600,
    58,
    '#E8A85C',
    put(-10, 4, 0, 1, chiliRing(6)) + put(12, 0, 0, 1, carrotCube(8))
  )
  return out
}
// Cơm tấm sườn bì chả: ụ cơm tấm, miếng sườn cốt lết nướng có mỡ hành, bì, chả trứng, dưa leo cà chua
function moldComTam(it, rnd) {
  let out = dish(CX, PY + 10, 320, 150, { rim: it.rim })
  // cơm tấm
  const rx = 128
  const bx = 250
  const by = 560
  const dome = `M${bx - rx} ${by}C${bx - rx} ${by - 160} ${bx + rx} ${by - 160} ${bx + rx} ${by}A${rx} 40 0 0 1 ${bx - rx} ${by}Z`
  out += path(dome, {
    fill: linGrad([
      [0, '#FFFFFF'],
      [0.6, '#F4EFE2'],
      [1, '#DCD5C2'],
    ]),
    stroke: '#D4CCB6',
    'stroke-width': 3,
  })
  let grains = ''
  for (let i = 0; i < 110; i++) {
    const x = bx - rx + rnd() * rx * 2
    const y = by - 6 - rnd() * 116
    grains += ellipse(x, y, 4, 2.6, {
      fill: 'none',
      stroke: '#DAD3C0',
      'stroke-width': 1.6,
      transform: rot(rnd() * 180, x, y),
    })
  }
  out += g({ 'clip-path': clipOf(path(dome)) }, grains)
  out += put(bx + 10, by - 128, 0, 1, sprig(rnd, '#3F9D4A', 26, 3))
  // sườn cốt lết
  const chop =
    'M-150 -10C-160 -64 -80 -92 10 -86C100 -80 160 -50 156 4C152 56 80 82 -10 80C-100 78 -144 40 -150 -10Z'
  let s = path(chop, {
    fill: vGrad('#C66A28', '#7E3510'),
    stroke: '#5E260A',
    'stroke-width': 3,
  })
  let tex = ''
  for (let i = 0; i < 6; i++)
    tex += line(
      -150 + i * 60,
      -100,
      -110 + i * 60,
      100,
      stroke('#3E1606', 8, { 'stroke-opacity': 0.4 })
    )
  tex += path('M-120 -50Q0 -80 120 -40', stroke('#FFFFFF', 10, { 'stroke-opacity': 0.22 }))
  tex += path('M-100 40Q-20 60 110 30', stroke('#F2E2C8', 8, { 'stroke-opacity': 0.45 }))
  s += g({ 'clip-path': clipOf(path(chop)) }, tex)
  s += path('M118 -58Q150 -36 156 -4', stroke('#F1E4CB', 12))
  s += strew(rnd, 16, 0, -10, 110, 50, 24, () => scallionRing(6))
  s += dots(rnd, 14, 0, -10, 110, 50, 3, '#7DCB5A')
  out += put(486, 476, -8, 0.92, s)
  // bì
  out += strands(rnd, 46, 420, 606, 80, 22, 16, ['#F1E4C8', '#F8EFDC', '#E6D3AE'], 36, 4, 0.5)
  out += dots(rnd, 30, 420, 598, 70, 18, 2.4, '#C99A5A')
  // chả trứng
  out += put(590, 590, 0, 1, cube(86, '#F4C53E', '#D58A52', '#BF7442'))
  out +=
    dots(rnd, 8, 570, 602, 20, 10, 2.4, '#8A4A2A') + dots(rnd, 8, 612, 602, 20, 10, 2.4, '#8A4A2A')
  // dưa leo, cà chua
  out += put(670, 500, 0, 1, cucumberSlice(24)) + put(684, 540, 0, 1, cucumberSlice(22))
  out += put(662, 456, 0, 1, tomatoWedge(24))
  return out
}
// Mực xào sa tế: mực khứa trong sốt sa tế đỏ, hành tây, ớt chuông
function moldStirFry(it, rnd) {
  let out = dish(CX, PY, PRX, PRY, { rim: it.rim })
  const cx = CX
  const cy = PY - 10
  out += ellipse(cx, cy + 10, 220, 92, { fill: '#C8401E', 'fill-opacity': 0.88 })
  out += ellipse(cx - 70, cy + 40, 90, 12, { fill: '#FFFFFF', 'fill-opacity': 0.2 })
  const pts = scatter(rnd, 17, cx, cy - 10, 190, 74, 46, 40)
  pts.forEach((p, i) => {
    const k = i % 4
    if (k === 0 || k === 2)
      out += put(
        p.x,
        p.y,
        p.t * 120,
        0.9,
        squidPiece(30) + dots(rnd, 9, 0, 0, 24, 14, 3.4, '#D8401C', 0.85)
      )
    else if (k === 1)
      out += put(
        p.x,
        p.y,
        p.t * 180,
        1,
        path('M-34 6Q0 -26 34 6', stroke('#B4588C', 13)) +
          path('M-34 6Q0 -26 34 6', stroke('#F4E6EE', 8))
      )
    else
      out += put(
        p.x,
        p.y,
        p.t * 180,
        1,
        rect(-32, -8, 64, 16, { rx: 7, fill: p.t > 0.5 ? '#D93A2B' : '#4E9A2A' }) +
          rect(-24, -5, 30, 4, { rx: 2, fill: '#FFFFFF', 'fill-opacity': 0.4 })
      )
  })
  out += strew(rnd, 8, cx, cy - 40, 160, 50, 30, () => chiliRing(7), 30)
  out += strew(rnd, 10, cx, cy - 40, 160, 50, 24, () => path('M-10 0h20', stroke('#4FA83D', 6)), 30)
  out += dots(rnd, 50, cx, cy - 20, 180, 66, 3, '#E8502A', 0.8)
  out += put(cx + 10, cy - 70, 0, 1, sprig(rnd, '#3F9D4A', 30, 3))
  return out
}
// Lá dừa: sống lá cong và các lá chét xòe hai bên (trang trí nền)
function palmFrond(len, color, rnd) {
  let o = path(
    `M0 0Q${len * 0.5} ${-len * 0.22} ${len} ${-len * 0.05}`,
    stroke(shade(color, 0.2), 8)
  )
  for (let i = 1; i < 12; i++) {
    const t = i / 12
    const x = len * t
    const y = -len * 0.22 * 4 * t * (1 - t) * 0.5 - len * 0.05 * t * t
    const l = len * 0.32 * (1 - t * 0.55)
    for (const k of [-1, 1])
      o += put(
        x,
        y,
        k * (58 - t * 18) + 10 + (rnd() - 0.5) * 6,
        1,
        narrowLeaf(l, k > 0 ? color : tint(color, 0.12))
      )
  }
  return o
}
// Dừa tươi nguyên trái: vỏ xanh, phần trên gọt trắng, lỗ khoét, ống hút; lá dừa phía sau
function moldCoconut(it, rnd) {
  let out = put(120, 600, -38, 1, palmFrond(420, '#3E9142', rnd))
  out += put(700, 590, -142, 1, palmFrond(400, '#4FA34A', rnd))
  out += softShadow(CX, 650, 190, 24, 0.35)
  const body =
    'M332 262L468 262C520 300 562 362 562 452C562 574 492 646 400 646C308 646 238 574 238 452C238 362 280 300 332 262Z'
  out += path(body, {
    fill: linGrad([
      [0, '#86C24A'],
      [0.35, '#6DAF3A'],
      [1, '#3A7420'],
    ]),
    stroke: '#2F6A1C',
    'stroke-width': 3,
  })
  const shaved =
    'M332 262L468 262C506 290 534 326 550 372Q520 396 490 380Q462 404 432 388Q402 408 372 388Q342 404 312 382Q280 398 250 372C266 326 294 290 332 262Z'
  let tex = path(shaved, {
    fill: linGrad([
      [0, '#F6F1D8'],
      [0.5, '#EAE3BF'],
      [1, '#CFC694'],
    ]),
  })
  for (const x of [300, 350, 400, 450, 500])
    tex += path(`M${400 + (x - 400) * 0.45} 266L${x} 392`, stroke('#D9D0A2', 3))
  tex += ellipse(330, 520, 40, 90, { fill: '#FFFFFF', 'fill-opacity': 0.14 })
  out += g({ 'clip-path': clipOf(path(body)) }, tex)
  out += ellipse(400, 262, 68, 16, { fill: '#FBF8EA', stroke: '#D9D0A2', 'stroke-width': 3 })
  out += ellipse(400, 264, 30, 8, { fill: '#DCE8C4' })
  out += straw(420, 120, 268, 14, it.straw, 22)
  return out
}

// ============================================================ Khuôn ly cà phê (lấy từ dự án 02)
// Ly cao có đá (cà phê, bạc xỉu, cà phê muối, cốt dừa, cacao)
function moldIceGlass(it, rnd) {
  const c = tallCup(250, 600, 236, 196)
  const liqTop = c.top + 44
  let out = softShadow(CX, c.bot + 8, 140, 18)
  let inner = liquidLayers(CX, liqTop, c.bot, c.wT, it.layers, c.clip)
  if (it.slush)
    inner += g(
      { 'clip-path': c.clip },
      range(46)
        .map(() =>
          circle(
            CX - 110 + rnd() * 220,
            liqTop + 14 + rnd() * (c.bot - liqTop) * it.slush,
            3 + rnd() * 3,
            {
              fill: '#FFFFFF',
              'fill-opacity': 0.75,
            }
          )
        )
        .join('')
    )
  if (it.foam) {
    const fh = 80
    inner += g(
      { 'clip-path': c.clip },
      path(
        `M${CX - 200} ${liqTop - 20}H${CX + 200}V${liqTop + fh}q-30 14 -60 0t-60 0t-60 0t-60 0t-60 0t-60 0Z`,
        { fill: it.foam }
      ) +
        range(9)
          .map((i) =>
            circle(
              CX - 90 + i * 22 + (rnd() - 0.5) * 10,
              liqTop + 10 + (rnd() - 0.5) * 30,
              3 + rnd() * 2,
              {
                fill: '#FFFFFF',
              }
            )
          )
          .join('')
    )
    inner += ellipse(CX, liqTop, c.wT / 2 - 2, 11, { fill: tint(it.foam, 0.4) })
  }
  if (it.ice)
    inner += g(
      { 'clip-path': c.clip },
      iceCluster(CX, liqTop + (it.foam ? 70 : 0), c.wT, rnd, it.foam ? 3 : 4)
    )
  if (it.dust) inner += dots(rnd, 30, CX, liqTop, c.wT * 0.4, 8, 3, it.dust)
  out += glassBack(c.d) + inner
  if (it.straw) out += straw(CX + 52, c.top - 100, c.bot - 60, 12, it.straw, 22)
  out += glassFront(c.d, CX, c.top, c.bot, c.wT)
  if (it.coconutTop)
    out += strew(rnd, 14, CX - 10, c.top - 6, 96, 14, 20, () =>
      ellipse(0, 0, 13, 5, { fill: '#FFFDF4', stroke: '#E2D3B0', 'stroke-width': 2 })
    )
  return out
}
// Tách thủy tinh thấp có quai, nóng (kem trứng, hơi nóng)
function moldHotCup(it, rnd) {
  const top = 356
  const bot = 590
  const wT = 250
  const wB = 214
  const cx = 386
  const d = cupPath(cx, top, bot, wT, wB, 40)
  const clip = clipOf(path(d))
  const liqTop = top + 40
  let out =
    ellipse(cx, bot + 4, 200, 34, { fill: '#FFFFFF', 'fill-opacity': 0.75 }) +
    ellipse(cx, bot + 2, 150, 20, { fill: '#FFFFFF', 'fill-opacity': 0.55 })
  const hx = cx + wT / 2 - 6
  const handle = `M${hx} ${top + 54}C${hx + 96} ${top + 44} ${hx + 96} ${top + 190} ${cx + wB / 2 - 6} ${top + 196}`
  out += path(handle, stroke('#FFFFFF', 28, { 'stroke-opacity': 0.92 }))
  out += path(handle, stroke(it.bg, 10, { 'stroke-opacity': 0.9 }))
  out += glassBack(d)
  out += liquidLayers(cx, liqTop, bot, wT, it.layers, clip)
  // kem trứng đánh bông vun lên trên miệng tách
  out += g({ 'clip-path': clip }, rect(cx - 200, liqTop - 30, 400, 92, { fill: it.foamDome }))
  out += path(
    `M${cx - wT / 2 + 4} ${top + 6}C${cx - wT / 2 - 6} ${top - 110} ${cx + wT / 2 + 6} ${top - 110} ${cx + wT / 2 - 4} ${top + 6}Z`,
    { fill: tint(it.foamDome, 0.12) }
  )
  out += path(
    `M${cx - 70} ${top - 40}q30 -26 70 -18`,
    stroke('#FFFFFF', 8, { 'stroke-opacity': 0.8 })
  )
  out += range(10)
    .map(() =>
      circle(cx - 90 + rnd() * 180, top - 50 + rnd() * 30, 3, {
        fill: '#6B3E1E',
        'fill-opacity': 0.8,
      })
    )
    .join('')
  out += glassFront(d, cx, top, bot, wT)
  out += steam(cx, top - 96, shade(it.bg, 0.45))
  return out
}

const MOLDS = {
  rolls: moldRolls,
  soupCup: moldSoupCup,
  friedPile: moldFriedPile,
  fries: moldFries,
  banhXeo: moldBanhXeo,
  salad: moldSalad,
  freshRolls: moldFreshRolls,
  fish: moldFish,
  shrimpPile: moldShrimpPile,
  crab: moldCrab,
  grilledSquid: moldGrilledSquid,
  clams: moldClams,
  oysters: moldOysters,
  sizzler: moldSizzler,
  roastChicken: moldRoastChicken,
  ribs: moldRibs,
  porkBelly: moldPorkBelly,
  laLot: moldLaLot,
  clayPot: moldClayPot,
  boiledChicken: moldBoiledChicken,
  hotpot: moldHotpot,
  veggiePlatter: moldVeggiePlatter,
  friedRice: moldFriedRice,
  riceBowl: moldRiceBowl,
  crispyNoodle: moldCrispyNoodle,
  glassNoodle: moldGlassNoodle,
  porridge: moldPorridge,
  greens: moldGreens,
  canhChua: moldCanhChua,
  okra: moldOkra,
  dessertCup: moldDessertCup,
  fruitPlatter: moldFruitPlatter,
  flan: moldFlan,
  coconutJelly: moldCoconutJelly,
  stirNoodle: moldStirNoodle,
  bunBowl: moldBunBowl,
  comTam: moldComTam,
  stirFry: moldStirFry,
  coconut: moldCoconut,
  iceGlass: moldIceGlass,
  hotCup: moldHotCup,
  juice: moldJuice,
  tallGlass: moldTallGlass,
  mojito: moldMojito,
  drinkCan: moldDrinkCan,
  drinkBottle: moldDrinkBottle,
}

// ============================================================ Cấu hình từng món
const BLUE = '#2F5DA8'
const GREEN = '#15803D'
const COFFEE = '#3B241A'
const L = (frac, color) => ({ frac, color })
// Trang trí lon bia (không chữ, không logo): dải màu ngang
const band = (y, h, fill) => (cx, top, bot, rx) => rect(cx - rx, top + y, 2 * rx, h, { fill })
const canDecor =
  (...parts) =>
  (...a) =>
    parts.map((p) => p(...a)).join('')
const ITEMS = {
  // Khai vị
  M001: { mold: 'freshRolls', rim: BLUE },
  M002: { mold: 'rolls', roll: '#E3A23C', filling: '#F2B8A0', net: true, rim: GREEN },
  M003: { mold: 'fries' },
  M004: {
    mold: 'salad',
    base: '#EFE6CC',
    colors: ['#F4EEDB', '#EADFC2', '#FBF7EA'],
    len: 70,
    width: 11,
    curl: 0.05,
    tops: ['carrot', 'pork', 'shrimp'],
    narrow: true,
    herbs: 6,
    peanut: true,
    rim: GREEN,
  },
  M005: {
    mold: 'friedPile',
    piece: 'squidGlaze',
    n: 12,
    gap: 62,
    topping: 'garlicChili',
    sauce: '#C9782F',
    rim: BLUE,
  },
  M006: {
    mold: 'friedPile',
    piece: 'tofu',
    n: 10,
    gap: 74,
    topping: 'lemongrass',
    sauce: '#7A4A28',
  },
  M007: { mold: 'laLot' },
  M008: {
    mold: 'salad',
    base: '#D8E39A',
    colors: ['#D5E08E', '#C4D578', '#E6EBB0', '#B9CE6A'],
    len: 64,
    width: 8,
    curl: 0.15,
    nStrands: 140,
    tops: ['carrot', 'driedFish'],
    narrow: true,
    herbs: 7,
    peanut: true,
    lime: true,
    rim: '#C2410C',
  },
  M009: {
    mold: 'friedPile',
    piece: 'wing',
    n: 7,
    gap: 92,
    mound: 50,
    topping: 'garlicChili',
    sauce: '#E8A85C',
  },
  // Món chính
  M010: { mold: 'banhXeo', rim: GREEN },
  M011: {
    mold: 'friedRice',
    rice: '#F2CF62',
    molded: true,
    tops: ['carrot', 'pea', 'egg', 'sausage', 'shrimp'],
    rim: BLUE,
  },
  M012: { mold: 'friedRice', rice: '#EFDDAA', tops: ['egg', 'saltFish', 'scallion'], rim: GREEN },
  M013: {
    mold: 'stirNoodle',
    base: '#D9A23A',
    colors: ['#F2C14E', '#E8AE3A', '#F7D47A', '#D99A2B'],
    width: 5,
    len: 70,
    curl: 0.7,
    tops: ['greens', 'carrot', 'squid', 'shrimp'],
    rim: BLUE,
  },
  M014: {
    mold: 'stirNoodle',
    base: '#CFA56C',
    colors: ['#E2C08C', '#D4A970', '#EDD3A6', '#C9965A'],
    width: 12,
    len: 80,
    curl: 0.4,
    n: 170,
    tops: ['sprouts', 'beef', 'chives'],
  },
  M015: { mold: 'bunBowl', band: GREEN },
  M016: { mold: 'comTam', rim: BLUE },
  M017: { mold: 'clayPot', content: 'fish', sauce: '#7A3A12' },
  M018: { mold: 'canhChua', soup: '#EE8A3C', band: GREEN },
  M019: { mold: 'roastChicken', skin: '#D9541E', chiliSalt: true, side: 'herbs', rim: GREEN },
  M020: { mold: 'ribs', honey: true },
  M021: { mold: 'sizzler' },
  M022: { mold: 'shrimpPile', shell: '#D9531E', salted: true, rim: BLUE },
  M023: { mold: 'greens', kind: 'morningGlory', rim: GREEN },
  M024: { mold: 'stirFry', rim: BLUE },
  // Lẩu
  M025: {
    mold: 'hotpot',
    pot: 'steel',
    broth: '#E2552B',
    items: ['lemongrass', 'fish', 'clam', 'squid', 'shrimp', 'mushroom', 'chili', 'limeLeaf'],
  },
  M026: {
    mold: 'hotpot',
    pot: 'clay',
    broth: '#7E5A30',
    items: ['eggplant', 'pork', 'fish', 'squid', 'shrimp', 'chili'],
    side: 'veggies',
  },
  M027: {
    mold: 'hotpot',
    pot: 'enamel',
    broth: '#E9BE55',
    items: ['bamboo', 'chicken', 'mushroom', 'herbE', 'chili'],
  },
  M028: {
    mold: 'hotpot',
    pot: 'steel',
    broth: '#EFE2BF',
    items: ['lemongrass', 'pineapple', 'onion', 'chili'],
    side: 'beef',
  },
  M029: {
    mold: 'hotpot',
    pot: 'copper',
    broth: '#D9C37A',
    items: ['tomato', 'fishKeo', 'giang', 'chili'],
  },
  // Cà phê
  M030: { mold: 'tallGlass', layers: [L(1, COFFEE)], straw: '#111111', phin: true },
  M031: {
    mold: 'iceGlass',
    layers: [L(0.6, '#E7CFAF'), L(0.4, '#C19467')],
    ice: true,
    straw: '#B45309',
  },
  M032: {
    mold: 'iceGlass',
    layers: [L(1, '#4A2C1E')],
    foam: '#F3E3C2',
    ice: true,
    straw: '#78350F',
  },
  M033: {
    mold: 'iceGlass',
    layers: [L(0.32, '#5A3828'), L(0.68, '#F5EFE4')],
    slush: 0.7,
    coconutTop: true,
    straw: GREEN,
  },
  M034: { mold: 'hotCup', layers: [L(1, '#4A2C1E')], foamDome: '#F7DD9A' },
  M035: {
    mold: 'iceGlass',
    layers: [L(1, '#8A4E33')],
    ice: true,
    dust: '#4A2414',
    straw: '#BE185D',
  },
  // Trà và nước ép
  M036: {
    mold: 'tallGlass',
    layers: [L(0.5, '#D9A82E'), L(0.5, '#EBC75A')],
    kumquat: true,
    straw: GREEN,
  },
  M037: {
    mold: 'tallGlass',
    layers: [L(0.5, '#C9692A'), L(0.5, '#E8963E')],
    peach: true,
    orange: true,
    lemongrass: true,
  },
  M038: {
    mold: 'tallGlass',
    layers: [L(0.5, '#F2C9D2'), L(0.5, '#FBE4EA')],
    lychee: true,
    straw: '#E0527F',
  },
  M039: { mold: 'juice', layers: [L(1, '#F7A52A')], fruit: 'orange', straw: '#7C3AED', ice: true },
  M040: { mold: 'juice', layers: [L(1, '#F0566A')], fruit: 'watermelon', straw: GREEN, ice: true },
  M041: {
    mold: 'juice',
    layers: [L(0.4, '#B7D36E'), L(0.6, '#CFE290')],
    fruit: 'avocado',
    straw: GREEN,
  },
  M042: { mold: 'coconut', straw: '#E0527F' },
  // Bia và nước ngọt
  M043: {
    mold: 'drinkCan',
    ice: true,
    can: {
      body: '#0E5E34',
      decor: canDecor(
        band(110, 96, '#D9A93A'),
        band(118, 5, '#FFFFFF'),
        band(193, 5, '#FFFFFF'),
        (cx, top) => circle(cx, top + 158, 20, { fill: '#0E5E34' })
      ),
    },
  },
  M044: {
    mold: 'drinkCan',
    can: {
      body: '#B3202A',
      decor: canDecor(
        band(104, 110, '#F4EFE2'),
        band(112, 8, '#D9A93A'),
        band(198, 8, '#D9A93A'),
        (cx, top) => circle(cx, top + 159, 22, stroke('#B3202A', 6))
      ),
    },
  },
  M045: {
    mold: 'drinkCan',
    ice: true,
    can: {
      body: '#D9A021',
      decor: canDecor(
        band(96, 120, '#7A1F1A'),
        band(104, 4, '#F6D77A'),
        band(204, 4, '#F6D77A'),
        (cx, top) =>
          range(3)
            .map((i) => rect(cx - 40 + i * 30, top + 140, 20, 36, { rx: 4, fill: '#F6D77A' }))
            .join('')
      ),
    },
  },
  M046: {
    mold: 'drinkCan',
    can: {
      body: '#1E3A8A',
      decor: canDecor(
        band(120, 70, '#F59E0B'),
        band(196, 8, '#FFFFFF'),
        band(112, 4, '#FFFFFF'),
        (cx, top) => circle(cx, top + 154, 22, { fill: '#1E3A8A' })
      ),
    },
  },
  M047: {
    mold: 'drinkCan',
    ice: true,
    drink: '#F4CF6A',
    can: {
      body: '#B8C4D2',
      decor: canDecor(
        band(124, 54, '#1E3A8A'),
        band(108, 6, '#7FB2E5'),
        band(188, 6, '#7FB2E5'),
        (cx, top) => circle(cx, top + 151, 16, { fill: '#7FB2E5' })
      ),
    },
  },
  M048: {
    mold: 'drinkCan',
    can: {
      body: '#13803E',
      decor: canDecor(
        band(110, 96, '#F4F6F2'),
        band(120, 6, '#0B5C2A'),
        band(190, 6, '#0B5C2A'),
        (cx, top) => circle(cx, top + 158, 14, { fill: '#D7262B' })
      ),
    },
  },
  M049: {
    mold: 'drinkCan',
    cola: true,
    can: {
      body: '#D7141A',
      decor: (cx, top, bot, rx) =>
        path(
          `M${cx - rx} ${top + 200}C${cx - 30} ${top + 150} ${cx + 30} ${top + 250} ${cx + rx} ${top + 170}L${cx + rx} ${top + 190}C${cx + 30} ${top + 270} ${cx - 30} ${top + 170} ${cx - rx} ${top + 220}Z`,
          { fill: '#FFFFFF' }
        ),
    },
  },
  M050: {
    mold: 'drinkBottle',
    water: true,
    bottle: {
      glass: '#CFEAF7',
      clear: true,
      cap: '#1D4ED8',
      neck: 50,
      shoulder: 110,
      decor: (cx, top, bot, rx, sh) =>
        range(5)
          .map((i) =>
            rect(cx - rx, sh + 50 + i * 50, 2 * rx, 6, { fill: '#FFFFFF', 'fill-opacity': 0.5 })
          )
          .join('') +
        rect(cx - rx, sh + 120, 2 * rx, 90, { fill: '#1D4ED8' }) +
        path(`M${cx - rx} ${sh + 180}q${rx * 0.5} -26 ${rx} 0t${rx} 0`, stroke('#FFFFFF', 8)),
    },
  },
}
// Căn khung theo khuôn: [tâm dọc của hình gốc, hệ số phóng]; hình được phóng quanh tâm rồi đưa về y = 430
const FIT = {
  default: [500, 1.14],
  fries: [480, 1.1],
  sizzler: [500, 1.1],
  ribs: [510, 1.1],
  clayPot: [470, 1.12],
  hotpot: [440, 1.06],
  canhChua: [460, 1.08],
  bunBowl: [470, 1.1],
  comTam: [510, 1.1],
  coconut: [440, 1.1],
  iceGlass: [420, 1.1],
  hotCup: [440, 1.14],
  juice: [450, 1.12],
  tallGlass: [430, 1.1],
  mojito: [430, 1.1],
  drinkCan: [450, 1.18],
  drinkBottle: [420, 1.14],
}
// Món chưa cấu hình: chọn khuôn theo danh mục
function fallbackItem(item) {
  const map = {
    KV: ITEMS.M002,
    MC: ITEMS.M011,
    LA: ITEMS.M025,
    CF: ITEMS.M031,
    NU: ITEMS.M039,
    BI: ITEMS.M046,
  }
  return map[item.category] ?? ITEMS.M011
}

// ============================================================ Dựng và xuất
function renderItem(item, cat) {
  defs = []
  uid = 0
  const rnd = mulberry32(hashStr(item.code))
  const cfg = ITEMS[item.code] ?? fallbackItem(item)
  const bg = tint(cat.color, 0.86)
  SHADOW = shade(cat.color, 0.5)
  const it = { ...cfg, bg }
  let body = rect(0, 0, S, S, { fill: bg })
  body += circle(400, 420, 310, { fill: tint(cat.color, 0.77) })
  body += circle(600, 150, 54, { fill: tint(cat.color, 0.7), 'fill-opacity': 0.5 })
  body += circle(140, 660, 30, { fill: tint(cat.color, 0.7), 'fill-opacity': 0.5 })
  const [fy, fs] = FIT[it.mold] ?? FIT.default
  body += g(
    { transform: `translate(400 430) scale(${fs}) translate(-400 ${-fy})` },
    MOLDS[it.mold](it, rnd)
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${defs.join('')}</defs>${body}</svg>`
}

async function encodeWebp(svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  for (let q = 86; q >= 40; q -= 6) {
    const buf = await sharp(png).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer()
    if (buf.length <= MAX_BYTES) return { buf, q, png }
  }
  throw new Error('Ảnh vượt 60 KB ở mọi mức chất lượng')
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const cats = Object.fromEntries(data.categories.map((c) => [c.code, c]))
  mkdirSync(OUT_DIR, { recursive: true })
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true })
  const sizes = []
  for (const item of data.menuItems) {
    if (ONLY && !item.code.includes(ONLY)) continue
    const cat = cats[item.category]
    if (!cat) throw new Error(`Món ${item.code} có danh mục lạ: ${item.category}`)
    const file = item.image || `${item.code}.webp`
    const svg = renderItem(item, cat)
    const { buf, q, png } = await encodeWebp(svg)
    writeFileSync(join(OUT_DIR, file), buf)
    if (PREVIEW) writeFileSync(join(PREVIEW, file.replace(/\.\w+$/, '.png')), png)
    sizes.push(buf.length)
    const mold = ITEMS[item.code]?.mold ?? 'fallback'
    console.log(
      `${file.padEnd(12)} ${item.name.padEnd(28)} ${mold.padEnd(14)} ${(buf.length / 1024).toFixed(1).padStart(6)} KB  q${q}`
    )
  }
  const max = Math.max(...sizes) / 1024
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024
  console.log(
    `Đã tạo ${sizes.length} ảnh · lớn nhất ${max.toFixed(1)} KB · trung bình ${avg.toFixed(1)} KB`
  )
}

await main()
