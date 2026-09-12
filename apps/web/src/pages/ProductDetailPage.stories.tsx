import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
import { fixtureProduct } from '../testing/mocks/handlers';
import { productDetailStoryHandlers } from '../testing/mocks/storyFixtures';
import { ProductDetailPage } from './ProductDetailPage';

const meta = {
    title: 'Pages/ProductDetailPage',
    component: ProductDetailPage,
    render: () => (
        <Routes>
            <Route element={<ProductDetailPage />} path="/products/:id" />
        </Routes>
    ),
} satisfies Meta<typeof ProductDetailPage>;

export default meta;
type Story = StoryObj<typeof meta> & { parameters?: StorybookParameters };

const detailRoute = `/products/${fixtureProduct.id}`;

export const Default: Story = {
    parameters: { initialRoute: detailRoute },
};

export const Loading: Story = {
    parameters: {
        initialRoute: detailRoute,
        msw: { handlers: [productDetailStoryHandlers.loading] },
    },
};

export const ErrorState: Story = {
    parameters: {
        initialRoute: detailRoute,
        msw: { handlers: [productDetailStoryHandlers.error] },
    },
};

export const LongContent: Story = {
    parameters: {
        initialRoute: detailRoute,
        msw: { handlers: [productDetailStoryHandlers.longContent] },
        viewport: { defaultViewport: 'mobile1' },
    },
};

export const KeyboardFocus: Story = {
    parameters: { initialRoute: detailRoute },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await canvas.findByRole('heading', { name: 'Comet Mug' });
        await userEvent.tab();
        expect(
            canvas.getByRole('link', { name: 'Back to catalog' }),
        ).toHaveFocus();
    },
};
