import {
    belongsTo,
    createServer,
    Factory,
    hasMany,
    Model,
    RestSerializer,
} from 'miragejs';
import {
    cartApiBaseUrl,
    initialCart,
    type LabCart,
    labProduct,
    type SetCartItemRequest,
} from './cartContract';

interface MirageProduct {
    id: string;
    name: string;
    price: { amount: number; currency: string };
}

interface MirageCartItem {
    productId: string;
    product: MirageProduct;
    quantity: number;
    update: (attributes: { quantity: number }) => void;
}

interface MirageCart {
    userId: string;
    items: { models: MirageCartItem[] };
}

const serializeCart = (record: unknown): LabCart => {
    const cart = record as MirageCart;
    return {
        userId: cart.userId,
        items: cart.items.models.map((item) => ({
            productId: item.productId,
            product: item.product,
            quantity: item.quantity,
        })),
    };
};

export const createMirageCartServer = () => {
    const server = createServer({
        environment: 'test',
        urlPrefix: cartApiBaseUrl,
        models: {
            user: Model.extend({ carts: hasMany() }),
            product: Model,
            cart: Model.extend({
                owner: belongsTo('user'),
                items: hasMany('cartItem'),
            }),
            cartItem: Model.extend({
                cart: belongsTo(),
                product: belongsTo(),
            }),
        },
        factories: {
            user: Factory.extend({
                email: 'user@example.test',
            }),
            product: Factory.extend({
                name: labProduct.name,
                price: labProduct.price,
            }),
        },
        serializers: {
            application: RestSerializer,
            cart: RestSerializer.extend({
                include: ['items'],
                embed: true,
            }),
            cartItem: RestSerializer.extend({
                include: ['product'],
                embed: true,
            }),
        },
        seeds() {},
        routes() {
            this.get('/cart', (schema) => {
                return serializeCart(schema.all('cart').models[0]);
            });
            this.post('/cart/items', (schema, request) => {
                const body = JSON.parse(
                    request.requestBody,
                ) as SetCartItemRequest;
                const cart = schema.all('cart')
                    .models[0] as unknown as MirageCart | null;
                const item = cart?.items.models.find(
                    (candidate) => candidate.productId === body.productId,
                );
                item?.update({ quantity: body.quantity });
                return serializeCart(cart);
            });
        },
    });
    const user = server.create('user', { id: initialCart.userId });
    const product = server.create('product', {
        id: labProduct.id,
        name: labProduct.name,
        price: labProduct.price,
    });
    const cart = server.create('cart', {
        owner: user,
        userId: user.id,
    });
    server.create('cartItem', {
        cart,
        product,
        productId: product.id,
        quantity: 1,
    });
    return server;
};
