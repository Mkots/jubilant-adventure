export function isEmpty(obj: Object): boolean {
    // noinspection LoopStatementThatDoesntLoopJS
    for (let _ in obj) {
        return false;
    }
    return true;
}
