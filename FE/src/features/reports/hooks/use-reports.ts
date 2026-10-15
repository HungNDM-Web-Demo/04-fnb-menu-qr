'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { reportService } from '../services/report.service'
import type { DateRangeQuery, ItemsReportQuery } from '../types/reports.types'

/** Khóa ['reports', loại, query] (07 §4.9); `tables-changed` làm mới Tổng quan */
export const reportKeys = {
  all: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  revenue: (q: DateRangeQuery) => ['reports', 'revenue', q] as const,
  items: (q: ItemsReportQuery) => ['reports', 'items', q] as const,
  operations: (q: DateRangeQuery) => ['reports', 'operations', q] as const,
}

type Opt = { enabled?: boolean }
const common = { placeholderData: keepPreviousData, staleTime: 60_000 }

/** Tổng quan hôm nay: tự làm mới 30 giây, ngoài ra theo sự kiện thời gian thực */
export const useDashboardReport = () =>
  useQuery({ queryKey: reportKeys.dashboard, queryFn: reportService.dashboard, refetchInterval: 30_000 })

export const useRevenueReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.revenue(q), queryFn: () => reportService.revenue(q), enabled: o.enabled ?? true, ...common })

export const useItemsReport = (q: ItemsReportQuery, o: Opt = {}) =>
  useQuery({ queryKey: reportKeys.items(q), queryFn: () => reportService.items(q), enabled: o.enabled ?? true, ...common })

export const useOperationsReport = (q: DateRangeQuery, o: Opt = {}) =>
  useQuery({
    queryKey: reportKeys.operations(q),
    queryFn: () => reportService.operations(q),
    enabled: o.enabled ?? true,
    ...common,
  })
