'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { callReasonLabels } from '@/config/menu-qr-labels'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { PosRules } from '@/features/pos/lib/pos-rules'
import type { CallReason } from '@/types/menu-qr'
import { useServiceRequest } from '../hooks/use-guest'
import { newRequestId } from '../lib/guest-storage'
import { useGuest } from './GuestContext'
import { GuestSheet } from './GuestSheet'

const REASONS: CallReason[] = ['ThemDa', 'LayChenBat', 'DonBan', 'TuVanMon', 'Khac']

/** Gọi nhân viên (UC-04, FR-11): lý do nhanh, "Khác" kèm ghi chú; chống lặp 60 giây ở máy chủ (TC-15) */
export function CallStaffSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <GuestSheet open={open} onOpenChange={onOpenChange} title="Gọi nhân viên" description="Chọn việc cần nhân viên hỗ trợ">
      {open ? <CallStaffBody onDone={() => onOpenChange(false)} /> : null}
    </GuestSheet>
  )
}

function CallStaffBody({ onDone }: { onDone: () => void }) {
  const { code, deviceId, live } = useGuest()
  const send = useServiceRequest(code)
  const [reason, setReason] = useState<CallReason | null>(null)
  const [note, setNote] = useState('')
  const [requestId] = useState(() => newRequestId())
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const latest = live?.myRequests.find((r) => r.type === 'GoiNhanVien')

  if (sent) {
    const handled = latest?.status === 'DaXuLy'
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
        <CheckCircle2 className={cn('size-12', handled ? 'text-table-busy' : 'text-primary')} aria-hidden="true" />
        <p className="text-lg font-semibold">{handled ? 'Nhân viên đã xử lý' : 'Đã báo nhân viên, vui lòng chờ'}</p>
        {latest ? <p className="text-muted-foreground">{latest.reasonText}</p> : null}
        <Button className="mt-2 h-11 rounded-full px-8" onClick={onDone}>
          Đóng
        </Button>
      </div>
    )
  }

  const submit = (r: CallReason) => {
    setError(null)
    send.mutate(
      {
        clientRequestId: requestId,
        deviceId,
        type: 'GoiNhanVien',
        reason: r,
        note: r === 'Khac' ? note.trim() : undefined,
      },
      {
        onSuccess: () => setSent(true),
        onError: (e) => {
          const fields = getFieldErrors(e)
          setError(fields.note ?? fields.reason ?? getErrorMessage(e))
        },
      }
    )
  }

  return (
    <div className="space-y-3 pb-2">
      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={send.isPending}
            onClick={() => {
              setReason(r)
              if (r !== 'Khac') submit(r)
            }}
            className={cn(
              'flex h-14 items-center justify-center rounded-xl border px-3 text-base font-semibold transition-colors',
              r === 'Khac' && 'col-span-2',
              reason === r ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted active:bg-muted'
            )}
          >
            {send.isPending && reason === r && r !== 'Khac' ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            {callReasonLabels[r]}
          </button>
        ))}
      </div>
      {reason === 'Khac' ? (
        <div className="space-y-2">
          <label htmlFor="call-note" className="font-semibold">
            Nội dung cần hỗ trợ
          </label>
          <Textarea
            id="call-note"
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, PosRules.maxRequestNote))}
            placeholder="Ví dụ: cho thêm khăn lạnh"
            className="text-base"
          />
          <Button className="h-12 w-full rounded-full text-base" disabled={send.isPending || !note.trim()} onClick={() => submit('Khac')}>
            {send.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Gửi
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm font-medium" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
