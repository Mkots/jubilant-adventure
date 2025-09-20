/* eslint-disable no-unused-vars */

import type http from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';

interface RouteData {
    trimmedPath: string;
    queryStringObject: ParsedUrlQuery;
    method?: string;
    headers: http.IncomingHttpHeaders;
    payload: string;
}

type RouteCallback = (statusCode: number, message: unknown) => void;

export type Route = (data: RouteData, cb: RouteCallback) => void;

export type Routes = (routeName: string) => Route;
