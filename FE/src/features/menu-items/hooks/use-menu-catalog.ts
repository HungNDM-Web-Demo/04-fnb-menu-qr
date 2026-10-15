'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SaveCategoryRequest,
  SaveMenuItemRequest,
  SaveOptionGroupRequest,
  SetAvailabilityRequest,
} from '@/types/menu-qr'
import { menuCatalogService } from '../services/menu-catalog.service'
import type { MenuItemQuery } from '../types/menu-items.types'

/**
 * Khóa query theo 07 §4.9 để `RealtimeBridge` (sự kiện `menu-changed`) làm mới đúng chỗ.
 * Mọi thao tác ghi thực đơn làm mới cả 4 khóa và thực đơn trang khách mở trong cùng tab.
 */
export const menuKeys = {
  menu: ['menu'] as const,
  menuItems: ['menu-items'] as const,
  menuItemList: (query: MenuItemQuery) => ['menu-items', query] as const,
  nextCode: ['menu-items', 'next-code'] as const,
  categories: ['categories'] as const,
  optionGroups: ['option-groups'] as const,
}

function useMenuMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: menuKeys.menu }),
        client.invalidateQueries({ queryKey: menuKeys.menuItems }),
        client.invalidateQueries({ queryKey: menuKeys.categories }),
        client.invalidateQueries({ queryKey: menuKeys.optionGroups }),
        client.invalidateQueries({ queryKey: ['public'] }),
      ]),
  })
}

// ───── Thực đơn gộp (khung xem trước) ─────
export const useMenuBundle = (enabled = true) =>
  useQuery({ queryKey: menuKeys.menu, queryFn: menuCatalogService.bundle, enabled, staleTime: 30_000 })

// ───── Món ─────
export const useMenuItems = (query: MenuItemQuery) =>
  useQuery({
    queryKey: menuKeys.menuItemList(query),
    queryFn: () => menuCatalogService.menuItems(query),
    placeholderData: keepPreviousData,
  })

/** Gợi ý mã kế tiếp: mã M lớn nhất + 1 (M050 → M051) */
export function useNextMenuItemCode(enabled: boolean) {
  return useQuery({
    queryKey: menuKeys.nextCode,
    queryFn: async () => {
      const result = await menuCatalogService.menuItems({ page: 1, pageSize: 1, sortBy: 'code', sortDir: 'desc' })
      const max = result.items.reduce((acc, item) => {
        const m = /^M(\d{3})$/.exec(item.code)
        return m ? Math.max(acc, Number(m[1])) : acc
      }, 0)
      return max >= 999 ? '' : `M${String(max + 1).padStart(3, '0')}`
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
}

export const useSaveMenuItem = () =>
  useMenuMutation(({ id, input }: { id?: string; input: SaveMenuItemRequest }) =>
    id ? menuCatalogService.updateMenuItem(id, input) : menuCatalogService.createMenuItem(input)
  )
export const useSetMenuItemAvailability = () =>
  useMenuMutation(({ id, input }: { id: string; input: SetAvailabilityRequest }) =>
    menuCatalogService.setAvailability(id, input)
  )
export const useSetMenuItemHidden = () =>
  useMenuMutation(({ id, isHidden }: { id: string; isHidden: boolean }) =>
    menuCatalogService.setHidden(id, isHidden)
  )
export const useUploadMenuItemImage = () =>
  useMenuMutation(({ id, file }: { id: string; file: File }) => menuCatalogService.uploadImage(id, file))
export const useReorderMenuItems = () =>
  useMenuMutation(({ categoryId, ids }: { categoryId: string; ids: string[] }) =>
    menuCatalogService.reorderMenuItems(categoryId, ids)
  )
export const useDeleteMenuItem = () => useMenuMutation((id: string) => menuCatalogService.deleteMenuItem(id))

// ───── Danh mục ─────
export const useCategories = () =>
  useQuery({ queryKey: menuKeys.categories, queryFn: menuCatalogService.categories })
export const useSaveCategory = () =>
  useMenuMutation(({ id, input }: { id?: string; input: SaveCategoryRequest }) =>
    id ? menuCatalogService.updateCategory(id, input) : menuCatalogService.createCategory(input)
  )
export const useReorderCategories = () =>
  useMenuMutation((ids: string[]) => menuCatalogService.reorderCategories(ids))
export const useDeleteCategory = () => useMenuMutation((id: string) => menuCatalogService.deleteCategory(id))

// ───── Nhóm tùy chọn ─────
export const useOptionGroups = () =>
  useQuery({ queryKey: menuKeys.optionGroups, queryFn: menuCatalogService.optionGroups })
export const useSaveOptionGroup = () =>
  useMenuMutation(({ id, input }: { id?: string; input: SaveOptionGroupRequest }) =>
    id ? menuCatalogService.updateOptionGroup(id, input) : menuCatalogService.createOptionGroup(input)
  )
export const useSetChoiceAvailability = () =>
  useMenuMutation(
    ({ groupId, choiceId, input }: { groupId: string; choiceId: string; input: SetAvailabilityRequest }) =>
      menuCatalogService.setChoiceAvailability(groupId, choiceId, input)
  )
export const useDeleteOptionGroup = () => useMenuMutation((id: string) => menuCatalogService.deleteOptionGroup(id))
