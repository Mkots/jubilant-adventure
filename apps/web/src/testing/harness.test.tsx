import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiUrl, fixtureProduct } from './mocks/handlers';
import { scenarioHandlers } from './mocks/scenarios';
import { server } from './mocks/server';
import { NetworkProbe } from './NetworkProbe';
import { renderWithProviders } from './renderWithProviders';

describe('frontend test harness', () => {
    it('connects an accessible component to the real Redux and MSW boundary', async () => {
        const view = renderWithProviders(<NetworkProbe />);

        expect(
            await screen.findByText('Loaded 1 products'),
        ).toBeInTheDocument();
        expect(screen.getByRole('listitem')).toHaveTextContent('Comet Mug');

        await view.user.click(
            screen.getByRole('button', { name: 'Refresh products' }),
        );
        expect(view.store.getState().api.queries).toHaveProperty(
            'getProductsForHarness(undefined)',
        );
    });

    it.each([
        ['empty', 'Loaded 0 products'],
        ['validationError', 'Invalid catalog query'],
        ['unauthorized', 'Authentication is required'],
        ['forbidden', 'Access denied'],
        ['serverError', 'Internal server error'],
    ] as const)(
        'supports the named %s response override',
        async (name, text) => {
            server.use(scenarioHandlers[name]);
            renderWithProviders(<NetworkProbe />);

            const result =
                name === 'empty'
                    ? await screen.findByText('Loaded 0 products')
                    : await screen.findByRole('alert');
            expect(result).toHaveTextContent(text);
        },
    );

    it('isolates stores and query caches between tests', async () => {
        const first = renderWithProviders(<NetworkProbe />);
        expect(
            await screen.findByText('Loaded 1 products'),
        ).toBeInTheDocument();
        first.unmount();

        const second = renderWithProviders(<NetworkProbe />);
        expect(
            await screen.findByText('Loaded 1 products'),
        ).toBeInTheDocument();
        expect(second.store).not.toBe(first.store);
        expect(second.store.getState().session.user).toBeNull();
        expect(Object.keys(second.store.getState().api.queries)).toHaveLength(
            1,
        );
        expect(
            screen.queryByText('first-test-only-node'),
        ).not.toBeInTheDocument();
    });

    it('fails an unhandled request with method and URL', async () => {
        const response = await fetch(apiUrl('/unknown'));
        expect(response.status).toBe(500);
        await expect(response.text()).resolves.toMatch(
            /Unhandled GET request to http:\/\/api\.test\/api\/unknown/,
        );
    });

    it('accepts a per-test handler override without changing the baseline', async () => {
        server.use(
            http.get(apiUrl('/products'), () =>
                HttpResponse.json({
                    items: [{ ...fixtureProduct, name: 'Per-test product' }],
                    total: 1,
                    page: 1,
                    pageSize: 20,
                    totalPages: 1,
                }),
            ),
        );

        renderWithProviders(<NetworkProbe />);
        expect(await screen.findByRole('listitem')).toHaveTextContent(
            'Per-test product',
        );
    });
});
