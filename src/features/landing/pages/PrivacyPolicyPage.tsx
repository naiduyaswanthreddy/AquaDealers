import React, { useEffect } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
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
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
            <p className="text-slate-500 mt-1">Effective Date: {new Date().toLocaleDateString('en-IN')}</p>
          </div>
        </div>

        <div className="prose prose-slate prose-green max-w-none prose-headings:font-bold prose-headings:tracking-tight">
          <p className="text-lg text-slate-600 leading-relaxed font-medium">
            At AquaDealers, we take your privacy and the security of your business data seriously. We built this platform to empower aquaculture dealers, and protecting your confidential trade information is our top priority.
          </p>

          <hr className="border-slate-200 my-8" />

          <h3>1. Information We Collect</h3>
          <p>
            When you use AquaDealers, we collect the following types of information:
          </p>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, phone number, and business details (e.g., Shop Name, GSTIN) provided during registration.</li>
            <li><strong>Customer & Financial Data:</strong> Information you input into the system regarding your farmers, inventory, bills, payments, and ledgers.</li>
            <li><strong>Usage Data:</strong> Anonymous analytics data on how you interact with our software (e.g., pages visited, features used) to help us improve the platform.</li>
          </ul>

          <h3>2. How We Use Your Information</h3>
          <p>
            Your data is used strictly to provide and improve the AquaDealers service:
          </p>
          <ul>
            <li>To operate and maintain your digital ledger and billing system.</li>
            <li>To send you important technical notices, updates, and security alerts.</li>
            <li>To provide customer support.</li>
            <li>To monitor usage trends and improve the software experience.</li>
          </ul>

          <h3>3. Data Security & Storage</h3>
          <p>
            We implement robust security measures to protect your data. Your information is stored on secure cloud servers with encryption in transit and at rest. We utilize modern authentication protocols to ensure only you and your authorized staff can access your shop's data.
          </p>

          <h3>4. Data Sharing & Third Parties</h3>
          <p>
            <strong>We will NEVER sell your customer lists, financial data, or trade secrets to third parties, competitors, or marketing agencies.</strong> 
          </p>
          <p>
            We may share limited data only with trusted third-party service providers (like hosting platforms or SMS gateways) strictly for the purpose of operating our service. These providers are bound by strict confidentiality agreements. We may also disclose information if required by law or to protect our legal rights.
          </p>

          <h3>5. Your Rights</h3>
          <p>
            You retain full ownership of the data you enter into AquaDealers. You have the right to:
          </p>
          <ul>
            <li>Access, update, or correct your personal and business information.</li>
            <li>Export your data (e.g., downloading your bills or ledger as CSV).</li>
            <li>Request the deletion of your account and associated data by contacting support.</li>
          </ul>

          <h3>6. Changes to this Policy</h3>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on our website or sending an email alert.
          </p>

          <hr className="border-slate-200 my-8" />
          
          <p className="text-sm text-slate-500">
            If you have questions about this Privacy Policy or how we handle your data, please contact us at <strong>aquadealers.in@gmail.com</strong>.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
