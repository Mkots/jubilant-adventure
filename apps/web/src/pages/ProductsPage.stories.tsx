import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
import { catalogStoryHandlers } from '../testing/mocks/storyFixtures';
import { ProductsPage } from './ProductsPage';

const meta = {
    title: 'Pages/ProductsPage',
    component: ProductsPage,
} satisfies Meta<typeof ProductsPage>;

export default meta;
type Story = StoryObj<typeof meta> & {
    parameters?: StorybookParameters;
};

export const Smoke: Story = {
    parameters: { initialRoute: '/' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        expect(
            await canvas.findByRole('heading', { name: 'Comet Mug' }),
        ).toBeVisible();

        await userEvent.click(
            canvas.getByRole('button', { name: 'Add to cart' }),
        );
        expect(await canvas.findByRole('alert')).toHaveTextContent(
            'Sign in to add items',
        );
    },
};

export const Default: Story = {
    parameters: { initialRoute: '/' },
};

export const Loading: Story = {
    parameters: {
        initialRoute: '/?page=2',
        msw: { handlers: [catalogStoryHandlers.loading] },
    },
};

export const Empty: Story = {
    parameters: {
        msw: { handlers: [catalogStoryHandlers.empty] },
    },
};

export const ErrorState: Story = {
    parameters: {
        msw: { handlers: [catalogStoryHandlers.error] },
    },
};

export const LongContent: Story = {
    parameters: {
        msw: { handlers: [catalogStoryHandlers.longContent] },
        viewport: { defaultViewport: 'mobile1' },
    },
};

export const KeyboardFocus: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await canvas.findByRole('heading', { name: 'Comet Mug' });
        await userEvent.tab();
        expect(
            canvas.getByRole('searchbox', { name: 'Search products' }),
        ).toHaveFocus();
    },
};
