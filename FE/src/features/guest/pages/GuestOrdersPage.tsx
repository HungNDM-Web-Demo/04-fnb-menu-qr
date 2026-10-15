'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, ClipboardList, HeartHandshake, Receipt, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { guestOrderStatusLabels, paymentMethodLabels } from '@/config/menu-qr-labels'
import type { OrderStatus, PublicOrderView, PublicSessionView } from '@/types/menu-qr'
import { cartStore } from '../lib/guest-storage'
import { GuestBottomBar, GuestSubHeader } from '../components/GuestChrome'
import { useGuest } from '../components/GuestContext'
import { PaymentRequestSheet, TransferQr } from '../components/PaymentRequestSheet'

const statusTone: Record<OrderStatus, string> = {
  ChoXacNhan: 'bg-wait-warn-soft text-foreground',
  DaXacNhan: 'bg-primary/10 text-primary',
  DaPhucVu: 'bg-table-busy-soft text-table-busy',
  BiTuChoi: 'bg-destructive/10 text-destructive',
  DaHuy: 'bg-muted text-muted-foreground',
}

/** SCR-04 Món đã gọi (UC-03, UC-04): đơn của cả bàn, tạm tính, yêu cầu thanh toán, kết thúc phiên (FR-24) */
export function GuestOrdersPage() {
  const { live, href, info, setKnownSession, cartKey } = useGuest()
  const [payOpen, setPayOpen] = useState(false)
  const session = live?.session ?? null
  const ended = !session ? live?.endedSession : undefined

  if (!live) {
    return (
      <div>
        <GuestSubHeader title="Món đã gọi" />
        <p className="text-muted-foreground px-4 py-10 text-center">Đang tải…</p>
      </div>
    )
  }

  // Phiên đã thu tiền → lời cảm ơn (TC-27)
  if (ended?.status === 'DaDong') {
    return (
      <div className="pb-28">
        <GuestSubHeader title="Món đã gọi" />
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="bg-primary/10 text-primary flex size-20 items-center justify-center rounded-full">
            <HeartHandshake className="size-10" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold">Cảm ơn quý khách, hẹn gặp lại</h2>
          <p className="text-muted-foreground">
            Hóa đơn {ended.code} · {formatVnd(ended.subtotal)}
          </p>
          <Button
            className="mt-3 h-12 rounded-full px-8 text-base"
            onClick={() => {
              cartStore.clear(cartKey)
              setKnownSession(undefined)
            }}
            asChild
          >
            <Link href={href('')}>Gọi món lần mới</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Chuyển bàn (BR-18)
  if (ended?.transferredToTableName) {
    return (
      <div className="pb-28">
        <GuestSubHeader title="Món đã gọi" />
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <ArrowRightLeft className="text-primary size-12" aria-hidden="true" />
          <p className="text-lg font-semibold">
            Bàn của quý khách đã chuyển sang {ended.transferredToTableName}, vui lòng quét QR bàn mới
          </p>
        </div>
        <GuestBottomBar />
      </div>
    )
  }

  const view: PublicSessionView | undefined = session ?? ended
  return (
    <div className="pb-32">
      <GuestSubHeader title="Món đã gọi" />
      {!view ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
            <ClipboardList className="size-8" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold">Bàn chưa gọi món nào</p>
          <Button asChild className="mt-2 h-11 rounded-full px-6">
            <Link href={href('')}>
              <UtensilsCrossed aria-hidden="true" />
              Xem menu
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4 px-4 pt-3">
          {view.status === 'DaHuy' ? (
            <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm font-medium" role="status">
              Đơn của bàn đã bị quán từ chối. Vui lòng gọi nhân viên nếu cần hỗ trợ.
            </p>
          ) : null}
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>
              {info.table.name} · Phiên {view.code}
            </span>
            <span>Từ {formatTime(view.openedAt)}</span>
          </div>
          {view.orders.map((order) => (
            <OrderCard key={order.code} order={order} />
          ))}

          {view.status !== 'DaHuy' ? (
            <section className="bg-card space-y-2 rounded-xl border p-4" aria-label="Tạm tính">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Tạm tính</span>
                <span className="text-xl font-bold tabular-nums">{formatVnd(view.subtotal)}</span>
              </div>
              {view.pendingTotal > 0 ? (
                <p className="text-muted-foreground text-sm">
                  Món chờ quán xác nhận chưa tính vào tạm tính ({formatVnd(view.pendingTotal)})
                </p>
              ) : null}
              {view.paymentRequest?.status === 'DangCho' ? (
                <div className="space-y-3 pt-1">
                  <p className="bg-wait-warn-soft rounded-lg px-3 py-2 text-sm font-medium" role="status">
                    Đã gửi yêu cầu thanh toán · {paymentMethodLabels[view.paymentRequest.method]}
                    {view.paymentRequest.needVatInvoice ? ' · Cần HĐ GTGT' : ''}. Nhân viên đang tới.
                  </p>
                  {view.paymentRequest.method === 'ChuyenKhoan' ? (
                    <TransferQr store={info.store} amount={view.subtotal} sessionCode={view.code} />
                  ) : null}
                </div>
              ) : null}
              {session ? (
                <>
                  <Button
                    className="h-12 w-full rounded-full text-base font-semibold"
                    variant={view.paymentRequest?.status === 'DangCho' ? 'outline' : 'default'}
                    disabled={view.subtotal === 0}
                    onClick={() => setPayOpen(true)}
                  >
                    <Receipt aria-hidden="true" />
                    {view.paymentRequest?.status === 'DangCho' ? 'Đổi phương thức thanh toán' : 'Yêu cầu thanh toán'}
                  </Button>
                  {view.subtotal === 0 ? (
                    <p className="text-muted-foreground text-center text-sm">Chưa có món được quán xác nhận</p>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
      <GuestBottomBar />
      <PaymentRequestSheet open={payOpen} onOpenChange={setPayOpen} />
    </div>
  )
}

function OrderCard({ order }: { order: PublicOrderView }) {
  return (
    <article className="bg-card rounded-xl border p-4" aria-label={`Đơn ${order.code}`}>
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{order.code}</span>
        {order.isMine ? <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-bold">Của bạn</span> : null}
        <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold', statusTone[order.status])}>
          {guestOrderStatusLabels[order.status]}
        </span>
      </header>
      <p className="text-muted-foreground mb-2 text-sm">
        {formatTime(order.submittedAt)}
        {order.guestName ? ` · ${order.guestName}` : ''}
        {order.source === 'NhanVien' ? ' · Nhân viên gọi hộ' : ''}
      </p>
      {order.rejectText ? (
        <p className="bg-destructive/10 text-destructive mb-2 rounded-lg px-3 py-1.5 text-sm font-medium">Lý do từ chối: {order.rejectText}</p>
      ) : null}
      <ul className="space-y-2">
        {order.items.map((item, i) => {
          const off = item.status === 'BiBo' || item.status === 'DaHuy'
          return (
            <li key={i} className="flex gap-2 text-[0.9375rem]">
              <span className={cn('w-7 shrink-0 font-semibold tabular-nums', off && 'line-through opacity-60')}>{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className={cn('leading-snug', off && 'text-muted-foreground line-through')}>{item.itemName}</p>
                {item.options.length > 0 ? (
                  <p className={cn('text-muted-foreground text-sm', off && 'line-through')}>{item.options.map((o) => o.name).join(', ')}</p>
                ) : null}
                {item.note ? <p className="text-muted-foreground text-sm italic">{item.note}</p> : null}
                {item.statusText ? <p className="text-destructive text-sm font-medium">{item.statusText}</p> : null}
                {item.status === 'DaPhucVu' && order.status !== 'DaPhucVu' ? (
                  <p className="text-table-busy text-xs font-semibold">Đã phục vụ</p>
                ) : null}
              </div>
              <span className={cn('shrink-0 tabular-nums', off && 'text-muted-foreground line-through')}>{formatVnd(item.lineTotal)}</span>
            </li>
          )
        })}
      </ul>
      <footer className="mt-3 flex justify-between border-t pt-2 font-semibold">
        <span>Tổng đơn</span>
        <span className="tabular-nums">{formatVnd(order.total)}</span>
      </footer>
    </article>
  )
}
