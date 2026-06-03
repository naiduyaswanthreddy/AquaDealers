import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle2, Star, Package, CreditCard, 
  FileText, BarChart3, TrendingUp, ShieldCheck, Clock, Check, Zap
} from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden selection:bg-blue-200">
      
      {/* 1. TOP NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AquaDealer" className="h-10 w-auto" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">AquaDealer</span>
          </div>
          <div className="hidden lg:flex items-center gap-8 font-medium text-slate-600 text-sm">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#blog" className="hover:text-blue-600 transition-colors">Blog</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="hidden sm:inline-flex px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-full shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
              Get Started Free <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative pt-24 pb-20 lg:pt-24 lg:pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-bl from-blue-50/60 via-slate-50/20 to-transparent -z-10 rounded-bl-[100px]" />
        
        {/* Background decorative blob */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-100/30 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-16 items-start">
          
          {/* Hero Content (Left) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-left"
          >
            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-blue-50 text-blue-700 font-bold text-sm mb-6 border border-blue-100 shadow-sm mt-4">
              <span className="text-yellow-500 text-base">⭐</span> The Future of Aqua Dealing
            </span>
            <h1 className="text-5xl lg:text-[56px] xl:text-[64px] font-black tracking-tighter text-slate-900 mb-6 leading-[1.1]">
              Manage Your Aqua Business <br className="hidden lg:block" />
              <span className="text-blue-600">With Ultimate Precision.</span>
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 mb-10 font-medium max-w-lg leading-relaxed">
              Track inventory, manage customer dues, create bills and grow your aqua business with one powerful, easy-to-use platform.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
              <Link to="/register" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-blue-600 rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all hover:-translate-y-0.5 group flex items-center justify-center gap-2">
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 text-base font-bold text-slate-700 bg-slate-100 border-2 border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-300 transition-all">
                Learn More
              </button>
            </div>

          </motion.div>

          {/* Hero Visual Mockups (Right) */}
          <div className="relative h-[500px] lg:h-[650px] hidden lg:block w-full z-10 lg:-ml-20 xl:-ml-40">
            {/* Unified Scaling Container */}
            <div className="absolute left-0 top-0 w-[1000px] h-[700px] transform origin-top-left scale-[0.55] lg:scale-[0.70] xl:scale-[0.85] 2xl:scale-100">
              
              {/* 1. Dashboard Desktop Mockup */}
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="absolute left-[180px] top-0 w-[850px] h-[580px] bg-[#F8FAFC] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-200/60 overflow-hidden flex"
              >
                {/* Sidebar */}
                <div className="w-56 bg-white border-r border-slate-100 flex flex-col pt-6">
                  <div className="px-6 flex items-center gap-2 mb-8">
                    <div className="text-blue-600"><Zap className="w-6 h-6 fill-current"/></div>
                    <span className="font-black text-slate-900">AquaDealer</span>
                  </div>
                  <div className="px-4 space-y-1">
                    <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20">
                      <BarChart3 className="w-4 h-4"/> Dashboard
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium text-sm">
                      <Package className="w-4 h-4"/> Inventory
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium text-sm">
                      <FileText className="w-4 h-4"/> Billing
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium text-sm">
                      <TrendingUp className="w-4 h-4"/> Customers
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium text-sm">
                      <CreditCard className="w-4 h-4"/> Dues
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">
                  {/* Topbar */}
                  <div className="h-16 bg-white/50 backdrop-blur border-b border-slate-100 flex items-center justify-between px-8">
                    <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg w-64">
                      <span className="text-slate-400 text-sm">Q Search anything...</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">Blue Aqua Store</div>
                        <div className="text-xs text-slate-500">Main Branch</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white overflow-hidden"><img src="https://i.pravatar.cc/100?img=15" alt="user" /></div>
                    </div>
                  </div>

                  {/* Dashboard Widgets */}
                  <div className="p-8 overflow-hidden">
                    <h2 className="text-2xl font-black text-slate-900 mb-6">Dashboard</h2>
                    
                    {/* Stat Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><BarChart3 className="w-4 h-4"/></div>
                        <div className="text-xs font-bold text-slate-500 mb-1">Total Sales</div>
                        <div className="text-xl font-black text-slate-900">₹1,45,000</div>
                        <div className="text-[10px] text-green-500 font-bold mt-1">▲ 12.5% this month</div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-3"><CheckCircle2 className="w-4 h-4"/></div>
                        <div className="text-xs font-bold text-slate-500 mb-1">Total Collections</div>
                        <div className="text-xl font-black text-slate-900">₹1,16,500</div>
                        <div className="text-[10px] text-green-500 font-bold mt-1">▲ 8.2% this month</div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3"><Clock className="w-4 h-4"/></div>
                        <div className="text-xs font-bold text-slate-500 mb-1">Total Dues</div>
                        <div className="text-xl font-black text-red-600">₹26,500</div>
                        <div className="text-[10px] text-red-500 font-bold mt-1">▼ 3.1% this month</div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3"><TrendingUp className="w-4 h-4"/></div>
                        <div className="text-xs font-bold text-slate-500 mb-1">Net Profit</div>
                        <div className="text-xl font-black text-slate-900">₹38,750</div>
                        <div className="text-[10px] text-green-500 font-bold mt-1">▲ 15.4% this month</div>
                      </div>
                    </div>

                    {/* Middle Section (Chart + Top Due) */}
                    <div className="grid grid-cols-[2fr_1fr] gap-6 mb-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                          <div className="font-bold text-slate-900">Sales Overview</div>
                          <div className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded">This Month ▾</div>
                        </div>
                        {/* CSS Line Chart Mockup */}
                        <div className="relative h-32 w-full mt-4 flex items-end justify-between px-2">
                          <div className="absolute inset-0 bg-gradient-to-t from-blue-50/50 to-transparent rounded-lg" />
                          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <path d="M0,80 L15,60 L30,70 L45,40 L60,50 L75,20 L90,40 L100,10" fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="15" cy="60" r="2" fill="#2563eb" />
                            <circle cx="30" cy="70" r="2" fill="#2563eb" />
                            <circle cx="45" cy="40" r="2" fill="#2563eb" />
                            <circle cx="60" cy="50" r="2" fill="#2563eb" />
                            <circle cx="75" cy="20" r="2" fill="#2563eb" />
                            <circle cx="90" cy="40" r="2" fill="#2563eb" />
                          </svg>
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="font-bold text-slate-900 mb-4">Top Due Customers</div>
                        <div className="space-y-4">
                          <div className="flex justify-between">
                            <div className="text-xs font-bold text-slate-700">Ramesh Aqua Farm<br/><span className="text-slate-400">₹8,500</span></div>
                          </div>
                          <div className="flex justify-between">
                            <div className="text-xs font-bold text-slate-700">Karthik Fisheries<br/><span className="text-slate-400">₹4,300</span></div>
                          </div>
                          <div className="flex justify-between">
                            <div className="text-xs font-bold text-slate-700">Sri Lakshmi Aqua<br/><span className="text-slate-400">₹4,800</span></div>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-blue-600 mt-4 cursor-pointer">View All Dues →</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 2. Mobile App Mockup (Overlapping) */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="absolute left-0 top-[100px] w-[280px] h-[580px] bg-white rounded-[3rem] p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border-[6px] border-slate-100 z-20 overflow-hidden flex flex-col"
              >
                {/* iOS Notch */}
                <div className="absolute top-0 inset-x-0 h-6 bg-slate-100 rounded-b-3xl w-32 mx-auto z-30" />
                
                <div className="bg-blue-600 text-white rounded-t-[2.5rem] pt-12 pb-24 px-6 relative shrink-0">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <div className="font-bold text-lg">Hello, Rajesh <span className="text-yellow-400">⭐</span></div>
                      <div className="text-xs text-blue-200">Here's your business overview</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><CheckCircle2 className="w-4 h-4"/></div>
                  </div>
                </div>

                {/* Overlapping Mobile Content */}
                <div className="flex-1 bg-slate-50 -mt-20 rounded-t-[2rem] px-4 pt-6 relative z-10 flex flex-col gap-4 overflow-hidden">
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2"><BarChart3 className="w-4 h-4"/></div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">Today's Sales</div>
                      <div className="text-sm font-black text-slate-900">₹12,850</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-2"><CheckCircle2 className="w-4 h-4"/></div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">Today's Collection</div>
                      <div className="text-sm font-black text-slate-900">₹9,650</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2"><Clock className="w-4 h-4"/></div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">Pending Dues</div>
                      <div className="text-sm font-black text-red-600">₹18,200</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-2"><Package className="w-4 h-4"/></div>
                      <div className="text-[10px] text-slate-500 font-bold mb-1">Low Stock Items</div>
                      <div className="text-sm font-black text-orange-600">7 !</div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex-1">
                    <div className="font-bold text-slate-900 text-xs mb-3">Recent Transactions</div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <img src="https://i.pravatar.cc/100?img=11" className="w-8 h-8 rounded-full" alt="user"/>
                          <div className="text-[10px] font-bold text-slate-700">Karthik Fisheries<br/><span className="text-slate-400 font-normal">Payment received</span></div>
                        </div>
                        <div className="text-[10px] font-bold text-green-600">+₹2,450</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <img src="https://i.pravatar.cc/100?img=12" className="w-8 h-8 rounded-full" alt="user"/>
                          <div className="text-[10px] font-bold text-slate-700">Sri Lakshmi Aqua<br/><span className="text-slate-400 font-normal">New bill</span></div>
                        </div>
                        <div className="text-[10px] font-bold text-slate-900">-₹4,800</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Bottom Tab Bar */}
                <div className="h-16 bg-white border-t border-slate-100 rounded-b-[2.5rem] flex items-center justify-around px-2 shrink-0">
                  <div className="flex flex-col items-center text-blue-600"><BarChart3 className="w-5 h-5 mb-1"/><span className="text-[8px] font-bold">Dashboard</span></div>
                  <div className="flex flex-col items-center text-slate-400"><FileText className="w-5 h-5 mb-1"/><span className="text-[8px] font-bold">Billing</span></div>
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 text-white -mt-6 border-4 border-white"><span className="text-2xl font-light mb-1">+</span></div>
                  <div className="flex flex-col items-center text-slate-400"><CreditCard className="w-5 h-5 mb-1"/><span className="text-[8px] font-bold">Dues</span></div>
                  <div className="flex flex-col items-center text-slate-400"><Star className="w-5 h-5 mb-1"/><span className="text-[8px] font-bold">More</span></div>
                </div>
              </motion.div>

              {/* 3. Floating Notification (Bottom Right) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute left-[650px] bottom-[80px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex items-center gap-4 z-30 w-max"
              >
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">WhatsApp Reminder Sent</div>
                  <div className="text-xs text-slate-500">Payment reminder sent to 12 customers</div>
                </div>
                <Check className="w-5 h-5 text-green-500 ml-2" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CHALLENGES SECTION */}
      <section className="py-12 lg:py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10 lg:mb-16">
            <span className="text-blue-600 font-bold tracking-wider text-sm uppercase mb-2 block">The Real Challenges</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4 text-slate-900">The Chaos of Manual Management</h2>
            <p className="text-slate-500 text-lg">Running a water dealership shouldn't feel like guessing.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-red-200 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-6">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Stock-outs & Overstocks</h3>
              <p className="text-slate-500 text-sm">Either you run out of stock or stock gets expired.</p>
            </div>
            
            <div className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-orange-200 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-6">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Pending Dues</h3>
              <p className="text-slate-500 text-sm">Lose track of credit and chase payments endlessly.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-blue-200 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Manual Billing</h3>
              <p className="text-slate-500 text-sm">Time-consuming bills and error-prone calculations.</p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-purple-200 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Business Insights</h3>
              <p className="text-slate-500 text-sm">No clarity on profit, loss or business growth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LIGHT FEATURE SECTION */}
      {/* 4. LIGHT FEATURE SECTION */}
      <section id="features" className="py-12 lg:py-24 bg-slate-50 relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 grid lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-8 items-center">
          <div className="text-left">
            <span className="inline-block py-1.5 px-4 rounded-full bg-blue-100/80 text-blue-700 font-bold text-[11px] tracking-widest uppercase mb-6">
              BUILT FOR AQUA DEALERS
            </span>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6 leading-tight text-slate-900">
              All-in-One Platform to Run Your Business Smoothly
            </h2>
            <p className="text-base text-slate-600 mb-8 font-medium">
              AquaDealer helps you save time, reduce losses and make smarter business decisions every day.
            </p>
            <ul className="space-y-4 mb-10">
              {[
                "Real-time inventory tracking",
                "Easy billing with WhatsApp sharing",
                "Customer & dues management",
                "Expense tracking",
                "Powerful business reports",
                "Multi-store & multi-user access",
                "Smart Rate Diff adjustments"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700 font-bold text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Check className="text-white w-3 h-3" strokeWidth={3} />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button className="px-8 py-4 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-2">
              Explore All Features <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative w-full h-[350px] sm:h-[450px] lg:h-[600px] flex items-center z-10 overflow-hidden lg:overflow-visible">
             {/* Desktop Dashboard Mockup */}
             <div className="absolute left-0 lg:-ml-8 xl:-ml-12 w-[1000px] h-[650px] transform scale-[0.35] sm:scale-[0.50] md:scale-[0.60] lg:scale-[0.70] xl:scale-[0.80] origin-left bg-white rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 flex">
               {/* Sidebar */}
               <div className="w-64 bg-slate-50/50 border-r border-slate-100 flex flex-col pt-6">
                  <div className="px-6 flex items-center gap-2 mb-8">
                    <div className="text-blue-600"><Zap className="w-6 h-6 fill-current"/></div>
                    <span className="font-black text-slate-900 text-lg">AquaDealer</span>
                  </div>
                  <div className="px-4 space-y-2">
                    <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20">
                      <BarChart3 className="w-4 h-4"/> Dashboard
                    </div>
                    {[
                      { icon: Package, text: "Inventory" },
                      { icon: FileText, text: "Billing" },
                      { icon: TrendingUp, text: "Customers" },
                      { icon: CreditCard, text: "Dues" },
                      { icon: FileText, text: "Reports" },
                      { icon: CreditCard, text: "Expenses" },
                      { icon: Zap, text: "Settings" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-slate-500 hover:bg-slate-100 px-4 py-3 rounded-xl font-bold text-sm">
                        <item.icon className="w-4 h-4"/> {item.text}
                      </div>
                    ))}
                  </div>
               </div>
               
               {/* Main Content */}
               <div className="flex-1 p-8 bg-[#FAFBFC] flex flex-col gap-6">
                 {/* Top Stats */}
                 <div className="grid grid-cols-4 gap-4">
                   <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                     <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2"><Package className="w-3 h-3"/> Inventory Items</div>
                     <div className="text-2xl font-black text-slate-900 mb-2">245</div>
                     <div className="w-8 h-1 bg-blue-500 rounded-full" />
                   </div>
                   <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                     <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">Today's Sales</div>
                     <div className="text-2xl font-black text-slate-900 mb-2">₹12,850</div>
                     <div className="w-8 h-1 bg-green-500 rounded-full" />
                   </div>
                   <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                     <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">Pending Dues</div>
                     <div className="text-2xl font-black text-slate-900 mb-2">₹18,200</div>
                     <div className="w-8 h-1 bg-red-500 rounded-full" />
                   </div>
                   <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                     <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2"><TrendingUp className="w-3 h-3"/> Active Customers</div>
                     <div className="text-2xl font-black text-slate-900 mb-2">238</div>
                     <div className="w-8 h-1 bg-blue-500 rounded-full" />
                   </div>
                 </div>

                 {/* Middle Grid */}
                 <div className="grid grid-cols-[1fr_1.2fr] gap-6 flex-1">
                   {/* Recent Bills */}
                   <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                     <div className="font-bold text-slate-900 mb-6 text-sm">Recent Bills</div>
                     <div className="space-y-6">
                       {[
                         { name: "Ramesh Aqua Farm", id: "INV-00123", amt: "₹3,250", status: "Paid", color: "text-green-600 bg-green-50" },
                         { name: "Karthik Fisheries", id: "INV-00122", amt: "₹2,450", status: "Paid", color: "text-green-600 bg-green-50" },
                         { name: "Sri Lakshmi Aqua", id: "INV-00121", amt: "₹5,800", status: "Pending", color: "text-orange-600 bg-orange-50" },
                         { name: "Green Aqua Farm", id: "INV-00120", amt: "₹1,780", status: "Paid", color: "text-green-600 bg-green-50" },
                       ].map((bill, i) => (
                         <div key={i} className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <img src={`https://i.pravatar.cc/100?img=${i+11}`} className="w-10 h-10 rounded-full" alt="" />
                             <div>
                               <div className="text-xs font-bold text-slate-900">{bill.name}</div>
                               <div className="text-[10px] text-slate-400">{bill.id}</div>
                             </div>
                           </div>
                           <div className="flex items-center gap-4">
                             <div className="text-xs font-bold text-slate-900">{bill.amt}</div>
                             <div className={`text-[10px] font-bold px-2 py-1 rounded-md ${bill.color}`}>{bill.status}</div>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Right Side: Chart + Products */}
                   <div className="flex flex-col gap-6">
                     {/* Sales Trend Chart */}
                     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col">
                       <div className="flex justify-between items-center mb-6">
                         <div className="font-bold text-slate-900 text-sm">Sales Trend</div>
                         <div className="text-xs text-slate-500 font-medium">This Month ▾</div>
                       </div>
                       <div className="flex-1 relative flex items-end justify-between gap-2 px-2 mt-4">
                         {[40, 60, 30, 80, 50, 40, 90, 100, 60].map((h, i) => (
                           <div key={i} className="w-full bg-blue-50 rounded-t-sm relative group flex justify-center h-full items-end">
                             <div className="w-3 bg-blue-500 rounded-t-sm" style={{ height: `${h}%` }} />
                           </div>
                         ))}
                       </div>
                     </div>

                     {/* Top Products */}
                     <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                       <div className="flex justify-between items-center mb-4">
                         <div className="font-bold text-slate-900 text-sm">Top Products</div>
                         <div className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">View All</div>
                       </div>
                       <div className="flex items-center gap-6">
                         <div className="flex items-center gap-2">
                           <img src="https://i.pravatar.cc/100?img=21" className="w-8 h-8 rounded-full border border-slate-200" alt="product" />
                           <div>
                             <div className="text-[10px] font-bold text-slate-900">CP 9951 Starter</div>
                             <div className="text-[10px] text-slate-400">120 bags</div>
                           </div>
                         </div>
                         <div className="flex items-center gap-2">
                           <img src="https://i.pravatar.cc/100?img=22" className="w-8 h-8 rounded-full border border-slate-200" alt="product" />
                           <div>
                             <div className="text-[10px] font-bold text-slate-900">Growel Feed</div>
                             <div className="text-[10px] text-slate-400">85 bags</div>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* 5. DARK FEATURE SECTION */}
      <section className="py-12 lg:py-24 bg-[#0A1128] text-white overflow-hidden relative">
        <div className="max-w-[1400px] mx-auto px-6 grid lg:grid-cols-[1fr_1.3fr] gap-16 lg:gap-8 items-center">
          <div className="lg:pr-12">
            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-blue-900/40 text-blue-400 font-bold text-xs tracking-wider uppercase mb-6 border border-blue-800/50">
              <Star className="w-3 h-3 fill-current text-yellow-500" /> GROW FASTER, STRESS LESS
            </span>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-8 leading-[1.1] text-white">
              Everything You Need to Scale With Confidence.
            </h2>
            <ul className="space-y-6">
              {[
                "Live business insights at your fingertips",
                "Automated WhatsApp reminders",
                "Track collections & payments easily",
                "Detailed reports to grow profitably"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-4 text-base font-medium text-slate-300">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center flex-shrink-0">
                    <Check className="text-blue-500 w-3 h-3" strokeWidth={3} />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="relative h-[350px] sm:h-[450px] lg:h-[600px] w-full flex items-center z-10 overflow-hidden lg:overflow-visible">
             <div className="absolute left-0 w-[900px] h-[600px] transform scale-[0.35] sm:scale-[0.50] md:scale-[0.60] lg:scale-[0.70] xl:scale-[0.85] origin-left flex items-stretch gap-6">
                
                {/* Mobile Mockup (Left side of right column) */}
                <div className="w-[320px] h-full bg-white rounded-[3rem] border-[12px] border-slate-900 shadow-2xl relative overflow-hidden flex flex-col shrink-0">
                  {/* Notch */}
                  <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 rounded-b-3xl w-36 mx-auto z-30" />
                  
                  <div className="p-6 pt-12 flex-1 flex flex-col">
                    <h3 className="text-slate-900 font-black text-xl mb-6">Dues Overview</h3>
                    
                    {/* Donut Chart Mockup */}
                    <div className="relative w-48 h-48 mx-auto mb-8">
                      {/* Using CSS Conic Gradient for Donut Chart */}
                      <div className="absolute inset-0 rounded-full shadow-sm" style={{ background: 'conic-gradient(#10B981 0% 35%, #3B82F6 35% 80%, #F59E0B 80% 100%)' }} />
                      <div className="absolute inset-[18px] bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                         <div className="text-xl font-black text-slate-900">₹18,200</div>
                         <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Pending</div>
                      </div>
                    </div>

                    <div className="space-y-4 px-4 mb-8">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-slate-600 font-bold">0-30 Days</span></div>
                        <div className="font-bold text-slate-900">₹8,600</div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-slate-600 font-bold">31-60 Days</span></div>
                        <div className="font-bold text-slate-900">₹6,200</div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-slate-600 font-bold">60+ Days</span></div>
                        <div className="font-bold text-slate-900">₹3,400</div>
                      </div>
                    </div>

                    {/* WhatsApp Reminder Card */}
                    <div className="mt-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">Reminders Sent</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">This Week <span className="font-bold text-slate-900 ml-2">785</span></div>
                      </div>
                      <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid of Cards (Right side of right column) */}
                <div className="grid grid-cols-2 gap-6 flex-1 py-4">
                  <div className="bg-white rounded-3xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-center">
                    <div className="text-slate-500 text-sm font-bold mb-2 flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      </div>
                      Total Revenue
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-2">₹1,45,000</div>
                    <div className="text-xs font-bold text-green-500">▲ 12.5% vs last month</div>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-slate-300"/></div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-center">
                    <div className="text-slate-500 text-sm font-bold mb-2 flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                      Collections
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-2">₹1,18,500</div>
                    <div className="text-xs font-bold text-emerald-500">▲ 8.2% vs last month</div>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-slate-300"/></div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-center">
                    <div className="text-slate-500 text-sm font-bold mb-2 flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-red-500" />
                      </div>
                      Overdue Amount
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-2">₹18,200</div>
                    <div className="text-xs font-bold text-red-500">▼ 5.3% vs last month</div>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-slate-300"/></div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-center">
                    <div className="text-slate-500 text-sm font-bold mb-2 flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                        <Star className="w-4 h-4 text-purple-500" />
                      </div>
                      Profit This Month
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-2">₹38,750</div>
                    <div className="text-xs font-bold text-green-500">▲ 15.4% vs last month</div>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="w-5 h-5 text-slate-300"/></div>
                  </div>
                </div>
                
             </div>
          </div>
        </div>
      </section>

      {/* 6. PRICING SECTION */}
      <section id="pricing" className="py-12 lg:py-24 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10 lg:mb-16">
            <span className="text-blue-600 font-bold tracking-wider text-sm uppercase mb-2 block">Simple Pricing</span>
            <h2 className="text-4xl font-black tracking-tight mb-4 text-slate-900">Plans That Grow With You</h2>
            <p className="text-slate-500 text-lg">No hidden fees. Cancel anytime.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
            {/* Basic Plan */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all h-full flex flex-col">
              <h3 className="text-2xl font-bold mb-1 text-slate-900">Basic</h3>
              <p className="text-slate-500 text-sm mb-6">For single-shop dealers</p>
              <div className="text-5xl font-black text-slate-900 mb-2">₹3,499<span className="text-lg text-slate-500 font-medium">/year</span></div>
              <p className="text-sm text-slate-500 mb-6 font-medium">1 branch · unlimited farmers</p>
              <ul className="space-y-4 my-8 flex-grow">
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Unlimited farmers</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Unlimited bills</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 1 branch</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> All core features</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Cashbook + expenses</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Data export Excel</li>
              </ul>
              <Link to="/register" className="w-full py-4 block text-center text-blue-600 font-bold border-2 border-blue-100 rounded-full hover:bg-blue-50 hover:border-blue-600 transition-colors">Start 30-Day Free Trial</Link>
            </div>

            {/* Pro Plan */}
            <div className="p-8 rounded-3xl bg-blue-600 text-white shadow-2xl shadow-blue-500/20 relative h-full flex flex-col transform lg:scale-105 z-10 border-4 border-white">
              <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-bl-lg rounded-tr-xl tracking-wider">POPULAR</div>
              <h3 className="text-2xl font-bold mb-1">Pro</h3>
              <p className="text-blue-200 text-sm mb-6">Multi-branch + GST + Voice</p>
              <div className="text-5xl font-black mb-2">₹4,999<span className="text-lg text-blue-200 font-medium">/year</span></div>
              <p className="text-sm text-blue-200 mb-6 font-medium">3 branches · GST · voice · PIN</p>
              <ul className="space-y-4 my-8 flex-grow">
                <li className="flex items-center gap-3 font-medium"><CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" /> Everything in Basic</li>
                <li className="flex items-center gap-3 font-medium"><CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" /> Up to 3 branches</li>
                <li className="flex items-center gap-3 font-medium"><CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" /> GST billing + report</li>
                <li className="flex items-center gap-3 font-medium"><CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" /> Telugu voice search</li>
                <li className="flex items-center gap-3 font-medium"><CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" /> Monthly P&L summary</li>
                <li className="flex items-center gap-3 font-medium"><CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" /> App PIN lock</li>
              </ul>
              <Link to="/register" className="w-full py-4 block text-center text-blue-600 hover:text-blue-700 bg-white font-bold rounded-full hover:bg-slate-50 transition-colors shadow-xl shadow-blue-800/20 !text-blue-600">Start 30-Day Free Trial</Link>
            </div>

            {/* Pro+ Plan */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all h-full flex flex-col">
              <h3 className="text-2xl font-bold mb-1 text-slate-900">Pro+</h3>
              <p className="text-slate-500 text-sm mb-6">For large multi-branch dealers</p>
              <div className="text-5xl font-black text-slate-900 mb-2">₹6,999<span className="text-lg text-slate-500 font-medium">/year</span></div>
              <p className="text-sm text-slate-500 mb-6 font-medium">unlimited branches · staff · signature · rate diff</p>
              <ul className="space-y-4 my-8 flex-grow">
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> Everything in Pro</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> Unlimited branches</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> Staff logins per branch</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> Farmer signature proof</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> Farmer photo uploads</li>
                <li className="flex items-center gap-3 text-slate-700 font-medium"><CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" /> Smart Rate Diff</li>
              </ul>
              <Link to="/register" className="w-full py-4 block text-center text-blue-600 font-bold border-2 border-blue-100 rounded-full hover:bg-blue-50 hover:border-blue-600 transition-colors">Start 30-Day Free Trial</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. TESTIMONIALS */}
      <section className="py-12 lg:py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-10 lg:mb-16 text-slate-900">Loved by Aqua Dealers</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50 flex gap-4">
              <img src="https://i.pravatar.cc/150?img=11" alt="avatar" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className="text-sm text-slate-700 italic mb-3">"AquaDealer helped us reduce pending dues by 60% and save hours of work daily."</p>
                <div className="font-bold text-sm text-slate-900">Ramesh Kumar</div>
                <div className="text-xs text-slate-500">Sri Balaji Aqua Feeds</div>
              </div>
            </div>
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50 flex gap-4">
              <img src="https://i.pravatar.cc/150?img=12" alt="avatar" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className="text-sm text-slate-700 italic mb-3">"Billing and inventory management is now so easy and fast."</p>
                <div className="font-bold text-sm text-slate-900">Karthik Raja</div>
                <div className="text-xs text-slate-500">Karthik Fisheries</div>
              </div>
            </div>
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50 flex gap-4">
              <img src="https://i.pravatar.cc/150?img=13" alt="avatar" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className="text-sm text-slate-700 italic mb-3">"WhatsApp reminders are a game changer! Payments are on time now."</p>
                <div className="font-bold text-sm text-slate-900">Suresh Babu</div>
                <div className="text-xs text-slate-500">Green Aqua Farm</div>
              </div>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">Trusted by Businesses Across India</p>
            <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              {/* Dummy logos */}
              <div className="text-xl font-black tracking-tight text-slate-800">CP AQUA</div>
              <div className="text-xl font-black tracking-tight text-slate-800">GROWEL</div>
              <div className="text-xl font-black tracking-tight text-slate-800">Avanti Feeds</div>
              <div className="text-xl font-black tracking-tight text-slate-800">TAIYO</div>
              <div className="text-xl font-black tracking-tight text-slate-800">BioMax</div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. BOTTOM CTA */}
      <section className="py-20 bg-blue-600 relative overflow-hidden">
        {/* Background Graphic Suggestion */}
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 pointer-events-none text-white">
          <svg width="400" height="400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        </div>
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-black mb-4 text-white">Ready to Modernize Your Aqua Business?</h2>
          <p className="text-blue-100 text-lg mb-10">Join 100+ dealers who are growing faster with AquaDealer.</p>
          <a href="/register" className="inline-flex items-center justify-center gap-2 px-10 py-5 text-lg font-bold bg-white text-blue-600 rounded-full shadow-2xl hover:bg-slate-50 hover:scale-105 transition-all relative z-50 cursor-pointer">
            <span className="text-blue-600">Start Your Free Trial</span> <ArrowRight className="w-5 h-5 text-blue-600" />
          </a>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="AquaDealer" className="h-8 w-auto" />
                <span className="text-xl font-extrabold tracking-tight text-slate-900">AquaDealer</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">Manage • Bill • Grow</p>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">How it Works</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Support</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} AquaDealer. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
               {/* Stay Connected Icons Placeholder */}
               <span className="text-xs font-bold text-slate-900 mr-2">Stay Connected</span>
               <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">f</div>
               <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs">t</div>
               <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">w</div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
