export const countChar = (str: string, char: string): number => {
    return Array.from(str).filter((value) => value === char).length;
};
