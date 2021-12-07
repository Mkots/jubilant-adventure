import { min } from "../src/utils/min";
const cases = [[1, 2, 1], [3, 3, 3], [0, -1, -1], [Math.PI, 2, 2], [Math.PI, 4, Math.PI]];
describe('Find minimal function @S8972e0de', () => {
  it.each(cases)('between %d and %d — %d is minimal', (a, b, expected) => {
    expect(min(a, b)).toBe(expected);
  });
});
