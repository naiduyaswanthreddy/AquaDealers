const fs = require('fs');
const file = 'd:/AquaDealer/src/features/landing/pages/LandingPage.tsx';
let content = fs.readFileSync(file, 'utf-8');
const startIdx = content.indexOf('      {/* 6. POWERFUL FEATURES - INTERACTIVE GRID */}');
const endIdx = content.indexOf('      {/* 7. DEEP DIVE FEATURES - WITH FOMO COPY */}');

if (startIdx !== -1 && endIdx !== -1) {
  const newSection = `      {/* 6. POWERFUL FEATURES - ULTRA MODERN BENTO GRID */}
      <section className="py-32 bg-slate-50 relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-blue-100/50 via-transparent to-transparent rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-[10%] w-[800px] h-[800px] bg-gradient-to-tr from-emerald-100/50 via-transparent to-transparent rounded-full blur-[100px]" />
        </div>

        <div className="max-w-[1400px] mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-slate-200 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-slate-800 font-bold text-sm tracking-widest uppercase">The Complete Arsenal</span>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-[1.1]"
            >
              Everything You Need to <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600">Dominate Your Market</span>
            </motion.h2>
          </div>

          {/* BENTO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[240px] gap-6">
            
            {/* 1. Farmer & Dues (2x2) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="lg:col-span-2 lg:row-span-2 group relative bg-white rounded-[2.5rem] p-8 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-blue-300 transition-all duration-500 flex flex-col"
            >
              <div className="flex-1 z-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-3 leading-tight">Master Your<br/>Farmer Dues</h3>
                <p className="text-slate-600 font-medium text-lg max-w-sm">Track every penny, settlement, and credit history with complete confidence.</p>
              </div>
              {/* Decorative Graphic */}
              <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-gradient-to-tl from-blue-50 to-transparent rounded-tl-full translate-x-10 translate-y-10 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute -bottom-6 -right-6 w-64 h-64 bg-white shadow-2xl rounded-3xl border border-slate-100 p-6 rotate-[-5deg] group-hover:rotate-0 group-hover:-translate-y-4 transition-all duration-500">
                <div className="flex items-center gap-4 mb-4 border-b pb-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200" />
                  <div>
                    <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
                    <div className="h-2 w-16 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase">Outstanding</div>
                <div className="text-3xl font-black text-red-500">₹1,25,000</div>
              </div>
            </motion.div>

            {/* 2. Smart Billing (2x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="lg:col-span-2 lg:row-span-1 group relative bg-slate-900 text-white rounded-[2rem] p-8 border border-slate-800 overflow-hidden hover:shadow-2xl hover:border-blue-500 transition-all duration-500 flex items-center justify-between"
            >
              <div className="relative z-10 max-w-[60%]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-black mb-2">Lightning Fast GST Billing</h3>
                <p className="text-slate-400 font-medium text-sm">Create perfect, tax-compliant bills in under 10 seconds.</p>
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 opacity-50 group-hover:opacity-100 group-hover:-translate-x-4 transition-all duration-500">
                <FileText className="w-32 h-32 text-blue-500/20" />
              </div>
            </motion.div>

            {/* 3. Rate Diff (1x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="lg:col-span-1 lg:row-span-1 group relative bg-white rounded-[2rem] p-6 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-emerald-300 transition-all duration-500"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Smart Rate Diff</h3>
              <p className="text-slate-600 font-medium text-xs">Auto-calculate purchase vs sale rate differences to protect your margins.</p>
            </motion.div>

            {/* 4. Signatures (1x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
              className="lg:col-span-1 lg:row-span-1 group relative bg-white rounded-[2rem] p-6 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-emerald-300 transition-all duration-500 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <PenTool className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Farmer Signatures</h3>
              </div>
              <div className="relative h-12 overflow-hidden rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                <svg className="w-24 h-8 text-slate-800 stroke-current opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" viewBox="0 0 100 30" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5,20 Q15,5 25,20 T45,20 T65,20 T85,15" className="animate-[dash_3s_ease-in-out_infinite]" strokeDasharray="100" strokeDashoffset="0" />
                </svg>
              </div>
            </motion.div>

            {/* 5. WhatsApp (1x2) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
              className="lg:col-span-1 lg:row-span-2 group relative bg-gradient-to-b from-emerald-500 to-emerald-700 text-white rounded-[2.5rem] p-8 border border-emerald-400 overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/30 transition-all duration-500 flex flex-col"
            >
              <div className="relative z-10 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center mb-6 backdrop-blur-sm">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black mb-3 leading-tight">1-Click<br/>WhatsApp</h3>
                <p className="text-emerald-100 font-medium text-sm">Send bills, dues reminders, and statements directly to farmers.</p>
              </div>
              {/* Phone Graphic */}
              <div className="relative h-48 w-full mt-8 bg-white/10 rounded-t-3xl border-t-4 border-x-4 border-white/20 backdrop-blur-md translate-y-8 group-hover:translate-y-4 transition-transform duration-500 flex justify-center pt-6">
                <div className="w-3/4 bg-white rounded-xl h-full p-3 shadow-inner">
                  <div className="w-1/2 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
                  <div className="w-full h-8 bg-emerald-100 rounded-lg mb-2" />
                  <div className="w-3/4 h-8 bg-slate-100 rounded-lg" />
                </div>
              </div>
            </motion.div>

            {/* 6. Inventory (2x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
              className="lg:col-span-2 lg:row-span-1 group relative bg-white rounded-[2rem] p-8 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-orange-300 transition-all duration-500 flex items-center"
            >
              <div className="flex-1 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center mb-4">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Inventory Control</h3>
                <p className="text-slate-600 font-medium text-sm">Real-time stock tracking, batch management, and low stock alerts.</p>
              </div>
              <div className="hidden md:flex gap-2 relative h-32 items-end">
                 <div className="w-12 h-20 bg-slate-100 rounded-t-lg border-x border-t border-slate-200 group-hover:h-28 transition-all duration-500 flex items-end p-2"><div className="w-full h-1/3 bg-slate-300 rounded" /></div>
                 <div className="w-12 h-24 bg-orange-50 rounded-t-lg border-x border-t border-orange-200 group-hover:h-16 transition-all duration-500 flex items-end p-2 relative"><div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" /><div className="w-full h-1/4 bg-orange-400 rounded" /></div>
                 <div className="w-12 h-16 bg-slate-100 rounded-t-lg border-x border-t border-slate-200 group-hover:h-24 transition-all duration-500 flex items-end p-2"><div className="w-full h-2/3 bg-slate-300 rounded" /></div>
              </div>
            </motion.div>

            {/* 7. Cash Counter (1x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }}
              className="lg:col-span-1 lg:row-span-1 group relative bg-white rounded-[2rem] p-6 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-orange-300 transition-all duration-500"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Daily Cash</h3>
              <p className="text-slate-600 font-medium text-xs">Track counter cash & tally variances at day close.</p>
            </motion.div>

            {/* 8. Reports (2x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.7 }}
              className="lg:col-span-2 lg:row-span-1 group relative bg-white rounded-[2rem] p-8 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-blue-300 transition-all duration-500 flex justify-between items-center"
            >
              <div className="relative z-10 max-w-[60%]">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Powerful Analytics</h3>
                <p className="text-slate-600 font-medium text-sm">Beautiful reports for sales, dues, and dealership profits.</p>
              </div>
              <div className="relative w-32 h-32 mr-4">
                <svg className="w-full h-full transform group-hover:scale-110 transition-transform duration-500" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="16" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="16" strokeDasharray="251" strokeDashoffset="60" className="group-hover:stroke-blue-500 transition-colors" strokeLinecap="round" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="20" fill="none" stroke="#10b981" strokeWidth="16" strokeDasharray="125" strokeDashoffset="40" strokeLinecap="round" transform="rotate(-90 50 50)" />
                </svg>
              </div>
            </motion.div>

            {/* 9. Staff Logins (1x1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.8 }}
              className="lg:col-span-1 lg:row-span-1 group relative bg-white rounded-[2rem] p-6 border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-purple-300 transition-all duration-500"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:-rotate-12 transition-transform">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Staff Access</h3>
              <p className="text-slate-600 font-medium text-xs">Unlimited logins with role-based branch permissions.</p>
            </motion.div>

          </div>
        </div>
      </section>\n` + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('Success');
} else {
  console.log('Failed to find indices');
}
