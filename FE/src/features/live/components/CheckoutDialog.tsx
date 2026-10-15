'use client'

import { useState } from 'react'
import { AlertTriangle, Banknote, CheckCircle2, Landmark, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { routePath } from '@/config/route-path'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { QrImage } from '@/features/pos/components/QrImage'
import { errorCodeOf } from '@/features/pos/lib/problem'
import { bankNameOf, vietQrPayload } from '@/features/pos/lib/vietqr'
import type { PaymentMethod, TableSessionDto } from '@/types/menu-qr'
import { useLiveMutation, useStoreProfile } from '../hooks/use-live'
import { printInFrame } from '../lib/live-prefs'
import { liveService } from '../services/live.service'

const QUICK = [100_000, 200_000, 500_000]

/**
 * Thu tiền, đóng phiên (UC-08, FR-23, BR-13, 07 §3.3): tiền mặt có nút nhanh, tiền thối, "Còn thiếu" khóa Hoàn tất (TC-29);
 * chuyển khoản hiện QR, bấm "Đã nhận tiền"; cảnh báo món chưa phục vụ có "Vẫn đóng phiên". Xong in hóa đơn qua iframe.
 */
export function CheckoutDialog({
  session,
  open,
  onOpenChange,
  onDone,
}: {
  session: TableSessionDto
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <CheckoutBody session={session} onClose={() => onOpenChange(false)} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CheckoutBody({ session, onClose, onDone }: { session: TableSessionDto; onClose: () => void; onDone: () => void }) {
  const store = useStoreProfile()
  const [method, setMethod] = useState<PaymentMethod>(session.paymentRequest?.method ?? 'TienMat')
  const [cash, setCash] = useState<number | null>(null)
  const [received, setReceived] = useState(false)
  const [vat, setVat] = useState(session.paymentRequest?.needVatInvoice ?? false)
  const [ack, setAck] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const checkout = useLiveMutation(() =>
    liveService.checkout(session.id, {
      clientRequestId: requestId,
      version: session.version,
      method,
      cashReceived: method === 'TienMat' ? (cash ?? undefined) : undefined,
      needVatInvoice: vat,
      acknowledgeUnserved: ack,
    })
  )

  const total = session.subtotal
  const short = method === 'TienMat' && cash !== null ? Math.max(0, total - cash) : 0
  const change = method === 'TienMat' && cash !== null && cash >= total ? cash - total : 0
  const unserved = session.counts.unservedItems
  const ready =
    (method === 'TienMat' ? cash !== null && cash >= total : received) && (unserved === 0 || ack) && !checkout.isPending

  const submit = () => {
    setError(null)
    checkout.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          method === 'TienMat'
            ? `Đã thu ${formatVnd(total)} · tiền thối ${formatVnd(result.changeAmount)}`
            : `Đã thu ${formatVnd(total)} chuyển khoản`
        )
        printInFrame(routePath.receipt(session.id))
        onClose()
        onDone()
      },
      onError: (e) => {
        const code = errorCodeOf(e)
        if (code === 'DuLieuCu') {
          toast.warning(getErrorMessage(e))
          onClose()
          return
        }
        if (code === 'ConMonChuaPhucVu') setAck(false)
        setError(getErrorMessage(e))
      },
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Thu tiền {session.tableName} · {session.code}
        </DialogTitle>
        <DialogDescription>
          Tạm tính <span className="text-foreground text-lg font-bold tabular-nums">{formatVnd(total)}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Phương thức">
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
              'flex h-14 items-center justify-center gap-2 rounded-lg border text-base font-semibold',
              method === m.value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
            )}
          >
            <m.icon className="size-5" aria-hidden="true" />
            {m.label}
          </button>
        ))}
      </div>

      {method === 'TienMat' ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cash-received">Tiền khách đưa</Label>
            <MoneyInput id="cash-received" value={cash} onChange={setCash} className="h-12 text-lg" autoFocus />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setCash(total)}>
              Đủ tiền
            </Button>
            {QUICK.map((v) => (
              <Button key={v} type="button" variant="outline" className="h-11" disabled={v < total} onClick={() => setCash(v)}>
                {new Intl.NumberFormat('vi-VN').format(v)}
              </Button>
            ))}
          </div>
          {short > 0 ? (
            <p className="text-destructive text-base font-semibold" role="alert">
              Còn thiếu {formatVnd(short)}
            </p>
          ) : cash !== null ? (
            <p className="flex items-baseline justify-between text-base">
              <span className="text-muted-foreground">Tiền thối</span>
              <span className="text-xl font-bold tabular-nums">{formatVnd(change)}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {store.data ? (
            <div className="flex items-center gap-4 rounded-lg border p-3">
              <QrImage value={vietQrPayload(store.data, total, session.code)} size={140} alt={`QR chuyển khoản ${formatVnd(total)}`} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-sm">
                <dt className="text-muted-foreground">Ngân hàng</dt>
                <dd>{bankNameOf(store.data.bankBin)}</dd>
                <dt className="text-muted-foreground">Tài khoản</dt>
                <dd className="tabular-nums">{store.data.bankAccount}</dd>
                <dt className="text-muted-foreground">Số tiền</dt>
                <dd className="font-bold tabular-nums">{formatVnd(total)}</dd>
                <dt className="text-muted-foreground">Nội dung</dt>
                <dd className="font-bold">{session.code}</dd>
              </dl>
            </div>
          ) : null}
          <Button type="button" variant={received ? 'secondary' : 'outline'} className="h-11 w-full" onClick={() => setReceived((v) => !v)}>
            {received ? <CheckCircle2 className="text-table-busy" aria-hidden="true" /> : null}
            {received ? 'Đã nhận tiền' : 'Đã nhận tiền?'}
          </Button>
        </div>
      )}

      <label className="flex min-h-11 items-center gap-3">
        <Checkbox checked={vat} onCheckedChange={(v) => setVat(v === true)} />
        <span>Khách cần hóa đơn GTGT</span>
      </label>

      {unserved > 0 ? (
        <div className="bg-wait-warn-soft space-y-2 rounded-lg p-3">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="text-wait-warn size-4" aria-hidden="true" />
            Còn {unserved} món chưa phục vụ
          </p>
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />
            Vẫn đóng phiên
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm font-medium" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button variant="outline" className="h-11" onClick={onClose}>
          Đóng
        </Button>
        <Button className="h-11 min-w-32 text-base" onClick={submit} disabled={!ready}>
          {checkout.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Hoàn tất
        </Button>
      </DialogFooter>
    </>
  )
}
