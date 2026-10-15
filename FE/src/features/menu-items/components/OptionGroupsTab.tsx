'use client'

import { useState } from 'react'
import { ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import type { OptionGroupDto } from '@/types/menu-qr'
import { useDeleteOptionGroup, useOptionGroups } from '../hooks/use-menu-catalog'
import { describeGroup } from '../lib/labels'
import { ChoiceAvailabilityList } from './ChoiceAvailabilityList'
import { OptionGroupFormDialog } from './OptionGroupFormDialog'

/**
 * Tab Nhóm tùy chọn (UC-09, UC-10 1a; FR-28, FR-30): thẻ từng nhóm dùng chung, lựa chọn kèm công tắc
 * "Còn" (áp cho mọi món dùng nhóm), thêm/sửa/xóa nhóm chưa dùng. Nhân viên chỉ thấy công tắc.
 */
export function OptionGroupsTab() {
  const { can } = usePermissions()
  const canCreate = can(permissions.menuItems.create)
  const canUpdate = can(permissions.menuItems.update)
  const canDelete = can(permissions.menuItems.delete)
  const canAvailability = can(permissions.menuItems.availability)

  const groups = useOptionGroups()
  const remove = useDeleteOptionGroup()
  const [form, setForm] = useState<{ open: boolean; group: OptionGroupDto | null }>({ open: false, group: null })
  const [deleteTarget, setDeleteTarget] = useState<OptionGroupDto | null>(null)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa nhóm ${deleteTarget.name}`)
    } catch (error) {
      // Còn món: "Nhóm tùy chọn đang gắn với {n} món, gỡ khỏi món trước" (07 §2.4)
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  if (groups.error) {
    return (
      <Card className="p-0">
        <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />
      </Card>
    )
  }

  const openCreate = () => setForm({ open: true, group: null })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm text-pretty">
          Nhóm dùng chung cho nhiều món. Tắt &quot;Còn&quot; ở một lựa chọn là hết cho mọi món dùng nhóm đó.
        </p>
        {canCreate && (
          <Button className="h-11" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Thêm nhóm
          </Button>
        )}
      </div>

      {groups.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : !groups.data?.length ? (
        <Card>
          <EmptyState
            icon={ListPlus}
            title="Chưa có nhóm tùy chọn"
            description="Tạo nhóm như Size, Mức cay rồi gắn cho món."
            action={
              canCreate && (
                <Button className="h-11" onClick={openCreate}>
                  <Plus aria-hidden="true" />
                  Thêm nhóm
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.data.map((g) => {
            const soldOut = g.choices.filter((c) => c.isSoldOut).length
            return (
              <Card key={g.id} className="gap-3 p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">
                      {g.name}
                      {g.nameEn && <span className="text-muted-foreground ml-1.5 text-xs font-normal">{g.nameEn}</span>}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {describeGroup(g)} · {g.itemCount} món dùng
                    </p>
                  </div>
                  {soldOut > 0 && <StatusBadge tone="warning">{soldOut} hết</StatusBadge>}
                  {canUpdate && (
                    <Button variant="ghost" size="icon-lg" onClick={() => setForm({ open: true, group: g })} aria-label={`Sửa nhóm ${g.name}`} title="Sửa nhóm">
                      <Pencil />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(g)}
                      aria-label={`Xóa nhóm ${g.name}`}
                      title="Xóa nhóm"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <ChoiceAvailabilityList group={g} canToggle={canAvailability} />
              </Card>
            )
          })}
        </div>
      )}

      {(canCreate || canUpdate) && (
        <OptionGroupFormDialog open={form.open} group={form.group} onOpenChange={(open) => setForm((s) => ({ ...s, open }))} />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa nhóm tùy chọn?"
        description={`Nhóm ${deleteTarget?.name} sẽ bị xóa. Chỉ xóa được nhóm chưa gắn với món nào.`}
        confirmText="Xóa nhóm"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
