'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { subscribePosEvents, useRealtimeStore, type PosEvent } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import { posKeys } from '../lib/query-keys'

/** Query cần làm mới theo từng sự kiện (07 §2.14) */
const KEYS: Record<PosEvent['name'], QueryKey[]> = {
  'order-submitted': [posKeys.ordersLive, posKeys.tableBoard, posKeys.tableSessionRoot, posKeys.dashboard, posKeys.tables],
  'orders-changed': [posKeys.ordersLive, posKeys.tableSessionRoot, posKeys.orderRoot, posKeys.tableBoard, posKeys.dashboard],
  'requests-changed': [posKeys.serviceRequestsPending, posKeys.tableBoard, posKeys.tableSessionRoot, posKeys.dashboard],
  'tables-changed': [posKeys.tableBoard, posKeys.tables, posKeys.tableSessionRoot, posKeys.tableSessions, posKeys.reports],
  'menu-changed': [posKeys.menu, posKeys.menuItems, posKeys.optionGroups, posKeys.categories],
  'ordering-changed': [posKeys.orderSettings],
}

/**
 * Nối sự kiện thời gian thực (SignalR ở api, BroadcastChannel ở mock) vào cache: mỗi sự kiện làm mới đúng các
 * query key của bảng 07 §2.14 (gom trong 150 ms). Nối lại sau khi mất kết nối thì làm mới toàn bộ.
 */
export function RealtimeBridge() {
  const client = useQueryClient()
  const { user } = usePermissions()
  const userId = user?.id
  const reconnectCount = useRealtimeStore((s) => s.reconnectCount)
  const pending = useRef(new Map<string, QueryKey>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    const flush = () => {
      const keys = [...pending.current.values()]
      pending.current.clear()
      for (const queryKey of keys) void client.invalidateQueries({ queryKey })
    }
    const unsubscribe = subscribePosEvents((event) => {
      for (const key of KEYS[event.name] ?? []) pending.current.set(JSON.stringify(key), key)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 150)
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [client, userId])

  useEffect(() => {
    if (reconnectCount > 0) void client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'public' })
  }, [reconnectCount, client])

  return null
}

/** Thanh đỏ "Mất kết nối, đang thử lại" (07 §2.14) */
export function ConnectionBanner({ className }: { className?: string }) {
  const status = useRealtimeStore((s) => s.status)
  if (status === 'connected') return null
  return (
    <div
      role="alert"
      className={cn(
        'bg-destructive text-destructive-foreground flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold',
        className
      )}
    >
      <WifiOff className="size-4" aria-hidden="true" />
      Mất kết nối, đang thử lại
    </div>
  )
}
