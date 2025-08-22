import { isEven } from '../src/utils/isEven';

const cases: Array<[number, boolean]> = [
    [2, true],
    [0, true],
    [1, false],
    [-2, true],
    [-1, false],
    [Math.PI, false],
    [50, true],
    [75, false],
];
describe('Check if number is even @S298ffaa1', () => {
    it.each(cases)('The %d is even %p', (number, expected) => {
        expect(isEven(number)).toBe(expected);
    });
});
