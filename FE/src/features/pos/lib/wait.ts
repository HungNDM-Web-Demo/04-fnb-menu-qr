import type { OrderStatus, WaitLevel } from '@/types/menu-qr'
import { PosRules } from './pos-rules'

/**
 * Thời gian chờ và màu (07 §3.5): đơn ChoXacNhan tính từ giờ gửi (vàng 5, đỏ 10 phút); DaXacNhan tính từ giờ xác nhận
 * (vàng 15, đỏ 25 phút); khác 0. `now` là giờ máy chủ ở FE (useServerNow).
 */
export function computeWait(
  order: { status: OrderStatus; submittedAt: string; handledAt?: string },
  now: number
): { waitMinutes: number; waitLevel: WaitLevel } {
  const minutes = (from?: string) => (from ? Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000)) : 0)
  if (order.status === 'ChoXacNhan') {
    const m = minutes(order.submittedAt)
    return { waitMinutes: m, waitLevel: m >= PosRules.pendingLateMinutes ? 'Do' : m >= PosRules.pendingWarnMinutes ? 'Vang' : 'BinhThuong' }
  }
  if (order.status === 'DaXacNhan') {
    const m = minutes(order.handledAt)
    return { waitMinutes: m, waitLevel: m >= PosRules.servingLateMinutes ? 'Do' : m >= PosRules.servingWarnMinutes ? 'Vang' : 'BinhThuong' }
  }
  return { waitMinutes: 0, waitLevel: 'BinhThuong' }
}

/** Phút chờ của yêu cầu và cờ quá hạn (BR-12) */
export function requestWait(createdAt: string, now: number) {
  const m = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000))
  return { waitMinutes: m, isOverdue: m >= PosRules.requestOverdueMinutes }
}
