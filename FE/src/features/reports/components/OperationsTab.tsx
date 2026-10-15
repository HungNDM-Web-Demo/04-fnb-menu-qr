'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Activity } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatNumber } from '@/lib/format'
import { useOperationsReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TabToolbar, formatMinutes, formatPercent, type ReportTabProps } from './ReportParts'

const chartConfig = { orders: { label: 'Số đơn', color: 'var(--chart-1)' } } satisfies ChartConfig
/** Khung giờ hiển thị trên biểu đồ, bảng nhiệt (07 §4.7: 9–23) */
const HOURS = Array.from({ length: 15 }, (_, i) => i + 9)
const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Tab Vận hành (FR-37, BR-19): thời gian xác nhận, xử lý yêu cầu, tỉ lệ từ chối, tự gọi, tự xác nhận, bảng nhiệt thứ × giờ */
export function OperationsTab({ range, enabled }: ReportTabProps) {
  const report = useOperationsReport(range, { enabled })
  const data = report.data
  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading cards={8} />

  const period = `${displayDateKey(range.from)} - ${displayDateKey(range.to)}`
  const hours = data.byHour.filter((h) => h.hour >= 9 && h.hour <= 23).map((h) => ({ ...h, label: `${h.hour}h` }))
  const heat = new Map(data.heatmap.map((c) => [`${c.weekday}|${c.hour}`, c.orders]))
  const maxHeat = Math.max(1, ...data.heatmap.filter((c) => c.hour >= 9).map((c) => c.orders))

  return (
    <div className="space-y-4">
      <TabToolbar>
        <p className="text-muted-foreground text-sm">Đơn theo giờ gửi, yêu cầu theo giờ tạo. Tỉ lệ từ chối, tự xác nhận tính trên đơn khách tự gọi.</p>
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName('van-hanh', range.from, range.to)}
            disabled={data.orderCount === 0}
            build={() => [
              excelSheet(
                'Chỉ số',
                `Vận hành ${period}`,
                [
                  { header: 'Chỉ số', value: (r: { label: string; value: number | null | undefined; format?: string }) => r.label, width: 40 },
                  { header: 'Giá trị', value: (r) => r.value, format: '0.0', width: 14 },
                ],
                [
                  { label: 'Tổng số đơn', value: data.orderCount },
                  { label: 'Đơn khách tự gọi', value: data.customerOrders },
                  { label: 'Đơn nhân viên gọi hộ', value: data.staffOrders },
                  { label: 'Tỉ lệ khách tự gọi (%)', value: data.selfOrderRate },
                  { label: 'Đơn tự xác nhận', value: data.autoConfirmedOrders },
                  { label: 'Tỉ lệ tự xác nhận (%)', value: data.autoConfirmRate },
                  { label: 'Đơn bị từ chối', value: data.rejectedOrders },
                  { label: 'Tỉ lệ từ chối (%)', value: data.rejectRate },
                  { label: 'Thời gian xác nhận TB (phút)', value: data.avgConfirmMinutes },
                  { label: 'Số yêu cầu từ bàn', value: data.requestCount },
                  { label: 'Thời gian xử lý yêu cầu TB (phút)', value: data.avgRequestMinutes },
                  ...data.rejectReasons.map((r) => ({ label: `Từ chối: ${r.reasonText}`, value: r.count })),
                ]
              ),
              excelSheet(
                'Số đơn theo giờ',
                `Số đơn theo khung giờ ${period}`,
                [
                  { header: 'Khung giờ', value: (h: { hour: number; orders: number }) => `${h.hour}:00-${h.hour + 1}:00`, width: 14 },
                  { header: 'Số đơn', value: (h) => h.orders, width: 10 },
                ],
                data.byHour
              ),
              excelSheet(
                'Bảng nhiệt',
                `Số đơn theo thứ và giờ ${period}`,
                [
                  { header: 'Thứ', value: (row: { weekday: number }) => WEEKDAYS[row.weekday - 1], width: 12 },
                  ...HOURS.map((h) => ({
                    header: `${h}h`,
                    value: (row: { weekday: number }) => heat.get(`${row.weekday}|${h}`) ?? 0,
                    width: 6,
                  })),
                ],
                [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday }))
              ),
            ]}
          />
        </div>
      </TabToolbar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Thời gian xác nhận đơn TB" value={formatMinutes(data.avgConfirmMinutes)} sub="Đơn khách phải chờ nhân viên" />
        <Stat label="Thời gian xử lý yêu cầu TB" value={formatMinutes(data.avgRequestMinutes)} sub={`${formatNumber(data.requestCount, 0)} yêu cầu từ bàn`} />
        <Stat
          label="Tỉ lệ đơn bị từ chối"
          value={formatPercent(data.rejectRate)}
          sub={`${formatNumber(data.rejectedOrders, 0)} đơn`}
          tone={data.rejectRate >= 5 ? 'destructive' : undefined}
        />
        <Stat label="Tổng số đơn" value={formatNumber(data.orderCount, 0)} />
        <Stat
          label="Khách tự gọi qua QR"
          value={formatPercent(data.selfOrderRate)}
          sub={`${formatNumber(data.customerOrders, 0)} khách tự gọi · ${formatNumber(data.staffOrders, 0)} nhân viên gọi hộ`}
        />
        <Stat label="Tỉ lệ tự xác nhận" value={formatPercent(data.autoConfirmRate)} sub={`${formatNumber(data.autoConfirmedOrders, 0)} đơn vào thẳng bếp`} />
        <div className="bg-card rounded-xl border p-4 shadow-xs sm:col-span-2">
          <p className="text-muted-foreground text-sm">Lý do từ chối</p>
          {data.rejectReasons.length === 0 ? (
            <p className="mt-1 text-sm">Không có đơn bị từ chối.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {data.rejectReasons.map((r) => (
                <li key={r.reason} className="flex justify-between gap-3">
                  <span>{r.reasonText}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(r.count, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {data.orderCount === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={Activity} title="Chưa có đơn" description="Khoảng ngày này chưa có đơn nào." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Số đơn theo khung giờ</CardTitle>
              <CardDescription>Theo giờ gửi, 9h đến 23h.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-label="Biểu đồ số đơn theo khung giờ">
                <BarChart data={hours} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          const h = (payload?.[0]?.payload as { hour?: number } | undefined)?.hour
                          return h === undefined ? '' : `${h}:00 - ${h + 1}:00`
                        }}
                      />
                    }
                  />
                  <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bảng nhiệt số đơn theo thứ và giờ</CardTitle>
              <CardDescription>Ô càng đậm càng đông khách.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-separate border-spacing-0.5 text-xs" aria-label="Bảng nhiệt số đơn theo thứ và giờ">
                <thead>
                  <tr>
                    <th className="w-10" />
                    {HOURS.map((h) => (
                      <th key={h} scope="col" className="text-muted-foreground font-normal tabular-nums">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAY_SHORT.map((label, i) => (
                    <tr key={label}>
                      <th scope="row" className="text-muted-foreground pr-1 text-left font-medium" title={WEEKDAYS[i]}>
                        {label}
                      </th>
                      {HOURS.map((h) => {
                        const v = heat.get(`${i + 1}|${h}`) ?? 0
                        const level = v / maxHeat
                        return (
                          <td
                            key={h}
                            title={`${WEEKDAYS[i]} ${h}:00–${h + 1}:00: ${v} đơn`}
                            className="h-7 rounded-sm text-center tabular-nums"
                            style={{
                              backgroundColor: v ? `color-mix(in oklab, var(--chart-1) ${Math.round(12 + level * 88)}%, transparent)` : 'var(--muted)',
                              color: level > 0.55 ? 'var(--primary-foreground)' : 'var(--foreground)',
                            }}
                          >
                            {v || ''}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <HeatLegend max={maxHeat} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function HeatLegend({ max }: { max: number }) {
  return (
    <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
      <span>Ít</span>
      {[0.12, 0.34, 0.56, 0.78, 1].map((p) => (
        <span key={p} className="h-3 w-6 rounded-sm" style={{ backgroundColor: `color-mix(in oklab, var(--chart-1) ${p * 100}%, transparent)` }} />
      ))}
      <span>Nhiều (tối đa {formatNumber(max, 0)} đơn/ô)</span>
    </div>
  )
}
