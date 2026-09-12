import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
    cartItemsUrl,
    cartUrl,
    cloneCart,
    initialCart,
    updatedCart,
} from './cartContract';

export const mswCartHandlers = [
    http.get(cartUrl, () => HttpResponse.json(cloneCart(initialCart))),
    http.post(cartItemsUrl, () => HttpResponse.json(cloneCart(updatedCart))),
];

export const mswCartServer = setupServer(...mswCartHandlers);
