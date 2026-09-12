import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
import {
    orderStoryHandlers,
    storyAdminSession,
    storyOrder,
    storyUserSession,
} from '../testing/mocks/storyFixtures';
import { OrdersPage } from './OrdersPage';

const meta = {
    title: 'Pages/OrdersPage',
    component: OrdersPage,
} satisfies Meta<typeof OrdersPage>;

export default meta;
type Story = StoryObj<typeof meta> & { parameters?: StorybookParameters };

const orderRoute = `/orders?id=${storyOrder.id}`;

export const Default: Story = {
    parameters: {
        initialRoute: orderRoute,
        preloadedState: { session: storyUserSession },
        msw: { handlers: [orderStoryHandlers.default] },
    },
};

export const Loading: Story = {
    parameters: {
        initialRoute: orderRoute,
        preloadedState: { session: storyUserSession },
        msw: { handlers: [orderStoryHandlers.loading] },
    },
};

export const Forbidden: Story = {
    parameters: {
        initialRoute: orderRoute,
        preloadedState: { session: storyUserSession },
        msw: { handlers: [orderStoryHandlers.forbidden] },
    },
};

export const SessionExpired: Story = {
    parameters: {
        initialRoute: orderRoute,
        preloadedState: { session: storyUserSession },
        msw: { handlers: [orderStoryHandlers.expired] },
    },
};

export const AdminStatusTransition: Story = {
    parameters: {
        initialRoute: `/admin/orders?id=${storyOrder.id}`,
        preloadedState: { session: storyAdminSession },
        msw: {
            handlers: [
                orderStoryHandlers.default,
                orderStoryHandlers.adminUpdate,
            ],
        },
    },
    render: () => <OrdersPage admin />,
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await canvas.findByRole('heading', { name: storyOrder.id });
        await userEvent.selectOptions(
            canvas.getByRole('combobox', { name: 'New status' }),
            'paid',
        );
        await userEvent.click(
            await canvas.findByRole('button', { name: 'Save status' }),
        );
        expect(
            await canvas.findByRole('button', { name: 'Save status' }),
        ).toBeEnabled();
    },
};

export const LongContent: Story = {
    parameters: {
        initialRoute: orderRoute,
        preloadedState: { session: storyUserSession },
        msw: { handlers: [orderStoryHandlers.longContent] },
        viewport: { defaultViewport: 'mobile1' },
    },
};
