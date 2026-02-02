'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Box, 
  Boxes, 
  Warehouse, 
  Folder, 
  ShoppingCart, 
  TrendingDown,
  BarChart3,
  Settings
} from 'lucide-react';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const inventoryNav = [
    { name: 'Dashboard', href: '/erp/inventory', icon: LayoutDashboard, exact: true },
    { name: 'Products', href: '/erp/inventory/products', icon: Box },
    { name: 'Stock Levels', href: '/erp/inventory/stock-levels', icon: Boxes },
    { name: 'Warehouses', href: '/erp/inventory/warehouses', icon: Warehouse },
    { name: 'Categories', href: '/erp/inventory/categories', icon: Folder },
    { name: 'Procurement', href: '/erp/inventory/procurement', icon: ShoppingCart },
    { name: 'Movements', href: '/erp/inventory/movements', icon: TrendingDown },
    { name: 'Analytics', href: '/erp/inventory/analytics/advanced', icon: BarChart3 },
    { name: 'Adjustments', href: '/erp/inventory/adjustments', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Inventory Sub-Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {inventoryNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact 
                ? pathname === item.href 
                : pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* Inventory Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
