import React from 'react';
import { Check } from 'lucide-react';

interface PlanCard {
  name: string;
  listPrice: number;
  offerPrice: number;
  highlight?: boolean;
  features: string[];
}

const PLANS: PlanCard[] = [
  {
    name: 'Basic',
    listPrice: 9000,
    offerPrice: 6500,
    features: [
      'Core billing & inventory',
      'Expense tracking',
      'Cash book',
      'Supplier management',
      'Data export',
      'WhatsApp bill sharing',
    ],
  },
  {
    name: 'Pro',
    listPrice: 10000,
    offerPrice: 7500,
    highlight: true,
    features: [
      'Everything in Basic',
      'GST billing',
      'Advanced reports',
      'Voice search',
      'Multi-language (Telugu, Hindi, English)',
      'PDF invoices',
      'Priority support',
      'App PIN lock',
      'Signature proof on credit bills',
    ],
  },
  {
    name: 'Pro+',
    listPrice: 15000,
    offerPrice: 10000,
    features: [
      'Everything in Pro',
      'Staff logins (up to 10)',
      'Farmer photo capture',
      'Farmer-specific product discounts',
      'Product images',
      'Unlimited branches',
    ],
  },
];

const formatINR = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export const PricingSection: React.FC = () => (
  <section id="pricing" className="py-20 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Simple, per-year pricing</h2>
        <p className="mt-3 text-slate-500 text-lg">No hidden fees. Cancel anytime. Prices are per shop, per year.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border p-8 flex flex-col ${
              plan.highlight ? 'border-blue-600 shadow-lg ring-1 ring-blue-100 relative' : 'border-slate-200'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most Popular
              </span>
            )}
            <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{formatINR(plan.offerPrice)}</span>
              <span className="text-slate-400 line-through text-sm">{formatINR(plan.listPrice)}</span>
              <span className="text-slate-500 text-sm">/ year</span>
            </div>
            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href="tel:7207171544"
              className={`mt-8 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
                plan.highlight
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              Get Started
            </a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
