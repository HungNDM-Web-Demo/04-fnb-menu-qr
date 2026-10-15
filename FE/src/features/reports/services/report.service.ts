import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { DashboardReport, ItemsReport, OperationsReport, RevenueReport } from '@/types/menu-qr'
import { reportsMock } from '../mock/reports.mock'
import type { DateRangeQuery, ItemsReportQuery } from '../types/reports.types'

/** Tổng quan, báo cáo (07 §2.11) */
export const reportService = {
  dashboard: (): Promise<DashboardReport> =>
    isMockMode() ? reportsMock.dashboard() : apiCall.get(apiRoutes.reports.dashboard),
  revenue: (q: DateRangeQuery): Promise<RevenueReport> =>
    isMockMode() ? reportsMock.revenue(q) : apiCall.get(apiRoutes.reports.revenue, { params: q }),
  items: (q: ItemsReportQuery): Promise<ItemsReport> =>
    isMockMode() ? reportsMock.items(q) : apiCall.get(apiRoutes.reports.items, { params: q }),
  operations: (q: DateRangeQuery): Promise<OperationsReport> =>
    isMockMode() ? reportsMock.operations(q) : apiCall.get(apiRoutes.reports.operations, { params: q }),
}
