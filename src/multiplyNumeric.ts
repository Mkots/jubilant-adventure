export function multiplyNumeric(obj: Object){
    for(let key in obj){
        if( typeof obj[key] === 'number'){
            obj[key] *= 2;
        }
    }
    console.log(obj)
    return obj;
}