import { isEmpty } from '../src/utils/isEmpty';
import { isEmpty as isEmpty2 } from '../src/utils/isEmpty2';
import { multiplyNumeric } from '../src/utils/multiplyNumeric';
describe('isEmpty function should work correctly @S74ed2673', () => {
    it('Return true if object is empty @Ta9544ce2', () => {
        const obj = {};
        expect(isEmpty(obj)).toBe(true);
        expect(isEmpty2(obj)).toBe(true);
    });
    it('Return false if object is not empty @T5962a485', () => {
        const obj = {
            a: '1',
        };
        expect(isEmpty(obj)).toBe(false);
        expect(isEmpty2(obj)).toBe(false);
    });
    it('Return false if object is "{null: undefined}" @T0cf21606', () => {
        const obj = {
            null: undefined,
        };
        expect(isEmpty(obj)).toBe(false);
        expect(isEmpty2(obj)).toBe(false);
    });
    it('Multiply two every number value @T515b384c', () => {
        const obj = {
            a: 1,
            b: '2',
            c: 2,
        };
        expect(multiplyNumeric(obj)).toStrictEqual({
            a: 2,
            b: '2',
            c: 4,
        });
    });
});
