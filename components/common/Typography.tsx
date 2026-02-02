import { ReactNode } from 'react';

interface HeadingProps {
  children: ReactNode;
  className?: string;
}

export function H1({ children, className = '' }: HeadingProps) {
  return (
    <h1 className={`text-4xl font-bold text-gray-900 tracking-tight ${className}`}>
      {children}
    </h1>
  );
}

export function H2({ children, className = '' }: HeadingProps) {
  return (
    <h2 className={`text-3xl font-bold text-gray-900 tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

export function H3({ children, className = '' }: HeadingProps) {
  return (
    <h3 className={`text-2xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
}

export function H4({ children, className = '' }: HeadingProps) {
  return (
    <h4 className={`text-xl font-semibold text-gray-800 ${className}`}>
      {children}
    </h4>
  );
}

export function Paragraph({ children, className = '' }: HeadingProps) {
  return (
    <p className={`text-base text-gray-600 ${className}`}>
      {children}
    </p>
  );
}

export function SmallText({ children, className = '' }: HeadingProps) {
  return (
    <p className={`text-sm text-gray-500 ${className}`}>
      {children}
    </p>
  );
}

export function Label({ children, className = '' }: HeadingProps) {
  return (
    <label className={`text-sm font-medium text-gray-700 ${className}`}>
      {children}
    </label>
  );
}
