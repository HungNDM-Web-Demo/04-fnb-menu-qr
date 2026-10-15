import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CategoryDto,
  MenuBundle,
  MenuItemDto,
  OptionGroupDto,
  SaveCategoryRequest,
  SaveMenuItemRequest,
  SaveOptionGroupRequest,
  SetAvailabilityRequest,
} from '@/types/menu-qr'
import { menuCatalogMock } from '../mock/menu-catalog.mock'
import type { MenuItemQuery } from '../types/menu-items.types'

/** Thực đơn gộp, danh mục, món, nhóm tùy chọn (07 §2.1–2.4) */
export const menuCatalogService = {
  bundle: (): Promise<MenuBundle> => (isMockMode() ? menuCatalogMock.bundle() : apiCall.get(apiRoutes.menu)),

  // ───── Danh mục ─────
  categories: (): Promise<CategoryDto[]> =>
    isMockMode() ? menuCatalogMock.categories() : apiCall.get(apiRoutes.categories.list),
  createCategory: (input: SaveCategoryRequest): Promise<CategoryDto> =>
    isMockMode() ? menuCatalogMock.createCategory(input) : apiCall.post(apiRoutes.categories.list, input),
  updateCategory: (id: string, input: SaveCategoryRequest): Promise<CategoryDto> =>
    isMockMode() ? menuCatalogMock.updateCategory(id, input) : apiCall.put(apiRoutes.categories.detail(id), input),
  reorderCategories: (ids: string[]): Promise<void> =>
    isMockMode() ? menuCatalogMock.reorderCategories(ids) : apiCall.put(apiRoutes.categories.order, { ids }),
  deleteCategory: (id: string): Promise<void> =>
    isMockMode() ? menuCatalogMock.deleteCategory(id) : apiCall.delete(apiRoutes.categories.detail(id)),

  // ───── Món ─────
  menuItems: (query: MenuItemQuery): Promise<PaginatedResult<MenuItemDto>> =>
    isMockMode() ? menuCatalogMock.menuItems(query) : apiCall.get(apiRoutes.menuItems.list, { params: query }),
  menuItem: (id: string): Promise<MenuItemDto> =>
    isMockMode() ? menuCatalogMock.menuItem(id) : apiCall.get(apiRoutes.menuItems.detail(id)),
  createMenuItem: (input: SaveMenuItemRequest): Promise<MenuItemDto> =>
    isMockMode() ? menuCatalogMock.createMenuItem(input) : apiCall.post(apiRoutes.menuItems.list, input),
  updateMenuItem: (id: string, input: SaveMenuItemRequest): Promise<MenuItemDto> =>
    isMockMode() ? menuCatalogMock.updateMenuItem(id, input) : apiCall.put(apiRoutes.menuItems.detail(id), input),
  setAvailability: (id: string, input: SetAvailabilityRequest): Promise<void> =>
    isMockMode()
      ? menuCatalogMock.setAvailability(id, input)
      : apiCall.patch(apiRoutes.menuItems.availability(id), input),
  setHidden: (id: string, isHidden: boolean): Promise<void> =>
    isMockMode()
      ? menuCatalogMock.setHidden(id, isHidden)
      : apiCall.patch(apiRoutes.menuItems.hidden(id), { isHidden }),
  uploadImage: (id: string, file: File): Promise<{ imageUrl: string }> => {
    if (isMockMode()) return menuCatalogMock.uploadImage(id, file)
    const form = new FormData()
    form.append('file', file)
    return apiCall.post(apiRoutes.menuItems.image(id), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  reorderMenuItems: (categoryId: string, ids: string[]): Promise<void> =>
    isMockMode()
      ? menuCatalogMock.reorderMenuItems(categoryId, ids)
      : apiCall.put(apiRoutes.menuItems.order, { categoryId, ids }),
  deleteMenuItem: (id: string): Promise<void> =>
    isMockMode() ? menuCatalogMock.deleteMenuItem(id) : apiCall.delete(apiRoutes.menuItems.detail(id)),

  // ───── Nhóm tùy chọn ─────
  optionGroups: (): Promise<OptionGroupDto[]> =>
    isMockMode() ? menuCatalogMock.optionGroups() : apiCall.get(apiRoutes.optionGroups.list),
  createOptionGroup: (input: SaveOptionGroupRequest): Promise<OptionGroupDto> =>
    isMockMode() ? menuCatalogMock.createOptionGroup(input) : apiCall.post(apiRoutes.optionGroups.list, input),
  updateOptionGroup: (id: string, input: SaveOptionGroupRequest): Promise<OptionGroupDto> =>
    isMockMode()
      ? menuCatalogMock.updateOptionGroup(id, input)
      : apiCall.put(apiRoutes.optionGroups.detail(id), input),
  setChoiceAvailability: (groupId: string, choiceId: string, input: SetAvailabilityRequest): Promise<void> =>
    isMockMode()
      ? menuCatalogMock.setChoiceAvailability(groupId, choiceId, input)
      : apiCall.patch(apiRoutes.optionGroups.choiceAvailability(groupId, choiceId), input),
  deleteOptionGroup: (id: string): Promise<void> =>
    isMockMode() ? menuCatalogMock.deleteOptionGroup(id) : apiCall.delete(apiRoutes.optionGroups.detail(id)),
}
