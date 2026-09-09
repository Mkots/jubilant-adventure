export const range = (
    start: number,
    stop: number,
    step: number = 1,
): Array<number> => {
    if (step === 0) {
        throw new RangeError('Step cannot be zero');
    }

    let length = Math.max(Math.ceil((stop - start) / step), 0);
    const arr: Array<number> = [];

    while (length--) {
        arr.push(start);
        start += step;
    }
    return arr;
};
