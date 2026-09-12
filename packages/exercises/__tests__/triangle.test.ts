import { triangle } from '../src/utils/triangle';

const sevenRowTriangle = `#
##
###
####
#####
######
#######`;
describe('Test draw triangle function @S131f0cac', () => {
    it('Draw triangle with 7 rows @Tc06ac5b3', () => {
        expect(triangle(7)).toBe(sevenRowTriangle);
    });
});
