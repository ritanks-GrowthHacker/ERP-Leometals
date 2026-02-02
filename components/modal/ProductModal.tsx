'use client';

import React, { useEffect } from 'react';
import { Input, Select, Textarea } from '@/components/ui/form';
import { inputFieldDesign, modalLabels } from './modalInputDesigns';
import { 
  X, 
  Package, 
  Tag, 
  IndianRupee, 
  BarChart3, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  UploadCloud,
  Info,
  Truck,
  Receipt,
  Scale
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  code?: string;
}

interface ProductSupplier {
  supplierId: string;
  supplierSku: string;
  supplierProductName: string;
  unitPrice: string;
  leadTimeDays: string;
  minimumOrderQuantity: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  code: string;
}

interface SubCategory {
  id: string;
  name: string;
  code: string;
  productCategoryId: string;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: {
    name: string;
    sku: string;
    description: string;
    productCategoryId: string;
    productSubCategoryId?: string;
    productType: string;
    trackingType: string;
    costPrice: string;
    salePrice: string;
    reorderPoint: string;
    reorderQuantity: string;
    imageUrl: string;
    isActive?: boolean;
    unitOfMeasure?: string;
    unitWeight?: string;
    hsnSacCode?: string;
    taxCategory?: string;
    defaultGstRate?: string;
    defaultPurchaseTaxId?: string;
    defaultSalesTaxId?: string;
  };
  setFormData: (data: any) => void;
  editingProduct: any;
  generatingSKU: boolean;
  onGenerateSKU: () => void;
  imagePreview: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  suppliers: Supplier[];
  productSuppliers: ProductSupplier[];
  onAddSupplier: (supplier: ProductSupplier) => void;
  onRemoveSupplier: (index: number) => void;
  categories: Category[];
  subCategories?: SubCategory[];
}

