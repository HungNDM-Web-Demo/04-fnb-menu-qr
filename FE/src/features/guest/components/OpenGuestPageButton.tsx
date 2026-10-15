'use client'

import { useState } from 'react'
import { ExternalLink, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tableStatusLabels } from '@/config/menu-qr-labels'
import { routePath } from '@/config/route-path'
import { cn } from '@/lib/utils'
import { useGuestTables } from '../hooks/use-guest'

/** Mở trang khách của bàn ở tab mới (07 §4.2 bước 1) */
export function openGuestPage(tableCode: string, phone?: number) {
  window.open(routePath.guest(tableCode.toUpperCase(), phone), '_blank', 'noopener')
}

/** Mã bàn mặc định cho lối vào trình diễn: Bàn 05 (kịch bản demo) */
export const DEFAULT_GUEST_TABLE = 'Bàn 05'

/** Chọn bàn + nút "Mở menu bàn này" (trang đăng nhập, thanh công cụ demo, màn nhận đơn) */
export function GuestTablePicker({
  idPrefix,
  buttonLabel = 'Mở menu bàn này',
  className,
  compact,
}: {
  idPrefix: string
  buttonLabel?: string
  className?: string
  compact?: boolean
}) {
  const tables = useGuestTables()
  const [code, setCode] = useState<string | undefined>()
  const list = tables.data ?? []
  const selected = code ?? list.find((t) => t.name === DEFAULT_GUEST_TABLE)?.code ?? list[0]?.code
  return (
    <div className={cn('flex gap-2', compact ? 'flex-row items-end' : 'flex-col', className)}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor={`${idPrefix}-table`}>Bàn</Label>
        <Select value={selected} onValueChange={setCode} disabled={!list.length}>
          <SelectTrigger id={`${idPrefix}-table`} className="h-10 w-full">
            <SelectValue placeholder={tables.isLoading ? 'Đang tải…' : 'Chọn bàn'} />
          </SelectTrigger>
          <SelectContent>
            {list.map((t) => (
              <SelectItem key={t.code} value={t.code}>
                {t.name} · {t.zone} · {tableStatusLabels[t.status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" className="h-10" disabled={!selected} onClick={() => selected && openGuestPage(selected)}>
        <Smartphone aria-hidden="true" />
        {buttonLabel}
        <ExternalLink className="opacity-60" aria-hidden="true" />
      </Button>
    </div>
  )
}

/**
 * Nút "Mở trang khách": có `tableCode` thì mở thẳng; không có thì hiện ô chọn bàn (07 §4.2, §4.4).
 */
export function OpenGuestPageButton({
  tableCode,
  label = 'Mở trang khách',
  variant = 'outline',
  className,
}: {
  tableCode?: string
  label?: string
  variant?: 'outline' | 'default' | 'ghost' | 'secondary'
  className?: string
}) {
  if (tableCode) {
    return (
      <Button type="button" variant={variant} className={cn('h-10', className)} onClick={() => openGuestPage(tableCode)}>
        <Smartphone aria-hidden="true" />
        {label}
      </Button>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant={variant} className={cn('h-10', className)}>
          <Smartphone aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <GuestTablePicker idPrefix="open-guest" />
      </PopoverContent>
    </Popover>
  )
}
