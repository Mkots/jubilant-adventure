import { Vector } from '../src/utils/Vector';

describe('Vector', () => {
    test('add', () => {
        const v1 = new Vector(1, 2);
        const v2 = new Vector(2, 3);
        const result = v1.add(v2);
        expect(result).toEqual(new Vector(3, 5));
    });

    test('sub', () => {
        const v1 = new Vector(1, 2);
        const v2 = new Vector(2, 3);
        const result = v1.sub(v2);
        expect(result).toEqual(new Vector(-1, -1));
    });

    test('scaleBy', () => {
        const v1 = new Vector(1, 2);
        const result = v1.scaleBy(2);
        expect(result).toEqual(new Vector(2, 4));
    });

    test('dotProduct', () => {
        const v1 = new Vector(1, 2);
        const v2 = new Vector(2, 3);
        const result = v1.dotProduct(v2);
        expect(result).toBe(8);
    });

    test('normalize', () => {
        const v1 = new Vector(3, 4);
        const result = v1.normalize();
        const expected = new Vector(0.6, 0.8);
        expect(result.x).toBeCloseTo(expected.x);
        expect(result.y).toBeCloseTo(expected.y);
    });

    test('haveSameDirectionWith', () => {
        const v1 = new Vector(1, 0);
        const v2 = new Vector(2, 0);
        const result = v1.haveSameDirectionWith(v2);
        expect(result).toBe(true);
    });

    test('haveOppositeDirectionWith', () => {
        const v1 = new Vector(1, 0);
        const v2 = new Vector(-1, 0);
        const result = v1.haveOppositeDirectionWith(v2);
        expect(result).toBe(true);
    });

    test('isPerpendicular', () => {
        const v1 = new Vector(1, 0);
        const v2 = new Vector(0, 1);
        const result = v1.isPerpendicular(v2);
        expect(result).toBe(true);
    });

    test('angleBetween', () => {
        const v1 = new Vector(1, 0);
        const v2 = new Vector(0, 1);
        const result = v1.angleBetween(v2);
        expect(result).toBeCloseTo(90);
    });

    test('isEqualTo', () => {
        const v1 = new Vector(1, 2);
        const v2 = new Vector(1, 2);
        const result = v1.isEqualTo(v2);
        expect(result).toBe(true);
    });
});
