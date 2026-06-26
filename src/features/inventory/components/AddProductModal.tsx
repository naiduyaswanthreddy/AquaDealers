import React, { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateProduct, useBulkCreateProducts } from '../hooks/useInventory';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { FileUp, Plus, Trash2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProductInsert } from '@/types/database';

interface AddProductForm {
  type: string;
  company: string;
  products: {
    name: string;
    unit: string;
    gst_rate: number;
    medicine_discount_percentage: number;
  }[];
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (productId?: string) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { mutateAsync: bulkCreateProducts, isPending } = useBulkCreateProducts();
  
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<AddProductForm>({
    defaultValues: {
      type: 'feed',
      company: '',
      products: [
        {
          name: '',
          unit: 'Bag',
          gst_rate: 0,
          medicine_discount_percentage: 0,
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "products"
  });

  const watchType = watch('type');

  const handleManualSubmit = async (data: AddProductForm) => {
    if (!user?.id) return;
    
    const validProducts = data.products.filter(product => product.name.trim().length > 0);
    if (validProducts.length === 0) {
      toast.error('Please enter at least one product name');
      return;
    }

    try {
      const productsToCreate: ProductInsert[] = validProducts.map(product => ({
        dealer_id: user.id,
        name: product.name.trim(),
        type: data.type,
        company: data.company || null,
        unit: product.unit || (data.type === 'medicine' ? 'Unit' : 'Bag'),
        gst_rate: Number(product.gst_rate || 0),
        medicine_discount_percentage: Number(product.medicine_discount_percentage || 0),
        track_expiry: data.type === 'medicine',
        is_active: true,
      }));

      await bulkCreateProducts(productsToCreate);
      toast.success(`${productsToCreate.length} product(s) created successfully`);
      reset();
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create products');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map excel data
        const mappedData = data.map((row: any) => ({
          type: String(row['Type'] || 'feed').toLowerCase(),
          name: row['Product name'] || row['Product Name'] || '',
          company: row['Company'] || '',
          unit: row['Unit'] || 'Bag',
          gst_rate: Number(row['GST rate %'] || row['GST Rate (%)'] || 0),
          medicine_discount_percentage: Number(row['Default Discount (%)'] || 0),
        })).filter(item => item.name); // Filter out empty rows

        if (mappedData.length === 0) {
          toast.error("No valid products found in the file. Make sure headers match exactly.");
          setParsedData([]);
        } else {
          setParsedData(mappedData);
          toast.success(`Found ${mappedData.length} products to import`);
        }
      } catch (err) {
        toast.error("Failed to parse the file");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUploadSubmit = async () => {
    if (!user?.id || parsedData.length === 0) return;

    try {
      const productsToCreate: ProductInsert[] = parsedData.map(item => ({
        dealer_id: user.id,
        name: String(item.name).trim(),
        type: item.type === 'medicine' ? 'medicine' : 'feed',
        company: item.company ? String(item.company) : null,
        unit: String(item.unit),
        gst_rate: Number(item.gst_rate) || 0,
        medicine_discount_percentage: Number(item.medicine_discount_percentage) || 0,
        track_expiry: item.type === 'medicine',
        is_active: true,
      }));

      await bulkCreateProducts(productsToCreate);
      toast.success(`${productsToCreate.length} products imported successfully`);
      setParsedData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import products');
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Type": "Medicine",
        "Product name": "Hydro-boost",
        "Company": "LEO",
        "Unit": "500 g",
        "GST rate %": 0,
        "Default Discount (%)": 40
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Product_Upload_Template.xlsx");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Products"
      className="max-w-2xl"
    >
      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 mt-2 mb-6 px-2">
        <button
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'manual' 
              ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('manual')}
        >
          Manual Add
        </button>
        <button
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'upload' 
              ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Excel
        </button>
      </div>

      {activeTab === 'manual' && (
        <form id="manual-add-form" onSubmit={handleSubmit(handleManualSubmit)} className="space-y-5">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
            <h4 className="font-semibold text-blue-900 text-sm">Common Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  {...register('type')}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="feed">Feed</option>
                  <option value="medicine">Medicine</option>
                </select>
              </div>

              <Input
                label="Company (Optional)"
                {...register('company')}
                placeholder="e.g. LEO"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-900">Products</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({
                  name: '',
                  unit: watchType === 'medicine' ? 'Unit' : 'Bag',
                  gst_rate: 0,
                  medicine_discount_percentage: 0,
                })}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Row
              </Button>
            </div>
            
            <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-2 custom-scrollbar">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-3 flex items-start gap-2">
                    <div className="flex-1">
                      <Input
                        label={`Product ${index + 1}`}
                        {...register(`products.${index}.name` as const, { required: true })}
                        placeholder="Product name"
                        error={errors.products?.[index]?.name ? "Required" : undefined}
                      />
                    </div>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="mt-7 p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                        aria-label="Remove product row"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Unit"
                      {...register(`products.${index}.unit` as const, { required: true })}
                      placeholder="Bag, kg, L"
                      error={errors.products?.[index]?.unit ? "Required" : undefined}
                    />
                    <Input
                      label="GST %"
                      type="number"
                      min="0"
                      step="0.1"
                      {...register(`products.${index}.gst_rate` as const)}
                    />
                    <Input
                      label="Discount %"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      {...register(`products.${index}.medicine_discount_percentage` as const)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={isPending}>Save Products</Button>
          </div>
        </form>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-600">
              Upload an Excel (.xlsx) or CSV file with the correct headers.
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer">
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              ref={fileInputRef}
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <FileUp className="w-6 h-6" />
              </div>
              <h4 className="text-gray-900 font-semibold">Click or drag file to upload</h4>
              <p className="text-xs text-gray-500 mt-1">Supports .xlsx and .csv</p>
            </div>
          </div>

          {parsedData.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-gray-900 mb-2">Preview ({parsedData.length} products)</h4>
              <div className="max-h-[30vh] overflow-y-auto border border-gray-200 rounded-xl custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Company</th>
                      <th className="px-4 py-2 font-semibold text-gray-600">Unit</th>
                      <th className="px-4 py-2 font-semibold text-gray-600 text-right">Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-gray-900">{row.name}</td>
                        <td className="px-4 py-2 text-gray-500 capitalize">{row.type}</td>
                        <td className="px-4 py-2 text-gray-500">{row.company}</td>
                        <td className="px-4 py-2 text-gray-500">{row.unit}</td>
                        <td className="px-4 py-2 text-gray-500 text-right">{row.medicine_discount_percentage}%</td>
                      </tr>
                    ))}
                    {parsedData.length > 10 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-gray-500 italic">
                          ... and {parsedData.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button 
              variant="primary" 
              onClick={handleUploadSubmit} 
              disabled={parsedData.length === 0}
              loading={isPending || isUploading}
            >
              Import Products
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
