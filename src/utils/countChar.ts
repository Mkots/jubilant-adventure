export const countChar = (str: string, char: string): number => {
    const search = new RegExp(`[${[char]}]`, 'gm');
    return str.match(search)?.length || 0;
};
