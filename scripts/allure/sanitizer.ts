import {
    copyFile,
    mkdir,
    readdir,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { resolveWithin } from '../lib/safe-path.mjs';

const sensitiveKey =
    /(authorization|cookie|set-cookie|password|passwd|secret|token|credential|api[-_]?key|session)/i;
const bearer = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const cookie = /((?:cookie|set-cookie)\s*[:=]\s*)([^\s;]+)/gi;
const jsonSecret =
    /("(?:password|token|secret|authorization|cookie|apiKey)"\s*:\s*")([^"]*)(")/gi;

export const REDACTED = '[REDACTED]';

export const sanitizeText = (value: string): string =>
    value
        .replace(bearer, `Bearer ${REDACTED}`)
        .replace(cookie, `$1${REDACTED}`)
        .replace(jsonSecret, `$1${REDACTED}$3`)
        .replace(
            /dummy-(?:access-token|secret-password|cookie-value)/gi,
            REDACTED,
        )
        .replace(/canary-(?:token|secret|password)/gi, REDACTED);

export const sanitizeUrl = (value: string): string => {
    try {
        const url = new URL(value);
        for (const key of url.searchParams.keys()) {
            if (sensitiveKey.test(key)) url.searchParams.set(key, REDACTED);
        }
        if (url.username || url.password) {
            url.username = REDACTED;
            url.password = REDACTED;
        }
        return sanitizeText(url.toString());
    } catch {
        return sanitizeText(value);
    }
};

type HeaderInput =
    | Record<string, unknown>
    | Array<[string, unknown]>
    | { entries: () => Iterable<[string, string]> };

export const sanitizeHeaders = (
    headers: HeaderInput,
): Record<string, string> => {
    const entriesMethod = (headers as { entries?: unknown }).entries;
    const entries =
        typeof entriesMethod === 'function'
            ? [...(entriesMethod as () => Iterable<[string, string]>)()]
            : Array.isArray(headers)
              ? headers
              : Object.entries(headers);
    return Object.fromEntries(
        entries.map(([key, value]) => [
            key,
            sensitiveKey.test(key) ? REDACTED : sanitizeText(String(value)),
        ]),
    );
};

export const sanitizeValue = (value: unknown, key?: string): unknown => {
    if (key && sensitiveKey.test(key)) return REDACTED;
    if (typeof value === 'string') {
        return key?.toLowerCase().includes('url')
            ? sanitizeUrl(value)
            : sanitizeText(value);
    }
    if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([childKey, childValue]) => [
                childKey,
                sanitizeValue(childValue, childKey),
            ]),
        );
    }
    return value;
};

export interface ApiExchange {
    request: {
        method: string;
        url: string;
        headers?: HeaderInput;
        body?: unknown;
    };
    response: {
        status: number;
        headers?: HeaderInput;
        body?: unknown;
    };
}

export const sanitizeApiExchange = (exchange: ApiExchange): ApiExchange => ({
    request: {
        ...exchange.request,
        url: sanitizeUrl(exchange.request.url),
        headers: exchange.request.headers
            ? sanitizeHeaders(exchange.request.headers)
            : undefined,
        body: sanitizeValue(exchange.request.body),
    },
    response: {
        ...exchange.response,
        headers: exchange.response.headers
            ? sanitizeHeaders(exchange.response.headers)
            : undefined,
        body: sanitizeValue(exchange.response.body),
    },
});

const isTextAttachment = (name: string, contentType?: string): boolean =>
    Boolean(
        contentType?.includes('json') ||
            contentType?.startsWith('text/') ||
            /\.(json|txt|xml|log|html|csv)$/i.test(name),
    );

type AttachmentDescriptor = {
    source?: string;
    type?: string;
    name?: string;
};

type AllureResult = { attachments?: AttachmentDescriptor[] };

export const sanitizeAllureResults = async (
    inputDir: string,
    outputDir: string,
): Promise<{ results: number; attachments: number }> => {
    const safeInputDir = resolveWithin(
        process.cwd(),
        inputDir,
        'Allure input directory',
    );
    const safeOutputDir = resolveWithin(
        process.cwd(),
        outputDir,
        'Allure output directory',
    );
    await rm(safeOutputDir, { recursive: true, force: true });
    await mkdir(safeOutputDir, { recursive: true });
    const names = await readdir(safeInputDir).catch(() => []);
    const descriptors = await Promise.all(
        names
            .filter((name) => name.endsWith('-result.json'))
            .map(
                async (name) =>
                    JSON.parse(
                        await readFile(join(safeInputDir, name), 'utf8'),
                    ) as AllureResult,
            ),
    );
    let results = 0;
    let attachments = 0;
    for (const name of names) {
        const source = join(safeInputDir, name);
        const destination = join(safeOutputDir, name);
        if (name.endsWith('-result.json') || name.endsWith('-container.json')) {
            const parsed = JSON.parse(await readFile(source, 'utf8')) as Record<
                string,
                unknown
            >;
            await writeFile(
                destination,
                `${JSON.stringify(sanitizeValue(parsed), null, 2)}\n`,
            );
            results += 1;
            continue;
        }
        const descriptor = descriptors
            .flatMap((result) => result.attachments ?? [])
            .find((attachment) => attachment.source === name);
        if (
            descriptor &&
            isTextAttachment(descriptor.name ?? name, descriptor.type)
        ) {
            await writeFile(
                destination,
                sanitizeText(await readFile(source, 'utf8')),
            );
        } else {
            await copyFile(source, destination);
        }
        attachments += 1;
    }
    return { results, attachments };
};
