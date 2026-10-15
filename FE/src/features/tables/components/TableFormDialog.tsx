'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import type { DiningTableDto } from '@/types/menu-qr'
import { useSaveTable } from '../hooks/use-tables'
import { tableSchema, type TableFormValues } from '../schemas/table.schema'

/**
 * Thêm/sửa bàn (UC-11 bước 2–3, 1a; FR-31): tên, khu vực (chữ tự do, gợi ý khu có sẵn), sức chứa 1–20.
 * Thêm thì hệ thống cấp mã 6 ký tự (BR-01); sửa giữ nguyên mã QR.
 */
export function TableFormDialog({
  open,
  table,
  zones,
  defaultZone,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  table: DiningTableDto | null
  zones: string[]
  defaultZone?: string
  onOpenChange: (open: boolean) => void
  onCreated?: (table: DiningTableDto) => void
}) {
  const save = useSaveTable()
  const form = useForm<TableFormValues>({
    resolver: zodResolver(tableSchema),
    defaultValues: { name: '', zone: '', capacity: 4 },
  })
  const { errors } = form.formState

  useEffect(() => {
    if (open)
      form.reset(
        table
          ? { name: table.name, zone: table.zone, capacity: table.capacity }
          : { name: '', zone: defaultZone ?? zones[0] ?? '', capacity: 4 }
      )
  }, [open, table, zones, defaultZone, form])

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      { id: table?.id, input: { ...v, sortOrder: table?.sortOrder } },
      {
        onSuccess: (saved) => {
          toast.success(table ? `Đã lưu ${saved.name}` : `Đã thêm ${saved.name}, mã QR ${saved.code}`)
          onOpenChange(false)
          if (!table) onCreated?.(saved)
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
          <DialogTitle>{table ? `Sửa ${table.name}` : 'Thêm bàn'}</DialogTitle>
          <DialogDescription>
            {table
              ? `Mã QR ${table.code} giữ nguyên, tấm QR đã in vẫn dùng được.`
              : 'Lưu xong hệ thống cấp mã bàn 6 ký tự và ảnh QR riêng cho bàn.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label="Tên bàn" required error={errors.name?.message}>
            <Input autoComplete="off" placeholder="vd: Bàn 21" {...form.register('name')} />
          </FormField>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <FormField label="Khu vực" required error={errors.zone?.message} hint="Chọn khu có sẵn hoặc gõ khu mới">
              <Input autoComplete="off" list="table-zones" placeholder="vd: Ngoài sân" {...form.register('zone')} />
            </FormField>
            <FormField label="Sức chứa" required htmlFor="table-capacity" error={errors.capacity?.message}>
              <Controller
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <Input
                    id="table-capacity"
                    ref={field.ref}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={Number.isNaN(field.value) ? '' : field.value}
                    onChange={(e) => field.onChange(e.target.value === '' ? NaN : Number(e.target.value))}
                    onBlur={field.onBlur}
                    className="tabular-nums"
                  />
                )}
              />
            </FormField>
          </div>
          <datalist id="table-zones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <DialogFooter>
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
