import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import { 
  ArrowRight, CheckCircle2, Package, CreditCard, 
  FileText, BarChart3, Clock, Check, Settings, 
  Users, PenTool, Smartphone, ShieldCheck, PlayCircle, MessageCircle, AlertTriangle, TrendingUp, Cloud, Zap, Lock, Search, Puzzle, Headset, Sparkles, Rocket
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('billing');
  const youtubeUrl = 'https://youtube.com/@aquadealers?si=sZUYaQ7vRPHjh8zm';
  const whatsappUrl = 'https://wa.me/917207171544';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden selection:bg-blue-200">
      <Seo
        title="AquaDealers | Aqua Feed & Medicine Inventory Management"
        description="AquaDealers is inventory, billing, farmer dues, cashbook, and reporting software built for aqua feed and medicine dealers in India."
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'AquaDealers',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: 'https://aquadealers.in/',
            description:
              'AquaDealers is inventory, billing, farmer dues, cashbook, and reporting software built for aqua feed and medicine dealers in India.',
            areaServed: 'India',
            offers: {
              '@type': 'Offer',
              priceCurrency: 'INR',
              availability: 'https://schema.org/InStock',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'AquaDealers',
            url: 'https://aquadealers.in/',
            logo: 'https://aquadealers.in/logo.png',
            email: 'aquadealers.in@gmail.com',
            telephone: '+91 72071 71544',
          },
        ]}
      />
      
      {/* 1. TOP NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AquaDealers" className="h-8 w-auto" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">AquaDealers</span>
          </div>
          <div className="hidden lg:flex items-center gap-8 font-medium text-slate-600 text-sm">
            <a href="#benefits" className="hover:text-blue-600 transition-colors">Benefits</a>
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#tutorials" className="hover:text-blue-600 transition-colors">Tutorials</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <a href="tel:7207171544" className="inline-flex px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Book Demo
            </a>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION - FOMO & URGENCY */}
      <section className="pt-28 pb-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          
          <div className="text-left">

            <h1 className="text-4xl lg:text-5xl xl:text-7xl font-black tracking-tight text-slate-900 mb-4 leading-[1.1]">
              The Complete Inventory & Billing Software <br />
              for <span className="text-blue-600">Aqua Feed & Medicine Dealers</span>
            </h1>
            <p className="text-lg text-slate-600 font-medium mb-8 max-w-xl">
              AquaDealers is the #1 platform for aquaculture businesses. Take full control with smart inventory tracking, secure farmer dues management, and instant GST billing designed specifically for aquadealers.
            </p>

            
            <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 mb-10 text-slate-700 font-medium">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" /> Create bills in seconds</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" /> Track farmer dues safely</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" /> Manage aqua feed & medicine stock</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-500" /> Zero cash variance</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <a href="tel:7207171544" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 duration-200">
                Book Demo <ArrowRight className="w-5 h-5" />
              </a>
              <a href={youtubeUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                <PlayCircle className="w-5 h-5 text-blue-600" /> Watch 2-Minute Overview
              </a>
            </div>
          </div>

          {/* Custom Hero UI Mockup */}
          <div className="relative w-full h-[350px] sm:h-[450px] lg:h-[550px] mt-12 lg:mt-0 flex items-center justify-center lg:justify-start">
            <div className="absolute top-1/2 left-1/2 lg:left-0 -translate-y-1/2 -translate-x-1/2 lg:-translate-x-0 origin-center lg:origin-left scale-[0.32] sm:scale-[0.45] md:scale-[0.6] lg:scale-[0.52] xl:scale-[0.62] 2xl:scale-[0.72] w-[1000px] h-[650px] pointer-events-none">
              
              {/* Desktop Dashboard (Background) */}
              <div className="absolute -right-[10%] -top-[20%] w-[950px] h-[650px] bg-white rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-slate-200 overflow-hidden flex z-10">
                 {/* Sidebar */}
                 <div className="w-56 border-r border-slate-100 bg-white p-6 flex flex-col shrink-0">
                    <div className="flex items-center gap-2 mb-10">
                      <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Zap className="w-5 h-5"/></div>
                      <span className="font-black text-xl text-slate-900">AquaDealers</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-3"><BarChart3 className="w-5 h-5"/> Dashboard</div>
                      <div className="text-slate-500 px-4 py-3 rounded-xl font-bold flex items-center gap-3"><Package className="w-5 h-5"/> Inventory</div>
                      <div className="text-slate-500 px-4 py-3 rounded-xl font-bold flex items-center gap-3"><Users className="w-5 h-5"/> Farmers</div>
                    </div>
                 </div>
                 {/* Main Content */}
                 <div className="flex-1 bg-slate-50/50 flex flex-col overflow-hidden">
                    {/* Topbar */}
                    <div className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
                       <div className="bg-slate-100 text-slate-400 px-4 py-2 rounded-lg flex items-center gap-2 w-64 text-sm font-medium">
                         <Search className="w-4 h-4"/> Q Search anything...
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="text-right">
                           <div className="font-bold text-slate-900 text-sm">Blue Aqua Store</div>
                           <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Main Branch</div>
                         </div>
                         <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                           <img src="https://i.pravatar.cc/100?img=5" alt="Avatar"/>
                         </div>
                       </div>
                    </div>
                    {/* Dashboard Content */}
                    <div className="p-8 pb-12 overflow-y-auto">
                       <h2 className="text-2xl font-black text-slate-900 mb-6">Dashboard</h2>
                       <div className="grid grid-cols-4 gap-4 mb-6">
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4"><BarChart3 className="w-4 h-4"/></div>
                            <div className="text-xs font-bold text-slate-500 mb-1">Total Sales</div>
                            <div className="text-xl font-black text-slate-900 mb-2">₹1,45,000</div>
                            <div className="text-[10px] font-bold text-green-500 flex items-center mt-auto">▲ 12.5%</div>
                          </div>
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-4"><CheckCircle2 className="w-4 h-4"/></div>
                            <div className="text-xs font-bold text-slate-500 mb-1">Total Collections</div>
                            <div className="text-xl font-black text-slate-900 mb-2">₹1,16,500</div>
                            <div className="text-[10px] font-bold text-green-500 flex items-center mt-auto">▲ 8.2%</div>
                          </div>
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4"><Clock className="w-4 h-4"/></div>
                            <div className="text-xs font-bold text-slate-500 mb-1">Total Dues</div>
                            <div className="text-xl font-black text-red-600 mb-2">₹26,500</div>
                            <div className="text-[10px] font-bold text-red-500 flex items-center mt-auto">▼ 3.1%</div>
                          </div>
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4"><TrendingUp className="w-4 h-4"/></div>
                            <div className="text-xs font-bold text-slate-500 mb-1">Net Profit</div>
                            <div className="text-xl font-black text-slate-900 mb-2">₹38,750</div>
                            <div className="text-[10px] font-bold text-green-500 flex items-center mt-auto">▲ 15.4%</div>
                          </div>
                       </div>
                       <div className="grid grid-cols-3 gap-6">
                          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                              <h3 className="font-bold text-slate-900">Sales Overview</h3>
                              <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">This Month ▾</span>
                            </div>
                            <div className="h-24 relative flex items-end justify-between px-2 flex-1 mt-4">
                               <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                                 <polyline points="0,30 20,25 40,30 60,15 80,25 100,10" fill="none" stroke="#2563eb" strokeWidth="1.5" />
                               </svg>
                               {[1,2,3,4,5,6].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-600 relative z-10 border border-white" style={{ transform: 'translateY(-5px)' }}/>)}
                            </div>
                          </div>
                          <div className="col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Top Due Customers</h3>
                            <div className="space-y-4">
                              <div><div className="text-sm font-bold text-slate-700">Ramesh Aqua Farm</div><div className="text-xs text-slate-400 font-bold">₹8,500</div></div>
                              <div><div className="text-sm font-bold text-slate-700">Karthik Fisheries</div><div className="text-xs text-slate-400 font-bold">₹4,300</div></div>
                              <div><div className="text-sm font-bold text-slate-700">Sri Lakshmi Aqua</div><div className="text-xs text-slate-400 font-bold">₹4,800</div></div>
                            </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Mobile App (Foreground left) */}
              <div className="absolute left-[-2%] bottom-[-25%] w-[320px] h-[640px] bg-white rounded-[2.5rem] border-[6px] border-slate-100 shadow-[0_40px_80px_rgba(0,0,0,0.25)] z-20 overflow-hidden flex flex-col ">
                 {/* Mobile Header */}
                 <div className="bg-blue-600 pt-10 pb-12 px-6 relative">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-5 bg-slate-100 rounded-b-xl"></div>
                   <div className="flex justify-between items-start text-white">
                     <div>
                       <h2 className="text-2xl font-black flex items-center gap-2">Hello, Rajesh <span className="text-yellow-400">★</span></h2>
                       <p className="text-blue-100 text-[10px] font-medium mt-1">Here's your business overview</p>
                     </div>
                     <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><CheckCircle2 className="w-3 h-3"/></div>
                   </div>
                 </div>
                 
                 {/* Mobile Content */}
                 <div className="flex-1 bg-slate-50 -mt-6 rounded-t-2xl px-5 pt-8 overflow-hidden relative shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center h-28">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2"><BarChart3 className="w-4 h-4"/></div>
                        <div className="text-[10px] font-bold text-slate-500 mb-1">Today's Sales</div>
                        <div className="text-sm font-black text-slate-900">₹12,850</div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center h-28">
                        <div className="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-2"><CheckCircle2 className="w-4 h-4"/></div>
                        <div className="text-[10px] font-bold text-slate-500 mb-1">Today's Collection</div>
                        <div className="text-sm font-black text-slate-900">₹9,650</div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center h-28">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2"><Clock className="w-4 h-4"/></div>
                        <div className="text-[10px] font-bold text-slate-500 mb-1">Pending Dues</div>
                        <div className="text-sm font-black text-red-600">₹18,200</div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center h-28">
                        <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-2"><Package className="w-4 h-4"/></div>
                        <div className="text-[10px] font-bold text-slate-500 mb-1">Low Stock Items</div>
                        <div className="text-sm font-black text-orange-600">7 !</div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xs font-black text-slate-900 mb-3">Recent Transactions</h3>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><ArrowRight className="w-3 h-3"/></div><div><div className="text-xs font-bold text-slate-800">Ramesh Farm</div><div className="text-[10px] text-slate-500">Bill #892</div></div></div><div className="font-black text-sm text-slate-900">₹4,200</div></div>
                         <div className="flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100"><ArrowRight className="w-3 h-3 rotate-180"/></div><div><div className="text-xs font-bold text-slate-800">Suresh Aqua</div><div className="text-[10px] text-slate-500">Cash Received</div></div></div><div className="font-black text-sm text-green-600">+₹5,000</div></div>
                      </div>
                    </div>
                 </div>
                 
                 {/* Mobile Bottom Nav */}
                 <div className="h-16 bg-white border-t border-slate-100 px-6 flex justify-between items-center z-10 relative">
                   <div className="text-center text-blue-600"><BarChart3 className="w-5 h-5 mx-auto mb-1"/><span className="text-[8px] font-bold block">Dashboard</span></div>
                   <div className="text-center text-slate-400"><FileText className="w-5 h-5 mx-auto mb-1"/><span className="text-[8px] font-bold block">Billing</span></div>
                   <div className="relative -top-6">
                     <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/40 border-[3px] border-white"><span className="text-2xl font-light">+</span></div>
                   </div>
                   <div className="text-center text-slate-400"><CreditCard className="w-5 h-5 mx-auto mb-1"/><span className="text-[8px] font-bold block">Dues</span></div>
                   <div className="text-center text-slate-400"><Settings className="w-5 h-5 mx-auto mb-1"/><span className="text-[8px] font-bold block">More</span></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 3. BUILT FOR */}
      <section className="py-8 bg-slate-900 text-white border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 block">Built For Real Aqua Businesses</span>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 font-bold text-slate-300">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-blue-500"/> Feed Dealers</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-blue-500"/> Medicine Dealers</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-blue-500"/> Multi-Branch Stores</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-blue-500"/> Farm Consultants</div>
          </div>
        </div>
      </section>

      {/* 4. THE COST OF NOT UPGRADING (NEW HIGH-IMPACT SECTION) */}
      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-4">Why are Top Dealers Switching to AquaDealers?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">The old way of running a dealership using paper ledgers and WhatsApp messages is costing you thousands of Rupees every month.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500 hover:-translate-y-2 cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100 group-hover:bg-red-500 group-hover:border-red-500 transition-colors duration-500 shadow-sm relative z-10">
                <ShieldCheck className="w-7 h-7 text-red-600 group-hover:text-white transition-colors duration-500" />
              </div>
              <h3 className="font-black text-xl mb-3 text-slate-900 group-hover:text-red-600 transition-colors duration-500 relative z-10">Stop "Forgotten" Dues</h3>
              <p className="text-slate-600 text-sm leading-relaxed relative z-10">When a farmer disputes a ₹50,000 bill, can you instantly prove it with their signature? With AquaDealers, you can. You never lose an argument over dues again.</p>
            </div>
            
            <div className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-2 cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 group-hover:bg-blue-600 group-hover:border-blue-600 transition-colors duration-500 shadow-sm relative z-10">
                <Cloud className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors duration-500" />
              </div>
              <h3 className="font-black text-xl mb-3 text-slate-900 group-hover:text-blue-600 transition-colors duration-500 relative z-10">Your Data is Indestructible</h3>
              <p className="text-slate-600 text-sm leading-relaxed relative z-10">If your physical ledger gets wet, damaged, or lost, your business is gone. AquaDealers securely backs up every transaction to the cloud instantly.</p>
            </div>
            
            <div className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-500 hover:-translate-y-2 cursor-pointer relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 border border-green-100 group-hover:bg-green-500 group-hover:border-green-500 transition-colors duration-500 shadow-sm relative z-10">
                <TrendingUp className="w-7 h-7 text-green-600 group-hover:text-white transition-colors duration-500" />
              </div>
              <h3 className="font-black text-xl mb-3 text-slate-900 group-hover:text-green-600 transition-colors duration-500 relative z-10">Total Peace of Mind</h3>
              <p className="text-slate-600 text-sm leading-relaxed relative z-10">Leave your shop at 7 PM knowing exactly where every Rupee went. Zero cash variance, perfect stock count, and complete control over your staff.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. DEEP DIVE FEATURES - WITH FOMO COPY */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 space-y-24">
          
<motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: "easeOut" }}>
          {/* Feature 1: Farmer Signatures */}
          <div className="grid md:grid-cols-2 gap-12 items-center group">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 mb-6 border border-blue-200 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <PenTool className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Bulletproof Farmer Signature Proof</h3>
              <p className="text-lg text-slate-600 mb-6 font-medium">Never let a farmer say "I didn't take this stock." Capture signatures on the spot. Build ultimate trust and protect your hard-earned money.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Capture signature digitally on every credit bill.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Signatures securely locked with Bill Date & Amount.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Instantly retrieve proof via WhatsApp if disputes arise.</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 group-hover:border-blue-200 cursor-pointer relative overflow-hidden">
               <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 flex flex-col items-center relative">
                 <div className="absolute top-4 right-4 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-green-200 animate-pulse">Tamper Proof</div>
                 <div className="w-full h-32 bg-white border border-slate-200 rounded-xl mb-4 flex items-center justify-center shadow-sm relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-full h-8 bg-slate-50 border-t flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sign Here</div>
                    {/* Simulated Signature Curve */}
                    <svg width="200" height="80" viewBox="0 0 150 60" fill="none" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="z-10 -mt-4">
                      <path d="M10 40 Q 40 10 60 40 T 110 30 T 140 10" />
                    </svg>
                 </div>
               </div>
               <div className="mt-4 bg-slate-900 text-white p-4 rounded-xl text-sm font-bold flex justify-between items-center shadow-md">
                 <div>
                   <div className="text-[10px] text-slate-400 uppercase tracking-widest">Verified Bill</div>
                   <div>INV-892</div>
                 </div>
                 <div className="text-right">
                   <div className="text-[10px] text-slate-400 uppercase tracking-widest">Amount Secured</div>
                   <div className="text-xl text-green-400">₹24,500</div>
                 </div>
               </div>
            </div>
          </div>


