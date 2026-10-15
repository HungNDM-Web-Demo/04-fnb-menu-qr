'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { UtensilsCrossed } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCategories } from '@/features/menu-items/hooks/use-menu-catalog'
import { formatNumber, formatVnd } from '@/lib/format'
import type { ItemsReport } from '@/types/menu-qr'
import { useItemsReport } from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelSheet, reportFileName } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TabToolbar, formatPercent, type ReportTabProps } from './ReportParts'

type Item = ItemsReport['items'][number]
type Problem = ItemsReport['problems'][number]
type Reason = ItemsReport['reasonSummary'][number]

const chartConfig = { quantity: { label: 'Số lượng', color: 'var(--chart-1)' } } satisfies ChartConfig
const KIND_LABEL: Record<'BiBo' | 'DaHuy', string> = { BiBo: 'Bị bỏ', DaHuy: 'Đã hủy' }

/** Tab Món (FR-36): món gọi nhiều, doanh thu, tỉ trọng; món bị bỏ, bị hủy và lý do; lọc danh mục */
export function ItemsTab({ range, enabled }: ReportTabProps) {
  const [categoryId, setCategoryId] = useState('all')
  const categories = useCategories()
  const report = useItemsReport({ ...range, categoryId: categoryId === 'all' ? undefined : categoryId }, { enabled })
  const data = report.data
  const categoryName = categories.data?.find((c) => c.id === categoryId)?.name

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />

  const period = `${displayDateKey(range.from)} - ${displayDateKey(range.to)}${categoryName ? `, ${categoryName}` : ''}`
  const totalQty = data?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
  const problemQty = data?.problems.reduce((s, p) => s + p.removedQty + p.cancelledQty, 0) ?? 0
  const problemValue = data?.problems.reduce((s, p) => s + p.value, 0) ?? 0

  return (
    <div className="space-y-4">
      <TabToolbar>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-11 w-52" aria-label="Lọc theo danh mục">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi danh mục</SelectItem>
            {(categories.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">Món đã phục vụ, đã xác nhận của phiên đã thu tiền.</p>
        <div className="ml-auto">
          <ExportButton
            fileName={reportFileName('mon', range.from, range.to)}
            disabled={!data || (!data.items.length && !data.problems.length)}
            build={() =>
              data
                ? [
                    excelSheet(
                      'Món gọi nhiều',
                      `Món gọi nhiều ${period}`,
                      [
                        { header: 'Mã', value: (i: Item) => i.code, width: 8 },
                        { header: 'Món', value: (i) => i.name, width: 30 },
                        { header: 'Danh mục', value: (i) => i.categoryName, width: 18 },
                        { header: 'Số lượng', value: (i) => i.quantity, width: 10 },
                        { header: 'Doanh thu', value: (i) => i.revenue, width: 16 },
                        { header: 'Tỉ trọng %', value: (i) => i.share, format: '0.0', width: 11 },
                      ],
                      data.items
                    ),
                    excelSheet(
                      'Món bị bỏ, bị hủy',
                      `Món bị bỏ, bị hủy ${period}`,
                      [
                        { header: 'Mã', value: (p: Problem) => p.code, width: 8 },
                        { header: 'Món', value: (p) => p.name, width: 30 },
                        { header: 'Bị bỏ', value: (p) => p.removedQty, width: 8 },
                        { header: 'Đã hủy', value: (p) => p.cancelledQty, width: 8 },
                        { header: 'Giá trị', value: (p) => p.value, width: 14 },
                        { header: 'Lý do', value: (p) => p.reasons.map((r) => `${KIND_LABEL[r.kind]}: ${r.reasonText} (${r.quantity})`).join('; '), width: 50 },
                      ],
                      data.problems
                    ),
                    excelSheet(
                      'Lý do',
                      `Tổng hợp lý do bỏ, hủy món ${period}`,
                      [
                        { header: 'Loại', value: (r: Reason) => KIND_LABEL[r.kind], width: 10 },
                        { header: 'Lý do', value: (r) => r.reasonText, width: 34 },
                        { header: 'Số dòng', value: (r) => r.lineCount, width: 10 },
                        { header: 'Số lượng', value: (r) => r.quantity, width: 10 },
                        { header: 'Giá trị', value: (r) => r.value, width: 14 },
                      ],
                      data.reasonSummary
                    ),
                  ]
                : []
            }
          />
        </div>
      </TabToolbar>

      {!data ? (
        <TabLoading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Doanh thu món" value={formatVnd(data.totalRevenue)} />
            <Stat label="Số món đã bán" value={formatNumber(totalQty, 0)} sub={`${formatNumber(data.items.length, 0)} món khác nhau`} />
            <Stat label="Món bị bỏ, bị hủy" value={formatNumber(problemQty, 0)} tone={problemQty > 0 ? 'destructive' : undefined} />
            <Stat label="Giá trị bỏ, hủy" value={formatVnd(problemValue)} sub="Không tính vào doanh thu" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">10 món gọi nhiều nhất</CardTitle>
                <CardDescription>Theo số lượng.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.items.length === 0 ? (
                  <EmptyState icon={UtensilsCrossed} title="Chưa có món bán ra" description="Khoảng ngày này chưa có phiên bàn đã thu tiền." />
                ) : (
                  <ChartContainer config={chartConfig} className="aspect-auto h-96 w-full" aria-label="Biểu đồ 10 món gọi nhiều nhất">
                    <BarChart data={data.items.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 12 }} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _n, item) => {
                              const row = item.payload as Item
                              return (
                                <div className="flex w-full flex-col gap-0.5">
                                  <span className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Số lượng</span>
                                    <span className="font-medium tabular-nums">{formatNumber(Number(value), 0)}</span>
                                  </span>
                                  <span className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Doanh thu</span>
                                    <span className="tabular-nums">{formatVnd(row.revenue)}</span>
                                  </span>
                                </div>
                              )
                            }}
                          />
                        }
                      />
                      <Bar dataKey="quantity" fill="var(--color-quantity)" radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Món bị bỏ, bị hủy nhiều nhất</CardTitle>
                <CardDescription>Bị bỏ lúc xác nhận đơn (theo giờ xác nhận) và quản lý hủy (theo giờ hủy).</CardDescription>
              </CardHeader>
              {data.problems.length === 0 ? (
                <EmptyState compact title="Không có món bị bỏ, bị hủy" className="border-t" />
              ) : (
                <div className="max-h-96 overflow-auto border-t">
                  <Table className="min-w-[560px]">
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Món</TableHead>
                        <TableHead className="text-right">Bị bỏ</TableHead>
                        <TableHead className="text-right">Đã hủy</TableHead>
                        <TableHead className="text-right">Giá trị</TableHead>
                        <TableHead>Lý do</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.problems.map((p) => (
                        <TableRow key={p.menuItemId}>
                          <TableCell className="font-medium">
                            {p.name} <span className="text-muted-foreground text-xs">{p.code}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.removedQty, 0)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.cancelledQty, 0)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatVnd(p.value)}</TableCell>
                          <TableCell className="text-sm">
                            {p.reasons.map((r) => `${KIND_LABEL[r.kind]}: ${r.reasonText} (${r.quantity})`).join('; ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>

          {data.reasonSummary.length > 0 && (
            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Tổng hợp lý do</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto border-t">
                <Table className="min-w-[560px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Loại</TableHead>
                      <TableHead>Lý do</TableHead>
                      <TableHead className="text-right">Số dòng</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead className="text-right">Giá trị</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.reasonSummary.map((r) => (
                      <TableRow key={`${r.kind}-${r.reasonText}`}>
                        <TableCell>
                          <StatusBadge tone={r.kind === 'BiBo' ? 'warning' : 'danger'}>{KIND_LABEL[r.kind]}</StatusBadge>
                        </TableCell>
                        <TableCell>{r.reasonText}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.lineCount, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.quantity, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(r.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Tất cả món đã bán</CardTitle>
              <CardDescription>Tỉ trọng theo doanh thu.</CardDescription>
            </CardHeader>
            {data.items.length === 0 ? (
              <EmptyState compact title="Chưa có món bán ra" className="border-t" />
            ) : (
              <div className="max-h-[28rem] overflow-auto border-t">
                <Table className="min-w-[640px]">
                  <TableHeader className="bg-muted sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Mã</TableHead>
                      <TableHead>Món</TableHead>
                      <TableHead>Danh mục</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead className="text-right">Doanh thu</TableHead>
                      <TableHead className="text-right">Tỉ trọng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((i, idx) => (
                      <TableRow key={i.menuItemId}>
                        <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{i.code}</TableCell>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>{i.categoryName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(i.quantity, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(i.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(i.share)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
