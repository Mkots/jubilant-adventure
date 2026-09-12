import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { StorybookParameters } from '../../.storybook/preview';
import {
    loginStoryHandlers,
    storyUserSession,
} from '../testing/mocks/storyFixtures';
import { LoginPage } from './LoginPage';

const meta = {
    title: 'Pages/LoginPage',
    component: LoginPage,
} satisfies Meta<typeof LoginPage>;

export default meta;
type Story = StoryObj<typeof meta> & { parameters?: StorybookParameters };

export const Default: Story = {
    parameters: { msw: { handlers: [loginStoryHandlers.success] } },
};

export const Loading: Story = {
    parameters: { msw: { handlers: [loginStoryHandlers.loading] } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(
            canvas.getByRole('textbox', { name: 'Email' }),
            'user@example.test',
        );
        await userEvent.type(canvas.getByLabelText('Password'), 'password');
        await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
        expect(
            await canvas.findByRole('button', { name: 'Signing in...' }),
        ).toBeDisabled();
    },
};

export const InvalidCredentials: Story = {
    parameters: { msw: { handlers: [loginStoryHandlers.invalidCredentials] } },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(
            canvas.getByRole('textbox', { name: 'Email' }),
            'wrong@example.test',
        );
        await userEvent.type(canvas.getByLabelText('Password'), 'wrong');
        await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
        expect(await canvas.findByRole('alert')).toHaveTextContent(
            'Invalid email or password',
        );
        expect(canvas.getByText('Use your account email')).toBeVisible();
    },
};

export const SignedIn: Story = {
    parameters: { preloadedState: { session: storyUserSession } },
};

export const KeyboardFocus: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await canvas.findByRole('heading', { name: 'Sign in' });
        await userEvent.tab();
        expect(canvas.getByRole('textbox', { name: 'Email' })).toHaveFocus();
    },
};
