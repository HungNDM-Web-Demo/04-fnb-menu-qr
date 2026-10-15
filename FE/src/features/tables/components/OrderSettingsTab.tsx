'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CirclePause, CirclePlay, Clock, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { confirmModeLabels } from '@/config/menu-qr-labels'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ConfirmMode, PauseOrderingRequest } from '@/types/menu-qr'
import { useOrderSettings, usePauseOrdering, useResumeOrdering, useUpdateOrderSettings } from '../hooks/use-tables'
import { orderSettingsSchema, type OrderSettingsFormValues } from '../schemas/table.schema'

const MODES: { value: ConfirmMode; hint: string }[] = [
  { value: 'ThuCong', hint: 'Mọi đơn khách gửi chờ nhân viên xác nhận.' },
  { value: 'TuXacNhan', hint: 'Đơn đầu của bàn chờ xác nhận; bàn đã có đơn được xác nhận thì đơn sau vào thẳng bếp.' },
]
const PAUSES: { minutes: PauseOrderingRequest['minutes']; label: string }[] = [
  { minutes: 15, label: '15 phút' },
  { minutes: 30, label: '30 phút' },
  { minutes: null, label: 'Tới khi mở lại' },
]

/**
 * Tab Cài đặt nhận đơn (UC-13, FR-34, BR-07, BR-08): giờ nhận đơn, chế độ xác nhận, tạm ngưng 15/30 phút
 * hoặc tới khi mở lại, mở nhận đơn lại. Áp dụng ngay cho đơn gửi sau đó.
 */
