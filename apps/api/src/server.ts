import http from 'node:http';
import { StringDecoder } from 'node:string_decoder';
import { routes } from './routes/mainRouter';

export const createServer = (): http.Server =>
    http.createServer((req, res) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const trimmedPath = requestUrl.pathname.replace(/^\/+|\/+$/g, '');
        const queryStringObject = Object.fromEntries(requestUrl.searchParams);
        const decoder = new StringDecoder('utf-8');
        let buffer = '';

        req.on('data', (data) => {
            buffer += decoder.write(data);
        });

        req.on('end', () => {
            buffer += decoder.end();

            routes(trimmedPath)(
                {
                    trimmedPath,
                    headers: req.headers,
                    method: req.method,
                    queryStringObject,
                    payload: buffer,
                },
                (statusCode, payload) => {
                    const responsePayload =
                        typeof payload === 'object' && payload !== null
                            ? payload
                            : {};

                    res.writeHead(statusCode, {
                        'content-type': 'application/json; charset=utf-8',
                    });
                    res.end(JSON.stringify(responsePayload, null, 2));
                },
            );
        });
    });
