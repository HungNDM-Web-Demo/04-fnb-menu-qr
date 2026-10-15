'use client'

import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { OptionGroupDto, SelectionType } from '@/types/menu-qr'
import { useSaveOptionGroup } from '../hooks/use-menu-catalog'
import { selectionTypeLabels } from '../lib/labels'
import { optionGroupSchema, type OptionGroupFormValues } from '../schemas/menu-item.schema'
import { MoneyInput } from '@/features/pos/components/MoneyInput'

const EMPTY: OptionGroupFormValues = {
  name: '',
  nameEn: '',
  selectionType: 'ChonMot',
  isRequired: false,
  maxSelect: 1,
  choices: [{ name: '', nameEn: '', price: 0, isDefault: false }],
}

const toValues = (g: OptionGroupDto | null): OptionGroupFormValues =>
  g
    ? {
        name: g.name,
        nameEn: g.nameEn ?? '',
        selectionType: g.selectionType,
        isRequired: g.isRequired,
        maxSelect: g.maxSelect,
        choices: g.choices.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn ?? '', price: c.price, isDefault: c.isDefault })),
      }
    : EMPTY

const TYPES: { value: SelectionType; hint: string }[] = [
  { value: 'ChonMot', hint: 'Radio: Size, Mức cay, Cỡ nồi' },
  { value: 'ChonNhieu', hint: 'Checkbox: Thêm topping, thêm vào lẩu' },
]

/**
 * Thêm/sửa nhóm tùy chọn dùng chung (UC-09 bước 1–2, FR-28, BR-04): kiểu chọn một hoặc chọn nhiều,
 * bắt buộc (chỉ chọn một), số chọn tối đa (chỉ chọn nhiều), lựa chọn mặc định, giá cộng thêm bội số 1.000 ₫.
 * Gửi cả bộ lựa chọn: có id là sửa, không id là thêm, lựa chọn bị bỏ khỏi form là xóa mềm (07 §2.4).
 */
