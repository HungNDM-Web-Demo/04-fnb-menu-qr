'use client'

import { useState } from 'react'
import { ArrowRightLeft, Ban, Loader2, Printer, Receipt, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import {
  cancelReasonSuggestions,
  orderStatusLabels,
  paymentMethodLabels,
  sessionStatusLabels,
  tableStatusLabels,
} from '@/config/menu-qr-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OpenGuestPageButton } from '@/features/guest/components/OpenGuestPageButton'
import type { OrderItemDto, StaffOrderDto, TableBoardItem, TableSessionDto } from '@/types/menu-qr'
import { useLiveMutation, useTableBoard, useTableSession } from '../hooks/use-live'
import { printInFrame } from '../lib/live-prefs'
import { liveService } from '../services/live.service'
import { CheckoutDialog } from './CheckoutDialog'

/**
 * Ngăn kéo chi tiết bàn (SCR-06, UC-08, UC-15, UC-16): mã phiên, đơn, dòng bỏ/hủy, tạm tính; Gọi món hộ, Thu tiền
 * (khóa khi còn đơn chờ, TC-28), Hủy món (chỉ `orders.cancel`, TC-30), Chuyển bàn, In lại hóa đơn, Mở trang khách.
 */
export function SessionDrawer({
  table,
  sessionId,
  onClose,
  onStaffOrder,
}: {
  table: TableBoardItem | null
  sessionId?: string
  onClose: () => void
  onStaffOrder: (tableId: string) => void
}) {
  const id = sessionId ?? table?.session?.id
  const open = !!table || !!sessionId
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        {table && !id ? (
          <EmptyTable table={table} onStaffOrder={onStaffOrder} />
        ) : id ? (
          <SessionBody sessionId={id} table={table} onClose={onClose} onStaffOrder={onStaffOrder} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function EmptyTable({ table, onStaffOrder }: { table: TableBoardItem; onStaffOrder: (tableId: string) => void }) {
  const { can } = usePermissions()
  return (
    <>
      <SheetHeader className="border-b p-4">
        <SheetTitle className="text-xl">{table.tableName}</SheetTitle>
        <SheetDescription>
          {table.zone} · {table.capacity} chỗ · {tableStatusLabels[table.status]}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-3 p-4">
        <p className="text-muted-foreground">{table.isActive ? 'Bàn đang trống.' : 'Bàn đang tắt, khách quét QR không gửi đơn được.'}</p>
        <div className="flex flex-wrap gap-2">
          {can(permissions.orders.create) && table.isActive ? (
            <Button className="h-11" onClick={() => onStaffOrder(table.tableId)}>
              <ShoppingBasket aria-hidden="true" />
              Gọi món hộ
            </Button>
          ) : null}
          <OpenGuestPageButton tableCode={table.code} className="h-11" />
        </div>
      </div>
    </>
  )
}

function SessionBody({
  sessionId,
  table,
  onClose,
  onStaffOrder,
}: {
  sessionId: string
  table: TableBoardItem | null
  onClose: () => void
  onStaffOrder: (tableId: string) => void
}) {
  const { can } = usePermissions()
  const query = useTableSession(sessionId)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [cancelling, setCancelling] = useState<{ order: StaffOrderDto; item: OrderItemDto } | null>(null)
  const s = query.data

  if (!s) {
    return (
      <div className="space-y-3 p-4">
        <SheetTitle className="sr-only">Chi tiết phiên bàn</SheetTitle>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  const open = s.status === 'DangPhucVu' || s.status === 'ChoThanhToan'
  const pending = s.counts.pendingOrders
  const canCancel = can(permissions.orders.cancel) && open

  return (
    <>
      <SheetHeader className="border-b p-4">
        <SheetTitle className="flex items-center gap-2 text-xl">
          {s.tableName}
          <Badge
            className={cn(
              s.status === 'ChoThanhToan' && 'bg-table-pay-soft text-table-pay',
              s.status === 'DangPhucVu' && 'bg-table-busy-soft text-table-busy',
              (s.status === 'DaDong' || s.status === 'DaHuy') && 'bg-muted text-foreground'
            )}
          >
            {sessionStatusLabels[s.status]}
          </Badge>
        </SheetTitle>
        <SheetDescription>
          Phiên {s.code} · mở {formatTime(s.openedAt)}
          {s.transferredFromTableName ? ` · chuyển từ ${s.transferredFromTableName}` : ''}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {s.paymentRequest ? (
          <p className="bg-table-pay-soft rounded-lg px-3 py-2 text-sm font-semibold">
            Khách yêu cầu thanh toán · {paymentMethodLabels[s.paymentRequest.method]}
            {s.paymentRequest.needVatInvoice ? ' · Cần HĐ GTGT' : ''} · {formatTime(s.paymentRequest.createdAt)}
          </p>
        ) : null}
        {s.orders.map((o) => (
          <article key={o.id} className="rounded-lg border p-3">
            <header className="mb-1 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="font-semibold">{o.code}</span>
              <span className="text-muted-foreground">
                {formatTime(o.submittedAt)}
                {o.guestName ? ` · ${o.guestName}` : ''}
              </span>
              {o.source === 'NhanVien' ? <Badge variant="secondary">Nhân viên gọi hộ</Badge> : null}
              {o.autoConfirmed ? <Badge variant="secondary">Tự xác nhận</Badge> : null}
              <Badge variant="outline" className="ml-auto">
                {orderStatusLabels[o.status]}
              </Badge>
            </header>
            {o.rejectText ? <p className="text-destructive text-sm">Lý do từ chối: {o.rejectText}</p> : null}
            <ul className="divide-y">
              {o.items.map((i) => {
                const off = i.status === 'BiBo' || i.status === 'DaHuy'
                const cancellable = canCancel && (o.status === 'DaXacNhan' || o.status === 'DaPhucVu') && (i.status === 'DaXacNhan' || i.status === 'DaPhucVu')
                return (
                  <li key={i.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className={cn('w-7 font-bold tabular-nums', off && 'line-through opacity-60')}>{i.quantity}×</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-medium', off && 'text-muted-foreground line-through')}>{i.itemName}</p>
                      {i.options.length > 0 ? <p className="text-muted-foreground text-xs">{i.options.map((x) => x.name).join(', ')}</p> : null}
                      {i.statusText ? <p className="text-destructive text-xs font-medium">{i.statusText}</p> : null}
                    </div>
                    <span className={cn('tabular-nums', off && 'text-muted-foreground line-through')}>{formatVnd(i.lineTotal)}</span>
                    {cancellable ? (
                      <Button size="sm" variant="ghost" className="text-destructive h-9" onClick={() => setCancelling({ order: o, item: i })}>
                        <Ban aria-hidden="true" />
                        Hủy món
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </article>
        ))}
        {s.requests.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-semibold">Yêu cầu từ bàn</p>
            {s.requests.map((r) => (
              <p key={r.id} className="text-sm">
                {formatTime(r.createdAt)} · {r.reasonText} · {r.status === 'DangCho' ? 'Đang chờ' : r.status === 'DaXuLy' ? 'Đã xử lý' : 'Đã hủy'}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="space-y-3 border-t p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">{s.status === 'DaDong' ? 'Đã thu' : 'Tạm tính'}</span>
          <span className="text-2xl font-bold tabular-nums">{formatVnd(s.status === 'DaDong' ? (s.payment?.total ?? s.subtotal) : s.subtotal)}</span>
        </div>
        {s.pendingTotal > 0 ? (
          <p className="text-muted-foreground text-sm">Đơn chờ xác nhận {formatVnd(s.pendingTotal)} chưa tính vào tạm tính</p>
        ) : null}
        {s.payment ? (
          <p className="text-muted-foreground text-sm">
            {paymentMethodLabels[s.payment.method]}
            {s.payment.cashReceived != null ? ` · khách đưa ${formatVnd(s.payment.cashReceived)} · thối ${formatVnd(s.payment.changeAmount)}` : ''}
            {' · '}
            {s.payment.closedByName} · {formatDateTime(s.payment.closedAt)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {open && can(permissions.orders.create) ? (
            <Button variant="outline" className="h-11" onClick={() => onStaffOrder(s.tableId)}>
              <ShoppingBasket aria-hidden="true" />
              Gọi món hộ
            </Button>
          ) : null}
          {open && can(permissions.tableSessions.transfer) ? (
            <Button variant="outline" className="h-11" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft aria-hidden="true" />
              Chuyển bàn
            </Button>
          ) : null}
          {table ? <OpenGuestPageButton tableCode={table.code} className="h-11" /> : null}
          {s.status === 'DaDong' ? (
            <Button variant="outline" className="h-11" onClick={() => printInFrame(routePath.receipt(s.id))}>
              <Printer aria-hidden="true" />
              In lại hóa đơn
            </Button>
          ) : null}
        </div>
        {open && can(permissions.tableSessions.checkout) ? (
          <div className="space-y-1">
            <Button className="h-12 w-full text-base" disabled={pending > 0} onClick={() => setCheckoutOpen(true)}>
              <Receipt aria-hidden="true" />
              Thu tiền {formatVnd(s.subtotal)}
            </Button>
            {pending > 0 ? (
              <p className="text-destructive text-center text-sm font-medium" role="status">
                Còn {pending} đơn chờ xác nhận
              </p>
            ) : null}
          </div>
        ) : null}
      </footer>

      <CheckoutDialog session={s} open={checkoutOpen} onOpenChange={setCheckoutOpen} onDone={onClose} />
      {transferOpen ? <TransferDialog session={s} onClose={() => setTransferOpen(false)} /> : null}
      {cancelling ? <CancelItemDialog order={cancelling.order} item={cancelling.item} onClose={() => setCancelling(null)} /> : null}
    </>
  )
}

/** Hủy món đã xác nhận (UC-15, BR-15, TC-30): số lượng 1…n, lý do bắt buộc (gợi ý sẵn) */
function CancelItemDialog({ order, item, onClose }: { order: StaffOrderDto; item: OrderItemDto; onClose: () => void }) {
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cancel = useLiveMutation(() => liveService.cancelItem(order.id, item.id, { quantity, reason: reason.trim() }))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hủy món {item.itemName}</DialogTitle>
          <DialogDescription>
            {order.tableName} · {order.code} · {item.quantity} × {formatVnd(item.unitPrice)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-qty">Số lượng hủy (1–{item.quantity})</Label>
          <Input
            id="cancel-qty"
            type="number"
            inputMode="numeric"
            min={1}
            max={item.quantity}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)))}
            className="h-11 w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Lý do hủy</Label>
          <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="Nhập lý do" className="h-11" />
          <div className="flex flex-wrap gap-1.5">
            {cancelReasonSuggestions.map((r) => (
              <Button key={r} type="button" size="sm" variant={reason === r ? 'secondary' : 'outline'} className="h-9" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            className="h-11"
            disabled={!reason.trim() || cancel.isPending}
            onClick={() =>
              cancel.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`Đã hủy ${quantity} ${item.itemName}`)
                  onClose()
                },
                onError: (e) => {
                  const f = getFieldErrors(e)
                  setError(f.quantity ?? f.reason ?? getErrorMessage(e))
                },
              })
            }
          >
            {cancel.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Hủy món
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Chuyển bàn (P3, FR-25, BR-18): chỉ sang bàn đang trống và đang bật */
function TransferDialog({ session, onClose }: { session: TableSessionDto; onClose: () => void }) {
  const board = useTableBoard()
  const [target, setTarget] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const transfer = useLiveMutation(() => liveService.transfer(session.id, { targetTableId: target!, version: session.version }))
  const options = (board.data ?? []).filter((t) => t.status === 'Trong' && t.isActive)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chuyển {session.tableName} sang bàn khác</DialogTitle>
          <DialogDescription>Phiên giữ mã {session.code}; khách cần quét QR bàn mới.</DialogDescription>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="h-11 w-full" aria-label="Bàn đích">
            <SelectValue placeholder="Chọn bàn trống" />
          </SelectTrigger>
          <SelectContent>
            {options.map((t) => (
              <SelectItem key={t.tableId} value={t.tableId}>
                {t.tableName} · {t.zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onClose}>
            Đóng
          </Button>
          <Button
            className="h-11"
            disabled={!target || transfer.isPending}
            onClick={() =>
              transfer.mutate(undefined, {
                onSuccess: (s) => {
                  toast.success(`Đã chuyển sang ${s.tableName}`)
                  onClose()
                },
                onError: (e) => setError(getErrorMessage(e)),
              })
            }
          >
            Chuyển bàn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
