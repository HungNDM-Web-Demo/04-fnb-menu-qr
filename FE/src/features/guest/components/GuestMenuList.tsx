'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { formatVnd } from '@/lib/format'
import { normalizeVi } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import { menuTagLabels } from '@/config/menu-qr-labels'
import { MenuImage } from '@/features/pos/components/MenuImage'
import type { PublicMenu, PublicMenuItem } from '@/types/menu-qr'

type GuestMenuListProps = {
  menu: PublicMenu
  en?: boolean
  search?: string
  /** Phần tử cuộn (null = window) để tô danh mục đang xem */
  scrollEl?: HTMLElement | null
  /** Chạm thẻ món */
  onOpen?: (item: PublicMenuItem) => void
  /** Nút "+" (món không có nhóm tùy chọn thì thêm thẳng 1) */
  onAdd?: (item: PublicMenuItem) => void
  /** Vị trí dính của thanh danh mục (px) */
  stickyTop?: number
  /** Khung xem trước: không nghe cuộn, không có nút thêm */
  preview?: boolean
}

const name = (en: boolean, vi: string, enText?: string) => (en && enText ? enText : vi)

/**
 * Thực đơn khách (SCR-01): thanh danh mục cuộn ngang dính đầu, chạm thì cuộn tới, tô danh mục đang xem;
 * thẻ món có ảnh, tên, mô tả, nhãn, giá/đơn vị; món hết mờ, nhãn "Hết món", không có nút thêm (TC-01, TC-03).
 * Dùng chung cho khung xem trước của trang Thực đơn (`GuestMenuPreview`).
 */
export function GuestMenuList({ menu, en = false, search = '', scrollEl = null, onOpen, onAdd, stickyTop = 0, preview }: GuestMenuListProps) {
  const keyword = normalizeVi(search)
  const sections = useMemo(() => {
    return menu.categories
      .map((c) => ({
        category: c,
        items: menu.items.filter(
          (i) =>
            i.categoryId === c.id &&
            (!keyword || normalizeVi(i.name).includes(keyword) || (i.nameEn && normalizeVi(i.nameEn).includes(keyword)))
        ),
      }))
      .filter((s) => s.items.length > 0)
  }, [menu, keyword])

  const [active, setActive] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const clickLock = useRef(false)
  const activeId = active && sections.some((s) => s.category.id === active) ? active : sections[0]?.category.id

  useEffect(() => {
    if (preview) return
    const target: HTMLElement | Window = scrollEl ?? window
    const onScroll = () => {
      if (clickLock.current) return
      const top = (scrollEl ? scrollEl.getBoundingClientRect().top : 0) + stickyTop + 64
      let current: string | null = null
      for (const s of sections) {
        const el = document.getElementById(`cat-${s.category.id}`)
        if (el && el.getBoundingClientRect().top <= top) current = s.category.id
      }
      setActive(current ?? sections[0]?.category.id ?? null)
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [sections, scrollEl, stickyTop, preview])

  // Giữ chip đang chọn trong tầm nhìn của thanh danh mục
  useEffect(() => {
    const chip = barRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`)
    const bar = barRef.current
    if (chip && bar) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [activeId])

  const goTo = (id: string) => {
    setActive(id)
    clickLock.current = true
    window.setTimeout(() => (clickLock.current = false), 700)
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (sections.length === 0) {
    return <p className="text-muted-foreground px-4 py-12 text-center text-base">Không tìm thấy món phù hợp.</p>
  }

  return (
    <div>
      <nav
        className="bg-background/95 supports-backdrop-filter:bg-background/85 sticky z-20 border-b backdrop-blur"
        style={{ top: stickyTop }}
        aria-label="Danh mục món"
      >
        <div ref={barRef} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map(({ category }) => {
            const on = category.id === activeId
            return (
              <button
                key={category.id}
                type="button"
                data-cat={category.id}
                onClick={() => goTo(category.id)}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'h-10 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
                )}
              >
                {name(en, category.name, category.nameEn)}
              </button>
            )
          })}
        </div>
      </nav>

      {sections.map(({ category, items }) => (
        <section
          key={category.id}
          id={`cat-${category.id}`}
          aria-labelledby={`cat-title-${category.id}`}
          className="px-4 pt-5"
          style={{ scrollMarginTop: stickyTop + 60 }}
        >
          <h2 id={`cat-title-${category.id}`} className="mb-2 text-lg font-bold">
            {name(en, category.name, category.nameEn)}
          </h2>
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <MenuItemRow item={item} en={en} onOpen={onOpen} onAdd={onAdd} preview={preview} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function MenuItemRow({
  item,
  en,
  onOpen,
  onAdd,
  preview,
}: {
  item: PublicMenuItem
  en: boolean
  onOpen?: (item: PublicMenuItem) => void
  onAdd?: (item: PublicMenuItem) => void
  preview?: boolean
}) {
  const soldOut = item.isSoldOut
  const title = name(en, item.name, item.nameEn)
  const desc = name(en, item.description ?? '', item.descriptionEn)
  return (
    <div className={cn('relative flex gap-3 py-3', soldOut && 'opacity-55')}>
      <button
        type="button"
        className="focus-visible:ring-ring flex min-w-0 flex-1 gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onOpen?.(item)}
        disabled={preview || !onOpen}
        aria-label={`${title}, ${formatVnd(item.price)}${soldOut ? ', hết món' : ''}`}
      >
        <MenuImage imageUrl={item.imageUrl} name={item.name} className="size-[6.5rem] shrink-0 rounded-xl" textClassName="text-xl" />
        <span className="flex min-w-0 flex-1 flex-col gap-1 pr-12">
          <span className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold">{title}</span>
          {desc ? <span className="text-muted-foreground line-clamp-2 text-[0.8125rem] leading-snug">{desc}</span> : null}
          <span className="mt-auto flex flex-wrap items-center gap-1.5">
            {soldOut ? (
              <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs font-bold">Hết món</span>
            ) : null}
            {item.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  tag === 'Cay' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                )}
              >
                {menuTagLabels[tag]}
              </span>
            ))}
          </span>
          <span className="text-[0.9375rem] font-bold tabular-nums">
            {formatVnd(item.price)}
            <span className="text-muted-foreground text-xs font-normal">/{item.unit}</span>
          </span>
        </span>
      </button>
      {!soldOut && !preview && onAdd ? (
        <button
          type="button"
          onClick={() => onAdd(item)}
          className="bg-primary text-primary-foreground focus-visible:ring-ring absolute right-0 bottom-3 flex size-11 items-center justify-center rounded-full shadow-sm transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
          aria-label={`Thêm ${title}`}
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
