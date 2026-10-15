'use client'

import { useState } from 'react'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn, getInitials } from '@/lib/utils'

type MenuImageProps = {
  imageUrl?: string | null
  name: string
  /** Màu danh mục (#RRGGBB) cho ô mặc định khi chưa có ảnh */
  color?: string
  className?: string
  /** Cỡ chữ viết tắt */
  textClassName?: string
}

/**
 * Ảnh món (`/seed/menu/{mã}.webp`, `/uploads/...` hoặc `idb://`); chưa có ảnh hay ảnh lỗi thì
 * hiện ô màu theo danh mục kèm chữ viết tắt tên món (07 §4, 06 §4 Pos_Categories.Color).
 */
export function MenuImage({ imageUrl, name, color, className, textClassName }: MenuImageProps) {
  const src = useAssetUrl(imageUrl)
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = !!src && failed !== src

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={!showImage ? { backgroundColor: color ?? 'var(--muted)' } : undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh có thể là idb://, blob: hoặc từ BE
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(src)}
          className="size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-full items-center justify-center font-bold tracking-wide text-white/95',
            textClassName ?? 'text-2xl'
          )}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}
