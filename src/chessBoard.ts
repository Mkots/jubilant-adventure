export const chessBoard = (size: number = 8) => {
    let board = '';
    for(let i = 0; i < size; i++){
            board += `${''.padStart(size, i % 2 === 0 ? '# ' : ' #')}\n`
    }
    return board.trimEnd();
}
