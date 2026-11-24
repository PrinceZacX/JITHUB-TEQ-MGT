/**
 * Database query timeout utility
 * Prevents hanging queries when database is unreachable
 */

export const DB_QUERY_TIMEOUT_MS = 10000;

export class DatabaseTimeoutError extends Error {
  constructor(message = 'Database query timed out') {
    super(message);
    this.name = 'DatabaseTimeoutError';
  }
}

/**
 * Wraps a promise with a timeout
 * Drizzle query builders are thenables, so we wrap in Promise.resolve()
 */
export async function withDbTimeout<T>(
  queryBuilder: Promise<T> | { then: (onfulfilled: (value: T) => any) => any },
  timeoutMs = DB_QUERY_TIMEOUT_MS,
  timeoutError = new DatabaseTimeoutError(),
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
  });
  try {
    // Wrap in Promise.resolve to handle Drizzle's thenable query builders
    return await Promise.race([Promise.resolve(queryBuilder), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Helper to safely execute multiple queries with timeout
 */
export async function executeWithTimeout<T>(
  queries: (() => Promise<T> | { then: (onfulfilled: (value: T) => any) => any })[],
  timeoutMs = DB_QUERY_TIMEOUT_MS,
): Promise<T[]> {
  const results: T[] = [];
  for (const query of queries) {
    results.push(await withDbTimeout(query(), timeoutMs));
  }
  return results;
}
