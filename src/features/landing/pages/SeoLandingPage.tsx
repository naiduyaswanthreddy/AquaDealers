import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  MessageCircle,
  Package,
  Phone,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import Seo, { buildUrl } from '@/components/seo/Seo';

const CONTACT_EMAIL = 'aquadealers.in@gmail.com';
const PHONE_DISPLAY = '+91 72071 71544';
const PHONE_HREF = 'tel:7207171544';
const WHATSAPP_URL = 'https://wa.me/917207171544';
const YOUTUBE_URL = 'https://youtube.com/@aquadealers?si=sZUYaQ7vRPHjh8zm';

type PageKey =
  | 'features'
  | 'pricing'
  | 'contact'
  | 'feedBilling'
  | 'medicineInventory'
  | 'dealerManagement'
  | 'stockManagement';

interface SeoPageConfig {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  focus: string[];
  sections: Array<{
    icon: React.ElementType;
    title: string;
    body: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}

const pages: Record<PageKey, SeoPageConfig> = {
  features: {
    path: '/features',
    eyebrow: 'AquaDealers Features',
    title: 'AquaDealers Features | Billing, Stock, Dues and Reports',
    description:
      'Explore AquaDealers features for aqua feed and medicine shops: billing, inventory, farmer dues, suppliers, reports, cashbook, and WhatsApp-ready bills.',
    primaryCta: 'Book a Demo',
    secondaryCta: 'View Pricing',
    focus: ['GST billing', 'Stock control', 'Farmer dues', 'Supplier purchases', 'Cashbook', 'Reports'],
    sections: [
      {
        icon: FileText,
        title: 'Fast billing for daily counter sales',
        body: 'Create professional bills for feed, medicine, and mixed carts with clear payment status and customer history.',
      },
      {
        icon: Package,
        title: 'Inventory built for aqua shops',
        body: 'Track feed and medicine stock, low-stock items, product rates, purchase entries, and item movement in one place.',
      },
      {
        icon: Users,
        title: 'Farmer dues and ledgers',
        body: 'Maintain farmer balances, credit limits, collection reminders, and ledger statements without relying on paper notebooks.',
      },
      {
        icon: BarChart3,
        title: 'Reports for owner decisions',
        body: 'Review sales, collections, stock movement, cashbook, expenses, GST reports, and daily summaries from the same workspace.',
      },
    ],
    faqs: [
      {
        question: 'Can AquaDealers manage both feed and medicine stock?',
        answer: 'Yes. AquaDealers is built for aqua feed and medicine dealers, including billing, stock, dues, purchase, and reporting workflows.',
      },
      {
        question: 'Can bills be shared on WhatsApp?',
        answer: 'Yes. Dealers can share professional PDF bills and statements with customers through WhatsApp-supported workflows.',
      },
    ],
  },
  pricing: {
    path: '/pricing',
    eyebrow: 'Pricing and Demo',
    title: 'AquaDealers Pricing | Start With a Demo or Free Trial',
    description:
      'Start AquaDealers with a demo for your aqua feed or medicine shop. Get billing, inventory, farmer dues, reports, and support for Indian dealers.',
    primaryCta: 'Call for Pricing',
    secondaryCta: 'Contact Us',
    focus: ['14-day trial', 'No credit card setup', 'Dealer support', 'Custom workflows'],
    sections: [
      {
        icon: CreditCard,
        title: 'Simple start for local dealers',
        body: 'Begin with a guided demo and trial so your team can check billing, inventory, farmer dues, and reporting before committing.',
      },
      {
        icon: ShieldCheck,
        title: 'Support during setup',
        body: 'Get help configuring your product catalog, opening stock, farmer records, and shop details for a cleaner first week.',
      },
      {
        icon: MessageCircle,
        title: 'Custom workflow discussion',
        body: 'If your shop has a unique report, billing format, or collection process, discuss it directly with the AquaDealers team.',
      },
    ],
    faqs: [
      {
        question: 'Is there a free trial?',
        answer: 'The current landing page promotes a 14-day free trial. Contact AquaDealers to confirm the latest plan and setup process.',
      },
      {
        question: 'Do I need a credit card to start?',
        answer: 'No credit card is required for the trial flow described on the AquaDealers landing page.',
      },
    ],
  },
  contact: {
    path: '/contact',
    eyebrow: 'Contact AquaDealers',
    title: 'Contact AquaDealers | Demo for Aqua Feed and Medicine Dealers',
    description:
      'Contact AquaDealers for a demo of billing, stock management, farmer dues, and reports for aqua feed and medicine dealers in India.',
    primaryCta: 'WhatsApp Us',
    secondaryCta: 'Call Now',
    focus: [PHONE_DISPLAY, CONTACT_EMAIL, 'India service area', 'YouTube demos'],
    sections: [
      {
        icon: Phone,
        title: 'Talk to the team',
        body: `Call or WhatsApp ${PHONE_DISPLAY} to discuss your shop workflow, demo timing, and setup needs.`,
      },
      {
        icon: MessageCircle,
        title: 'Send your requirements',
        body: `Email ${CONTACT_EMAIL} with your shop type, branches, products, and current billing process.`,
      },
      {
        icon: ShieldCheck,
        title: 'Built for Indian aqua businesses',
        body: 'AquaDealers focuses on aqua feed shops, medicine shops, multi-branch dealers, and farm consultants across India.',
      },
    ],
    faqs: [
      {
        question: 'What is the fastest way to contact AquaDealers?',
        answer: `WhatsApp or call ${PHONE_DISPLAY} for a product demo or setup discussion.`,
      },
      {
        question: 'Can I watch a demo first?',
        answer: 'Yes. AquaDealers shares product updates and demo content on its YouTube channel.',
      },
    ],
  },
  feedBilling: {
    path: '/aqua-feed-billing-software',
    eyebrow: 'Aqua Feed Billing Software',
    title: 'Aqua Feed Billing Software for Dealers | AquaDealers',
    description:
      'Aqua feed billing software for Indian dealers. Create bills, manage credit sales, farmer dues, payments, PDF invoices, and daily sales reports.',
    primaryCta: 'Book Feed Billing Demo',
    secondaryCta: 'See Features',
    focus: ['Feed bills', 'Credit sales', 'Farmer dues', 'PDF invoices', 'Daily collections'],
    sections: [
      {
        icon: FileText,
        title: 'Bills made for aqua feed sales',
        body: 'Handle counter sales, credit bills, farmer-specific pricing, and clean PDF invoices without rewriting entries in notebooks.',
      },
      {
        icon: Users,
        title: 'Credit and collection clarity',
        body: 'Know which farmer owes what, what was collected today, and which balances need follow-up before they become disputes.',
      },
      {
        icon: TrendingUp,
        title: 'Sales and payment reports',
        body: 'Track daily sales, cash received, credit given, and pending dues so owners can review business health quickly.',
      },
    ],
    faqs: [
      {
        question: 'Is AquaDealers useful for feed-only shops?',
        answer: 'Yes. Feed dealers can use AquaDealers for billing, farmer dues, sales reports, and stock tracking even without medicine inventory.',
      },
      {
        question: 'Can it manage farmer credit bills?',
        answer: 'Yes. AquaDealers is designed around farmer dues, credit sales, payment collection, and ledger visibility.',
      },
    ],
  },
  medicineInventory: {
    path: '/aqua-medicine-inventory-software',
    eyebrow: 'Aqua Medicine Inventory Software',
    title: 'Aqua Medicine Inventory Software | AquaDealers',
    description:
      'Manage aqua medicine stock, expiry visibility, discounts, billing, purchases, and reports with AquaDealers inventory software for dealers.',
    primaryCta: 'Book Medicine Inventory Demo',
    secondaryCta: 'Explore Stock Tools',
    focus: ['Medicine stock', 'Expiry tracking', 'Product discounts', 'Purchase entries', 'Stock reports'],
    sections: [
      {
        icon: Package,
        title: 'Know what medicine is available',
        body: 'Keep medicine stock organized with product details, rates, purchase entries, and stock movement history.',
      },
      {
        icon: ShieldCheck,
        title: 'Reduce expiry and pricing mistakes',
        body: 'Use stock visibility and reports to identify expiring products, low stock, and pricing changes before they hurt margins.',
      },
      {
        icon: Users,
        title: 'Farmer-specific medicine discounts',
        body: 'Support customer-specific pricing workflows so the counter team can bill consistently without remembering every exception.',
      },
    ],
    faqs: [
      {
        question: 'Can AquaDealers track aqua medicine inventory?',
        answer: 'Yes. AquaDealers includes medicine inventory workflows, stock reporting, product rates, and billing support.',
      },
      {
        question: 'Does it help with expiring medicines?',
        answer: 'AquaDealers includes expiry-focused reporting workflows so dealers can review medicines that need attention.',
      },
    ],
  },
  dealerManagement: {
    path: '/aquaculture-dealer-management-software',
    eyebrow: 'Aquaculture Dealer Management Software',
    title: 'Aquaculture Dealer Management Software in India | AquaDealers',
    description:
      'AquaDealers helps aquaculture dealers in India manage billing, stock, farmer dues, suppliers, cashbook, reports, and multi-branch operations.',
    primaryCta: 'Book Dealer Management Demo',
    secondaryCta: 'View Features',
    focus: ['Aqua dealers India', 'Billing', 'Inventory', 'Suppliers', 'Cashbook', 'Reports'],
    sections: [
      {
        icon: BarChart3,
        title: 'One workspace for the whole shop',
        body: 'Bring billing, stock, farmer ledgers, purchases, expenses, and reports into a single dealer management system.',
      },
      {
        icon: Users,
        title: 'Built around farmer relationships',
        body: 'Track customer dues, balances, statements, reminders, and collection history with the context aqua dealers need.',
      },
      {
        icon: ShieldCheck,
        title: 'Designed for practical Indian operations',
        body: 'AquaDealers supports phone-first usage, WhatsApp sharing, local shop workflows, and business visibility for owners.',
      },
    ],
    faqs: [
      {
        question: 'Who is AquaDealers built for?',
        answer: 'AquaDealers is built for Indian aqua feed dealers, aqua medicine dealers, multi-branch stores, and farm consultants.',
      },
      {
        question: 'Can it replace paper ledgers?',
        answer: 'Yes. AquaDealers helps digitize bills, farmer balances, product stock, daily reports, and collection records.',
      },
    ],
  },
  stockManagement: {
    path: '/stock-management-for-aqua-dealers',
    eyebrow: 'Stock Management for Aqua Dealers',
    title: 'Stock Management for Aqua Dealers | AquaDealers',
    description:
      'Track aqua feed and medicine stock, purchases, low-stock items, stock movement, rate changes, and reports with AquaDealers.',
    primaryCta: 'Book Stock Demo',
    secondaryCta: 'See Inventory Features',
    focus: ['Low stock alerts', 'Stock ledger', 'Purchase entries', 'Rate changes', 'Feed and medicine'],
    sections: [
      {
        icon: Package,
        title: 'Feed and medicine stock in one view',
        body: 'See available quantities, product categories, rates, and movement history without switching between notebooks and spreadsheets.',
      },
      {
        icon: TrendingUp,
        title: 'Handle purchases and rate changes',
        body: 'Record inward stock from suppliers and use stock reports to understand movement, value, and rate impact.',
      },
      {
        icon: BarChart3,
        title: 'Reports that support restocking',
        body: 'Review low-stock items, stock ledgers, sold items, and item movement so purchase decisions are based on real activity.',
      },
    ],
    faqs: [
      {
        question: 'Can AquaDealers track feed and medicine stock together?',
        answer: 'Yes. AquaDealers supports inventory workflows for both aqua feed and aqua medicine dealers.',
      },
      {
        question: 'Does AquaDealers support stock reports?',
        answer: 'Yes. Stock ledger and movement reporting help dealers review sales, purchases, and available stock.',
      },
    ],
  },
};

const pageSchema = (page: SeoPageConfig) => [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AquaDealers',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: buildUrl(page.path),
    description: page.description,
    areaServed: 'India',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  },
];

