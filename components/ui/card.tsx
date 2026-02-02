'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div className={`bg-surface-workspace rounded-xl shadow-sm border border-border-default ${hover ? 'hover:shadow-lg hover:border-[#1E40AF]/20 transition-all duration-300' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className = '', action }: CardHeaderProps) {
  return (
    <div className={`px-6 py-5 border-b border-border-default bg-linear-to-r from-gray-50/50 to-transparent ${className}`}>
      <div className="flex items-center justify-between">
        <div>{children}</div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  icon?: ReactNode;
}

export function CardTitle({ children, className = '', subtitle, icon }: CardTitleProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {icon && <span className="text-[#1E40AF]">{icon}</span>}
        <h3 className={`text-xl font-semibold text-text-primary tracking-tight ${className}`}>
          {children}
        </h3>
      </div>
      {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
