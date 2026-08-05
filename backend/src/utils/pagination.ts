// pagination.ts
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export const getPaginationParams = (query: PaginationQuery) => {
  const page = Math.max(parseInt(query.page ?? '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit ?? '20', 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) => ({
  items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});