import demoData from '@/mock/seed/demo-data.json'
import { stableId } from '@/mock/mock-helpers'
import { mockDb } from '@/mock/mock-db'
import { systemSeed } from '@/mock/system-seed'
import { userIdOf } from '@/mock/system-data'
import type {
  CallReason,
  CategoryRecord,
  DiningTableRecord,
  MenuItemRecord,
  MenuTag,
  OptionGroupRecord,
  OrderItemOptionDto,
  OrderItemRecord,
  OrderRecord,
  PaymentMethod,
  RejectReason,
  RemoveReason,
  SelectionType,
  ServiceRequestRecord,
  SoldOutMode,
  TableSessionRecord,
} from '@/types/menu-qr'
import { isEffectiveLine, lineTotal, sessionSubtotal, unitPrice } from '../lib/pricing'
import { addDaysKey, dayOffsetOfSlot, startOfNextVnDay, vnAt, vnDateKey, vnParts, vnYyMMdd } from '../lib/vn-time'

/**
 * Dựng dữ liệu mẫu từ `demo-data.json` theo đúng quy tắc 06 §5.2–5.4 (giống `DemoDataSeeder` của BE).
 * Mốc nạp `now` lưu ở collection `pos-meta` (làm tròn xuống phút) để kho lịch sử trong bộ nhớ dựng lại
 * đúng như lần nạp đầu mỗi khi tải trang (07 §4.8).
 */

mockDb.registerSeed('demo-data', demoData)

const MIN = 60_000

// ───────────────────────── Kiểu của file seed ─────────────────────────

type SeedLineExtra = { n?: string; sv?: number; rm?: [RemoveReason, string?]; cx?: [number, string, number, string] }
type SeedLine = [string, number, string[]?, SeedLineExtra?]
type SeedTime = string | number
type SeedOrder = {
  t: SeedTime
  s?: 'N'
  g?: string
  cf?: number | 'a'
  rj?: [RejectReason, number, string?]
  by?: string
  sv?: number
  n?: string
  it: SeedLine[]
}
type SeedRequest = {
  ty: 'G' | 'T'
  t: SeedTime
  r?: CallReason
  n?: string
  pm?: PaymentMethod
  vat?: number
  h?: number
  by?: string
  cx?: number
}
type SeedSession = {
  d?: number
  tb: number
  od: SeedOrder[]
  c?: SeedTime
  pm?: [PaymentMethod, number?]
  vat?: number
  by?: string
  rq?: SeedRequest[]
}
type SeedFile = {
  categories: { code: string; color: string; name: string; nameEn?: string; sortOrder: number }[]
  optionGroups: {
    key: string
    name: string
    nameEn?: string
    type: SelectionType
    required: boolean
    max: number
    sortOrder: number
    choices: { key: string; name: string; nameEn?: string; price: number; default?: boolean }[]
  }[]
  menuItems: {
    code: string
    name: string
    nameEn?: string
    category: string
    unit: string
    price: number
    image?: string
    description?: string
    descriptionEn?: string
    tags?: string[]
    groups?: string[]
    soldOut?: SoldOutMode
    hidden?: boolean
    sortOrder: number
  }[]
  tables: { no: number; name: string; zone: string; capacity: number; code: string; active?: boolean }[]
  liveSessions: SeedSession[]
  sessions: SeedSession[]
}

const seedFile = demoData as unknown as SeedFile

// ───────────────────────── Id cố định (06 §5.2) ─────────────────────────

export const menuIds = {
  category: (code: string) => stableId('category', code),
  optionGroup: (key: string) => stableId('option-group', key),
  choice: (key: string) => stableId('option-choice', key),
  menuItem: (code: string) => stableId('menu-item', code),
  table: (no: number) => stableId('table', no),
  session: (code: string) => stableId('session', code),
  order: (code: string) => stableId('order', code),
  orderItem: (orderCode: string, index: number) => stableId('order-item', orderCode, index),
  request: (sessionCode: string, index: number) => stableId('request', sessionCode, index),
}

