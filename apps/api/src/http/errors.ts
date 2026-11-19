import { z } from '@hono/zod-openapi';

export const ErrorSchema = z
    .object({
        code: z.string().openapi({ example: 'invalid_input' }),
        message: z.string().openapi({ example: 'Request validation failed' }),
        fields: z.record(z.string(), z.string()).optional(),
    })
    .openapi('Error');

export const errorResponse = (
    code: string,
    message: string,
    fields?: Record<string, string>,
) => ({
    code,
    message,
    ...(fields ? { fields } : {}),
});

export const errorContent = (description: string) => ({
    content: { 'application/json': { schema: ErrorSchema } },
    description,
});
