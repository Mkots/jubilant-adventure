import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLoginMutation } from '../features/auth/authApi';
import {
    getApiErrorFields,
    getApiErrorMessage,
} from '../features/catalog/formatters';
import { baseApi } from '../store/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSession } from '../store/sessionSlice';

const safeReturnPath = (value: string | null): string =>
    value?.startsWith('/') && !value.startsWith('//') ? value : '/';

export const LoginPage = (): React.ReactNode => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = useAppSelector((state) => state.session.token);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [login, loginState] = useLoginMutation();

    useEffect(() => {
        if (loginState.isError) {
            setFieldErrors(getApiErrorFields(loginState.error) ?? {});
        }
    }, [loginState.error, loginState.isError]);

    if (token) {
        return (
            <section className="auth-page" aria-labelledby="login-title">
                <p className="eyebrow">Account</p>
                <h1 id="login-title">You are already signed in</h1>
                <Link className="button" to="/orders">
                    View orders
                </Link>
            </section>
        );
    }

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFieldErrors({});
        try {
            const response = await login({ email, password }).unwrap();
            dispatch(
                setSession({ token: response.token, user: response.user }),
            );
            dispatch(baseApi.util.resetApiState());
            navigate(safeReturnPath(searchParams.get('returnTo')), {
                replace: true,
            });
        } catch {
            // The mutation state renders the server error and field details.
        }
    };

    return (
        <section className="auth-page" aria-labelledby="login-title">
            <p className="eyebrow">Account</p>
            <h1 id="login-title">Sign in</h1>
            <p className="auth-intro">
                Sign in to manage your cart and orders.
            </p>
            <form className="auth-form" onSubmit={submit}>
                <label>
                    Email
                    <input
                        aria-describedby={
                            fieldErrors.email ? 'email-error' : undefined
                        }
                        aria-invalid={Boolean(fieldErrors.email)}
                        autoComplete="email"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        type="email"
                        value={email}
                    />
                </label>
                {fieldErrors.email && (
                    <p className="field-error" id="email-error" role="alert">
                        {fieldErrors.email}
                    </p>
                )}
                <label>
                    Password
                    <input
                        aria-describedby={
                            fieldErrors.password ? 'password-error' : undefined
                        }
                        aria-invalid={Boolean(fieldErrors.password)}
                        autoComplete="current-password"
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        type="password"
                        value={password}
                    />
                </label>
                {fieldErrors.password && (
                    <p className="field-error" id="password-error" role="alert">
                        {fieldErrors.password}
                    </p>
                )}
                {loginState.isError && (
                    <div className="auth-error" role="alert">
                        {getApiErrorMessage(
                            loginState.error,
                            'Sign in failed.',
                        )}
                    </div>
                )}
                <button
                    className="button"
                    disabled={loginState.isLoading}
                    type="submit"
                >
                    {loginState.isLoading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
        </section>
    );
};
