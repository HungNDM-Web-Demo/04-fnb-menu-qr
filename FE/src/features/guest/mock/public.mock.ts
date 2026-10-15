import { mockDelay } from '@/lib/data-source'
import { newId } from '@/mock/mock-helpers'
import { fieldErrors, PosErrors } from '@/features/pos/mock/pos.errors'
import { PosRules } from '@/features/pos/lib/pos-rules'
import { messages } from '@/features/pos/lib/ordering-rules'
import { currentMenuStamp, findTableByCode, getMenuSnapshot } from '@/features/pos/mock/menu.store'
import { submitOrder } from '@/features/pos/mock/order-submission'
import { publishPosEvent } from '@/features/pos/mock/pos-events'
import { PosTx } from '@/features/pos/mock/pos.tx'
import {
  isOpenSession,
  subtotalOf,
  toPublicMenu,
  toPublicOrderView,
  toPublicRequestView,
  toPublicSessionView,
} from '@/features/pos/mock/pos.mappers'
import { requestsDb, ordersDb, sessionsDb } from '@/features/pos/mock/session.store'
import { currentOrderingStatus, getPublicStoreInfo } from '@/features/pos/mock/settings.store'
import type {
  DiningTableRecord,
  PublicLiveState,
  PublicMenu,
  PublicServiceRequestInput,
  PublicServiceRequestResult,
  PublicSubmitOrderRequest,
  PublicSubmitOrderResult,
  PublicTableInfo,
  ServiceRequestRecord,
} from '@/types/menu-qr'

/**
 * API công khai cho trang khách ở chế độ mock (07 §2.7): không đăng nhập, không kiểm quyền; mã bàn là thông tin
 * xác thực duy nhất; `X-Device-Id` truyền bằng tham số. Không giả lập 429.
 */

const HOURS_4 = PosRules.endedSessionHours * 3600_000

function tableOrThrow(code: string): DiningTableRecord {
  const table = findTableByCode(code)
  if (!table) throw PosErrors.invalidQr()
  return table
}

function openSessionOf(table: DiningTableRecord) {
  if (!table.currentSessionId) return undefined
  const s = sessionsDb.get(table.currentSessionId)
  return s && isOpenSession(s) ? s : undefined
}

