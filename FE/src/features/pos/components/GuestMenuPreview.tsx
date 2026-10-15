'use client'

import { GuestMenuList } from '@/features/guest/components/GuestMenuList'
import { cn } from '@/lib/utils'
import type { PublicMenu } from '@/types/menu-qr'

/**
 * Khung xem trước điện thoại ở trang Thực đơn (FR-29, 07 §4.5): dùng chính component thực đơn của trang khách,
 * nhận `PublicMenu` dựng từ form; chỉ xem, không có giỏ.
 */
export function GuestMenuPreview({
  menu,
  storeName,
  tableName = 'Bàn 05',
  className,
}: {
  menu: PublicMenu
  storeName?: string
  tableName?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-foreground/85 bg-background relative h-[640px] w-[320px] overflow-hidden rounded-[2.25rem] border-8 shadow-xl',
        className
      )}
      aria-label="Xem trước menu trên điện thoại khách"
    >
      <div className="h-full overflow-y-auto">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <p className="min-w-0 flex-1 truncate font-bold">{storeName ?? 'Menu'}</p>
          <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-1 text-xs font-bold">{tableName}</span>
        </div>
        <GuestMenuList menu={menu} preview />
      </div>
    </div>
  )
}
