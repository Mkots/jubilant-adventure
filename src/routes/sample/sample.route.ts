import type { Route } from '../routerTypes';

export const sample: Route = (data, cb) => {
    cb(406, data);
};
