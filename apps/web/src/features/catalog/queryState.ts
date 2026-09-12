import type { ProductQuery } from './catalogApi';

export const defaultCatalogQuery = {
    page: 1,
    pageSize: 20,
    sort: 'name',
    direction: 'asc',
} as const satisfies ProductQuery;

export type CatalogQueryState = Omit<ProductQuery, 'sort' | 'direction'> & {
    sort: NonNullable<ProductQuery['sort']>;
    direction: NonNullable<ProductQuery['direction']>;
};

const positiveInteger = (value: string | null, fallback: number): number => {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const parseCatalogQuery = (
    searchParams: URLSearchParams,
): CatalogQueryState => {
    const sort = searchParams.get('sort');
    const direction = searchParams.get('direction');
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category')?.trim();

    return {
        page: positiveInteger(
            searchParams.get('page'),
            defaultCatalogQuery.page,
        ),
        pageSize: Math.min(
            100,
            positiveInteger(
                searchParams.get('pageSize'),
                defaultCatalogQuery.pageSize,
            ),
        ),
        ...(search ? { search } : {}),
        ...(category ? { category } : {}),
        ...(sort === 'name' || sort === 'price' || sort === 'stock'
            ? { sort }
            : { sort: defaultCatalogQuery.sort }),
        ...(direction === 'desc' ? { direction } : { direction: 'asc' }),
    };
};

export const toCatalogSearchParams = (
    query: CatalogQueryState,
): URLSearchParams => {
    const params = new URLSearchParams();
    if (query.page !== defaultCatalogQuery.page) {
        params.set('page', String(query.page));
    }
    if (query.pageSize !== defaultCatalogQuery.pageSize) {
        params.set('pageSize', String(query.pageSize));
    }
    if (query.search) params.set('search', query.search);
    if (query.category) params.set('category', query.category);
    if (query.sort !== defaultCatalogQuery.sort) params.set('sort', query.sort);
    if (query.direction !== defaultCatalogQuery.direction) {
        params.set('direction', query.direction);
    }
    return params;
};

export const toProductQuery = (query: CatalogQueryState): ProductQuery => ({
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.sort !== defaultCatalogQuery.sort ? { sort: query.sort } : {}),
    ...(query.direction !== defaultCatalogQuery.direction
        ? { direction: query.direction }
        : {}),
});
