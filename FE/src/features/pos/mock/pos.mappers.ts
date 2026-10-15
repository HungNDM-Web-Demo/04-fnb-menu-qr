import {
  callReasonLabels,
  paymentMethodLabels,
  rejectReasonLabels,
  removeReasonLabels,
} from '@/config/menu-qr-labels'
import type {
  CategoryDto,
  CategoryRecord,
  DiningTableDto,
  DiningTableRecord,
  MenuItemDto,
  MenuItemRecord,
  OptionGroupDto,
  OptionGroupRecord,
  OrderItemDto,
  OrderItemRecord,
  OrderRecord,
  PaymentRequestBrief,
  PublicMenu,
  PublicOrderView,
  PublicServiceRequestView,
  PublicSessionView,
  ServiceRequestDto,
  ServiceRequestRecord,
  StaffOrderDto,
  TableSessionDto,
  TableSessionRecord,
  TableStatus,
} from '@/types/menu-qr'
import { isSoldOutNow, itemIsSoldOut } from '../lib/menu-rules'
import { PosRules } from '../lib/pos-rules'
import { computeWait } from '../lib/wait'
import { isEffectiveLine, orderTotal, pendingTotal, sessionSubtotal } from '../lib/pricing'

/**
 * Bản ghi mock-db → DTO đúng 07 §2 (chữ ghép `statusText`, `rejectText`, `reasonText`; giờ chờ §3.5).
 * Dùng chung cho mọi handler mock (FE-Khách, FE-Quản lý).
 */

const MIN = 60_000
const minutesBetween = (fromIso: string | undefined, now: number) =>
  fromIso ? Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / MIN)) : 0

// ───────────────────────── Chữ ghép ─────────────────────────

/** "Không phục vụ được: Hết món" / "Đã hủy: Khách đổi ý" */
export function itemStatusText(item: OrderItemRecord): string | undefined {
  if (item.status === 'BiBo') {
    const reason = item.removeReason === 'Khac' ? item.removeNote || removeReasonLabels.Khac : removeReasonLabels.HetMon
    return `Không phục vụ được: ${reason}`
  }
  if (item.status === 'DaHuy') return `Đã hủy: ${item.cancelReason ?? ''}`.trim()
  return undefined
}

/** "Bàn không có khách" / "Khác: …" */
export function rejectTextOf(order: Pick<OrderRecord, 'status' | 'rejectReason' | 'rejectNote'>): string | undefined {
  if (order.status !== 'BiTuChoi' || !order.rejectReason) return undefined
  return order.rejectReason === 'Khac' ? `Khác: ${order.rejectNote ?? ''}` : rejectReasonLabels[order.rejectReason]
}

/** "Thêm đá" / "Khác: …" / "Thanh toán · Chuyển khoản · Cần HĐ GTGT" */
export function requestReasonText(req: Pick<ServiceRequestRecord, 'type' | 'reason' | 'note' | 'paymentMethod' | 'needVatInvoice'>): string {
  if (req.type === 'ThanhToan') {
    return `Thanh toán · ${paymentMethodLabels[req.paymentMethod ?? 'TienMat']}${req.needVatInvoice ? ' · Cần HĐ GTGT' : ''}`
  }
  if (req.reason === 'Khac') return `Khác: ${req.note ?? ''}`
  return req.reason ? callReasonLabels[req.reason] : 'Gọi nhân viên'
}

/** Thời gian chờ và màu thẻ đơn (§3.5) */
export const orderWait = (order: Pick<OrderRecord, 'status' | 'submittedAt' | 'handledAt'>, now: number) => computeWait(order, now)

// ───────────────────────── Đơn, yêu cầu ─────────────────────────

export function toOrderItemDto(item: OrderItemRecord): OrderItemDto {
  const { cancelledById: _c, removedAt: _r, ...rest } = item
  void _c
  void _r
  return { ...rest, statusText: itemStatusText(item) }
}