</motion.div>
          {/* Feature 2: Daily Cash Counter */}
          <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: "easeOut" }}>
<div className="grid md:grid-cols-2 gap-12 items-center group">
            <div className="order-2 md:order-1 bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <div className="text-xl font-black mb-6 border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Today's Counter Closing</div>
               <div className="space-y-4 text-sm font-medium">
                 <div className="flex justify-between p-3 bg-slate-50 rounded-lg"><span className="text-slate-600">Opening Cash (9 AM):</span><span className="font-bold text-slate-900">₹10,000</span></div>
                 <div className="flex justify-between p-3 bg-green-50/50 rounded-lg border border-green-100"><span className="text-slate-600">Cash Collections:</span><span className="font-black text-green-600">+₹45,200</span></div>
                 <div className="flex justify-between p-3 bg-red-50/50 rounded-lg border border-red-100"><span className="text-slate-600">Daily Expenses:</span><span className="font-black text-red-600">-₹2,500</span></div>
                 <div className="border-t-2 border-slate-800 pt-4 mt-2 flex justify-between font-black text-xl"><span className="text-slate-800">System Expected Cash:</span><span className="text-slate-900">₹52,700</span></div>
                 <div className="flex justify-between p-3 bg-slate-100 rounded-lg mt-2 border border-slate-200"><span className="text-slate-600">Physical Cash Counted:</span><span className="font-black text-slate-900">₹52,700</span></div>
                 <div className="bg-green-600 text-white p-3 rounded-xl text-center font-black mt-4 shadow-md shadow-green-600/20 text-lg uppercase tracking-wider flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> Variance: ₹0 (Perfect)
                 </div>
               </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-100 text-green-600 mb-6 border border-green-200 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Zero Cash Leakage. Complete Peace of Mind.</h3>
              <p className="text-lg text-slate-600 mb-6 font-medium">Stop wondering where the cash went at the end of the day. Our daily counter report makes theft or calculation errors impossible.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Track Opening, In, Out, and Expected Cash.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Separate UPI vs Cash transactions perfectly.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Instant Variance Detection before staff leaves the shop.</li>
              </ul>
            </div>
          </div>


