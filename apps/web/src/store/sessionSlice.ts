import type { paths } from '@jubilant-adventure/api-client';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type LoginResponse =
    paths['/auth/login']['post']['responses'][200]['content']['application/json'];
export type SessionUser = LoginResponse['user'];

export interface SessionState {
    token: string | null;
    user: SessionUser | null;
}

const initialState: SessionState = { token: null, user: null };

const sessionSlice = createSlice({
    name: 'session',
    initialState,
    reducers: {
        setSession: (
            _state,
            action: PayloadAction<Pick<SessionState, 'token' | 'user'>>,
        ) => action.payload,
        clearSession: () => initialState,
    },
});

export const { clearSession, setSession } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
