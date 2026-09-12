import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
import {
    checkoutStoryHandlers,
    storyUserSession,
} from '../testing/mocks/storyFixtures';
import { CheckoutPage } from './CheckoutPage';

const meta = {
    title: 'Pages/CheckoutPage',
    component: CheckoutPage,
} satisfies Meta<typeof CheckoutPage>;

export default meta;
type Story = StoryObj<typeof meta> & { parameters?: StorybookParameters };

const userParameters: StorybookParameters = {
    preloadedState: { session: storyUserSession },
};

export const Default: Story = {
    parameters: {
        ...userParameters,
        msw: { handlers: [checkoutStoryHandlers.success] },
    },
};

export const Loading: Story = {
    parameters: {
        ...userParameters,
        msw: { handlers: [checkoutStoryHandlers.loading] },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await canvas.findByRole('heading', { name: 'Complete your order' });
        await userEvent.click(
            canvas.getByRole('button', { name: 'Place order' }),
        );
        expect(
            await canvas.findByRole('button', { name: 'Submitting...' }),
        ).toBeDisabled();
    },
};

export const ErrorState: Story = {
    parameters: {
        ...userParameters,
        msw: { handlers: [checkoutStoryHandlers.error] },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(
            canvas.getByRole('button', { name: 'Place order' }),
        );
        expect(await canvas.findByRole('alert')).toHaveTextContent(
            'Checkout is offline',
        );
    },
};

export const ValidationFocus: Story = {
    parameters: userParameters,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const email = canvas.getByRole('textbox', {
            name: 'Email for order updates',
        });
        await userEvent.clear(email);
        await userEvent.click(
            canvas.getByRole('button', { name: 'Place order' }),
        );
        expect(await canvas.findByRole('alert')).toHaveFocus();
    },
};

export const NarrowViewport: Story = {
    parameters: {
        ...userParameters,
        viewport: { defaultViewport: 'mobile1' },
    },
};
