'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  OrderSettingsDto,
  PauseOrderingRequest,
  SaveTableRequest,
  UpdateOrderSettingsRequest,
} from '@/types/menu-qr'
import { orderSettingsService, tableService } from '../services/table.service'

/** Khóa query theo 07 §4.9 (`tables-changed`, `ordering-changed` làm mới các khóa này) */
export const tableKeys = {
  tables: ['tables'] as const,
  orderSettings: ['order-settings'] as const,
  storeProfile: ['store-profile'] as const,
}

function useTableMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: tableKeys.tables }),
        client.invalidateQueries({ queryKey: ['table-board'] }),
        client.invalidateQueries({ queryKey: ['public'] }),
      ]),
  })
}

function useSettingsMutation<TVariables>(fn: (variables: TVariables) => Promise<OrderSettingsDto>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: tableKeys.orderSettings }),
        client.invalidateQueries({ queryKey: ['public'] }),
      ]),
  })
}

export const useTables = () => useQuery({ queryKey: tableKeys.tables, queryFn: tableService.list })

export const useSaveTable = () =>
  useTableMutation(({ id, input }: { id?: string; input: SaveTableRequest }) =>
    id ? tableService.update(id, input) : tableService.create(input)
  )
export const useSetTableActive = () =>
  useTableMutation(({ id, isActive }: { id: string; isActive: boolean }) => tableService.setActive(id, isActive))
export const useRegenerateTableCode = () => useTableMutation((id: string) => tableService.regenerateCode(id))
export const useDeleteTable = () => useTableMutation((id: string) => tableService.remove(id))

export const useOrderSettings = () =>
  useQuery({ queryKey: tableKeys.orderSettings, queryFn: orderSettingsService.get, refetchInterval: 60_000 })
export const useUpdateOrderSettings = () =>
  useSettingsMutation((input: UpdateOrderSettingsRequest) => orderSettingsService.update(input))
export const usePauseOrdering = () =>
  useSettingsMutation((input: PauseOrderingRequest) => orderSettingsService.pause(input))
export const useResumeOrdering = () => useSettingsMutation(() => orderSettingsService.resume())

export const useStoreProfile = () =>
  useQuery({ queryKey: tableKeys.storeProfile, queryFn: orderSettingsService.storeProfile, staleTime: 60_000 })
