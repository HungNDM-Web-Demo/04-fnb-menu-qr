'use client'

import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, ImagePlus, Info, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { menuTagLabels } from '@/config/menu-qr-labels'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CategoryDto, MenuItemDto, OptionGroupDto } from '@/types/menu-qr'
import { useNextMenuItemCode, useSaveMenuItem, useUploadMenuItemImage } from '../hooks/use-menu-catalog'
import { MENU_TAGS, UNIT_SUGGESTIONS, describeGroup } from '../lib/labels'
import { menuItemSchema, type MenuItemFormValues } from '../schemas/menu-item.schema'
import { MoneyInput } from '@/features/pos/components/MoneyInput'
import { MenuPreviewPanel } from './MenuPreviewPanel'

type MenuItemFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có món là sửa, không có là thêm mới */
  item: MenuItemDto | null
  categories: CategoryDto[]
  optionGroups: OptionGroupDto[]
  /** Danh mục đang lọc ở bảng, mặc định khi thêm món */
  defaultCategoryId?: string
  canUploadImage: boolean
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

function toValues(item: MenuItemDto | null, defaultCategoryId?: string): MenuItemFormValues {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    nameEn: item?.nameEn ?? '',
    categoryId: item?.categoryId ?? defaultCategoryId ?? '',
    description: item?.description ?? '',
    descriptionEn: item?.descriptionEn ?? '',
    unit: item?.unit ?? UNIT_SUGGESTIONS[0],
    price: item?.price ?? null,
    tags: item?.tags ?? [],
    optionGroupIds: item?.optionGroupIds ?? [],
  }
}

/**
 * Thêm/sửa món (UC-09 bước 3–5, FR-27, FR-29): mã M001, tên, danh mục, ảnh, mô tả, giá bội số 1.000 ₫,
 * đơn vị, nhãn, nhóm tùy chọn có thứ tự; khung điện thoại bên phải xem trước như khách thấy.
 * Lỗi API (409 "Mã món đã tồn tại", giá lẻ) gắn vào đúng ô (UC-09 E1, E2).
 */
