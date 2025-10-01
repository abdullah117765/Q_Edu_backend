export interface PaginationMeta {
  total: number;
  count: number;
  nextPage: number | null;
  previousPage: number | null;
  currentPage: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}