export function OptionGroupFormDialog({
  open,
  group,
  onOpenChange,
}: {
  open: boolean
  group: OptionGroupDto | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveOptionGroup()
  const form = useForm<OptionGroupFormValues>({ resolver: zodResolver(optionGroupSchema), defaultValues: EMPTY })
  const { errors } = form.formState
  const choices = useFieldArray({ control: form.control, name: 'choices' })
  const [selectionType, watchedChoices] = useWatch({ control: form.control, name: ['selectionType', 'choices'] })
  const single = selectionType === 'ChonMot'

  useEffect(() => {
    if (open) form.reset(toValues(group))
  }, [open, group, form])

  const changeType = (type: SelectionType) => {
    form.setValue('selectionType', type, { shouldDirty: true })
    if (type === 'ChonMot') form.setValue('maxSelect', 1)
    else {
      form.setValue('isRequired', false)
      form.setValue('maxSelect', Math.max(1, Math.min(2, form.getValues('choices').length)))
      form.getValues('choices').forEach((_, i) => form.setValue(`choices.${i}.isDefault`, false))
    }
    form.clearErrors(['maxSelect', 'choices'])
  }

  /** Chọn một: chỉ một mặc định, chọn lại thì bỏ */
  const setDefault = (index: number, checked: boolean) =>
    form.getValues('choices').forEach((_, i) =>
      form.setValue(`choices.${i}.isDefault`, i === index ? checked : false, { shouldDirty: true })
    )

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: group?.id,
        input: {
          name: v.name,
          nameEn: v.nameEn || undefined,
          selectionType: v.selectionType,
          isRequired: v.selectionType === 'ChonMot' ? v.isRequired : false,
          maxSelect: v.selectionType === 'ChonMot' ? 1 : (v.maxSelect ?? 1),
          choices: v.choices.map((c) => ({
            id: c.id,
            name: c.name,
            nameEn: c.nameEn || undefined,
            price: c.price ?? 0,
            isDefault: v.selectionType === 'ChonMot' ? c.isDefault : false,
          })),
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(group ? `Đã lưu nhóm ${saved.name}` : `Đã thêm nhóm ${saved.name}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  )

  const choicesError = (errors.choices as { message?: string; root?: { message?: string } } | undefined)
  const choicesMessage = choicesError?.message ?? choicesError?.root?.message

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{group ? `Sửa nhóm ${group.name}` : 'Thêm nhóm tùy chọn'}</DialogTitle>
          <DialogDescription>
            {group && group.itemCount > 0
              ? `Nhóm đang gắn với ${group.itemCount} món; thay đổi áp dụng cho mọi món đó.`
              : 'Nhóm dùng chung: tạo một lần, gắn cho nhiều món ở form món.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-13rem)] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <FormField label="Tên nhóm" required error={errors.name?.message}>
              <Input autoComplete="off" placeholder="vd: Mức đá" {...form.register('name')} />
            </FormField>
            <FormField label="Tên tiếng Anh" error={errors.nameEn?.message}>
              <Input autoComplete="off" placeholder="vd: Ice level" {...form.register('nameEn')} />
            </FormField>

            <fieldset className="grid gap-1.5 sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">Kiểu chọn</legend>
              <div role="radiogroup" aria-label="Kiểu chọn" className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => {
                  const active = selectionType === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => changeType(t.value)}
                      className={cn(
                        'focus-visible:ring-ring/50 flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3',
                        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'
                      )}
                    >
                      <span className="font-medium">{selectionTypeLabels[t.value]}</span>
                      <span className="text-muted-foreground text-xs">{t.hint}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {single ? (
              <Controller
                control={form.control}
                name="isRequired"
                render={({ field }) => (
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span>
                      Bắt buộc chọn 1
                      <span className="text-muted-foreground block text-xs">Khách phải chọn trước khi thêm vào giỏ (vd Mức cay)</span>
                    </span>
                  </label>
                )}
              />
            ) : (
              <FormField label="Số chọn tối đa" required htmlFor="group-max" error={errors.maxSelect?.message} hint="Từ 1 đến 10, không lớn hơn số lựa chọn. Nhóm chọn nhiều không bắt buộc, không có mặc định.">
                <Controller
                  control={form.control}
                  name="maxSelect"
                  render={({ field }) => (
                    <Input
                      id="group-max"
                      ref={field.ref}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      onBlur={field.onBlur}
                      className="w-32 tabular-nums"
                    />
                  )}
                />
              </FormField>
            )}

            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">
                Lựa chọn{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="text-muted-foreground hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_5.5rem_2.75rem] gap-2 px-1 text-xs sm:grid">
                <span>Tên</span>
                <span>Tên tiếng Anh</span>
                <span className="text-right">Giá cộng thêm</span>
                <span className="text-center">{single ? 'Mặc định' : ''}</span>
                <span />
              </div>
              {choices.fields.map((f, i) => {
                const ce = errors.choices?.[i]
                return (
                  <div key={f.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_5.5rem_2.75rem] sm:items-start sm:border-0 sm:p-0">
                    <div>
                      <Input
                        autoComplete="off"
                        placeholder="vd: Ít đá"
                        aria-label={`Tên lựa chọn ${i + 1}`}
                        aria-invalid={ce?.name ? true : undefined}
                        {...form.register(`choices.${i}.name`)}
                      />
                      {ce?.name?.message && <p className="text-destructive mt-1 text-xs">{ce.name.message}</p>}
                    </div>
                    <Input autoComplete="off" placeholder="vd: Less ice" aria-label={`Tên tiếng Anh lựa chọn ${i + 1}`} {...form.register(`choices.${i}.nameEn`)} />
                    <div>
                      <Controller
                        control={form.control}
                        name={`choices.${i}.price`}
                        render={({ field }) => (
                          <MoneyInput
                            ref={field.ref}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="0"
                            aria-label={`Giá cộng thêm lựa chọn ${i + 1}`}
                            aria-invalid={ce?.price ? true : undefined}
                          />
                        )}
                      />
                      {ce?.price?.message && <p className="text-destructive mt-1 text-xs">{ce.price.message}</p>}
                    </div>
                    <label className={cn('flex h-9 items-center justify-center gap-2 text-sm', !single && 'invisible')}>
                      <Checkbox
                        checked={!!watchedChoices?.[i]?.isDefault}
                        onCheckedChange={(v) => setDefault(i, v === true)}
                        aria-label={`Mặc định lựa chọn ${i + 1}`}
                        disabled={!single}
                      />
                      <span className="sm:hidden">Mặc định</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => choices.remove(i)}
                      disabled={choices.fields.length <= 1}
                      aria-label={`Xóa lựa chọn ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )
              })}
              {choicesMessage && (
                <p className="text-destructive text-[0.8125rem]" role="alert">
                  {choicesMessage}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={() => choices.append({ name: '', nameEn: '', price: 0, isDefault: false })}
                disabled={choices.fields.length >= 20}
              >
                <Plus aria-hidden="true" />
                Thêm lựa chọn
              </Button>
              <p className="text-muted-foreground text-xs">Giá cộng thêm là bội số 1.000 ₫, từ 0 ₫. Xóa lựa chọn không ảnh hưởng đơn đã gửi.</p>
            </fieldset>
          </div>
          <DialogFooter className="bg-muted/30 border-t px-6 py-4">
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={save.isPending}>
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
