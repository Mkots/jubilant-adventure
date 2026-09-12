export const sum = (...nums: Array<number>): number => {
    return nums.reduce((acc, cur) => acc + cur, 0);
};
