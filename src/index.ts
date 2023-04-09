import http from "http";
import url from "url";
import {StringDecoder} from "string_decoder";
import {routes} from "./routes/mainRouter";

const server = http.createServer((req, res) => {

    const {url: reqUrl, method, headers} = req;

    const parsedUrl = url.parse(reqUrl || '', true);
    const path = parsedUrl.path;
    const trimmedPath = path?.replace(/^\/+|\/+$/g, '') || '';

    const queryStringObject = parsedUrl.query;

    const decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', (data) => {
        buffer += decoder.write(data)
    })

    req.on('end', () => {
        buffer += decoder.end();

        const chosenRoute = routes(trimmedPath);

        chosenRoute({
            trimmedPath,
            headers,
            method,
            queryStringObject,
            payload: buffer
        }, (statusCode, payload) => {
            payload = typeof payload === 'object' ? payload : {};

            const payloadString = JSON.stringify(payload, null, 2)

            res.writeHead(statusCode);
            res.end(payloadString);
        })

    })

})

server.listen(3000, () => {
    // eslint-disable-next-line no-console,no-undef
    console.log('Server is listening...')
})

