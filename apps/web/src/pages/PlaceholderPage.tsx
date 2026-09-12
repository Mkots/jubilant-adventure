import type { ReactNode } from 'react';

export const PlaceholderPage = ({
    description,
    title,
}: {
    description: string;
    title: string;
}): ReactNode => (
    <section className="placeholder-page">
        <p className="eyebrow">Shop workspace</p>
        <h1>{title}</h1>
        <p>{description}</p>
    </section>
);
