'use client';


import { X } from 'lucide-react';

interface MOViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  details: any;
}

export default function MOViewModal({ isOpen, onClose, order, details }: MOViewModalProps) {
  if (!isOpen || !order) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return colors[priority] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{order.moNumber}</h2>
            <p className="text-sm text-gray-500">{order.productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Order Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">MO Number</p>
                <p className="font-medium">{order.moNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Product</p>
                <p className="font-medium">{order.productName}</p>
                <p className="text-xs text-gray-400">{order.productSku}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.status)}`}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getPriorityColor(order.priority)}`}>
                  {order.priority.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Production Details */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Production Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Planned Quantity</p>
                <p className="font-medium">{order.plannedQuantity} {order.uom}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Produced Quantity</p>
                <p className="font-medium">{order.producedQuantity} {order.uom}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(order.producedQuantity / order.plannedQuantity) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round((order.producedQuantity / order.plannedQuantity) * 100)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">BOM Version</p>
                <p className="font-medium">{order.bomVersion || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Schedule</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Scheduled Start</p>
                <p className="font-medium">{order.scheduledStart}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Scheduled End</p>
                <p className="font-medium">{order.scheduledEnd}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual Start</p>
                <p className="font-medium">{order.actualStart || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual End</p>
                <p className="font-medium">{order.actualEnd || '-'}</p>
              </div>
            </div>
          </div>

          {/* Operations */}
          {details?.operations && details.operations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Operations</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Operation</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Work Center</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Setup Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Run Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actual Time</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.operations.map((op: any) => (
                      <tr key={op.id}>
                        <td className="px-4 py-2 text-sm">{op.operationName}</td>
                        <td className="px-4 py-2 text-sm">{op.workCenter}</td>
                        <td className="px-4 py-2 text-sm">{op.setupTime} min</td>
                        <td className="px-4 py-2 text-sm">{op.runTime} min</td>
                        <td className="px-4 py-2 text-sm">{op.actualTime ? `${op.actualTime} min` : '-'}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(op.status)}`}>
                            {op.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Material Consumption */}
          {details?.materialConsumption && details.materialConsumption.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Material Consumption</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Component</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Required</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Consumed</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.materialConsumption.map((mat: any) => (
                      <tr key={mat.id}>
                        <td className="px-4 py-2 text-sm">{mat.componentName}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{mat.componentSku}</td>
                        <td className="px-4 py-2 text-sm text-right">{mat.requiredQty} {mat.uom}</td>
                        <td className="px-4 py-2 text-sm text-right">{mat.consumedQty} {mat.uom}</td>
                        <td className="px-4 py-2 text-sm text-right">
                          {Math.round((mat.consumedQty / mat.requiredQty) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Production Output */}
          {details?.productionOutput && details.productionOutput.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Production Output</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Warehouse</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {details.productionOutput.map((out: any) => (
                      <tr key={out.id}>
                        <td className="px-4 py-2 text-sm">{out.outputDate}</td>
                        <td className="px-4 py-2 text-sm text-right">{out.quantity}</td>
                        <td className="px-4 py-2 text-sm">{out.warehouse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {details?.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Notes</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{details.notes}</p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
