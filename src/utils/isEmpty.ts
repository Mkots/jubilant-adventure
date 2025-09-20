export function isEmpty(obj: Record<string, unknown>): boolean {
    return Object.values(obj).length <= 0;
}
