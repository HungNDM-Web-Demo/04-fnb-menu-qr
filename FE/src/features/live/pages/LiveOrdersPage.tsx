'use client'

import { useEffect, useMemo, useState } from 'react'
import { BellOff, BellRing, CheckCircle2, Clock, Loader2, PauseCircle, Printer, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { paymentMethodLabels, tableStatusLabels } from '@/config/menu-qr-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatTime, formatVnd } from '@/lib/format'
import { subscribePosEvents } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui.store'
import { OpenGuestPageButton } from '@/features/guest/components/OpenGuestPageButton'
import { useServerNow } from '@/features/pos/hooks/use-server-now'
import { playSound, unlockSound } from '@/features/pos/lib/sound'
import { requestWait } from '@/features/pos/lib/wait'
import type { ServiceRequestDto, TableBoardItem } from '@/types/menu-qr'
import { OrderCard } from '../components/OrderCard'
import { SessionDrawer } from '../components/SessionDrawer'
import { StaffOrderDialog } from '../components/StaffOrderDialog'
import { useLiveMutation, useLiveOrders, useOrderSettings, usePendingRequests, useTableBoard } from '../hooks/use-live'
import { printInFrame, useLivePrefs } from '../lib/live-prefs'
import { liveService } from '../services/live.service'

/**
 * SCR-05 Màn hình nhận đơn (UC-04…UC-08), tối ưu tablet ngang 1280 × 800 (NFR-06): tab Đơn (Chờ xác nhận / Chờ phục vụ),
 * Yêu cầu, Bàn; tiêu đề tab "({n}) Nhận đơn" đếm đơn mới chưa xem (07 §4.4, quyết định 14).
 */
export function LiveOrdersPage() {
  const { can } = usePermissions()
  const now = useServerNow(15_000)
  const orders = useLiveOrders()
  const requests = usePendingRequests(can(permissions.serviceRequests.view))
  const board = useTableBoard(can(permissions.tableSessions.view))
  const [tab, setTab] = useState('orders')
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  const [drawer, setDrawer] = useState<TableBoardItem | null>(null)
  const [staffOrder, setStaffOrder] = useState<{ open: boolean; tableId?: string }>({ open: false })

  // Sidebar thu gọn mặc định ở màn này, trả lại khi rời trang
  useEffect(() => {
    const { sidebarOpen, setSidebarOpen } = useUiStore.getState()
    setSidebarOpen(false)
    return () => useUiStore.getState().setSidebarOpen(sidebarOpen)
  }, [])

  // Đơn mới đến sau khi mở trang (07 §4.4) + tự in phiếu bếp đơn tự xác nhận (FR-18, TC-22)
  useEffect(() => {
    return subscribePosEvents((event) => {
      if (event.name !== 'order-submitted') return
      if (event.payload.status === 'ChoXacNhan') setNewIds((prev) => new Set(prev).add(event.payload.orderId))
      if (event.payload.autoConfirmed && useLivePrefs.getState().autoPrint) {
        printInFrame(routePath.kitchenTicket(event.payload.orderId))
      }
    })
  }, [])

  const pendingIds = useMemo(() => new Set((orders.data?.pending ?? []).map((o) => o.id)), [orders.data])
  const unseen = [...newIds].filter((id) => pendingIds.has(id)).length
  useEffect(() => {
    document.title = unseen > 0 ? `(${unseen}) Nhận đơn` : 'Nhận đơn'
  }, [unseen])
  useEffect(() => () => void (document.title = 'Nhận đơn'), [])

  const touch = (id: string) =>
    setNewIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const pending = orders.data?.pending ?? []
  const serving = orders.data?.serving ?? []
  const reqList = requests.data ?? []

  return (
    <PermissionGuard permission={permissions.orders.view} redirect>
      <div className="-mx-4 -my-5 flex min-h-[calc(100svh-4rem)] flex-col sm:-mx-6 sm:-my-6 lg:-mx-8">
        <LiveToolbar onStaffOrder={() => setStaffOrder({ open: true })} />
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="bg-background sticky top-16 z-10 border-b px-4 py-2">
            <TabsList className="h-11">
              <TabsTrigger value="orders" className="h-9 gap-2 px-4 text-base">
                Đơn
                {pending.length > 0 ? <Badge className="bg-wait-late text-background">{pending.length}</Badge> : null}
              </TabsTrigger>
              {can(permissions.serviceRequests.view) ? (
                <TabsTrigger value="requests" className="h-9 gap-2 px-4 text-base">
                  Yêu cầu
                  {reqList.length > 0 ? <Badge className="bg-wait-warn text-background">{reqList.length}</Badge> : null}
                </TabsTrigger>
              ) : null}
              {can(permissions.tableSessions.view) ? (
                <TabsTrigger value="tables" className="h-9 px-4 text-base">
                  Bàn
                </TabsTrigger>
              ) : null}
            </TabsList>
          </div>

          <TabsContent value="orders" className="p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Column title="Chờ xác nhận" count={pending.length} loading={orders.isLoading} empty="Không có đơn chờ xác nhận">
                {pending.map((o) => (
                  <OrderCard key={o.id} order={o} now={now} isNew={newIds.has(o.id)} onTouch={() => touch(o.id)} />
                ))}
              </Column>
              <Column title="Chờ phục vụ" count={serving.length} loading={orders.isLoading} empty="Không có món chờ phục vụ">
                {serving.map((o) => (
                  <OrderCard key={o.id} order={o} now={now} />
                ))}
              </Column>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="p-4">
            <RequestsList list={reqList} now={now} loading={requests.isLoading} />
          </TabsContent>

          <TabsContent value="tables" className="p-4">
            <TablesGrid list={board.data ?? []} loading={board.isLoading} onOpen={setDrawer} />
          </TabsContent>
        </Tabs>

        <SessionDrawer
          table={drawer}
          onClose={() => setDrawer(null)}
          onStaffOrder={(tableId) => {
            setDrawer(null)
            setStaffOrder({ open: true, tableId })
          }}
        />
        <StaffOrderDialog
          open={staffOrder.open}
          tableId={staffOrder.tableId}
          onOpenChange={(open) => setStaffOrder((s) => ({ ...s, open }))}
        />
      </div>
    </PermissionGuard>
  )
}

function LiveToolbar({ onStaffOrder }: { onStaffOrder: () => void }) {
  const { can } = usePermissions()
  const settings = useOrderSettings()
  const { sound, setSound, autoPrint, setAutoPrint } = useLivePrefs()
  const s = settings.data
  return (
    <div className="bg-card flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
      {s ? (
        s.accepting ? (
          <span className="bg-table-busy-soft text-table-busy flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Đang nhận đơn QR · {s.openTime === s.closeTime ? 'cả ngày' : `${s.openTime}–${s.closeTime}`}
          </span>
        ) : (
          <span className="bg-wait-warn-soft flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold">
            <PauseCircle className="text-wait-warn size-4" aria-hidden="true" />
            {s.blockReason === 'QuanTamNgung' ? 'Tạm ngưng nhận đơn QR' : `Ngoài giờ nhận đơn QR (${s.openTime}–${s.closeTime})`}
          </span>
        )
      ) : (
        <Skeleton className="h-10 w-56 rounded-full" />
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          variant={sound ? 'secondary' : 'outline'}
          className="h-10"
          onClick={async () => {
            if (sound) return setSound(false)
            await unlockSound()
            setSound(true)
            playSound('ticket')
          }}
          aria-pressed={sound}
        >
          {sound ? <BellRing aria-hidden="true" /> : <BellOff aria-hidden="true" />}
          {sound ? 'Âm báo đang bật' : 'Bật âm báo'}
        </Button>
        <div className="flex h-10 items-center gap-2 rounded-md border px-3">
          <Printer className="text-muted-foreground size-4" aria-hidden="true" />
          <Label htmlFor="auto-print" className="text-sm">
            Tự in phiếu bếp
          </Label>
          <Switch id="auto-print" checked={autoPrint} onCheckedChange={setAutoPrint} />
        </div>
        <OpenGuestPageButton />
        {can(permissions.orders.create) ? (
          <Button className="h-10" onClick={onStaffOrder}>
            <ShoppingBasket aria-hidden="true" />
            Gọi món hộ
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Column({
  title,
  count,
  loading,
  empty,
  children,
}: {
  title: string
  count: number
  loading: boolean
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        {title}
        <span className="bg-muted rounded-full px-2.5 py-0.5 text-sm tabular-nums">{count}</span>
      </h2>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      ) : count === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed py-10 text-center">{empty}</p>
      ) : (
        <div className="grid gap-3 2xl:grid-cols-2">{children}</div>
      )}
    </section>
  )
}

function RequestsList({ list, now, loading }: { list: ServiceRequestDto[]; now: number; loading: boolean }) {
  const { can } = usePermissions()
  const handle = useLiveMutation((id: string) => liveService.handleRequest(id))
  if (loading) return <Skeleton className="h-40 rounded-xl" />
  if (list.length === 0) return <p className="text-muted-foreground rounded-xl border border-dashed py-10 text-center">Không có yêu cầu đang chờ</p>
  return (
    <ul className="max-w-3xl space-y-2">
      {list.map((r) => {
        const { waitMinutes, isOverdue } = requestWait(r.createdAt, now)
        return (
          <li
            key={r.id}
            className={cn('flex items-center gap-3 rounded-xl border-2 p-3', isOverdue ? 'border-wait-late bg-wait-late-soft' : 'bg-card')}
          >
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">
                {r.tableName} · {r.reasonText} · {waitMinutes} phút
              </p>
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <Clock className="size-3.5" aria-hidden="true" />
                Gửi {formatTime(r.createdAt)}
                {r.sessionCode ? ` · ${r.sessionCode}` : ''}
              </p>
            </div>
            {can(permissions.serviceRequests.update) ? (
              <Button
                className="h-11"
                disabled={handle.isPending && handle.variables === r.id}
                onClick={() =>
                  handle.mutate(r.id, {
                    onSuccess: () => toast.success(`Đã xử lý ${r.tableName} · ${r.reasonText}`),
                    onError: (e) => toast.error(getErrorMessage(e)),
                  })
                }
              >
                {handle.isPending && handle.variables === r.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                Đã xử lý
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

const tableTone: Record<TableBoardItem['status'], string> = {
  Trong: 'bg-card border-border',
  DangPhucVu: 'bg-table-busy-soft border-table-busy',
  ChoThanhToan: 'bg-table-pay-soft border-table-pay',
  Tat: 'bg-table-off-soft border-table-off text-muted-foreground',
}

function TablesGrid({ list, loading, onOpen }: { list: TableBoardItem[]; loading: boolean; onOpen: (t: TableBoardItem) => void }) {
  if (loading) return <Skeleton className="h-64 rounded-xl" />
  const zones = [...new Set(list.map((t) => t.zone))]
  return (
    <div className="space-y-5">
      {zones.map((zone) => (
        <section key={zone} aria-label={zone}>
          <h2 className="mb-2 text-lg font-bold">{zone}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
            {list
              .filter((t) => t.zone === zone)
              .map((t) => (
                <button
                  key={t.tableId}
                  type="button"
                  onClick={() => onOpen(t)}
                  className={cn(
                    'focus-visible:ring-ring relative flex min-h-28 flex-col rounded-xl border-2 p-3 text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none',
                    tableTone[t.status]
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-lg font-bold">{t.tableName}</span>
                    <span className="flex gap-1">
                      {t.session?.pendingOrderCount ? (
                        <span className="bg-wait-late text-background rounded-full px-1.5 text-xs leading-5 font-bold" title="Đơn chờ xác nhận">
                          {t.session.pendingOrderCount}
                        </span>
                      ) : null}
                      {t.pendingRequestCount ? (
                        <span className="bg-wait-warn text-background rounded-full px-1.5 text-xs leading-5 font-bold" title="Yêu cầu chờ">
                          {t.pendingRequestCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">{tableStatusLabels[t.status]}</span>
                  {t.session?.paymentRequest ? (
                    <span className="text-table-pay text-xs font-semibold">
                      {paymentMethodLabels[t.session.paymentRequest.method]}
                      {t.session.paymentRequest.needVatInvoice ? ' · Cần HĐ GTGT' : ''}
                    </span>
                  ) : null}
                  {t.session ? (
                    <span className="mt-auto pt-1 text-sm">
                      <span className="text-muted-foreground">
                        {formatTime(t.session.openedAt)} · {t.session.orderCount} đơn
                      </span>
                      <span className="block font-bold tabular-nums">{formatVnd(t.session.subtotal)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground mt-auto text-xs">{t.capacity} chỗ</span>
                  )}
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