export function OrderSettingsTab() {
  const { can } = usePermissions()
  const canUpdate = can(permissions.orderSettings.update)
  const settings = useOrderSettings()
  const update = useUpdateOrderSettings()
  const pause = usePauseOrdering()
  const resume = useResumeOrdering()

  const form = useForm<OrderSettingsFormValues>({
    resolver: zodResolver(orderSettingsSchema),
    defaultValues: { openTime: '09:00', closeTime: '22:00', confirmMode: 'TuXacNhan' },
  })
  const { errors, isDirty } = form.formState
  const [openTime, closeTime] = useWatch({ control: form.control, name: ['openTime', 'closeTime'] })
  const data = settings.data

  useEffect(() => {
    if (data && !form.formState.isDirty)
      form.reset({ openTime: data.openTime, closeTime: data.closeTime, confirmMode: data.confirmMode })
  }, [data, form])

  if (settings.error && !data) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  if (!data) return <Skeleton className="h-96 rounded-xl" />

  const onSubmit = form.handleSubmit((v) =>
    update.mutate(v, {
      onSuccess: (saved) => {
        form.reset({ openTime: saved.openTime, closeTime: saved.closeTime, confirmMode: saved.confirmMode })
        toast.success('Đã lưu cài đặt nhận đơn, áp dụng ngay')
      },
      onError: (error) => {
        if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
      },
    })
  )

  const doPause = (minutes: PauseOrderingRequest['minutes']) =>
    pause.mutate(
      { minutes },
      {
        onSuccess: (s) => toast.success(s.message ?? 'Đã tạm ngưng nhận đơn qua QR'),
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  const doResume = () =>
    resume.mutate(undefined, {
      onSuccess: (s) => toast.success(s.accepting ? 'Đã mở nhận đơn qua QR' : (s.message ?? 'Đã bỏ tạm ngưng')),
      onError: (error) => toast.error(getErrorMessage(error)),
    })

  const paused = data.blockReason === 'QuanTamNgung'
  const hoursHint =
    openTime === closeTime
      ? 'Giờ bắt đầu bằng giờ kết thúc: nhận đơn cả ngày.'
      : openTime > closeTime
        ? `Nhận qua đêm: từ ${openTime} hôm nay tới ${closeTime} hôm sau.`
        : 'Bằng nhau là nhận cả ngày; giờ kết thúc nhỏ hơn là nhận qua đêm.'

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giờ nhận đơn và chế độ xác nhận</CardTitle>
          <CardDescription>Ngoài giờ, trang khách vẫn xem được menu nhưng không gửi đơn được.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <fieldset disabled={!canUpdate} className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Giờ bắt đầu" required htmlFor="open-time" error={errors.openTime?.message}>
                  <Input id="open-time" type="time" className="h-11 w-40 tabular-nums" {...form.register('openTime')} />
                </FormField>
                <FormField label="Giờ kết thúc" required htmlFor="close-time" error={errors.closeTime?.message}>
                  <Input id="close-time" type="time" className="h-11 w-40 tabular-nums" {...form.register('closeTime')} />
                </FormField>
                <p className="text-muted-foreground -mt-2 flex items-center gap-1.5 text-sm sm:col-span-2">
                  <Clock className="size-4 shrink-0" aria-hidden="true" />
                  {hoursHint}
                </p>
              </div>
              <Controller
                control={form.control}
                name="confirmMode"
                render={({ field }) => (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1.5 text-sm font-medium">Chế độ xác nhận đơn</legend>
                    <div role="radiogroup" aria-label="Chế độ xác nhận đơn" className="grid gap-2 sm:grid-cols-2">
                      {MODES.map((m) => {
                        const active = field.value === m.value
                        return (
                          <button
                            key={m.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => field.onChange(m.value)}
                            className={cn(
                              'focus-visible:ring-ring/50 flex min-h-16 flex-col items-start justify-center rounded-lg border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed',
                              active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'
                            )}
                          >
                            <span className="text-sm font-medium">{m.value === 'ThuCong' ? 'Thủ công' : 'Tự xác nhận'}</span>
                            <span className="text-muted-foreground text-xs">{m.hint}</span>
                          </button>
                        )
                      })}
                    </div>
                    {errors.confirmMode?.message && <p className="text-destructive text-[0.8125rem]">{errors.confirmMode.message}</p>}
                  </fieldset>
                )}
              />
            </fieldset>
            {canUpdate && (
              <div className="flex justify-end gap-2">
                {isDirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11"
                    onClick={() => form.reset({ openTime: data.openTime, closeTime: data.closeTime, confirmMode: data.confirmMode })}
                  >
                    Hoàn tác
                  </Button>
                )}
                <Button type="submit" className="h-11" disabled={update.isPending || !isDirty}>
                  {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Lưu
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className={cn(paused && 'border-warning/50')}>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Trạng thái lúc này
            {data.accepting ? (
              <StatusBadge tone="success">Đang nhận đơn qua QR</StatusBadge>
            ) : (
              <StatusBadge tone="warning">{paused ? 'Đang tạm ngưng' : 'Ngoài giờ nhận đơn'}</StatusBadge>
            )}
          </CardTitle>
          <CardDescription>
            {data.message ?? `Nhận đơn ${data.openTime === data.closeTime ? 'cả ngày' : `${data.openTime}–${data.closeTime}`}, ${confirmModeLabels[data.confirmMode].toLowerCase()}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {paused ? (
            <>
              <p className="text-sm">
                {data.pausedIndefinitely ? 'Tạm ngưng tới khi bấm mở lại.' : `Tự nhận đơn lại lúc ${formatTime(data.pausedUntil)}.`} Khách vẫn xem
                menu, gọi nhân viên được.
              </p>
              {canUpdate && (
                <Button className="h-11" onClick={doResume} disabled={resume.isPending}>
                  {resume.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
                  Mở nhận đơn lại
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground flex gap-2 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Bếp quá tải? Tạm ngưng nhận đơn qua QR; trang khách hiện dải thông báo kèm giờ nhận lại.
              </p>
              {canUpdate && <p className="-mb-2 text-sm font-medium">Tạm ngưng nhận đơn</p>}
              {canUpdate && (
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tạm ngưng nhận đơn">
                  {PAUSES.map((p) => (
                    <Button key={p.label} variant="outline" className="h-auto min-h-14 flex-col gap-0.5 px-2 py-2" disabled={pause.isPending} onClick={() => doPause(p.minutes)}>
                      <CirclePause className="text-warning" aria-hidden="true" />
                      <span className="text-xs">{p.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