export default function ProductModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingProduct,
  generatingSKU,
  onGenerateSKU,
  imagePreview,
  onImageUpload,
  onRemoveImage,
  suppliers,
  productSuppliers,
  onAddSupplier,
  onRemoveSupplier,
  categories,
  subCategories = [],
}: ProductModalProps) {
  const [showSupplierForm, setShowSupplierForm] = React.useState(false);
  const [supplierFormData, setSupplierFormData] = React.useState<ProductSupplier>({
    supplierId: '',
    supplierSku: '',
    supplierProductName: '',
    unitPrice: '',
    leadTimeDays: '7',
    minimumOrderQuantity: '1',
    isPrimary: false,
    isActive: true,
  });

  // Filter sub categories based on selected category
  const filteredSubCategories = React.useMemo(() => {
    if (!formData.productCategoryId) return [];
    return subCategories.filter(sub => sub.productCategoryId === formData.productCategoryId);
  }, [subCategories, formData.productCategoryId]);

  // Reset sub category when category changes
  React.useEffect(() => {
    if (formData.productCategoryId && formData.productSubCategoryId) {
      const isValidSubCategory = filteredSubCategories.some(sub => sub.id === formData.productSubCategoryId);
      if (!isValidSubCategory) {
        setFormData({ ...formData, productSubCategoryId: '' });
      }
    }
  }, [formData.productCategoryId]);

  // Check if SKU generation should be enabled
  const canGenerateSKU = formData.name.trim() && formData.productCategoryId && formData.productType;

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
      <div className="bg-white rounded-xl max-w-4xl w-full mx-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-100">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-none">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Configure your product specifications and inventory limits.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <form id="product-form" onSubmit={onSubmit} className="space-y-8">
            
            {/* Basic Information Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                <Tag size={18} className="text-blue-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs italic">Basic Information</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Product Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Wireless Keyboard K290"
                  required
                />

                <Select
                  label="Category *"
                  value={formData.productCategoryId}
                  onChange={(e) => setFormData({ ...formData, productCategoryId: e.target.value, productSubCategoryId: '' })}
                  options={[
                    { value: '', label: 'Select Category' },
                    ...categories.map(cat => ({ value: cat.id, label: cat.name }))
                  ]}
                  required
                />

                {formData.productCategoryId && (
                  <Select
                    label="Sub Category (Optional)"
                    value={formData.productSubCategoryId || ''}
                    onChange={(e) => setFormData({ ...formData, productSubCategoryId: e.target.value })}
                    options={[
                      { value: '', label: filteredSubCategories.length > 0 ? 'Select Sub Category' : 'No Sub Category available' },
                      ...filteredSubCategories.map(sub => ({ value: sub.id, label: sub.name }))
                    ]}
                    disabled={filteredSubCategories.length === 0}
                  />
                )}

                <Select
                  label="Product Type *"
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                  options={[
                    { value: '', label: 'Select Type' },
                    { value: 'storable', label: 'Storable Product' },
                    { value: 'consumable', label: 'Consumable' },
                    { value: 'service', label: 'Service' },
                  ]}
                  required
                />
                
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">SKU / Product Code *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.sku || ''}
                      readOnly
                      placeholder="Select category, sub category and type, then generate"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-blue-700 font-mono text-sm outline-none cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={onGenerateSKU}
                      disabled={!canGenerateSKU || generatingSKU}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-40 whitespace-nowrap active:scale-95 shadow-sm"
                    >
                      {generatingSKU ? '...' : 'Generate'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 italic font-medium uppercase tracking-tight">
                    Fill in name, category and product type first to generate SKU
                  </p>
                </div>

                <Select
                  label="Tracking Method"
                  value={formData.trackingType}
                  onChange={(e) => setFormData({ ...formData, trackingType: e.target.value })}
                  options={[
                    { value: 'none', label: 'No Tracking' },
                    { value: 'serial', label: 'By Serial Number' },
                    { value: 'lot', label: 'By Lot Number' },
                  ]}
                />
              </div>
            </section>

            {/* Active Status Toggle - Only shown when editing */}
            {editingProduct && (
              <section className="bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">Product Status</h4>
                    <p className="text-xs text-blue-600 mt-1">
                      {formData.isActive ? 'Product is active and available' : 'Product is inactive and hidden'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </section>
            )}

            {/* Tax & Measurement Information */}
            <section className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-5 rounded-xl border border-amber-100">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={18} className="text-amber-600" />
                <h4 className="font-bold text-amber-900 uppercase tracking-wider text-xs">Tax & Measurement Info</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Unit of Measure */}
                <Select
                  label="Unit of Measure"
                  value={formData.unitOfMeasure || ''}
                  onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  options={[
                    { value: '', label: 'Select UoM' },
                    { value: 'weight_g', label: 'Weight (grams)' },
                    { value: 'volume_ml', label: 'Volume (milliliters)' },
                    { value: 'length_m', label: 'Length (meters)' },
                    { value: 'unit', label: 'Unit (pcs)' },
                  ]}
                />

                {/* Unit Weight */}
                <Input
                  label="Unit Weight (grams)"
                  type="number"
                  step="0.001"
                  value={formData.unitWeight || ''}
                  onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                  placeholder="Enter weight in grams"
                />

                {/* HSN/SAC Code */}
                <Input
                  label="HSN/SAC Code"
                  type="text"
                  value={formData.hsnSacCode || ''}
                  onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                  placeholder="Enter HSN/SAC code"
                />

                {/* Tax Category */}
                <Select
                  label="Tax Category"
                  value={formData.taxCategory || ''}
                  onChange={(e) => setFormData({ ...formData, taxCategory: e.target.value })}
                  options={[
                    { value: '', label: 'Select Tax Category' },
                    { value: 'taxable', label: 'Taxable' },
                    { value: 'exempt', label: 'Exempt' },
                    { value: 'nil_rated', label: 'Nil Rated' },
                    { value: 'rcm_applicable', label: 'RCM Applicable' },
                  ]}
                />

                {/* Default GST Rate */}
                <Select
                  label="Default GST Rate (%)"
                  value={formData.defaultGstRate || ''}
                  onChange={(e) => setFormData({ ...formData, defaultGstRate: e.target.value })}
                  options={[
                    { value: '', label: 'Select GST Rate' },
                    { value: '0', label: '0%' },
                    { value: '5', label: '5%' },
                    { value: '12', label: '12%' },
                    { value: '18', label: '18%' },
                    { value: '28', label: '28%' },
                  ]}
                />
              </div>
              <p className="text-[10px] text-amber-600 mt-3 italic">
                * Tax information is used for GST compliance and reporting. These fields capture tax identity, not actual amounts.
              </p>
            </section>

            {/* Pricing & Media Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Pricing Information */}
              <section className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100/50">
                <div className="flex items-center gap-2 mb-4">
                  <IndianRupee size={18} className="text-emerald-600" />
                  <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-xs">Pricing (INR)</h4>
                </div>
                <div className="space-y-4">
                  <Input
                    label="Cost Price"
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                  />
                  <Input
                    label="Sale Price"
                    type="number"
                    step="0.01"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </section>

              {/* Media Upload Section */}
              <section className="bg-slate-50/40 p-5 rounded-xl border border-slate-100/50">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon size={18} className="text-blue-600" />
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Product Image</h4>
                </div>
                
                <div className="mt-2">
                  {imagePreview ? (
                    <div className="space-y-3">
                      <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white group shadow-sm">
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={onRemoveImage}
                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            title="Remove Image"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
                        <Plus size={14} />
                        Upload New
                        <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center pt-3 pb-3">
                        <div className="p-3 bg-white rounded-full group-hover:bg-blue-100 transition-colors mb-2 shadow-sm">
                          <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                        </div>
                        <p className="text-xs text-slate-700 font-semibold">Click to upload</p>
                        <p className="text-[10px] text-slate-400 mt-1">JPG, PNG (Max 5MB)</p>
                      </div>
                      <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </section>
            </div>

            {/* Description Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                <Info size={18} className="text-blue-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs italic">Additional Details</h4>
              </div>
              <Textarea
                label="Product Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Write about product features, technical specs, or warranty info..."
                rows={4}
                className="focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </section>

            {/* Supplier Management Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-purple-600" />
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs italic">Suppliers</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSupplierForm(!showSupplierForm)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add Supplier
                </button>
              </div>

              {/* Add Supplier Form */}
              {showSupplierForm && (
                <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={modalLabels}>Supplier *</label>
                      <select
                        value={supplierFormData.supplierId}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, supplierId: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${inputFieldDesign}`}
                        required
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.name} {sup.code ? `(${sup.code})` : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={modalLabels}>Unit Price (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={supplierFormData.unitPrice}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, unitPrice: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${inputFieldDesign}`}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className={modalLabels}>Supplier SKU</label>
                      <input
                        type="text"
                        value={supplierFormData.supplierSku}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, supplierSku: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${inputFieldDesign}`}
                        placeholder="Supplier's product code"
                      />
                    </div>

                    <div>
                      <label className={modalLabels}>Supplier Product Name</label>
                      <input
                        type="text"
                        value={supplierFormData.supplierProductName}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, supplierProductName: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${inputFieldDesign}`}
                        placeholder="How supplier names this product"
                      />
                    </div>

                    <div>
                      <label className={modalLabels}>Lead Time (Days)</label>
                      <input
                        type="number"
                        value={supplierFormData.leadTimeDays}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, leadTimeDays: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${inputFieldDesign}`}
                      />
                    </div>

                    <div>
                      <label className={modalLabels}>Min Order Quantity</label>
                      <input
                        type="number"
                        value={supplierFormData.minimumOrderQuantity}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, minimumOrderQuantity: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${inputFieldDesign}`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplierFormData.isPrimary}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, isPrimary: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Primary Supplier</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={supplierFormData.isActive}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, isActive: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </label>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!supplierFormData.supplierId || !supplierFormData.unitPrice) {
                          alert('Please select a supplier and enter unit price');
                          return;
                        }
                        onAddSupplier(supplierFormData);
                        setSupplierFormData({
                          supplierId: '',
                          supplierSku: '',
                          supplierProductName: '',
                          unitPrice: '',
                          leadTimeDays: '7',
                          minimumOrderQuantity: '1',
                          isPrimary: false,
                          isActive: true,
                        });
                        setShowSupplierForm(false);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                    >
                      Add Supplier
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSupplierForm(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Suppliers List */}
              {productSuppliers.length > 0 && (
                <div className="space-y-2">
                  {productSuppliers.map((ps, index) => {
                    const supplier = suppliers.find(s => s.id === ps.supplierId);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{supplier?.name || 'Unknown'}</span>
                            {ps.isPrimary && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">PRIMARY</span>
                            )}
                            {!ps.isActive && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded">INACTIVE</span>
                            )}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-gray-600">
                            <span>₹{parseFloat(ps.unitPrice).toFixed(2)}</span>
                            <span>• {ps.leadTimeDays} days</span>
                            <span>• Min: {ps.minimumOrderQuantity}</span>
                            {ps.supplierSku && <span>• SKU: {ps.supplierSku}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveSupplier(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove supplier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {productSuppliers.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No suppliers added yet. Click "Add Supplier" to link this product with suppliers.
                </div>
              )}
            </section>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-end gap-3 px-6 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            form="product-form"
            type="submit"
            className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            {editingProduct ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}