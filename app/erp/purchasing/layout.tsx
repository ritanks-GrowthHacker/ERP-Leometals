'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { name: 'Orders', href: '/erp/purchasing/orders' },
  { name: 'Suppliers', href: '/erp/purchasing/suppliers' },
  { name: 'RFQ', href: '/erp/purchasing/rfq' },
  { name: 'Quotations', href: '/erp/purchasing/quotations' },
  { name: 'Goods Receipts', href: '/erp/purchasing/goods-receipts' },
  { name: 'Invoices', href: '/erp/purchasing/invoices' },
  { name: 'Analytics', href: '/erp/purchasing/analytics' },
];

export default function PurchasingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