</motion.div>
          {/* Feature 3: Smart Rate Diff */}
          <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: "easeOut" }}>
<div className="grid md:grid-cols-2 gap-12 items-center group">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-orange-600 mb-6 border border-orange-200 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Recover Price Increases on Unpaid Credit Bills</h3>
              <p className="text-lg text-slate-600 mb-6 font-medium">When feed companies hike prices, don't take the loss. AquaDealers lets you retroactively apply the new rate to farmers who took stock on credit but haven't paid yet.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Detects price increases on your inventory automatically.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Finds all farmers with unpaid quantities of that item.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Generates debit notes to recover the exact difference in seconds.</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 group-hover:border-blue-200 cursor-pointer relative overflow-hidden">
               <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                 <div className="bg-orange-600 text-white p-4 font-black text-sm flex items-center justify-between">
                   <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Rate Difference Detected</span>
                   <span className="text-[10px] bg-orange-800 px-2 py-1 rounded uppercase tracking-wider">12 Farmers Found</span>
                 </div>
                 <div className="p-6 bg-slate-50">
                    <div className="font-black text-lg mb-4 text-slate-800 border-b pb-2">CP 9951 Starter Feed</div>
                    <div className="text-sm font-medium text-slate-600 mb-4">
                      Price increased by <span className="font-bold text-slate-900">₹30/bag</span>. 
                      You have <span className="font-bold text-red-600">100 bags</span> unpaid by farmers.
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl shadow-sm relative overflow-hidden mb-6">
                      <div className="absolute top-0 right-0 w-2 h-full bg-green-500" />
                      <div className="text-green-800 text-xs font-bold uppercase tracking-widest mb-1">Recoverable Amount</div>
                      <div className="font-black text-green-700 text-3xl">₹3,000</div>
                    </div>
                    <button style={{ backgroundColor: '#0f172a', color: '#ffffff' }} className="w-full font-black py-4 rounded-xl shadow-md hover:opacity-90 hover:shadow-lg hover:-translate-y-1 active:scale-95 transition-all duration-300">
                      Apply Charges to Farmer Ledgers
                    </button>
                 </div>
               </div>
            </div>
          </div>



