'use client'

import { FolderTree, ListChecks, UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { CategoryTab } from '../components/CategoryTab'
import { MenuItemsTab } from '../components/MenuItemsTab'
import { OptionGroupsTab } from '../components/OptionGroupsTab'

/**
 * SCR-09 Thực đơn (UC-09, UC-10; FR-26..FR-30): tab Món, Danh mục, Nhóm tùy chọn.
 * Nhân viên (`menu-items.view` + `availability`) chỉ thấy công tắc hết món, hết lựa chọn (TC-36).
 */
export function MenuItemsPage() {
  const { canAny } = usePermissions()
  const canEdit = canAny([permissions.menuItems.create, permissions.menuItems.update, permissions.menuItems.delete])

  return (
    <PermissionGuard permission={permissions.menuItems.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Thực đơn"
          icon={UtensilsCrossed}
          description={
            canEdit
              ? 'Món, giá, nhóm tùy chọn; báo hết món, ẩn món. Khách thấy thay đổi ngay, không cần in lại menu.'
              : 'Báo hết món hoặc hết lựa chọn; trang khách cập nhật trong vài giây.'
          }
        />
        <Tabs defaultValue="items" className="gap-4">
          <TabsList className="max-w-full overflow-x-auto overflow-y-hidden group-data-horizontal/tabs:h-[3.25rem]">
            <TabsTrigger value="items" className="px-4">
              <UtensilsCrossed aria-hidden="true" />
              Món
            </TabsTrigger>
            <TabsTrigger value="categories" className="px-4">
              <FolderTree aria-hidden="true" />
              Danh mục
            </TabsTrigger>
            <TabsTrigger value="option-groups" className="px-4">
              <ListChecks aria-hidden="true" />
              Nhóm tùy chọn
            </TabsTrigger>
          </TabsList>
          <TabsContent value="items">
            <MenuItemsTab />
          </TabsContent>
          <TabsContent value="categories">
            <CategoryTab />
          </TabsContent>
          <TabsContent value="option-groups">
            <OptionGroupsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
