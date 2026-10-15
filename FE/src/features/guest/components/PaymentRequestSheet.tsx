'use client'

import { useState } from 'react'
import { Banknote, CheckCircle2, Landmark, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { QrImage } from '@/features/pos/components/QrImage'
import { bankNameOf, vietQrPayload } from '@/features/pos/lib/vietqr'
import type { PaymentMethod, PublicStoreInfo } from '@/types/menu-qr'
import { useServiceRequest } from '../hooks/use-guest'
import { newRequestId } from '../lib/guest-storage'
import { useGuest } from './GuestContext'
import { GuestSheet } from './GuestSheet'

/** Yêu cầu thanh toán (UC-04, FR-12, FR-13): Tiền mặt/Chuyển khoản, cần HĐ GTGT; chuyển khoản hiện QR số tiền tạm tính */
export function PaymentRequestSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <GuestSheet open={open} onOpenChange={onOpenChange} title="Yêu cầu thanh toán">
      {open ? <PaymentBody onDone={() => onOpenChange(false)} /> : null}
    </GuestSheet>
  )
}

function PaymentBody({ onDone }: { onDone: () => void }) {
  const { code, deviceId, live, info } = useGuest()
  const session = live?.session
  const current = session?.paymentRequest?.status === 'DangCho' ? session.paymentRequest : undefined
  const send = useServiceRequest(code)
  const [method, setMethod] = useState<PaymentMethod>(current?.method ?? 'ChuyenKhoan')
  const [vat, setVat] = useState(current?.needVatInvoice ?? false)
  const [requestId] = useState(() => newRequestId())
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!session) return <p className="text-muted-foreground py-6 text-center">Bàn chưa có món nào.</p>

  if (sent) {
    return (
      <div className="space-y-4 pb-2" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="text-primary size-12" aria-hidden="true" />
          <p className="text-lg font-semibold">Đã báo nhân viên, vui lòng chờ</p>
          <p className="text-muted-foreground">
            Tạm tính <span className="text-foreground font-bold">{formatVnd(session.subtotal)}</span>
          </p>
        </div>
        {method === 'ChuyenKhoan' ? <TransferQr store={info.store} amount={session.subtotal} sessionCode={session.code} /> : null}
        <Button className="h-11 w-full rounded-full" variant="outline" onClick={onDone}>
          Đóng
        </Button>
      </div>
    )
  }

  const submit = () => {
    setError(null)
    send.mutate(
      { clientRequestId: requestId, deviceId, type: 'ThanhToan', paymentMethod: method, needVatInvoice: vat },
      { onSuccess: () => setSent(true), onError: (e) => setError(getErrorMessage(e)) }
    )
  }

  return (
    <div className="space-y-4 pb-2">
      <p className="text-muted-foreground">
        Tạm tính <span className="text-foreground text-lg font-bold tabular-nums">{formatVnd(session.subtotal)}</span>
      </p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Phương thức thanh toán">
        {(
          [
            { value: 'TienMat', label: 'Tiền mặt', icon: Banknote },
            { value: 'ChuyenKhoan', label: 'Chuyển khoản', icon: Landmark },
          ] as const
        ).map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={method === m.value}
            onClick={() => setMethod(m.value)}
            className={cn(
              'flex h-20 flex-col items-center justify-center gap-1 rounded-xl border text-base font-semibold transition-colors',
              method === m.value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
            )}
          >
            <m.icon className="size-6" aria-hidden="true" />
            {m.label}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-xl border px-3">
        <Checkbox checked={vat} onCheckedChange={(v) => setVat(v === true)} className="size-5" />
        <span className="text-base">Cần xuất hóa đơn GTGT</span>
      </label>
      {error ? (
        <p className="text-destructive text-sm font-medium" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="h-12 w-full rounded-full text-base font-semibold" onClick={submit} disabled={send.isPending}>
        {send.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {current ? 'Cập nhật yêu cầu thanh toán' : 'Gửi yêu cầu thanh toán'}
      </Button>
    </div>
  )
}

/** QR chuyển khoản giả lập (07 §3.9) */
export function TransferQr({ store, amount, sessionCode }: { store: PublicStoreInfo; amount: number; sessionCode: string }) {
  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <div className="flex justify-center">
        <QrImage value={vietQrPayload(store, amount, sessionCode)} size={200} alt={`Mã QR chuyển khoản ${formatVnd(amount)}`} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Ngân hàng</dt>
        <dd className="font-medium">{bankNameOf(store.bankBin)}</dd>
        <dt className="text-muted-foreground">Số tài khoản</dt>
        <dd className="font-medium tabular-nums">{store.bankAccount}</dd>
        <dt className="text-muted-foreground">Chủ tài khoản</dt>
        <dd className="font-medium">{store.bankAccountName}</dd>
        <dt className="text-muted-foreground">Số tiền</dt>
        <dd className="text-base font-bold tabular-nums">{formatVnd(amount)}</dd>
        <dt className="text-muted-foreground">Nội dung</dt>
        <dd className="font-bold tracking-wide">{sessionCode}</dd>
      </dl>
      <p className="text-muted-foreground text-center text-sm">Nhân viên sẽ xác nhận khi nhận được tiền</p>
    </div>
  )
}
