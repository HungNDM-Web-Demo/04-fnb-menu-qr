'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { brandCssVariables } from '@/lib/brand-color'
import { posKeys } from '@/features/pos/lib/query-keys'
import { errorCodeOf } from '@/features/pos/lib/problem'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { usePublicInfo, usePublicLive, usePublicMenu } from '../hooks/use-guest'
import {
  cartKey as makeCartKey,
  cartStore,
  getDeviceId,
  readGuestLang,
  readKnownSession,
  writeGuestLang,
  writeKnownSession,
  clearKnownSession,
  type GuestLang,
} from '../lib/guest-storage'
import { CallStaffSheet } from './CallStaffSheet'
import { GuestContext, type GuestContextValue } from './GuestContext'
import { DemoSidePanel } from './DemoSidePanel'

const subscribeNoop = () => () => {}

function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

/**
 * Khung trang khách (SCR-01…04, 07 §4.2–4.3): không đăng nhập, render phía trình duyệt.
 * Màn hình rộng ≥ 768 px: giao diện khách nằm trong khung điện thoại 390 × 844 kèm bảng "Đây là màn hình điện thoại
 * của khách"; màn hình hẹp: toàn màn.
 */
export function GuestShell({ tableCode, children }: { tableCode: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<GuestSplash />}>
      <GuestShellInner tableCode={tableCode}>{children}</GuestShellInner>
    </Suspense>
  )
}

function GuestShellInner({ tableCode, children }: { tableCode: string; children: React.ReactNode }) {
  const search = useSearchParams()
  const phone = Math.max(1, Math.floor(Number(search.get('phone')) || 1))
  const code = decodeURIComponent(tableCode).trim().toUpperCase()
  const mounted = useMounted()
  const wide = useMediaQuery('(min-width: 768px)')
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  // Ref ổn định, bỏ qua null: khi Next ẩn cây (Suspense, Activity lúc chuyển trang) React tháo ref; nếu đặt state về
  // null thì GuestApp bị gỡ rồi gắn lại liên tục → "Maximum update depth exceeded".
  const frameRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setFrame(el)
  }, [])
  const scrollerRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setScroller(el)
  }, [])

  if (!mounted) return <GuestSplash />

  if (!wide) {
    return (
      <GuestApp code={code} phone={phone} container={null} scrollEl={null}>
        {children}
      </GuestApp>
    )
  }

  return (
    <div className="bg-muted flex min-h-svh items-center justify-center gap-10 p-6">
      <div
        ref={frameRef}
        className="border-foreground/85 bg-background relative h-[844px] max-h-[calc(100svh-3rem)] w-[390px] shrink-0 overflow-hidden rounded-[2.75rem] border-[10px] shadow-2xl [transform:translateZ(0)]"
        aria-label="Màn hình điện thoại của khách"
      >
        <div ref={scrollerRef} className="h-full overflow-x-hidden overflow-y-auto overscroll-contain">
          {frame && scroller ? (
            <GuestApp code={code} phone={phone} container={frame} scrollEl={scroller}>
              {children}
            </GuestApp>
          ) : null}
        </div>
      </div>
      <DemoSidePanel code={code} phone={phone} />
    </div>
  )
}

