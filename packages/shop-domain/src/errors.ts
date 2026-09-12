export type DomainErrorCode =
    | 'invalid_credentials'
    | 'invalid_input'
    | 'not_found'
    | 'forbidden'
    | 'conflict'
    | 'insufficient_stock'
    | 'empty_cart'
    | 'invalid_transition';

export class DomainError extends Error {
    public readonly code: DomainErrorCode;
    public readonly details?: Record<string, string>;

    public constructor(
        code: DomainErrorCode,
        message: string,
        details?: Record<string, string>,
    ) {
        super(message);
        this.name = 'DomainError';
        this.code = code;
        this.details = details;
    }
}

export const invalidCredentials = (): DomainError =>
    new DomainError('invalid_credentials', 'Invalid email or password');

export const invalidInput = (
    message: string,
    details?: Record<string, string>,
): DomainError => new DomainError('invalid_input', message, details);

export const notFound = (resource: string): DomainError =>
    new DomainError('not_found', `${resource} was not found`);

export const forbidden = (message = 'Access denied'): DomainError =>
    new DomainError('forbidden', message);

export const conflict = (message: string): DomainError =>
    new DomainError('conflict', message);

export const insufficientStock = (productId: string): DomainError =>
    new DomainError('insufficient_stock', 'Requested quantity exceeds stock', {
        productId,
    });

export const emptyCart = (): DomainError =>
    new DomainError('empty_cart', 'The cart is empty');

export const invalidTransition = (from: string, to: string): DomainError =>
    new DomainError(
        'invalid_transition',
        `Cannot transition an order from ${from} to ${to}`,
    );
