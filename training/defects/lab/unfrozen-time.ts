export const expiresSoon = (createdAt: Date, ttlMs: number): boolean =>
    Date.now() - createdAt.getTime() >= ttlMs;
