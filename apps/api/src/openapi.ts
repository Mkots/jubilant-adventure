type RouteEntry = {
    method: string;
    path: string;
};

type RouteApp = {
    routes: RouteEntry[];
};

type OpenApiDocument = {
    paths?: unknown;
};

const businessPrefixes = ['/auth', '/products', '/cart', '/orders'];

const toOpenApiPath = (path: string): string =>
    path.replace(/:([^/]+)/g, '{$1}');

export const assertBusinessRoutesDocumented = (
    app: RouteApp,
    document: OpenApiDocument,
): void => {
    const documentedPaths = (document.paths ?? {}) as Record<
        string,
        Record<string, unknown>
    >;
    const missing = app.routes
        .filter((route) =>
            businessPrefixes.some(
                (prefix) =>
                    route.path === prefix ||
                    route.path.startsWith(`${prefix}/`),
            ),
        )
        .map((route) => ({
            method: route.method.toLowerCase(),
            path: toOpenApiPath(route.path),
        }))
        .filter(({ method, path }) => !documentedPaths[path]?.[method]);

    if (missing.length > 0) {
        throw new Error(
            `Undocumented business routes: ${missing
                .map(({ method, path }) => `${method.toUpperCase()} ${path}`)
                .join(', ')}`,
        );
    }
};
