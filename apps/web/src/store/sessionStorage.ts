import type { SessionState } from './sessionSlice';

const storageKey = 'jubilant-adventure.session';

export const loadPersistedSession = (): SessionState => {
    if (typeof window === 'undefined') {
        return { token: null, user: null };
    }

    try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return { token: null, user: null };
        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
            return { token: null, user: null };
        }
        const value = parsed as Partial<SessionState>;
        if (
            typeof value.token !== 'string' ||
            !value.user ||
            typeof value.user !== 'object'
        ) {
            return { token: null, user: null };
        }
        return { token: value.token, user: value.user } as SessionState;
    } catch {
        return { token: null, user: null };
    }
};

export const persistSession = (session: SessionState): void => {
    if (typeof window === 'undefined') return;
    if (!session.token || !session.user) {
        window.localStorage.removeItem(storageKey);
        return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(session));
};
