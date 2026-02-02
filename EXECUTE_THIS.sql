ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_warehouses_manager_email ON warehouses(manager_email);

ALTER TABLE warehouse_managers ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_warehouse_managers_email ON warehouse_managers(email);
