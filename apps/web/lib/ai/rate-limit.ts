const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function isRateLimited(userId: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record) {
    rateLimitMap.set(userId, { count: 1, lastReset: now });
    return false;
  }

  if (now - record.lastReset > windowMs) {
    rateLimitMap.set(userId, { count: 1, lastReset: now });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  record.count++;
  return false;
}
