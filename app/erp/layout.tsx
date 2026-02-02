'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { useAuthStore } from '@/lib/store/authStore';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { user, logout } = useAuthStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  const [expandedItems, setExpandedItems] = useState<string[]>(['ERP', 'Reports']);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  // Filter navigation based on user role
  const isWarehouseManager = user?.role === 'warehouse_manager' || user?.managerType === 'warehouse_manager';
  
  const allNavigation = isWarehouseManager ? [
    { name: 'Dashboard', href: '/erp/warehouse-manager', icon: Icons.Dashboard },
    { 
      name: 'Inventory', 
      icon: Icons.Inventory,
      children: [
        { name: 'Products', href: '/erp/warehouse-manager/inventory/products', icon: Icons.Package },
        { name: 'Stock Levels', href: '/erp/warehouse-manager/inventory/stock-levels', icon: Icons.Inventory },
        { name: 'Warehouses', href: '/erp/warehouse-manager/inventory/warehouses', icon: Icons.Package },
        { name: 'Categories', href: '/erp/warehouse-manager/inventory/categories', icon: Icons.Package },
        { name: 'Movements', href: '/erp/warehouse-manager/inventory/movements', icon: Icons.TrendingUp },
        { name: 'Adjustments', href: '/erp/warehouse-manager/inventory/adjustments', icon: Icons.Settings },
      ]
    },
    { 
      name: 'Purchasing', 
      icon: Icons.Shopping,
      children: [
        { name: 'Purchase Orders', href: '/erp/warehouse-manager/purchasing/purchase-orders', icon: Icons.Shopping },
        { name: 'Suppliers', href: '/erp/warehouse-manager/purchasing/suppliers', icon: Icons.Users },
        { name: 'RFQs', href: '/erp/warehouse-manager/purchasing/rfqs', icon: Icons.FileText },
        { name: 'Quotations', href: '/erp/warehouse-manager/purchasing/quotations', icon: Icons.FileText },
        { name: 'Goods Receipts', href: '/erp/warehouse-manager/purchasing/goods-receipts', icon: Icons.Package },
        { name: 'Invoices', href: '/erp/warehouse-manager/purchasing/invoices', icon: Icons.FileText },
      ]
    },
    { 
      name: 'Sales', 
      icon: Icons.Sales,
      children: [
        { name: 'Orders', href: '/erp/warehouse-manager/sales/orders', icon: Icons.Shopping },
        { name: 'Customers', href: '/erp/warehouse-manager/sales/customers', icon: Icons.Users },
        { name: 'Quotations', href: '/erp/warehouse-manager/sales/quotations', icon: Icons.FileText },
        { name: 'Invoices', href: '/erp/warehouse-manager/sales/invoices', icon: Icons.FileText },
      ]
    },
    { 
      name: 'Reports', 
      icon: Icons.Reports,
      children: [
        { name: 'Tax Filing', href: '/erp/warehouse-manager/reports/tax-filing', icon: Icons.Audit },
      ]
    },
  ] : [
    { name: 'Dashboard', href: '/erp', icon: Icons.Dashboard },
    { 
      name: 'ERP', 
      icon: Icons.Package,
      children: [
        { name: 'Inventory', href: '/erp/inventory', icon: Icons.Inventory },
        { name: 'Purchasing', href: '/erp/purchasing', icon: Icons.Shopping },
        { name: 'Sales', href: '/erp/sales/orders', icon: Icons.Sales },
        { name: 'Manufacturing', href: '/erp/manufacturing', icon: Icons.Manufacturing },
      ]
    },
    { 
      name: 'Reports', 
      icon: Icons.Reports,
      children: [
        { name: 'Tax Filing', href: '/erp/audit', icon: Icons.Audit },
      ]
    },
    { name: 'Business Assistant', href: '/erp/business-assistant', icon: Icons.Lightbulb },
    { name: 'Settings', href: '/erp/settings', icon: Icons.Settings },
  ];
  
  const navigation = allNavigation;

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Modern Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}>
          {/* Logo */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">ER</span>
                </div>
                <span className="text-gray-900 dark:text-white font-semibold text-lg">ERP System</span>
              </div>
            )}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            
            // Check if item has children (nested navigation)
            if ('children' in item && item.children) {
              const isExpanded = expandedItems.includes(item.name);
              const hasActiveChild = item.children.some(child => 
                pathname === child.href || pathname.startsWith(child.href + '/')
              );
              
              return (
                <div key={item.name} className="mb-1">
                  <button
                    onClick={() => toggleExpanded(item.name)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full ${
                      hasActiveChild
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className={`${hasActiveChild ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} shrink-0`} size={20} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="text-sm flex-1 text-left">{item.name}</span>
                        <Icons.ChevronDown 
                          size={16} 
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </>
                    )}
                  </button>
                  
                  {isExpanded && !sidebarCollapsed && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/');
                        
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                              isChildActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <ChildIcon size={18} className="shrink-0" />
                            <span className="text-sm">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Regular navigation item (no children)
            const isActive = item.href === '/erp'
              ? pathname === '/erp'
              : pathname === item.href || pathname.startsWith((item.href || '') + '/');
            
            return (
              <Link
                key={item.name}
                href={item.href || '#'}
                className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title={sidebarCollapsed ? item.name : ''}
              >
                <Icon className={`${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} shrink-0`} size={20} />
                {!sidebarCollapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-semibold">{getUserInitials()}</span>
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.isApiUser ? 'API-ADMIN-USER' : (user?.departmentName || 'Employee')}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 flex ml-auto justify-end items-center h-full">
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Icons.Bell size={20} />
              </button>
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover cursor-pointer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center cursor-pointer">
                      <span className="text-white text-sm font-semibold">{getUserInitials()}</span>
                    </div>
                  )}
                  <Icons.ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Icons.Logout size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">{children}</main>
      </div>
    </div>
    </ThemeProvider>
  );
}
