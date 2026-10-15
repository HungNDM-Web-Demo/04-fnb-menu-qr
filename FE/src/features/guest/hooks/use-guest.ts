'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api-error'
import { posKeys } from '@/features/pos/lib/query-keys'
import { PosRules } from '@/features/pos/lib/pos-rules'
import type { PublicServiceRequestInput, PublicSubmitOrderRequest } from '@/types/menu-qr'
import { cartStore, EMPTY_CART, type CartState } from '../lib/guest-storage'
import { demoGuestService } from '../services/demo-guest.service'
import { publicService } from '../services/public-api'

/** Không thử lại lỗi 4xx (mã QR sai…) */
const noRetry4xx = (count: number, error: unknown) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2

export function usePublicInfo(code: string, deviceId: string) {
  return useQuery({
    queryKey: posKeys.publicInfo(code),
    queryFn: () => publicService.info(code, deviceId),
    retry: noRetry4xx,
    staleTime: 60_000,
    enabled: !!code,
  })
}

export function usePublicMenu(code: string, deviceId: string, enabled = true) {
  return useQuery({
    queryKey: posKeys.publicMenu(code),
    queryFn: () => publicService.menu(code, deviceId),
    retry: noRetry4xx,
    staleTime: 5 * 60_000,
    enabled: !!code && enabled,
  })
}

/** Hỏi lại `live` mỗi 5 giây, khi tab hiện lại và (mock) khi tab khác ghi dữ liệu (07 §2.7, §2.14) */
export function usePublicLive(code: string, deviceId: string, getKnownSession: () => string | undefined, enabled = true) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: posKeys.publicLive(code),
    queryFn: () => publicService.live(code, getKnownSession(), deviceId),
    retry: noRetry4xx,
    staleTime: 0,
    refetchInterval: PosRules.guestPollMs,
    refetchIntervalInBackground: false,
    enabled: !!code && !!deviceId && enabled,
  })

  useEffect(() => {
    if (!code) return
    const refresh = () => void client.invalidateQueries({ queryKey: posKeys.publicLive(code) })
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = publicService.subscribeChanges(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(refresh, 120)
    })
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [client, code])

  return query
}

export function useCart(key: string): CartState {
  return useSyncExternalStore(
    cartStore.subscribe,
    () => cartStore.get(key),
    () => EMPTY_CART
  )
}

export function useSubmitOrder(code: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: PublicSubmitOrderRequest) => publicService.submitOrder(code, request),
    onSettled: () => void client.invalidateQueries({ queryKey: ['public', code] }),
  })
}

export function useServiceRequest(code: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: PublicServiceRequestInput) => publicService.serviceRequest(code, input),
    onSettled: () => void client.invalidateQueries({ queryKey: posKeys.publicLive(code) }),
  })
}

/** Nút "Bật nhận đơn cả ngày (chỉ bản demo)" trên trang khách (07 §4.2 bước 5) */
export function useGuestEnableAllDay(code: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => demoGuestService.orderingAllDayFromGuest(),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['public', code] }),
  })
}

export function useGuestTables(enabled = true) {
  return useQuery({
    queryKey: posKeys.guestTables,
    queryFn: () => demoGuestService.guestTables(),
    staleTime: 15_000,
    retry: false,
    enabled,
  })
}
