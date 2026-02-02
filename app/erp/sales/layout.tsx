'use client';


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, ShoppingCart, FileText, BarChart3 } from 'lucide-react';

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const salesNav = [
    { name: 'Sales Orders', href: '/erp/sales/orders', icon: ShoppingCart },
    { name: 'Customers', href: '/erp/sales/customers', icon: Users },
    { name: 'Quotations', href: '/erp/sales/quotations', icon: FileText },
    { name: 'Invoices', href: '/erp/sales/invoices', icon: FileText },
    { name: 'Analytics', href: '/erp/sales/analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sales Sub-Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex gap-1 -mb-px">
            {salesNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sales Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
