import { countChar } from '../src/utils/countChar';

const cases: Array<[string, number, string]> = [
    ['abba', 2, 'a'],
    ['AbBa', 1, 'B'],
    ['ABBA', 0, 'a'],
    ['a.b', 1, '.'],
];

describe('Count char in string function @Sbceb3387', () => {
    it.each(cases)('The string %p has %d %p', (str, expected, char) => {
        expect(countChar(str, char)).toBe(expected);
    });
});
