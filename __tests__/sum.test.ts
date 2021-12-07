import {sum} from "../src/utils/sum";

const cases: Array<[number[], number]> =
    [
        [[1, 2, 3], 6],
        [[-1, 0, 1], 0],
        [[], 0],
        [Array.from({length: 101}, (_, i) => i), 5050]
    ];
describe('The sum function is work correctly @Sbe0c0546', () => {
    it.each(cases)('sum of %p is %d ', (nums, expected) => {
        expect(sum(...nums)).toBe(expected);
    });
});
