import React, { useState } from 'react';
import { useAdminPlans, useUpdatePlan } from '@/admin/hooks/useAdminSettings';
import { Settings, Save, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const AdminSettingsPage: React.FC = () => {
  const { data: plans, isLoading } = useAdminPlans();
  const { mutateAsync: updatePlan, isPending } = useUpdatePlan();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  
  const [editingFeaturesPlan, setEditingFeaturesPlan] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const handleEditPrice = (planId: string, currentPrice: number) => {
    setEditingPlan(planId);
    setEditPrice(currentPrice.toString());
  };

  const handleEditFeatures = (planId: string, currentFeatures: string[] | Record<string, boolean>) => {
    setEditingFeaturesPlan(planId);
    // Handle both array and object formats for backward compatibility
    if (Array.isArray(currentFeatures)) {
      setSelectedFeatures(currentFeatures);
    } else if (typeof currentFeatures === 'object' && currentFeatures !== null) {
      setSelectedFeatures(Object.keys(currentFeatures).filter(k => (currentFeatures as any)[k]));
    } else {
      setSelectedFeatures([]);
    }
  };

  const ALL_FEATURES = [
    { key: 'core', label: 'Core Features' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'cashbook', label: 'Cashbook' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'export', label: 'Export Data' },
    { key: 'whatsapp', label: 'WhatsApp Receipts' },
    { key: 'gst', label: 'GST Billing' },
    { key: 'reports', label: 'Advanced Reports' },
    { key: 'voice', label: 'Voice Search' },
    { key: 'multilang', label: 'Multilingual' },
    { key: 'pdf', label: 'PDF Generation' },
    { key: 'priority_support', label: 'Priority Support' },
    { key: 'app_pin', label: 'App PIN' },
    { key: 'staff', label: 'Staff Logins' },
    { key: 'signature_proof', label: 'Signature Proof' },
    { key: 'farmer_photo', label: 'Farmer Photos' },
  ];

  const handleSavePrice = async (planId: string) => {
    if (!editPrice) return;
    try {
      await updatePlan({ id: planId, updates: { price_monthly: parseFloat(editPrice) } });
      setEditingPlan(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveFeatures = async (planId: string) => {
    try {
      await updatePlan({ id: planId, updates: { features: selectedFeatures } });
      setEditingFeaturesPlan(null);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={22} /> Platform Settings
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          Manage global configurations and SaaS pricing plans.
        </p>
      </div>

      <div className="admin-card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>SaaS Plan Definitions</h2>
        
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {plans?.filter((plan: any) => plan.name !== 'trial').map((plan: any) => (
              <div key={plan.id} style={{ padding: 20, border: '1px solid var(--admin-border)', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{plan.name} Plan</h3>
                    <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                      Limits: {plan.farmer_limit ? `${plan.farmer_limit} Farmers` : 'Unlimited Farmers'}
                    </p>
                  </div>
                  <span className={`admin-badge ${plan.name}`}>{plan.name}</span>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="admin-label">Yearly Price (₹)</label>
                  {editingPlan === plan.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="number" 
                        className="admin-input" 
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button 
                        className="admin-btn admin-btn-success" 
                        onClick={() => handleSavePrice(plan.id)}
                        disabled={isPending}
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 24, fontWeight: 800 }}>{formatCurrency(plan.price_monthly || 0)}</span>
                      <button 
                        className="admin-btn admin-btn-outline" 
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => handleEditPrice(plan.id, plan.price_monthly)}
                      >
                        Edit Price
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label className="admin-label" style={{ marginBottom: 0 }}>Included Features</label>
                  {editingFeaturesPlan !== plan.id && (
                    <button 
                      className="admin-btn admin-btn-ghost" 
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => handleEditFeatures(plan.id, plan.features || [])}
                    >
                      Edit Features
                    </button>
                  )}
                </div>
                
                {editingFeaturesPlan === plan.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                      {ALL_FEATURES.map(f => (
                        <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedFeatures.includes(f.key)}
                            onChange={() => toggleFeature(f.key)}
                            style={{ accentColor: 'var(--admin-primary)' }}
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button 
                        className="admin-btn admin-btn-ghost" 
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => setEditingFeaturesPlan(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="admin-btn admin-btn-primary" 
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => handleSaveFeatures(plan.id)}
                        disabled={isPending}
                      >
                        {isPending ? 'Saving...' : 'Save Features'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(() => {
                      const features = Array.isArray(plan.features) ? plan.features : 
                                      Object.keys(plan.features || {}).filter(k => plan.features[k]);
                      
                      if (features.length === 0) {
                        return <span style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>No features enabled</span>;
                      }

                      return features.map((featureKey: string) => {
                        const featureObj = ALL_FEATURES.find(f => f.key === featureKey);
                        const label = featureObj ? featureObj.label : featureKey.replace(/_/g, ' ');
                        return (
                          <div key={featureKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <Check size={14} color="var(--admin-success)" />
                            <span style={{ color: 'var(--admin-text)' }}>{label}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Advanced System Config</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--admin-border)' }}>
            <div>
              <p style={{ fontWeight: 600 }}>Maintenance Mode</p>
              <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>Locks out all dealer access with a maintenance screen.</p>
            </div>
            <button className="admin-btn admin-btn-outline" disabled>Configure</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--admin-border)' }}>
            <div>
              <p style={{ fontWeight: 600 }}>Require OTP for Login</p>
              <p style={{ fontSize: 13, color: 'var(--admin-text-muted)' }}>Enforce SMS OTP for all dealer app logins.</p>
            </div>
            <button className="admin-btn admin-btn-outline" disabled>Configure</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--admin-text-dim)', textAlign: 'right' }}>
            System configurations are managed via environment variables in production.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
