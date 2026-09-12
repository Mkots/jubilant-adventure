import { describe, expect, it } from 'vitest';
import {
    defaultCatalogQuery,
    parseCatalogQuery,
    toCatalogSearchParams,
    toProductQuery,
} from './queryState';

describe('catalog query state', () => {
    it('normalizes unsupported URL values to API-safe values', () => {
        const query = parseCatalogQuery(
            new URLSearchParams(
                'page=0&pageSize=500&sort=rating&direction=sideways&search=%20',
            ),
        );

        expect(query).toEqual({ ...defaultCatalogQuery, pageSize: 100 });
    });

    it('serializes shareable state without redundant default parameters', () => {
        const query = parseCatalogQuery(
            new URLSearchParams(
                'page=2&pageSize=10&search=keyboard&category=hardware&sort=price&direction=desc',
            ),
        );

        expect(toCatalogSearchParams(query).toString()).toBe(
            'page=2&pageSize=10&search=keyboard&category=hardware&sort=price&direction=desc',
        );
        expect(toProductQuery(query)).toEqual({
            page: 2,
            pageSize: 10,
            search: 'keyboard',
            category: 'hardware',
            sort: 'price',
            direction: 'desc',
        });
    });
});
