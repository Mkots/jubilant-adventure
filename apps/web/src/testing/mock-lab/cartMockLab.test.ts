import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import { exerciseCartAction, readCart } from './cartContract';
import { createMirageCartServer } from './mirageCartServer';
import { mswCartServer } from './mswCartScenario';

describe('MSW response mock', () => {
    beforeAll(() => {
        mswCartServer.listen({ onUnhandledRequest: 'error' });
    });

    afterEach(() => {
        mswCartServer.resetHandlers();
    });

    afterAll(() => {
        mswCartServer.close();
    });

    it('expresses the same fetch action with fixed responses', async () => {
        const result = await exerciseCartAction();

        expect(result.initial.items[0].quantity).toBe(1);
        expect(result.mutation.items[0].quantity).toBe(2);
        expect(result.afterMutation.items[0].quantity).toBe(1);
    });

    it('starts the next scenario from the same response fixture', async () => {
        expect((await readCart()).items[0].quantity).toBe(1);
    });
});

describe('Mirage stateful fake', () => {
    let server: ReturnType<typeof createMirageCartServer>;

    beforeEach(() => {
        server = createMirageCartServer();
    });

    afterEach(() => {
        server.shutdown();
    });

    it('persists a mutation through the same fetch action', async () => {
        const result = await exerciseCartAction();

        expect(result.initial.items[0].quantity).toBe(1);
        expect(result.mutation.items[0].quantity).toBe(2);
        expect(result.afterMutation.items[0].quantity).toBe(2);
    });

    it('resets models and relationships before the next scenario', async () => {
        expect((await readCart()).items[0].quantity).toBe(1);
    });
});
