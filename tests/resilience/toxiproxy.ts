export interface ToxiproxyToxic {
    name: string;
    type: string;
    stream: 'upstream' | 'downstream';
    toxicity: number;
    attributes: Record<string, number>;
}

export interface ToxiproxyProxy {
    name: string;
    listen: string;
    upstream: string;
    enabled: boolean;
    toxics: ToxiproxyToxic[];
}

const adminUrl = (process.env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474').replace(
    /\/$/,
    '',
);
const proxyName = 'payment';
const latencyToxicName = 'payment-latency';

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${adminUrl}${path}`, {
        ...options,
        signal: options?.signal ?? AbortSignal.timeout(5_000),
        headers: {
            accept: 'application/json',
            ...(options?.body ? { 'content-type': 'application/json' } : {}),
            ...options?.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`Toxiproxy HTTP ${response.status} for ${path}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
};

const ignoreMissing = async (path: string): Promise<void> => {
    try {
        await request(path, { method: 'DELETE' });
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('HTTP 404'))
            throw error;
    }
};

export const inspectPaymentProxy = (): Promise<ToxiproxyProxy> =>
    request<ToxiproxyProxy>(`/proxies/${proxyName}`);

export const ensurePaymentProxy = async (): Promise<ToxiproxyProxy> => {
    try {
        const existing = await request<ToxiproxyProxy>(`/proxies/${proxyName}`);
        return existing.enabled
            ? existing
            : request<ToxiproxyProxy>(`/proxies/${proxyName}`, {
                  method: 'POST',
                  body: JSON.stringify({ enabled: true }),
              });
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('HTTP 404'))
            throw error;
        return request<ToxiproxyProxy>('/proxies', {
            method: 'POST',
            body: JSON.stringify({
                name: proxyName,
                listen: '0.0.0.0:8666',
                upstream: 'wiremock:8080',
                enabled: true,
            }),
        });
    }
};

export const addPaymentLatency = async (
    latencyMs = 450,
): Promise<ToxiproxyToxic> => {
    await ignoreMissing(`/proxies/${proxyName}/toxics/${latencyToxicName}`);
    return request<ToxiproxyToxic>(`/proxies/${proxyName}/toxics`, {
        method: 'POST',
        body: JSON.stringify({
            name: latencyToxicName,
            type: 'latency',
            stream: 'downstream',
            toxicity: 1,
            attributes: { latency: latencyMs, jitter: 0 },
        }),
    });
};

export const removePaymentLatency = async (): Promise<void> => {
    try {
        await request(`/proxies/${proxyName}/toxics/${latencyToxicName}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('HTTP 404'))
            throw error;
    }
};

export const cleanupPaymentProxy = async (): Promise<void> => {
    await removePaymentLatency();
    try {
        await request(`/proxies/${proxyName}`, { method: 'DELETE' });
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('HTTP 404'))
            throw error;
    }
};
