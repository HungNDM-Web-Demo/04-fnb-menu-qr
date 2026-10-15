import { rejectReasonLabels, removeReasonLabels } from '@/config/menu-qr-labels'
import { permissions } from '@/config/permissions'
import { PosRules } from '@/features/pos/lib/pos-rules'
import { lineTotal } from '@/features/pos/lib/pricing'
import { addDaysKey, diffDaysKey, vnDateKey, vnParts } from '@/features/pos/lib/vn-time'
import { getMenuSnapshot, liveTables } from '@/features/pos/mock/menu.store'
import { isOpenSession } from '@/features/pos/mock/pos.mappers'
import { fieldErrors } from '@/features/pos/mock/pos.errors'
import { allOrders, allRequests, allSessions, ordersDb, requestsDb, sessionsDb } from '@/features/pos/mock/session.store'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import type {
  DashboardReport,
  ItemsReport,
  OperationsReport,
  OrderRecord,
  RejectReason,
  RevenueReport,
  RevenueTotals,
  TableSessionRecord,
} from '@/types/menu-qr'
import type { DateRangeQuery, ItemsReportQuery } from '../types/reports.types'

/**
 * Handler mock báo cáo (07 §2.11, BR-19): đọc hợp kho lịch sử trong bộ nhớ + mock-db hôm nay
 * (`allSessions`, `allOrders`, `allRequests` của FE-Khách). Doanh thu chỉ tính phiên `DaDong` theo `closedAt`.
 * Số tiền tròn đồng; phút, phần trăm 1 chữ số thập phân.
 */

const MIN = 60_000
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : 0)
const avg = (values: number[]) => (values.length ? round1(values.reduce((s, v) => s + v, 0) / values.length) : undefined)
const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / MIN
const keyOf = (iso?: string) => (iso ? vnDateKey(iso) : '')
const inRange = (iso: string | undefined, from: string, to: string) => {
  const k = keyOf(iso)
  return !!k && k >= from && k <= to
}

/** Khoảng ngày mặc định 30 ngày tới hôm nay; kiểm `to ≥ from`, ≤ 366 ngày (07 §2) */
function resolveRange(q: DateRangeQuery): { from: string; to: string } {
  const today = vnDateKey(Date.now())
  const to = q.to && DATE_KEY.test(q.to) ? q.to : today
  const from = q.from && DATE_KEY.test(q.from) ? q.from : addDaysKey(to, -29)
  const days = diffDaysKey(from, to) + 1
  if (days < 1) throw fieldErrors({ to: 'Ngày kết thúc phải sau ngày bắt đầu' })
  if (days > 366) throw fieldErrors({ from: 'Khoảng ngày tối đa 366 ngày' })
  return { from, to }
}

const closedIn = (sessions: TableSessionRecord[], from: string, to: string) =>
  sessions.filter((s) => s.status === 'DaDong' && inRange(s.closedAt, from, to))

function ordersBySession(orders: OrderRecord[]) {
  const map = new Map<string, OrderRecord[]>()
  for (const o of orders) map.set(o.sessionId, [...(map.get(o.sessionId) ?? []), o])
  return map
}

function totals(sessions: TableSessionRecord[], bySession: Map<string, OrderRecord[]>): RevenueTotals {
  const revenue = sessions.reduce((s, x) => s + (x.total ?? 0), 0)
  const orderCount = sessions.reduce(
    (n, x) => n + (bySession.get(x.id) ?? []).filter((o) => o.status !== 'BiTuChoi').length,
    0
  )
  return {
    revenue,
    sessionCount: sessions.length,
    orderCount,
    avgSessionValue: sessions.length ? Math.round(revenue / sessions.length) : 0,
  }
}

