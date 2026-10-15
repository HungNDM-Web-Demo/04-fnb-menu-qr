'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ListChecks,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { menuTagLabels, soldOutModeLabels } from '@/config/menu-qr-labels'
import { permissions } from '@/config/permissions'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MenuItemDto, MenuItemStatus, SoldOutMode } from '@/types/menu-qr'
import {
  useCategories,
  useDeleteMenuItem,
  useMenuItems,
  useOptionGroups,
  useReorderMenuItems,
  useSetMenuItemAvailability,
  useSetMenuItemHidden,
} from '../hooks/use-menu-catalog'
import { EVER_ORDERED_MESSAGE, MENU_ITEM_STATUSES, menuItemStatusView } from '../lib/labels'
import { ItemChoicesDialog } from './ItemChoicesDialog'
import { MenuItemFormDialog } from './MenuItemFormDialog'
import { SoldOutModeDialog } from './SoldOutModeDialog'

type Filters = { categoryId: string; status: MenuItemStatus }
type FormState = { open: boolean; item: MenuItemDto | null }

/**
 * Tab Món (UC-09, UC-10; FR-27, FR-30; BR-16): danh sách phân trang phía máy chủ, công tắc "Còn món"
 * (hỏi Hết trong hôm nay / Hết tới khi mở lại), lựa chọn hết theo món, ẩn/hiện, thêm/sửa, sắp xếp,
 * xóa món chưa từng gọi. Nhân viên chỉ thấy công tắc (TC-36).
 */
