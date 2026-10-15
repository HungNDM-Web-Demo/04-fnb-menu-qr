'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Smartphone } from 'lucide-react'
import { menuTagLabels } from '@/config/menu-qr-labels'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CategoryDto, OptionGroupDto, PublicMenu, PublicMenuItem } from '@/types/menu-qr'
import { useMenuBundle } from '../hooks/use-menu-catalog'
import { describeGroup } from '../lib/labels'

export type MenuDraft = Omit<PublicMenuItem, 'id'> & { id?: string }

const DRAFT_ID = '__draft__'

/** Dựng `PublicMenu` như trang khách thấy, thay (hoặc thêm) món đang sửa bằng dữ liệu form (FR-29) */
export function buildPreviewMenu(
  bundle: { categories: CategoryDto[]; items: PublicMenuItem[]; optionGroups: OptionGroupDto[] },
  draft: MenuDraft,
  allCategories: CategoryDto[],
  allGroups: OptionGroupDto[]
): PublicMenu {
  const draftItem: PublicMenuItem = { ...draft, id: draft.id ?? DRAFT_ID }
  const items = bundle.items.filter((i) => i.id !== draftItem.id)
  const catOrder = new Map(allCategories.map((c) => [c.id, c.sortOrder]))
  const insertAt = items.findIndex((i) => (catOrder.get(i.categoryId) ?? 0) > (catOrder.get(draftItem.categoryId) ?? 0))
  const original = bundle.items.findIndex((i) => i.id === draftItem.id)
  if (original >= 0) items.splice(Math.min(original, items.length), 0, draftItem)
  else if (insertAt >= 0) items.splice(insertAt, 0, draftItem)
  else items.push(draftItem)
  const usedCats = new Set(items.map((i) => i.categoryId))
  const usedGroups = new Set(items.flatMap((i) => i.optionGroupIds))
  return {
    stamp: 'preview',
    categories: allCategories
      .filter((c) => usedCats.has(c.id) && (!c.isHidden || c.id === draftItem.categoryId))
      .map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn, sortOrder: c.sortOrder })),
    items,
    optionGroups: allGroups
      .filter((g) => usedGroups.has(g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        nameEn: g.nameEn,
        selectionType: g.selectionType,
        isRequired: g.isRequired,
        maxSelect: g.maxSelect,
        choices: g.choices.map((c) => ({
          id: c.id,
          name: c.name,
          nameEn: c.nameEn,
          price: c.price,
          isDefault: c.isDefault,
          isSoldOut: c.isSoldOut,
        })),
      })),
  }
}

/**
 * Khung điện thoại xem trước thực đơn như khách thấy, cuộn tới danh mục của món đang sửa (FR-29, TC-31).
 */
export function MenuPreviewPanel({
  draft,
  categories,
  optionGroups,
  className,
}: {
  draft: MenuDraft
  categories: CategoryDto[]
  optionGroups: OptionGroupDto[]
  className?: string
}) {
  const bundle = useMenuBundle()
  const menu = useMemo(() => {
    if (!bundle.data) return null
    const items: PublicMenuItem[] = bundle.data.items.map((m) => ({
      id: m.id,
      code: m.code,
      categoryId: m.categoryId,
      name: m.name,
      nameEn: m.nameEn,
      description: m.description,
      descriptionEn: m.descriptionEn,
      imageUrl: m.imageUrl,
      unit: m.unit,
      price: m.price,
      tags: m.tags,
      optionGroupIds: m.optionGroupIds,
      isSoldOut: m.isSoldOut,
    }))
    return buildPreviewMenu({ ...bundle.data, items }, draft, categories, optionGroups)
  }, [bundle.data, draft, categories, optionGroups])

  const draftId = draft.id ?? DRAFT_ID
  const draftRef = useRef<HTMLDivElement>(null)
  const ready = !!menu
  // Cuộn khung điện thoại tới món đang sửa khi mở form hoặc đổi danh mục
  useEffect(() => {
    if (ready) draftRef.current?.scrollIntoView({ block: 'nearest' })
  }, [ready, draft.categoryId])
  const category = menu?.categories.find((c) => c.id === draft.categoryId)
  const sectionItems = menu?.items.filter((i) => i.categoryId === draft.categoryId) ?? []
  const color = categories.find((c) => c.id === draft.categoryId)?.color

  return (
    <aside className={cn('bg-muted/40 flex-col items-center gap-3 overflow-y-auto p-5', className)} aria-label="Xem trước trên điện thoại khách">
      <p className="text-muted-foreground flex items-center gap-1.5 self-start text-sm font-medium">
        <Smartphone className="size-4" aria-hidden="true" />
        Xem trước như khách thấy
      </p>
      <div className="bg-background w-[300px] shrink-0 overflow-hidden rounded-[2rem] border-8 border-foreground/85 shadow-lg">
        <div className="h-[520px] overflow-y-auto">
          {menu && (
            <div className="flex gap-1.5 overflow-x-auto border-b px-3 py-2">
              {menu.categories.map((c) => (
                <span
                  key={c.id}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                    c.id === draft.categoryId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-2 p-3">
            <p className="text-sm font-semibold">{category?.name ?? 'Chọn danh mục để xem trước'}</p>
            {sectionItems.map((i) => {
              const isDraft = i.id === draftId
              const groups = i.optionGroupIds
                .map((id) => menu?.optionGroups.find((g) => g.id === id))
                .filter((g): g is NonNullable<typeof g> => !!g)
              return (
                <div
                  key={i.id}
                  ref={isDraft ? draftRef : undefined}
                  className={cn(
                    'flex gap-2.5 rounded-xl border p-2',
                    isDraft && 'border-primary ring-primary/30 ring-2',
                    i.isSoldOut && 'opacity-60'
                  )}
                >
                  <MenuImage imageUrl={i.imageUrl} name={i.name || 'Món mới'} color={color} className="size-16 shrink-0 rounded-lg" textClassName="text-base" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-tight font-semibold">{i.name || 'Tên món'}</p>
                    {i.tags.length > 0 && (
                      <p className="text-primary mt-0.5 text-[11px] font-medium">{i.tags.map((t) => menuTagLabels[t]).join(' · ')}</p>
                    )}
                    {isDraft && i.description && <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">{i.description}</p>}
                    {isDraft &&
                      groups.map((g) => (
                        <p key={g.id} className="text-muted-foreground text-[11px]">
                          {g.name}: {describeGroup(g)}
                        </p>
                      ))}
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {formatVnd(i.price)}
                      {i.isSoldOut && <span className="text-warning ml-1.5 text-xs">Hết món</span>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
