'use client'

import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NumericKeypadProps = {
  value: string
  onChange: (value: string) => void
  /** Cho nhập dấu phẩy thập phân (số kg), tối đa `decimals` chữ số sau dấu phẩy */
  allowDecimal?: boolean
  decimals?: number
  maxLength?: number
  className?: string
}

/** Bàn phím số lớn cho tablet (mở bàn nhập số khách, món theo trọng lượng nhập kg) */
export function NumericKeypad({ value, onChange, allowDecimal, decimals = 1, maxLength = 6, className }: NumericKeypadProps) {
  const press = (key: string) => {
    if (key === 'back') return onChange(value.slice(0, -1))
    if (key === ',') {
      if (!allowDecimal || value.includes(',')) return
      return onChange(value ? `${value},` : '0,')
    }
    if (value.length >= maxLength) return
    const [, frac] = value.split(',')
    if (frac !== undefined && frac.length >= decimals) return
    onChange(value === '0' ? key : value + key)
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? ',' : 'clear', '0', 'back']
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)} role="group" aria-label="Bàn phím số">
      {keys.map((key) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          className="h-14 text-xl font-semibold tabular-nums"
          onClick={() => (key === 'clear' ? onChange('') : press(key))}
          aria-label={key === 'back' ? 'Xóa một số' : key === 'clear' ? 'Xóa hết' : key === ',' ? 'Dấu phẩy' : key}
        >
          {key === 'back' ? <Delete className="size-5" aria-hidden="true" /> : key === 'clear' ? 'C' : key}
        </Button>
      ))}
    </div>
  )
}

/** "1,2" → 1.2 */
export const parseKeypad = (value: string) => {
  const n = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(n) ? null : n
}
