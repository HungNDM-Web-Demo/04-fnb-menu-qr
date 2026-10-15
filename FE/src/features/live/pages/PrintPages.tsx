'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { paymentMethodLabels } from '@/config/menu-qr-labels'
import { formatDateTime, formatTime, formatVnd } from '@/lib/format'
import type { StaffOrderDto, StoreProfile, TableSessionDto } from '@/types/menu-qr'
import { useStaffOrder, useStoreProfile, useTableSession } from '../hooks/use-live'
import { isAutoPrintBlocked } from '../lib/live-prefs'
import '../components/receipt.css'

function PrintFrame({
  title,
  ready,
  auto,
  error,
  onRetry,
  children,
}: {
  title: string
  ready: boolean
  auto: boolean
  error?: unknown
  onRetry?: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  const printed = useRef(false)
  useEffect(() => {
    if (!auto || !ready || printed.current || isAutoPrintBlocked()) return
    printed.current = true
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [auto, ready])

  return (
    <div className="bg-muted min-h-svh print:bg-white">
      <div className="print-hidden bg-card sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4">
        <Button
          variant="outline"
          className="h-11"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(routePath.ordersLive))}
        >
          <ArrowLeft aria-hidden="true" />
          Quay lại
        </Button>
        <span className="text-muted-foreground flex-1 truncate text-sm">{title} · khổ 80 mm</span>
        <Button variant="cta" className="h-11" onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" />
          In
        </Button>
      </div>
      <div className="flex justify-center px-4 py-6 print:p-0">
        <div className="receipt rounded-sm px-3 py-4 shadow-md print:rounded-none print:p-0 print:shadow-none">
          {error ? (
            <ErrorState error={error} onRetry={onRetry} />
          ) : !ready ? (
            <div className="space-y-2">
              <Skeleton className="mx-auto h-5 w-32" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}

/** Phiếu bếp (07 §2.15, FR-18): dòng còn hiệu lực, không in giá, không có dòng bị bỏ (TC-19) */
export function KitchenTicketPrintPage({ orderId, auto }: { orderId: string; auto: boolean }) {
  const order = useStaffOrder(orderId)
  const store = useStoreProfile()
  return (
    <PrintFrame
      title="Phiếu bếp"
      ready={!!order.data && !!store.data}
      auto={auto}
      error={order.error}
      onRetry={() => void order.refetch()}
    >
      {order.data && store.data ? <KitchenTicket order={order.data} store={store.data} /> : null}
    </PrintFrame>
  )
}

function KitchenTicket({ order, store }: { order: StaffOrderDto; store: StoreProfile }) {
  const lines = order.items.filter((i) => i.status !== 'BiBo' && i.status !== 'DaHuy')
  return (
    <div>
      <p className="text-center font-semibold">{store.name}</p>
      <p className="text-center text-base font-bold tracking-widest">PHIẾU BẾP</p>
      <p className="my-1 text-center text-3xl leading-tight font-extrabold">{order.tableName}</p>
      <p className="text-center">
        {order.code} · {formatDateTime(order.submittedAt)}
      </p>
      {order.guestName ? <p className="text-center">Khách: {order.guestName}</p> : null}
      {order.autoConfirmed ? <p className="text-center font-semibold">Tự xác nhận</p> : null}
      {order.source === 'NhanVien' ? <p className="text-center font-semibold">Nhân viên gọi hộ</p> : null}
      <hr className="receipt-sep" />
      <ul className="space-y-1.5">
        {lines.map((i) => (
          <li key={i.id}>
            <p className="text-[15px] font-bold">
              {i.quantity} × {i.itemName}
            </p>
            {i.options.length > 0 ? <p className="pl-4">+ {i.options.map((o) => o.name).join(', ')}</p> : null}
            {i.note ? <p className="pl-4 italic">Ghi chú: {i.note}</p> : null}
          </li>
        ))}
      </ul>
      {order.note ? (
        <>
          <hr className="receipt-sep" />
          <p className="font-semibold">Ghi chú đơn: {order.note}</p>
        </>
      ) : null}
      <hr className="receipt-sep" />
      <p className="text-center">In lúc {formatTime(new Date())}</p>
    </div>
  )
}

/** Hóa đơn (07 §2.15, BR-20): số = mã phiên; dòng còn hiệu lực gộp theo (tên, lựa chọn, đơn giá) */
export function ReceiptPrintPage({ sessionId, auto }: { sessionId: string; auto: boolean }) {
  const session = useTableSession(sessionId)
  const store = useStoreProfile()
  return (
    <PrintFrame
      title="Hóa đơn"
      ready={!!session.data && !!store.data}
      auto={auto}
      error={session.error}
      onRetry={() => void session.refetch()}
    >
      {session.data && store.data ? <Receipt session={session.data} store={store.data} /> : null}
    </PrintFrame>
  )
}

function Receipt({ session, store }: { session: TableSessionDto; store: StoreProfile }) {
  const [printedAt] = useState(() => new Date())
  const groups = new Map<string, { name: string; options: string; unitPrice: number; quantity: number }>()
  for (const order of session.orders) {
    if (order.status !== 'DaXacNhan' && order.status !== 'DaPhucVu') continue
    for (const i of order.items) {
      if (i.status !== 'DaXacNhan' && i.status !== 'DaPhucVu') continue
      const options = i.options.map((o) => o.name).join(', ')
      const key = `${i.itemName}|${options}|${i.unitPrice}`
      const g = groups.get(key) ?? { name: i.itemName, options, unitPrice: i.unitPrice, quantity: 0 }
      g.quantity += i.quantity
      groups.set(key, g)
    }
  }
  const total = session.payment?.total ?? session.subtotal
  return (
    <div>
      <p className="text-center text-sm font-bold">{store.name}</p>
      <p className="text-center">{store.address}</p>
      <p className="text-center">
        ĐT {store.phone} · MST {store.taxCode}
      </p>
      <hr className="receipt-sep" />
      <p className="text-center text-base font-bold tracking-widest">HÓA ĐƠN</p>
      <p className="text-center">Số: {session.code}</p>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
        <span>Bàn</span>
        <span className="text-right font-semibold">{session.tableName}</span>
        <span>Giờ vào</span>
        <span className="text-right">{formatDateTime(session.openedAt)}</span>
        <span>Giờ in</span>
        <span className="text-right">{formatDateTime(printedAt)}</span>
        {session.payment ? (
          <>
            <span>Thu ngân</span>
            <span className="text-right">{session.payment.closedByName}</span>
          </>
        ) : null}
      </div>
      <hr className="receipt-sep" />
      <ul className="space-y-1">
        {[...groups.values()].map((g) => (
          <li key={`${g.name}|${g.options}|${g.unitPrice}`}>
            <p className="font-semibold">{g.name}</p>
            {g.options ? <p className="pl-2">{g.options}</p> : null}
            <p className="flex justify-between pl-2">
              <span>
                {g.quantity} × {formatVnd(g.unitPrice)}
              </span>
              <span>{formatVnd(g.quantity * g.unitPrice)}</span>
            </p>
          </li>
        ))}
      </ul>
      <hr className="receipt-sep" />
      <p className="flex justify-between text-base font-bold">
        <span>TỔNG CỘNG</span>
        <span>{formatVnd(total)}</span>
      </p>
      {session.payment ? (
        <div className="mt-1 space-y-0.5">
          <p className="flex justify-between">
            <span>Thanh toán</span>
            <span>{paymentMethodLabels[session.payment.method]}</span>
          </p>
          {session.payment.cashReceived !== undefined && session.payment.cashReceived !== null ? (
            <>
              <p className="flex justify-between">
                <span>Tiền khách đưa</span>
                <span>{formatVnd(session.payment.cashReceived)}</span>
              </p>
              <p className="flex justify-between">
                <span>Tiền thối</span>
                <span>{formatVnd(session.payment.changeAmount ?? 0)}</span>
              </p>
            </>
          ) : null}
          {session.payment.needVatInvoice ? <p className="font-semibold">Khách cần HĐ GTGT</p> : null}
        </div>
      ) : null}
      <hr className="receipt-sep" />
      <p className="text-center">{store.receiptFooter}</p>
      <p className="text-center">Giá đã gồm thuế GTGT</p>
    </div>
  )
}
