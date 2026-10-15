'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { soldOutModeLabels } from '@/config/menu-qr-labels'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OptionChoiceDto, OptionGroupDto, SoldOutMode } from '@/types/menu-qr'
import { useSetChoiceAvailability } from '../hooks/use-menu-catalog'
import { SoldOutModeDialog } from './SoldOutModeDialog'

/**
 * Danh sách lựa chọn của một nhóm kèm công tắc "Còn" (UC-10 1a, FR-30, TC-35).
 * Lựa chọn hết áp cho mọi món dùng nhóm (07 §5 quyết định 16).
 */
export function ChoiceAvailabilityList({
  group,
  canToggle,
  className,
}: {
  group: OptionGroupDto
  canToggle: boolean
  className?: string
}) {
  const availability = useSetChoiceAvailability()
  const [target, setTarget] = useState<OptionChoiceDto | null>(null)
  const pendingId = availability.isPending ? availability.variables?.choiceId : undefined

  const send = (choice: OptionChoiceDto, isSoldOut: boolean, mode?: SoldOutMode) =>
    availability.mutate(
      { groupId: group.id, choiceId: choice.id, input: { isSoldOut, mode } },
      {
        onSuccess: () => {
          setTarget(null)
          toast.success(
            isSoldOut
              ? `Đã báo hết ${choice.name} (${group.name}), áp dụng cho ${group.itemCount} món`
              : `${choice.name} (${group.name}) đã bán lại`
          )
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )

  return (
    <>
      <ul className={cn('divide-y rounded-lg border', className)}>
        {group.choices.map((c) => {
          const available = !c.isSoldOut
          return (
            <li key={c.id} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
              <div className={cn('min-w-0 flex-1', !available && 'text-muted-foreground')}>
                <p className="truncate text-sm font-medium">
                  {c.name}
                  {c.isDefault && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(mặc định)</span>}
                </p>
                {!available && c.soldOutMode && (
                  <p className="text-warning text-xs font-medium">{soldOutModeLabels[c.soldOutMode]}</p>
                )}
              </div>
              <span className="text-muted-foreground text-sm tabular-nums">
                {c.price > 0 ? `+${formatVnd(c.price)}` : '0 ₫'}
              </span>
              <label
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 text-sm whitespace-nowrap',
                  canToggle ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
              >
                <Switch
                  checked={available}
                  disabled={!canToggle || pendingId === c.id}
                  onCheckedChange={(v) => (v ? send(c, false) : setTarget(c))}
                  aria-label={`Còn ${c.name} (${group.name})`}
                />
                <span className={cn('w-16', available ? 'text-foreground' : 'text-warning font-medium')}>
                  {available ? 'Còn' : 'Hết'}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <SoldOutModeDialog
        target={
          target && {
            title: `${target.name} (${group.name})`,
            note: `Áp dụng cho mọi món dùng nhóm ${group.name} (${group.itemCount} món).`,
          }
        }
        pending={availability.isPending}
        onCancel={() => setTarget(null)}
        onChoose={(mode) => target && send(target, true, mode)}
      />
    </>
  )
}
