'use client';

import React, { useEffect } from 'react';
import { Input, Textarea } from '@/components/ui/form';
import { X, Warehouse, User, Info } from 'lucide-react'; // Suggested icons
import { inputFieldDesign, modalLabels } from './modalInputDesigns';

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: {
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    country: string;
    phone: string;
    email: string;
    managerName: string;
    managerEmail: string;
    managerAddress: string;
    managerMobile: string;
    managerGender: string;
    isActive?: boolean;
  };
  setFormData: (data: any) => void;
  editingId: string | null;
  generatingCode: boolean;
  onGenerateCode: () => void;
}

export default function WarehouseModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingId,
  generatingCode,
  onGenerateCode,
}: WarehouseModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Warehouse size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-none">
                {editingId ? 'Edit Warehouse' : 'New Warehouse'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Fill in the details to manage your storage location.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <form id="warehouse-form" onSubmit={onSubmit} className="space-y-8">
            
            {/* Section: Basic Info */}
            <section>
              <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-100">
                <Info size={18} className="text-blue-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Warehouse Information</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-1">
                  <label className={modalLabels}>Warehouse Name <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="e.g. Central Hub A"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className={inputFieldDesign}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className={modalLabels}>Warehouse Code <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.code}
                      readOnly
                      placeholder="Click generate"
                      className={`bg-slate-50 font-mono text-blue-700 ${inputFieldDesign}`}
                    />
                    <button
                      type="button"
                      onClick={onGenerateCode}
                      disabled={generatingCode}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
                    >
                      {generatingCode ? '...' : 'Generate'}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={modalLabels}>Street Address</label>
                  <Textarea
                    placeholder="Full street address..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={`${inputFieldDesign} min-h-[80px]`}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 md:col-span-2 gap-4">
                  <div>
                    <label className={modalLabels}>City</label>
                    <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputFieldDesign} />
                  </div>
                  <div>
                    <label className={modalLabels}>State</label>
                    <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className={inputFieldDesign} />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className={modalLabels}>Country</label>
                    <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className={inputFieldDesign} />
                  </div>
                </div>

                <div>
                  <label className={modalLabels}>Phone Number</label>
                  <Input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputFieldDesign} />
                </div>
                <div>
                  <label className={modalLabels}>Warehouse Email</label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputFieldDesign} placeholder="warehouse@company.com" />
                </div>
              </div>
            </section>

            {/* Warehouse Status */}
            {editingId && (
              <section className="bg-gray-50/40 p-5 rounded-xl border border-gray-100/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Warehouse Status</h4>
                    <p className="text-xs text-gray-500 mt-1">Mark warehouse as inactive to hide it from selection</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      {formData.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </div>
              </section>
            )}

            {/* Section: Manager Details */}
            <section className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-200">
                <User size={18} className="text-blue-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Manager Details (Optional)</h4>
                <span className="text-xs text-slate-500 ml-auto">For notifications & alerts</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={modalLabels}>Manager Name</label>
                  <Input value={formData.managerName} onChange={(e) => setFormData({ ...formData, managerName: e.target.value })} className={inputFieldDesign} placeholder="John Doe" />
                </div>
                <div>
                  <label className={modalLabels}>Manager Email</label>
                  <Input 
                    type="email" 
                    value={formData.managerEmail || ''} 
                    onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })} 
                    className={inputFieldDesign} 
                    placeholder="manager@company.com"
                  />
                  <p className="text-xs text-slate-500 mt-1">Receives warehouse-specific alerts & notifications</p>
                </div>
                <div>
                  <label className={modalLabels}>Mobile Number</label>
                  <Input value={formData.managerMobile} onChange={(e) => setFormData({ ...formData, managerMobile: e.target.value })} className={inputFieldDesign} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className={modalLabels}>Gender</label>
                  <select
                    value={formData.managerGender}
                    onChange={(e) => setFormData({ ...formData, managerGender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                   <label className={modalLabels}>Residential Address</label>
                   <Input value={formData.managerAddress} onChange={(e) => setFormData({ ...formData, managerAddress: e.target.value })} className={inputFieldDesign} placeholder="123 Main St, City" />
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row justify-end gap-3 px-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            form="warehouse-form"
            type="submit"
            className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            {editingId ? 'Save Changes' : 'Create Warehouse'}
          </button>
        </div>
      </div>
    </div>
  );
}