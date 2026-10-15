'use client'

import { create } from 'zustand'
import type { HubConnection } from '@microsoft/signalr'
import { apiRoutes } from '@/config/api-routes'
import { appConfig } from '@/config/app.config'
import { isMockMode } from '@/lib/data-source'
import { storageKey } from '@/lib/storage'
import { getAccessToken } from '@/stores/auth.store'
import type { PosEventMap, PosEventName } from '@/types/menu-qr'

/**
 * Lớp thời gian thực cho nhân viên, dùng chung hai chế độ (docs/07-DANH-SACH-API.md §2.14):
 * - mock: handler gọi `publishPosEvent(tên, payload)` sau khi ghi; sự kiện đi qua BroadcastChannel
 *   khóa `fnb-menu-qr:pos-events` tới tab khác và phát lại ngay trong tab hiện tại.
 * - api: SignalR hub `/hubs/pos`, JWT qua `accessTokenFactory`, tự nối lại; mất kết nối thì trạng thái
 *   `reconnecting` để giao diện hiện thanh đỏ "Mất kết nối, đang thử lại". Gói SignalR tải lười
 *   (trang khách không cần).
 * Khách không dùng lớp này: trang khách hỏi lại `live` mỗi 5 giây (07 §5 quyết định 7).
 */

export const POS_EVENT_NAMES: PosEventName[] = [
  'order-submitted',
  'orders-changed',
  'requests-changed',
  'tables-changed',
  'menu-changed',
  'ordering-changed',
]

export type PosEvent = {
  [K in PosEventName]: { name: K; payload: PosEventMap[K]; remote: boolean }
}[PosEventName]

type Listener = (event: PosEvent) => void
type ConnectionStatus = 'connected' | 'reconnecting'

type RealtimeState = {
  status: ConnectionStatus
  /** Tăng mỗi lần nối lại thành công để giao diện làm mới toàn bộ */
  reconnectCount: number
}

export const useRealtimeStore = create<RealtimeState>(() => ({ status: 'connected', reconnectCount: 0 }))

const listeners = new Set<Listener>()
const CHANNEL_NAME = storageKey('pos-events')
let channel: BroadcastChannel | null = null
let hub: HubConnection | null = null
let hubStarting: Promise<void> | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null

function emit(event: PosEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch (error) {
      console.error('[realtime] Lỗi trong listener:', error)
    }
  })
}

function ensureChannel() {
  if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (message: MessageEvent<{ name: PosEventName; payload: unknown }>) => {
    if (!message.data?.name) return
    emit({ name: message.data.name, payload: message.data.payload, remote: true } as PosEvent)
  }
}

/** Chế độ mock: phát sự kiện tới tab khác và tab hiện tại (cùng hình dạng như SignalR). */
export function publishPosEvent<K extends PosEventName>(name: K, payload: PosEventMap[K]) {
  if (typeof window === 'undefined') return
  ensureChannel()
  try {
    channel?.postMessage({ name, payload })
  } catch {
    // bỏ qua
  }
  // Phát trong tab hiện tại sau khi handler trả kết quả
  setTimeout(() => emit({ name, payload, remote: false } as PosEvent), 0)
}

async function ensureHub(): Promise<HubConnection | null> {
  if (hub || typeof window === 'undefined') return hub
  const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr')
  if (hub) return hub
  hub = new HubConnectionBuilder()
    .withUrl(`${appConfig.apiUrl}${apiRoutes.posHub}`, { accessTokenFactory: () => getAccessToken() ?? '' })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => Math.min(30_000, 1_000 * 2 ** ctx.previousRetryCount) })
    .configureLogging(LogLevel.Warning)
    .build()
  for (const name of POS_EVENT_NAMES) {
    hub.on(name, (payload: unknown) => emit({ name, payload: payload ?? {}, remote: true } as PosEvent))
  }
  hub.onreconnecting(() => useRealtimeStore.setState({ status: 'reconnecting' }))
  hub.onreconnected(() => useRealtimeStore.setState((s) => ({ status: 'connected', reconnectCount: s.reconnectCount + 1 })))
  hub.onclose(() => {
    useRealtimeStore.setState({ status: 'reconnecting' })
    setTimeout(() => {
      if (listeners.size > 0) void startHub()
    }, 5_000)
  })
  return hub
}

async function startHub() {
  const connection = await ensureHub()
  if (!connection || connection.state !== 'Disconnected' || !getAccessToken()) return
  if (hubStarting) return hubStarting
  hubStarting = connection
    .start()
    .then(() => {
      const wasDown = useRealtimeStore.getState().status === 'reconnecting'
      useRealtimeStore.setState((s) => ({ status: 'connected', reconnectCount: wasDown ? s.reconnectCount + 1 : s.reconnectCount }))
    })
    .catch(() => {
      useRealtimeStore.setState({ status: 'reconnecting' })
      setTimeout(() => {
        if (listeners.size > 0) void startHub()
      }, 5_000)
    })
    .finally(() => {
      hubStarting = null
    })
  return hubStarting
}

/** Nghe sự kiện thời gian thực (cả hai chế độ). Trả hàm hủy đăng ký. */
export function subscribePosEvents(listener: Listener): () => void {
  listeners.add(listener)
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
  if (isMockMode()) ensureChannel()
  else void startHub()
  return () => {
    listeners.delete(listener)
    if (isMockMode() || listeners.size > 0 || !hub || stopTimer) return
    // React gỡ rồi gắn lại listener ngay (StrictMode): chờ 1 giây mới dừng hub
    stopTimer = setTimeout(() => {
      stopTimer = null
      if (listeners.size === 0 && hub) void hub.stop()
    }, 1_000)
  }
}
