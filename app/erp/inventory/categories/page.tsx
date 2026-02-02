'use client';

import { useState, useEffect } from 'react';
import { Input, Textarea } from '@/components/ui/form';
import { getAuthToken } from '@/lib/utils/token';
import { useAuthStore } from '@/lib/store/authStore';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Edit, Trash2, Plus, X } from 'lucide-react';
import { useAlert } from '@/components/common/CustomAlert';

interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  parentCategoryId: string | null;
}

interface SubCategory {
  name: string;
  code: string;
  description: string;
}

export default function CategoriesPage() {
  const { showAlert, showConfirm } = useAlert();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<Category | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [subCategoryFormData, setSubCategoryFormData] = useState<SubCategory[]>([
    { name: '', code: '', description: '' }
  ]);
  const [newSubCategoryData, setNewSubCategoryData] = useState({
    name: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchSubCategories();
  }, []);

  const fetchCategories = async () => {
    const token = getAuthToken();
    if (!token) return;

    const user = useAuthStore.getState().user;
    const isWarehouseManager = user?.role === 'warehouse_manager';
    const apiEndpoint = isWarehouseManager 
      ? '/api/warehouse-manager/inventory/categories'
      : '/api/erp/inventory/categories';

    try {
      setLoading(true);
      const response = await fetch(apiEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubCategories = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/sub-categories', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSubCategories(data.subCategories || []);
      }
    } catch (error) {
      console.error('Error fetching sub categories:', error);
    }
  };

  const handleGenerateCode = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setGeneratingCode(true);
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'category' }),
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, code: data.code });
      } else {
        showAlert({ type: 'error', title: 'Error', message: 'Failed to generate code' });
      }
    } catch (error) {
      console.error('Error generating code:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to generate code' });
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleGenerateSubCategoryCode = async (index: number) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'category' }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedSubs = [...subCategoryFormData];
        updatedSubs[index].code = data.code;
        setSubCategoryFormData(updatedSubs);
      }
    } catch (error) {
      console.error('Error generating code:', error);
    }
  };

  const handleGenerateNewSubCategoryCode = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch('/api/erp/inventory/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'category' }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewSubCategoryData({ ...newSubCategoryData, code: data.code });
      }
    } catch (error) {
      console.error('Error generating code:', error);
    }
  };

  const addSubCategoryField = () => {
    setSubCategoryFormData([...subCategoryFormData, { name: '', code: '', description: '' }]);
  };

  const removeSubCategoryField = (index: number) => {
    if (subCategoryFormData.length > 1) {
      setSubCategoryFormData(subCategoryFormData.filter((_, i) => i !== index));
    }
  };

  const updateSubCategoryField = (index: number, field: keyof SubCategory, value: string) => {
    const updatedSubs = [...subCategoryFormData];
    updatedSubs[index][field] = value;
    setSubCategoryFormData(updatedSubs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;

    try {
      // Create the main category
      const response = await fetch('/api/erp/inventory/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        const categoryId = data.category.id;

        // Create sub-categories if any are filled
        const validSubCategories = subCategoryFormData.filter(sub => sub.name.trim() && sub.code.trim());
        
        if (validSubCategories.length > 0) {
          for (const subCat of validSubCategories) {
            await fetch('/api/erp/inventory/sub-categories', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                ...subCat,
                productCategoryId: categoryId,
              }),
            });
          }
        }

        showAlert({ 
          type: 'success', 
          title: 'Success', 
          message: `Category created successfully${validSubCategories.length > 0 ? ` with ${validSubCategories.length} sub-categories` : ''}!` 
        });
        await fetchCategories();
        await fetchSubCategories();
        setShowForm(false);
        setFormData({ name: '', code: '', description: '' });
        setSubCategoryFormData([{ name: '', code: '', description: '' }]);
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to create category' });
      }
    } catch (error) {
      console.error('Error creating category:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create category' });
    }
  };

  const handleAddSubCategory = (category: Category) => {
    setSelectedCategoryForSub(category);
    setNewSubCategoryData({ name: '', code: '', description: '' });
    setShowSubCategoryModal(true);
  };

  const handleSubmitNewSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token || !selectedCategoryForSub) return;

    try {
      const response = await fetch('/api/erp/inventory/sub-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newSubCategoryData,
          productCategoryId: selectedCategoryForSub.id,
        }),
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Sub-category added successfully!' });
        await fetchSubCategories();
        setShowSubCategoryModal(false);
        setSelectedCategoryForSub(null);
        setNewSubCategoryData({ name: '', code: '', description: '' });
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to create sub-category' });
      }
    } catch (error) {
      console.error('Error creating sub-category:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create sub-category' });
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    showConfirm({
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/erp/inventory/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Category deleted successfully!' });
        await fetchCategories();
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: error.error || 'Failed to delete category' });
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to delete category' });
        }
      }
    });
  };

  // Pagination calculation
  const totalPages = Math.ceil(categories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = categories.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading categories...</div>
      </div>
    );
  }

  const user = useAuthStore.getState().user;
  const isWarehouseManager = user?.role === 'warehouse_manager';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Product Categories</h2>
          <p className="text-sm text-gray-500 mt-1">Organize your products into categories</p>
        </div>
        {!isWarehouseManager && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Category'}
          </button>
        )}
      </div>

      {showForm && !isWarehouseManager && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Create New Category</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Category Section */}
              <div className="space-y-4 pb-4 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700">Category Details</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category Code *
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value })
                      }
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      disabled={generatingCode}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-300"
                    >
                      {generatingCode ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Click Generate to create a unique category code
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Sub-Categories Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Sub-Categories (Optional)</h4>
                  <button
                    type="button"
                    onClick={addSubCategoryField}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus size={16} />
                    Add Sub-Category
                  </button>
                </div>

                {subCategoryFormData.map((subCat, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3 relative">
                    {subCategoryFormData.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSubCategoryField(index)}
                        className="absolute top-2 right-2 p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove sub-category"
                      >
                        <X size={16} />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Sub-Category Name
                        </label>
                        <Input
                          type="text"
                          value={subCat.name}
                          onChange={(e) => updateSubCategoryField(index, 'name', e.target.value)}
                          placeholder="e.g. Accessories"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Sub-Category Code
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={subCat.code}
                            disabled
                            className="bg-white cursor-not-allowed"
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateSubCategoryCode(index)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Description
                      </label>
                      <Textarea
                        value={subCat.description}
                        onChange={(e) => updateSubCategoryField(index, 'description', e.target.value)}
                        placeholder="Optional description"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                <TableHead>Category Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Sub-Categories</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No categories found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCategories.map((category) => {
                  const categorySubCategories = subCategories.filter(sc => sc.productCategoryId === category.id);
                  return (
                  <TableRow key={category.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.code || '-'}</TableCell>
                    <TableCell>
                      {categorySubCategories.length > 0 ? (
                        <span className="text-sm text-gray-600">
                          {categorySubCategories.length} {categorySubCategories.length === 1 ? 'sub-category' : 'sub-categories'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          category.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => handleAddSubCategory(category)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Sub Category
                      </button>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {categories.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, categories.length)} of {categories.length} items
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Sub-Category Modal */}
      {showSubCategoryModal && selectedCategoryForSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Add Sub-Category to {selectedCategoryForSub.name}
              </h3>
              <button
                onClick={() => {
                  setShowSubCategoryModal(false);
                  setSelectedCategoryForSub(null);
                  setNewSubCategoryData({ name: '', code: '', description: '' });
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmitNewSubCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Sub-Category Name *
                  </label>
                  <Input
                    type="text"
                    value={newSubCategoryData.name}
                    onChange={(e) =>
                      setNewSubCategoryData({ ...newSubCategoryData, name: e.target.value })
                    }
                    placeholder="e.g. Accessories"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Sub-Category Code *
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newSubCategoryData.code}
                      disabled
                      className="bg-gray-50 cursor-not-allowed"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleGenerateNewSubCategoryCode}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors whitespace-nowrap"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Click Generate to create a unique sub-category code
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <Textarea
                    value={newSubCategoryData.description}
                    onChange={(e) =>
                      setNewSubCategoryData({ ...newSubCategoryData, description: e.target.value })
                    }
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubCategoryModal(false);
                      setSelectedCategoryForSub(null);
                      setNewSubCategoryData({ name: '', code: '', description: '' });
                    }}
                    className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    Add Sub-Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
