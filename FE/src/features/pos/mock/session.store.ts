import { mockDb } from '@/mock/mock-db'
import type { OrderRecord, ServiceRequestRecord, TableSessionRecord } from '@/types/menu-qr'
import { vnYyMMdd } from '../lib/vn-time'
import { seedBundle } from './pos.seed'

/**
 * Phiên bàn, đơn, yêu cầu ở chế độ mock (07 §4.8):
 * - mock-db (localStorage) chỉ giữ dữ liệu HÔM NAY (phiên vắng `d`, `liveSessions`) và mọi thứ tạo trong phiên demo;
 * - lịch sử 1.320 phiên trước hôm nay là kho chỉ đọc trong bộ nhớ, dựng lại từ seed mỗi lần tải trang (không sửa).
 * Báo cáo, danh sách đọc hợp hai nguồn qua `allSessions()`, `allOrders()`, `allRequests()`.
 */

export const sessionsDb = mockDb.collection<TableSessionRecord>('table-sessions', () => seedBundle().todaySessions)
export const ordersDb = mockDb.collection<OrderRecord>('orders', () => seedBundle().todayOrders)
export const requestsDb = mockDb.collection<ServiceRequestRecord>('service-requests', () => seedBundle().todayRequests)

/** Lịch sử trước hôm nay (chỉ đọc, dùng chung — KHÔNG sửa bản ghi trả về) */
export const historySessions = (): TableSessionRecord[] => seedBundle().historySessions
export const historyOrders = (): OrderRecord[] => seedBundle().historyOrders
export const historyRequests = (): ServiceRequestRecord[] => seedBundle().historyRequests

/** Mọi phiên: lịch sử + mock-db */
export const allSessions = (): TableSessionRecord[] => [...historySessions(), ...sessionsDb.all()]
/** Mọi đơn: lịch sử + mock-db */
export const allOrders = (): OrderRecord[] => [...historyOrders(), ...ordersDb.all()]
/** Mọi yêu cầu: lịch sử + mock-db */
export const allRequests = (): ServiceRequestRecord[] => [...historyRequests(), ...requestsDb.all()]

export function findSession(id: string): { session: TableSessionRecord; readonly: boolean } | undefined {
  const live = sessionsDb.get(id)
  if (live) return { session: live, readonly: false }
  const past = historySessions().find((s) => s.id === id)
  return past ? { session: past, readonly: true } : undefined
}

export function findOrder(id: string): { order: OrderRecord; readonly: boolean } | undefined {
  const live = ordersDb.get(id)
  if (live) return { order: live, readonly: false }
  const past = historyOrders().find((o) => o.id === id)
  return past ? { order: past, readonly: true } : undefined
}

/** Đơn của một phiên (hai nguồn), theo giờ gửi tăng dần */
export function ordersOfSession(sessionId: string, source?: OrderRecord[]): OrderRecord[] {
  const list = source ?? [...historyOrders().filter((o) => o.sessionId === sessionId), ...ordersDb.filter((o) => o.sessionId === sessionId)]
  return list
    .filter((o) => o.sessionId === sessionId)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : a.code.localeCompare(b.code)))
}

// ───────────────────────── Mã chứng từ (06 §3, BR-20) ─────────────────────────

const maxSeq = (codes: string[], prefix: string) =>
  codes.reduce((max, code) => {
    if (!code.startsWith(prefix)) return max
    const n = Number(code.slice(prefix.length))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)

/** DH + yyMMdd (ngày gửi) + 4 số, nối tiếp số lớn nhất ở hai nguồn */
export function nextOrderCode(at: number | string = Date.now(), extraCodes: string[] = []): string {
  const prefix = `DH${vnYyMMdd(at)}`
  const codes = [...historyOrders().map((o) => o.code), ...ordersDb.all().map((o) => o.code), ...extraCodes]
  return `${prefix}${String(maxSeq(codes, prefix) + 1).padStart(4, '0')}`
}

/** PB + yyMMdd (ngày mở) + 4 số, nối tiếp số lớn nhất ở hai nguồn */
export function nextSessionCode(at: number | string = Date.now(), extraCodes: string[] = []): string {
  const prefix = `PB${vnYyMMdd(at)}`
  const codes = [...historySessions().map((s) => s.code), ...sessionsDb.all().map((s) => s.code), ...extraCodes]
  return `${prefix}${String(maxSeq(codes, prefix) + 1).padStart(4, '0')}`
}

/** Mã món đã từng được gọi (BR-16: khóa Xóa, gợi ý Ẩn) */
export function everOrderedMenuItemIds(): Set<string> {
  const ids = new Set<string>()
  for (const o of historyOrders()) for (const i of o.items) ids.add(i.menuItemId)
  for (const o of ordersDb.all()) for (const i of o.items) ids.add(i.menuItemId)
  return ids
}