export function MenuItemsTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.menuItems.create)
  const canUpdate = can(permissions.menuItems.update)
  const canDelete = can(permissions.menuItems.delete)
  const canAvailability = can(permissions.menuItems.availability)

  const table = useTableQuery<Filters>({ pageSize: 20 })
  const items = useMenuItems(table.query)
  const categories = useCategories()
  const optionGroups = useOptionGroups()
  const availability = useSetMenuItemAvailability()
  const hidden = useSetMenuItemHidden()
  const reorder = useReorderMenuItems()
  const remove = useDeleteMenuItem()

  const [form, setForm] = useState<FormState>({ open: false, item: null })
  const [deleteTarget, setDeleteTarget] = useState<MenuItemDto | null>(null)
  const [soldOutTarget, setSoldOutTarget] = useState<MenuItemDto | null>(null)
  const [choicesTarget, setChoicesTarget] = useState<MenuItemDto | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const categoryList = useMemo(() => categories.data ?? [], [categories.data])
  const groupList = useMemo(() => optionGroups.data ?? [], [optionGroups.data])
  const colorOf = useMemo(() => new Map(categoryList.map((c) => [c.id, c.color])), [categoryList])
  const groupName = useMemo(() => new Map(groupList.map((g) => [g.id, g.name])), [groupList])
  const hasFilters = !!(table.state.search || table.state.categoryId || table.state.status)

  const rows = items.data?.items
  // Sắp xếp món trong danh mục: chỉ khi lọc đúng một danh mục, không tìm, không lọc trạng thái, thấy đủ món
  const canReorder =
    canUpdate &&
    !!table.state.categoryId &&
    !table.state.search &&
    !table.state.status &&
    !table.state.sortBy &&
    !!rows &&
    rows.length === items.data?.totalCount

  const clearFilters = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const setAvailable = (m: MenuItemDto, isSoldOut: boolean, mode?: SoldOutMode) =>
    availability.mutate(
      { id: m.id, input: { isSoldOut, mode } },
      {
        onSuccess: () => {
          setSoldOutTarget(null)
          toast.success(isSoldOut ? `Đã báo hết ${m.name} (${soldOutModeLabels[mode!].toLowerCase()})` : `${m.name} đã bán lại`)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )

  const toggleHidden = (m: MenuItemDto) =>
    hidden.mutate(
      { id: m.id, isHidden: !m.isHidden },
      {
        onSuccess: () => toast.success(m.isHidden ? `Đã hiện lại ${m.name}` : `Đã ẩn ${m.name} khỏi trang khách`),
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )

  const move = (from: number, to: number) => {
    if (!rows || !table.state.categoryId || to < 0 || to >= rows.length) return
    const ids = rows.map((r) => r.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    reorder.mutate(
      { categoryId: table.state.categoryId, ids },
      {
        onSuccess: () => toast.success('Đã lưu thứ tự món'),
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const pendingAvailabilityId = availability.isPending ? availability.variables?.id : undefined
  const pendingHiddenId = hidden.isPending ? hidden.variables?.id : undefined

  const columns: ColumnDef<MenuItemDto>[] = [
    {
      id: 'image',
      header: () => <span className="sr-only">Ảnh</span>,
      meta: { className: 'w-16 pr-0', headerClassName: 'w-16' },
      cell: ({ row }) => (
        <MenuImage
          imageUrl={row.original.imageUrl}
          name={row.original.name}
          color={colorOf.get(row.original.categoryId)}
          className={cn('size-12 rounded-lg', row.original.status !== 'DangBan' && 'opacity-60')}
          textClassName="text-sm"
        />
      ),
    },
    {
      id: 'code',
      header: 'Mã',
      enableSorting: true,
      meta: { className: 'w-20' },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span>,
    },
    {
      id: 'name',
      header: 'Tên món',
      enableSorting: true,
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="max-w-72 min-w-0">
            <p className="truncate font-medium">{m.name}</p>
            {m.nameEn && <p className="text-muted-foreground truncate text-xs">{m.nameEn}</p>}
            {m.optionGroupIds.length > 0 && (
              <p className="text-muted-foreground truncate text-xs">
                Tùy chọn: {m.optionGroupIds.map((id) => groupName.get(id)).filter(Boolean).join(', ')}
              </p>
            )}
            {m.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.tags.map((t) => (
                  <span key={t} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[11px] font-medium">
                    {menuTagLabels[t]}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'categoryName',
      header: 'Danh mục',
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: colorOf.get(row.original.categoryId) }}
            aria-hidden="true"
          />
          {row.original.categoryName}
        </span>
      ),
    },
    {
      id: 'price',
      header: 'Giá',
      enableSorting: true,
      meta: { className: 'text-right', headerClassName: 'text-right' },
      cell: ({ row }) => (
        <div className="text-right whitespace-nowrap">
          <p className="font-medium tabular-nums">{formatVnd(row.original.price)}</p>
          <p className="text-muted-foreground text-xs">/{row.original.unit}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const m = row.original
        const s = menuItemStatusView[m.status]
        return (
          <div className="space-y-0.5">
            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
            {m.status === 'HetMon' && m.soldOutMode && (
              <p className="text-muted-foreground text-xs">{soldOutModeLabels[m.soldOutMode]}</p>
            )}
            {m.status === 'HetMon' && !m.soldOutMode && (
              <p className="text-muted-foreground text-xs">Nhóm bắt buộc hết lựa chọn</p>
            )}
          </div>
        )
      },
    },
    {
      id: 'available',
      header: 'Còn món',
      cell: ({ row }) => {
        const m = row.original
        const available = !m.soldOutMode
        return (
          <label
            className={cn(
              'inline-flex min-h-11 items-center gap-2 text-sm whitespace-nowrap',
              canAvailability ? 'cursor-pointer' : 'cursor-not-allowed'
            )}
            title={canAvailability ? undefined : 'Bạn không có quyền báo hết món'}
          >
            <Switch
              checked={available}
              disabled={!canAvailability || pendingAvailabilityId === m.id}
              onCheckedChange={(v) => (v ? setAvailable(m, false) : setSoldOutTarget(m))}
              aria-label={`Còn món ${m.name}`}
            />
            <span className={cn(available ? 'text-foreground' : 'text-warning font-medium')}>
              {available ? 'Còn món' : 'Hết món'}
            </span>
          </label>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Thao tác</span>,
      meta: { className: 'text-right', headerClassName: 'w-px' },
      cell: ({ row }) => {
        const m = row.original
        const index = row.index
        const reasonId = `ever-ordered-${m.id}`
        return (
          <div className="flex items-center justify-end gap-1">
            {canReorder && (
              <>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0 || reorder.isPending}
                  aria-label={`Đưa ${m.name} lên`}
                  title="Đưa lên"
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => move(index, index + 1)}
                  disabled={index === (rows?.length ?? 0) - 1 || reorder.isPending}
                  aria-label={`Đưa ${m.name} xuống`}
                  title="Đưa xuống"
                >
                  <ArrowDown />
                </Button>
              </>
            )}
            {m.optionGroupIds.length > 0 && canAvailability && (
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={() => setChoicesTarget(m)}
                aria-label={`Lựa chọn của ${m.name}`}
                title="Lựa chọn: báo hết, bán lại"
              >
                <ListChecks />
              </Button>
            )}
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={() => toggleHidden(m)}
                disabled={pendingHiddenId === m.id}
                aria-label={m.isHidden ? `Hiện lại ${m.name}` : `Ẩn ${m.name}`}
                title={m.isHidden ? 'Hiện lại trên trang khách' : 'Ẩn khỏi trang khách'}
              >
                {m.isHidden ? <Eye /> : <EyeOff />}
              </Button>
            )}
            {canUpdate && (
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={() => setForm({ open: true, item: m })}
                aria-label={`Sửa ${m.name}`}
                title="Sửa món"
              >
                <Pencil />
              </Button>
            )}
            {canDelete &&
              (m.everOrdered ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        onClick={() => toast.info(EVER_ORDERED_MESSAGE)}
                        className="focus-visible:ring-ring/50 inline-flex rounded-md outline-none focus-visible:ring-3"
                        aria-describedby={reasonId}
                      >
                        <Button variant="ghost" size="icon-lg" disabled aria-label={`Xóa ${m.name}`}>
                          <Trash2 />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-56">
                      {EVER_ORDERED_MESSAGE}
                    </TooltipContent>
                  </Tooltip>
                  <span id={reasonId} className="sr-only">
                    {EVER_ORDERED_MESSAGE}
                  </span>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(m)}
                  aria-label={`Xóa ${m.name}`}
                  title="Xóa món"
                >
                  <Trash2 />
                </Button>
              ))}
          </div>
        )
      },
    },
  ]

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa món ${deleteTarget.name}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const openCreate = () => setForm({ open: true, item: null })

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(m) => m.id}
        isLoading={items.isLoading}
        isFetching={items.isFetching}
        error={items.error}
        onRetry={() => void items.refetch()}
        minWidth={1040}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={
          items.data && {
            page: items.data.page,
            pageSize: items.data.pageSize,
            totalCount: items.data.totalCount,
            totalPages: items.data.totalPages,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }
        }
        toolbar={
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput
              key={searchKey}
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder="Tìm mã, tên món"
              className="lg:max-w-64"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
              <Select
                value={table.state.categoryId ?? 'all'}
                onValueChange={(v) => table.setFilter('categoryId', v === 'all' ? undefined : v)}
                disabled={!categoryList.length}
              >
                <SelectTrigger className="h-11 lg:w-52" aria-label="Lọc theo danh mục">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi danh mục</SelectItem>
                  {categoryList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={table.state.status ?? 'all'}
                onValueChange={(v) => table.setFilter('status', v === 'all' ? undefined : (v as MenuItemStatus))}
              >
                <SelectTrigger className="h-11 lg:w-40" aria-label="Lọc theo trạng thái">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi trạng thái</SelectItem>
                  {MENU_ITEM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {menuItemStatusView[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" className="text-muted-foreground h-11" onClick={clearFilters}>
                <X aria-hidden="true" />
                Xóa lọc
              </Button>
            )}
            {canUpdate && !canReorder && !table.state.categoryId && (
              <p className="text-muted-foreground text-xs lg:max-w-56">Lọc theo một danh mục để sắp xếp thứ tự món.</p>
            )}
            {canCreate && (
              <Button className="h-11 lg:ml-auto" onClick={openCreate}>
                <Plus aria-hidden="true" />
                Thêm món
              </Button>
            )}
          </div>
        }
        emptyState={
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Không có món phù hợp"
              description="Thử từ khóa khác hoặc bỏ bớt bộ lọc."
              action={
                <Button variant="outline" className="h-11" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="Chưa có món nào"
              description="Thêm món để khách quét QR gọi được."
              action={
                canCreate && (
                  <Button className="h-11" onClick={openCreate}>
                    <Plus aria-hidden="true" />
                    Thêm món
                  </Button>
                )
              }
            />
          )
        }
      />

      {(canCreate || canUpdate) && (
        <MenuItemFormDialog
          key={form.item?.id ?? 'new'}
          open={form.open}
          onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
          item={form.item}
          categories={categoryList}
          optionGroups={groupList}
          defaultCategoryId={table.state.categoryId}
          canUploadImage={canUpdate}
        />
      )}
      <ItemChoicesDialog
        item={choicesTarget}
        groups={groupList}
        canToggle={canAvailability}
        onClose={() => setChoicesTarget(null)}
      />
      <SoldOutModeDialog
        target={soldOutTarget && { title: soldOutTarget.name }}
        pending={availability.isPending}
        onCancel={() => setSoldOutTarget(null)}
        onChoose={(mode) => soldOutTarget && setAvailable(soldOutTarget, true, mode)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa món này?"
        description={`${deleteTarget?.name} (${deleteTarget?.code}) sẽ bị xóa khỏi thực đơn. Món chưa từng được gọi nên không ảnh hưởng đơn, báo cáo.`}
        confirmText="Xóa món"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
