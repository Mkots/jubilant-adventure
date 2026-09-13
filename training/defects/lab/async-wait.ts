export const eventually = async (update: () => void): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    update();
};
