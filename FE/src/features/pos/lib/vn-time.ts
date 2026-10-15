/**
 * Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) cho ngày lịch, mã chứng từ, giờ nhận đơn, "Hết trong hôm nay",
 * báo cáo (06 §3; BE `VietnamTime`). Không phụ thuộc múi giờ của máy. Chép từ demo Quản lý Nhà hàng.
 */

const OFFSET_MS = 7 * 60 * 60_000
const DAY_MS = 86_400_000

type DateInput = Date | number | string

export type VnParts = { year: number; month: number; day: number; hour: number; minute: number; isoWeekday: number }

/** Thời điểm hiện tại (ms). Một chỗ để mock và giao diện dùng chung. */
export const vnNow = (): number => Date.now()

/** Tách ngày giờ Việt Nam của một thời điểm */
export function vnParts(date: DateInput): VnParts {
  const d = new Date(new Date(date).getTime() + OFFSET_MS)
  const weekday = d.getUTCDay() // 0 = CN
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    isoWeekday: weekday === 0 ? 7 : weekday,
  }
}

/** Khóa ngày "yyyy-MM-dd" theo giờ Việt Nam */
export function vnDateKey(date: DateInput): string {
  const p = vnParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** "yyMMdd" theo giờ Việt Nam (mã DH, PB) */
export function vnYyMMdd(date: DateInput): string {
  return vnDateKey(date).slice(2).replace(/-/g, '')
}

/** Thời điểm UTC (ms) của 00:00 ngày "yyyy-MM-dd" giờ Việt Nam */
export function vnStartOfDay(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - OFFSET_MS
}

/** Thời điểm (ms) của "HH:mm" giờ Việt Nam ngày dateKey */
export function vnAt(dateKey: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return vnStartOfDay(dateKey) + (h * 60 + m) * 60_000
}

/** Cộng n ngày vào khóa ngày */
export function addDaysKey(dateKey: string, days: number): string {
  return vnDateKey(vnStartOfDay(dateKey) + days * DAY_MS + 12 * 3600_000)
}

/** Số ngày giữa hai khóa ngày (to − from) */
export function diffDaysKey(from: string, to: string): number {
  return Math.round((vnStartOfDay(to) - vnStartOfDay(from)) / DAY_MS)
}

/** "HH:mm" giờ Việt Nam */
export function vnHhmm(date: DateInput): string {
  const p = vnParts(date)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** Phút trong ngày (giờ Việt Nam), 0–1439 */
export function vnMinutesOfDay(date: DateInput): number {
  const p = vnParts(date)
  return p.hour * 60 + p.minute
}

/** ISO UTC của 00:00 ngày hôm sau theo giờ Việt Nam ("Hết trong hôm nay", BR-14) */
export function startOfNextVnDay(date: DateInput): string {
  return new Date(vnStartOfDay(addDaysKey(vnDateKey(date), 1))).toISOString()
}

/**
 * Ô ngày seed (−89…−1) → số ngày lệch thật so với hôm nay, giữ đúng thứ trong tuần (06 §5.3).
 * Giống hệt `SeedSlots.cs` của BE và demo Quản lý Nhà hàng.
 */
export function dayOffsetOfSlot(d: number, isoToday: number): number {
  if (d >= 0 || d < -84) return d
  const block = Math.floor((-d - 1) / 7)
  const role = (-d - 1) % 7
  const base = -(7 * block + 7)
  const baseIdx = (((isoToday - 1 + base) % 7) + 7) % 7
  return base + ((((role - baseIdx) % 7) + 7) % 7)
}
