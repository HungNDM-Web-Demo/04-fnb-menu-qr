'use client'

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartColumn } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber, formatVnd } from '@/lib/format'
import type { RevenueTotals } from '@/types/menu-qr'
import { useRevenueReport } from '../hooks/use-reports'
import { displayDateKey, shortDateKey } from '../lib/date-range'
import { excelSheet, reportFileName, type ExcelColumn } from '../lib/export-excel'
import { ChangeText, ExportButton, Stat, TabLoading, TabToolbar, compactVnd, type ReportTabProps } from './ReportParts'

const revenueConfig = {
  revenue: { label: 'Kỳ này', color: 'var(--chart-1)' },
  previousRevenue: { label: 'Kỳ trước', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

type DailyRow = RevenueTotals & { date: string; previousRevenue?: number }

const COLUMNS: ExcelColumn<DailyRow>[] = [
  { header: 'Ngày', value: (d) => (d.date ? displayDateKey(d.date) : 'Tổng'), width: 12 },
  { header: 'Doanh thu', value: (d) => d.revenue, width: 16 },
  { header: 'Số phiên bàn', value: (d) => d.sessionCount, width: 13 },
  { header: 'Số đơn', value: (d) => d.orderCount, width: 10 },
  { header: 'TB mỗi phiên', value: (d) => d.avgSessionValue, width: 15 },
  { header: 'Doanh thu kỳ trước', value: (d) => d.previousRevenue, width: 18 },
]

/** Tab Doanh thu (FR-35, BR-19; UC-14 bước 2): theo ngày đóng phiên, đường kỳ trước làm nền */
export function RevenueTab({ range, enabled }: ReportTabProps) {
  const report = useRevenueReport(range, { enabled })
  const data = report.data
  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading />

  const t = data.totals
  const hasData = t.sessionCount > 0 || data.previous.sessionCount > 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Doanh thu" value={formatVnd(t.revenue)} sub={<ChangeText value={data.revenueChangePercent} />} />
        <Stat label="Số phiên bàn đã thu" value={formatNumber(t.sessionCount, 0)} sub={`Kỳ trước ${formatNumber(data.previous.sessionCount, 0)}`} />
        <Stat label="Số đơn" value={formatNumber(t.orderCount, 0)} sub={`Kỳ trước ${formatNumber(data.previous.orderCount, 0)}`} />
        <Stat label="Trung bình mỗi phiên" value={formatVnd(t.avgSessionValue)} sub={`Kỳ trước ${formatVnd(data.previous.avgSessionValue)}`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Doanh thu theo ngày</CardTitle>
            <CardDescription>
              Cột là kỳ này; đường đứt nét là kỳ trước cùng độ dài ({displayDateKey(data.previous.from)} →{' '}
              {displayDateKey(data.previous.to)}).
            </CardDescription>
          </div>
          <TabToolbar>
            <ExportButton
              fileName={reportFileName('doanh-thu', data.from, data.to)}
              disabled={!data.daily.length}
              build={() => [
                excelSheet(
                  'Doanh thu theo ngày',
                  `Doanh thu theo ngày ${displayDateKey(data.from)} - ${displayDateKey(data.to)}`,
                  COLUMNS,
                  [...data.daily, { ...t, date: '', previousRevenue: data.previous.revenue }]
                ),
              ]}
            />
          </TabToolbar>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <EmptyState icon={ChartColumn} title="Chưa có doanh thu" description="Khoảng ngày này và kỳ trước chưa có phiên bàn đã thu tiền." />
          ) : (
            <ChartContainer config={revenueConfig} className="aspect-auto h-80 w-full" aria-label="Biểu đồ doanh thu theo ngày, so với kỳ trước">
              <ComposedChart data={data.daily} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={52} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => displayDateKey(String(v))}
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{revenueConfig[name as keyof typeof revenueConfig]?.label}</span>
                          <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line
                  dataKey="previousRevenue"
                  type="monotone"
                  stroke="var(--color-previousRevenue)"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {hasData && (
        <Card className="gap-0 py-0">
          <div className="max-h-[28rem] overflow-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-right">Số phiên</TableHead>
                  <TableHead className="text-right">Số đơn</TableHead>
                  <TableHead className="text-right">TB mỗi phiên</TableHead>
                  <TableHead className="text-right">Kỳ trước</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.daily].reverse().map((d) => (
                  <RevenueRow key={d.date} label={displayDateKey(d.date)} row={d} previous={d.previousRevenue} />
                ))}
              </TableBody>
              <tfoot className="bg-muted sticky bottom-0 border-t font-semibold">
                <RevenueRow label="Tổng" row={t} previous={data.previous.revenue} />
              </tfoot>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

function RevenueRow({ label, row, previous }: { label: string; row: RevenueTotals; previous?: number }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums">{label}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatVnd(row.revenue)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(row.sessionCount, 0)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(row.orderCount, 0)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.sessionCount ? formatVnd(row.avgSessionValue) : '—'}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">{formatVnd(previous ?? 0)}</TableCell>
    </TableRow>
  )
}
