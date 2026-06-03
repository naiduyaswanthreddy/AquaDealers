import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, FileText, Plus, UserPlus2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button, Badge } from '@/components/ui';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';
import { STAFF_FEATURES, getStaffFeatureMode } from '@/lib/staffAccess';
import { cn, formatCurrency } from '@/lib/utils';

export const StaffHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { branches, activeBranch } = useBranchStore();
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const portalContext = useStaffStore((state) => state.portalContext);

  const visibleFeatures = STAFF_FEATURES.filter(
    (feature) => getStaffFeatureMode(feature.key, currentStaff?.permissions, !!currentStaff) === 'visible'
  );

  const quickActionFeatures = visibleFeatures.filter((feature) => feature.key === 'newBill' || feature.key === 'addFarmer');

  const branchList = currentStaff?.branchIds.length
    ? branches.filter((branch) => currentStaff.branchIds.includes(branch.id))
    : branches;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Staff Workspace"
        title={currentStaff?.name || 'Staff Home'}
        description={`Working branch: ${activeBranch?.name || portalContext?.branchName || 'Assigned branch'}`}
        action={
          <Button variant="outline" onClick={() => navigate('/more')} rightIcon={<ArrowRight className="h-4.5 w-4.5" />}>
            Open More
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card p-5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Allowed actions</div>
          <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">{visibleFeatures.length}</div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Only the enabled staff features are shown in the shell.</p>
        </div>
        <div className="surface-card p-5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Branch scope</div>
          <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">
            {currentStaff?.branchIds.length ? currentStaff.branchIds.length : branches.length}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Leave the branch list empty to allow every active branch.</p>
        </div>
        <div className="surface-card p-5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Primary branch</div>
          <div className="mt-2 text-lg font-black tracking-[-0.04em] text-text-primary">{activeBranch?.name || portalContext?.branchName || '—'}</div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">This is the branch currently selected in the shell.</p>
        </div>
        <div className="surface-card p-5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Hidden modules</div>
          <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">
            {STAFF_FEATURES.length - visibleFeatures.length}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Hidden items stay unavailable in nav and direct routes.</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Quick actions"
          description="These are the fastest paths for day-to-day staff work."
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActionFeatures.length ? quickActionFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.key}
                  type="button"
                  onClick={() => navigate(feature.route)}
                  className={cn(
                    'focus-ring flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-4 text-left transition-all hover:bg-surface',
                    'shadow-sm hover:shadow-[0_10px_24px_rgba(20,103,159,0.08)]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('rounded-2xl p-3', feature.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">{feature.label}</div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Open now</div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-text-muted" />
                </button>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface/35 px-4 py-8 text-center text-sm text-text-secondary sm:col-span-2">
                No quick actions are enabled for this staff profile.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Accessible modules" description="Visible modules are available in the staff shell.">
          <div className="space-y-3">
            {visibleFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.key} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('rounded-2xl p-3', feature.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary">{feature.label}</div>
                      <div className="truncate text-xs text-text-secondary">{feature.description}</div>
                    </div>
                  </div>
                  <Badge variant="success" className="normal-case tracking-[0.02em]">
                    Enabled
                  </Badge>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Branch access" description="Staff can only move through the branches assigned to them.">
        <div className="flex flex-wrap gap-2">
          {(branchList.length ? branchList : branches).map((branch) => (
            <Badge key={branch.id} variant={branch.is_main ? 'info' : 'neutral'} className="normal-case tracking-[0.02em]">
              {branch.name}
            </Badge>
          ))}
          {!branchList.length && !branches.length ? (
            <div className="text-sm text-text-secondary">No branch data is loaded yet.</div>
          ) : null}
        </div>
      </SectionCard>
    </PageShell>
  );
};

export default StaffHomePage;