</motion.div>
          {/* Feature 4: Inventory Management */}
          <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: "easeOut" }}>
<div className="grid md:grid-cols-2 gap-12 items-center group">
            <div className="order-2 md:order-1 bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <div className="text-xl font-black mb-6 border-b border-slate-100 pb-4 text-slate-800 flex items-center gap-2">
                 <Package className="text-orange-600"/> Critical Stock Alerts
               </div>
               <div className="space-y-4">
                 <div className="p-4 bg-red-50 border border-red-200 rounded-xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-900">CP Feed - Starter</span>
                     <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded uppercase">Low Stock</span>
                   </div>
                   <div className="text-sm text-slate-600">Only <span className="font-black text-red-600">12 bags</span> left in Warehouse A.</div>
                 </div>
                 
                 <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-900">AquaBoost Medicine</span>
                     <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded uppercase">Expiring Soon</span>
                   </div>
                   <div className="text-sm text-slate-600"><span className="font-black text-orange-600">50 bottles</span> expiring in 15 days (Batch: B-492).</div>
                 </div>

                 <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-600 text-sm">Total Inventory Value</span>
                   </div>
                   <div className="text-2xl font-black text-slate-900">₹14,50,000</div>
                 </div>
               </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-orange-600 mb-6 border border-orange-200 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Never Lose a Single Bag to Expiry or Theft</h3>
              <p className="text-lg text-slate-600 mb-6 font-medium">Stop doing manual stock counts. Know exactly what you have, what's expiring, and what needs reordering instantly.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Automatic alerts for low stock and expiring items.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Batch-wise tracking to ensure older stock sells first.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Instantly verify physical stock against system records.</li>
              </ul>
            </div>
          </div>


</motion.div>
          {/* Feature 5: Staff Logins & Roles */}
          <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: "easeOut" }}>
<div className="grid md:grid-cols-2 gap-12 items-center group">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 text-purple-600 mb-6 border border-purple-200 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Control Exactly What Your Staff Can See and Do</h3>
              <p className="text-lg text-slate-600 mb-6 font-medium">Protect your business secrets. Give your staff the tools to bill, without giving them access to your overall profits or sensitive farmer ledgers.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Create separate accounts for Billing Staff, Managers, etc.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Hide purchase prices and profits from regular staff.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Track exactly which staff member created or edited a bill.</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 group-hover:border-blue-200 cursor-pointer relative overflow-hidden">
               <div className="bg-slate-900 rounded-t-xl p-4 text-white flex justify-between items-center">
                 <div className="font-bold flex items-center gap-2"><Users className="w-4 h-4"/> Staff Permissions</div>
                 <div className="bg-purple-500 text-xs px-2 py-1 rounded-full font-bold">Role: Billing Clerk</div>
               </div>
               <div className="border border-t-0 border-slate-200 rounded-b-xl overflow-hidden bg-slate-50">
                 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                   <div>
                     <div className="font-bold text-slate-900 text-sm">Create New Bills</div>
                     <div className="text-xs text-slate-500">Allow staff to generate sales invoices</div>
                   </div>
                   <div className="w-10 h-6 bg-green-500 rounded-full relative shadow-inner">
                     <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                   </div>
                 </div>
                 
                 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 opacity-75">
                   <div>
                     <div className="font-bold text-slate-900 text-sm flex items-center gap-2">Edit Past Bills <Lock className="w-3 h-3 text-slate-400"/></div>
                     <div className="text-xs text-slate-500">Modify bills after they are saved</div>
                   </div>
                   <div className="w-10 h-6 bg-slate-300 rounded-full relative shadow-inner">
                     <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                   </div>
                 </div>

                 <div className="p-4 flex justify-between items-center bg-slate-50 opacity-75">
                   <div>
                     <div className="font-bold text-slate-900 text-sm flex items-center gap-2">View Profits & Purchase Rates <Lock className="w-3 h-3 text-slate-400"/></div>
                     <div className="text-xs text-slate-500">See margin and supplier pricing</div>
                   </div>
                   <div className="w-10 h-6 bg-slate-300 rounded-full relative shadow-inner">
                     <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                   </div>
                 </div>
               </div>
            </div>
          </div>


</motion.div>
          {/* Feature 6: Farmer & Dues Management */}
          <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: "easeOut" }}>