export const reportsMock = {
  /** GET /api/reports/dashboard (FR-01, TC-42) */
  async dashboard(): Promise<DashboardReport> {
    await mockDelay(150, 300)
    requirePermission(permissions.reports.view)
    const now = Date.now()
    const today = vnDateKey(now)
    const sessions = sessionsDb.all()
    const orders = ordersDb.all()
    const requests = requestsDb.all()
    const closedToday = closedIn(allSessions(), today, today)
    const revenue = closedToday.reduce((s, x) => s + (x.total ?? 0), 0)
    const pendingReq = requests.filter((r) => r.status === 'DangCho')
    const todayOrders = allOrders().filter((o) => keyOf(o.submittedAt) === today)
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }))
    for (const o of todayOrders) byHour[vnParts(o.submittedAt).hour].orders++
    for (const s of closedToday) byHour[vnParts(s.closedAt!).hour].revenue += s.total ?? 0
    return {
      date: today,
      asOf: new Date(now).toISOString(),
      openSessions: sessions.filter(isOpenSession).length,
      activeTables: liveTables().filter((t) => t.isActive).length,
      pendingOrders: orders.filter((o) => o.status === 'ChoXacNhan').length,
      pendingRequests: pendingReq.length,
      overdueRequests: pendingReq.filter((r) => (now - new Date(r.createdAt).getTime()) / MIN >= PosRules.requestOverdueMinutes).length,
      revenue,
      closedSessions: closedToday.length,
      avgSessionValue: closedToday.length ? Math.round(revenue / closedToday.length) : 0,
      avgConfirmMinutes: avg(
        todayOrders
          .filter((o) => o.source === 'KhachQr' && !o.autoConfirmed && o.handledAt)
          .map((o) => minutesBetween(o.submittedAt, o.handledAt!))
      ),
      byHour,
    }
  },

  /** GET /api/reports/revenue (FR-35): theo ngày đóng phiên, so kỳ liền trước cùng độ dài */
  async revenue(q: DateRangeQuery): Promise<RevenueReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = resolveRange(q)
    const days = diffDaysKey(from, to) + 1
    const prevTo = addDaysKey(from, -1)
    const prevFrom = addDaysKey(from, -days)
    const sessions = allSessions()
    const bySession = ordersBySession(allOrders())
    const current = closedIn(sessions, from, to)
    const previous = closedIn(sessions, prevFrom, prevTo)
    const curByDay = new Map<string, TableSessionRecord[]>()
    for (const s of current) curByDay.set(keyOf(s.closedAt), [...(curByDay.get(keyOf(s.closedAt)) ?? []), s])
    const prevByDay = new Map<string, number>()
    for (const s of previous) prevByDay.set(keyOf(s.closedAt), (prevByDay.get(keyOf(s.closedAt)) ?? 0) + (s.total ?? 0))
    const t = totals(current, bySession)
    const p = totals(previous, bySession)
    return {
      from,
      to,
      totals: t,
      previous: { ...p, from: prevFrom, to: prevTo },
      revenueChangePercent: p.revenue > 0 ? round1(((t.revenue - p.revenue) / p.revenue) * 100) : undefined,
      daily: Array.from({ length: days }, (_, i) => {
        const date = addDaysKey(from, i)
        return {
          ...totals(curByDay.get(date) ?? [], bySession),
          date,
          previousRevenue: prevByDay.get(addDaysKey(prevFrom, i)) ?? 0,
        }
      }),
    }
  },

  /** GET /api/reports/items (FR-36): món gọi nhiều; món bị bỏ, bị hủy và lý do */
  async items(q: ItemsReportQuery): Promise<ItemsReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = resolveRange(q)
    const menu = getMenuSnapshot()
    const itemCat = new Map(menu.menuItems.map((m) => [m.id, m.categoryId]))
    const catName = new Map(menu.categories.map((c) => [c.id, c.name]))
    const matchCat = (menuItemId: string) => !q.categoryId || itemCat.get(menuItemId) === q.categoryId
    const sessions = new Map(allSessions().map((s) => [s.id, s]))
    const orders = allOrders()

    const sold = new Map<string, ItemsReport['items'][number]>()
    type Problem = ItemsReport['problems'][number]
    const problems = new Map<string, Problem>()
    const summary = new Map<string, ItemsReport['reasonSummary'][number]>()
    const addProblem = (line: OrderRecord['items'][number], kind: 'BiBo' | 'DaHuy', reasonText: string) => {
      const value = lineTotal(line)
      const p =
        problems.get(line.menuItemId) ??
        ({ menuItemId: line.menuItemId, code: line.itemCode, name: line.itemName, removedQty: 0, cancelledQty: 0, value: 0, reasons: [] } as Problem)
      if (kind === 'BiBo') p.removedQty += line.quantity
      else p.cancelledQty += line.quantity
      p.value += value
      const r = p.reasons.find((x) => x.kind === kind && x.reasonText === reasonText)
      if (r) r.quantity += line.quantity
      else p.reasons.push({ kind, reasonText, quantity: line.quantity })
      problems.set(line.menuItemId, p)
      const key = `${kind}|${reasonText}`
      const s = summary.get(key) ?? { kind, reasonText, lineCount: 0, quantity: 0, value: 0 }
      s.lineCount++
      s.quantity += line.quantity
      s.value += value
      summary.set(key, s)
    }

    for (const o of orders) {
      const session = sessions.get(o.sessionId)
      const closedInRange = session?.status === 'DaDong' && inRange(session.closedAt, from, to)
      for (const line of o.items) {
        if (!matchCat(line.menuItemId)) continue
        if (closedInRange && (o.status === 'DaXacNhan' || o.status === 'DaPhucVu') && (line.status === 'DaXacNhan' || line.status === 'DaPhucVu')) {
          const categoryId = itemCat.get(line.menuItemId) ?? ''
          const row =
            sold.get(line.menuItemId) ??
            { menuItemId: line.menuItemId, code: line.itemCode, name: line.itemName, categoryId, categoryName: catName.get(categoryId) ?? '', quantity: 0, revenue: 0, share: 0 }
          row.quantity += line.quantity
          row.revenue += lineTotal(line)
          sold.set(line.menuItemId, row)
        }
        if (line.status === 'BiBo' && inRange(o.handledAt, from, to)) {
          addProblem(line, 'BiBo', removeReasonLabels[line.removeReason ?? 'Khac'])
        }
        if (line.status === 'DaHuy' && inRange(line.cancelledAt, from, to)) {
          addProblem(line, 'DaHuy', line.cancelReason || 'Khác')
        }
      }
    }

    const items = [...sold.values()]
    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
    items.forEach((i) => (i.share = pct(i.revenue, totalRevenue)))
    items.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    const problemList = [...problems.values()].sort(
      (a, b) => b.removedQty + b.cancelledQty - (a.removedQty + a.cancelledQty) || b.value - a.value
    )
    problemList.forEach((p) => p.reasons.sort((a, b) => b.quantity - a.quantity))
    return {
      totalRevenue,
      items,
      problems: problemList,
      reasonSummary: [...summary.values()].sort((a, b) => b.quantity - a.quantity),
    }
  },

  /** GET /api/reports/operations (FR-37): đơn lọc theo giờ gửi, yêu cầu theo giờ tạo */
  async operations(q: DateRangeQuery): Promise<OperationsReport> {
    await mockDelay(200, 400)
    requirePermission(permissions.reports.view)
    const { from, to } = resolveRange(q)
    const orders = allOrders().filter((o) => inRange(o.submittedAt, from, to))
    const requests = allRequests().filter((r) => inRange(r.createdAt, from, to))
    const customer = orders.filter((o) => o.source === 'KhachQr')
    const auto = customer.filter((o) => o.autoConfirmed).length
    const rejected = orders.filter((o) => o.status === 'BiTuChoi')
    const reasons = new Map<RejectReason, number>()
    for (const o of rejected) if (o.rejectReason) reasons.set(o.rejectReason, (reasons.get(o.rejectReason) ?? 0) + 1)
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }))
    const heat = new Map<string, number>()
    for (const o of orders) {
      const p = vnParts(o.submittedAt)
      byHour[p.hour].orders++
      heat.set(`${p.isoWeekday}|${p.hour}`, (heat.get(`${p.isoWeekday}|${p.hour}`) ?? 0) + 1)
    }
    return {
      orderCount: orders.length,
      customerOrders: customer.length,
      staffOrders: orders.length - customer.length,
      selfOrderRate: pct(customer.length, orders.length),
      autoConfirmedOrders: auto,
      autoConfirmRate: pct(auto, customer.length),
      rejectedOrders: rejected.length,
      rejectRate: pct(rejected.length, customer.length),
      avgConfirmMinutes: avg(
        customer.filter((o) => !o.autoConfirmed && o.handledAt).map((o) => minutesBetween(o.submittedAt, o.handledAt!))
      ),
      avgRequestMinutes: avg(
        requests.filter((r) => r.status === 'DaXuLy' && !r.autoHandled && r.handledAt).map((r) => minutesBetween(r.createdAt, r.handledAt!))
      ),
      requestCount: requests.length,
      rejectReasons: [...reasons.entries()]
        .map(([reason, count]) => ({ reason, reasonText: rejectReasonLabels[reason], count }))
        .sort((a, b) => b.count - a.count),
      byHour,
      heatmap: Array.from({ length: 7 * 24 }, (_, i) => {
        const weekday = Math.floor(i / 24) + 1
        const hour = i % 24
        return { weekday, hour, orders: heat.get(`${weekday}|${hour}`) ?? 0 }
      }),
    }
  },
}
