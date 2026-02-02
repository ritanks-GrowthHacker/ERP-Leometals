'use client';

export default function WarehouseManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Warehouse manager uses main ERP layout which already has proper sidebar
  return <>{children}</>;
}