export function MenuItemFormDialog({
  open,
  onOpenChange,
  item,
  categories,
  optionGroups,
  defaultCategoryId,
  canUploadImage,
}: MenuItemFormDialogProps) {
  const save = useSaveMenuItem()
  const upload = useUploadMenuItemImage()
  const nextCode = useNextMenuItemCode(open && !item)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: toValues(null),
  })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(toValues(item, defaultCategoryId))
  }, [open, item, defaultCategoryId, form])

  useEffect(() => {
    if (open && !item && nextCode.data && !nextCode.isFetching && !form.getValues('code')) {
      form.setValue('code', nextCode.data, { shouldDirty: false })
    }
  }, [open, item, nextCode.data, nextCode.isFetching, form])

  const values = useWatch({ control: form.control }) as MenuItemFormValues
  const color = categories.find((c) => c.id === values.categoryId)?.color
  const selectedGroups = (values.optionGroupIds ?? [])
    .map((id) => optionGroups.find((g) => g.id === id))
    .filter((g): g is OptionGroupDto => !!g)
  const freeGroups = optionGroups.filter((g) => !values.optionGroupIds?.includes(g.id))
  const pending = save.isPending
  const imageUrl = uploadedUrl ?? item?.imageUrl

  const setGroups = (ids: string[]) => form.setValue('optionGroupIds', ids, { shouldDirty: true })
  const moveGroup = (from: number, to: number) => {
    const ids = [...(values.optionGroupIds ?? [])]
    if (to < 0 || to >= ids.length) return
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    setGroups(ids)
  }
  const toggleTag = (tag: MenuItemFormValues['tags'][number]) => {
    const tags = values.tags ?? []
    form.setValue('tags', tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag], { shouldDirty: true })
  }

  const pickImage = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file || !item) return
    if (!IMAGE_TYPES.includes(file.type)) return void toast.error('Chỉ nhận ảnh JPG, PNG hoặc WebP')
    if (file.size > MAX_IMAGE_BYTES) return void toast.error('Ảnh tối đa 2 MB')
    upload.mutate(
      { id: item.id, file },
      {
        onSuccess: (result) => {
          setUploadedUrl(result.imageUrl)
          toast.success(`Đã cập nhật ảnh món ${item.name}`)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: item?.id,
        input: {
          code: v.code,
          name: v.name,
          nameEn: v.nameEn || undefined,
          categoryId: v.categoryId,
          description: v.description || undefined,
          descriptionEn: v.descriptionEn || undefined,
          unit: v.unit,
          price: v.price ?? 0,
          tags: v.tags,
          optionGroupIds: v.optionGroupIds,
          sortOrder: item && item.categoryId === v.categoryId ? item.sortOrder : undefined,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(item ? `Đã lưu món ${saved.name}` : `Đã thêm món ${saved.name}, giá ${formatVnd(saved.price)}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{item ? `Sửa món ${item.code}` : 'Thêm món'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'Đơn đã gửi giữ giá cũ; giỏ của khách đang có món này được cập nhật giá khi gửi.'
              : 'Món mới hiện trên trang khách ở lần tải thực đơn kế tiếp.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-13rem)] min-h-0 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid content-start gap-5 overflow-y-auto px-6 py-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <div className="space-y-2">
                <span className="text-sm font-medium">Ảnh món</span>
                <div className="relative overflow-hidden rounded-xl border">
                  <MenuImage
                    imageUrl={imageUrl}
                    name={values.name || item?.name || 'Món mới'}
                    color={color}
                    className="aspect-square w-full"
                  />
                  {upload.isPending && (
                    <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
                      <Loader2 className="text-primary size-6 animate-spin" aria-label="Đang tải ảnh lên" />
                    </div>
                  )}
                </div>
                {item && canUploadImage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full"
                      onClick={() => fileRef.current?.click()}
                      disabled={upload.isPending}
                    >
                      <ImagePlus aria-hidden="true" />
                      {imageUrl ? 'Đổi ảnh' : 'Tải ảnh'}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={IMAGE_TYPES.join(',')}
                      className="hidden"
                      onChange={(e) => pickImage(e.target.files?.[0])}
                    />
                    <p className="text-muted-foreground text-xs">JPG, PNG, WebP tối đa 2 MB. Lưu ngay khi chọn.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground flex gap-1.5 text-xs">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    Lưu món xong, mở &quot;Sửa&quot; để tải ảnh.
                  </p>
                )}
              </div>

              <div className="grid content-start gap-4 sm:grid-cols-2">
                <FormField
                  label="Mã món"
                  required
                  error={errors.code?.message}
                  hint={!item && nextCode.data ? `Dạng M001; gợi ý ${nextCode.data}` : 'Dạng M001'}
                >
                  <Input autoComplete="off" spellCheck={false} className="uppercase" placeholder="M051" {...form.register('code')} />
                </FormField>

                <FormField label="Danh mục" required htmlFor="menu-item-category" error={errors.categoryId?.message}>
                  <Controller
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="menu-item-category" className="w-full" aria-invalid={errors.categoryId ? true : undefined}>
                          <SelectValue placeholder="Chọn danh mục" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="size-3 rounded-sm" style={{ backgroundColor: c.color }} aria-hidden="true" />
                              {c.name}
                              {c.isHidden && <span className="text-muted-foreground text-xs">(đang ẩn)</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>

                <FormField label="Tên món" required error={errors.name?.message}>
                  <Input autoComplete="off" placeholder="vd: Cà phê sữa đá" {...form.register('name')} />
                </FormField>
                <FormField label="Tên tiếng Anh" error={errors.nameEn?.message} hint="Khách bấm EN thì thấy tên này">
                  <Input autoComplete="off" placeholder="vd: Iced milk coffee" {...form.register('nameEn')} />
                </FormField>

                <FormField label="Mô tả" error={errors.description?.message} className="sm:col-span-2">
                  <Textarea rows={2} placeholder="Nguyên liệu, khẩu phần" {...form.register('description')} />
                </FormField>

                <FormField label="Giá" required htmlFor="menu-item-price" error={errors.price?.message} hint="Bội số 1.000 ₫, đã gồm thuế GTGT">
                  <Controller
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <MoneyInput
                        id="menu-item-price"
                        ref={field.ref}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="0"
                        aria-invalid={errors.price ? true : undefined}
                      />
                    )}
                  />
                </FormField>
                <FormField label="Đơn vị tính" required error={errors.unit?.message}>
                  <Input autoComplete="off" placeholder="vd: phần" {...form.register('unit')} />
                </FormField>
                <div className="flex flex-wrap gap-2 sm:col-span-2" aria-label="Đơn vị gợi ý">
                  {UNIT_SUGGESTIONS.map((u) => (
                    <Button
                      key={u}
                      type="button"
                      variant={values.unit === u ? 'secondary' : 'outline'}
                      aria-pressed={values.unit === u}
                      className={cn('h-10 min-w-12', values.unit === u && 'border-primary/40 text-primary')}
                      onClick={() => form.setValue('unit', u, { shouldDirty: true, shouldValidate: true })}
                    >
                      {u}
                    </Button>
                  ))}
                </div>

                <fieldset className="grid gap-2 sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium">Nhãn</legend>
                  <div className="flex flex-wrap gap-2">
                    {MENU_TAGS.map((t) => {
                      const on = values.tags?.includes(t)
                      return (
                        <Button
                          key={t}
                          type="button"
                          variant={on ? 'secondary' : 'outline'}
                          aria-pressed={on}
                          className={cn('h-10', on && 'border-primary/40 text-primary')}
                          onClick={() => toggleTag(t)}
                        >
                          {menuTagLabels[t]}
                        </Button>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset className="grid gap-2 sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium">Nhóm tùy chọn</legend>
                  {selectedGroups.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Món không có tùy chọn; khách bấm &quot;+&quot; là thêm thẳng vào giỏ.</p>
                  ) : (
                    <ol className="divide-y rounded-lg border" aria-label="Nhóm tùy chọn theo thứ tự hiển thị">
                      {selectedGroups.map((g, i) => (
                        <li key={g.id} className="flex min-h-12 items-center gap-2 px-3 py-1">
                          <span className="text-muted-foreground w-5 text-sm tabular-nums">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{g.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {describeGroup(g)} · {g.choices.map((c) => c.name).join(', ')}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => moveGroup(i, i - 1)} disabled={i === 0} aria-label={`Đưa nhóm ${g.name} lên`}>
                            <ArrowUp />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveGroup(i, i + 1)}
                            disabled={i === selectedGroups.length - 1}
                            aria-label={`Đưa nhóm ${g.name} xuống`}
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setGroups((values.optionGroupIds ?? []).filter((id) => id !== g.id))}
                            aria-label={`Bỏ nhóm ${g.name}`}
                          >
                            <X />
                          </Button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {freeGroups.length > 0 && (
                    <Select value="" onValueChange={(id) => setGroups([...(values.optionGroupIds ?? []), id])}>
                      <SelectTrigger className="h-11 w-full sm:w-72" aria-label="Gắn nhóm tùy chọn">
                        <SelectValue placeholder="+ Gắn nhóm tùy chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        {freeGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                            <span className="text-muted-foreground ml-1 text-xs">· {describeGroup(g)}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.optionGroupIds?.message && (
                    <p className="text-destructive text-[0.8125rem]">{errors.optionGroupIds.message}</p>
                  )}
                </fieldset>
              </div>
            </div>

            <MenuPreviewPanel
              className="hidden border-l lg:flex"
              draft={{
                id: item?.id,
                code: values.code,
                name: values.name,
                nameEn: values.nameEn,
                categoryId: values.categoryId,
                description: values.description,
                descriptionEn: values.descriptionEn,
                imageUrl: imageUrl ?? undefined,
                unit: values.unit,
                price: values.price ?? 0,
                tags: values.tags ?? [],
                optionGroupIds: values.optionGroupIds ?? [],
                isSoldOut: item?.isSoldOut ?? false,
              }}
              categories={categories}
              optionGroups={optionGroups}
            />
          </div>

          <DialogFooter className="bg-muted/30 border-t px-6 py-4">
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {item ? 'Lưu thay đổi' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
