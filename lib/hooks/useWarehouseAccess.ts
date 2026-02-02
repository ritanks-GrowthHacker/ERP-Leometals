import { useAuthStore } from '@/lib/store/authStore';
import { ROLE_PERMISSIONS } from '@/lib/rbac/roles';

export function useWarehouseAccess() {
  const { user } = useAuthStore();
  
  const isWarehouseManager = user?.isWarehouseManager || user?.role === 'warehouse_manager';
  const isLocationManager = user?.role === 'location_manager';
  const warehouseId = user?.warehouseId;
  const warehouseLocationId = user?.warehouseLocationId;
  const userRole = user?.role || 'viewer';
  
  // Get permissions for the user's role
  const permissions = ROLE_PERMISSIONS[userRole];
  
  // Check if user has access to a specific module
  const hasModuleAccess = (module: string): boolean => {
    if (!permissions) return false;
    
    switch (module.toLowerCase()) {
      case 'inventory':
        return permissions.erpModules.inventory;
      case 'sales':
        return permissions.erpModules.sales;
      case 'purchasing':
        return permissions.erpModules.purchasing;
      case 'manufacturing':
        return permissions.erpModules.manufacturing;
      default:
        return false;
    }
  };
  
  // Check if user can perform an action in inventory
  const canPerformInventory = (action: 'view' | 'create' | 'edit' | 'delete' | 'confirm', subModule: string): boolean => {
    if (!permissions) return false;
    
    switch (subModule) {
      case 'products':
        return action !== 'confirm' && (permissions.inventory.products[action as 'view' | 'create' | 'edit' | 'delete'] || false);
      case 'warehouses':
        return action !== 'confirm' && (permissions.inventory.warehouses[action as 'view' | 'create' | 'edit' | 'delete'] || false);
      case 'stockLevels':
        return action !== 'confirm' && (permissions.inventory.stockLevels[action as 'view' | 'create' | 'edit' | 'delete'] || false);
      case 'procurement':
        return action !== 'delete' && action !== 'confirm' && (permissions.inventory.procurement[action as 'view' | 'create' | 'edit'] || false);
      case 'movements':
        if (action === 'confirm') return permissions.inventory.movements.confirm;
        return (action === 'view' || action === 'create') && (permissions.inventory.movements[action] || false);
      case 'adjustments':
        if (action === 'confirm') return permissions.inventory.adjustments.confirm;
        return (action === 'view' || action === 'create') && (permissions.inventory.adjustments[action] || false);
      default:
        return false;
    }
  };
  
  // Check if user can perform an action in sales
  const canPerformSales = (action: 'view' | 'create' | 'edit' | 'delete' | 'pay', subModule: string): boolean => {
    if (!permissions) return false;
    
    switch (subModule) {
      case 'orders':
        return action !== 'pay' && (permissions.sales.orders[action as 'view' | 'create' | 'edit' | 'delete'] || false);
      case 'customers':
        return action !== 'pay' && (permissions.sales.customers[action as 'view' | 'create' | 'edit' | 'delete'] || false);
      case 'invoices':
        if (action === 'pay') return permissions.sales.invoices.pay;
        return (action === 'view' || action === 'create') && (permissions.sales.invoices[action] || false);
      default:
        return false;
    }
  };
  
  // Check if user can perform an action in purchasing
  const canPerformPurchasing = (action: 'view' | 'create' | 'edit' | 'delete', subModule: string): boolean => {
    if (!permissions) return false;
    
    switch (subModule) {
      case 'rfqs':
        return action !== 'delete' && (permissions.purchasing.rfqs[action as 'view' | 'create' | 'edit'] || false);
      case 'purchaseOrders':
        return action !== 'delete' && (permissions.purchasing.purchaseOrders[action as 'view' | 'create' | 'edit'] || false);
      case 'suppliers':
        return action !== 'delete' && (permissions.purchasing.suppliers[action as 'view' | 'create' | 'edit'] || false);
      case 'receipts':
        return (action === 'view' || action === 'create') && (permissions.purchasing.receipts[action] || false);
      default:
        return false;
    }
  };
  
  // Get the scope for inventory products
  const getInventoryScope = (subModule: string): 'all' | 'warehouse' | 'own' | 'none' => {
    if (!permissions) return 'none';
    
    switch (subModule) {
      case 'products':
        return permissions.inventory.products.scope;
      case 'warehouses':
        return permissions.inventory.warehouses.scope;
      case 'stockLevels':
        return permissions.inventory.stockLevels.scope;
      case 'procurement':
        return permissions.inventory.procurement.scope;
      case 'movements':
        return permissions.inventory.movements.scope;
      case 'adjustments':
        return permissions.inventory.adjustments.scope;
      default:
        return 'none';
    }
  };
  
  // Get the scope for sales
  const getSalesScope = (subModule: string): 'all' | 'warehouse' | 'none' => {
    if (!permissions) return 'none';
    
    switch (subModule) {
      case 'orders':
        return permissions.sales.orders.scope;
      case 'invoices':
        return permissions.sales.invoices.scope;
      default:
        return 'none';
    }
  };
  
  // Get the scope for purchasing
  const getPurchasingScope = (subModule: string): 'all' | 'warehouse' | 'none' => {
    if (!permissions) return 'none';
    
    switch (subModule) {
      case 'rfqs':
        return permissions.purchasing.rfqs.scope;
      case 'purchaseOrders':
        return permissions.purchasing.purchaseOrders.scope;
      case 'receipts':
        return permissions.purchasing.receipts.scope;
      default:
        return 'none';
    }
  };
  
  // Build warehouse filter for queries
  const getWarehouseFilter = (module: string, subModule?: string) => {
    let scope: 'all' | 'warehouse' | 'own' | 'none' = 'none';
    
    switch (module.toLowerCase()) {
      case 'inventory':
        scope = getInventoryScope(subModule || 'products');
        break;
      case 'sales':
        scope = getSalesScope(subModule || 'orders');
        break;
      case 'purchasing':
        scope = getPurchasingScope(subModule || 'rfqs');
        break;
    }
    
    if (scope === 'all') {
      return {}; // No filter
    }
    
    if (scope === 'warehouse' && warehouseId) {
      return { warehouse_id: warehouseId };
    }
    
    if (scope === 'own' && warehouseLocationId) {
      return { warehouse_location_id: warehouseLocationId };
    }
    
    return null; // No access
  };
  
  return {
    isWarehouseManager,
    isLocationManager,
    warehouseId,
    warehouseLocationId,
    userRole,
    permissions,
    hasModuleAccess,
    canPerformInventory,
    canPerformSales,
    canPerformPurchasing,
    getInventoryScope,
    getSalesScope,
    getPurchasingScope,
    getWarehouseFilter,
  };
}

