import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Check, Settings, Layout, Lock } from 'lucide-react';
import { useBranchStore } from '@/stores/branchStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { InvoiceTemplates, StatementTemplates } from '@/features/billing/components/templates';
import { MobileZoomableContainer } from '@/features/billing/components/MobileZoomableContainer';

// Dummy data for preview
const dummyBill = {
  bill_number: 'INV-00123',
  bill_date: new Date().toISOString(),
  total_amount: 12500,
  amount_paid: 5000,
  balance_due: 7500,
  farmer: {
    name: 'Ramesh Kumar',
    phone: '+91 9876543210',
    address: 'Bhimavaram, AP'
  },
  items: [
    { product_name: 'Vannamei Feed 3.2mm', quantity: 10, rate: 1000, total_price: 10000, tax_percentage: 5 },
    { product_name: 'Probiotics 1kg', quantity: 5, rate: 500, total_price: 2500, tax_percentage: 12 }
  ]
};

const dummyStatement = {
  openingBalance: 15000,
  closingBalance: 7500,
  totalDebit: 12500,
  totalCredit: 20000,
  farmer: { name: 'Ramesh Kumar', phone: '+91 9876543210' },
  transactions: [
    { date: new Date(Date.now() - 86400000 * 5).toISOString(), description: 'Opening Balance', type: 'debit', amount: 15000, runningBalance: 15000 },
    { date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'Payment Received', type: 'credit', amount: 20000, runningBalance: -5000 },
    { date: new Date().toISOString(), description: 'Invoice INV-00123', type: 'debit', amount: 12500, runningBalance: 7500 }
  ]
};

export const BillingTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const dealer = useAuthStore(s => s.user);
  const { getActiveBranchId, getTemplateSettings, updateTemplateSettings } = useBranchStore();
  const branchId = getActiveBranchId() || 'default';
  const savedSettings = getTemplateSettings(branchId);
  
  const hasProPlus = dealer?.plan === 'pro_plus' || useSubscriptionStore.getState().hasFeature('custom_templates');

  const [activeTab, setActiveTab] = useState<'invoice' | 'statement'>('invoice');
  const [localSettings, setLocalSettings] = useState(savedSettings);

  // Sync when branch changes
  useEffect(() => {
    setLocalSettings(getTemplateSettings(branchId));
  }, [branchId, getTemplateSettings]);

  const handleSave = () => {
    updateTemplateSettings(branchId, localSettings);
    // show toast success
  };

  const updateSetting = (key: keyof typeof localSettings, value: any) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    updateTemplateSettings(branchId, updated); // Auto-save on change for better UX
  };

  if (!hasProPlus) {
    return (
      <PageShell>
        <PageHeader title="Billing Templates" />
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl shadow-sm border border-slate-200 h-[60vh]">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Pro Plus Feature</h2>
          <p className="text-slate-600 max-w-md mb-6">
            Customizable billing and statement templates are available exclusively on the Pro Plus plan. Upgrade to unlock these premium templates.
          </p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Upgrade Plan
          </button>
        </div>
      </PageShell>
    );
  }

  const TemplateComponent = activeTab === 'invoice' 
    ? InvoiceTemplates[localSettings.invoiceTemplate] || InvoiceTemplates.template1
    : StatementTemplates[localSettings.statementTemplate] || StatementTemplates.statement1;

  const templatesList = activeTab === 'invoice' 
    ? Object.keys(InvoiceTemplates)
    : Object.keys(StatementTemplates);

  return (
    <PageShell width="wide">
      <PageHeader 
        eyebrow="Preferences"
        title="Settings"
        description="Manage your shop profile and preferences"
      />
      
      <div className="mb-8 flex overflow-x-auto hide-scrollbar items-center gap-1.5 p-1.5 bg-slate-100/60 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => window.location.href = '/settings'}
          className="relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap shrink-0 text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent"
        >
          Shop Profile
        </button>
        <button
          type="button"
          onClick={() => window.location.href = '/settings/security'}
          className="relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap shrink-0 text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 border border-transparent"
        >
          Lock Screen
        </button>
        <button
          type="button"
          className="relative px-5 py-2 text-sm font-semibold transition-all duration-200 rounded-lg whitespace-nowrap shrink-0 bg-primary text-white shadow-md ring-1 ring-primary/50"
        >
          Billing Templates
        </button>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <div className="bg-slate-100/80 p-1.5 rounded-xl flex gap-1 border border-slate-200/50 shadow-inner">
            <button 
              onClick={() => setActiveTab('invoice')}
              className={`flex-1 py-2 text-sm font-bold rounded-[10px] transition-all duration-200 ${activeTab === 'invoice' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              Invoices
            </button>
            <button 
              onClick={() => setActiveTab('statement')}
              className={`flex-1 py-2 text-sm font-bold rounded-[10px] transition-all duration-200 ${activeTab === 'statement' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              Statements
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Layout className="w-5 h-5 text-blue-500" />
              Select Template
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {templatesList.map(key => {
                const isActive = activeTab === 'invoice' 
                  ? localSettings.invoiceTemplate === key 
                  : localSettings.statementTemplate === key;
                  
                return (
                  <button
                    key={key}
                    onClick={() => updateSetting(activeTab === 'invoice' ? 'invoiceTemplate' : 'statementTemplate', key)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                      isActive 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="capitalize">{key.replace(/([A-Z0-9])/g, ' $1').trim()}</span>
                      {isActive && <Check className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="w-full h-12 bg-white border border-slate-200 rounded opacity-50 overflow-hidden flex flex-col gap-1 p-1">
                       <div className="h-2 w-1/3 bg-slate-300 rounded"></div>
                       <div className="h-1 w-full bg-slate-200 rounded mt-1"></div>
                       <div className="h-1 w-full bg-slate-200 rounded"></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Settings className="w-5 h-5 text-blue-500" />
              Customization
            </h3>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Show Shop Logo</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                checked={localSettings.showLogo !== false}
                onChange={e => updateSetting('showLogo', e.target.checked)}
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Show Shop Address</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                checked={localSettings.showShopAddress !== false}
                onChange={e => updateSetting('showShopAddress', e.target.checked)}
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Show Tax Breakdown</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                checked={localSettings.showTax !== false}
                onChange={e => updateSetting('showTax', e.target.checked)}
              />
            </label>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Show Authorized Signature</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                checked={localSettings.showSignatureLine !== false}
                onChange={e => updateSetting('showSignatureLine', e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Live Preview Pane */}
        <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200">
          <div className="bg-slate-200 px-4 py-2 text-xs font-medium text-slate-600 text-center uppercase tracking-wider">
            Live Preview (A4 Size)
          </div>
          <div className="h-[calc(100vh-200px)] overflow-auto p-4 lg:p-8">
            <div className="flex sm:justify-center min-w-max">
              <div className="bg-white shadow-2xl shrink-0" style={{ width: '794px', minHeight: '1123px' }}>
                <TemplateComponent 
                  bill={activeTab === 'invoice' ? dummyBill : dummyStatement} 
                  dealer={dealer} 
                  settings={localSettings} 
                  type={activeTab}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
};
