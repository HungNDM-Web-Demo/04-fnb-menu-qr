'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { rejectReasonLabels } from '@/config/menu-qr-labels'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { RejectReason, StaffOrderDto } from '@/types/menu-qr'
import { useLiveMutation } from '../hooks/use-live'
import { liveService } from '../services/live.service'

const REASONS: RejectReason[] = ['BanKhongCoKhach', 'DonTrung', 'HetMon', 'Khac']

/** Từ chối đơn (FR-17, UC-05 2b, TC-21) */
export function RejectOrderDialog({ order, open, onOpenChange }: { order: StaffOrderDto; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState<RejectReason | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reject = useLiveMutation(() => liveService.reject(order.id, { reason: reason!, note: reason === 'Khac' ? note.trim() : undefined }))

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setReason(null)
          setNote('')
          setError(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối đơn {order.tableName}</DialogTitle>
          <DialogDescription>
            {order.code} · Khách sẽ thấy lý do trên điện thoại. Bàn chỉ có đơn này thì phiên tự hủy, bàn về Trống.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lý do từ chối">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                'h-12 rounded-lg border px-3 text-sm font-semibold transition-colors',
                reason === r ? 'border-destructive bg-destructive/10 text-destructive' : 'hover:bg-muted'
              )}
            >
              {rejectReasonLabels[r]}
            </button>
          ))}
        </div>
        {reason === 'Khac' ? (
          <Textarea rows={2} autoFocus placeholder="Nhập lý do từ chối" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} />
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            className="h-11"
            disabled={!reason || (reason === 'Khac' && !note.trim()) || reject.isPending}
            onClick={() =>
              reject.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`Đã từ chối đơn ${order.code}`)
                  onOpenChange(false)
                },
                onError: (e) => setError(getFieldErrors(e).note ?? getErrorMessage(e)),
              })
            }
          >
            {reject.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Từ chối đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
