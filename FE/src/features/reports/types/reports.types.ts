/** Tham số báo cáo (07 §2.11): ngày `yyyy-MM-dd` giờ Việt Nam; vắng → 30 ngày tới hôm nay */
export type DateRangeQuery = { from?: string; to?: string }
export type ItemsReportQuery = DateRangeQuery & { categoryId?: string }
