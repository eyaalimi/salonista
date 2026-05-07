/**
 * Date-range helpers for the analytics endpoints.
 *
 * Defaults the range to today if missing, and computes the matching
 * "previous period" (same length, immediately before) for delta tiles.
 */

export function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const from = fromStr ? new Date(fromStr) : todayStart;
  const to = toStr ? new Date(toStr) : todayEnd;
  return { from, to };
}

export function previousRange(from: Date, to: Date): { prevFrom: Date; prevTo: Date } {
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { prevFrom, prevTo };
}
