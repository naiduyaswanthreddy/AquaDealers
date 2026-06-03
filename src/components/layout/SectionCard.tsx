import React from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  headerAction,
  className,
  children,
  ...props
}) => (
  <section className={cn('section-card', className)} {...props}>
    {title || description || headerAction ? (
      <div className="section-card__header">
        <div>
          {title ? <h2 className="section-card__title">{title}</h2> : null}
          {description ? <p className="section-card__description mt-1">{description}</p> : null}
        </div>
        {headerAction ? <div>{headerAction}</div> : null}
      </div>
    ) : null}
    {children}
  </section>
);

export default SectionCard;
