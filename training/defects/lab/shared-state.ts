const seen = new Set<string>();

export const remember = (value: string): boolean => {
    const first = !seen.has(value);
    seen.add(value);
    return first;
};

export const reset = (): void => seen.clear();
