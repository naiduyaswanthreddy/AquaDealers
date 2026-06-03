import React, { useState, useEffect } from 'react';
import { useCreateProduct, useUpdateProduct } from '@/admin/hooks/useAdminProducts';
import { X, Save } from 'lucide-react';
import { Product } from '@/types/database';

interface ProductFormSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType: 'feed' | 'medicine';
  product?: Product;
}

const ProductFormSlideOver: React.FC<ProductFormSlideOverProps> = ({ isOpen, onClose, defaultType, product }) => {
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateProduct();
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProduct();

  const [formData, setFormData] = useState({
    type: defaultType,
    name: '',
    company: '',
    variant: '',
    unit: defaultType === 'feed' ? 'bag' : 'bottle',
    hsn_code: defaultType === 'feed' ? '2309' : '',
    gst_rate: 0,
    default_price: '',
    track_expiry: defaultType === 'medicine',
    is_active: true,
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        type: product.type as any,
        name: product.name,
        company: product.company || '',
        variant: product.variant || '',
        unit: product.unit || '',
        hsn_code: product.hsn_code || '',
        gst_rate: product.gst_rate || 0,
        default_price: product.default_price ? product.default_price.toString() : '',
        track_expiry: product.track_expiry || false,
        is_active: product.is_active || true,
      });
    }
  }, [product]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      ...formData,
      gst_rate: Number(formData.gst_rate),
      default_price: formData.default_price ? Number(formData.default_price) : null,
    };

    try {
      if (product) {
        await updateProduct({ id: product.id, updates: payload });
      } else {
        await createProduct(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    }
  };

  const isPending = isCreating || isUpdating;

  return (
    <div className="admin-modal-overlay" style={{ justifyContent: 'flex-end' }}>
      <div 
        className="admin-modal" 
        style={{ 
          height: '100vh', 
          maxHeight: '100vh', 
          borderRadius: 0, 
          width: 480, 
          animation: 'adminSlideLeft 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="admin-modal-header">
          <h2 className="admin-card-title">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="admin-btn-ghost" style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            
            {error && (
              <div style={{ padding: 12, background: 'var(--admin-danger-bg)', color: 'var(--admin-danger)', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="admin-label">Product Type</label>
                <select 
                  className="admin-select" 
                  value={formData.type} 
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                  style={{ width: '100%' }}
                >
                  <option value="feed">Feed Bag</option>
                  <option value="medicine">Medicine</option>
                </select>
              </div>
              <div>
                <label className="admin-label">Unit</label>
                <select 
                  className="admin-select" 
                  value={formData.unit} 
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="bag">Bag</option>
                  <option value="kg">Kg</option>
                  <option value="liter">Liter</option>
                  <option value="bottle">Bottle</option>
                  <option value="piece">Piece</option>
                </select>
              </div>
            </div>

            <div>
              <label className="admin-label">Product Name</label>
              <input 
                className="admin-input" 
                value={formData.name} 
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g. Supreme Starter"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="admin-label">Company</label>
                <input 
                  className="admin-input" 
                  value={formData.company} 
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="e.g. Avanti"
                />
              </div>
              <div>
                <label className="admin-label">Variant / Size</label>
                <input 
                  className="admin-input" 
                  value={formData.variant} 
                  onChange={(e) => setFormData(prev => ({ ...prev, variant: e.target.value }))}
                  placeholder="e.g. 1.8mm or 25kg"
                />
              </div>
            </div>

            <hr className="admin-divider" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="admin-label">HSN Code</label>
                <input 
                  className="admin-input admin-mono" 
                  value={formData.hsn_code} 
                  onChange={(e) => setFormData(prev => ({ ...prev, hsn_code: e.target.value }))}
                  placeholder="e.g. 2309"
                />
              </div>
              <div>
                <label className="admin-label">GST Rate (%)</label>
                <select 
                  className="admin-select" 
                  value={formData.gst_rate} 
                  onChange={(e) => setFormData(prev => ({ ...prev, gst_rate: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                >
                  <option value={0}>0% (Tax Free)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="admin-label">Default Selling Price (₹)</label>
              <input 
                type="number"
                className="admin-input" 
                value={formData.default_price} 
                onChange={(e) => setFormData(prev => ({ ...prev, default_price: e.target.value }))}
                placeholder="Optional suggested price"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <input 
                type="checkbox" 
                id="track_expiry"
                checked={formData.track_expiry}
                onChange={(e) => setFormData(prev => ({ ...prev, track_expiry: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="track_expiry" style={{ fontSize: 13, color: 'var(--admin-text)', cursor: 'pointer' }}>
                Track Batch Number & Expiry Date
              </label>
            </div>

          </div>

          <div className="admin-modal-footer">
            <button type="button" onClick={onClose} className="admin-btn admin-btn-outline">
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={isPending}>
              {isPending ? 'Saving...' : <><Save size={16} /> {product ? 'Save Changes' : 'Create Product'}</>}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes adminSlideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default ProductFormSlideOver;
