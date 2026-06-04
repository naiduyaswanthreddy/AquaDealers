import re

with open('src/features/inventory/pages/InventoryDetailPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
imports_pattern = r"(import \{\n.*?\} from 'lucide-react';)"
new_imports = """import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Link2,
  MoreVertical,
  Package2,
  PackagePlus,
  Pencil,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  LayoutGrid,
  BarChart2,
  Layers,
  Clock,
  SlidersHorizontal,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';"""
content = re.sub(imports_pattern, new_imports, content, flags=re.DOTALL)

# Add activeTab state
state_pattern = r"(const \[dailyMovementDate, setDailyMovementDate\] = useState\(\(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\);)"
new_state = r"\1\n  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'lots' | 'history'>('overview');"
content = re.sub(state_pattern, new_state, content)

# Extract original sections to reuse later
# The old return statement:
return_pattern = r"return \(\n    <PageShell>.*?</PageShell>\n  \);"

new_return = """return (
    <PageShell width="full" className="bg-[#F8FAFC] pb-24">
      {/* ── Custom Blue Header ── */}
      <div className="bg-[#0070F3] text-white pt-6 pb-20 px-5 rounded-b-[2rem] relative shadow-md">
        {/* Top actions */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/inventory')} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsEditInventoryOpen(true)} className="text-white">
              <Pencil className="w-5 h-5" />
            </button>
            <button className="text-white">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-24 bg-white rounded-xl flex items-center justify-center p-2 shadow-sm shrink-0">
            {productArt ? (
              <img src={productArt} alt="Product" className="w-full h-full object-contain" />
            ) : (
              <Package2 className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold truncate tracking-tight leading-none">{inventory.product.name}</h1>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {inventory.product.type}
              </span>
            </div>
            
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-3 ${
              health.badge === 'danger' ? 'bg-rose-100 text-rose-700' :
              health.badge === 'warning' ? 'bg-[#FFE8B3] text-[#B77A00]' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              <health.icon className="w-3.5 h-3.5" />
              {health.label}
            </div>

            <div className="flex items-center gap-3 text-xs text-white/90 whitespace-nowrap">
              <div>Selling Price: <span className="font-bold">₹{inventory.selling_price?.toLocaleString()}</span> / {inventory.product.unit}</div>
              <div className="w-px h-3 bg-white/30 shrink-0" />
              <div>Cost Price: <span className="font-bold">₹{inventory.cost_price?.toLocaleString()}</span> / {inventory.product.unit}</div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/purchases/new')}
            className="flex-1 bg-white text-[#0070F3] py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-transform active:scale-95"
          >
            <div className="w-5 h-5 bg-[#0070F3] rounded-full flex items-center justify-center text-white">
               <Plus className="w-3.5 h-3.5" />
            </div>
            Add Stock
          </button>
          <button 
            onClick={() => setIsAdjustOpen(true)}
            className="flex-1 bg-white text-[#0070F3] py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-transform active:scale-95"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#0070F3]" />
            Adjust Stock
          </button>
        </div>
      </div>

      {/* ── Current Stock Card (Always Visible) ── */}
      <div className="px-4 -mt-10 relative z-10 mb-4 max-w-4xl mx-auto">
        <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100/50 p-5">
          <div className="flex items-start justify-between mb-4">
             <div>
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-2">
                   <Package2 className="w-4 h-4 text-sky-500" />
                   Current Stock
                </div>
                <div className="flex items-baseline gap-1.5">
                   <span className="text-5xl font-extrabold text-[#0070F3] tracking-tight">{data.summary.currentStock}</span>
                   <span className="text-sm font-semibold text-slate-500">{stockUnit}</span>
                </div>
                <div className="text-xs font-medium text-slate-500 mt-1">
                   Alert threshold: {data.summary.lowStockThreshold ?? 0} {stockUnit}
                </div>
             </div>
             
             {/* Expiry Box */}
             <div className="bg-[#FFF9EB] border border-[#FFE8B3] rounded-xl p-3 text-center min-w-[110px]">
                <div className="text-[#B77A00] text-[10px] font-bold uppercase flex items-center justify-center gap-1 mb-2">
                   <AlertTriangle className="w-3.5 h-3.5" />
                   {health.label}
                </div>
                <div className="text-[10px] font-medium text-slate-500 mb-0.5">Latest expiry</div>
                <div className="text-xs font-bold text-slate-800">
                   {inventory.expiry_date ? formatDate(inventory.expiry_date) : '—'}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100">
             <div className="flex flex-col gap-1 items-center justify-center text-center">
                <div className="flex items-center gap-1.5">
                   <CircleDollarSign className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Stock Value</span>
                </div>
                <span className="text-sm font-bold text-[#0070F3]">
                   {data.summary.estimatedStockValue !== null ? `₹${data.summary.estimatedStockValue.toLocaleString()}` : '—'}
                </span>
             </div>
             <div className="flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                <div className="flex items-center gap-1.5">
                   <Boxes className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Available Lots</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{data.summary.availableLots}</span>
             </div>
             <div className="flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                <div className="flex items-center gap-1.5">
                   <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Unit</span>
                </div>
                <span className="text-sm font-bold text-slate-800 capitalize">{inventory.product.unit}</span>
             </div>
             <div className="flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                <div className="flex items-center gap-1.5">
                   <ReceiptText className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Tax (GST)</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{inventory.product.gst_rate}%</span>
             </div>
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="px-4 max-w-4xl mx-auto space-y-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Today's Movement */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <CalendarRange className="w-4 h-4 text-slate-400" />
                  Today's Movement
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                  {formatDate(dailyMovementDate)}
                  <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 border border-slate-100 rounded-[14px] p-3">
                 <div className="text-center flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">Opening</span>
                    <span className="text-[1.35rem] font-black text-[#0070F3] leading-none">{dailyMovement.opening}</span>
                    <span className="text-[9px] font-bold text-[#0070F3] mt-1">units</span>
                 </div>
                 <div className="text-center flex flex-col items-center border-l border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">In</span>
                    <span className="text-[1.35rem] font-black text-emerald-500 leading-none">{dailyMovement.incoming}</span>
                    <span className="text-[9px] font-bold text-emerald-500 mt-1">units</span>
                 </div>
                 <div className="text-center flex flex-col items-center border-l border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">Out (Sold)</span>
                    <span className="text-[1.35rem] font-black text-rose-500 leading-none">{dailyMovement.sold + dailyMovement.adjustedOut}</span>
                    <span className="text-[9px] font-bold text-rose-500 mt-1">units</span>
                 </div>
                 <div className="text-center flex flex-col items-center border-l border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">Remaining</span>
                    <span className="text-[1.35rem] font-black text-[#0070F3] leading-none">{dailyMovement.remaining}</span>
                    <span className="text-[9px] font-bold text-[#0070F3] mt-1">units</span>
                 </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Quick Stats</h3>
              <div className="grid grid-cols-4 gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                <div className="min-w-[100px] bg-[#F4F7FB] border border-[#E5EDF6] rounded-[18px] p-3.5 snap-start text-center flex flex-col items-center justify-center shadow-sm">
                   <Boxes className="w-5 h-5 text-[#0070F3] mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Current Stock</span>
                   <div className="flex items-baseline gap-1 mt-auto">
                     <span className="text-xl font-black text-[#0070F3] leading-none">{data.summary.currentStock}</span>
                   </div>
                   <span className="text-[9px] font-bold text-[#0070F3] mt-1 leading-tight">units</span>
                </div>
                <div className="min-w-[100px] bg-emerald-50 border border-emerald-100 rounded-[18px] p-3.5 snap-start text-center flex flex-col items-center justify-center shadow-sm">
                   <TrendingUp className="w-5 h-5 text-emerald-600 mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Sold This Month</span>
                   <div className="flex items-baseline gap-1 mt-auto">
                     <span className="text-xl font-black text-emerald-600 leading-none">{selectedMonthData ? selectedMonthData.sold : 0}</span>
                   </div>
                   <span className="text-[9px] font-bold text-emerald-600 mt-1 leading-tight">units</span>
                </div>
                <div className="min-w-[100px] bg-[#F9F5FF] border border-[#F3EBFF] rounded-[18px] p-3.5 snap-start text-center flex flex-col items-center justify-center shadow-sm">
                   <div className="w-6 h-6 rounded-full bg-[#EADDFF] text-[#6B21A8] flex items-center justify-center font-bold text-[11px] mb-2">₹</div>
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Stock Value</span>
                   <span className="text-sm font-black text-[#6B21A8] leading-none mt-auto">
                     {data.summary.estimatedStockValue !== null ? `₹${data.summary.estimatedStockValue.toLocaleString()}` : '—'}
                   </span>
                </div>
                <div className="min-w-[100px] bg-[#FFF6EE] border border-[#FFE8D6] rounded-[18px] p-3.5 snap-start text-center flex flex-col items-center justify-center shadow-sm">
                   <Layers className="w-5 h-5 text-[#E36B15] mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Available Lots</span>
                   <span className="text-xl font-black text-[#E36B15] leading-none mt-auto">{data.summary.availableLots}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
               <div className="flex items-center justify-between mb-3 px-1">
                 <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
                 <button onClick={() => setActiveTab('history')} className="text-[11px] font-bold text-[#0070F3] uppercase tracking-wider">View All</button>
               </div>
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2">
                 {data.movements.slice(0, 5).map((movement, idx) => {
                   const isIncoming = movement.quantity_change >= 0;
                   const title = movement.reference_type === 'bill' ? 'Sale' : 
                                 movement.reference_type === 'purchase' ? 'Purchase' : 
                                 movement.reference_type === 'manual_adjustment' ? 'Manual Adjustment' :
                                 getMovementLabel(movement.reference_type, movement.quantity_change);
                   
                   const subtitle = movement.bill?.bill_number ? `Bill ${movement.bill.bill_number}` :
                                    movement.purchase?.invoice_number ? `Purchase record` :
                                    movement.notes || (movement.quantity_change < 0 ? 'Stock reduced' : 'Stock increased');
                   
                   return (
                     <div key={movement.id} className={`flex items-center justify-between p-3 ${idx !== 0 ? 'border-t border-slate-50' : ''}`}>
                       <div className="flex items-center gap-3">
                         <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                           movement.reference_type === 'manual_adjustment' ? 'bg-orange-50 text-orange-500' :
                           isIncoming ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
                         }`}>
                           {movement.reference_type === 'manual_adjustment' ? (
                             <SlidersHorizontal className="w-4 h-4" />
                           ) : isIncoming ? (
                             <ArrowUpCircle className="w-5 h-5" />
                           ) : (
                             <ArrowDownCircle className="w-5 h-5" />
                           )}
                         </div>
                         <div>
                           <div className="text-sm font-bold text-slate-800">{title}</div>
                           <div className="text-[10px] font-medium text-slate-500">{subtitle}</div>
                         </div>
                       </div>
                       <div className="text-right">
                         <div className={`text-sm font-black ${isIncoming ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {isIncoming ? '+' : ''}{movement.quantity_change} units
                         </div>
                         <div className="text-[9px] font-medium text-slate-400 mt-0.5">
                           {formatDateTime(movement.created_at)}
                         </div>
                       </div>
                     </div>
                   );
                 })}
                 {data.movements.length === 0 && (
                   <div className="p-6 text-center text-sm font-medium text-slate-400">No recent activity</div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* Other Tabs content ... */}
        {activeTab === 'analytics' && (
          <div className="py-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
                  <TrendingUp className="h-5 w-5 text-sky-600" />
                  Monthly Analytics
                </div>

                <div className="relative">
                  <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 hover:bg-slate-100 transition-colors cursor-pointer">
                    <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-sm font-bold text-slate-700">
                      {selectedMonthData ? selectedMonthData.month : 'Select Month'}
                    </span>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="month"
                      value={selectedMonthData ? parseMonthLabelToInputVal(selectedMonthData.month) : ''}
                      onChange={handleMonthChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>
              </div>

              {selectedMonthData ? (
                <>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div 
                      onClick={() => setTransactionModalType('in')}
                      className="relative overflow-hidden rounded-[20px] bg-emerald-50 border border-emerald-100 p-4 transition-all hover:-translate-y-0.5 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-emerald-600">
                          This Month In
                        </div>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-emerald-700">
                        {selectedMonthData.received + selectedMonthData.cancelledBack + selectedMonthData.adjustedIn}
                      </div>
                      <div className="mt-1 text-xs font-medium text-emerald-600/70">
                        Received {selectedMonthData.received} • Adj {selectedMonthData.adjustedIn}
                      </div>
                    </div>

                    <div 
                      onClick={() => setTransactionModalType('out')}
                      className="relative overflow-hidden rounded-[20px] bg-rose-50 border border-rose-100 p-4 transition-all hover:-translate-y-0.5 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-rose-600">
                          This Month Out
                        </div>
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-rose-700">
                        {selectedMonthData.sold + selectedMonthData.adjustedOut}
                      </div>
                      <div className="mt-1 text-xs font-medium text-rose-600/70">
                        Sold {selectedMonthData.sold} • Adj {selectedMonthData.adjustedOut}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                      <span>Monthly Trends</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" /> In
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-400" /> Out
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative h-36 flex items-end justify-center gap-6 px-4 pt-6 pb-2 border-b border-slate-100/50">
                      <div className="absolute inset-x-0 top-3 bottom-8 flex flex-col justify-between pointer-events-none z-0">
                        <div className="w-full border-t border-slate-100" />
                        <div className="w-full border-t border-slate-100" />
                        <div className="w-full border-t border-slate-100" />
                      </div>

                      {plotData.map((m) => {
                        const inVal = m.received + m.cancelledBack + m.adjustedIn;
                        const outVal = m.sold + m.adjustedOut;
                        const inHeight = Math.max(4, Math.round((inVal / maxChartVal) * 100));
                        const outHeight = Math.max(4, Math.round((outVal / maxChartVal) * 100));
                        const isSelected = m.month === selectedMonthData.month;
                        
                        return (
                          <div key={m.month} className="relative z-10 flex flex-col items-center w-12 cursor-pointer group" onClick={() => handleMonthChange({target:{value:parseMonthLabelToInputVal(m.month)}} as any)}>
                            <div className="w-full flex items-end justify-center gap-1 h-24">
                              <div style={{ height: `${inHeight}%` }} className={`w-3 rounded-t-sm transition-all duration-300 ${isSelected ? 'bg-emerald-500' : 'bg-emerald-200 group-hover:bg-emerald-300'}`} />
                              <div style={{ height: `${outHeight}%` }} className={`w-3 rounded-t-sm transition-all duration-300 ${isSelected ? 'bg-rose-500' : 'bg-rose-200 group-hover:bg-rose-300'}`} />
                            </div>
                            <span className={`mt-2 text-[10px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                              {m.month.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 text-center text-sm font-medium text-slate-400">
                  No data available
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'lots' && (
          <div className="py-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900 mb-4">
                <ReceiptText className="h-5 w-5 text-sky-600" />
                Lot Breakdown
              </div>
              {data.lots.length ? (
                <div className="space-y-3">
                  {data.lots.map((lot) => (
                    <div key={lot.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {lot.batch_number || 'Unlabelled Batch'}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            Received {formatDate(lot.received_at)}
                            {lot.expiry_date ? ` · Exp ${formatDate(lot.expiry_date)}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-slate-900">
                            {lot.remaining_quantity} {stockUnit}
                          </div>
                          <div className="text-[0.68rem] font-semibold text-slate-400">remaining</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                  <div className="text-sm font-bold text-slate-600">No tracked lots yet</div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="py-4 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900 mb-4">
                <Link2 className="h-5 w-5 text-sky-600" />
                Linked Records
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2">
                    <ReceiptText className="h-4 w-4 text-slate-400" /> Recent Bills
                  </div>
                  <div className="space-y-2">
                    {recentBills.length ? recentBills.map(m => (
                      <button key={m.id} onClick={() => m.bill && navigate(`/bills/${m.bill.id}`)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left hover:bg-white transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-900">{m.bill?.farmer_name_snapshot || 'Unknown Customer'}</div>
                          <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">Bill {m.bill?.bill_number} · {formatDate(m.created_at)}</div>
                        </div>
                        <ChevronRight className="ml-2 h-4 w-4 text-slate-400" />
                      </button>
                    )) : <div className="text-sm text-slate-400">No recent bills found.</div>}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2 mt-4">
                    <ShoppingCart className="h-4 w-4 text-slate-400" /> Recent Purchases
                  </div>
                  <div className="space-y-2">
                    {recentPurchases.length ? recentPurchases.map(m => (
                      <button key={m.id} onClick={() => m.purchase && navigate(`/purchases/${m.purchase.id}`)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left hover:bg-white transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-900">{m.purchase?.supplier_name || 'Unknown Supplier'}</div>
                          <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">Record {m.purchase?.invoice_number || 'N/A'} · {formatDate(m.created_at)}</div>
                        </div>
                        <ChevronRight className="ml-2 h-4 w-4 text-slate-400" />
                      </button>
                    )) : <div className="text-sm text-slate-400">No recent purchases found.</div>}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900 mb-4">
                <Clock className="h-5 w-5 text-sky-600" />
                Full Movement History
              </div>
              <div className="space-y-2">
                {pagedMovements.visibleItems.length > 0 ? (
                  <ListLoadMore items={pagedMovements.visibleItems} totalCount={data.movements.length} onScrollToBottom={pagedMovements.loadMore} className="max-h-[500px] overflow-y-auto">
                    {(item) => {
                      const isIncoming = item.quantity_change > 0;
                      return (
                        <div key={item.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                          <div>
                            <div className="text-sm font-bold text-slate-800">{getMovementLabel(item.reference_type, item.quantity_change)}</div>
                            <div className="text-xs font-medium text-slate-500">{formatDateTime(item.created_at)}</div>
                          </div>
                          <div className={`text-sm font-bold ${isIncoming ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isIncoming ? '+' : ''}{item.quantity_change}
                          </div>
                        </div>
                      )
                    }}
                  </ListLoadMore>
                ) : (
                  <div className="text-sm text-slate-400">No history available.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Tabs ── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-slate-100 px-6 py-2 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex justify-between items-center max-w-md mx-auto">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutGrid },
          { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          { id: 'lots', label: 'Lots', icon: Layers },
          { id: 'history', label: 'History', icon: Clock }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center gap-1 py-1 w-16 transition-colors ${
                isActive ? 'text-[#0070F3]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-[#F0F7FF] text-[#0070F3]' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] ${isActive ? 'font-bold text-slate-800' : 'font-medium'}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Modals ── */}
      <StockAdjustmentModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        inventoryId={inventory.id}
        productId={inventory.product_id}
        currentStock={inventory.quantity_in_stock}
        stockUnit={stockUnit}
      />
      <EditInventoryModal
        isOpen={isEditInventoryOpen}
        onClose={() => setIsEditInventoryOpen(false)}
        inventory={inventory}
      />
"""
content = re.sub(return_pattern, new_return, content, flags=re.DOTALL)

with open('src/features/inventory/pages/InventoryDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done writing to file.")