export function toStaffOrderDto(order: OrderRecord, sessionCode: string, now: number = Date.now()): StaffOrderDto {
  const items = [...order.items].sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    id: order.id,
    code: order.code,
    sessionId: order.sessionId,
    sessionCode,
    tableId: order.tableId,
    tableName: order.tableName,
    source: order.source,
    status: order.status,
    autoConfirmed: order.autoConfirmed,
    guestName: order.guestName,
    note: order.note,
    submittedAt: order.submittedAt,
    handledAt: order.handledAt,
    handledByName: order.handledByName,
    rejectReason: order.rejectReason,
    rejectNote: order.rejectNote,
    rejectText: rejectTextOf(order),
    total: orderTotal(items),
    itemCount: items.filter((i) => isEffectiveLine(i.status)).length,
    unservedCount: order.status === 'DaXacNhan' || order.status === 'DaPhucVu' ? items.filter((i) => i.status === 'DaXacNhan').length : 0,
    items: items.map(toOrderItemDto),
    ...orderWait(order, now),
    asOf: new Date(now).toISOString(),
  }
}

export function toServiceRequestDto(req: ServiceRequestRecord, sessionCode: string | undefined, now: number = Date.now()): ServiceRequestDto {
  const waitMinutes = req.status === 'DangCho' ? minutesBetween(req.createdAt, now) : 0
  return {
    id: req.id,
    tableId: req.tableId,
    tableName: req.tableName,
    sessionId: req.sessionId,
    sessionCode,
    type: req.type,
    reason: req.reason,
    note: req.note,
    paymentMethod: req.paymentMethod,
    needVatInvoice: req.needVatInvoice,
    reasonText: requestReasonText(req),
    status: req.status,
    createdAt: req.createdAt,
    handledAt: req.handledAt,
    handledByName: req.handledByName,
    autoHandled: req.autoHandled,
    waitMinutes,
    isOverdue: req.status === 'DangCho' && waitMinutes >= PosRules.requestOverdueMinutes,
  }
}

/** Yêu cầu thanh toán đang chờ của phiên (mới nhất) */
export function paymentRequestOf(requests: ServiceRequestRecord[], sessionId: string): PaymentRequestBrief | undefined {
  const req = requests
    .filter((r) => r.sessionId === sessionId && r.type === 'ThanhToan' && r.status === 'DangCho')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  return req
    ? { id: req.id, method: req.paymentMethod ?? 'TienMat', needVatInvoice: req.needVatInvoice, createdAt: req.createdAt, status: req.status }
    : undefined
}

// ───────────────────────── Phiên, bàn ─────────────────────────

export const isOpenSession = (s: Pick<TableSessionRecord, 'status'>) => s.status === 'DangPhucVu' || s.status === 'ChoThanhToan'

/** Trạng thái bàn suy ra (06 §4) */
export function tableStatusOf(table: DiningTableRecord, session?: TableSessionRecord): TableStatus {
  if (!table.isActive) return 'Tat'
  if (session && isOpenSession(session)) return session.status === 'ChoThanhToan' ? 'ChoThanhToan' : 'DangPhucVu'
  return 'Trong'
}

export function toTableDto(table: DiningTableRecord, session?: TableSessionRecord): DiningTableDto {
  const open = session && session.id === table.currentSessionId && isOpenSession(session) ? session : undefined
  return {
    id: table.id,
    name: table.name,
    zone: table.zone,
    capacity: table.capacity,
    code: table.code,
    codeChangedAt: table.codeChangedAt,
    isActive: table.isActive,
    sortOrder: table.sortOrder,
    status: tableStatusOf(table, open),
    currentSessionId: open?.id,
    currentSessionCode: open?.code,
    createdAt: table.createdAt,
  }
}

/** Tạm tính phiên: phiên đã đóng dùng `total` đã chốt */
export const subtotalOf = (session: TableSessionRecord, orders: OrderRecord[]) =>
  session.status === 'DaDong' && session.total !== undefined ? session.total : sessionSubtotal(orders)

