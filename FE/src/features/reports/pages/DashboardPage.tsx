'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import {
  ArrowRight,
  BellRing,
  ClipboardList,
  HandPlatter,
  ReceiptText,
  RefreshCw,
  Timer,
  Utensils,
  Wallet,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { mainRoutes } from '@/config/routes/main.routes'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { usePermissions } from '@/hooks/use-permissions'
import { formatNumber, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDashboardReport } from '../hooks/use-reports'
import { compactVnd } from '../components/ReportParts'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const SHORTCUT_PATHS: string[] = [routePath.ordersLive, routePath.menuItems, routePath.tables, routePath.reports]

const chartConfig = {
  orders: { label: 'Số đơn', color: 'var(--chart-1)' },
  revenue: { label: 'Doanh thu', color: 'var(--chart-2)' },
} satisfies ChartConfig

/**
 * SCR-12 Tổng quan hôm nay (UC-14 bước 1, FR-01; TC-42): bàn đang mở phiên, đơn chờ, yêu cầu chưa xử lý,
 * doanh thu, phiên đã đóng, trung bình phiên, thời gian xác nhận; biểu đồ đơn và doanh thu theo giờ; lối tắt.
 * Gắn `reports.view` (07 §5 quyết định 1). Tự làm mới 30 giây và theo sự kiện `tables-changed`.
 */
export function DashboardPage() {
  const { can, canAny } = usePermissions()
  const report = useDashboardReport()
  const data = report.data
  const loading = !data

  const shortcuts = mainRoutes.items.filter(
    (item) =>
      SHORTCUT_PATHS.includes(item.href) &&
      (!item.permission || (Array.isArray(item.permission) ? canAny(item.permission) : can(item.permission)))
  )
  const hours = (data?.byHour ?? []).filter((h) => h.hour >= 7 && h.hour <= 23).map((h) => ({ ...h, label: `${h.hour}h` }))
  const hasChart = hours.some((h) => h.orders > 0 || h.revenue > 0)

  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{capitalize(format(new Date(), "EEEE, 'ngày' dd/MM/yyyy", { locale: vi }))}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Tổng quan hôm nay</h1>
          </div>
          <div className="flex items-center gap-3">
            {data && <p className="text-muted-foreground text-sm">Cập nhật lúc {formatTime(data.asOf)}</p>}
            <Button variant="outline" size="lg" onClick={() => void report.refetch()} disabled={report.isFetching}>
              <RefreshCw className={cn(report.isFetching && 'animate-spin')} aria-hidden="true" />
              Làm mới
            </Button>
          </div>
        </div>

        {report.error && !data ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : (
          <>
            <section aria-label="Phục vụ lúc này" className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Bàn đang có khách"
                icon={Utensils}
                isLoading={loading}
                value={
                  data && (
                    <>
                      {formatNumber(data.openSessions, 0)}
                      <span className="text-muted-foreground text-lg font-medium">/{formatNumber(data.activeTables, 0)} bàn đang bật</span>
                    </>
                  )
                }
              />
              <KpiCard
                label="Đơn chờ xác nhận"
                icon={ClipboardList}
                isLoading={loading}
                className={cn(data && data.pendingOrders > 0 && 'border-warning/50 bg-warning/5')}
                value={data && <span className={cn(data.pendingOrders > 0 && 'text-warning')}>{formatNumber(data.pendingOrders, 0)}</span>}
              />
              <KpiCard
                label="Yêu cầu từ bàn chưa xử lý"
                icon={BellRing}
                isLoading={loading}
                className={cn(data && data.overdueRequests > 0 && 'border-destructive/50 bg-destructive/5')}
                value={
                  data && (
                    <span>
                      {formatNumber(data.pendingRequests, 0)}
                      {data.overdueRequests > 0 && (
                        <span className="text-destructive ml-2 text-sm font-medium">{data.overdueRequests} chờ quá 3 phút</span>
                      )}
                    </span>
                  )
                }
              />
            </section>

            <section aria-label="Doanh thu hôm nay" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Doanh thu hôm nay" icon={Wallet} isLoading={loading} value={data && formatVnd(data.revenue)} />
              <KpiCard label="Phiên bàn đã đóng" icon={ReceiptText} isLoading={loading} value={data && formatNumber(data.closedSessions, 0)} />
              <KpiCard
                label="Trung bình mỗi phiên"
                icon={HandPlatter}
                isLoading={loading}
                value={data && (data.closedSessions ? formatVnd(data.avgSessionValue) : '—')}
              />
              <KpiCard
                label="Thời gian xác nhận đơn TB"
                icon={Timer}
                isLoading={loading}
                value={data && (data.avgConfirmMinutes === undefined || data.avgConfirmMinutes === null ? '—' : `${formatNumber(data.avgConfirmMinutes, 1)} phút`)}
              />
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Đơn và doanh thu theo giờ hôm nay</CardTitle>
                  <CardDescription>Cột: số đơn theo giờ gửi. Đường: doanh thu theo giờ thu tiền.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!data ? (
                    <div className="bg-muted h-72 animate-pulse rounded-lg" />
                  ) : !hasChart ? (
                    <EmptyState compact title="Hôm nay chưa có đơn" />
                  ) : (
                    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-label="Biểu đồ đơn và doanh thu theo giờ hôm nay">
                      <ComposedChart data={hours} margin={{ left: 4, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis yAxisId="orders" tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <YAxis yAxisId="revenue" orientation="right" tickFormatter={compactVnd} tickLine={false} axisLine={false} width={52} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) => (
                                <div className="flex w-full justify-between gap-4">
                                  <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                                  <span className="font-medium tabular-nums">
                                    {name === 'revenue' ? formatVnd(Number(value)) : formatNumber(Number(value), 0)}
                                  </span>
                                </div>
                              )}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar yAxisId="orders" dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Line yAxisId="revenue" dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lối tắt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {shortcuts.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group hover:border-primary/40 focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-xl border p-3 transition-[border-color,box-shadow] duration-200 outline-none hover:shadow-sm focus-visible:ring-3"
                      >
                        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <item.icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{item.title}</span>
                          {item.description && <span className="text-muted-foreground block text-sm">{item.description}</span>}
                        </span>
                        <ArrowRight
                          className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}
