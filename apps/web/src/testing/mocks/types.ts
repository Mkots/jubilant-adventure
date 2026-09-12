import type { paths } from '@jubilant-adventure/api-client';

export type ProductList =
    paths['/products']['get']['responses'][200]['content']['application/json'];