interface SeoLandingPageProps {
  pageKey: PageKey;
}

export const SeoLandingPage: React.FC<SeoLandingPageProps> = ({ pageKey }) => {
  const page = pages[pageKey];
  const primaryHref = pageKey === 'contact' ? WHATSAPP_URL : PHONE_HREF;
  const secondaryHref = pageKey === 'pricing' || pageKey === 'contact' ? PHONE_HREF : '/features';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Seo title={page.title} description={page.description} path={page.path} jsonLd={pageSchema(page)} />

      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="AquaDealers" className="h-8 w-auto" />
            <span className="text-lg font-black tracking-tight text-slate-900">AquaDealers</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
            <Link to="/features" className="hover:text-blue-600">Features</Link>
            <Link to="/pricing" className="hover:text-blue-600">Pricing</Link>
            <Link to="/contact" className="hover:text-blue-600">Contact</Link>
          </div>
          <a href={WHATSAPP_URL} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">
            WhatsApp
          </a>
        </div>
      </nav>

      <section className="border-b border-slate-200 bg-white px-6 py-20 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-blue-600">{page.eyebrow}</p>
            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">
              {page.title.replace(' | AquaDealers', '').replace('AquaDealers | ', '')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600">{page.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={primaryHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                {page.primaryCta} <ArrowRight className="h-5 w-5" />
              </a>
              {secondaryHref.startsWith('/') ? (
                <Link
                  to={secondaryHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 font-black text-slate-800 hover:bg-slate-200"
                >
                  {page.secondaryCta}
                </Link>
              ) : (
                <a
                  href={secondaryHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 font-black text-slate-800 hover:bg-slate-200"
                >
                  {page.secondaryCta}
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/50">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Dealer Snapshot</div>
                <div className="mt-1 text-2xl font-black">Built for shop control</div>
              </div>
              <ShieldCheck className="h-9 w-9 text-green-400" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {page.focus.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-100">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-green-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">What this helps you manage</h2>
            <p className="mt-3 text-lg text-slate-600">
              Clear workflows for real aqua shops: faster billing, cleaner stock, better collections, and owner-level reports.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {page.sections.map((section) => {
              const Icon = section.icon;
              return (
                <article key={section.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-950">{section.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{section.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950">Questions dealers ask</h2>
            <p className="mt-3 text-slate-600">
              These answers match the structured FAQ data Google can read from this page.
            </p>
          </div>
          <div className="space-y-4">
            {page.faqs.map((faq) => (
              <article key={faq.question} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-black text-slate-950">{faq.question}</h3>
                <p className="mt-2 leading-7 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black">Ready to see AquaDealers?</h2>
            <p className="mt-2 text-slate-300">
              Contact {PHONE_DISPLAY} or {CONTACT_EMAIL} for a demo.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={WHATSAPP_URL} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-500 px-6 py-3 font-black text-white hover:bg-green-600">
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </a>
            <a href={YOUTUBE_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 font-black text-slate-950 hover:bg-slate-100">
              Watch Demos
            </a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default SeoLandingPage;
