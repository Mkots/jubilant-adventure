const board = `# # # # 
 # # # #
# # # # 
 # # # #
# # # # 
 # # # #
# # # # 
 # # # #`;

const smallBoard = `# 
 #`

import {chessBoard} from "../src/chessBoard";

describe('ChessBoard', () => {
    it('ChessBoard with default arguments 8x8', () => {
        expect(chessBoard()).toBe(board)
    })
    it('ChessBoard 2x2', () => {
    expect(chessBoard(2)).toBe(smallBoard)
    })
})
