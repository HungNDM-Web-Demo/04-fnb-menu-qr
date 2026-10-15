'use client'

import { QrCode, Settings2, Table2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { OrderSettingsTab } from '../components/OrderSettingsTab'
import { TablesTab } from '../components/TablesTab'

/**
 * SCR-10 Bàn và QR (UC-11, UC-12, UC-13; FR-31..FR-34): tab Bàn (mã QR, in QR, mở trang khách),
 * tab Cài đặt nhận đơn (`order-settings.update`).
 */
export function TablesPage() {
  const { can } = usePermissions()
  const canSettings = can(permissions.orderSettings.update)

  return (
    <PermissionGuard permission={permissions.tables.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Bàn và QR"
          icon={QrCode}
          description="Mỗi bàn một mã QR riêng; khách quét là gọi món, không cần đăng nhập. Đổi mã QR khi tấm QR bị chụp lại."
        />
        <Tabs defaultValue="tables" className="gap-4">
          <TabsList className="max-w-full overflow-x-auto overflow-y-hidden group-data-horizontal/tabs:h-[3.25rem]">
            <TabsTrigger value="tables" className="px-4">
              <Table2 aria-hidden="true" />
              Bàn
            </TabsTrigger>
            {canSettings && (
              <TabsTrigger value="settings" className="px-4">
                <Settings2 aria-hidden="true" />
                Cài đặt nhận đơn
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="tables">
            <TablesTab />
          </TabsContent>
          {canSettings && (
            <TabsContent value="settings">
              <OrderSettingsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
