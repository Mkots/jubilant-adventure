import {range} from "../src/range";

const cases: number[][][] = [
    [[1,4], [1,2,3]],
    [[1,8,2], [1,3,5,7]],
    [[4,1,-1], [4,3,2]],
    [[1, 10, 2],  [1, 3, 5, 7, 9]],
    [[5, 2, -1], [5, 4, 3]],
    [[10, 10, 20], []]

]

describe('Range function is work', () => {
    it.each(cases)('range of %p is %p', (params, expected) => {
        expect(range(params[0], params[1], params[2])).toStrictEqual(expected)
    })
})
