import {Route} from "../routerTypes";

export const hello: Route = (data, cb) => {
    cb(406, {"message": "Hello"})
}

