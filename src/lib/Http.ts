export const Http = {
  toQueryString(params?: Record<string, any>): string {
    if (!params) return ''
    return new URLSearchParams(params as Record<string, string>).toString()
  }
}
