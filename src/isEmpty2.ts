export function isEmpty(obj: Object): boolean {
    for(let key in obj){
        return false
    }
    return true
}