<div className="grid md:grid-cols-2 gap-12 items-center group">
            <div className="order-2 md:order-1 bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                 <div>
                   <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Farmer Ledger</div>
                   <div className="text-2xl font-black text-slate-900">Ramesh Kumar</div>
                 </div>
                 <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-xl">
                   RK
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                   <div className="text-xs font-bold text-slate-500 mb-1">Total Due</div>
                   <div className="text-xl font-black text-red-600">₹4,50,000</div>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                   <div className="text-xs font-bold text-slate-500 mb-1">Last Payment</div>
                   <div className="text-lg font-bold text-slate-900">12 Days Ago</div>
                 </div>
               </div>

               <div className="space-y-3 mb-6">
                 <div className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                   <div>
                     <div className="font-bold text-sm text-slate-900">Bill INV-892</div>
                     <div className="text-xs text-slate-500">Oct 12, 2023</div>
                   </div>
                   <div className="font-bold text-red-600">+ ₹45,000</div>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                   <div>
                     <div className="font-bold text-sm text-slate-900">Payment Received</div>
                     <div className="text-xs text-slate-500">Oct 10, 2023</div>
                   </div>
                   <div className="font-bold text-green-600">- ₹10,000</div>
                 </div>
               </div>

               <button style={{ backgroundColor: '#2563eb', color: '#ffffff' }} className="w-full font-black py-4 rounded-xl shadow-lg hover:opacity-90 transition-colors flex justify-center items-center gap-2">
                 <CreditCard className="w-5 h-5"/> Collect Payment
               </button>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 mb-6 border border-blue-200 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Instantly Know Who Owes You What, Down to the Last Rupee</h3>
              <p className="text-lg text-slate-600 mb-6 font-medium">Say goodbye to messy ledger books. Search any farmer, see their entire history, and settle accounts in seconds. Clean, transparent, and accurate.</p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Consolidated view of all pending dues across all farmers.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Print or WhatsApp full transaction statements instantly.</li>
                <li className="flex items-center gap-3 font-bold text-slate-800 transition-all duration-300 hover:text-blue-600 hover:translate-x-2"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/> Track partial payments and running balances flawlessly.</li>
              </ul>
            </div>
          </div>

