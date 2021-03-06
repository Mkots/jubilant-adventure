import {ParsedUrlQuery} from "querystring";
import http from "http";

interface RouteData {
    trimmedPath: string;
    queryStringObject: ParsedUrlQuery;
    method?: string;
    headers: http.IncomingHttpHeaders;
    payload: string
}

type RouteCallback = (statusCode: number, message: any) => void;

export type Route = (data: RouteData, cb: RouteCallback) => void;

export type Routes = (routeName: string) => Route
