'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChartColumn } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { ItemsTab } from '../components/ItemsTab'
import { OperationsTab } from '../components/OperationsTab'
import { RevenueTab } from '../components/RevenueTab'
import { DEFAULT_PRESET, presetRange, type DateRange, type RangePreset } from '../lib/date-range'

const TABS = [
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'items', label: 'Món' },
  { value: 'operations', label: 'Vận hành' },
] as const
type TabValue = (typeof TABS)[number]['value']
const isTab = (v: string | null): v is TabValue => TABS.some((t) => t.value === v)

/**
 * SCR-13 Báo cáo (UC-14; FR-35..FR-37; BR-19): mặc định tab Doanh thu, 30 ngày gần nhất; chặn khoảng
 * > 366 ngày trước khi gọi API; mỗi tab xuất Excel.
 */
export function ReportsPage() {
  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <Suspense>
        <ReportsView />
      </Suspense>
    </PermissionGuard>
  )
}

function ReportsView() {
  const params = useSearchParams()
  const initialTab = params.get('tab')
  const [tab, setTab] = useState<TabValue>(isTab(initialTab) ? initialTab : 'revenue')
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        icon={ChartColumn}
        description="Doanh thu tính phiên bàn đã thu tiền theo giờ đóng phiên; giá đã gồm thuế GTGT."
      />
      <DateRangeFilter
        preset={preset}
        value={range}
        onChange={(p, r) => {
          setPreset(p)
          setRange(r)
        }}
      />
      <Tabs value={tab} onValueChange={(v) => isTab(v) && setTab(v)} className="gap-4">
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList className="w-max group-data-horizontal/tabs:h-12">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="min-h-10 px-4">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="revenue">
          <RevenueTab range={range} enabled={tab === 'revenue'} />
        </TabsContent>
        <TabsContent value="items">
          <ItemsTab range={range} enabled={tab === 'items'} />
        </TabsContent>
        <TabsContent value="operations">
          <OperationsTab range={range} enabled={tab === 'operations'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
