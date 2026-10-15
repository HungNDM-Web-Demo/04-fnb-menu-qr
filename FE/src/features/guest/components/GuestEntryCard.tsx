'use client'

import { QrCode } from 'lucide-react'
import { appConfig } from '@/config/app.config'
import { GuestTablePicker } from './OpenGuestPageButton'

/**
 * Thẻ "Xem như khách tại bàn" trên trang đăng nhập (07 §4.2 bước 1): chọn bàn (mặc định Bàn 05), mở menu khách ở tab mới.
 * Chỉ hiện khi bật chế độ demo.
 */
export function GuestEntryCard() {
  if (!appConfig.demoToolbar) return null
  return (
    <section className="bg-card space-y-3 rounded-xl border p-4" aria-labelledby="guest-entry-title">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <QrCode className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="guest-entry-title" className="font-semibold">
            Xem như khách tại bàn
          </h2>
          <p className="text-muted-foreground text-sm">Mở menu gọi món của khách như khi quét QR trên bàn, không cần đăng nhập.</p>
        </div>
      </div>
      <GuestTablePicker idPrefix="login-guest" />
      <p className="text-muted-foreground text-xs">Đăng nhập Nhân viên ở tab này để nhận đơn.</p>
    </section>
  )
}
