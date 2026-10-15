'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGuest } from './GuestContext'

/** Khóa cuộn phần nền khi tấm trượt mở; trả hàm mở khóa */
function lockScroll(el: HTMLElement): () => void {
  const previous = el.style.overflow
  el.style.setProperty('overflow', 'hidden')
  return () => el.style.setProperty('overflow', previous)
}

type GuestSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Tấm trượt từ cạnh dưới của trang khách (07 §4.3). Tự viết thay cho `vaul` vì mở lại liên tiếp trong lúc tấm cũ
 * đang đóng làm `vaul` kẹt khóa cuộn trang. Trên màn hình rộng nằm gọn trong khung điện thoại (portal vào khung;
 * khung có transform nên `fixed` tính theo khung). Esc, chạm nền, nút X để đóng; khóa cuộn phần nền khi mở.
 */
export function GuestSheet({ open, onOpenChange, title, description, footer, children, className }: GuestSheetProps) {
  const { container, scrollEl } = useGuest()
  const titleId = useId()
  const descId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const unlock = lockScroll(scrollEl ?? document.body)
    const active = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      unlock()
      document.removeEventListener('keydown', onKey)
      active?.focus?.({ preventScroll: true })
    }
  }, [open, scrollEl, onOpenChange])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="animate-in fade-in-0 absolute inset-0 bg-black/45 duration-200" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'bg-background animate-in slide-in-from-bottom absolute inset-x-0 bottom-0 flex max-h-[92%] flex-col rounded-t-2xl shadow-2xl duration-300 motion-reduce:animate-none',
          className
        )}
      >
        <div className="bg-muted-foreground/30 mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full" aria-hidden="true" />
        <div className="flex items-start gap-2 px-4 pt-2 pb-1">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg leading-snug font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-muted-foreground text-sm">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="hover:bg-muted focus-visible:ring-ring -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Đóng"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer ? <div className="bg-background border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>,
    container ?? document.body
  )
}
