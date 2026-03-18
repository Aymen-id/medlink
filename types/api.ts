export type ApiResponse<T = unknown> = {
  data: T | null;
  error: string | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  error: string | null;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
};
