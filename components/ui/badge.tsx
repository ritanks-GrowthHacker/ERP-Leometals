'use client';

import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'inventory' | 'finance' | 'analytics';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  icon,
  className = '' 
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center gap-1.5 font-medium rounded-full border';

  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    default: 'bg-gray-50 text-gray-700 border-gray-200',
    inventory: 'bg-emerald-50 text-[#10B981] border-emerald-200',
    finance: 'bg-emerald-50 text-[#059669] border-emerald-200',
    analytics: 'bg-sky-50 text-[#0EA5E9] border-sky-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  iconBgColor?: string;
  iconColor?: string;
}

export function StatCard({ title, value, change, changeType, icon, iconBgColor = 'bg-[#1E40AF]/10', iconColor = 'text-[#1E40AF]' }: StatCardProps) {
  const changeColors = {
    positive: 'text-[#10B981]',
    negative: 'text-[#EF4444]',
    neutral: 'text-text-muted',
  };

  return (
    <div className="bg-surface-workspace rounded-xl p-6 border border-border-default hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
          <p className="text-3xl font-bold text-text-primary tracking-tight">{value}</p>
          {change && (
            <p className={`text-sm font-medium mt-2 ${changeColors[changeType || 'neutral']}`}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-xl ${iconBgColor}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}
