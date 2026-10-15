'use client'

import { useMemo, useState } from 'react'
import {
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Printer,
  QrCode,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { tableStatusLabels } from '@/config/menu-qr-labels'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { QrImage } from '@/features/pos/components/QrImage'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DiningTableDto, TableStatus } from '@/types/menu-qr'
import { useDeleteTable, useRegenerateTableCode, useSetTableActive, useTables } from '../hooks/use-tables'
import { downloadQrPng, tableQrUrl, type QrLayout } from '../lib/qr'
import { PrintQrDialog } from './PrintQrDialog'
import { TableFormDialog } from './TableFormDialog'

const statusTone: Record<TableStatus, StatusTone> = {
  Trong: 'success',
  DangPhucVu: 'info',
  ChoThanhToan: 'warning',
  Tat: 'neutral',
}

type Pending = { kind: 'regenerate' | 'delete' | 'deactivate'; table: DiningTableDto } | null

/** Mở trang khách của bàn ở tab mới (FR-31, TC-37) */
export function openGuestPage(code: string) {
  window.open(routePath.guest(code), '_blank', 'noopener')
}

/**
 * Tab Bàn (UC-11, UC-12; FR-31..FR-33): bảng theo khu, mã bàn, ảnh QR thu nhỏ, trạng thái; thêm, sửa,
 * bật/tắt, đổi mã QR, xóa, mở trang khách, tải PNG; tick nhiều bàn rồi "In QR" theo mẫu.
 */
