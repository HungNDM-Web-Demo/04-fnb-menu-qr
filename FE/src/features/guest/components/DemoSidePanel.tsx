'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, BellRing, ExternalLink, Smartphone, SmartphoneNfc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { routePath } from '@/config/route-path'
import { tableStatusLabels } from '@/config/menu-qr-labels'
import { readJson, storageKey, writeJson } from '@/lib/storage'
import { useGuestTables } from '../hooks/use-guest'

/** Số điện thoại giả lập lớn nhất đã mở cho bàn (07 §4.2 bước 3) */
function nextPhone(code: string, current: number): number {
  const key = storageKey(`guest-phones:${code}`)
  const max = Math.max(readJson<number>('local', key) ?? 1, current)
  const next = max + 1
  writeJson('local', key, next)
  return next
}

/**
 * Bảng bên cạnh khung điện thoại khi xem trên màn hình rộng (07 §4.2 bước 2): giải thích và lối tắt trình diễn
 * trên một trình duyệt (mở màn hình nhận đơn, thêm điện thoại cùng bàn, đổi bàn).
 */
export function DemoSidePanel({ code, phone }: { code: string; phone: number }) {
  const router = useRouter()
  const tables = useGuestTables()
  const [switching, setSwitching] = useState(false)

  return (
    <aside className="bg-card text-card-foreground w-80 shrink-0 space-y-5 rounded-2xl border p-6 shadow-sm">
      <div className="space-y-2">
        <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">Đây là màn hình điện thoại của khách</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Khách quét mã QR trên bàn là mở được trang này, không cần cài ứng dụng hay đăng nhập.
          {phone > 1 ? ` Tab này là điện thoại thứ ${phone} của cùng bàn.` : ''}
        </p>
      </div>

      <div className="space-y-2">
        <Button className="h-11 w-full justify-start" variant="cta" onClick={() => window.open(routePath.ordersLive, '_blank')}>
          <BellRing aria-hidden="true" />
          Mở Màn hình nhận đơn
          <ExternalLink className="ml-auto opacity-70" aria-hidden="true" />
        </Button>
        <p className="text-muted-foreground text-xs">Mở ở tab mới, đăng nhập Nhân viên để nhận đơn khách vừa gửi.</p>
      </div>

      <Button
        className="h-11 w-full justify-start"
        variant="outline"
        onClick={() => window.open(routePath.guest(code, nextPhone(code, phone)), '_blank')}
      >
        <SmartphoneNfc aria-hidden="true" />
        Thêm điện thoại cùng bàn
        <ExternalLink className="ml-auto opacity-70" aria-hidden="true" />
      </Button>

      {tables.data && tables.data.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="guest-switch-table" className="flex items-center gap-2">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            Đổi bàn
          </Label>
          <Select
            value={tables.data.find((t) => t.code === code)?.code}
            onValueChange={(value) => {
              setSwitching(true)
              router.push(routePath.guest(value))
            }}
            disabled={switching}
          >
            <SelectTrigger id="guest-switch-table" className="h-11 w-full">
              <SelectValue placeholder="Chọn bàn" />
            </SelectTrigger>
            <SelectContent>
              {tables.data.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.name} · {t.zone} · {tableStatusLabels[t.status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </aside>
  )
}
