export const triangle = (rows: number): string => {
    let i = 1;
    let triangleStr = '';
    while (rows > 0){
        triangleStr += `${'#'.padStart(i, '#')}\n`;
        i++;
        rows--;
    }
    return triangleStr.trimEnd();
}
