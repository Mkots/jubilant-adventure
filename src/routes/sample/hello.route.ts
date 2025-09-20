import type { Route } from '../routerTypes';

export const hello: Route = (_data, cb) => {
    cb(406, { message: 'Hello' });
};
