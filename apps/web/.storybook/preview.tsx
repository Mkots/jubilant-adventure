import type { Decorator, Preview } from '@storybook/react-vite';
import { setupWorker } from 'msw/browser';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import type { PreloadedState } from '../src/store/store';
import { makeStore } from '../src/store/store';
import { handlers } from '../src/testing/mocks/handlers';
import '../src/styles.css';

export interface StorybookParameters {
    initialRoute?: string;
    preloadedState?: PreloadedState;
}

const withAppProviders: Decorator = (Story, context) => {
    const parameters = context.parameters as StorybookParameters;
    const store = makeStore(parameters.preloadedState);

    return (
        <Provider store={store}>
            <MemoryRouter initialEntries={[parameters.initialRoute ?? '/']}>
                <Story />
            </MemoryRouter>
        </Provider>
    );
};

const setupMsw = async () => {
    const worker = setupWorker();
    await worker.start({ onUnhandledRequest: 'error' });
    return worker;
};

const preview: Preview = {
    decorators: [withAppProviders],
    loaders: [mswLoader(setupMsw)],
    parameters: {
        a11y: { test: 'error' },
        layout: 'fullscreen',
        msw: handlers,
    },
};

export default preview;
