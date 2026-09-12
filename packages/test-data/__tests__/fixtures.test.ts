import { describe, expect, test } from 'vitest';
import {
    createScenarioSeed,
    fixtureVersion,
    publicFixtureSnapshot,
} from '../src';

describe('deterministic fixtures', () => {
    test('rebuilds byte-equivalent baseline data', () => {
        expect(publicFixtureSnapshot(createScenarioSeed('baseline'))).toBe(
            publicFixtureSnapshot(createScenarioSeed('baseline')),
        );
    });

    test('requires a known fixture version', () => {
        expect(() => createScenarioSeed('baseline', 'v999')).toThrow(
            `Unsupported fixture version: v999`,
        );
        expect(fixtureVersion).toBe('v1');
    });
});
