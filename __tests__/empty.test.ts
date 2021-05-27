import { isEmpty } from "../src/isEmpty";
import { isEmpty as isEmpty2 } from "../src/isEmpty2";
import { multiplyNumeric } from "../src/multiplyNumeric";

describe('isEmpty function should work correctly', () => {
    it('Return true if object is empty', () => {
        const obj = {};
        expect(isEmpty(obj)).toBe(true)
        expect(isEmpty2(obj)).toBe(true)
    });

    it('Return false if object is not empty', () => {
        const obj = {a: '1'};
        expect(isEmpty(obj)).toBe(false)
        expect(isEmpty2(obj)).toBe(false)
    })

    it('Return false if object is "{null: undefined}"', () => {
        const obj = {null: undefined};
        expect(isEmpty(obj)).toBe(false)
        expect(isEmpty2(obj)).toBe(false)
    })

    it('Multiply two every number value', () => {
        const obj = {a: 1, b: '2', c: 2};
        expect(multiplyNumeric(obj)).toStrictEqual({a: 2, b: '2', c: 4})
    })
})
