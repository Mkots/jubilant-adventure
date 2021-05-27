import {countChar} from "../src/countChar";

const cases: Array<[string, number, string]> = [
    ["abba", 2, "a"],
    ["AbBa", 1, "B"],
    ["ABBA", 0, "a"]
];

describe('Count char in string function', () => {
    it.each(cases)('The string %p has %d %p', (str, expected, char) => {
        expect(countChar(str, char)).toBe(expected)
    })
})
