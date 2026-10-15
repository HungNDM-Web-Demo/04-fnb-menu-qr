'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { subscribePosEvents } from '@/lib/realtime'
import { playSound, unlockSound } from '@/features/pos/lib/sound'
import { useLiveOrders, usePendingRequests } from '../hooks/use-live'
import { useLivePrefs } from '../lib/live-prefs'

/**
 * Chuông trên header cho người có `orders.view`: số đơn chờ xác nhận + yêu cầu chưa xử lý, chạm để mở Màn hình
 * nhận đơn; phát âm báo khi có đơn mới, yêu cầu mới nếu thiết bị đã "Bật âm báo" (UC-04 bước 4, UC-05 bước 1).
 */
export function LiveBell() {
  const { can } = usePermissions()
  const enabled = can(permissions.orders.view)
  const orders = useLiveOrders(enabled)
  const requests = usePendingRequests(enabled && can(permissions.serviceRequests.view))
  const sound = useLivePrefs((s) => s.sound)

  useEffect(() => {
    if (!enabled) return
    return subscribePosEvents((event) => {
      if (!useLivePrefs.getState().sound) return
      if (event.name === 'order-submitted' && event.payload.source === 'KhachQr') playSound('ticket')
      else if (event.name === 'requests-changed' && event.payload.newRequestIds.length > 0) playSound('alert')
    })
  }, [enabled])

  // Trình duyệt chỉ cho phát âm sau lần chạm đầu tiên
  useEffect(() => {
    if (!enabled || !sound) return
    const unlock = () => void unlockSound()
    document.addEventListener('pointerdown', unlock, { once: true })
    return () => document.removeEventListener('pointerdown', unlock)
  }, [enabled, sound])

  if (!enabled) return null
  const pending = orders.data?.pending.length ?? 0
  const reqs = requests.data?.length ?? 0
  const total = pending + reqs
  return (
    <Button asChild variant="ghost" size="icon" className="relative size-10">
      <Link href={routePath.ordersLive} aria-label={`Nhận đơn: ${pending} đơn chờ xác nhận, ${reqs} yêu cầu chưa xử lý`}>
        <BellRing aria-hidden="true" />
        {total > 0 ? (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 min-w-5 rounded-full px-1 text-center text-[0.6875rem] leading-5 font-bold">
            {total}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}
