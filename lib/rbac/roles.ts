// Role-Based Access Control (RBAC) Configuration

export type UserRole = 'admin' | 'warehouse_manager' | 'location_manager' | 'user' | 'viewer';

export interface RolePermissions {
  sidebar: {
    erp: boolean;
    businessAssistant: boolean;
    hrms: boolean;
    analytics: boolean;
  };
  erpModules: {
    inventory: boolean;
    purchasing: boolean;
    sales: boolean;
    manufacturing: boolean;
  };
  inventory: {
    dashboard: boolean;
    products: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    warehouses: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      scope: 'all' | 'own' | 'none';
    };
    stockLevels: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    procurement: {
      view: boolean;
      create: boolean;
      edit: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    movements: {
      view: boolean;
      create: boolean;
      confirm: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    adjustments: {
      view: boolean;
      create: boolean;
      confirm: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    analytics: {
      view: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
  };
  sales: {
    orders: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    customers: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
    };
    invoices: {
      view: boolean;
      create: boolean;
      pay: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    quotations: boolean;
    deliveries: boolean;
  };
  purchasing: {
    rfqs: {
      view: boolean;
      create: boolean;
      edit: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    purchaseOrders: {
      view: boolean;
      create: boolean;
      edit: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
    suppliers: {
      view: boolean;
      create: boolean;
      edit: boolean;
    };
    receipts: {
      view: boolean;
      create: boolean;
      scope: 'all' | 'warehouse' | 'none';
    };
  };
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    sidebar: {
      erp: true,
      businessAssistant: true,
      hrms: true,
      analytics: true,
    },
    erpModules: {
      inventory: true,
      purchasing: true,
      sales: true,
      manufacturing: true,
    },
    inventory: {
      dashboard: true,
      products: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        scope: 'all',
      },
      warehouses: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        scope: 'all',
      },
      stockLevels: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        scope: 'all',
      },
      procurement: {
        view: true,
        create: true,
        edit: true,
        scope: 'all',
      },
      movements: {
        view: true,
        create: true,
        confirm: true,
        scope: 'all',
      },
      adjustments: {
        view: true,
        create: true,
        confirm: true,
        scope: 'all',
      },
      analytics: {
        view: true,
        scope: 'all',
      },
    },
    sales: {
      orders: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        scope: 'all',
      },
      customers: {
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
      invoices: {
        view: true,
        create: true,
        pay: true,
        scope: 'all',
      },
      quotations: true,
      deliveries: true,
    },
    purchasing: {
      rfqs: {
        view: true,
        create: true,
        edit: true,
        scope: 'all',
      },
      purchaseOrders: {
        view: true,
        create: true,
        edit: true,
        scope: 'all',
      },
      suppliers: {
        view: true,
        create: true,
        edit: true,
      },
      receipts: {
        view: true,
        create: true,
        scope: 'all',
      },
    },
  },
  warehouse_manager: {
    sidebar: {
      erp: true,
      businessAssistant: true,
      hrms: false,
      analytics: false,
    },
    erpModules: {
      inventory: true,
      purchasing: true,
      sales: true,
      manufacturing: false,
    },
    inventory: {
      dashboard: true,
      products: {
        view: true,
        create: true,
        edit: true,
        delete: false,
        scope: 'warehouse',
      },
      warehouses: {
        view: true,
        create: false,
        edit: true,
        delete: false,
        scope: 'own',
      },
      stockLevels: {
        view: true,
        create: true,
        edit: true,
        delete: false,
        scope: 'warehouse',
      },
      procurement: {
        view: true,
        create: true,
        edit: true,
        scope: 'warehouse',
      },
      movements: {
        view: true,
        create: true,
        confirm: true,
        scope: 'warehouse',
      },
      adjustments: {
        view: true,
        create: true,
        confirm: true,
        scope: 'warehouse',
      },
      analytics: {
        view: true,
        scope: 'warehouse',
      },
    },
    sales: {
      orders: {
        view: true,
        create: true,
        edit: true,
        delete: false,
        scope: 'warehouse',
      },
      customers: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      invoices: {
        view: true,
        create: false,
        pay: false,
        scope: 'warehouse',
      },
      quotations: false,
      deliveries: false,
    },
    purchasing: {
      rfqs: {
        view: true,
        create: true,
        edit: true,
        scope: 'warehouse',
      },
      purchaseOrders: {
        view: true,
        create: true,
        edit: true,
        scope: 'warehouse',
      },
      suppliers: {
        view: true,
        create: false,
        edit: false,
      },
      receipts: {
        view: true,
        create: true,
        scope: 'warehouse',
      },
    },
  },
  location_manager: {
    sidebar: {
      erp: true,
      businessAssistant: true,
      hrms: false,
      analytics: false,
    },
    erpModules: {
      inventory: true,
      purchasing: false,
      sales: false,
      manufacturing: false,
    },
    inventory: {
      dashboard: true,
      products: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'warehouse',
      },
      warehouses: {
        view: true,
        create: false,
        edit: true,
        delete: false,
        scope: 'own',
      },
      stockLevels: {
        view: true,
        create: true,
        edit: true,
        delete: false,
        scope: 'warehouse',
      },
      procurement: {
        view: false,
        create: false,
        edit: false,
        scope: 'none',
      },
      movements: {
        view: true,
        create: false,
        confirm: false,
        scope: 'warehouse',
      },
      adjustments: {
        view: true,
        create: true,
        confirm: false,
        scope: 'warehouse',
      },
      analytics: {
        view: true,
        scope: 'warehouse',
      },
    },
    sales: {
      orders: {
        view: false,
        create: false,
        edit: false,
        delete: false,
        scope: 'none',
      },
      customers: {
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
      invoices: {
        view: false,
        create: false,
        pay: false,
        scope: 'none',
      },
      quotations: false,
      deliveries: false,
    },
    purchasing: {
      rfqs: {
        view: false,
        create: false,
        edit: false,
        scope: 'none',
      },
      purchaseOrders: {
        view: false,
        create: false,
        edit: false,
        scope: 'none',
      },
      suppliers: {
        view: false,
        create: false,
        edit: false,
      },
      receipts: {
        view: false,
        create: false,
        scope: 'none',
      },
    },
  },
  user: {
    sidebar: {
      erp: true,
      businessAssistant: true,
      hrms: false,
      analytics: false,
    },
    erpModules: {
      inventory: true,
      purchasing: true,
      sales: true,
      manufacturing: true,
    },
    inventory: {
      dashboard: true,
      products: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      warehouses: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      stockLevels: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      procurement: {
        view: true,
        create: false,
        edit: false,
        scope: 'all',
      },
      movements: {
        view: true,
        create: false,
        confirm: false,
        scope: 'all',
      },
      adjustments: {
        view: true,
        create: false,
        confirm: false,
        scope: 'all',
      },
      analytics: {
        view: true,
        scope: 'all',
      },
    },
    sales: {
      orders: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      customers: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      invoices: {
        view: true,
        create: false,
        pay: false,
        scope: 'all',
      },
      quotations: false,
      deliveries: false,
    },
    purchasing: {
      rfqs: {
        view: true,
        create: false,
        edit: false,
        scope: 'all',
      },
      purchaseOrders: {
        view: true,
        create: false,
        edit: false,
        scope: 'all',
      },
      suppliers: {
        view: true,
        create: false,
        edit: false,
      },
      receipts: {
        view: true,
        create: false,
        scope: 'all',
      },
    },
  },
  viewer: {
    sidebar: {
      erp: true,
      businessAssistant: false,
      hrms: false,
      analytics: false,
    },
    erpModules: {
      inventory: true,
      purchasing: true,
      sales: true,
      manufacturing: true,
    },
    inventory: {
      dashboard: true,
      products: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      warehouses: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      stockLevels: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      procurement: {
        view: true,
        create: false,
        edit: false,
        scope: 'all',
      },
      movements: {
        view: true,
        create: false,
        confirm: false,
        scope: 'all',
      },
      adjustments: {
        view: true,
        create: false,
        confirm: false,
        scope: 'all',
      },
      analytics: {
        view: true,
        scope: 'all',
      },
    },
    sales: {
      orders: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        scope: 'all',
      },
      customers: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      invoices: {
        view: true,
        create: false,
        pay: false,
        scope: 'all',
      },
      quotations: false,
      deliveries: false,
    },
    purchasing: {
      rfqs: {
        view: true,
        create: false,
        edit: false,
        scope: 'all',
      },
      purchaseOrders: {
        view: true,
        create: false,
        edit: false,
        scope: 'all',
      },
      suppliers: {
        view: true,
        create: false,
        edit: false,
      },
      receipts: {
        view: true,
        create: false,
        scope: 'all',
      },
    },
  },
};

export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

export function canAccess(role: UserRole, module: string, action: string): boolean {
  const permissions = getRolePermissions(role);
  // Implement granular permission checks based on module and action
  return true; // Simplified for now
}
