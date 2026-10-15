import { newId } from '@/mock/mock-helpers'
import type {
  CartLineInput,
  DiningTableRecord,
  OrderItemRecord,
  OrderRecord,
  PriceChange,
  TableSessionRecord,
} from '@/types/menu-qr'
import { itemIsSoldOut, validateChoices } from '../lib/menu-rules'
import { PosRules } from '../lib/pos-rules'
import { unitPrice } from '../lib/pricing'
import { getMenuSnapshot } from './menu.store'
import { fieldErrors, PosErrors } from './pos.errors'
import type { PosTx } from './pos.tx'
import { nextOrderCode, nextSessionCode } from './session.store'
import { readOrderingSettings } from './settings.store'

/**
 * Gửi đơn dùng chung cho khách (API công khai) và nhân viên gọi hộ (07 §2.7 bước 6–10, §2.8 "Gọi món hộ"):
 * kiểm dòng, chụp tên giá, mở phiên, trạng thái BR-08, hủy yêu cầu thanh toán đang chờ. Giống `OrderSubmission` của BE.
 */

export type SubmitInput = {
  tx: PosTx
  table: DiningTableRecord
  source: 'KhachQr' | 'NhanVien'
  lines: CartLineInput[]
  guestName?: string
  note?: string
  deviceId?: string
  clientRequestId?: string
  /** Người gọi hộ (nguồn NhanVien) */
  staff?: { id: string; name: string }
}

export type SubmitResult = {
  order: OrderRecord
  session: TableSessionRecord
  openedSession: boolean
  /** Yêu cầu thanh toán vừa tự hủy (BR-12) */
  cancelledRequestIds: string[]
  /** Đơn cũ trả lại (chống gửi trùng 10 giây) */
  duplicate?: boolean
}

const trimOrUndef = (v?: string) => {
  const t = (v ?? '').trim()
  return t ? t : undefined
}

/** CartKey (07 §3.7): mock lưu thẳng chuỗi chuẩn hóa thay cho SHA-256 */
export function cartKeyOf(guestName: string | undefined, note: string | undefined, lines: CartLineInput[]): string {
  const normalized = lines
    .map((l) => ({ menuItemId: l.menuItemId, choiceIds: [...(l.choiceIds ?? [])].sort(), note: trimOrUndef(l.note) ?? '', quantity: l.quantity }))
    .sort(
      (a, b) =>
        a.menuItemId.localeCompare(b.menuItemId) ||
        a.choiceIds.join(',').localeCompare(b.choiceIds.join(',')) ||
        a.note.localeCompare(b.note) ||
        a.quantity - b.quantity
    )
  return JSON.stringify([trimOrUndef(guestName) ?? '', trimOrUndef(note) ?? '', normalized])
}

