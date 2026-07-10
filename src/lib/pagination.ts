import { app } from "@/lib/cloudbase";

const db = app.database();

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export async function fetchPaginated<T>(
  collection: string,
  options: {
    where?: Record<string, unknown>;
    orderByField?: string;
    orderDirection?: "asc" | "desc";
    cursor?: string;
    pageSize?: number;
  } = {}
): Promise<PaginatedResult<T>> {
  const {
    where,
    orderByField = "createdAt",
    orderDirection = "desc",
    cursor,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  let query = db.collection(collection);

  if (where && Object.keys(where).length > 0) {
    query = query.where(where) as typeof query;
  }

  if (cursor) {
    query = query.where({ _id: db.command.gt(cursor as unknown as number) }) as typeof query;
  }

  const result = await query.orderBy(orderByField, orderDirection).limit(pageSize).get();
  const items = (result.data ?? []) as T[];
  const hasMore = items.length === pageSize;
  const nextCursor = hasMore
    ? (items[items.length - 1] as Record<string, unknown>)?._id as string | undefined
    : undefined;

  return { items, hasMore, nextCursor };
}
