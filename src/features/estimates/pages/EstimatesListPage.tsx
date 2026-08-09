// src/features/estimates/pages/EstimatesListPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useEstimates } from '../hooks/useEstimate';

const PAGE_SIZE = 20;

const EstimatesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useEstimates({
    dealerId: user?.id || '',
    limit: PAGE_SIZE,
    offset,
  });

  const estimates = data?.estimates ?? [];
  const totalCount = data?.total_count ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Estimates"
        action={
          <Button size="sm" onClick={() => navigate('/estimates/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Estimate
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading estimates...
          </div>
        )}

        {!isLoading && estimates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <FileText className="h-12 w-12 text-gray-200" />
            <p className="text-gray-500 text-sm">No estimates yet.</p>
            <Button size="sm" onClick={() => navigate('/estimates/new')}>
              Create first estimate
            </Button>
          </div>
        )}

        {estimates.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Estimate #</th>
                    <th className="px-4 py-3">Farmer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {estimates.map(e => (
                    <tr
                      key={e.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/estimates/${e.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {e.estimate_number}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{e.farmer_name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(e.estimate_date)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(e.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                          Estimate
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y">
              {estimates.map(e => (
                <Link
                  key={e.id}
                  to={`/estimates/${e.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {e.estimate_number}
                      </span>
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                        Estimate
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.farmer_name} · {formatDate(e.estimate_date)}
                    </p>
                  </div>
                  <span className="font-semibold text-sm text-gray-900">
                    {formatCurrency(e.total)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
                <span>{totalCount} total</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={offset + PAGE_SIZE >= totalCount}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};

export default EstimatesListPage;
