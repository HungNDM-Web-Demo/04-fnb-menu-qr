import type { ConfirmMode, OrderingStatus } from '@/types/menu-qr'
import { TABLE_CODE_ALPHABET } from './pos-rules'
import { vnHhmm, vnMinutesOfDay } from './vn-time'

/**
 * Giờ nhận đơn, tạm ngưng (07 §3.4, BR-07), mã bàn và đường dẫn QR (07 §3.9, BR-01).
 */

/** Giá trị đọc từ System_Settings (`Ordering.*`) */
export type OrderingSettings = {
  openTime: string // "09:00"
  closeTime: string // "22:00"
  confirmMode: ConfirmMode
  /** Rỗng: đang nhận; "manual": tới khi mở lại; ISO UTC: tạm ngưng tới lúc đó */
  pausedUntil: string
}

const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Trong giờ nhận đơn: bằng nhau = cả ngày; o < c trong ngày; o > c qua đêm */
export function withinOrderingHours(openTime: string, closeTime: string, now: number = Date.now()): boolean {
  const m = vnMinutesOfDay(now)
  const o = toMinutes(openTime)
  const c = toMinutes(closeTime)
  if (o === c) return true
  return o < c ? o <= m && m < c : m >= o || m < c
}

export const messages = {
  pausedUntil: (hhmm: string) => `Quán tạm ngưng nhận đơn qua QR tới ${hhmm}, vui lòng gọi nhân viên`,
  pausedIndefinitely: 'Quán tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên',
  outsideHours: (open: string, close: string) => `Quán nhận đơn qua QR từ ${open} đến ${close}, vui lòng gọi nhân viên`,
  tableInactive: 'Bàn tạm ngưng nhận đơn qua QR, vui lòng gọi nhân viên',
}

/** Trạng thái nhận đơn lúc `now` (§3.4); tạm ngưng quá giờ tự nhận lại (đọc lười) */
export function orderingStatus(settings: OrderingSettings, now: number = Date.now()): OrderingStatus {
  const raw = (settings.pausedUntil ?? '').trim()
  const pausedIndefinitely = raw === 'manual'
  const untilMs = raw && !pausedIndefinitely ? Date.parse(raw) : NaN
  const pausedTimed = Number.isFinite(untilMs) && now < untilMs
  const paused = pausedIndefinitely || pausedTimed
  const inHours = withinOrderingHours(settings.openTime, settings.closeTime, now)

  let blockReason: OrderingStatus['blockReason']
  let message: string | undefined
  if (paused) {
    blockReason = 'QuanTamNgung'
    message = pausedIndefinitely ? messages.pausedIndefinitely : messages.pausedUntil(vnHhmm(untilMs))
  } else if (!inHours) {
    blockReason = 'NgoaiGioNhanDon'
    message = messages.outsideHours(settings.openTime, settings.closeTime)
  }
  return {
    accepting: !paused && inHours,
    blockReason,
    message,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    pausedUntil: pausedTimed ? new Date(untilMs).toISOString() : undefined,
    pausedIndefinitely,
    confirmMode: settings.confirmMode,
    asOf: new Date(now).toISOString(),
  }
}

/** Sinh mã bàn 6 ký tự (BR-01) bằng bộ sinh ngẫu nhiên mật mã; `taken` là mọi mã đã cấp (kể cả bàn đã xóa) */
export function tableCode(taken: Iterable<string> = []): string {
  const used = new Set([...taken].map((c) => c.toUpperCase()))
  const bytes = new Uint32Array(6)
  for (let attempt = 0; attempt < 1000; attempt++) {
    crypto.getRandomValues(bytes)
    const code = Array.from(bytes, (b) => TABLE_CODE_ALPHABET[b % TABLE_CODE_ALPHABET.length]).join('')
    if (!used.has(code)) return code
  }
  throw new Error('Không sinh được mã bàn mới')
}

/** Gốc đường dẫn công khai: NEXT_PUBLIC_PUBLIC_URL, không thì origin hiện tại */
export function publicBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')
  if (env) return env
  return typeof window !== 'undefined' ? window.location.origin : ''
}

/** Đường dẫn trong mã QR của bàn: {publicBaseUrl}/t/{mã} (§3.9) */
export const qrUrl = (code: string): string => `${publicBaseUrl()}/t/${code.toUpperCase()}`

/** Tên file ảnh QR: "Bàn 05" → "qr-ban-05.png" */
export function qrFileName(tableName: string): string {
  const slug = tableName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `qr-${slug || 'ban'}.png`
}
