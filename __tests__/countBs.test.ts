import { countBs } from '../src/utils/countBs';

const cases: Array<[string, number]> = [
    ['aBBa', 2],
    ['abba', 0],
    ['BBBBBBBBBB', 10],
    ['Русская буква В', 0],
];

describe('Count "B" letter in string @S13a0fb46', () => {
    it.each(cases)('%p has %d letters "B"', (str, expected) => {
        expect(countBs(str)).toBe(expected);
    });
});
