export const cartApiBaseUrl = 'http://api.test/api';
export const cartUrl = `${cartApiBaseUrl}/cart`;
export const cartItemsUrl = `${cartUrl}/items`;

export interface LabProduct {
    id: string;
    name: string;
    price: { amount: number; currency: string };
}

export interface LabCartItem {
    productId: string;
    product: LabProduct;
    quantity: number;
}

export interface LabCart {
    userId: string;
    items: LabCartItem[];
}

export interface SetCartItemRequest {
    productId: string;
    quantity: number;
}

export const labProduct: LabProduct = {
    id: 'product-1',
    name: 'Comet Mug',
    price: { amount: 1299, currency: 'USD' },
};

export const initialCart: LabCart = {
    userId: 'user-1',
    items: [{ productId: labProduct.id, product: labProduct, quantity: 1 }],
};

export const updatedCart: LabCart = {
    userId: initialCart.userId,
    items: [{ ...initialCart.items[0], quantity: 2 }],
};

export const cloneCart = (cart: LabCart): LabCart => structuredClone(cart);

export const readCart = async (): Promise<LabCart> => {
    const response = await fetch(cartUrl);
    if (!response.ok) {
        throw new Error(
            `GET /cart failed: ${response.status} ${await response.text()}`,
        );
    }
    return response.json() as Promise<LabCart>;
};

export const setCartQuantity = async (
    request: SetCartItemRequest,
): Promise<LabCart> => {
    const response = await fetch(cartItemsUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
    });
    if (!response.ok)
        throw new Error(`POST /cart/items failed: ${response.status}`);
    return response.json() as Promise<LabCart>;
};

export const exerciseCartAction = async (): Promise<{
    initial: LabCart;
    mutation: LabCart;
    afterMutation: LabCart;
}> => {
    const initial = await readCart();
    const mutation = await setCartQuantity({
        productId: labProduct.id,
        quantity: 2,
    });
    const afterMutation = await readCart();
    return { initial, mutation, afterMutation };
};
