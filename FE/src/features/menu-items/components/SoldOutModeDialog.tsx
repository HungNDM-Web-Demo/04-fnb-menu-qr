'use client'

import { CalendarClock, CalendarX2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { soldOutModeLabels } from '@/config/menu-qr-labels'
import type { SoldOutMode } from '@/types/menu-qr'

type SoldOutModeDialogProps = {
  /** Tên món hoặc "Size L (nhóm Size)"; null là đóng */
  target: { title: string; note?: string } | null
  pending?: boolean
  onCancel: () => void
  onChoose: (mode: SoldOutMode) => void
}

const OPTIONS: { mode: SoldOutMode; icon: typeof CalendarClock; hint: string }[] = [
  { mode: 'HetHomNay', icon: CalendarClock, hint: 'Tự bán lại lúc 00:00 đêm nay' },
  { mode: 'HetToiKhiMoLai', icon: CalendarX2, hint: 'Hết cho tới khi bật lại "Còn món"' },
]

/**
 * Tắt "Còn món" thì hỏi "Hết trong hôm nay" hay "Hết tới khi mở lại" (UC-10 bước 2, FR-30).
 * Dùng chung cho món và lựa chọn của nhóm tùy chọn.
 */
export function SoldOutModeDialog({ target, pending, onCancel, onChoose }: SoldOutModeDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Báo hết {target?.title}</DialogTitle>
          <DialogDescription>
            {target?.note ?? 'Trang khách hiện món mờ, nhãn "Hết món" trong vài giây.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="group" aria-label="Thời gian hết món">
          {OPTIONS.map(({ mode, icon: Icon, hint }) => (
            <Button
              key={mode}
              variant="outline"
              className="h-auto min-h-14 justify-start gap-3 px-4 py-3 text-left"
              disabled={pending}
              onClick={() => onChoose(mode)}
            >
              <Icon className="text-warning size-5 shrink-0" aria-hidden="true" />
              <span className="flex flex-col items-start">
                <span className="font-medium">{soldOutModeLabels[mode]}</span>
                <span className="text-muted-foreground text-xs font-normal">{hint}</span>
              </span>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="h-11" onClick={onCancel} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
