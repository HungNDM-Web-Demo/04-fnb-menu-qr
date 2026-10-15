'use client'

import Link from 'next/link'
import { AlertTriangle, BellRing, ChevronLeft, ClipboardList, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { messages } from '@/features/pos/lib/ordering-rules'
import { getErrorMessage } from '@/lib/api-error'
import { useCart, useGuestEnableAllDay } from '../hooks/use-guest'
import { demoGuestService } from '../services/demo-guest.service'
import { appConfig } from '@/config/app.config'
import { useGuest } from './GuestContext'

/** Logo quán (Brand.LogoUrl) */
export function StoreLogo({ className }: { className?: string }) {
  const { info } = useGuest()
  const src = useAssetUrl(info.store.logoUrl)
  return (
    <span className={cn('bg-primary/10 flex shrink-0 items-center justify-center overflow-hidden rounded-xl', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo có thể là idb:// hoặc từ BE
        <img src={src} alt="" className="size-full object-contain p-1" />
      ) : null}
    </span>
  )
}

/** Dải vàng khi không gửi được đơn (UC-01 E3, BR-07, BR-17) */
export function OrderingBanner() {
  const { live, info, code } = useGuest()
  const enable = useGuestEnableAllDay(code)
  const ordering = live?.ordering ?? info.ordering
  const tableActive = live?.table.isActive ?? info.table.isActive
  const message = !tableActive ? messages.tableInactive : !ordering.accepting ? ordering.message : undefined
  if (!message) return null
  const canEnable = tableActive && !!ordering.blockReason && demoGuestService.canEnableAllDayFromGuest()
  return (
    <div className="bg-wait-warn-soft text-foreground border-wait-warn/40 border-b px-4 py-2.5 text-sm" role="status">
      <p className="flex gap-2 font-medium">
        <AlertTriangle className="text-wait-warn mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {tableActive && ordering.blockReason && appConfig.demoToolbar ? (
        canEnable ? (
          <Button
            size="sm"
            variant="outline"
            className="bg-background mt-2 h-10"
            disabled={enable.isPending}
            onClick={() =>
              enable.mutate(undefined, {
                onSuccess: () => toast.success('Đã bật nhận đơn cả ngày'),
                onError: (e) => toast.error(getErrorMessage(e)),
              })
            }
          >
            {enable.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Bật nhận đơn cả ngày (chỉ bản demo)
          </Button>
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">Người xem demo: đăng nhập rồi bấm Demo → Nhận đơn cả ngày</p>
        )
      ) : null}
    </div>
  )
}

/** Thanh dưới cố định trong tầm ngón cái (NFR-01): Gọi nhân viên, Món đã gọi, Giỏ món (n) · tổng */
export function GuestBottomBar({ showCart = true }: { showCart?: boolean }) {
  const { href, cartKey, openCallStaff, live } = useGuest()
  const cart = useCart(cartKey)
  const count = cart.lines.reduce((s, l) => s + l.quantity, 0)
  const total = cart.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const orderCount = live?.session?.orders.length ?? 0
  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/85 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur">
      <CallStatus />
      <div className="flex items-center gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={openCallStaff}
          className="hover:bg-muted flex h-12 min-w-14 flex-col items-center justify-center rounded-xl px-2 text-[0.6875rem] font-semibold"
        >
          <BellRing className="size-5" aria-hidden="true" />
          Gọi nhân viên
        </button>
        <Link
          href={href('/orders')}
          className="hover:bg-muted relative flex h-12 min-w-14 flex-col items-center justify-center rounded-xl px-2 text-[0.6875rem] font-semibold"
        >
          <ClipboardList className="size-5" aria-hidden="true" />
          Món đã gọi
          {orderCount > 0 ? (
            <span className="bg-primary text-primary-foreground absolute top-0.5 right-1 min-w-5 rounded-full px-1 text-center text-[0.6875rem] leading-5">
              {orderCount}
            </span>
          ) : null}
        </Link>
        {showCart ? (
          <Link
            href={href('/cart')}
            className={cn(
              'flex h-12 flex-1 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors',
              count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
            aria-label={`Giỏ món, ${count} món, ${formatVnd(total)}`}
          >
            <ShoppingBag className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">Giỏ món ({count})</span>
            <span className="ml-auto tabular-nums">{formatVnd(total)}</span>
          </Link>
        ) : null}
      </div>
    </div>
  )
}

/** "Đã báo nhân viên, vui lòng chờ" / "Nhân viên đã xử lý" theo yêu cầu gọi nhân viên gần nhất của máy này (TC-14) */
export function CallStatus() {
  const { live } = useGuest()
  const latest = live?.myRequests.find((r) => r.type === 'GoiNhanVien')
  if (!latest) return null
  const recent = latest.status === 'DangCho' || (!!latest.handledAt && !!live && new Date(live.asOf).getTime() - new Date(latest.handledAt).getTime() < 3 * 60_000)
  if (!recent || latest.status === 'DaHuy') return null
  const done = latest.status === 'DaXuLy'
  return (
    <p
      className={cn(
        'px-4 py-1.5 text-center text-sm font-medium',
        done ? 'bg-table-busy-soft text-table-busy' : 'bg-wait-warn-soft text-foreground'
      )}
      role="status"
      aria-live="polite"
    >
      {done ? `Nhân viên đã xử lý · ${latest.reasonText}` : `Đã báo nhân viên, vui lòng chờ · ${latest.reasonText}`}
    </p>
  )
}

/** Đầu trang con (Giỏ món, Món đã gọi) */
export function GuestSubHeader({ title }: { title: string }) {
  const { href, info } = useGuest()
  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/85 sticky top-0 z-20 flex h-14 items-center gap-1 border-b px-2 backdrop-blur">
      <Link href={href('')} className="hover:bg-muted flex size-11 items-center justify-center rounded-full" aria-label="Về menu">
        <ChevronLeft className="size-6" aria-hidden="true" />
      </Link>
      <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      <span className="bg-muted mr-2 rounded-full px-3 py-1 text-sm font-semibold">{info.table.name}</span>
    </header>
  )
}
