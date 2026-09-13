const sensitiveKeyPattern =
    /(authorization|cookie|credential|password|passcode|secret|token|api.?key|client.?secret|card|cvv|cvc|(^|[_-])pan($|[_-])|request.?body|(^|[_-])body($|[_-]))/i;

const MAX_DEPTH = 4;
const MAX_KEYS = 32;
const MAX_ARRAY_ITEMS = 32;
const MAX_STRING_LENGTH = 512;

const clipped = (value: string): string =>
    value.length > MAX_STRING_LENGTH
        ? `${value.slice(0, MAX_STRING_LENGTH)}...`
        : value;

export const redactSensitive = (
    value: unknown,
    depth = 0,
    seen = new WeakSet<object>(),
): unknown => {
    if (typeof value === 'string') return clipped(value);
    if (value === null || typeof value !== 'object') return value;
    if (depth >= MAX_DEPTH) return '[truncated]';
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    if (Array.isArray(value)) {
        return value
            .slice(0, MAX_ARRAY_ITEMS)
            .map((item) => redactSensitive(item, depth + 1, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
        result[key] = sensitiveKeyPattern.test(key)
            ? '[redacted]'
            : redactSensitive(item, depth + 1, seen);
    }
    return result;
};

export const safeSerialize = (value: unknown): string => {
    try {
        return JSON.stringify(redactSensitive(value)) ?? 'null';
    } catch {
        return '"[unserializable]"';
    }
};

export const redactHeaders = (
    headers: Headers | Record<string, string | undefined>,
): Record<string, string> => {
    const entries =
        headers instanceof Headers
            ? [...headers.entries()]
            : Object.entries(headers).filter(
                  (entry): entry is [string, string] =>
                      typeof entry[1] === 'string',
              );
    return Object.fromEntries(
        entries
            .slice(0, MAX_KEYS)
            .map(([key, value]) => [
                key.toLowerCase(),
                sensitiveKeyPattern.test(key) ? '[redacted]' : clipped(value),
            ]),
    );
};

export const normalizeRoute = (pathname: string): string => {
    const segments = pathname.split('/').filter(Boolean).slice(0, 8);
    return `/${segments
        .map((segment) =>
            /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment) ||
            /^\d+$/.test(segment) ||
            segment.length > 32
                ? ':id'
                : segment,
        )
        .join('/')}`;
};
