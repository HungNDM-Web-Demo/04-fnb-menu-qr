'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BellRing, CalendarClock, Loader2, ShoppingBasket } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useOrderSettings } from '@/features/live/hooks/use-live'
import { posKeys } from '@/features/pos/lib/query-keys'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { readJson, storageKey, writeJson } from '@/lib/storage'
import { create } from 'zustand'
import { demoGuestService } from '../services/demo-guest.service'
import { simulateCallStaff, simulateGuestOrder } from '../lib/simulate'
import { GuestTablePicker } from './OpenGuestPageButton'

/** Công tắc "Khách tự gọi món mỗi 1–2 phút": lưu sessionStorage của tab, mặc định tắt (07 §4.2 bước 4) */
const AUTO_KEY = storageKey('demo-auto-sim')
const useAutoSim = create<{ on: boolean; set: (on: boolean) => void }>((set) => ({
  on: typeof window !== 'undefined' && readJson<boolean>('session', AUTO_KEY) === true,
  set: (on) => {
    writeJson('session', AUTO_KEY, on)
    set({ on })
  },
}))

async function runOrderSimulation() {
  try {
    const r = await simulateGuestOrder()
    toast.success(`Khách ${r.table} vừa gửi đơn ${r.code} · ${formatVnd(r.total)}`)
  } catch (e) {
    toast.error(getErrorMessage(e))
  }
}

/** Chạy nền khi bật công tắc tự gọi món (gắn cố định trong DemoToolbar, chỉ chạy khi tab đang mở) */
export function GuestAutoSimulator() {
  const on = useAutoSim((s) => s.on)
  const { isAuthenticated } = useAuth()
  useEffect(() => {
    if (!on || !isAuthenticated) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await runOrderSimulation()
        schedule()
      }, 60_000 + Math.floor(Math.random() * 60_000))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [on, isAuthenticated])
  return null
}

/** Mục "Trang khách" của thanh công cụ demo (07 §4.2 bước 4) */
export function GuestDemoSection() {
  const client = useQueryClient()
  const { isAuthenticated } = useAuth()
  const settings = useOrderSettings()
  const auto = useAutoSim()
  const [busy, setBusy] = useState<'order' | 'call' | 'allday' | null>(null)
  const s = settings.data

  const run = async (kind: 'order' | 'call' | 'allday') => {
    setBusy(kind)
    try {
      if (kind === 'order') await runOrderSimulation()
      else if (kind === 'call') {
        const r = await simulateCallStaff()
        toast.success(`${r.table} gọi nhân viên: ${r.reason}`)
      } else {
        await demoGuestService.orderingAllDay()
        await client.invalidateQueries({ queryKey: posKeys.orderSettings })
        toast.success('Đã bật nhận đơn QR cả ngày')
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <GuestTablePicker idPrefix="demo-guest" buttonLabel="Mở menu khách" compact />
      {isAuthenticated ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => run('order')}>
              {busy === 'order' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShoppingBasket aria-hidden="true" />}
              Giả lập khách gọi món
            </Button>
            <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => run('call')}>
              {busy === 'call' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
              Giả lập gọi nhân viên
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="demo-auto-sim" className="text-sm font-normal">
              Khách tự gọi món mỗi 1–2 phút
            </Label>
            <Switch id="demo-auto-sim" checked={auto.on} onCheckedChange={auto.set} />
          </div>
          {s ? (
            <div className="bg-muted/60 space-y-2 rounded-lg p-2.5 text-sm">
              <p>
                {s.accepting
                  ? `Đang nhận đơn QR · ${s.openTime === s.closeTime ? 'cả ngày' : `${s.openTime}–${s.closeTime}`}`
                  : (s.message ?? 'Đang không nhận đơn QR')}
              </p>
              {!s.accepting ? (
                <Button size="sm" className="h-9 w-full" disabled={!!busy} onClick={() => run('allday')}>
                  {busy === 'allday' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}
                  Nhận đơn cả ngày
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
