import { Hono } from 'hono';

type SampleRequest = {
    trimmedPath: string;
    method: string;
    queryStringObject: Record<string, string>;
    payload: string;
};

export const app = new Hono();

app.get('/sample', (c) => {
    const url = new URL(c.req.url);
    const response: SampleRequest = {
        trimmedPath: url.pathname.replace(/^\/+|\/+$/g, ''),
        method: c.req.method,
        queryStringObject: Object.fromEntries(url.searchParams),
        payload: '',
    };

    return c.json(response, 406);
});

app.get('/sample/hello', (c) => c.json({ message: 'Hello' }, 406));

app.notFound((c) => c.json({ message: 'Not found' }, 404));

export default app;
