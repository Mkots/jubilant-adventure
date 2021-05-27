export function isEmpty(obj: Object): boolean {
    // noinspection LoopStatementThatDoesntLoopJS
    for(let key in obj){
        return false
    }
    return true
}
