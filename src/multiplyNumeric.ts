export function multiplyNumeric(obj: {[key: string]: any}){
    for(let key in obj){
        if( typeof obj[key] === 'number'){
            obj[key] *= 2;
        }
    }
    return obj;
}
