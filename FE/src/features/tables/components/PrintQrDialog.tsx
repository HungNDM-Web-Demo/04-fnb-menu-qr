'use client'

import { useState } from 'react'
import { AlertTriangle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { DiningTableDto } from '@/types/menu-qr'
import { QR_LAYOUTS, type QrLayout } from '../lib/qr'

/** Chọn mẫu in QR rồi mở bản xem trước ở tab mới (UC-12 bước 2, FR-33) */
export function PrintQrDialog({
  open,
  tables,
  onOpenChange,
  onPrint,
}: {
  open: boolean
  tables: DiningTableDto[]
  onOpenChange: (open: boolean) => void
  onPrint: (layout: QrLayout) => void
}) {
  const [layout, setLayout] = useState<QrLayout>('A4x4')
  const inactive = tables.filter((t) => !t.isActive)
  const pages = Math.ceil(tables.length / (QR_LAYOUTS.find((l) => l.value === layout)?.perPage ?? 1))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>In mã QR {tables.length} bàn</DialogTitle>
          <DialogDescription>{tables.map((t) => t.name).join(', ')}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Mẫu in" className="grid gap-2">
          {QR_LAYOUTS.map((l) => {
            const active = layout === l.value
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLayout(l.value)}
                className={cn(
                  'focus-visible:ring-ring/50 flex min-h-14 flex-col items-start justify-center rounded-lg border px-4 py-2 text-left transition-colors outline-none focus-visible:ring-3',
                  active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'
                )}
              >
                <span className="font-medium">{l.label}</span>
                <span className="text-muted-foreground text-xs">{l.hint}</span>
              </button>
            )
          })}
        </div>
        {inactive.length > 0 && (
          <p className="text-warning flex items-start gap-2 text-sm" role="note">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {inactive.map((t) => t.name).join(', ')} đang tắt, khách quét sẽ không gửi đơn được.
          </p>
        )}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-muted-foreground text-sm">{pages} trang</span>
          <Button className="h-11" onClick={() => onPrint(layout)}>
            <Printer aria-hidden="true" />
            Xem trước bản in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