/** Họ tên theo tên đăng nhập (system.json + project.json) */
export const userNameOf = (username: string): string =>
  systemSeed.users.find((u) => u.username === username)?.fullName ?? username

// ───────────────────────── Bộ dữ liệu ─────────────────────────

export type SeedBundle = {
  now: number
  categories: CategoryRecord[]
  optionGroups: OptionGroupRecord[]
  menuItems: MenuItemRecord[]
  tables: DiningTableRecord[]
  /** Hôm nay (phiên vắng `d` và `liveSessions`) → mock-db */
  todaySessions: TableSessionRecord[]
  todayOrders: OrderRecord[]
  todayRequests: ServiceRequestRecord[]
  /** Trước hôm nay → kho chỉ đọc trong bộ nhớ */
  historySessions: TableSessionRecord[]
  historyOrders: OrderRecord[]
  historyRequests: ServiceRequestRecord[]
}

type Draft = {
  seed: SeedSession
  today: boolean
  live: boolean
  openedAt: number
  session: TableSessionRecord
  orders: { seed: SeedOrder; at: number; index: number; record: OrderRecord }[]
  requests: ServiceRequestRecord[]
}

/** Dựng toàn bộ dữ liệu mẫu theo mốc nạp `anchor` (ms). */
export function buildSeedBundle(anchor: number): SeedBundle {
  const now = Math.floor(anchor / MIN) * MIN
  const iso = (ms: number) => new Date(ms).toISOString()
  const todayKey = vnDateKey(now)
  const isoToday = vnParts(now).isoWeekday
  const createdAt = iso(now - 90 * 86_400_000)

  // ───── Thực đơn, bàn ─────
  const categories: CategoryRecord[] = seedFile.categories.map((c) => ({
    id: menuIds.category(c.code),
    code: c.code,
    name: c.name,
    nameEn: c.nameEn,
    color: c.color,
    sortOrder: c.sortOrder,
    isHidden: false,
    createdAt,
    updatedAt: createdAt,
  }))
  const optionGroups: OptionGroupRecord[] = seedFile.optionGroups.map((g) => ({
    id: menuIds.optionGroup(g.key),
    name: g.name,
    nameEn: g.nameEn,
    selectionType: g.type,
    isRequired: g.type === 'ChonMot' ? g.required : false,
    maxSelect: g.type === 'ChonMot' ? 1 : g.max,
    sortOrder: g.sortOrder,
    choices: g.choices.map((c, i) => ({
      id: menuIds.choice(c.key),
      name: c.name,
      nameEn: c.nameEn,
      price: c.price,
      isDefault: !!c.default,
      sortOrder: (i + 1) * 10,
    })),
    createdAt,
    updatedAt: createdAt,
  }))
  const categoryByCode = new Map(categories.map((c) => [c.code, c]))
  const menuItems: MenuItemRecord[] = seedFile.menuItems.map((m) => ({
    id: menuIds.menuItem(m.code),
    code: m.code,
    name: m.name,
    nameEn: m.nameEn,
    categoryId: categoryByCode.get(m.category)?.id ?? menuIds.category(m.category),
    imageUrl: m.image ? `/seed/menu/${m.image}` : undefined,
    description: m.description,
    descriptionEn: m.descriptionEn,
    unit: m.unit,
    price: m.price,
    tags: (m.tags ?? []) as MenuTag[],
    optionGroupIds: (m.groups ?? []).map(menuIds.optionGroup),
    isHidden: !!m.hidden,
    soldOutMode: m.soldOut,
    soldOutUntil: m.soldOut === 'HetHomNay' ? startOfNextVnDay(now) : undefined,
    sortOrder: m.sortOrder,
    updatedAt: createdAt,
    createdAt,
  }))
  const tables: DiningTableRecord[] = seedFile.tables.map((t) => ({
    id: menuIds.table(t.no),
    name: t.name,
    zone: t.zone,
    capacity: t.capacity,
    code: t.code,
    isActive: t.active !== false,
    sortOrder: t.no * 10,
    version: 1,
    createdAt,
  }))
  const tableByNo = new Map(seedFile.tables.map((t) => [t.no, t]))
  const itemByCode = new Map(seedFile.menuItems.map((m) => [m.code, m]))
  const groupByKey = new Map(seedFile.optionGroups.map((g) => [g.key, g]))
  const choiceByKey = new Map(
    seedFile.optionGroups.flatMap((g) => g.choices.map((c, i) => [c.key, { group: g, choice: c, order: i }] as const))
  )

  // ───── Thời gian ─────
  const atOf = (value: SeedTime, d: number | undefined): number => {
    if (typeof value === 'number') return now + value * MIN
    const dayKey = d === undefined ? todayKey : addDaysKey(todayKey, dayOffsetOfSlot(d, isoToday))
    return vnAt(dayKey, value)
  }

  const snapshotOptions = (code: string, keys: string[]): OrderItemOptionDto[] => {
    const item = itemByCode.get(code)
    const order = (item?.groups ?? []).map((k) => k)
    return keys
      .map((k) => choiceByKey.get(k))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => order.indexOf(a.group.key) - order.indexOf(b.group.key) || a.order - b.order)
      .map(({ group, choice }) => ({
        groupId: menuIds.optionGroup(group.key),
        groupName: groupByKey.get(group.key)?.name ?? group.name,
        choiceId: menuIds.choice(choice.key),
        name: choice.name,
        price: choice.price,
      }))
  }

  // ───── Phiên, đơn, yêu cầu ─────
  const drafts: Draft[] = []
  const collect = (list: SeedSession[], live: boolean) => {
    for (const seed of list) {
      const today = seed.d === undefined
      const orderTimes = seed.od.map((o) => atOf(o.t, seed.d))
      const openedAt = Math.min(...orderTimes)
      const table = tableByNo.get(seed.tb)!
      drafts.push({
        seed,
        today,
        live,
        openedAt,
        session: {
          id: '',
          code: '',
          tableId: menuIds.table(seed.tb),
          tableName: table.name,
          status: 'DangPhucVu',
          openedAt: iso(openedAt),
          needVatInvoice: false,
          version: 1,
        },
        orders: seed.od.map((o, index) => ({ seed: o, at: orderTimes[index], index, record: null as unknown as OrderRecord })),
        requests: [],
      })
    }
  }
  collect(seedFile.sessions, false)
  collect(seedFile.liveSessions, true)

  // Mã phiên: PB + yyMMdd + số theo (OpenedAt, bàn) trong ngày
  const sessionSeq = new Map<string, number>()
  for (const draft of [...drafts].sort((a, b) => a.openedAt - b.openedAt || a.seed.tb - b.seed.tb)) {
    const day = vnYyMMdd(draft.openedAt)
    const n = (sessionSeq.get(day) ?? 0) + 1
    sessionSeq.set(day, n)
    draft.session.code = `PB${day}${String(n).padStart(4, '0')}`
    draft.session.id = menuIds.session(draft.session.code)
  }
  // Mã đơn: DH + yyMMdd + số theo (giờ gửi, bàn, thứ tự trong od) trong ngày
  const allOrderDrafts = drafts.flatMap((d) => d.orders.map((o) => ({ draft: d, o })))
  allOrderDrafts.sort((a, b) => a.o.at - b.o.at || a.draft.seed.tb - b.draft.seed.tb || a.o.index - b.o.index)
  const orderSeq = new Map<string, number>()
  for (const { draft, o } of allOrderDrafts) {
    const day = vnYyMMdd(o.at)
    const n = (orderSeq.get(day) ?? 0) + 1
    orderSeq.set(day, n)
    const code = `DH${day}${String(n).padStart(4, '0')}`
    o.record = buildOrder(draft, o.seed, o.at, code)
  }

  function buildOrder(draft: Draft, s: SeedOrder, at: number, code: string): OrderRecord {
    const byName = s.by ? userNameOf(s.by) : undefined
    const byId = s.by ? userIdOf(s.by) : undefined
    let status: OrderRecord['status'] = 'ChoXacNhan'
    let handledAt: number | undefined
    let handled = false
    let autoConfirmed = false
    const order: Partial<OrderRecord> = {}
    if (s.rj) {
      status = 'BiTuChoi'
      handledAt = at + s.rj[1] * MIN
      order.rejectReason = s.rj[0]
      order.rejectNote = s.rj[2]
    } else if (s.s === 'N') {
      handled = true
      handledAt = at
    } else if (s.cf === 'a') {
      handled = true
      autoConfirmed = true
      handledAt = at
    } else if (typeof s.cf === 'number') {
      handled = true
      handledAt = at + s.cf * MIN
    }
    const items: OrderItemRecord[] = []
    s.it.forEach(([itemCode, quantity, keys, extra]) => {
      const menu = itemByCode.get(itemCode)!
      const options = snapshotOptions(itemCode, keys ?? [])
      const price = unitPrice(menu.price, options)
      const base: OrderItemRecord = {
        id: '',
        menuItemId: menuIds.menuItem(itemCode),
        itemCode,
        itemName: menu.name,
        itemPrice: menu.price,
        options,
        optionsPrice: price - menu.price,
        unitPrice: price,
        quantity,
        lineTotal: price * quantity,
        note: extra?.n,
        status: 'ChoXacNhan',
        sortOrder: 0,
      }
      if (handled) {
        if (extra?.rm) {
          base.status = 'BiBo'
          base.removeReason = extra.rm[0]
          base.removeNote = extra.rm[1]
          base.removedAt = iso(handledAt!)
        } else {
          const sv = extra?.sv ?? s.sv
          if (sv !== undefined) {
            base.status = 'DaPhucVu'
            base.servedAt = iso(at + sv * MIN)
          } else base.status = 'DaXacNhan'
        }
      }
      const cx = handled && !extra?.rm ? extra?.cx : undefined
      if (cx) {
        const remaining = quantity - cx[0]
        const cancelled: OrderItemRecord = {
          ...base,
          quantity: cx[0],
          lineTotal: price * cx[0],
          status: 'DaHuy',
          servedAt: undefined,
          cancelReason: cx[1],
          cancelledAt: iso(at + cx[2] * MIN),
          cancelledById: userIdOf(cx[3]),
          cancelledByName: userNameOf(cx[3]),
        }
        if (remaining > 0) {
          items.push({ ...base, quantity: remaining, lineTotal: price * remaining })
          items.push(cancelled)
        } else items.push(cancelled)
      } else items.push(base)
    })
    items.forEach((item, i) => {
      item.sortOrder = i + 1
      item.id = menuIds.orderItem(code, i + 1)
      item.lineTotal = lineTotal(item)
    })
    if (handled) {
      const effective = items.filter((i) => isEffectiveLine(i.status))
      status = effective.length === 0 ? 'DaHuy' : effective.every((i) => i.status === 'DaPhucVu') ? 'DaPhucVu' : 'DaXacNhan'
    }
    return {
      id: menuIds.order(code),
      code,
      sessionId: draft.session.id,
      tableId: draft.session.tableId,
      tableName: draft.session.tableName,
      source: s.s === 'N' ? 'NhanVien' : 'KhachQr',
      status,
      autoConfirmed,
      guestName: s.g,
      note: s.n,
      submittedAt: iso(at),
      handledAt: handledAt !== undefined ? iso(handledAt) : undefined,
      handledById: autoConfirmed ? undefined : byId,
      handledByName: autoConfirmed ? undefined : byName,
      createdById: s.s === 'N' ? byId : undefined,
      items,
      version: 1,
      ...order,
    }
  }

  // Trạng thái phiên, yêu cầu
  for (const draft of drafts) {
    const { seed, session } = draft
    const orders = draft.orders.map((o) => o.record)
    if (orders.every((o) => o.status === 'BiTuChoi')) {
      session.status = 'DaHuy'
      session.closedAt = iso(Math.max(...orders.map((o) => new Date(o.handledAt!).getTime())))
    } else if (seed.c !== undefined) {
      const total = sessionSubtotal(orders)
      const closer = seed.by ?? 'nhanvien'
      session.status = 'DaDong'
      session.closedAt = iso(atOf(seed.c, seed.d))
      session.total = total
      session.paymentMethod = seed.pm?.[0] ?? 'TienMat'
      if (session.paymentMethod === 'TienMat') {
        session.cashReceived = seed.pm?.[1] ?? total
        session.changeAmount = session.cashReceived - total
      }
      session.needVatInvoice = seed.vat === 1
      session.closedById = userIdOf(closer)
      session.closedByName = userNameOf(closer)
    }
    const closer = seed.by ?? 'nhanvien'
    const orderTimes = draft.orders.map((o) => o.at).sort((a, b) => a - b)
    draft.requests = (seed.rq ?? []).map((r, index) => {
      const at = atOf(r.t, seed.d)
      const req: ServiceRequestRecord = {
        id: menuIds.request(session.code, index + 1),
        tableId: session.tableId,
        tableName: session.tableName,
        sessionId: session.id,
        type: r.ty === 'G' ? 'GoiNhanVien' : 'ThanhToan',
        reason: r.ty === 'G' ? r.r : undefined,
        note: r.ty === 'G' ? r.n : undefined,
        paymentMethod: r.ty === 'T' ? (r.pm ?? 'TienMat') : undefined,
        needVatInvoice: r.ty === 'T' && r.vat === 1,
        status: 'DangCho',
        createdAt: iso(at),
        autoHandled: false,
      }
      if (r.cx) {
        req.status = 'DaHuy'
        const next = orderTimes.find((t) => t > at)
        req.handledAt = iso(next ?? at)
      } else if (r.h !== undefined) {
        const by = r.by ?? closer
        req.status = 'DaXuLy'
        req.handledAt = iso(at + r.h * MIN)
        req.handledById = userIdOf(by)
        req.handledByName = userNameOf(by)
      } else if (session.closedAt) {
        req.status = 'DaXuLy'
        req.autoHandled = true
        req.handledAt = session.closedAt
        req.handledById = session.closedById
        req.handledByName = session.closedByName
      }
      return req
    })
    if (session.status === 'DangPhucVu' && draft.requests.some((r) => r.type === 'ThanhToan' && r.status === 'DangCho')) {
      session.status = 'ChoThanhToan'
    }
  }

  // Bàn đang có phiên mở
  for (const draft of drafts) {
    if (draft.session.status !== 'DangPhucVu' && draft.session.status !== 'ChoThanhToan') continue
    const table = tables.find((t) => t.id === draft.session.tableId)
    if (table) table.currentSessionId = draft.session.id
  }

  const pick = (today: boolean) => drafts.filter((d) => d.today === today)
  const flat = (list: Draft[]) => ({
    sessions: list.map((d) => d.session),
    orders: list.flatMap((d) => d.orders.map((o) => o.record)),
    requests: list.flatMap((d) => d.requests),
  })
  const todayPart = flat(pick(true))
  const historyPart = flat(pick(false))
  return {
    now,
    categories,
    optionGroups,
    menuItems,
    tables,
    todaySessions: todayPart.sessions,
    todayOrders: todayPart.orders,
    todayRequests: todayPart.requests,
    historySessions: historyPart.sessions,
    historyOrders: historyPart.orders,
    historyRequests: historyPart.requests,
  }
}

// ───────────────────────── Mốc nạp ─────────────────────────

type MetaRecord = { id: string; seededAt: string }
const META_ID = 'meta'

const metaDb = mockDb.collection<MetaRecord>('pos-meta', () => [{ id: META_ID, seededAt: new Date().toISOString() }])

let cached: { anchor: string; bundle: SeedBundle } | null = null

/** Bộ dữ liệu mẫu theo mốc nạp hiện tại (tính một lần cho mỗi mốc) */
export function seedBundle(): SeedBundle {
  const anchor = metaDb.get(META_ID)?.seededAt ?? new Date().toISOString()
  if (!cached || cached.anchor !== anchor) cached = { anchor, bundle: buildSeedBundle(new Date(anchor).getTime()) }
  return cached.bundle
}

mockDb.onReset(() => {
  cached = null
})
