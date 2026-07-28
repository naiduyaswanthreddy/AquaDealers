import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, Share2, Loader2,
  Layers, CheckCircle2, XCircle, Package,
  Search, ChevronsUpDown, ChevronRight,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DateRangeFilter, Button } from '@/components/ui';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { useStockLedgerReport } from '../hooks/useStockReport';
import { useAuthStore } from '@/stores/authStore';
import { downloadStockReportPdf, shareStockReportViaWhatsApp } from '../utils/stockReportPdf';
import { formatDateTime, formatQuantity, getLocalDateString } from '@/lib/utils';

export const StockReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dealer = useAuthStore((s) => s.user);

  const now = useMemo(() => new Date(), []);
  const defaultFirstDay = useMemo(
    () => getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    [now]
  );
  const defaultLastDay = useMemo(
    () => getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    [now]
  );

  const [startDate, setStartDate] = useState(defaultFirstDay);
  const [endDate, setEndDate] = useState(defaultLastDay);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(20);

  // Reset pagination when search or date filters change
  React.useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, startDate, endDate]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const { data: reportItems = [], isLoading } = useStockLedgerReport(startDate, endDate);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return reportItems;
    const lowerQ = searchQuery.toLowerCase();
    return reportItems.filter(item => 
      (item.productName || '').toLowerCase().includes(lowerQ) || 
      (item.category || '').toLowerCase().includes(lowerQ)
    );
  }, [reportItems, searchQuery]);

  const displayedItems = filteredItems.slice(0, visibleCount);

  const totalItems = reportItems.length;
  const totalInStock = reportItems.filter(item => (item.currentStock || 0) > 0).length;
  const outOfStock = reportItems.filter(item => (item.currentStock || 0) <= 0).length;
  const totalQty = reportItems.reduce((acc, item) => acc + (item.currentStock || 0), 0);

  const handleShareReport = async () => {
    try {
      setIsExporting(true);
      await shareStockReportViaWhatsApp(reportItems, dealer, startDate, endDate);
    } catch (error) {
      console.error('Failed to share stock report', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setIsExporting(true);
      await downloadStockReportPdf(reportItems, dealer, startDate, endDate);
    } catch (error) {
      console.error('Failed to download stock report', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageShell width="full">
      <PageHeader
        title="Stock Ledger Report"
        onBack={() => navigate(-1)}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" leftIcon={isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} onClick={handleDownloadReport} disabled={isExporting || reportItems.length === 0}>
              PDF
            </Button>
            <Button variant="outline" size="sm" leftIcon={isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} onClick={handleShareReport} disabled={isExporting || reportItems.length === 0}>
              Share
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        
        {/* Date Filter Card */}
        <div className="bg-white rounded-2xl p-2 sm:p-3 shadow-sm border border-slate-100 flex items-center justify-between w-full max-w-2xl mx-auto">
           <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
           />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
               <Layers size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Total Items</div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">{totalItems}</div>
              <div className="text-xs font-semibold text-slate-400 mt-0.5">All items</div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
               <CheckCircle2 size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Total In Stock</div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">{totalInStock.toLocaleString()}</div>
              <div className="text-xs font-semibold text-slate-400 mt-0.5">Items</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
               <XCircle size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Out of Stock</div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">{outOfStock.toLocaleString()}</div>
              <div className="text-xs font-semibold text-slate-400 mt-0.5">Items</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
               <Package size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">Total Qty</div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">{totalQty.toLocaleString()}</div>
              <div className="text-xs font-semibold text-slate-400 mt-0.5">Units</div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by item name or group" 
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 bg-white">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] flex-1">Item Name</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] w-24 sm:w-32 hidden sm:block text-center">Group</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] w-24 text-right flex items-center justify-end gap-1">
              Stock (Units) <ChevronsUpDown size={12} className="text-slate-300"/>
            </div>
          </div>

          <div className="flex-1">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-slate-500 text-sm font-medium">No items found</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {displayedItems.map(item => {
                  const isExpanded = expandedItems.has(item.inventoryId);
                  return (
                  <div key={item.inventoryId} className="border-b border-slate-50 last:border-b-0">
                    <div 
                      onClick={() => toggleExpand(item.inventoryId)}
                      className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                          <Package size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 text-sm truncate">{item.productName}</div>
                          {item.companyName && (
                            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate mt-0.5">
                              {item.companyName}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="w-24 sm:w-32 hidden sm:flex justify-center shrink-0">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-[9px] sm:text-[10px] font-black uppercase tracking-wider border border-blue-100/50">
                          {item.category || 'General'}
                        </span>
                      </div>
                      
                      <div className="w-24 flex items-center justify-end gap-1.5 sm:gap-3 shrink-0">
                        <span className={`text-[13px] font-black ${(item.currentStock || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatQuantity(item.currentStock, item.unit)}
                        </span>
                        <ChevronRight 
                          size={16} 
                          className={`text-slate-300 group-hover:text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                        />
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 px-4 sm:px-6 py-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Farmer Allocations ({formatQuantity(item.totalOut, item.unit)} Sold)</h4>
                        {item.farmers.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.farmers.map((farmer, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white border border-slate-200/60 rounded-lg px-3 py-2">
                                <span className="text-sm font-medium text-slate-600 truncate mr-2">{farmer.farmerName}</span>
                                <span className="text-sm font-bold text-slate-800">{formatQuantity(farmer.quantity, item.unit)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 py-2">No farmers allocated in this period.</div>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>

          {!isLoading && visibleCount < filteredItems.length && (
            <div className="p-4 bg-white flex justify-center border-t border-slate-50">
              <button 
                onClick={() => setVisibleCount(v => v + 20)}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-50/50 hover:bg-blue-50 text-blue-600 rounded-full text-[13px] font-bold transition-colors"
              >
                <ChevronDown size={16} /> View More Items
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-4 pb-8 text-[11px] font-semibold text-slate-400 px-2">
          <div>
            {filteredItems.length === 0 
              ? 'Showing 0 items' 
              : `Showing 1 to ${displayedItems.length} of ${filteredItems.length} items`}
          </div>
        </div>

      </div>
    </PageShell>
  );
};

export default StockReportPage;
