const board = `# # # # 
 # # # #
# # # # 
 # # # #
# # # # 
 # # # #
# # # # 
 # # # #`;
const smallBoard = `# 
 #`;
import { chessBoard } from "../src/utils/chessBoard";
describe('ChessBoard @S5738ec49', () => {
  it('ChessBoard with default arguments 8x8 @T83c50a94', () => {
    expect(chessBoard()).toBe(board);
  });
  it('ChessBoard 2x2 @T99f181a9', () => {
    expect(chessBoard(2)).toBe(smallBoard);
  });
});
