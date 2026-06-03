import React, { useState } from 'react';
import { useAdminProducts, useToggleProductActive } from '@/admin/hooks/useAdminProducts';
import { Package, Plus, Search, Edit2 } from 'lucide-react';
import ProductFormSlideOver from '../components/products/ProductFormSlideOver';
import { Product } from '@/types/database';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

type Tab = 'feed' | 'medicine';

const ProductCatalogPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [search, setSearch] = useState('');
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

  const { data: products, isLoading } = useAdminProducts(activeTab);
  const { mutate: toggleActive } = useToggleProductActive();

  const filteredProducts = (products || []).filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || 
           (p.company && p.company.toLowerCase().includes(s)) ||
           (p.variant && p.variant.toLowerCase().includes(s));
  });
  const pagedProducts = useLoadMoreList(filteredProducts, {
    initialCount: 12,
    step: 12,
    resetDeps: [activeTab, search, filteredProducts.length],
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsSlideOverOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(undefined);
    setIsSlideOverOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={22} /> Master Product Catalog
          </h1>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
            Global products shared across all dealers.
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={handleCreate}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div style={{ padding: 12, background: 'rgba(56, 139, 253, 0.1)', border: '1px solid rgba(56, 139, 253, 0.3)', borderRadius: 8 }}>
        <p style={{ fontSize: 13, color: 'var(--admin-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <strong>Important:</strong> Changes made here are immediately visible to all dealers. Modifying GST rates affects all future bills.
        </p>
      </div>

      {/* Tabs & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--admin-border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <button
            onClick={() => setActiveTab('feed')}
            style={{
              padding: '0 4px 16px', marginBottom: -17,
              background: 'none', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'feed' ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
              borderBottom: activeTab === 'feed' ? '2px solid var(--admin-accent)' : '2px solid transparent',
            }}
          >
            🐟 Feed Bags
          </button>
          <button
            onClick={() => setActiveTab('medicine')}
            style={{
              padding: '0 4px 16px', marginBottom: -17,
              background: 'none', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'medicine' ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
              borderBottom: activeTab === 'medicine' ? '2px solid var(--admin-accent)' : '2px solid transparent',
            }}
          >
            💊 Medicines
          </button>
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-dim)'
          }} />
          <input
            type="text"
            placeholder="Search products..."
            className="admin-input"
            style={{ paddingLeft: 36, padding: '8px 12px 8px 36px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-wrapper">
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
             <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            No products found in this category.
          </div>
        ) : (
          <>
            <table className="admin-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Product Name</th>
                <th>Variant / Size</th>
                <th>Unit</th>
                <th>HSN Code</th>
                <th>GST %</th>
                {activeTab === 'medicine' && <th>Expiry Track</th>}
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedProducts.visibleItems.map((p) => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--admin-text-muted)' }}>{p.company || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.variant || '—'}</td>
                  <td>{p.unit}</td>
                  <td className="admin-mono">{p.hsn_code || '—'}</td>
                  <td>{p.gst_rate}%</td>
                  {activeTab === 'medicine' && (
                    <td>{p.track_expiry ? 'Yes' : 'No'}</td>
                  )}
                  <td>
                    <button 
                      onClick={() => toggleActive({ id: p.id, isActive: !p.is_active })}
                      style={{
                        background: p.is_active ? 'var(--admin-success-bg)' : 'rgba(255,255,255,0.1)',
                        color: p.is_active ? 'var(--admin-success)' : 'var(--admin-text-muted)',
                        border: 'none', padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <button className="admin-btn admin-btn-ghost" onClick={() => handleEdit(p)}>
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListLoadMore
            shown={pagedProducts.visibleCount}
            total={pagedProducts.totalCount}
            onLoadMore={pagedProducts.loadMore}
            label="Load more products"
          />
          </>
        )}
      </div>

      {isSlideOverOpen && (
        <ProductFormSlideOver 
          isOpen={isSlideOverOpen}
          onClose={() => setIsSlideOverOpen(false)}
          defaultType={activeTab}
          product={editingProduct}
        />
      )}
    </div>
  );
};

export default ProductCatalogPage;
