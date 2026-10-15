import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission, requireSession } from '@/mock/mock-auth'
import { listQuery } from '@/mock/mock-helpers'
import { notFound } from '@/mock/mock-errors'
import { isSoldOutNow } from '@/features/pos/lib/menu-rules'
import { PosRules } from '@/features/pos/lib/pos-rules'
import { isEffectiveLine, sessionSubtotal } from '@/features/pos/lib/pricing'
import { startOfNextVnDay, vnDateKey } from '@/features/pos/lib/vn-time'
import { getMenuSnapshot, liveTables, menuItemsDb, tablesDb } from '@/features/pos/mock/menu.store'
import { submitOrder } from '@/features/pos/mock/order-submission'
import { publishPosEvent } from '@/features/pos/mock/pos-events'
import { fieldErrors, PosErrors } from '@/features/pos/mock/pos.errors'
import {
  isOpenSession,
  paymentRequestOf,
  subtotalOf,
  tableStatusOf,
  toCategoryDto,
  toMenuItemDto,
  toOptionGroupDto,
  toServiceRequestDto,
  toStaffOrderDto,
  toTableSessionDto,
} from '@/features/pos/mock/pos.mappers'
import { PosTx } from '@/features/pos/mock/pos.tx'
import {
  allOrders,
  allRequests,
  allSessions,
  everOrderedMenuItemIds,
  findOrder,
  findSession,
  ordersDb,
  requestsDb,
  sessionsDb,
} from '@/features/pos/mock/session.store'
import { currentOrderingStatus, getStoreProfile } from '@/features/pos/mock/settings.store'
import type { PaginatedResult, PaginationQuery } from '@/types/api'
import type {
  CancelOrderItemRequest,
  CancelOrderRequest,
  CheckoutRequest,
  CheckoutResultDto,
  ConfirmOrderRequest,
  CreateStaffOrderRequest,
  LiveOrdersDto,
  MenuBundle,
  OrderRecord,
  OrderSettingsDto,
  RejectOrderRequest,
  ServeOrderRequest,
  ServiceRequestDto,
  SessionStatus,
  StaffOrderDto,
  StoreProfile,
  TableBoardItem,
  TableSessionDto,
  TableSessionListItem,
  TableSessionRecord,
  TransferSessionRequest,
  UnserveOrderRequest,
} from '@/types/menu-qr'

/**
 * Handler mock của màn hình nhận đơn (07 §2.8–2.10): đơn, phiên bàn, thu tiền, yêu cầu từ bàn, gọi món hộ.
 * Mỗi thao tác ghi đi qua `PosTx` rồi phát sự kiện §2.14.
 */

const zoneOf = (tableId: string) => tablesDb.get(tableId)?.zone ?? ''
const codeOfSession = (sessionId: string, sessions: TableSessionRecord[]) => sessions.find((s) => s.id === sessionId)?.code ?? ''

function orderDto(tx: PosTx, order: OrderRecord): StaffOrderDto {
  return toStaffOrderDto(order, codeOfSession(order.sessionId, tx.sessions), tx.now)
}

/** Đơn khác ChoXacNhan khi xác nhận, từ chối → 409 DonDaXuLy kèm đơn mới nhất */
function ensurePending(tx: PosTx, order: OrderRecord) {
  if (order.status !== 'ChoXacNhan') throw PosErrors.orderHandled(orderDto(tx, order))
}

/** Trạng thái đơn sau khi phục vụ, hủy (06 §5.4) */
function refreshOrderStatus(order: OrderRecord) {
  const effective = order.items.filter((i) => isEffectiveLine(i.status))
  if (effective.length === 0) order.status = 'DaHuy'
  else if (effective.every((i) => i.status === 'DaPhucVu')) order.status = 'DaPhucVu'
  else order.status = 'DaXacNhan'
}

function emitOrderChange(orderIds: string[], tableIds: string[]) {
  publishPosEvent('orders-changed', { orderIds, tableIds })
  publishPosEvent('tables-changed', { tableIds })
}

