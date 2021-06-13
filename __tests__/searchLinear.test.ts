import {searchLinear} from "../src/searchLinear";

// interface City{
//     name: string;
//     population: number
// }

const arrayNumbers: Array<number> = Array.from({length: 10}, (_, i) => i);
const arrayReal: Array<number> = Array.from({length: 10}, (_, i) => i * 0.25);
// const arrayObj: Array<City> = Array.from<unknown, City>({length: 2}, (_, i) => ({name: "N"+i, population: (i+1) * 100}) )
const arrayString = Array.from({length: 10}, (_, i) => "№" + i);
const arrayWithNull = Array.from({length: 10}, (_, i) => i%2 === 0 ? null : i);
const arrayWithUndefined = Array.from({length: 10}, (_, i) => i%2 === 0 ? undefined : i);
const arrayWithSameValues = Array.from({length: 10}, () => 12);

const cases: Array<[Array<any>, any, number]> = [
    [arrayNumbers, 5, 5],
    [arrayReal, 5, -1],
    [arrayReal, 1.75, 7],
    // [arrayObj, {name:"N0", population: 100}, 0],
    [arrayString, "№9", 9],
    [arrayWithNull, null, 0],
    [arrayWithNull, 3, 3],
    [arrayWithUndefined, undefined, 0],
    [arrayWithUndefined, 7, 7],
    [arrayWithSameValues, 12, 0],
]

describe('Linear search is work', () => {
    it.each(cases)('In %p array the %p have %p index', (arr, findEl, expectedIndex ) => {
        expect(searchLinear(arr, findEl)).toBe(expectedIndex)
    })
})