export function toTableSessionDto(
  session: TableSessionRecord,
  orders: OrderRecord[],
  requests: ServiceRequestRecord[],
  zone: string,
  now: number = Date.now()
): TableSessionDto {
  const own = orders.filter((o) => o.sessionId === session.id).sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1))
  const ownRequests = requests.filter((r) => r.sessionId === session.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const dtoOrders = own.map((o) => toStaffOrderDto(o, session.code, now))
  return {
    id: session.id,
    code: session.code,
    tableId: session.tableId,
    tableName: session.tableName,
    zone,
    status: session.status,
    version: session.version,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    subtotal: subtotalOf(session, own),
    pendingTotal: pendingTotal(own),
    orders: dtoOrders,
    counts: {
      pendingOrders: own.filter((o) => o.status === 'ChoXacNhan').length,
      unservedItems: dtoOrders.reduce((sum, o) => sum + o.unservedCount, 0),
    },
    paymentRequest: paymentRequestOf(ownRequests, session.id),
    payment:
      session.status === 'DaDong'
        ? {
            method: session.paymentMethod ?? 'TienMat',
            total: session.total ?? 0,
            cashReceived: session.cashReceived,
            changeAmount: session.changeAmount,
            needVatInvoice: session.needVatInvoice,
            closedAt: session.closedAt ?? '',
            closedByName: session.closedByName ?? '',
          }
        : undefined,
    requests: ownRequests.map((r) => toServiceRequestDto(r, session.code, now)),
    transferredFromTableName: session.transferredFromTableName,
    asOf: new Date(now).toISOString(),
  }
}

// ───────────────────────── Thực đơn ─────────────────────────

export function toCategoryDto(category: CategoryRecord, items: MenuItemRecord[]): CategoryDto {
  const { isDeleted: _d, createdAt: _c, updatedAt: _u, ...rest } = category
  void _d
  void _c
  void _u
  return { ...rest, itemCount: items.filter((m) => m.categoryId === category.id && !m.isDeleted).length }
}

export function toOptionGroupDto(group: OptionGroupRecord, items: MenuItemRecord[], now: number = Date.now()): OptionGroupDto {
  return {
    id: group.id,
    name: group.name,
    nameEn: group.nameEn,
    selectionType: group.selectionType,
    isRequired: group.isRequired,
    maxSelect: group.maxSelect,
    sortOrder: group.sortOrder,
    choices: group.choices
      .filter((c) => !c.isDeleted)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.id,
        name: c.name,
        nameEn: c.nameEn,
        price: c.price,
        isDefault: c.isDefault,
        isSoldOut: isSoldOutNow(c.soldOutMode, c.soldOutUntil, now),
        soldOutMode: isSoldOutNow(c.soldOutMode, c.soldOutUntil, now) ? c.soldOutMode : undefined,
        soldOutUntil: isSoldOutNow(c.soldOutMode, c.soldOutUntil, now) ? c.soldOutUntil : undefined,
        sortOrder: c.sortOrder,
      })),
    itemCount: items.filter((m) => !m.isDeleted && m.optionGroupIds.includes(group.id)).length,
  }
}

export function toMenuItemDto(
  item: MenuItemRecord,
  ctx: { categories: CategoryRecord[]; optionGroups: OptionGroupRecord[]; everOrdered: Set<string>; now?: number }
): MenuItemDto {
  const now = ctx.now ?? Date.now()
  const ownSoldOut = isSoldOutNow(item.soldOutMode, item.soldOutUntil, now)
  const isSoldOut = itemIsSoldOut(item, ctx.optionGroups, now)
  const { isDeleted: _d, createdAt: _c, ...rest } = item
  void _d
  void _c
  return {
    ...rest,
    soldOutMode: ownSoldOut ? item.soldOutMode : undefined,
    soldOutUntil: ownSoldOut ? item.soldOutUntil : undefined,
    categoryName: ctx.categories.find((c) => c.id === item.categoryId)?.name ?? '',
    isSoldOut,
    status: item.isHidden ? 'An' : isSoldOut ? 'HetMon' : 'DangBan',
    everOrdered: ctx.everOrdered.has(item.id),
  }
}

