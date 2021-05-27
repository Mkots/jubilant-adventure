import {triangle} from "../src/triangle";

const sevenRowTriangle = `#
##
###
####
#####
######
#######`

describe('Test draw triangle function', () => {
    it('Draw triangle with 7 rows', () => {
        expect(triangle(7)).toBe(sevenRowTriangle)
    })
})
