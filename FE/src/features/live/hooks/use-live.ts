'use client'

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { posKeys } from '@/features/pos/lib/query-keys'
import { useSyncAsOf } from '@/features/pos/hooks/use-server-now'
import { liveService } from '../services/live.service'

/** Làm mới mọi dữ liệu màn hình nhận đơn (sau thao tác, khi nối lại, mỗi 30 giây) */
export function invalidateLive(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: posKeys.ordersLive }),
    client.invalidateQueries({ queryKey: posKeys.tableBoard }),
    client.invalidateQueries({ queryKey: posKeys.serviceRequestsPending }),
    client.invalidateQueries({ queryKey: posKeys.tableSessionRoot }),
    client.invalidateQueries({ queryKey: posKeys.orderRoot }),
  ])
}

const LIVE_REFRESH_MS = 30_000

export function useLiveOrders(enabled = true) {
  const query = useQuery({
    queryKey: posKeys.ordersLive,
    queryFn: liveService.liveOrders,
    refetchInterval: LIVE_REFRESH_MS,
    staleTime: 5_000,
    enabled,
  })
  useSyncAsOf(query.data?.asOf)
  return query
}

export function useTableBoard(enabled = true) {
  return useQuery({ queryKey: posKeys.tableBoard, queryFn: liveService.board, refetchInterval: LIVE_REFRESH_MS, staleTime: 5_000, enabled })
}

export function usePendingRequests(enabled = true) {
  return useQuery({
    queryKey: posKeys.serviceRequestsPending,
    queryFn: liveService.pendingRequests,
    refetchInterval: LIVE_REFRESH_MS,
    staleTime: 5_000,
    enabled,
  })
}

export function useTableSession(id: string | null | undefined) {
  const query = useQuery({
    queryKey: posKeys.tableSession(id ?? ''),
    queryFn: () => liveService.sessionDetail(id!),
    enabled: !!id,
    staleTime: 2_000,
  })
  useSyncAsOf(query.data?.asOf)
  return query
}

export function useStaffOrder(id: string | null | undefined) {
  return useQuery({ queryKey: posKeys.order(id ?? ''), queryFn: () => liveService.getOrder(id!), enabled: !!id })
}

export function useMenuBundle(enabled = true) {
  return useQuery({ queryKey: posKeys.menu, queryFn: liveService.menuBundle, staleTime: 60_000, enabled })
}

export function useOrderSettings() {
  return useQuery({ queryKey: posKeys.orderSettings, queryFn: liveService.orderSettings, refetchInterval: 60_000 })
}

export function useStoreProfile() {
  return useQuery({ queryKey: posKeys.storeProfile, queryFn: liveService.storeProfile, staleTime: 5 * 60_000 })
}

/** Mutation của màn hình nhận đơn: xong thì làm mới toàn bộ dữ liệu liên quan */
export function useLiveMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => void invalidateLive(client) })
}