export const publicMock = {
  async info(code: string): Promise<PublicTableInfo> {
    await mockDelay(100, 250)
    const table = tableOrThrow(code)
    const now = Date.now()
    return {
      table: { name: table.name, zone: table.zone, code: table.code, isActive: table.isActive },
      store: getPublicStoreInfo(),
      ordering: currentOrderingStatus(now),
      menuStamp: currentMenuStamp(now),
      asOf: new Date(now).toISOString(),
    }
  },

  async menu(code: string): Promise<PublicMenu> {
    await mockDelay(150, 300)
    tableOrThrow(code)
    const now = Date.now()
    return toPublicMenu(getMenuSnapshot(), currentMenuStamp(now), now)
  },

  async live(code: string, knownSession: string | undefined, deviceId: string | undefined): Promise<PublicLiveState> {
    await mockDelay(60, 150)
    const table = tableOrThrow(code)
    const now = Date.now()
    const orders = ordersDb.all()
    const requests = requestsDb.all()
    const open = openSessionOf(table)
    let endedSession: PublicLiveState['endedSession']
    if (knownSession && knownSession !== open?.code) {
      const known = sessionsDb.find((s) => s.code === knownSession)
      if (known) {
        const belongs = known.tableId === table.id || known.transferredFromTableName === table.name
        const transferred = known.tableId !== table.id && isOpenSession(known)
        const recentlyClosed = !!known.closedAt && now - new Date(known.closedAt).getTime() <= HOURS_4
        if (belongs && (transferred || ((known.status === 'DaDong' || known.status === 'DaHuy') && recentlyClosed))) {
          endedSession = toPublicSessionView(known, orders, requests, deviceId, transferred ? known.tableName : undefined)
        }
      }
    }
    const myRequests = deviceId
      ? requests
          .filter((r) => r.tableId === table.id && r.deviceId === deviceId && now - new Date(r.createdAt).getTime() <= HOURS_4)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map(toPublicRequestView)
      : []
    return {
      asOf: new Date(now).toISOString(),
      table: { name: table.name, isActive: table.isActive },
      ordering: currentOrderingStatus(now),
      menuStamp: currentMenuStamp(now),
      session: open ? toPublicSessionView(open, orders, requests, deviceId) : null,
      endedSession,
      myRequests,
    }
  },

  async submitOrder(code: string, request: PublicSubmitOrderRequest, deviceId?: string): Promise<PublicSubmitOrderResult> {
    await mockDelay(250, 450)
    const device = deviceId ?? request.deviceId
    // 1. Mã bàn
    const table = tableOrThrow(code)
    const tx = new PosTx()
    // 2. clientRequestId đã có trong bàn này
    if (request.clientRequestId) {
      const existing = tx.orders.find((o) => o.tableId === table.id && o.clientRequestId === request.clientRequestId)
      if (existing) {
        const session = tx.session(existing.sessionId)
        return { order: toPublicOrderView(existing, device), sessionCode: session.code, duplicate: true }
      }
    }
    // 3. Bàn tắt; 4, 5. Quán tạm ngưng, ngoài giờ
    if (!table.isActive) throw PosErrors.tableInactive()
    const ordering = currentOrderingStatus(tx.now)
    if (ordering.blockReason === 'QuanTamNgung') throw PosErrors.storePaused(ordering.message ?? messages.pausedIndefinitely)
    if (ordering.blockReason === 'NgoaiGioNhanDon') throw PosErrors.outsideHours(ordering.message ?? '')
    // 6–10
    const txTable = tx.table(table.id)
    const result = submitOrder({
      tx,
      table: txTable,
      source: 'KhachQr',
      lines: request.lines,
      guestName: request.guestName,
      note: request.note,
      deviceId: device,
      clientRequestId: request.clientRequestId,
    })
    if (result.duplicate) {
      return { order: toPublicOrderView(result.order, device), sessionCode: result.session.code, duplicate: true }
    }
    tx.commit()
    publishPosEvent('order-submitted', {
      orderId: result.order.id,
      tableId: table.id,
      tableName: table.name,
      status: result.order.status,
      autoConfirmed: result.order.autoConfirmed,
      source: 'KhachQr',
    })
    publishPosEvent('tables-changed', { tableIds: [table.id] })
    if (result.cancelledRequestIds.length > 0) {
      publishPosEvent('requests-changed', { requestIds: result.cancelledRequestIds, tableIds: [table.id], newRequestIds: [] })
    }
    return { order: toPublicOrderView(result.order, device), sessionCode: result.session.code, duplicate: false }
  },

  async serviceRequest(code: string, input: PublicServiceRequestInput, deviceId?: string): Promise<PublicServiceRequestResult> {
    await mockDelay(200, 400)
    const device = deviceId ?? input.deviceId
    const table = tableOrThrow(code)
    const tx = new PosTx()
    if (input.clientRequestId) {
      const existing = tx.requests.find((r) => r.tableId === table.id && r.clientRequestId === input.clientRequestId)
      if (existing) return { request: toPublicRequestView(existing), duplicate: true }
    }
    if (!table.isActive) throw PosErrors.tableInactive()

    const note = (input.note ?? '').trim()
    const errors: Record<string, string> = {}
    if (input.type === 'GoiNhanVien') {
      if (!input.reason) errors.reason = 'Chọn lý do'
      else if (input.reason === 'Khac' && !note) errors.note = 'Nhập nội dung cần hỗ trợ'
    } else if (!input.paymentMethod) errors.paymentMethod = 'Chọn phương thức thanh toán'
    if (note.length > PosRules.maxRequestNote) errors.note = 'Ghi chú tối đa 200 ký tự'
    if (Object.keys(errors).length > 0) throw fieldErrors(errors)

    const txTable = tx.table(table.id)
    const session = tx.openSessionOf(txTable)
    let created: ServiceRequestRecord | undefined

    if (input.type === 'GoiNhanVien') {
      const ordering = currentOrderingStatus(tx.now)
      if (ordering.blockReason === 'NgoaiGioNhanDon' && !session) throw PosErrors.outsideHours(ordering.message ?? '')
      const since = tx.now - PosRules.callRepeatSeconds * 1000
      const repeat = tx.requests.find(
        (r) =>
          r.tableId === table.id &&
          r.type === 'GoiNhanVien' &&
          r.reason === input.reason &&
          r.status === 'DangCho' &&
          new Date(r.createdAt).getTime() >= since
      )
      if (repeat) return { request: toPublicRequestView(repeat), duplicate: true }
      created = {
        id: newId(),
        tableId: table.id,
        tableName: table.name,
        sessionId: session?.id,
        type: 'GoiNhanVien',
        reason: input.reason,
        note: input.reason === 'Khac' ? note : undefined,
        needVatInvoice: false,
        status: 'DangCho',
        createdAt: tx.nowIso,
        autoHandled: false,
        deviceId: device,
        clientRequestId: input.clientRequestId,
      }
      tx.addRequest(created)
    } else {
      if (!session || subtotalOf(session, tx.ordersOf(session.id)) === 0) throw PosErrors.noConfirmedItems()
      const pending = tx.requestsOf(session.id).find((r) => r.type === 'ThanhToan' && r.status === 'DangCho')
      if (pending) {
        pending.paymentMethod = input.paymentMethod
        pending.needVatInvoice = !!input.needVatInvoice
        tx.touchRequest(pending)
        tx.touchSession(session)
        tx.commit()
        publishPosEvent('requests-changed', { requestIds: [pending.id], tableIds: [table.id], newRequestIds: [] })
        publishPosEvent('tables-changed', { tableIds: [table.id] })
        return { request: toPublicRequestView(pending), duplicate: true }
      }
      created = {
        id: newId(),
        tableId: table.id,
        tableName: table.name,
        sessionId: session.id,
        type: 'ThanhToan',
        paymentMethod: input.paymentMethod,
        needVatInvoice: !!input.needVatInvoice,
        status: 'DangCho',
        createdAt: tx.nowIso,
        autoHandled: false,
        deviceId: device,
        clientRequestId: input.clientRequestId,
      }
      tx.addRequest(created)
      session.status = 'ChoThanhToan'
      tx.touchSession(session)
    }
    tx.commit()
    publishPosEvent('requests-changed', { requestIds: [created.id], tableIds: [table.id], newRequestIds: [created.id] })
    publishPosEvent('tables-changed', { tableIds: [table.id] })
    return { request: toPublicRequestView(created), duplicate: false }
  },
}
