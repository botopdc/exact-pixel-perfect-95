export interface RequestResponse<T = any> {
  data: T
  isError: false
}

export interface RequestError<T = any> {
  data: T
  message: string
  isError: true
}

export interface PaginatedMeta {
  current_page: number;
  from: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedResponse<T = any> extends PaginatedMeta {
  isError: false
  data: T[]
}
