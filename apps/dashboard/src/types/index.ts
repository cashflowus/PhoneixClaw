/**
 * Common types shared across domains.
 */

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ApiError {
  detail: string
  status_code: number
}

export interface MetricValue {
  label: string
  value: number | string
  trend?: 'up' | 'down' | 'flat'
  change_pct?: number
}

export interface TimeRange {
  start: string
  end: string
  label: string
}

export * from './agent'
export * from './trade'
export * from './connector'
export * from './instance'
