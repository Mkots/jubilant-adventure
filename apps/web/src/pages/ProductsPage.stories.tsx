import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
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
