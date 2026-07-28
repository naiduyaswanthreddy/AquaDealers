import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Slight delay to allow modal animation before focusing
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'auto';
      setQuery('');
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 1) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        // Mock search completion
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
    }
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-200">
      {/* Search Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-slate-800/50">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search', 'Search farmers, bills, or products...')}
            className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-full py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Search Results Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {query.trim().length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p>Start typing to search across the app.</p>
          </div>
        ) : isSearching ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mock Results - In a real app, you'd map over actual data */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">Farmers</h3>
              <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/5">
                <button className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left">
                  <div>
                    <div className="font-bold text-white">Test Farmer</div>
                    <div className="text-sm text-slate-400">#9876543210 • Village</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
