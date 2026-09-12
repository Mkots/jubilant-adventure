import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api';
import { type SessionState, sessionReducer } from './sessionSlice';

export interface PreloadedState {
    session?: SessionState;
    api?: ReturnType<typeof baseApi.reducer>;
}

const reducer = {
    session: sessionReducer,
    [baseApi.reducerPath]: baseApi.reducer,
};

export const makeStore = (preloadedState?: PreloadedState) => {
    const store = configureStore({
        reducer,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().concat(baseApi.middleware),
        ...(preloadedState
            ? {
                  preloadedState: preloadedState as {
                      session: SessionState;
                      api: ReturnType<typeof baseApi.reducer>;
                  },
              }
            : {}),
    });
    setupListeners(store.dispatch);
    return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