/** Thực đơn cho khách (07 §2.7): danh mục chưa ẩn có món, món chưa ẩn, nhóm được dùng */
export function toPublicMenu(
  snapshot: { categories: CategoryRecord[]; optionGroups: OptionGroupRecord[]; menuItems: MenuItemRecord[] },
  stamp: string,
  now: number = Date.now()
): PublicMenu {
  const visibleCats = snapshot.categories.filter((c) => !c.isHidden && !c.isDeleted)
  const catIds = new Set(visibleCats.map((c) => c.id))
  const items = snapshot.menuItems.filter((m) => !m.isDeleted && !m.isHidden && catIds.has(m.categoryId))
  const usedGroupIds = new Set(items.flatMap((m) => m.optionGroupIds))
  return {
    stamp,
    categories: visibleCats
      .filter((c) => items.some((m) => m.categoryId === c.id))
      .map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn, sortOrder: c.sortOrder })),
    items: items.map((m) => ({
      id: m.id,
      code: m.code,
      categoryId: m.categoryId,
      name: m.name,
      nameEn: m.nameEn,
      description: m.description,
      descriptionEn: m.descriptionEn,
      imageUrl: m.imageUrl,
      unit: m.unit,
      price: m.price,
      tags: m.tags,
      optionGroupIds: m.optionGroupIds.filter((id) => snapshot.optionGroups.some((g) => g.id === id && !g.isDeleted)),
      isSoldOut: itemIsSoldOut(m, snapshot.optionGroups, now),
    })),
    optionGroups: snapshot.optionGroups
      .filter((g) => !g.isDeleted && usedGroupIds.has(g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        nameEn: g.nameEn,
        selectionType: g.selectionType,
        isRequired: g.isRequired,
        maxSelect: g.maxSelect,
        choices: g.choices
          .filter((c) => !c.isDeleted)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => ({
            id: c.id,
            name: c.name,
            nameEn: c.nameEn,
            price: c.price,
            isDefault: c.isDefault,
            isSoldOut: isSoldOutNow(c.soldOutMode, c.soldOutUntil, now),
          })),
      })),
  }
}

// ───────────────────────── Trang khách ─────────────────────────

export function toPublicOrderView(order: OrderRecord, deviceId?: string): PublicOrderView {
  const items = [...order.items].sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    code: order.code,
    source: order.source,
    status: order.status,
    autoConfirmed: order.autoConfirmed,
    guestName: order.guestName,
    note: order.note,
    submittedAt: order.submittedAt,
    handledAt: order.handledAt,
    rejectText: rejectTextOf(order),
    total: orderTotal(items),
    isMine: !!deviceId && order.deviceId === deviceId,
    items: items.map((i) => ({
      itemName: i.itemName,
      options: i.options.map((o) => ({ groupName: o.groupName, name: o.name, price: o.price })),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      note: i.note,
      status: i.status,
      statusText: itemStatusText(i),
    })),
  }
}

export function toPublicSessionView(
  session: TableSessionRecord,
  orders: OrderRecord[],
  requests: ServiceRequestRecord[],
  deviceId?: string,
  transferredToTableName?: string
): PublicSessionView {
  const own = orders.filter((o) => o.sessionId === session.id).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
  return {
    code: session.code,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    subtotal: subtotalOf(session, own),
    pendingTotal: pendingTotal(own),
    orders: own.map((o) => toPublicOrderView(o, deviceId)),
    paymentRequest: paymentRequestOf(requests, session.id),
    transferredToTableName,
  }
}

export function toPublicRequestView(req: ServiceRequestRecord): PublicServiceRequestView {
  return {
    id: req.id,
    type: req.type,
    reasonText: requestReasonText(req),
    status: req.status,
    createdAt: req.createdAt,
    handledAt: req.handledAt,
  }
}
