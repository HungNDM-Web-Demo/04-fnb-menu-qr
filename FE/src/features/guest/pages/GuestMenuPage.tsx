'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { PublicMenuItem } from '@/types/menu-qr'
import { cartStore } from '../lib/guest-storage'
import { GuestBottomBar, OrderingBanner, StoreLogo } from '../components/GuestChrome'
import { useGuest } from '../components/GuestContext'
import { GuestMenuList } from '../components/GuestMenuList'
import { GuestSheet } from '../components/GuestSheet'
import { ItemOptionsForm } from '../components/ItemOptionsForm'

/** SCR-01 Menu khách + SCR-02 Chi tiết món (UC-01, UC-02) */
export function GuestMenuPage() {
  const { info, menu, menuLoading, lang, setLang, scrollEl, cartKey } = useGuest()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [detail, setDetail] = useState<PublicMenuItem | null>(null)
  const en = lang === 'en'

  const addDirect = (item: PublicMenuItem) => {
    cartStore.add(cartKey, {
      menuItemId: item.id,
      choiceIds: [],
      quantity: 1,
      itemName: item.name,
      imageUrl: item.imageUrl,
      itemPrice: item.price,
      options: [],
      unitPrice: item.price,
    })
    toast.success(`Đã thêm ${item.name}`, { duration: 1500 })
  }

  return (
    <div className="pb-28">
      <OrderingBanner />
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <StoreLogo className="size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-bold">{info.store.name}</h1>
          {info.store.tagline ? <p className="text-muted-foreground line-clamp-1 text-xs">{info.store.tagline}</p> : null}
        </div>
        <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-bold">{info.table.name}</span>
      </header>

      <div className="flex items-center gap-2 px-4 pb-2">
        {searchOpen ? (
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm món, vd: khoai tây"
              className="h-11 rounded-full pr-11 pl-9 text-base"
              aria-label="Tìm món"
            />
            <button
              type="button"
              className="hover:bg-muted absolute top-0 right-0 flex size-11 items-center justify-center rounded-full"
              onClick={() => {
                setSearch('')
                setSearchOpen(false)
              }}
              aria-label="Đóng tìm kiếm"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="bg-muted text-muted-foreground flex h-11 flex-1 items-center gap-2 rounded-full px-4 text-left text-[0.9375rem]"
          >
            <Search className="size-4" aria-hidden="true" />
            Tìm món
          </button>
        )}
        <button
          type="button"
          onClick={() => setLang(en ? 'vi' : 'en')}
          className="hover:bg-muted flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-bold"
          aria-label={en ? 'Chuyển sang tiếng Việt' : 'Switch to English'}
        >
          {en ? 'VI' : 'EN'}
        </button>
      </div>

      {menu ? (
        <GuestMenuList
          menu={menu}
          en={en}
          search={search}
          scrollEl={scrollEl}
          onOpen={(item) => setDetail(item)}
          onAdd={(item) => (item.optionGroupIds.length > 0 ? setDetail(item) : addDirect(item))}
        />
      ) : menuLoading ? (
        <div className="space-y-4 px-4 pt-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-[6.5rem] rounded-xl" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <GuestBottomBar />

      <GuestSheet
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail ? (en && detail.nameEn ? detail.nameEn : detail.name) : ''}
      >
        {detail && menu ? (
          <ItemOptionsForm
            key={detail.id}
            item={detail}
            groups={menu.optionGroups}
            en={en}
            onSubmit={(r) => {
              cartStore.add(cartKey, {
                menuItemId: detail.id,
                choiceIds: r.choiceIds,
                quantity: r.quantity,
                note: r.note,
                itemName: detail.name,
                imageUrl: detail.imageUrl,
                itemPrice: detail.price,
                options: r.options,
                unitPrice: r.unitPrice,
              })
              toast.success(`Đã thêm ${r.quantity} ${detail.name}`, { duration: 1500 })
              setDetail(null)
            }}
          />
        ) : null}
      </GuestSheet>
    </div>
  )
}
