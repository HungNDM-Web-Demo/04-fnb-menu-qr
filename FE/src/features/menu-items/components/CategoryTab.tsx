'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, FolderPlus, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { permissions } from '@/config/permissions'
import type { CategoryDto } from '@/types/menu-qr'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import {
  useCategories,
  useDeleteCategory,
  useReorderCategories,
  useSaveCategory,
} from '../hooks/use-menu-catalog'
import {
  HEX_COLOR_PATTERN,
  categorySchema,
  type CategoryFormValues,
} from '../schemas/menu-item.schema'

/** Màu mặc định khi thêm danh mục (là dữ liệu lưu vào DB, không phải màu giao diện) */
const DEFAULT_COLOR = '#B45309'
const EMPTY: CategoryFormValues = { code: '', name: '', nameEn: '', color: DEFAULT_COLOR, isHidden: false }

/**
 * Tab Danh mục (UC-03 1a, FR-06): thêm, sửa tên và màu, ẩn/hiện, đổi thứ tự bằng nút lên/xuống
 * (PUT /api/categories/order gửi đủ id theo thứ tự mới). Xóa danh mục còn món hiện nguyên văn lỗi API.
 */
export function CategoryTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.menuItems.create)
  const canUpdate = can(permissions.menuItems.update)
  const canDelete = can(permissions.menuItems.delete)

  const categories = useCategories()
  const reorder = useReorderCategories()
  const save = useSaveCategory()
  const remove = useDeleteCategory()

  const [order, setOrder] = useState<CategoryDto[]>([])
  const [form, setForm] = useState<{ open: boolean; category: CategoryDto | null }>({
    open: false,
    category: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<CategoryDto | null>(null)

  // Đồng bộ thứ tự hiển thị khi dữ liệu máy chủ đổi (đặt lại state trong lúc render)
  const [synced, setSynced] = useState<CategoryDto[] | undefined>(undefined)
  if (categories.data !== synced) {
    setSynced(categories.data)
    if (categories.data) setOrder(categories.data)
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    const next = [...order]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setOrder(next)
    reorder.mutate(
      next.map((c) => c.id),
      {
        onSuccess: () => toast.success('Đã lưu thứ tự danh mục'),
        onError: (error) => {
          toast.error(getErrorMessage(error))
          if (categories.data) setOrder(categories.data)
        },
      }
    )
  }

  const toggleHidden = (c: CategoryDto) =>
    save.mutate(
      { id: c.id, input: { code: c.code, name: c.name, nameEn: c.nameEn, color: c.color, isHidden: !c.isHidden } },
      {
        onSuccess: () =>
          toast.success(c.isHidden ? `Đã hiện danh mục ${c.name}` : `Đã ẩn danh mục ${c.name}`),
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa danh mục ${deleteTarget.name}`)
    } catch (error) {
      // Còn món: "Danh mục đang có {n} món, chuyển món sang danh mục khác trước" (07 §2.2)
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const pendingHiddenId = save.isPending ? save.variables?.id : undefined

  if (categories.error) {
    return (
      <Card className="p-0">
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </Card>
    )
  }

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-muted-foreground text-sm text-pretty">
          Thứ tự danh mục là thứ tự thanh danh mục trên trang khách. Danh mục ẩn không hiện với khách
          (món trong đó cũng ẩn).
        </p>
        <div className="flex items-center gap-2">
          {reorder.isPending && (
            <Loader2
              className="text-muted-foreground size-4 animate-spin"
              aria-label="Đang lưu thứ tự"
            />
          )}
          {canCreate && (
            <Button className="h-11" onClick={() => setForm({ open: true, category: null })}>
              <Plus aria-hidden="true" />
              Thêm danh mục
            </Button>
          )}
        </div>
      </div>

      {categories.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : order.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="Chưa có danh mục"
          description="Tạo danh mục trước rồi mới thêm món."
          action={
            canCreate && (
              <Button className="h-11" onClick={() => setForm({ open: true, category: null })}>
                <Plus aria-hidden="true" />
                Thêm danh mục
              </Button>
            )
          }
        />
      ) : (
        <ol className="divide-y" aria-label="Danh mục theo thứ tự">
          {order.map((c, index) => (
            <li
              key={c.id}
              className={cn(
                'flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2',
                c.isHidden && 'bg-muted/30'
              )}
            >
              <span
                className="text-muted-foreground w-6 text-right text-sm tabular-nums"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span
                className="size-9 shrink-0 rounded-lg border"
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate font-medium', c.isHidden && 'text-muted-foreground')}>
                  {c.name}{' '}
                  <span className="text-muted-foreground font-mono text-xs font-normal">
                    {c.code}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">{c.itemCount} món</p>
              </div>
              {c.isHidden && <StatusBadge tone="neutral">Đang ẩn</StatusBadge>}
              <div className="flex items-center gap-1">
                {canUpdate && (
                  <>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm">
                      <Switch
                        checked={!c.isHidden}
                        disabled={pendingHiddenId === c.id}
                        onCheckedChange={() => toggleHidden(c)}
                        aria-label={`Hiển thị danh mục ${c.name}`}
                      />
                      <span className="hidden sm:inline">Hiển thị</span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0 || reorder.isPending}
                      aria-label={`Đưa ${c.name} lên`}
                      title="Đưa lên"
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => move(index, index + 1)}
                      disabled={index === order.length - 1 || reorder.isPending}
                      aria-label={`Đưa ${c.name} xuống`}
                      title="Đưa xuống"
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => setForm({ open: true, category: c })}
                      aria-label={`Sửa ${c.name}`}
                      title="Sửa danh mục"
                    >
                      <Pencil />
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(c)}
                    aria-label={`Xóa ${c.name}`}
                    title="Xóa danh mục"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <CategoryFormDialog
        open={form.open}
        category={form.category}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa danh mục?"
        description={`Danh mục ${deleteTarget?.name} (${deleteTarget?.code}) sẽ bị xóa. Chỉ xóa được danh mục không còn món.`}
        confirmText="Xóa danh mục"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  )
}

type CategoryFormDialogProps = {
  open: boolean
  category: CategoryDto | null
  onOpenChange: (open: boolean) => void
}

/** Thêm/sửa danh mục: mã, tên, màu #RRGGBB (ô chọn màu + ô nhập), ẩn/hiện. */
function CategoryFormDialog({ open, category, onOpenChange }: CategoryFormDialogProps) {
  const save = useSaveCategory()
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: EMPTY,
  })
  const { errors } = form.formState
  const [color, isHidden] = useWatch({ control: form.control, name: ['color', 'isHidden'] })
  const validColor = HEX_COLOR_PATTERN.test(color ?? '')

  useEffect(() => {
    if (!open) return
    form.reset(
      category
        ? {
            code: category.code,
            name: category.name,
            nameEn: category.nameEn ?? '',
            color: category.color,
            isHidden: category.isHidden,
          }
        : EMPTY
    )
  }, [open, category, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: category?.id, input: { ...values, nameEn: values.nameEn || undefined, color: values.color.toUpperCase() } },
      {
        onSuccess: (saved) => {
          toast.success(
            category ? `Đã lưu danh mục ${saved.name}` : `Đã thêm danh mục ${saved.name}`
          )
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
          <DialogDescription>
            Màu dùng cho chấm nhãn và ô ảnh mặc định của món chưa có ảnh.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
            <FormField label="Mã" required error={errors.code?.message}>
              <Input
                autoComplete="off"
                spellCheck={false}
                className="uppercase"
                placeholder="CF"
                {...form.register('code')}
              />
            </FormField>
            <FormField label="Tên danh mục" required error={errors.name?.message}>
              <Input autoComplete="off" placeholder="vd: Cà phê" {...form.register('name')} />
            </FormField>
          </div>

          <FormField label="Tên tiếng Anh" error={errors.nameEn?.message}>
            <Input autoComplete="off" placeholder="vd: Coffee" {...form.register('nameEn')} />
          </FormField>

          <FormField
            label="Màu"
            required
            htmlFor="category-color"
            error={errors.color?.message}
            hint="Dạng #RRGGBB"
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={validColor ? color.toLowerCase() : '#000000'}
                onChange={(e) =>
                  form.setValue('color', e.target.value.toUpperCase(), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="border-input bg-background h-11 w-14 shrink-0 cursor-pointer rounded-md border p-1"
                aria-label="Chọn màu"
              />
              <Input
                id="category-color"
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                className="h-11 w-32 font-mono uppercase"
                aria-invalid={errors.color ? true : undefined}
                {...form.register('color')}
              />
            </div>
          </FormField>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Switch
              checked={!isHidden}
              onCheckedChange={(v) => form.setValue('isHidden', !v, { shouldDirty: true })}
            />
            Hiển thị trên trang khách
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
