'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MenuItemDto, OptionGroupDto } from '@/types/menu-qr'
import { describeGroup } from '../lib/labels'
import { ChoiceAvailabilityList } from './ChoiceAvailabilityList'

/**
 * Bật tắt lựa chọn đang hết ngay từ món (UC-10 1a, TC-35: mở Trà tắc, tắt Size L).
 * Lựa chọn thuộc nhóm dùng chung nên áp cho mọi món dùng nhóm.
 */
export function ItemChoicesDialog({
  item,
  groups,
  canToggle,
  onClose,
}: {
  item: MenuItemDto | null
  groups: OptionGroupDto[]
  canToggle: boolean
  onClose: () => void
}) {
  const itemGroups = item
    ? item.optionGroupIds.map((id) => groups.find((g) => g.id === id)).filter((g): g is OptionGroupDto => !!g)
    : []

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lựa chọn của {item?.name}</DialogTitle>
          <DialogDescription>
            Tắt lựa chọn đang hết; khách chỉ còn chọn được lựa chọn khác. Áp dụng cho mọi món dùng cùng nhóm.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {itemGroups.map((g) => (
            <section key={g.id} aria-label={`Nhóm ${g.name}`} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{g.name}</h3>
                <span className="text-muted-foreground text-xs">{describeGroup(g)}</span>
              </div>
              <ChoiceAvailabilityList group={g} canToggle={canToggle} />
              <p className="text-muted-foreground text-xs">Áp dụng cho mọi món dùng nhóm {g.name}.</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
