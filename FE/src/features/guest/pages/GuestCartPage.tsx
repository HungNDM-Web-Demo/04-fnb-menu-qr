'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { PosRules } from '@/features/pos/lib/pos-rules'
import { errorCodeOf, problemExtra } from '@/features/pos/lib/problem'
import type { PriceChange } from '@/types/menu-qr'
import { useCart, useSubmitOrder } from '../hooks/use-guest'
import { cartStore, newRequestId, readGuestName, writeGuestName } from '../lib/guest-storage'
import { GuestSubHeader, OrderingBanner } from '../components/GuestChrome'
import { useGuest } from '../components/GuestContext'

const BLOCKING = new Set(['QuanTamNgung', 'NgoaiGioNhanDon', 'BanTamNgung', 'QuaSoDonCho', 'MaQrKhongHopLe', 'QuaNhieuYeuCau'])

/** SCR-03 Giỏ món (UC-02): tên gọi, ghi chú, gửi đơn kèm `expectedUnitPrice`, xử lý mọi mã lỗi 07 §4.3 */
export function GuestCartPage() {
  const { code, cartKey, deviceId, href, setKnownSession } = useGuest()
  const router = useRouter()
  const cart = useCart(cartKey)
  const submit = useSubmitOrder(code)
  const [guestName, setGuestName] = useState(() => readGuestName())
  const [note, setNote] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ tone: 'error' | 'warn'; text: string } | null>(null)
  // clientRequestId: giữ nguyên khi bấm lại/thử lại, đổi khi giỏ đổi hoặc sau khi gửi thành công (07 §3.7)
  const requestRef = useRef<{ stamp: number; id: string } | null>(null)

  const total = cart.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const count = cart.lines.reduce((s, l) => s + l.quantity, 0)

  const send = () => {
    setNotice(null)
    setLineErrors({})
    const lines = cart.lines
    if (!requestRef.current || requestRef.current.stamp !== cart.updatedAt) {
      requestRef.current = { stamp: cart.updatedAt, id: newRequestId() }
    }
    const clientRequestId = requestRef.current.id
    submit.mutate(
      {
        clientRequestId,
        deviceId,
        guestName: guestName.trim() || undefined,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          menuItemId: l.menuItemId,
          choiceIds: l.choiceIds,
          quantity: l.quantity,
          note: l.note,
          expectedUnitPrice: l.unitPrice,
        })),
      },
      {
        onSuccess: (result) => {
          writeGuestName(guestName.trim())
          cartStore.clear(cartKey)
          requestRef.current = null
          setKnownSession(result.sessionCode)
          toast.success(`Đã gửi đơn ${result.order.code}`)
          router.push(href('/orders'))
        },
        onError: (error) => {
          const code = errorCodeOf(error)
          if (code === 'MonVuaHet') {
            const fields = getFieldErrors(error)
            const errs: Record<string, string> = {}
            const indexes = problemExtra<number[]>(error, 'soldOutLines') ?? []
            indexes.forEach((i) => {
              const line = lines[i]
              if (line) errs[line.key] = fields[`lines.${i}`] ?? 'Món vừa hết'
            })
            setLineErrors(errs)
            setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Có món vừa hết' })
          } else if (code === 'GiaDaThayDoi') {
            const changes = problemExtra<PriceChange[]>(error, 'priceChanges') ?? []
            cartStore.reprice(cartKey, changes)
            const errs: Record<string, string> = {}
            changes.forEach((c) => {
              const line = lines[c.index]
              if (line) errs[line.key] = `Giá mới ${formatVnd(c.newUnitPrice)} (trước ${formatVnd(c.oldUnitPrice)})`
            })
            setLineErrors(errs)
            setNotice({ tone: 'warn', text: 'Giá đã thay đổi, vui lòng kiểm tra giỏ món rồi gửi lại' })
          } else if (code && BLOCKING.has(code)) {
            setNotice({ tone: 'error', text: getErrorMessage(error) })
          } else {
            const fields = getFieldErrors(error)
            const errs: Record<string, string> = {}
            lines.forEach((l, i) => {
              const msg = fields[`lines.${i}.choiceIds`] ?? fields[`lines.${i}.quantity`] ?? fields[`lines.${i}.note`]
              if (msg) errs[l.key] = msg
            })
            setLineErrors(errs)
            setNotice({ tone: 'error', text: getErrorMessage(error) })
          }
        },
      }
    )
  }

  return (
    <div className="pb-48">
      <GuestSubHeader title="Giỏ món" />
      <OrderingBanner />
      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
            <ShoppingBag className="size-8" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold">Giỏ món đang trống</p>
          <p className="text-muted-foreground text-sm">Chọn món trong menu rồi quay lại đây để gửi đơn.</p>
          <Button asChild className="mt-2 h-11 rounded-full px-6">
            <Link href={href('')}>Xem menu</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-5 px-4 pt-3">
          <ul className="divide-y">
            {cart.lines.map((line) => {
              const err = lineErrors[line.key]
              return (
                <li key={line.key} className={cn('flex gap-3 py-3', err && 'bg-destructive/5 -mx-4 px-4')}>
                  <MenuImage imageUrl={line.imageUrl} name={line.itemName} className="size-16 shrink-0 rounded-lg" textClassName="text-base" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="leading-snug font-semibold">{line.itemName}</p>
                    {line.options.length > 0 ? (
                      <p className="text-muted-foreground text-sm">{line.options.map((o) => o.name).join(', ')}</p>
                    ) : null}
                    {line.note ? <p className="text-muted-foreground text-sm italic">Ghi chú: {line.note}</p> : null}
                    {err ? (
                      <p className="text-destructive flex items-center gap-1 text-sm font-semibold" role="alert">
                        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                        {err}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center rounded-full border" role="group" aria-label={`Số lượng ${line.itemName}`}>
                        <Button
                          variant="ghost"
                          className="size-11 rounded-full"
                          onClick={() => cartStore.setQuantity(cartKey, line.key, line.quantity - 1)}
                          aria-label={line.quantity <= 1 ? `Xóa ${line.itemName}` : 'Giảm số lượng'}
                        >
                          {line.quantity <= 1 ? <Trash2 aria-hidden="true" /> : <Minus aria-hidden="true" />}
                        </Button>
                        <span className="w-6 text-center font-semibold tabular-nums">{line.quantity}</span>
                        <Button
                          variant="ghost"
                          className="size-11 rounded-full"
                          onClick={() => cartStore.setQuantity(cartKey, line.key, line.quantity + 1)}
                          disabled={line.quantity >= PosRules.maxQuantity}
                          aria-label="Tăng số lượng"
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                      </div>
                      <span className="font-bold tabular-nums">{formatVnd(line.unitPrice * line.quantity)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="space-y-2">
            <label htmlFor="guest-name" className="font-semibold">
              Tên gọi <span className="text-muted-foreground text-sm font-normal">(để nhân viên gọi khi mang món)</span>
            </label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value.slice(0, PosRules.maxGuestName))}
              placeholder="Ví dụ: Anh Tuấn"
              className="h-11 text-base"
              autoComplete="nickname"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="order-note" className="font-semibold">
              Ghi chú cho quán
            </label>
            <Textarea
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, PosRules.maxOrderNote))}
              placeholder="Ví dụ: mang món chính ra trước"
              rows={2}
              className="text-base"
            />
          </div>
        </div>
      )}

      {cart.lines.length > 0 ? (
        <div className="bg-background fixed inset-x-0 bottom-0 z-30 space-y-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {notice ? (
            <p
              role="alert"
              className={cn(
                'flex gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                notice.tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-wait-warn-soft text-foreground'
              )}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {notice.text}
            </p>
          ) : null}
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Tổng {count} món</span>
            <span className="text-xl font-bold tabular-nums">{formatVnd(total)}</span>
          </div>
          <Button className="h-12 w-full rounded-full text-base font-semibold" onClick={send} disabled={submit.isPending}>
            {submit.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {notice?.tone === 'warn' ? 'Gửi lại đơn' : 'Gửi đơn'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
