import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3412';
const CONTROL_KEY = __ENV.TEST_CONTROL_KEY || 'performance-control';
const RUN_ID = __ENV.K6_RUN_ID || 'local-run';
const PROFILE = __ENV.K6_PROFILE || 'smoke';
const USER_EMAIL = 'user@example.test';
const USER_PASSWORD = 'password';
const NOTEBOOK_ID = '00000000-0000-4000-8000-000000000102';
const functionalFailures = new Counter('functional_check_failures');

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const allowedHosts = new Set(
    (__ENV.K6_ALLOWED_HOSTS || '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
);
const targetMatch = /^([a-z][a-z\d+.-]*):\/\/([^/?#]+)/i.exec(BASE_URL);
const authority = targetMatch?.[2] || '';
const authorityWithoutCredentials = authority.split('@').pop() || '';
const targetHostname = authorityWithoutCredentials.startsWith('[')
    ? authorityWithoutCredentials.slice(1).split(']')[0]
    : authorityWithoutCredentials.split(':')[0];
if (
    !targetMatch ||
    !['http:', 'https:'].includes(`${targetMatch[1].toLowerCase()}:`) ||
    authority.includes('@') ||
    (!loopbackHosts.has(targetHostname) &&
        !allowedHosts.has(targetHostname) &&
        __ENV.K6_ALLOW_UNSAFE_TARGET !== '1')
) {
    throw new Error('BASE_URL must point to a disposable loopback target');
}

const optionsByProfile = {
    smoke: {
        scenarios: {
            smoke: {
                executor: 'shared-iterations',
                vus: 1,
                iterations: 1,
                exec: 'smokeScenario',
            },
        },
        thresholds: {
            http_req_failed: ['rate<0.02'],
            'http_req_duration{stage:business}': ['p(95)<800'],
            functional_check_failures: ['count==0'],
        },
    },
    average: {
        scenarios: {
            catalog: {
                executor: 'constant-arrival-rate',
                rate: 5,
                timeUnit: '1s',
                duration: '20s',
                preAllocatedVUs: 5,
                maxVUs: 5,
                exec: 'catalogScenario',
            },
            checkout: {
                executor: 'constant-vus',
                vus: 1,
                duration: '20s',
                exec: 'checkoutScenario',
            },
        },
        thresholds: {
            http_req_failed: ['rate<0.05'],
            'http_req_duration{stage:business}': ['p(95)<1000'],
            functional_check_failures: ['count==0'],
        },
    },
};

export const options = {
    ...optionsByProfile[PROFILE],
    teardownTimeout: '30s',
    tags: { profile: PROFILE },
};

const url = (path) => `${BASE_URL.replace(/\/$/, '')}${path}`;

const request = (method, path, body, headers, stage) =>
    http.request(method, url(path), body, {
        headers,
        tags: { profile: PROFILE, stage },
    });

const checked = (response, name, expectedStatus, predicate = () => true) => {
    const passed = check(response, {
        [`${name}: status ${expectedStatus}`]: (value) =>
            value.status === expectedStatus,
        [`${name}: response shape`]: predicate,
    });
    if (!passed) functionalFailures.add(1);
    return passed;
};

const login = () => {
    const response = request(
        'POST',
        '/auth/login',
        JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
        { 'Content-Type': 'application/json' },
        'business',
    );
    if (
        !checked(response, 'login', 200, (value) =>
            Boolean(value.json('token')),
        )
    )
        return undefined;
    return response.json('token');
};

const browseCatalog = () => {
    const response = request(
        'GET',
        '/products?page=1&pageSize=3&sort=price',
        null,
        {},
        'business',
    );
    checked(response, 'catalog', 200, (value) => {
        const items = value.json('items');
        return Array.isArray(items) && items.length === 3;
    });
};

const addToCart = (token) => {
    const response = request(
        'POST',
        '/cart/items',
        JSON.stringify({ productId: NOTEBOOK_ID, quantity: 1 }),
        {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        'business',
    );
    return checked(response, 'cart', 200, (value) => {
        const items = value.json('items');
        return Array.isArray(items) && items.length === 1;
    });
};

const checkout = (token) => {
    const key = `${RUN_ID}-vu${__VU}-iter${__ITER}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        'X-Correlation-Id': `${key}-correlation`,
    };
    const response = request('POST', '/orders', null, headers, 'business');
    if (
        !checked(response, 'checkout', 201, (value) =>
            ['pending', 'paid', 'processing', 'shipped'].includes(
                value.json('order.status'),
            ),
        )
    )
        return;
    const replay = request('POST', '/orders', null, headers, 'business');
    checked(replay, 'checkout replay', 200, (value) => {
        return (
            value.json('replayed') === true &&
            value.json('order.id') === response.json('order.id')
        );
    });
};

export function setup() {
    const health = request('GET', '/health', null, {}, 'setup');
    if (
        !checked(
            health,
            'setup health',
            200,
            (value) => value.json('status') === 'ok',
        )
    )
        throw new Error('setup health check failed');
    const reset = request(
        'POST',
        '/__test/reset',
        null,
        { 'X-Test-Control-Key': CONTROL_KEY },
        'setup',
    );
    if (
        !checked(
            reset,
            'setup reset',
            200,
            (value) => value.json('scenario') === 'baseline',
        )
    )
        throw new Error('setup reset failed');
    return { runId: RUN_ID };
}

export function smokeScenario() {
    browseCatalog();
    const token = login();
    if (token && addToCart(token)) checkout(token);
}

export function catalogScenario() {
    browseCatalog();
}

export function checkoutScenario() {
    if (__ITER >= 10) {
        sleep(1);
        return;
    }
    const token = login();
    if (token && addToCart(token)) checkout(token);
}

export function teardown() {
    const reset = request(
        'POST',
        '/__test/reset',
        null,
        { 'X-Test-Control-Key': CONTROL_KEY },
        'teardown',
    );
    checked(
        reset,
        'teardown reset',
        200,
        (value) => value.json('scenario') === 'baseline',
    );
}

const jsonEscape = (value) =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

export function handleSummary(data) {
    const thresholdFailures = [];
    for (const [metricName, metric] of Object.entries(data.metrics)) {
        for (const [threshold, passed] of Object.entries(
            metric.thresholds || {},
        )) {
            if (!passed) thresholdFailures.push(`${metricName}: ${threshold}`);
        }
    }
    const functionalCheckFailuresValue =
        data.metrics.functional_check_failures?.values?.count || 0;
    const outcome =
        functionalCheckFailuresValue > 0
            ? 'functional_check_failure'
            : thresholdFailures.length > 0
              ? 'threshold_failure'
              : 'passed';
    const summary = {
        profile: PROFILE,
        outcome,
        functionalCheckFailures: functionalCheckFailuresValue,
        thresholdFailures,
        generatedAt: new Date().toISOString(),
        metrics: {
            http_req_failed: data.metrics.http_req_failed?.values || {},
            http_req_duration: data.metrics.http_req_duration?.values || {},
        },
    };
    const failed =
        outcome === 'passed'
            ? ''
            : `<failure message="${jsonEscape(outcome)}">${jsonEscape(thresholdFailures.join('; ') || 'functional check failed')}</failure>`;
    const junit = `<testsuite name="k6-${jsonEscape(PROFILE)}" tests="1" failures="${outcome === 'passed' ? 0 : 1}"><testcase classname="performance" name="${jsonEscape(PROFILE)}">${failed}</testcase></testsuite>`;
    const basename = __ENV.K6_SUMMARY_BASENAME || `k6-${PROFILE}`;
    return {
        [`/artifacts/${basename}.json`]: JSON.stringify(summary, null, 2),
        [`/artifacts/${basename}.xml`]: junit,
    };
}
