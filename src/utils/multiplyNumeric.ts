export function multiplyNumeric(obj: { [key: string]: unknown }) {
    for (const key in obj) {
        if (typeof obj[key] === 'number') {
            obj[key] *= 2;
        }
    }
    return obj;
}
