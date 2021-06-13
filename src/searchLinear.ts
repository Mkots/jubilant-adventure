export const searchLinear = <T>(arr: Array<T>, el: T): number => {
    for (let i = 0; i < arr.length; i++){
        if(arr[i] === el){
            return i
        }
    }
    return -1
}