export const liveMock = {
  // ───────────────────────── Đơn ─────────────────────────

  async liveOrders(): Promise<LiveOrdersDto> {
    await mockDelay(80, 180)
    requirePermission(permissions.orders.view)
    const now = Date.now()
    const sessions = sessionsDb.all()
    const orders = ordersDb.all()
    const dto = (o: OrderRecord) => toStaffOrderDto(o, codeOfSession(o.sessionId, sessions), now)
    return {
      asOf: new Date(now).toISOString(),
      pending: orders
        .filter((o) => o.status === 'ChoXacNhan')
        .sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1))
        .map(dto),
      serving: orders
        .filter((o) => o.status === 'DaXacNhan')
        .sort((a, b) => ((a.handledAt ?? '') < (b.handledAt ?? '') ? -1 : 1))
        .map(dto),
    }
  },

  async getOrder(id: string): Promise<StaffOrderDto> {
    await mockDelay(60, 150)
    requirePermission(permissions.orders.view)
    const found = findOrder(id)
    if (!found) throw notFound('Không tìm thấy đơn')
    const session = findSession(found.order.sessionId)
    return toStaffOrderDto(found.order, session?.session.code ?? '', Date.now())
  },

  async createStaffOrder(request: CreateStaffOrderRequest): Promise<StaffOrderDto> {
    await mockDelay(250, 450)
    const ctx = requirePermission(permissions.orders.create)
    const tx = new PosTx()
    if (request.clientRequestId) {
      const existing = tx.orders.find((o) => o.clientRequestId === request.clientRequestId)
      if (existing) return orderDto(tx, existing)
    }
    const table = tx.tables.find((t) => t.id === request.tableId && !t.isDeleted)
    if (!table) throw notFound('Không tìm thấy bàn')
    if (!table.isActive) throw PosErrors.tableOff()
    const result = submitOrder({
      tx,
      table,
      source: 'NhanVien',
      lines: request.lines,
      guestName: request.guestName,
      note: request.note,
      clientRequestId: request.clientRequestId,
      staff: { id: ctx.user.id, name: ctx.user.fullName },
    })
    tx.commit()
    publishPosEvent('order-submitted', {
      orderId: result.order.id,
      tableId: table.id,
      tableName: table.name,
      status: result.order.status,
      autoConfirmed: false,
      source: 'NhanVien',
    })
    emitOrderChange([result.order.id], [table.id])
    if (result.cancelledRequestIds.length > 0) {
      publishPosEvent('requests-changed', { requestIds: result.cancelledRequestIds, tableIds: [table.id], newRequestIds: [] })
    }
    return orderDto(tx, result.order)
  },

  async confirm(id: string, request: ConfirmOrderRequest): Promise<StaffOrderDto> {
    await mockDelay(200, 350)
    const ctx = requirePermission(permissions.orders.confirm)
    const tx = new PosTx()
    const order = tx.order(id)
    ensurePending(tx, order)
    const removed = request.removedItems ?? []
    const errors: Record<string, string> = {}
    removed.forEach((r, i) => {
      if (!order.items.some((item) => item.id === r.itemId)) errors[`removedItems[${i}].itemId`] = 'Dòng không thuộc đơn'
      else if (r.reason === 'Khac' && !(r.note ?? '').trim()) errors[`removedItems[${i}].note`] = 'Nhập lý do bỏ món'
    })
    if (Object.keys(errors).length > 0) throw fieldErrors(errors)
    const removedIds = new Set(removed.map((r) => r.itemId))
    if (order.items.every((i) => removedIds.has(i.id))) throw PosErrors.orderMustKeepItem()

    const soldOutMenuIds: string[] = []
    for (const item of order.items) {
      const r = removed.find((x) => x.itemId === item.id)
      if (r) {
        item.status = 'BiBo'
        item.removeReason = r.reason
        item.removeNote = r.reason === 'Khac' ? r.note?.trim() : undefined
        item.removedAt = tx.nowIso
        if (r.reason === 'HetMon') soldOutMenuIds.push(item.menuItemId)
      } else item.status = 'DaXacNhan'
    }
    order.status = 'DaXacNhan'
    order.handledAt = tx.nowIso
    order.handledById = ctx.user.id
    order.handledByName = ctx.user.fullName
    tx.touchOrder(order)
    tx.touchSession(tx.session(order.sessionId))
    tx.commit()

    // BR-10: món bỏ lý do "Hết món" → "Hết trong hôm nay" nếu đang còn (quyết định 17: đang hết thì giữ)
    const changedMenu: string[] = []
    for (const menuId of new Set(soldOutMenuIds)) {
      const menuItem = menuItemsDb.get(menuId)
      if (menuItem && !isSoldOutNow(menuItem.soldOutMode, menuItem.soldOutUntil, tx.now)) {
        menuItemsDb.update(menuId, { soldOutMode: 'HetHomNay', soldOutUntil: startOfNextVnDay(tx.now), updatedAt: tx.nowIso })
        changedMenu.push(menuId)
      }
    }
    if (changedMenu.length > 0) publishPosEvent('menu-changed', { menuItemIds: changedMenu, optionGroupIds: [] })
    emitOrderChange([order.id], [order.tableId])
    return orderDto(tx, order)
  },

  async reject(id: string, request: RejectOrderRequest): Promise<StaffOrderDto> {
    await mockDelay(200, 350)
    const ctx = requirePermission(permissions.orders.confirm)
    const tx = new PosTx()
    const order = tx.order(id)
    ensurePending(tx, order)
    if (!request.reason) throw fieldErrors({ reason: 'Chọn lý do từ chối' })
    if (request.reason === 'Khac' && !(request.note ?? '').trim()) throw fieldErrors({ note: 'Nhập lý do từ chối' })
    order.status = 'BiTuChoi'
    order.rejectReason = request.reason
    order.rejectNote = request.reason === 'Khac' ? request.note?.trim() : undefined
    order.handledAt = tx.nowIso
    order.handledById = ctx.user.id
    order.handledByName = ctx.user.fullName
    tx.touchOrder(order)
    const session = tx.session(order.sessionId)
    // BR-02: mọi đơn của phiên bị từ chối → phiên tự hủy, bàn về Trống
    if (tx.ordersOf(session.id).every((o) => o.status === 'BiTuChoi') && isOpenSession(session)) {
      session.status = 'DaHuy'
      session.closedAt = tx.nowIso
      const table = tx.tables.find((t) => t.id === session.tableId)
      if (table && table.currentSessionId === session.id) {
        table.currentSessionId = undefined
        tx.touchTable(table)
      }
    }
    tx.touchSession(session)
    tx.commit()
    emitOrderChange([order.id], [order.tableId])
    return orderDto(tx, order)
  },

  async serve(id: string, request: ServeOrderRequest): Promise<StaffOrderDto> {
    await mockDelay(120, 250)
    requirePermission(permissions.orders.serve)
    const tx = new PosTx()
    const order = tx.order(id)
    if (order.status === 'ChoXacNhan') throw PosErrors.orderNotConfirmed()
    if (order.status === 'BiTuChoi' || order.status === 'DaHuy') throw PosErrors.orderNotServable()
    if (!isOpenSession(tx.session(order.sessionId))) throw PosErrors.sessionClosed()
    const ids = request.itemIds ? new Set(request.itemIds) : undefined
    for (const item of order.items) {
      if (item.status === 'DaXacNhan' && (!ids || ids.has(item.id))) {
        item.status = 'DaPhucVu'
        item.servedAt = tx.nowIso
      }
    }
    refreshOrderStatus(order)
    tx.touchOrder(order)
    tx.commit()
    emitOrderChange([order.id], [order.tableId])
    return orderDto(tx, order)
  },

  async unserve(id: string, request: UnserveOrderRequest): Promise<StaffOrderDto> {
    await mockDelay(120, 250)
    requirePermission(permissions.orders.serve)
    const tx = new PosTx()
    const order = tx.order(id)
    if (!isOpenSession(tx.session(order.sessionId))) throw PosErrors.sessionClosed()
    const ids = new Set(request.itemIds ?? [])
    const lines = order.items.filter((i) => ids.has(i.id))
    if (lines.some((l) => l.status !== 'DaPhucVu')) throw PosErrors.itemNotServed()
    if (lines.some((l) => !l.servedAt || tx.now - new Date(l.servedAt).getTime() > PosRules.unserveSeconds * 1000)) {
      throw PosErrors.undoExpired()
    }
    for (const l of lines) {
      l.status = 'DaXacNhan'
      l.servedAt = undefined
    }
    refreshOrderStatus(order)
    tx.touchOrder(order)
    tx.commit()
    emitOrderChange([order.id], [order.tableId])
    return orderDto(tx, order)
  },

  async cancelItem(id: string, itemId: string, request: CancelOrderItemRequest): Promise<StaffOrderDto> {
    await mockDelay(200, 350)
    const ctx = requirePermission(permissions.orders.cancel)
    const tx = new PosTx()
    const order = tx.order(id)
    const session = tx.session(order.sessionId)
    if (!isOpenSession(session)) throw PosErrors.sessionClosed()
    if (order.status !== 'DaXacNhan' && order.status !== 'DaPhucVu') throw PosErrors.orderNotConfirmed()
    const index = order.items.findIndex((i) => i.id === itemId)
    if (index < 0) throw notFound('Không tìm thấy dòng món')
    const line = order.items[index]
    if (line.status !== 'DaXacNhan' && line.status !== 'DaPhucVu') throw PosErrors.itemNotCancellable()
    const reason = (request.reason ?? '').trim()
    if (!reason) throw fieldErrors({ reason: 'Nhập lý do hủy' })
    const qty = Number(request.quantity)
    if (!Number.isInteger(qty) || qty < 1 || qty > line.quantity) {
      throw fieldErrors({ quantity: `Số lượng hủy từ 1 đến ${line.quantity}` })
    }
    const cancelInfo = {
      status: 'DaHuy' as const,
      cancelReason: reason,
      cancelledAt: tx.nowIso,
      cancelledById: ctx.user.id,
      cancelledByName: ctx.user.fullName,
      servedAt: undefined,
    }
    if (qty === line.quantity) Object.assign(line, cancelInfo)
    else {
      // Hủy một phần: tách dòng (06 §4)
      line.quantity -= qty
      line.lineTotal = line.unitPrice * line.quantity
      const split = { ...line, ...cancelInfo, id: crypto.randomUUID(), quantity: qty, lineTotal: line.unitPrice * qty }
      order.items.splice(index + 1, 0, split)
      order.items.forEach((item, i) => (item.sortOrder = i + 1))
    }
    refreshOrderStatus(order)
    tx.touchOrder(order)
    tx.touchSession(session)
    tx.commit()
    emitOrderChange([order.id], [order.tableId])
    return orderDto(tx, order)
  },

  async cancelOrder(id: string, request: CancelOrderRequest): Promise<StaffOrderDto> {
    await mockDelay(200, 350)
    const ctx = requirePermission(permissions.orders.cancel)
    const tx = new PosTx()
    const order = tx.order(id)
    const session = tx.session(order.sessionId)
    if (!isOpenSession(session)) throw PosErrors.sessionClosed()
    if (order.status !== 'DaXacNhan' && order.status !== 'DaPhucVu') throw PosErrors.orderNotConfirmed()
    const reason = (request.reason ?? '').trim()
    if (!reason) throw fieldErrors({ reason: 'Nhập lý do hủy' })
    for (const line of order.items) {
      if (line.status === 'DaXacNhan' || line.status === 'DaPhucVu') {
        Object.assign(line, {
          status: 'DaHuy',
          cancelReason: reason,
          cancelledAt: tx.nowIso,
          cancelledById: ctx.user.id,
          cancelledByName: ctx.user.fullName,
          servedAt: undefined,
        })
      }
    }
    refreshOrderStatus(order)
    tx.touchOrder(order)
    tx.touchSession(session)
    tx.commit()
    emitOrderChange([order.id], [order.tableId])
    return orderDto(tx, order)
  },

  // ───────────────────────── Phiên bàn ─────────────────────────

  async board(): Promise<TableBoardItem[]> {
    await mockDelay(80, 180)
    requirePermission(permissions.tableSessions.view)
    const sessions = sessionsDb.all()
    const orders = ordersDb.all()
    const requests = requestsDb.all()
    return liveTables().map((t) => {
      const s = sessions.find((x) => x.id === t.currentSessionId && isOpenSession(x))
      const own = s ? orders.filter((o) => o.sessionId === s.id) : []
      return {
        tableId: t.id,
        tableName: t.name,
        zone: t.zone,
        capacity: t.capacity,
        code: t.code,
        isActive: t.isActive,
        status: tableStatusOf(t, s),
        session: s
          ? {
              id: s.id,
              code: s.code,
              status: s.status,
              openedAt: s.openedAt,
              orderCount: own.filter((o) => o.status !== 'BiTuChoi').length,
              subtotal: sessionSubtotal(own),
              pendingOrderCount: own.filter((o) => o.status === 'ChoXacNhan').length,
              unservedCount: own
                .filter((o) => o.status === 'DaXacNhan')
                .reduce((sum, o) => sum + o.items.filter((i) => i.status === 'DaXacNhan').length, 0),
              paymentRequest: paymentRequestOf(requests, s.id),
            }
          : undefined,
        pendingRequestCount: requests.filter((r) => r.tableId === t.id && r.status === 'DangCho').length,
      }
    })
  },

  async sessionDetail(id: string): Promise<TableSessionDto> {
    await mockDelay(80, 180)
    requirePermission(permissions.tableSessions.view)
    const found = findSession(id)
    if (!found) throw notFound('Không tìm thấy phiên bàn')
    const orders = found.readonly ? allOrders().filter((o) => o.sessionId === id) : ordersDb.filter((o) => o.sessionId === id)
    const requests = found.readonly ? allRequests().filter((r) => r.sessionId === id) : requestsDb.filter((r) => r.sessionId === id)
    return toTableSessionDto(found.session, orders, requests, zoneOf(found.session.tableId), Date.now())
  },

  async sessionList(query: PaginationQuery & { from?: string; to?: string; status?: SessionStatus }): Promise<PaginatedResult<TableSessionListItem>> {
    await mockDelay(120, 250)
    requirePermission(permissions.tableSessions.view)
    const today = vnDateKey(Date.now())
    const from = query.from || today
    const to = query.to || today
    const sessions = allSessions().filter((s) => {
      const key = vnDateKey(s.openedAt)
      return key >= from && key <= to && (!query.status || s.status === query.status)
    })
    const ids = new Set(sessions.map((s) => s.id))
    const orders = allOrders().filter((o) => ids.has(o.sessionId))
    const items: TableSessionListItem[] = sessions.map((s) => {
      const own = orders.filter((o) => o.sessionId === s.id)
      return {
        id: s.id,
        code: s.code,
        tableName: s.tableName,
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        total: subtotalOf(s, own),
        orderCount: own.filter((o) => o.status !== 'BiTuChoi').length,
        method: s.paymentMethod,
        closedByName: s.closedByName,
      }
    })
    return listQuery(items, query, { searchFields: ['code', 'tableName'], defaultSortBy: 'openedAt', defaultSortDir: 'desc' })
  },

  async checkout(id: string, request: CheckoutRequest): Promise<CheckoutResultDto> {
    await mockDelay(300, 500)
    const ctx = requirePermission(permissions.tableSessions.checkout)
    const tx = new PosTx()
    // 1. Gửi lại cùng clientRequestId → kết quả cũ
    if (request.clientRequestId) {
      const done = tx.sessions.find((s) => s.checkoutRequestId === request.clientRequestId)
      if (done) {
        return {
          session: toTableSessionDto(done, tx.orders, tx.requests, zoneOf(done.tableId), tx.now),
          changeAmount: done.changeAmount ?? 0,
          duplicate: true,
        }
      }
    }
    const session = tx.session(id)
    if (!isOpenSession(session)) throw PosErrors.sessionClosed()
    if (request.version !== session.version) throw PosErrors.staleVersion(session.version)
    const orders = tx.ordersOf(session.id)
    const pendingCount = orders.filter((o) => o.status === 'ChoXacNhan').length
    if (pendingCount > 0) throw PosErrors.pendingOrders(pendingCount)
    const unserved = orders
      .filter((o) => o.status === 'DaXacNhan')
      .reduce((sum, o) => sum + o.items.filter((i) => i.status === 'DaXacNhan').length, 0)
    if (unserved > 0 && !request.acknowledgeUnserved) throw PosErrors.unservedItems(unserved)
    const total = sessionSubtotal(orders)
    let cash: number | undefined
    let change: number | undefined
    if (request.method === 'TienMat') {
      if (request.cashReceived === undefined || request.cashReceived === null || Number.isNaN(Number(request.cashReceived))) {
        throw fieldErrors({ cashReceived: 'Nhập tiền khách đưa' })
      }
      cash = Number(request.cashReceived)
      if (cash < total) throw PosErrors.cashShort(total - cash)
      change = cash - total
    }
    const paymentReq = paymentRequestOf(tx.requestsOf(session.id), session.id)
    session.status = 'DaDong'
    session.total = total
    session.paymentMethod = request.method
    session.cashReceived = cash
    session.changeAmount = change
    session.needVatInvoice = request.needVatInvoice ?? paymentReq?.needVatInvoice ?? false
    session.closedAt = tx.nowIso
    session.closedById = ctx.user.id
    session.closedByName = ctx.user.fullName
    session.checkoutRequestId = request.clientRequestId
    tx.touchSession(session)
    const table = tx.tables.find((t) => t.id === session.tableId)
    if (table && table.currentSessionId === session.id) {
      table.currentSessionId = undefined
      tx.touchTable(table)
    }
    // Mọi yêu cầu đang chờ của bàn → Đã xử lý tự động (BR-13, TC-27)
    const handledIds: string[] = []
    for (const r of tx.requests) {
      if (r.tableId === session.tableId && r.status === 'DangCho') {
        r.status = 'DaXuLy'
        r.autoHandled = true
        r.handledAt = tx.nowIso
        r.handledById = ctx.user.id
        r.handledByName = ctx.user.fullName
        tx.touchRequest(r)
        handledIds.push(r.id)
      }
    }
    tx.commit()
    publishPosEvent('tables-changed', { tableIds: [session.tableId] })
    publishPosEvent('requests-changed', { requestIds: handledIds, tableIds: [session.tableId], newRequestIds: [] })
    publishPosEvent('orders-changed', { orderIds: orders.map((o) => o.id), tableIds: [session.tableId] })
    return {
      session: toTableSessionDto(session, tx.orders, tx.requests, zoneOf(session.tableId), tx.now),
      changeAmount: change ?? 0,
      duplicate: false,
    }
  },

  async transfer(id: string, request: TransferSessionRequest): Promise<TableSessionDto> {
    await mockDelay(250, 400)
    requirePermission(permissions.tableSessions.transfer)
    const tx = new PosTx()
    const session = tx.session(id)
    if (!isOpenSession(session)) throw PosErrors.sessionClosed()
    const target = tx.tables.find((t) => t.id === request.targetTableId && !t.isDeleted)
    if (!target || !target.isActive || tx.openSessionOf(target)) throw PosErrors.invalidTransferTarget()
    if (request.version !== session.version) throw PosErrors.staleVersion(session.version)
    const source = tx.table(session.tableId)
    source.currentSessionId = undefined
    tx.touchTable(source)
    target.currentSessionId = session.id
    tx.touchTable(target)
    session.transferredFromTableName = source.name
    session.tableId = target.id
    session.tableName = target.name
    tx.touchSession(session)
    for (const r of tx.requestsOf(session.id)) {
      if (r.status === 'DangCho') {
        r.tableId = target.id
        r.tableName = target.name
        tx.touchRequest(r)
      }
    }
    tx.commit()
    publishPosEvent('tables-changed', { tableIds: [source.id, target.id] })
    publishPosEvent('requests-changed', { requestIds: [], tableIds: [source.id, target.id], newRequestIds: [] })
    return toTableSessionDto(session, tx.orders, tx.requests, target.zone, tx.now)
  },

  // ───────────────────────── Yêu cầu từ bàn ─────────────────────────

  async pendingRequests(): Promise<ServiceRequestDto[]> {
    await mockDelay(60, 150)
    requirePermission(permissions.serviceRequests.view)
    const now = Date.now()
    const sessions = sessionsDb.all()
    return requestsDb
      .filter((r) => r.status === 'DangCho')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((r) => toServiceRequestDto(r, r.sessionId ? codeOfSession(r.sessionId, sessions) : undefined, now))
  },

  async handleRequest(id: string): Promise<ServiceRequestDto> {
    await mockDelay(120, 250)
    const ctx = requirePermission(permissions.serviceRequests.update)
    const tx = new PosTx()
    const req = tx.request(id)
    if (req.status === 'DaHuy') throw PosErrors.requestCancelled()
    if (req.status === 'DangCho') {
      req.status = 'DaXuLy'
      req.handledAt = tx.nowIso
      req.handledById = ctx.user.id
      req.handledByName = ctx.user.fullName
      tx.touchRequest(req)
      tx.commit()
      publishPosEvent('requests-changed', { requestIds: [id], tableIds: [req.tableId], newRequestIds: [] })
      publishPosEvent('tables-changed', { tableIds: [req.tableId] })
    }
    return toServiceRequestDto(req, req.sessionId ? codeOfSession(req.sessionId, tx.sessions) : undefined, tx.now)
  },

  // ───────────────────────── Đọc chung ─────────────────────────

  /** GET /api/menu cho Gọi món hộ (07 §2.1) */
  async menuBundle(): Promise<MenuBundle> {
    await mockDelay(120, 250)
    requirePermission(permissions.orders.create, permissions.menuItems.view)
    const now = Date.now()
    const snap = getMenuSnapshot()
    const categories = snap.categories.filter((c) => !c.isHidden)
    const catIds = new Set(categories.map((c) => c.id))
    const itemsAll = menuItemsDb.filter((m) => !m.isDeleted)
    const items = snap.menuItems.filter((m) => !m.isHidden && catIds.has(m.categoryId))
    const used = new Set(items.flatMap((m) => m.optionGroupIds))
    const everOrdered = everOrderedMenuItemIds()
    return {
      categories: categories.map((c) => toCategoryDto(c, itemsAll)),
      items: items.map((m) => toMenuItemDto(m, { categories: snap.categories, optionGroups: snap.optionGroups, everOrdered, now })),
      optionGroups: snap.optionGroups.filter((g) => used.has(g.id)).map((g) => toOptionGroupDto(g, itemsAll, now)),
    }
  },

  async orderSettings(): Promise<OrderSettingsDto> {
    await mockDelay(50, 120)
    requireSession()
    return currentOrderingStatus()
  },

  async storeProfile(): Promise<StoreProfile> {
    await mockDelay(50, 120)
    requireSession()
    return getStoreProfile()
  },
}
