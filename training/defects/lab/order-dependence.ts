export const makeFixture = (): { count: number } => ({ count: 0 });

export const increment = (fixture: { count: number }): void => {
    fixture.count += 1;
};
