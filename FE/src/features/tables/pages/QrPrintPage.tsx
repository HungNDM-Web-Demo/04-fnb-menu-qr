'use client'

import { Suspense, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Printer } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { QrImage } from '@/features/pos/components/QrImage'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn } from '@/lib/utils'
import type { DiningTableDto, StoreProfile } from '@/types/menu-qr'
import { useStoreProfile, useTables } from '../hooks/use-tables'
import { QR_LAYOUTS, isQrLayout, tableQrUrl, type QrLayout } from '../lib/qr'

const INACTIVE_WARNING = 'Bàn đang tắt, khách quét sẽ không gửi đơn được'

/** Kích thước tờ, lưới ô, cạnh QR theo mẫu (mm). Cạnh QR luôn ≥ 3 cm (NFR-05, TC-40) */
const SPEC: Record<
  QrLayout,
  { sheet: [number, number]; cols: string; rows: string; gap: string; perPage: number; qr: string; title: string; name: string }
> = {
  A6: { sheet: [105, 148], cols: '1fr', rows: '1fr', gap: '0', perPage: 1, qr: 'size-[62mm]', title: 'text-[15pt]', name: 'text-[26pt]' },
  A4x4: { sheet: [210, 297], cols: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)', gap: '0', perPage: 4, qr: 'size-[62mm]', title: 'text-[15pt]', name: 'text-[26pt]' },
  Tem8: { sheet: [210, 297], cols: 'repeat(2, 80mm)', rows: 'repeat(3, 80mm)', gap: '10mm', perPage: 6, qr: 'size-[42mm]', title: 'text-[10pt]', name: 'text-[16pt]' },
}

/**
 * SCR-11 Bản in mã QR `/print/qr?ids=…&layout=A6|Tem8|A4x4` (UC-12, FR-33, NFR-05; TC-40, TC-41).
 * Xem trước rồi bấm "In" mới mở hộp thoại in của trình duyệt (UC-12 bước 3–4).
 */
export function QrPrintPage() {
  return (
    <PermissionGuard permission={permissions.tables.printQr} redirect>
      <Suspense>
        <QrPrintView />
      </Suspense>
    </PermissionGuard>
  )
}

function QrPrintView() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const rawLayout = params.get('layout')
  const layout: QrLayout = isQrLayout(rawLayout) ? rawLayout : 'A4x4'
  const ids = useMemo(() => (params.get('ids') ?? '').split(',').filter(Boolean), [params])

  const tables = useTables()
  const store = useStoreProfile()
  const selected = useMemo(() => {
    const byId = new Map((tables.data ?? []).map((t) => [t.id, t]))
    return ids.map((id) => byId.get(id)).filter((t): t is DiningTableDto => !!t)
  }, [tables.data, ids])

  const spec = SPEC[layout]
  const perPage = spec.perPage
  const pages: DiningTableDto[][] = []
  for (let i = 0; i < selected.length; i += perPage) pages.push(selected.slice(i, i + perPage))
  const inactive = selected.filter((t) => !t.isActive)

  const setLayout = (next: QrLayout) => {
    const q = new URLSearchParams(params.toString())
    q.set('layout', next)
    router.replace(`${pathname}?${q.toString()}`)
  }

  const error = tables.error ?? store.error
  if (error && (!tables.data || !store.data)) return <ErrorState error={error} onRetry={() => void tables.refetch()} />

  return (
    <div className="bg-muted min-h-dvh print:bg-transparent">
      <style>{`@page { size: ${layout === 'A6' ? 'A6' : 'A4'}; margin: 0 }
@media print { html, body { background: #fff !important; } }`}</style>

      <header className="bg-background sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b px-4 py-3 print:hidden">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold">In mã QR</h1>
          <p className="text-muted-foreground text-sm">
            {selected.length} bàn · {pages.length} trang {layout === 'A6' ? 'A6' : 'A4'}
          </p>
        </div>
        <div role="radiogroup" aria-label="Mẫu in" className="flex flex-wrap gap-1.5">
          {QR_LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={layout === l.value}
              onClick={() => setLayout(l.value)}
              className={cn(
                'focus-visible:ring-ring/50 h-11 rounded-lg border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
                layout === l.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Button size="lg" onClick={() => window.print()} disabled={!selected.length}>
          <Printer aria-hidden="true" />
          In
        </Button>
      </header>

      {inactive.length > 0 && (
        <p className="bg-warning/12 text-warning mx-auto mt-4 flex max-w-3xl items-start gap-2 rounded-lg px-4 py-3 text-sm font-medium print:hidden" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {inactive.map((t) => t.name).join(', ')}: {INACTIVE_WARNING}.
        </p>
      )}

      {!tables.data || !store.data ? (
        <div className="flex justify-center p-8">
          <Skeleton className="h-[297mm] w-[210mm] max-w-full" />
        </div>
      ) : selected.length === 0 ? (
        <EmptyState title="Chưa chọn bàn nào" description="Quay lại Bàn và QR, tick chọn bàn rồi bấm In QR." className="print:hidden" />
      ) : (
        <div className="flex flex-col items-center gap-6 overflow-x-auto p-6 print:block print:gap-0 print:p-0">
          {pages.map((page, i) => (
            <section
              key={i}
              aria-label={`Trang ${i + 1}`}
              className="grid shrink-0 bg-white text-black shadow-md print:shadow-none print:break-after-page"
              style={{
                width: `${spec.sheet[0]}mm`,
                height: `${spec.sheet[1]}mm`,
                gridTemplateColumns: spec.cols,
                gridTemplateRows: spec.rows,
                gap: spec.gap,
                justifyContent: 'center',
                alignContent: 'center',
              }}
            >
              {page.map((t) => (
                <QrCard key={t.id} table={t} store={store.data!} layout={layout} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function QrCard({ table, store, layout }: { table: DiningTableDto; store: StoreProfile; layout: QrLayout }) {
  const spec = SPEC[layout]
  const logo = useAssetUrl(store.logoUrl)
  const sticker = layout === 'Tem8'
  return (
    <article
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden text-center',
        sticker ? 'gap-[1.5mm] rounded-[4mm] border border-dashed border-black/40 p-[3mm]' : 'gap-[3mm] p-[8mm]',
        layout === 'A4x4' && 'border border-dashed border-black/20'
      )}
    >
      <div className="flex items-center gap-[2mm]">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- logo theo cài đặt, có thể là idb://
          <img src={logo} alt="" className={sticker ? 'size-[7mm]' : 'size-[12mm]'} />
        )}
        <span className={cn('font-bold', spec.title)} style={{ color: store.primaryColor }}>
          {store.name}
        </span>
      </div>
      <p className={cn('leading-none font-extrabold', spec.name)}>{table.name}</p>
      <QrImage
        value={tableQrUrl(table.code)}
        size={720}
        alt={`Mã QR ${table.name}`}
        className={cn('rounded-none', spec.qr)}
      />
      <p className={cn('font-semibold', sticker ? 'text-[9pt]' : 'text-[13pt]')}>Quét để xem menu và gọi món</p>
      <p className={cn('font-mono tracking-widest text-black/60', sticker ? 'text-[7pt]' : 'text-[9pt]')}>
        {table.zone} · Mã bàn {table.code}
      </p>
      {!table.isActive && (
        <p className="bg-warning/15 text-warning absolute inset-x-0 top-0 px-2 py-1 text-xs font-semibold print:hidden">{INACTIVE_WARNING}</p>
      )}
    </article>
  )
}