function GuestApp({
  code,
  phone,
  container,
  scrollEl,
  children,
}: {
  code: string
  phone: number
  container: HTMLElement | null
  scrollEl: HTMLElement | null
  children: React.ReactNode
}) {
  const client = useQueryClient()
  const deviceId = useMemo(() => getDeviceId(phone), [phone])
  const cartKey = makeCartKey(code, phone)
  const [lang, setLangState] = useState<GuestLang>(() => readGuestLang())
  // Phiên đã biết (07 §2.7 knownSession): hộp giá trị đổi được, không gây vẽ lại
  const knownRef = useRef<string | undefined>(readKnownSession(code, phone))
  const [callOpen, setCallOpen] = useState(false)

  const info = usePublicInfo(code, deviceId)
  const ok = info.isSuccess
  const live = usePublicLive(code, deviceId, () => knownRef.current, ok)
  const menu = usePublicMenu(code, deviceId, ok)

  const setLang = useCallback((next: GuestLang) => {
    writeGuestLang(next)
    setLangState(next)
  }, [])
  const setKnownSession = useCallback(
    (next: string | undefined) => {
      knownRef.current = next
      if (next) writeKnownSession(code, phone, next)
      else clearKnownSession(code, phone)
      void client.invalidateQueries({ queryKey: posKeys.publicLive(code) })
    },
    [code, phone, client]
  )

  // Thực đơn đổi (dấu khác) → tải lại menu (07 §2.7)
  const liveStamp = live.data?.menuStamp
  const menuStamp = menu.data?.stamp
  useEffect(() => {
    if (liveStamp && menuStamp && liveStamp !== menuStamp) void client.invalidateQueries({ queryKey: posKeys.publicMenu(code) })
  }, [liveStamp, menuStamp, client, code])

  // Ghi nhớ phiên đang mở để sau khi đóng còn thấy lời cảm ơn (FR-24)
  const openSessionCode = live.data?.session?.code
  useEffect(() => {
    if (openSessionCode && openSessionCode !== knownRef.current) {
      knownRef.current = openSessionCode
      writeKnownSession(code, phone, openSessionCode)
    }
  }, [openSessionCode, code, phone])

  // Phiên đã thu tiền → giỏ trống (TC-27)
  const ended = live.data?.endedSession?.status
  useEffect(() => {
    if (ended === 'DaDong') cartStore.clear(cartKey)
  }, [ended, cartKey])

  const storeName = info.data?.store.name
  const tableName = info.data?.table.name
  useEffect(() => {
    if (storeName && tableName) document.title = `${tableName} · ${storeName}`
  }, [storeName, tableName])

  const href = useCallback(
    (path: '' | '/cart' | '/orders' = '') => `/t/${code}${path}${phone > 1 ? `?phone=${phone}` : ''}`,
    [code, phone]
  )

  const invalid =
    errorCodeOf(info.error) === 'MaQrKhongHopLe' ||
    (isApiError(info.error) && info.error.status === 404) ||
    errorCodeOf(live.error) === 'MaQrKhongHopLe'

  const brandStyle = useMemo(
    () => (info.data ? (brandCssVariables(info.data.store.primaryColor) as React.CSSProperties) : undefined),
    [info.data]
  )

  if (invalid) return <InvalidQr message={getErrorMessage(info.error ?? live.error, '')} />
  if (info.isError) return <GuestError onRetry={() => void info.refetch()} />
  if (!info.data) return <GuestSplash />

  const value: GuestContextValue = {
    code,
    phone,
    deviceId,
    cartKey,
    lang,
    setLang,
    info: info.data,
    menu: menu.data,
    menuLoading: menu.isLoading,
    live: live.data,
    setKnownSession,
    href,
    container,
    scrollEl,
    openCallStaff: () => setCallOpen(true),
  }

  return (
    <GuestContext.Provider value={value}>
      <div style={brandStyle} className={cn('bg-background text-foreground relative min-h-full', !container && 'min-h-svh')}>
        {children}
        <CallStaffSheet open={callOpen} onOpenChange={setCallOpen} />
      </div>
    </GuestContext.Provider>
  )
}

export function GuestSplash() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-4" aria-busy="true" aria-label="Đang tải menu">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-24 rounded-xl" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mã QR sai, mã cũ đã đổi (TC-02, TC-38): đúng câu MaQrKhongHopLe, không hiện menu */
function InvalidQr({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[inherit] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="bg-destructive/10 text-destructive flex size-16 items-center justify-center rounded-full">
        <QrCode className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold">Không mở được menu</h1>
      <p className="text-muted-foreground max-w-xs text-base" role="alert">
        {message || 'Mã QR không hợp lệ hoặc đã hết hiệu lực, vui lòng gọi nhân viên'}
      </p>
    </div>
  )
}

function GuestError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[inherit] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-muted-foreground text-base">Không tải được menu, kiểm tra kết nối mạng rồi thử lại.</p>
      <Button onClick={onRetry} className="h-11">
        <RefreshCw aria-hidden="true" />
        Thử lại
      </Button>
    </div>
  )
}