export function TablesTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.tables.create)
  const canUpdate = can(permissions.tables.update)
  const canDelete = can(permissions.tables.delete)
  const canPrint = can(permissions.tables.printQr)

  const tables = useTables()
  const setActive = useSetTableActive()
  const regenerate = useRegenerateTableCode()
  const remove = useDeleteTable()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<{ open: boolean; table: DiningTableDto | null }>({ open: false, table: null })
  const [pending, setPending] = useState<Pending>(null)
  const [printOpen, setPrintOpen] = useState(false)

  const list = useMemo(() => tables.data ?? [], [tables.data])
  const zones = useMemo(() => {
    const map = new Map<string, DiningTableDto[]>()
    list.forEach((t) => map.set(t.zone, [...(map.get(t.zone) ?? []), t]))
    return [...map.entries()]
  }, [list])
  const selectedIds = list.filter((t) => selected.has(t.id)).map((t) => t.id)

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const activate = (t: DiningTableDto) =>
    setActive.mutate(
      { id: t.id, isActive: true },
      {
        onSuccess: () => toast.success(`Đã bật ${t.name}, khách quét QR gọi món được`),
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )

  const confirmPending = async () => {
    if (!pending) return
    const t = pending.table
    try {
      if (pending.kind === 'regenerate') {
        const saved = await regenerate.mutateAsync(t.id)
        toast.success(`${t.name} có mã QR mới ${saved.code}. Nhớ in lại tấm QR.`)
      } else if (pending.kind === 'deactivate') {
        await setActive.mutateAsync({ id: t.id, isActive: false })
        toast.success(`Đã tắt ${t.name}, khách quét QR không gửi đơn được`)
      } else {
        await remove.mutateAsync(t.id)
        toggle([t.id], false)
        toast.success(`Đã xóa ${t.name}`)
      }
    } catch (error) {
      // Bàn có phiên mở: "Bàn đang có khách" (UC-11 E2, TC-39)
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const download = (t: DiningTableDto) =>
    downloadQrPng(t.name, t.code).catch((error) => toast.error(getErrorMessage(error, 'Không tạo được ảnh QR')))

  const print = (layout: QrLayout) => {
    const url = `${routePath.qrPrint}?ids=${selectedIds.join(',')}&layout=${layout}`
    window.open(url, '_blank', 'noopener')
    setPrintOpen(false)
  }

  if (tables.error && !tables.data) {
    return (
      <Card className="p-0">
        <ErrorState error={tables.error} onRetry={() => void tables.refetch()} />
      </Card>
    )
  }

  const allIds = list.map((t) => t.id)
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someChecked = allIds.some((id) => selected.has(id))

  const confirmCopy: Record<NonNullable<Pending>['kind'], { title: string; description: string; confirm: string }> = {
    regenerate: {
      title: `Đổi mã QR ${pending?.table.name ?? ''}?`,
      description: 'Tấm QR cũ sẽ hết hiệu lực ngay, cần in lại.',
      confirm: 'Đổi mã QR',
    },
    deactivate: {
      title: `Tắt ${pending?.table.name ?? ''}?`,
      description: 'Khách quét QR bàn này vẫn xem được menu nhưng không gửi đơn, không gọi nhân viên được.',
      confirm: 'Tắt bàn',
    },
    delete: {
      title: `Xóa ${pending?.table.name ?? ''}?`,
      description: 'Bàn biến khỏi danh sách; mã QR của bàn không bao giờ dùng lại. Lịch sử phiên vẫn giữ trong báo cáo.',
      confirm: 'Xóa bàn',
    },
  }

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <p className="text-muted-foreground text-sm">
          {list.length} bàn · {list.filter((t) => t.isActive).length} đang bật
          {selectedIds.length > 0 && <span className="text-foreground font-medium"> · đã chọn {selectedIds.length}</span>}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canPrint && (
            <Button
              variant="outline"
              className="h-11"
              disabled={selectedIds.length === 0}
              onClick={() => setPrintOpen(true)}
              title={selectedIds.length === 0 ? 'Tick chọn bàn để in QR' : undefined}
            >
              <Printer aria-hidden="true" />
              In QR{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
          )}
          {canCreate && (
            <Button className="h-11" onClick={() => setForm({ open: true, table: null })}>
              <Plus aria-hidden="true" />
              Thêm bàn
            </Button>
          )}
        </div>
      </div>

      {tables.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="Chưa có bàn"
          description="Thêm bàn để có mã QR cho khách quét gọi món."
          action={
            canCreate && (
              <Button className="h-11" onClick={() => setForm({ open: true, table: null })}>
                <Plus aria-hidden="true" />
                Thêm bàn
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggle(allIds, v === true)}
                    aria-label="Chọn mọi bàn"
                  />
                </TableHead>
                <TableHead>Tên bàn</TableHead>
                <TableHead className="text-right">Sức chứa</TableHead>
                <TableHead>Mã bàn</TableHead>
                <TableHead>QR</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-px">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            {zones.map(([zone, rows]) => {
              const ids = rows.map((r) => r.id)
              const zoneAll = ids.every((id) => selected.has(id))
              const zoneSome = ids.some((id) => selected.has(id))
              return (
                <TableBody key={zone}>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell>
                      <Checkbox
                        checked={zoneAll ? true : zoneSome ? 'indeterminate' : false}
                        onCheckedChange={(v) => toggle(ids, v === true)}
                        aria-label={`Chọn mọi bàn khu ${zone}`}
                      />
                    </TableCell>
                    <TableCell colSpan={6} className="font-semibold">
                      {zone} <span className="text-muted-foreground font-normal">· {rows.length} bàn</span>
                    </TableCell>
                  </TableRow>
                  {rows.map((t) => {
                    const busy = !!t.currentSessionId
                    return (
                      <TableRow key={t.id} data-state={selected.has(t.id) ? 'selected' : undefined} className={cn(!t.isActive && 'text-muted-foreground')}>
                        <TableCell>
                          <Checkbox checked={selected.has(t.id)} onCheckedChange={(v) => toggle([t.id], v === true)} aria-label={`Chọn ${t.name}`} />
                        </TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{t.capacity} chỗ</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-semibold tracking-wider">{t.code}</span>
                          {t.codeChangedAt && (
                            <p className="text-muted-foreground text-xs">Đổi lúc {formatDateTime(t.codeChangedAt)}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <a
                            href={tableQrUrl(t.code)}
                            target="_blank"
                            rel="noopener"
                            title={tableQrUrl(t.code)}
                            className="focus-visible:ring-ring/50 inline-block rounded-md outline-none focus-visible:ring-3"
                            aria-label={`Ảnh QR ${t.name}, mở trang khách`}
                          >
                            <QrImage value={tableQrUrl(t.code)} size={56} alt={`QR ${t.name}`} className={cn('border', !t.isActive && 'opacity-50')} />
                          </a>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={statusTone[t.status]}>{tableStatusLabels[t.status]}</StatusBadge>
                          {t.currentSessionCode && <p className="text-muted-foreground mt-0.5 font-mono text-xs">{t.currentSessionCode}</p>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="outline" className="h-11" onClick={() => openGuestPage(t.code)} aria-label={`Mở trang khách ${t.name}`}>
                              <ExternalLink aria-hidden="true" />
                              Mở trang khách
                            </Button>
                            {canPrint && (
                              <Button variant="ghost" size="icon-lg" onClick={() => void download(t)} aria-label={`Tải PNG mã QR ${t.name}`} title="Tải PNG">
                                <Download />
                              </Button>
                            )}
                            {(canUpdate || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-lg" aria-label={`Thao tác khác với ${t.name}`}>
                                    <MoreHorizontal />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {canUpdate && (
                                    <>
                                      <DropdownMenuItem onSelect={() => setForm({ open: true, table: t })}>
                                        <Pencil aria-hidden="true" />
                                        Sửa
                                      </DropdownMenuItem>
                                      {t.isActive ? (
                                        <DropdownMenuItem onSelect={() => setPending({ kind: 'deactivate', table: t })}>
                                          <PowerOff aria-hidden="true" />
                                          Tắt bàn
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem onSelect={() => activate(t)}>
                                          <Power aria-hidden="true" />
                                          Bật bàn
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onSelect={() => setPending({ kind: 'regenerate', table: t })}>
                                        <RefreshCcw aria-hidden="true" />
                                        Đổi mã QR
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem variant="destructive" onSelect={() => setPending({ kind: 'delete', table: t })}>
                                        <Trash2 aria-hidden="true" />
                                        Xóa bàn
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {busy && <p className="text-muted-foreground px-2 py-1.5 text-xs">Bàn đang có khách: không tắt, xóa, đổi mã được.</p>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              )
            })}
          </Table>
        </div>
      )}

      <TableFormDialog
        open={form.open}
        table={form.table}
        zones={zones.map(([z]) => z)}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <PrintQrDialog
        open={printOpen}
        tables={list.filter((t) => selected.has(t.id))}
        onOpenChange={setPrintOpen}
        onPrint={print}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        variant={pending?.kind === 'regenerate' ? 'default' : 'destructive'}
        icon={pending?.kind === 'regenerate' ? RefreshCcw : pending?.kind === 'delete' ? Trash2 : PowerOff}
        title={pending ? confirmCopy[pending.kind].title : ''}
        description={pending ? confirmCopy[pending.kind].description : undefined}
        confirmText={pending ? confirmCopy[pending.kind].confirm : undefined}
        loading={regenerate.isPending || remove.isPending || setActive.isPending}
        onConfirm={confirmPending}
      />
    </Card>
  )
}
