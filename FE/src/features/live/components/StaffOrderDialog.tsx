'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { tableStatusLabels } from '@/config/menu-qr-labels'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { normalizeVi } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { PosRules } from '@/features/pos/lib/pos-rules'
import { ItemOptionsForm, type PickerResult } from '@/features/guest/components/ItemOptionsForm'
import type { MenuItemDto } from '@/types/menu-qr'
import { useLiveMutation, useMenuBundle, useTableBoard } from '../hooks/use-live'
import { printInFrame } from '../lib/live-prefs'
import { liveService } from '../services/live.service'

type Line = PickerResult & { key: string; menuItemId: string; itemName: string }

/**
 * Gọi món hộ khách (SCR-07, UC-07, FR-20): thực đơn dạng lưới từ `GET /api/menu`, dùng lại tấm chọn tùy chọn của trang
 * khách; đơn nguồn Nhân viên, vào thẳng "Đã xác nhận", in phiếu bếp (TC-26).
 */
export function StaffOrderDialog({
  open,
  onOpenChange,
  tableId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tableId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(52rem,92vh)] flex-col gap-3 p-4 sm:max-w-6xl">
        {open ? <StaffOrderBody initialTableId={tableId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function StaffOrderBody({ initialTableId, onClose }: { initialTableId?: string; onClose: () => void }) {
  const menu = useMenuBundle()
  const board = useTableBoard()
  const [tableId, setTableId] = useState<string | undefined>(initialTableId)
  const [category, setCategory] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState<MenuItemDto | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [guestName, setGuestName] = useState('')
  const [note, setNote] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const create = useLiveMutation(() =>
    liveService.createStaffOrder({
      clientRequestId: requestId,
      tableId: tableId!,
      guestName: guestName.trim() || undefined,
      note: note.trim() || undefined,
      lines: lines.map((l) => ({ menuItemId: l.menuItemId, choiceIds: l.choiceIds, quantity: l.quantity, note: l.note })),
    })
  )

  const table = board.data?.find((t) => t.tableId === tableId)
  const keyword = normalizeVi(search)
  const items = useMemo(
    () =>
      (menu.data?.items ?? []).filter(
        (i) => (category === 'all' || i.categoryId === category) && (!keyword || normalizeVi(`${i.code} ${i.name}`).includes(keyword))
      ),
    [menu.data, category, keyword]
  )
  const colorOf = (categoryId: string) => menu.data?.categories.find((c) => c.id === categoryId)?.color
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  const addLine = (item: MenuItemDto, r: PickerResult) => {
    setRequestId(crypto.randomUUID())
    setLines((prev) => {
      const sig = `${item.id}|${[...r.choiceIds].sort().join(',')}|${r.note ?? ''}`
      const idx = prev.findIndex((l) => `${l.menuItemId}|${[...l.choiceIds].sort().join(',')}|${l.note ?? ''}` === sig)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: Math.min(PosRules.maxQuantity, next[idx].quantity + r.quantity) }
        return next
      }
      return [...prev, { ...r, key: crypto.randomUUID(), menuItemId: item.id, itemName: item.name }]
    })
  }

  const changeQty = (key: string, delta: number) => {
    setRequestId(crypto.randomUUID())
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(PosRules.maxQuantity, l.quantity + delta) } : l)).filter((l) => l.quantity > 0)
    )
  }

  const submit = () => {
    setError(null)
    create.mutate(undefined, {
      onSuccess: (order) => {
        toast.success(`Đã gọi món hộ ${order.tableName} · ${order.code} · ${formatVnd(order.total)}`)
        printInFrame(routePath.kitchenTicket(order.id))
        onClose()
      },
      onError: (e) => {
        const fields = getFieldErrors(e)
        const lineMsg = Object.entries(fields).find(([k]) => k.startsWith('lines.'))
        setError(lineMsg ? `${lines[Number(lineMsg[0].split('.')[1])]?.itemName ?? ''}: ${lineMsg[1]}` : getErrorMessage(e))
      },
    })
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <DialogTitle>Gọi món hộ khách</DialogTitle>
          <DialogDescription>Đơn vào thẳng trạng thái Đã xác nhận và in phiếu bếp.</DialogDescription>
        </div>
        <div className="w-64">
          <Label htmlFor="staff-order-table" className="sr-only">
            Bàn
          </Label>
          <Select value={tableId} onValueChange={setTableId}>
            <SelectTrigger id="staff-order-table" className="h-11 w-full">
              <SelectValue placeholder="Chọn bàn" />
            </SelectTrigger>
            <SelectContent>
              {(board.data ?? []).map((t) => (
                <SelectItem key={t.tableId} value={t.tableId} disabled={!t.isActive}>
                  {t.tableName} · {tableStatusLabels[t.status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] gap-4">
        <div className="flex min-h-0 flex-col gap-3">
          {picking ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <Button variant="ghost" className="mb-2 h-10" onClick={() => setPicking(null)}>
                <ArrowLeft aria-hidden="true" />
                {picking.name}
              </Button>
              <div className="px-4">
                <ItemOptionsForm
                  key={picking.id}
                  item={picking}
                  groups={menu.data?.optionGroups ?? []}
                  color={colorOf(picking.categoryId)}
                  submitLabel="Thêm"
                  onSubmit={(r) => {
                    addLine(picking, r)
                    setPicking(null)
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên món" className="h-10 pl-9" aria-label="Tìm món" />
                </div>
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
                  {[{ id: 'all', name: 'Tất cả' }, ...(menu.data?.categories ?? [])].map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant={category === c.id ? 'default' : 'outline'}
                      className="h-10 shrink-0 rounded-full"
                      onClick={() => setCategory(c.id)}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {menu.isLoading ? (
                  <div className="grid grid-cols-4 gap-3">
                    {Array.from({ length: 8 }, (_, i) => (
                      <Skeleton key={i} className="h-40 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={item.isSoldOut}
                        onClick={() =>
                          item.optionGroupIds.length > 0
                            ? setPicking(item)
                            : addLine(item, { choiceIds: [], quantity: 1, options: [], unitPrice: item.price })
                        }
                        className={cn(
                          'bg-card focus-visible:ring-ring flex flex-col overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none',
                          item.isSoldOut && 'opacity-50'
                        )}
                      >
                        <MenuImage imageUrl={item.imageUrl} name={item.name} color={colorOf(item.categoryId)} className="aspect-[4/3] w-full" />
                        <span className="flex flex-1 flex-col p-2">
                          <span className="line-clamp-2 text-sm leading-snug font-semibold">{item.name}</span>
                          <span className="mt-auto pt-1 text-sm font-bold tabular-nums">
                            {item.isSoldOut ? 'Hết món' : formatVnd(item.price)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <aside className="bg-muted/40 flex min-h-0 flex-col rounded-lg border p-3">
          <p className="font-semibold">{table ? `${table.tableName} · ${tableStatusLabels[table.status]}` : 'Chưa chọn bàn'}</p>
          <ul className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 ? <li className="text-muted-foreground py-6 text-center text-sm">Chạm món bên trái để thêm.</li> : null}
            {lines.map((l) => (
              <li key={l.key} className="bg-card rounded-md border p-2">
                <p className="text-sm leading-snug font-semibold">{l.itemName}</p>
                {l.options.length > 0 ? <p className="text-muted-foreground text-xs">{l.options.map((o) => o.name).join(', ')}</p> : null}
                {l.note ? <p className="text-muted-foreground text-xs italic">{l.note}</p> : null}
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="size-9" onClick={() => changeQty(l.key, -1)} aria-label="Giảm">
                      {l.quantity <= 1 ? <Trash2 aria-hidden="true" /> : <Minus aria-hidden="true" />}
                    </Button>
                    <span className="w-6 text-center font-semibold tabular-nums">{l.quantity}</span>
                    <Button size="icon" variant="outline" className="size-9" onClick={() => changeQty(l.key, 1)} aria-label="Tăng">
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{formatVnd(l.unitPrice * l.quantity)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-2 border-t pt-2">
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value.slice(0, 30))} placeholder="Tên gọi (không bắt buộc)" className="h-10" />
            <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Ghi chú đơn" className="h-10" />
            <p className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Tổng</span>
              <span className="text-lg font-bold tabular-nums">{formatVnd(total)}</span>
            </p>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="h-11 w-full text-base" disabled={!tableId || lines.length === 0 || create.isPending} onClick={submit}>
              {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Gửi đơn
            </Button>
          </div>
        </aside>
      </div>
    </>
  )
}