</motion.div>
        </div>
      </section>

      {/* 8. WHATSAPP WORKFLOWS - PROFESSIONAL IMAGE */}
      <section className="py-24 bg-green-50 border-y border-green-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-400/10 rounded-full blur-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
           <div>
             <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-green-200 text-green-800 font-bold text-xs uppercase tracking-widest mb-6 border border-green-300">
                <MessageCircle className="w-4 h-4 mr-2 inline" /> Look Professional. Earn Trust.
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-6">Automate Your Dealership on WhatsApp</h2>
              <p className="text-xl text-slate-700 mb-8 font-medium leading-relaxed">Farmers trust dealers who provide clear, computerized bills instantly. Stop writing on paper slips and start sharing professional PDF bills directly to their WhatsApp.</p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-green-200 flex items-center gap-4 shadow-md hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200"><FileText className="w-5 h-5"/></div>
                  <span className="font-black text-slate-800">Share PDF Bills</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-green-200 flex items-center gap-4 shadow-md hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200"><BarChart3 className="w-5 h-5"/></div>
                  <span className="font-black text-slate-800">Share Statements</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-green-200 flex items-center gap-4 shadow-md hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200"><Clock className="w-5 h-5"/></div>
                  <span className="font-black text-slate-800">Auto Due Reminders</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-green-200 flex items-center gap-4 shadow-md hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200"><TrendingUp className="w-5 h-5"/></div>
                  <span className="font-black text-slate-800">Share Farm Reports</span>
                </div>
              </div>
           </div>
           
           <div className="relative h-[550px] flex items-center justify-center z-10">
              <div className="w-80 bg-[#EFEAE2] rounded-[2.5rem] p-3 shadow-2xl border-[12px] border-slate-900 flex flex-col h-full relative">
                 {/* Notch */}
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-3xl z-20" />
                 
                 <div className="bg-[#075E54] text-white p-4 -mx-3 -mt-3 rounded-t-3xl flex items-center gap-3 font-bold mb-4 pt-8 shadow-md">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xs overflow-hidden border-2 border-white/50">
                      <img src="https://i.pravatar.cc/100?img=11" alt="Farmer" />
                    </div>
                    <div>
                      <div className="text-base">Karthik Fisheries</div>
                      <div className="text-[10px] text-green-200 font-normal">online</div>
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-4 no-scrollbar">
                   <div className="bg-white rounded-2xl p-4 shadow-md self-end w-[85%] relative ml-auto border border-slate-100">
                     <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent -mr-2 mt-2 drop-shadow-sm" />
                     <div className="font-black text-slate-900 mb-1 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400"/> New Bill: INV-892</div>
                     <div className="text-slate-600 text-sm mb-3 border-b border-slate-100 pb-2">Total Amount: <span className="font-black text-slate-900">₹24,500</span><br/>Date: Today</div>
                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-blue-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-50 cursor-pointer transition-colors shadow-sm"><FileText className="w-4 h-4"/> Download PDF Bill</div>
                     <div className="text-[10px] text-right text-blue-500 mt-2 font-bold tracking-widest">10:42 AM ✓✓</div>
                   </div>
                   
                   <div className="bg-white rounded-2xl p-4 shadow-md self-end w-[85%] relative ml-auto border border-red-100 bg-gradient-to-br from-white to-red-50">
                     <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent -mr-2 mt-2 drop-shadow-sm" />
                     <div className="font-black text-red-600 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Payment Reminder</div>
                     <div className="text-slate-700 text-sm mb-2 font-medium">Hello Karthik, your outstanding due is <span className="font-black text-red-600">₹85,400</span>. Please arrange payment at your earliest convenience.</div>
                     <div className="text-[10px] text-right text-slate-400 mt-2 font-bold tracking-widest">10:43 AM ✓✓</div>
                   </div>
                 </div>
                 
                 <div className="bg-white rounded-full p-3 shadow-sm mx-2 mb-2 flex items-center text-slate-400 text-sm">
                   <MessageCircle className="w-5 h-5 mr-2" /> Message...
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 9. VIDEO TUTORIALS */}
      <section id="tutorials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-4">Learn Every Feature in Minutes</h2>
          <p className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto font-medium">No steep learning curves. Short, actionable video tutorials for every part of your dealership workflow.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {['Billing Secrets', 'Stock Control', 'GST Reports', 'Variance Checking', 'Due Collection'].map((topic, i) => (
              <div key={i} className="group cursor-pointer relative">
                <div className="absolute -top-3 -right-2 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md z-10 border border-orange-300 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">Coming Soon</div>
                <div className="bg-slate-50 aspect-video rounded-2xl border border-slate-200 mb-4 flex items-center justify-center group-hover:bg-blue-600 transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:shadow-blue-600/30 relative overflow-hidden">
                  <PlayCircle className="w-10 h-10 text-slate-300 group-hover:text-white transition-colors relative z-10" />
                </div>
                <div className="font-black text-sm text-slate-800 group-hover:text-blue-600 transition-colors">{topic}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FLOATING BLUE CARD (CUSTOMIZATION) */}
      <div className="px-4 md:px-8 max-w-[1400px] mx-auto mb-6">
        <section className="py-12 md:py-16 bg-gradient-to-br from-blue-600 to-[#0033cc] rounded-[2rem] md:rounded-[3rem] text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
          {/* Subtle background patterns */}
          <div className="absolute top-10 left-10 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 flex flex-col items-center">
            
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-6 border border-blue-400/30 relative">
              <div className="absolute inset-0 bg-blue-400 blur-xl opacity-30 rounded-full"></div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center shadow-inner relative z-10">
                <Settings className="w-7 h-7 text-white" />
              </div>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight relative inline-block">
              <span className="absolute -left-10 top-0 text-yellow-400 rotate-[-45deg] text-xl font-bold hidden md:block">\</span>
              <span className="absolute -left-12 top-5 text-yellow-400 rotate-[-65deg] text-lg font-bold hidden md:block">/</span>
              Need a custom feature<br/>for your shop?
              <span className="absolute -right-10 top-0 text-yellow-400 rotate-[45deg] text-xl font-bold hidden md:block">/</span>
              <span className="absolute -right-12 top-5 text-yellow-400 rotate-[65deg] text-lg font-bold hidden md:block">\</span>
            </h2>
            
            <p className="text-base md:text-lg mb-10 text-blue-100/90 leading-relaxed font-medium max-w-3xl mx-auto">
              We understand that local dealers have unique ways of operating. If you need a<br className="hidden md:block"/>specific report or workflow, we customize <span className="text-cyan-300 font-bold">AquaDealers</span> exclusively for your business.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-0 mb-10 text-left w-full py-2 relative">
              <div className="flex gap-3 md:px-4 lg:px-6 relative justify-center md:justify-start">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm mb-0.5">Custom Reports</div>
                  <div className="text-xs text-blue-200">Built for your workflow</div>
                </div>
              </div>
              <div className="flex gap-3 md:px-4 lg:px-6 relative before:hidden md:before:block before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-blue-500/30 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm mb-0.5">Faster Operations</div>
                  <div className="text-xs text-blue-200">Save time & reduce errors</div>
                </div>
              </div>
              <div className="flex gap-3 md:px-4 lg:px-6 relative before:hidden md:before:block before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-blue-500/30 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Puzzle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm mb-0.5">Feature Customization</div>
                  <div className="text-xs text-blue-200">Exactly how you need it</div>
                </div>
              </div>
              <div className="flex gap-3 md:px-4 lg:px-6 relative before:hidden md:before:block before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-blue-500/30 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Headset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm mb-0.5">Dedicated Support</div>
                  <div className="text-xs text-blue-200">We're here to help you</div>
                </div>
              </div>
            </div>
            
            <div className="relative inline-block">
              <div className="absolute -inset-1 bg-cyan-400 blur-xl opacity-40 rounded-full"></div>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" style={{ backgroundColor: '#ffffff', color: '#1d4ed8' }} className="relative px-8 py-3.5 rounded-full font-black text-base hover:-translate-y-1 transition-all duration-300 shadow-xl inline-flex items-center gap-2 border border-white">
                <Sparkles className="w-5 h-5" /> Request Custom Workflow <ArrowRight className="w-5 h-5 ml-1" />
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* 11. FLOATING DARK CARD (CTA + FOOTER) */}
      <div className="px-4 md:px-8 max-w-[1400px] mx-auto mb-8">
        <section id="contact" className="pt-20 md:pt-28 pb-8 bg-[#0a0f1d] rounded-[2rem] md:rounded-[3rem] text-white text-center relative overflow-hidden shadow-2xl">
          {/* Subtle dots background and gradients */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,1) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          <div className="absolute -left-[20%] top-0 w-1/2 h-[400px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute -right-[10%] bottom-[20%] w-[600px] h-[600px] rounded-full border-[1px] border-blue-900/20 opacity-30 pointer-events-none"></div>
          <div className="absolute -right-[5%] bottom-[15%] w-[400px] h-[400px] rounded-full border-[1px] border-blue-900/30 opacity-20 pointer-events-none"></div>
          
          <div className="max-w-4xl mx-auto px-6 relative z-10 flex flex-col items-center">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-white">
              Ready to take <span className="text-[#00df5b]">total control?</span>
            </h2>
            <p className="text-lg md:text-xl text-slate-400 mb-12 font-medium">
              Stop managing chaos. Plug revenue leaks. Start growing your dealership today.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12 text-left w-full">
              <div className="flex items-center md:items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#00df5b]/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00df5b]/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00df5b]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Easy Setup</div>
                  <div className="text-xs text-slate-400">Get started in minutes</div>
                </div>
              </div>
              <div className="flex items-center md:items-start gap-3 md:border-l md:border-slate-800/50 md:pl-6">
                <div className="w-6 h-6 rounded-full bg-[#00df5b]/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00df5b]/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00df5b]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">No Credit Card</div>
                  <div className="text-xs text-slate-400">No payment details</div>
                </div>
              </div>
              <div className="flex items-center md:items-start gap-3 md:border-l md:border-slate-800/50 md:pl-6">
                <div className="w-6 h-6 rounded-full bg-[#00df5b]/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00df5b]/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00df5b]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">14-Day Free Trial</div>
                  <div className="text-xs text-slate-400">Explore all features</div>
                </div>
              </div>
              <div className="flex items-center md:items-start gap-3 md:border-l md:border-slate-800/50 md:pl-6">
                <div className="w-6 h-6 rounded-full bg-[#00df5b]/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00df5b]/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00df5b]" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Cancel Anytime</div>
                  <div className="text-xs text-slate-400">No lock-in. Ever.</div>
                </div>
              </div>
            </div>
            
            <Link to="/register" className="inline-flex items-center justify-center gap-3 px-10 py-4 text-lg font-black text-white bg-[#00df5b] rounded-xl hover:bg-[#00c550] transition-all shadow-lg shadow-[#00df5b]/20 hover:-translate-y-1 duration-300">
              <Rocket className="w-5 h-5"/> Start Your Free Trial
            </Link>
            <p className="mt-4 text-xs text-slate-500 font-medium mb-16 md:mb-24">No credit card required. Setup takes 2 minutes.</p>
          </div>
          
          {/* Integrated Footer inside the dark card */}
          <div className="border-t border-slate-800 pt-8 mt-4 px-6 md:px-12 w-full max-w-[1400px] mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-8">
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <img src="/logo.png" alt="AquaDealers" className="w-7 h-7 brightness-0 invert" />
                </div>
                <div className="text-left">
                  <div className="font-black text-white text-xl tracking-tight leading-tight">AquaDealers</div>
                  <div className="text-xs text-slate-400 mt-1">Built for Indian AquaDealers.</div>
                </div>
              </div>
              
              <div className="flex flex-wrap lg:flex-nowrap gap-8 md:gap-16 text-left">
                <div className="lg:border-l lg:border-slate-800 lg:pl-8">
                  <div className="text-xs text-slate-500 mb-1.5 font-bold tracking-wider">Email</div>
                  <a href="mailto:aquadealers.in@gmail.com" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">aquadealers.in@gmail.com</a>
                </div>
                <div className="lg:border-l lg:border-slate-800 lg:pl-8">
                  <div className="text-xs text-slate-500 mb-1.5 font-bold tracking-wider">WhatsApp</div>
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">+91 72071 71544</a>
                </div>
                <div className="lg:border-l lg:border-slate-800 lg:pl-8">
                  <div className="text-xs text-slate-500 mb-1.5 font-bold tracking-wider">Website</div>
                  <a href="https://aquadealers.in" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">aquadealers.in</a>
                </div>
              </div>
              
              <div className="text-left">
                <div className="text-xs text-slate-500 mb-2.5 font-bold tracking-wider">Follow Us</div>
                <div className="flex items-center gap-3">
                  <a href={youtubeUrl} target="_blank" rel="noreferrer" aria-label="AquaDealers on YouTube" className="w-8 h-8 rounded bg-[#ef4444] flex items-center justify-center text-white hover:bg-[#dc2626] transition-transform hover:-translate-y-1 shadow-md shadow-red-500/20">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="AquaDealers on WhatsApp" className="w-8 h-8 rounded bg-[#22c55e] flex items-center justify-center text-white hover:bg-[#16a34a] transition-transform hover:-translate-y-1 shadow-md shadow-green-500/20">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  </a>
                </div>
              </div>
            </div>
            
            <div className="text-xs text-slate-600 pb-2 text-center">
              &copy; {new Date().getFullYear()} AquaDealers. All rights reserved.
            </div>
          </div>
        </section>
      </div>

    </div>
  );
};

export default LandingPage;