/** Bước 6–8 (dữ liệu, món hết, giá) rồi bước 9–10 với khách; tạo đơn trong `tx` (chưa commit) */
export function submitOrder(input: SubmitInput): SubmitResult {
  const { tx, table, source } = input
  const isGuest = source === 'KhachQr'
  const lines = input.lines ?? []
  const guestName = trimOrUndef(input.guestName)
  const note = trimOrUndef(input.note)
  const now = tx.now

  // ── Bước 6: dữ liệu ──
  const errors: Record<string, string> = {}
  if (lines.length === 0) errors.lines = 'Giỏ món đang trống'
  else if (lines.length > PosRules.maxLinesPerOrder) errors.lines = 'Mỗi đơn tối đa 30 món'
  if (guestName && guestName.length > PosRules.maxGuestName) errors.guestName = 'Tên gọi tối đa 30 ký tự'
  if (note && note.length > PosRules.maxOrderNote) errors.note = 'Ghi chú tối đa 200 ký tự'

  const menu = getMenuSnapshot()
  const visibleCats = new Set(menu.categories.filter((c) => !c.isHidden).map((c) => c.id))
  const findItem = (id: string) => menu.menuItems.find((m) => m.id === id)
  lines.forEach((line, i) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > PosRules.maxQuantity) {
      errors[`lines[${i}].quantity`] = 'Số lượng từ 1 đến 20'
    }
    if ((line.note ?? '').trim().length > PosRules.maxLineNote) errors[`lines[${i}].note`] = 'Ghi chú món tối đa 100 ký tự'
    const item = findItem(line.menuItemId)
    if (!item || item.isHidden || !visibleCats.has(item.categoryId)) return // bước 7
    const check = validateChoices(item, menu.optionGroups, line.choiceIds ?? [], now)
    if (check.error) errors[`lines[${i}].choiceIds`] = check.error
  })
  if (Object.keys(errors).length > 0) throw fieldErrors(errors)

  // ── Bước 7: món ẩn, đã xóa, đang hết, lựa chọn đang hết ──
  const soldOutErrors: Record<string, string> = {}
  const soldOutLines: number[] = []
  const prepared = lines.map((line, i) => {
    const item = findItem(line.menuItemId)
    if (!item || item.isHidden || !visibleCats.has(item.categoryId)) {
      soldOutLines.push(i)
      soldOutErrors[`lines[${i}]`] = 'Món không còn trong thực đơn'
      return null
    }
    const check = validateChoices(item, menu.optionGroups, line.choiceIds ?? [], now)
    if (itemIsSoldOut(item, menu.optionGroups, now)) {
      soldOutLines.push(i)
      soldOutErrors[`lines[${i}]`] = 'Món vừa hết'
    } else if (check.soldOutChoiceName) {
      soldOutLines.push(i)
      soldOutErrors[`lines[${i}]`] = `${check.soldOutChoiceName} vừa hết`
    }
    return { line, item, options: check.options }
  })
  if (soldOutLines.length > 0) throw PosErrors.soldOut(soldOutLines, soldOutErrors)

  // ── Bước 8: giá đã đổi (chỉ khách) ──
  if (isGuest) {
    const changes: PriceChange[] = []
    prepared.forEach((p, index) => {
      if (!p) return
      const current = unitPrice(p.item.price, p.options)
      if (p.line.expectedUnitPrice === undefined || p.line.expectedUnitPrice !== current) {
        changes.push({ index, menuItemId: p.item.id, itemName: p.item.name, oldUnitPrice: p.line.expectedUnitPrice ?? 0, newUnitPrice: current })
      }
    })
    if (changes.length > 0) throw PosErrors.priceChanged(changes)
  }

  let session = tx.openSessionOf(table)
  const cartKey = isGuest ? cartKeyOf(guestName, note, lines) : undefined

  if (isGuest) {
    // ── Bước 9: cùng điện thoại, cùng giỏ trong 10 giây ──
    if (input.deviceId) {
      const since = now - PosRules.sameCartSeconds * 1000
      const same = tx.orders.find(
        (o) =>
          o.tableId === table.id &&
          o.deviceId === input.deviceId &&
          o.cartKey === cartKey &&
          new Date(o.submittedAt).getTime() >= since
      )
      if (same) {
        return { order: same, session: tx.session(same.sessionId), openedSession: false, cancelledRequestIds: [], duplicate: true }
      }
    }
    // ── Bước 10: tối đa 3 đơn chờ ──
    if (session && tx.ordersOf(session.id).filter((o) => o.status === 'ChoXacNhan').length >= PosRules.maxPendingOrders) {
      throw PosErrors.tooManyPending()
    }
  }

  // ── Tạo đơn ──
  let openedSession = false
  if (!session) {
    session = {
      id: newId(),
      code: nextSessionCode(now, tx.sessions.map((s) => s.code)),
      tableId: table.id,
      tableName: table.name,
      status: 'DangPhucVu',
      openedAt: tx.nowIso,
      needVatInvoice: false,
      version: 0,
    }
    tx.addSession(session)
    table.currentSessionId = session.id
    tx.touchTable(table)
    openedSession = true
  }

  const sessionOrders = tx.ordersOf(session.id)
  const settings = readOrderingSettings()
  let status: OrderRecord['status'] = 'ChoXacNhan'
  let autoConfirmed = false
  if (!isGuest) status = 'DaXacNhan'
  else if (settings.confirmMode === 'TuXacNhan' && sessionOrders.some((o) => o.status === 'DaXacNhan' || o.status === 'DaPhucVu')) {
    status = 'DaXacNhan'
    autoConfirmed = true
  }

  const code = nextOrderCode(now, tx.orders.map((o) => o.code))
  const items: OrderItemRecord[] = prepared.map((p, i) => {
    const { line, item, options } = p!
    const price = unitPrice(item.price, options)
    return {
      id: newId(),
      menuItemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemPrice: item.price,
      options,
      optionsPrice: price - item.price,
      unitPrice: price,
      quantity: line.quantity,
      lineTotal: price * line.quantity,
      note: trimOrUndef(line.note),
      status: status === 'DaXacNhan' ? 'DaXacNhan' : 'ChoXacNhan',
      sortOrder: i + 1,
    }
  })
  const order: OrderRecord = {
    id: newId(),
    code,
    sessionId: session.id,
    tableId: table.id,
    tableName: table.name,
    source,
    status,
    autoConfirmed,
    guestName,
    note,
    submittedAt: tx.nowIso,
    handledAt: status === 'DaXacNhan' ? tx.nowIso : undefined,
    handledById: !isGuest ? input.staff?.id : undefined,
    handledByName: !isGuest ? input.staff?.name : undefined,
    deviceId: isGuest ? input.deviceId : undefined,
    clientRequestId: input.clientRequestId,
    cartKey,
    createdById: !isGuest ? input.staff?.id : undefined,
    items,
    version: 1,
  }
  tx.addOrder(order)

  // Phiên chờ thanh toán: yêu cầu thanh toán đang chờ tự hủy, phiên về Đang phục vụ (BR-12, quyết định 11)
  const cancelledRequestIds: string[] = []
  if (session.status === 'ChoThanhToan') {
    for (const req of tx.requestsOf(session.id)) {
      if (req.type === 'ThanhToan' && req.status === 'DangCho') {
        req.status = 'DaHuy'
        req.handledAt = tx.nowIso
        tx.touchRequest(req)
        cancelledRequestIds.push(req.id)
      }
    }
    session.status = 'DangPhucVu'
  }
  tx.touchSession(session)
  return { order, session, openedSession, cancelledRequestIds }
}
