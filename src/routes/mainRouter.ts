import {Route, Routes} from "./routerTypes";
import {hello, sample} from "./sample";


const notFound: Route = (data, cb) => {
    cb(404, {'message': 'Not found'})
}

const routeMap = new Map<string, Route>([
    ['sample', sample],
    ['sample/hello', hello]
])

export const routes: Routes = (routeName) => {
    return routeMap.get(routeName) || notFound
}


