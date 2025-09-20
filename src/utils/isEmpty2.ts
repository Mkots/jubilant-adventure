export function isEmpty(obj: Record<string, unknown>): boolean {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const _ in obj) {
        return false;
    }
    return true;
}
