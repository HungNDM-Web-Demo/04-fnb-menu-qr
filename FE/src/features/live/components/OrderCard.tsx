'use client'

import { useState } from 'react'
import { Check, CheckCheck, Clock, Loader2, Printer, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { removeReasonLabels } from '@/config/menu-qr-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PosRules } from '@/features/pos/lib/pos-rules'
import { computeWait } from '@/features/pos/lib/wait'
import type { OrderItemDto, RemoveReason, StaffOrderDto } from '@/types/menu-qr'
import { useLiveMutation } from '../hooks/use-live'
import { printInFrame } from '../lib/live-prefs'
import { liveService } from '../services/live.service'
import { RejectOrderDialog } from './RejectOrderDialog'

type Removal = { reason: RemoveReason; note?: string }

const levelBorder = {
  BinhThuong: 'border-border',
  Vang: 'border-wait-warn ring-wait-warn/30 ring-2',
  Do: 'border-wait-late ring-wait-late/30 ring-2',
} as const

/**
 * Thẻ đơn ở màn hình nhận đơn (SCR-05, UC-05, UC-06): bàn, mã, giờ gửi, đồng hồ chờ (viền theo mức §3.5), tên gọi,
 * nhãn nguồn, dòng món. Thẻ chờ: chạm dòng → Bỏ món, Xác nhận / Từ chối, không có nút phục vụ (TC-25). Thẻ chờ phục vụ:
 * "Đã phục vụ" từng dòng, "Phục vụ cả đơn", hoàn tác 10 giây, in lại phiếu.
 */
export function OrderCard({
  order,
  now,
  isNew,
  onTouch,
}: {
  order: StaffOrderDto
  now: number
  isNew?: boolean
  onTouch?: () => void
}) {
  const { can } = usePermissions()
  const pending = order.status === 'ChoXacNhan'
  const { waitMinutes, waitLevel } = computeWait(order, now)
  const [removals, setRemovals] = useState<Record<string, Removal>>({})
  const [rejectOpen, setRejectOpen] = useState(false)

  const confirm = useLiveMutation(() =>
    liveService.confirm(order.id, {
      removedItems: Object.entries(removals).map(([itemId, r]) => ({ itemId, reason: r.reason, note: r.note })),
    })
  )
  const serve = useLiveMutation((itemIds?: string[]) => liveService.serve(order.id, { itemIds }))
  const unserve = useLiveMutation((itemIds: string[]) => liveService.unserve(order.id, { itemIds }))

  const active = order.items.filter((i) => i.status !== 'BiBo' && i.status !== 'DaHuy')
  const allRemoved = pending && order.items.length > 0 && order.items.every((i) => removals[i.id])
  const keptTotal = pending ? order.items.filter((i) => !removals[i.id]).reduce((s, i) => s + i.lineTotal, 0) : order.total

  const doConfirm = () =>
    confirm.mutate(undefined, {
      onSuccess: (o) => {
        toast.success(`Đã xác nhận ${o.tableName} · ${o.code}`)
        printInFrame(routePath.kitchenTicket(o.id))
      },
      onError: (e) => toast.error(getErrorMessage(e)),
    })

  const doServe = (itemIds?: string[], label?: string) =>
    serve.mutate(itemIds, {
      onSuccess: (o) => {
        const served = itemIds ?? active.filter((i) => i.status === 'DaXacNhan').map((i) => i.id)
        toast.success(label ? `Đã phục vụ: ${label}` : `Đã phục vụ cả đơn ${o.tableName}`, {
          duration: PosRules.unserveButtonSeconds * 1000,
          action: {
            label: 'Hoàn tác',
            onClick: () => unserve.mutate(served, { onError: (e) => toast.error(getErrorMessage(e)) }),
          },
        })
      },
      onError: (e) => toast.error(getErrorMessage(e)),
    })

  return (
    <article
      className={cn('bg-card flex flex-col rounded-xl border-2 p-3 shadow-xs', levelBorder[waitLevel], isNew && 'border-primary')}
      onPointerDown={onTouch}
      aria-label={`${order.tableName}, đơn ${order.code}`}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-xl leading-tight font-bold">{order.tableName}</h3>
            {isNew ? <Badge className="bg-primary text-primary-foreground">Mới</Badge> : null}
            {order.autoConfirmed ? <Badge variant="secondary">Tự xác nhận</Badge> : null}
            {order.source === 'NhanVien' ? <Badge variant="secondary">Nhân viên gọi hộ</Badge> : null}
          </div>
          <p className="text-muted-foreground text-xs">
            {order.code} · gửi {formatTime(order.submittedAt)}
            {order.guestName ? ` · ${order.guestName}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-bold tabular-nums',
            waitLevel === 'Do' ? 'bg-wait-late-soft text-wait-late' : waitLevel === 'Vang' ? 'bg-wait-warn-soft text-wait-warn' : 'bg-muted'
          )}
          title={pending ? 'Thời gian chờ xác nhận' : 'Thời gian chờ phục vụ'}
        >
          <Clock className="size-3.5" aria-hidden="true" />
          {waitMinutes} phút
        </span>
      </header>

      {order.note ? <p className="bg-muted mt-2 rounded-md px-2 py-1 text-sm">Ghi chú: {order.note}</p> : null}

      <ul className="mt-2 divide-y">
        {order.items.map((item) => (
          <OrderLine
            key={item.id}
            item={item}
            pending={pending}
            removal={removals[item.id]}
            canConfirm={can(permissions.orders.confirm)}
            canServe={can(permissions.orders.serve)}
            serving={serve.isPending}
            onRemove={(r) => setRemovals((prev) => ({ ...prev, [item.id]: r }))}
            onRestore={() =>
              setRemovals((prev) => {
                const next = { ...prev }
                delete next[item.id]
                return next
              })
            }
            onServe={() => doServe([item.id], `${item.quantity} ${item.itemName}`)}
          />
        ))}
      </ul>

      <div className="mt-2 flex items-baseline justify-between border-t pt-2">
        <span className="text-muted-foreground text-sm">Tổng</span>
        <span className="text-lg font-bold tabular-nums">{formatVnd(keptTotal)}</span>
      </div>

      {pending ? (
        can(permissions.orders.confirm) ? (
          <div className="mt-2 space-y-1.5">
            {allRemoved ? (
              <p className="text-destructive text-sm font-medium" role="status">
                Đã bỏ hết món: dùng Từ chối thay cho Xác nhận
              </p>
            ) : null}
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button variant="outline" className="h-11" onClick={() => setRejectOpen(true)}>
                <X aria-hidden="true" />
                Từ chối
              </Button>
              <Button className="h-11 text-base" onClick={doConfirm} disabled={allRemoved || confirm.isPending}>
                {confirm.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                Xác nhận
              </Button>
            </div>
          </div>
        ) : null
      ) : order.status === 'DaXacNhan' ? (
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => printInFrame(routePath.kitchenTicket(order.id))}
            aria-label="In lại phiếu bếp"
            title="In lại phiếu"
          >
            <Printer aria-hidden="true" />
          </Button>
          {can(permissions.orders.serve) && order.unservedCount > 0 ? (
            <Button className="h-11 flex-1" variant="secondary" onClick={() => doServe()} disabled={serve.isPending}>
              {serve.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
              Phục vụ cả đơn
            </Button>
          ) : null}
        </div>
      ) : null}

      <RejectOrderDialog order={order} open={rejectOpen} onOpenChange={setRejectOpen} />
    </article>
  )
}

function OrderLine({
  item,
  pending,
  removal,
  canConfirm,
  canServe,
  serving,
  onRemove,
  onRestore,
  onServe,
}: {
  item: OrderItemDto
  pending: boolean
  removal?: Removal
  canConfirm: boolean
  canServe: boolean
  serving: boolean
  onRemove: (r: Removal) => void
  onRestore: () => void
  onServe: () => void
}) {
  const off = item.status === 'BiBo' || item.status === 'DaHuy' || !!removal
  const body = (
    <div className="flex min-w-0 flex-1 gap-2 text-left">
      <span className={cn('w-7 shrink-0 text-base font-bold tabular-nums', off && 'line-through opacity-60')}>{item.quantity}×</span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[0.9375rem] leading-snug font-semibold', off && 'text-muted-foreground line-through')}>{item.itemName}</p>
        {item.options.length > 0 ? <p className="text-muted-foreground text-sm">{item.options.map((o) => o.name).join(', ')}</p> : null}
        {item.note ? <p className="text-wait-warn text-sm font-medium">↳ {item.note}</p> : null}
        {removal ? (
          <p className="text-destructive text-sm font-medium">
            Bỏ: {removal.reason === 'Khac' ? removal.note : removeReasonLabels[removal.reason]}
          </p>
        ) : item.statusText ? (
          <p className="text-destructive text-sm font-medium">{item.statusText}</p>
        ) : null}
        {item.status === 'DaPhucVu' && !pending ? <p className="text-table-busy text-xs font-semibold">Đã phục vụ {formatTime(item.servedAt)}</p> : null}
      </div>
    </div>
  )

  if (pending && canConfirm) {
    return (
      <li className="py-1.5">
        {removal ? (
          <button type="button" className="hover:bg-muted flex min-h-11 w-full items-center gap-2 rounded-md px-1" onClick={onRestore}>
            {body}
            <span className="text-primary flex items-center gap-1 text-xs font-semibold">
              <Undo2 className="size-3.5" aria-hidden="true" />
              Giữ lại
            </span>
          </button>
        ) : (
          <RemovePopover itemName={item.itemName} onRemove={onRemove}>
            <button type="button" className="hover:bg-muted flex min-h-11 w-full items-center gap-2 rounded-md px-1" aria-label={`Bỏ món ${item.itemName}`}>
              {body}
            </button>
          </RemovePopover>
        )}
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2 py-1.5">
      {body}
      {!pending && item.status === 'DaXacNhan' && canServe ? (
        <Button size="sm" variant="outline" className="h-10 shrink-0" onClick={onServe} disabled={serving}>
          <Check aria-hidden="true" />
          Đã phục vụ
        </Button>
      ) : null}
    </li>
  )
}

function RemovePopover({ itemName, onRemove, children }: { itemName: string; onRemove: (r: Removal) => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [other, setOther] = useState(false)
  const [note, setNote] = useState('')
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setOther(false)
          setNote('')
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="font-semibold">Bỏ món {itemName}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="destructive"
            className="h-11"
            onClick={() => {
              onRemove({ reason: 'HetMon' })
              setOpen(false)
            }}
          >
            Hết món
          </Button>
          <Button variant={other ? 'secondary' : 'outline'} className="h-11" onClick={() => setOther(true)}>
            Khác
          </Button>
        </div>
        {other ? (
          <div className="space-y-2">
            <Textarea autoFocus rows={2} placeholder="Lý do bỏ món" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} />
            <Button
              className="h-10 w-full"
              disabled={!note.trim()}
              onClick={() => {
                onRemove({ reason: 'Khac', note: note.trim() })
                setOpen(false)
              }}
            >
              Bỏ món
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Chọn Hết món: món này báo hết trong hôm nay trên menu khách.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
