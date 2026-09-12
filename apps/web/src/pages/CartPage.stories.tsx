import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
import { cartApi } from '../features/cart/cartApi';
import { useAppDispatch } from '../store/hooks';
import {
    cartStoryHandlers,
    storyCart,
    storyUserSession,
} from '../testing/mocks/storyFixtures';
import { CartPage } from './CartPage';

const SeededCart = (): React.ReactNode => {
    const dispatch = useAppDispatch();
    useLayoutEffect(() => {
        dispatch(cartApi.util.upsertQueryData('getCart', undefined, storyCart));
    }, [dispatch]);
    return <CartPage />;
};

const meta = {
    title: 'Pages/CartPage',
    component: CartPage,
} satisfies Meta<typeof CartPage>;

export default meta;
type Story = StoryObj<typeof meta> & { parameters?: StorybookParameters };

const userParameters: StorybookParameters = {
    preloadedState: { session: storyUserSession },
};

export const Default: Story = {
    parameters: userParameters,
    render: () => <SeededCart />,
};

export const Empty: Story = {
    parameters: userParameters,
};

export const Loading: Story = {
    parameters: userParameters,
};

export const ErrorState: Story = {
    parameters: userParameters,
};

export const LongContent: Story = {
    parameters: {
        ...userParameters,
        viewport: { defaultViewport: 'mobile1' },
        msw: { handlers: [cartStoryHandlers.longContent] },
    },
    render: () => <SeededCart />,
};

export const KeyboardFocus: Story = {
    parameters: userParameters,
    render: () => <SeededCart />,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await canvas.findByRole('heading', { name: 'Review your order' });
        await userEvent.tab();
        expect(canvas.getByRole('spinbutton')).toHaveFocus();
    },
};
