import { type RenderOptions, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren, ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import type { PreloadedState } from '../store/store';
import { type AppStore, makeStore } from '../store/store';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    preloadedState?: PreloadedState;
    route?: string;
    store?: AppStore;
}

export const renderWithProviders = (
    ui: ReactElement,
    {
        preloadedState,
        route = '/',
        store,
        ...renderOptions
    }: ExtendedRenderOptions = {},
) => {
    const testStore = store ?? makeStore(preloadedState);
    const user = userEvent.setup();

    const Wrapper = ({ children }: PropsWithChildren) => (
        <Provider store={testStore}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </Provider>
    );

    return {
        store: testStore,
        user,
        ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    };
};
