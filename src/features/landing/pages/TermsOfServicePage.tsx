import React, { useEffect } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsOfServicePage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Terms of Service</h1>
            <p className="text-slate-500 mt-1">Effective Date: {new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <div className="prose prose-slate prose-blue max-w-none prose-headings:font-bold prose-headings:tracking-tight">
          <p className="text-lg text-slate-600 leading-relaxed font-medium">
            Welcome to AquaDealers. Built by industry veterans with over 10 years of experience in the aquaculture sector, we understand the specific needs of dealers in India. By using our software, you agree to these terms. Please read them carefully.
          </p>

          <hr className="border-slate-200 my-8" />

          <h3>1. Acceptance of Terms</h3>
          <p>
            By accessing or using the AquaDealers platform ("Software"), you confirm your acceptance of these Terms of Service. If you do not agree, you must not use our services.
          </p>

          <h3>2. Nature of the Service</h3>
          <p>
            AquaDealers provides a digital ledger, billing, and inventory management tool tailored for aquaculture dealers. <strong>We are a software provider, not a financial institution, auditor, or dispute resolution body.</strong>
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 my-8">
            <h4 className="text-amber-800 mt-0 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Critical Disclaimer of Liability
            </h4>
            <p className="text-amber-900 mb-0 font-medium leading-relaxed">
              AquaDealers is purely a record-keeping software. <strong>We are entirely exempt and hold no legal responsibility for the accuracy, validity, or legality of the financial entries, bills, or ledgers created by you (the Dealer) within the system.</strong> 
              <br /><br />
              In the event of a financial dispute between you and a farmer (e.g., regarding bill amounts, payments, or ledger balances), AquaDealers cannot be held liable. The responsibility to ensure data accuracy and resolve disputes lies solely with the business owner using this platform.
            </p>
          </div>

          <h3>3. Data Ownership and Privacy</h3>
          <p>
            You own the data you input into AquaDealers. We use industry-standard security measures to protect your data. However, you are responsible for maintaining the confidentiality of your account credentials. We will never sell your individual customer data to third parties. Please review our Privacy Policy for more details.
          </p>

          <h3>4. Account Responsibilities</h3>
          <p>
            You agree to provide accurate registration information and keep it updated. You are responsible for all activities that occur under your account. If you suspect unauthorized access, you must notify us immediately.
          </p>

          <h3>5. Subscription and Billing</h3>
          <p>
            AquaDealers is offered as a Software-as-a-Service (SaaS). We offer a free tier with specific limits. Once you exceed these limits, or if you opt for premium features, you agree to pay the associated subscription fees. We reserve the right to suspend accounts with unpaid invoices.
          </p>

          <h3>6. Service Availability</h3>
          <p>
            While we strive for 99.9% uptime, AquaDealers is provided on an "as is" and "as available" basis. We do not warrant that the service will be uninterrupted, error-free, or completely secure. We are not liable for business losses incurred due to temporary downtime.
          </p>

          <h3>7. Modifications to the Service and Terms</h3>
          <p>
            We continually improve AquaDealers and may add, modify, or remove features. We may also update these Terms periodically. Continued use of the Software after updates constitutes your acceptance of the revised Terms.
          </p>

          <h3>8. Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of these Terms shall be subject to the exclusive jurisdiction of the courts located in Andhra Pradesh, India.
          </p>

          <hr className="border-slate-200 my-8" />
          
          <p className="text-sm text-slate-500">
            For any legal inquiries or questions regarding these terms, please contact us at <strong>aquadealers.in@gmail.com</strong>.
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsOfServicePage;
