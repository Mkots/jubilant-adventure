import {fizzBuzz} from "../src/utils/fizzBuzz";

const fb = fizzBuzz();
const cases: Array<[number, string | number]> =
    [
        [3, 'Fizz'],
        [9, 'Fizz'],
        [5, 'Buzz'],
        [50, 'Buzz'],
        [15, 'FizzBuzz'],
        [30, 'FizzBuzz'],
        [60, 'FizzBuzz'],
        [90, 'FizzBuzz'],
        [19, 19],
        [13, 13],
        [98, 98],
        [83, 83]
    ];
describe('FizzBuzz test @S94b12020', () => {
    it.each(cases)('%i replaced to %s', (num, expected) => {
        expect(fb[num]).toBe(expected);
    });
});
