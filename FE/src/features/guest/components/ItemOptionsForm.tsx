'use client'

import { useMemo, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { menuTagLabels } from '@/config/menu-qr-labels'
import { MenuImage } from '@/features/pos/components/MenuImage'
import { PosRules } from '@/features/pos/lib/pos-rules'
import type { MenuTag, SelectionType } from '@/types/menu-qr'

export type PickerChoice = { id: string; name: string; nameEn?: string; price: number; isDefault: boolean; isSoldOut: boolean }
export type PickerGroup = {
  id: string
  name: string
  nameEn?: string
  selectionType: SelectionType
  isRequired: boolean
  maxSelect: number
  choices: PickerChoice[]
}
export type PickerItem = {
  id: string
  name: string
  nameEn?: string
  description?: string
  descriptionEn?: string
  imageUrl?: string
  unit: string
  price: number
  tags: MenuTag[]
  optionGroupIds: string[]
  isSoldOut: boolean
}
export type PickerResult = {
  choiceIds: string[]
  quantity: number
  note?: string
  options: { groupName: string; name: string; price: number }[]
  unitPrice: number
}

const t = (en: boolean, vi: string, enText?: string) => (en && enText ? enText : vi)

/**
 * Chọn tùy chọn, số lượng, ghi chú cho một món (SCR-02, UC-02; dùng lại ở Gọi món hộ SCR-07).
 * ChonMot dạng radio, ChonNhieu dạng checkbox; chọn sẵn mặc định; nhóm bắt buộc chưa chọn báo đỏ "Bắt buộc chọn 1"
 * và khóa nút; chọn quá tối đa không cho, báo "Chọn tối đa {n}"; lựa chọn hết mờ (BR-04, TC-04, TC-05, TC-35).
 */
export function ItemOptionsForm({
  item,
  groups,
  en = false,
  color,
  submitLabel = 'Thêm vào giỏ',
  onSubmit,
  showImage = true,
}: {
  item: PickerItem
  groups: PickerGroup[]
  en?: boolean
  color?: string
  submitLabel?: string
  onSubmit: (result: PickerResult) => void
  showImage?: boolean
}) {
  const itemGroups = useMemo(
    () => item.optionGroupIds.map((id) => groups.find((g) => g.id === id)).filter((g): g is PickerGroup => Boolean(g)),
    [item.optionGroupIds, groups]
  )
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      itemGroups.map((g) => {
        if (g.selectionType !== 'ChonMot') return [g.id, []]
        const def = g.choices.find((c) => c.isDefault && !c.isSoldOut)
        return [g.id, def ? [def.id] : []]
      })
    )
  )
  const [overMax, setOverMax] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')

  const toggle = (group: PickerGroup, choice: PickerChoice) => {
    if (choice.isSoldOut) return
    setOverMax(null)
    setSelected((prev) => {
      const current = prev[group.id] ?? []
      if (group.selectionType === 'ChonMot') {
        if (current[0] === choice.id) return group.isRequired ? prev : { ...prev, [group.id]: [] }
        return { ...prev, [group.id]: [choice.id] }
      }
      if (current.includes(choice.id)) return { ...prev, [group.id]: current.filter((x) => x !== choice.id) }
      if (current.length >= group.maxSelect) {
        setOverMax(group.id)
        return prev
      }
      return { ...prev, [group.id]: [...current, choice.id] }
    })
  }

  const missing = itemGroups.filter((g) => g.selectionType === 'ChonMot' && g.isRequired && (selected[g.id] ?? []).length === 0)
  const chosen = itemGroups.flatMap((g) =>
    g.choices.filter((c) => (selected[g.id] ?? []).includes(c.id)).map((c) => ({ group: g, choice: c }))
  )
  const unitPrice = item.price + chosen.reduce((s, x) => s + x.choice.price, 0)
  const total = unitPrice * quantity
  const disabled = item.isSoldOut || missing.length > 0

  const description = t(en, item.description ?? '', item.descriptionEn)

  return (
    <div className="flex flex-col gap-4">
      {showImage ? (
        <MenuImage
          imageUrl={item.imageUrl}
          name={item.name}
          color={color}
          className="aspect-[16/10] w-full rounded-xl"
          textClassName="text-4xl"
        />
      ) : null}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
              {menuTagLabels[tag]}
            </span>
          ))}
        </div>
        <p className="text-primary text-lg font-bold tabular-nums">
          {formatVnd(item.price)}
          <span className="text-muted-foreground text-sm font-normal">/{item.unit}</span>
        </p>
        {description ? <p className="text-muted-foreground text-sm leading-relaxed">{description}</p> : null}
      </div>

      {itemGroups.map((group) => {
        const picked = selected[group.id] ?? []
        const isMissing = missing.includes(group)
        const hint =
          group.selectionType === 'ChonMot'
            ? group.isRequired
              ? 'Bắt buộc · chọn 1'
              : 'Không bắt buộc · chọn tối đa 1'
            : `Không bắt buộc · chọn tối đa ${group.maxSelect}`
        return (
          <fieldset key={group.id} className="space-y-2" aria-invalid={isMissing || undefined}>
            <legend className="flex w-full items-baseline justify-between gap-2">
              <span className="text-base font-semibold">{t(en, group.name, group.nameEn)}</span>
              <span className="text-muted-foreground text-xs">{hint}</span>
            </legend>
            {isMissing ? (
              <p className="text-destructive text-sm font-medium" role="alert">
                Bắt buộc chọn 1
              </p>
            ) : null}
            {overMax === group.id ? (
              <p className="text-destructive text-sm font-medium" role="alert">
                Chọn tối đa {group.maxSelect}
              </p>
            ) : null}
            <div className="divide-y rounded-xl border">
              {group.choices.map((choice) => {
                const on = picked.includes(choice.id)
                const radio = group.selectionType === 'ChonMot'
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role={radio ? 'radio' : 'checkbox'}
                    aria-checked={on}
                    aria-disabled={choice.isSoldOut || undefined}
                    disabled={choice.isSoldOut}
                    onClick={() => toggle(group, choice)}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors first:rounded-t-xl last:rounded-b-xl',
                      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                      choice.isSoldOut ? 'opacity-45' : 'hover:bg-muted/60 active:bg-muted',
                      on && 'bg-primary/5'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center border-2',
                        radio ? 'rounded-full' : 'rounded-md',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                      )}
                      aria-hidden="true"
                    >
                      {on ? radio ? <span className="bg-primary-foreground size-2 rounded-full" /> : <Check className="size-3.5" /> : null}
                    </span>
                    <span className="flex-1 text-[0.9375rem]">{t(en, choice.name, choice.nameEn)}</span>
                    {choice.isSoldOut ? (
                      <span className="text-muted-foreground text-xs font-semibold">Hết</span>
                    ) : choice.price > 0 ? (
                      <span className="text-muted-foreground text-sm tabular-nums">+{formatVnd(choice.price)}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      <div className="space-y-2">
        <label htmlFor={`note-${item.id}`} className="text-base font-semibold">
          Ghi chú cho món
        </label>
        <Textarea
          id={`note-${item.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, PosRules.maxLineNote))}
          placeholder="Ví dụ: ít cơm, không hành"
          rows={2}
          className="min-h-11 text-base"
        />
      </div>

      <div className="bg-background sticky bottom-0 -mx-4 flex items-center gap-3 border-t px-4 pt-3 pb-1">
        <div className="flex items-center rounded-full border" role="group" aria-label="Số lượng">
          <Button
            type="button"
            variant="ghost"
            className="size-11 rounded-full"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Giảm số lượng"
          >
            <Minus aria-hidden="true" />
          </Button>
          <span className="w-7 text-center text-base font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="size-11 rounded-full"
            onClick={() => setQuantity((q) => Math.min(PosRules.maxQuantity, q + 1))}
            disabled={quantity >= PosRules.maxQuantity}
            aria-label="Tăng số lượng"
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <Button
          type="button"
          className="h-12 flex-1 rounded-full text-base font-semibold"
          disabled={disabled}
          onClick={() =>
            onSubmit({
              choiceIds: chosen.map((x) => x.choice.id),
              quantity,
              note: note.trim() || undefined,
              options: chosen.map((x) => ({ groupName: x.group.name, name: x.choice.name, price: x.choice.price })),
              unitPrice,
            })
          }
        >
          {item.isSoldOut ? 'Hết món' : `${submitLabel} · ${formatVnd(total)}`}
        </Button>
      </div>
    </div>
  )
}
