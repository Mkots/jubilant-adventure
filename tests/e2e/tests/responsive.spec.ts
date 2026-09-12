import { expect, test } from '../fixtures/test';

test.describe('responsive browser projects', () => {
    test('uses the viewport configured for the current project', async ({
        page,
    }) => {
        const viewport = page.viewportSize();

        expect(viewport).not.toBeNull();

        if (test.info().project.name === 'chromium-mobile') {
            expect(viewport).toEqual({ width: 393, height: 727 });
        } else {
            expect(viewport).toEqual({ width: 1440, height: 900 });
        }
    });
});
