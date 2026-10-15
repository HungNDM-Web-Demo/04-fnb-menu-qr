import { mockDb } from '@/mock/mock-db'
import { notFound } from '@/mock/mock-errors'
import type { DiningTableRecord, OrderRecord, ServiceRequestRecord, TableSessionRecord } from '@/types/menu-qr'
import { tablesDb } from './menu.store'
import { ordersDb, requestsDb, sessionsDb } from './session.store'

/**
 * Đơn vị thao tác của handler mock (giống transaction của BE): đọc bàn, phiên, đơn, yêu cầu HÔM NAY vào bộ nhớ,
 * sửa trực tiếp rồi `commit()` ghi một lần (mock-db phát một sự kiện thay đổi). Lịch sử chỉ đọc, không nằm ở đây.
 */
export class PosTx {
  readonly now = Date.now()
  readonly nowIso = new Date(this.now).toISOString()
  readonly tables: DiningTableRecord[] = tablesDb.all()
  readonly sessions: TableSessionRecord[] = sessionsDb.all()
  readonly orders: OrderRecord[] = ordersDb.all()
  readonly requests: ServiceRequestRecord[] = requestsDb.all()
  private dirty = { tables: new Set<string>(), sessions: new Set<string>(), orders: new Set<string>(), requests: new Set<string>() }
  private created = { sessions: new Set<string>(), orders: new Set<string>(), requests: new Set<string>() }

  table(id: string): DiningTableRecord {
    const table = this.tables.find((t) => t.id === id && !t.isDeleted)
    if (!table) throw notFound('Không tìm thấy bàn')
    return table
  }

  session(id: string): TableSessionRecord {
    const session = this.sessions.find((s) => s.id === id)
    if (!session) throw notFound('Không tìm thấy phiên bàn')
    return session
  }

  order(id: string): OrderRecord {
    const order = this.orders.find((o) => o.id === id)
    if (!order) throw notFound('Không tìm thấy đơn')
    return order
  }

  request(id: string): ServiceRequestRecord {
    const req = this.requests.find((r) => r.id === id)
    if (!req) throw notFound('Không tìm thấy yêu cầu')
    return req
  }

  /** Phiên đang mở của bàn (theo CurrentSessionId) */
  openSessionOf(table: DiningTableRecord): TableSessionRecord | undefined {
    if (!table.currentSessionId) return undefined
    const s = this.sessions.find((x) => x.id === table.currentSessionId)
    return s && (s.status === 'DangPhucVu' || s.status === 'ChoThanhToan') ? s : undefined
  }

  ordersOf(sessionId: string): OrderRecord[] {
    return this.orders.filter((o) => o.sessionId === sessionId).sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1))
  }

  requestsOf(sessionId: string): ServiceRequestRecord[] {
    return this.requests.filter((r) => r.sessionId === sessionId)
  }

  touchTable(t: DiningTableRecord) {
    t.version += 1
    t.updatedAt = this.nowIso
    this.dirty.tables.add(t.id)
  }
  /** `bump`: tăng Session.Version (07 §3.6) */
  touchSession(s: TableSessionRecord, bump = true) {
    if (bump) s.version += 1
    this.dirty.sessions.add(s.id)
  }
  touchOrder(o: OrderRecord) {
    o.version += 1
    this.dirty.orders.add(o.id)
  }
  touchRequest(r: ServiceRequestRecord) {
    this.dirty.requests.add(r.id)
  }
  addSession(s: TableSessionRecord) {
    this.sessions.push(s)
    this.created.sessions.add(s.id)
  }
  addOrder(o: OrderRecord) {
    this.orders.push(o)
    this.created.orders.add(o.id)
  }
  addRequest(r: ServiceRequestRecord) {
    this.requests.push(r)
    this.created.requests.add(r.id)
  }

  commit() {
    mockDb.batch(() => {
      for (const id of this.dirty.tables) tablesDb.update(id, () => this.tables.find((t) => t.id === id)!)
      for (const id of this.created.sessions) sessionsDb.insert(this.sessions.find((s) => s.id === id)!)
      for (const id of this.dirty.sessions) if (!this.created.sessions.has(id)) sessionsDb.update(id, () => this.sessions.find((s) => s.id === id)!)
      for (const id of this.created.orders) ordersDb.insert(this.orders.find((o) => o.id === id)!)
      for (const id of this.dirty.orders) if (!this.created.orders.has(id)) ordersDb.update(id, () => this.orders.find((o) => o.id === id)!)
      for (const id of this.created.requests) requestsDb.insert(this.requests.find((r) => r.id === id)!)
      for (const id of this.dirty.requests) if (!this.created.requests.has(id)) requestsDb.update(id, () => this.requests.find((r) => r.id === id)!)
    })
  }
}
