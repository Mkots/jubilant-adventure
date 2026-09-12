import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import app from '../src/app';

const main = async (): Promise<void> => {
    const response = await app.request('/openapi.json');
    if (!response.ok) {
        throw new Error(`OpenAPI export failed with HTTP ${response.status}`);
    }

    const outputPath = resolve(
        process.cwd(),
        process.env.OPENAPI_OUTPUT ?? 'openapi.json',
    );
    await writeFile(
        outputPath,
        `${JSON.stringify(await response.json(), null, 2)}\n`,
    );
    // biome-ignore lint/suspicious/noConsole: report generated artifact path
    console.log(`OpenAPI document written to ${outputPath}`);
};

void main();
