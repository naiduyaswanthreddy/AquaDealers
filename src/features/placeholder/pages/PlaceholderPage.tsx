import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  PencilLine,
  Clock3,
  GitBranch,
  MapPin,
  Phone,
  Building2,
  CheckCircle2,
  ShieldCheck,
  CircleDot,
  Layers3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Modal, Input, Textarea } from '@/components/ui';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { supabase } from '@/lib/supabase';
import type { Branch } from '@/types/database';
import { cn } from '@/lib/utils';
import { useBranchStore } from '@/stores/branchStore';

export const PlaceholderPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pageName = location.pathname.split('/')[1];
  const title = pageName ? pageName.charAt(0).toUpperCase() + pageName.slice(1) : 'Feature';
  const { branches, activeBranch, isAllBranches, setActiveBranch, setAllBranches, setBranches } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  
  const planDefinitions = useSubscriptionStore(state => state.planDefinitions);
  const userPlan = user?.plan || 'trial';
  const planDef = planDefinitions[userPlan];
  const branchLimit = planDef ? planDef.branch_limit : 1;
  const canAddBranch = branchLimit === null || branches.length < branchLimit;
  
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchAddress, setEditBranchAddress] = useState('');
  const [editBranchPhone, setEditBranchPhone] = useState('');
  const [editBranchIsMain, setEditBranchIsMain] = useState(false);
  const [editBranchIsActive, setEditBranchIsActive] = useState(true);
  const [isSavingEditBranch, setIsSavingEditBranch] = useState(false);

  const openAddBranchModal = () => {
    setBranchName('');
    setBranchAddress('');
    setBranchPhone('');
    setIsAddBranchOpen(true);
  };

  const closeEditBranchModal = () => {
    setEditingBranch(null);
    setEditBranchName('');
    setEditBranchAddress('');
    setEditBranchPhone('');
    setEditBranchIsMain(false);
    setEditBranchIsActive(true);
  };

  const openEditBranchModal = (branch: Branch) => {
    setEditingBranch(branch);
    setEditBranchName(branch.name);
    setEditBranchAddress(branch.address || '');
    setEditBranchPhone(branch.phone || '');
    setEditBranchIsMain(branch.is_main);
    setEditBranchIsActive(branch.is_active);
  };

  const handleAddBranch = async () => {
    const trimmedName = branchName.trim();
    const trimmedAddress = branchAddress.trim();
    const trimmedPhone = branchPhone.trim();

    if (!user?.id) {
      toast.error('You need to sign in before adding a branch.');
      return;
    }

    if (!trimmedName) {
      toast.error('Branch name is required.');
      return;
    }

    try {
      setIsSavingBranch(true);

      const { data, error } = await supabase
        .from('branches')
        .insert({
          dealer_id: user.id,
          name: trimmedName,
          address: trimmedAddress || null,
          phone: trimmedPhone || null,
          is_main: branches.length === 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Branch creation failed.');

      const updatedBranches = [...branches, data];
      setAllBranches(false);
      setBranches(updatedBranches);

      toast.success(`Branch "${data.name}" added successfully.`);
      setIsAddBranchOpen(false);
      setBranchName('');
      setBranchAddress('');
      setBranchPhone('');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to create branch.');
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleUpdateBranch = async () => {
    if (!editingBranch) return;

    const trimmedName = editBranchName.trim();
    const trimmedAddress = editBranchAddress.trim();
    const trimmedPhone = editBranchPhone.trim();
    const branchWasMain = editingBranch.is_main;

    if (!user?.id) {
      toast.error('You need to sign in before editing a branch.');
      return;
    }

    if (!trimmedName) {
      toast.error('Branch name is required.');
      return;
    }

    try {
      setIsSavingEditBranch(true);

      if (editBranchIsMain) {
        const { error: demoteError } = await supabase
          .from('branches')
          .update({ is_main: false })
          .eq('dealer_id', user.id)
          .neq('id', editingBranch.id);

        if (demoteError) throw demoteError;
      }

      const { data, error } = await supabase
        .from('branches')
        .update({
          name: trimmedName,
          address: trimmedAddress || null,
          phone: trimmedPhone || null,
          is_active: editBranchIsActive,
          is_main: editBranchIsMain || editingBranch.is_main,
        })
        .eq('id', editingBranch.id)
        .eq('dealer_id', user.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Branch update failed.');

      const updatedBranches = branches.map((branch: Branch) => {
        if (editBranchIsMain && branch.id !== editingBranch.id) {
          return { ...branch, is_main: false };
        }
        if (branch.id === editingBranch.id) {
          return data;
        }
        return branch;
      });

      setBranches(updatedBranches);

      const refreshedUpdatedBranch = updatedBranches.find((branch: Branch) => branch.id === data.id) || data;
      const refreshedActiveBranch = activeBranch?.id
        ? updatedBranches.find((branch: Branch) => branch.id === activeBranch.id) || null
        : null;
      const fallbackBranch =
        updatedBranches.find((branch: Branch) => branch.is_active && branch.is_main && branch.id !== data.id) ||
        updatedBranches.find((branch: Branch) => branch.is_active && branch.id !== data.id) ||
        null;

      if (!branchWasMain && editBranchIsMain && editBranchIsActive) {
        setAllBranches(false);
        setActiveBranch(refreshedUpdatedBranch);
      } else if (activeBranch?.id === data.id) {
        if (editBranchIsActive) {
          setActiveBranch(refreshedUpdatedBranch);
        } else {
          if (fallbackBranch) {
            setActiveBranch(fallbackBranch);
          } else {
            setAllBranches(true);
          }
        }
      } else if (refreshedActiveBranch) {
        setActiveBranch(refreshedActiveBranch);
      }

      toast.success(`Branch "${data.name}" updated successfully.`);
      closeEditBranchModal();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to update branch.');
    } finally {
      setIsSavingEditBranch(false);
    }
  };

  if (location.pathname === '/branches') {
    const mainBranch = branches.find((branch: Branch) => branch.is_main) || branches[0] || null;
    const activeCount = branches.filter((branch: Branch) => branch.is_active).length;

    return (
      <PageShell width="wide">
        <div className="page-header">
          <div className="page-header__hero">
            <div className="w-full">
              <span className="page-header__eyebrow">Workspace</span>
              <div className="page-header__meta">
                <div className="min-w-0 flex-1">
                  <h1 className="page-header__title">Branches</h1>
                  <p className="page-header__description mt-2">
                    Manage your shops, switch the active working branch, and keep future branch tools in one place.
                  </p>
                </div>
                <div className="page-header__action">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      className="!border-white/20 !bg-white/12 !text-white hover:!bg-white/18"
                      leftIcon={<Layers3 className="h-4.5 w-4.5" />}
                      onClick={() => setAllBranches(true)}
                    >
                      View All
                    </Button>
                    <Button
                      variant="success"
                      leftIcon={<Plus className="h-4.5 w-4.5" />}
                      onClick={() => {
                        if (canAddBranch) {
                          openAddBranchModal();
                        } else {
                          toast.error(`Your current plan limits you to ${branchLimit} branch(es). Please upgrade to add more.`);
                        }
                      }}
                      disabled={!canAddBranch}
                    >
                      Add Branch
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Total branches
                </div>
                <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">
                  {branches.length}
                </div>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <GitBranch className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Active branches
                </div>
                <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">
                  {activeCount}
                </div>
              </div>
              <div className="rounded-2xl bg-success-light p-3 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Main branch
                </div>
                <div className="mt-2 truncate text-xl font-black tracking-[-0.04em] text-text-primary">
                  {mainBranch?.name || 'Not set'}
                </div>
              </div>
              <div className="rounded-2xl bg-info-light p-3 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Workspace mode
                </div>
                <div className="mt-2 text-xl font-black tracking-[-0.04em] text-text-primary">
                  {isAllBranches ? 'All branches' : activeBranch?.name || 'Single branch'}
                </div>
              </div>
              <div className="rounded-2xl bg-surface-muted p-3 text-text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SectionCard
            title="Branch list"
            description="Tap any branch to make it the active workspace for bills, inventory, farmers, and reports."
            headerAction={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4.5 w-4.5" />}
                onClick={() => {
                  if (canAddBranch) {
                    openAddBranchModal();
                  } else {
                    toast.error(`Your current plan limits you to ${branchLimit} branch(es). Please upgrade to add more.`);
                  }
                }}
                disabled={!canAddBranch}
              >
                Add Branch
              </Button>
            }
            className="space-y-4"
          >
            {branches.length > 0 ? (
              <div className="grid gap-3">
                {branches.map((branch: Branch) => {
                  const isActive = !isAllBranches && activeBranch?.id === branch.id;
                  return (
                    <div
                      key={branch.id}
                      className={cn(
                        'flex w-full flex-col gap-4 rounded-2xl border px-4 py-4 text-left transition-all',
                        isActive
                          ? 'border-primary/25 bg-primary/5 shadow-[0_10px_24px_rgba(20,103,159,0.08)]'
                          : 'border-border bg-white hover:border-primary/20 hover:bg-surface/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-extrabold tracking-[-0.02em] text-text-primary">
                              {branch.name}
                            </h3>
                            {branch.is_main ? (
                              <Badge variant="info" className="normal-case tracking-[0.02em]">
                                Main
                              </Badge>
                            ) : null}
                            {!branch.is_active ? (
                              <Badge variant="warning" className="normal-case tracking-[0.02em]">
                                Inactive
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-text-secondary">
                            {branch.address ? (
                              <div className="flex items-start gap-2">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                                <span className="line-clamp-2">{branch.address}</span>
                              </div>
                            ) : null}
                            {branch.phone ? (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 shrink-0 text-text-muted" />
                                <span>{branch.phone}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {isActive ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-primary">
                              <CircleDot className="h-3.5 w-3.5" />
                              Active
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveBranch(branch)}
                              className="min-w-[7.25rem]"
                            >
                              Set Active
                            </Button>
                          )}
                          <span className="text-xs font-semibold text-text-muted">
                            {new Date(branch.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                        <p className="text-xs leading-5 text-text-secondary">
                          {branch.is_main
                            ? 'This is the current main branch for your workspace.'
                            : 'Use edit to rename this branch or make it the main branch.'}
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          leftIcon={<PencilLine className="h-4.5 w-4.5" />}
                          onClick={() => openEditBranchModal(branch)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-border bg-surface/40 p-8 text-center">
                <GitBranch className="mx-auto h-10 w-10 text-primary/60" />
                <h3 className="mt-4 text-base font-extrabold text-text-primary">No branches yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
                  Add your first branch to start using multi-location branch management.
                </p>
                <Button 
                  className="mt-6" 
                  leftIcon={<Plus className="h-4.5 w-4.5" />} 
                  onClick={() => {
                    if (canAddBranch) {
                      openAddBranchModal();
                    } else {
                      toast.error(`Your current plan limits you to ${branchLimit} branch(es). Please upgrade to add more.`);
                    }
                  }}
                  disabled={!canAddBranch}
                >
                  Add Branch
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Branch workspace"
            description="This area is ready for branch-level controls, staff assignment, and branch-specific reporting."
            className="space-y-4"
          >
            <div className="rounded-[1.25rem] bg-gradient-to-br from-primary to-primary-light p-5 text-white shadow-[0_14px_30px_rgba(20,103,159,0.14)]">
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/75">
                Active selection
              </div>
              <div className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {isAllBranches ? 'All branches' : activeBranch?.name || mainBranch?.name || 'Main branch'}
              </div>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/85">
                Bills, inventory, farmers, cashbook, and reports will reflect this branch selection across the app.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white p-4">
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Main shop
                </div>
                <div className="mt-2 text-base font-extrabold text-text-primary">
                  {mainBranch?.name || 'Not available'}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white p-4">
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Branch count
                </div>
                <div className="mt-2 text-base font-extrabold text-text-primary">
                  {branches.length}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/40 p-4 text-sm leading-6 text-text-secondary">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <div className="font-bold text-text-primary">What’s next</div>
                  <p className="mt-1">
                    Branch creation, editing, staff assignment, and branch-level analytics can be dropped into this layout without changing the page structure.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <Modal
          isOpen={isAddBranchOpen}
          onClose={() => setIsAddBranchOpen(false)}
          title="Add Branch"
          footerButtons={[
            {
              label: 'Cancel',
              variant: 'outline',
              onClick: () => setIsAddBranchOpen(false),
              type: 'button',
            },
            {
              label: 'Save Branch',
              variant: 'primary',
              onClick: handleAddBranch,
              loading: isSavingBranch,
              disabled: isSavingBranch,
              type: 'button',
            },
          ]}
        >
          <div className="space-y-4">
            <Input
              label="Branch name"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. Main Shop, Kurnool Outlet"
              autoFocus
            />
            <Textarea
              label="Address"
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder="Branch address"
              rows={3}
            />
            <Input
              label="Phone number"
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              placeholder="Branch contact number"
            />
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-text-secondary">
              <div className="font-bold text-text-primary">Tip</div>
              <p className="mt-1">
                The first branch you create becomes the main branch automatically. Later additions will be saved as regular branches.
              </p>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!editingBranch}
          onClose={closeEditBranchModal}
          title="Edit Branch"
          footerButtons={[
            {
              label: 'Cancel',
              variant: 'outline',
              onClick: closeEditBranchModal,
              type: 'button',
            },
            {
              label: 'Save Changes',
              variant: 'primary',
              onClick: handleUpdateBranch,
              loading: isSavingEditBranch,
              disabled: isSavingEditBranch,
              type: 'button',
            },
          ]}
        >
          <div className="space-y-4">
            <Input
              label="Branch name"
              value={editBranchName}
              onChange={(e) => setEditBranchName(e.target.value)}
              placeholder="Branch name"
              autoFocus
            />
            <Textarea
              label="Address"
              value={editBranchAddress}
              onChange={(e) => setEditBranchAddress(e.target.value)}
              placeholder="Branch address"
              rows={3}
            />
            <Input
              label="Phone number"
              value={editBranchPhone}
              onChange={(e) => setEditBranchPhone(e.target.value)}
              placeholder="Branch contact number"
            />

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/35 px-4 py-4">
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-primary">Main branch</div>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {editingBranch?.is_main
                    ? 'This branch is currently the main shop.'
                    : 'Turn this on to make the branch the default workspace.'}
                </p>
              </div>
              <button
                type="button"
                disabled={editingBranch?.is_main}
                onClick={() => {
                  if (editingBranch?.is_main) return;
                  setEditBranchIsMain((value) => !value);
                }}
                className={cn(
                  'billing-toggle shrink-0',
                  editBranchIsMain ? 'billing-toggle--active' : '',
                  editingBranch?.is_main ? 'cursor-not-allowed opacity-70' : ''
                )}
                aria-pressed={editBranchIsMain}
                aria-label="Toggle main branch"
              >
                <span className="billing-toggle__thumb" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white px-4 py-4">
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-primary">Branch status</div>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {editBranchIsActive ? 'This branch is active and available for use.' : 'This branch is marked inactive.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditBranchIsActive((value) => !value)}
                className={cn('billing-toggle shrink-0', editBranchIsActive ? 'billing-toggle--active' : '')}
                aria-pressed={editBranchIsActive}
                aria-label="Toggle branch active state"
              >
                <span className="billing-toggle__thumb" />
              </button>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-text-secondary">
              <div className="font-bold text-text-primary">Main branch tip</div>
              <p className="mt-1">
                If you turn on <span className="font-semibold text-text-primary">Main branch</span>, this branch becomes the default workspace and the previous main branch is demoted automatically.
              </p>
            </div>
          </div>
        </Modal>
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <SectionCard className="flex min-h-[50dvh] flex-col items-center justify-center py-14 text-center">
        <div className="mb-5 flex h-18 w-18 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock3 className="h-9 w-9" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-text-primary">{title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-text-secondary">
          This section is still being completed, but the layout now follows the new AquaDealers design system so future features can drop in cleanly.
        </p>
        <Button className="mt-8" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="h-4.5 w-4.5" />}>
          Go Back
        </Button>
      </SectionCard>
    </PageShell>
  );
};

export default PlaceholderPage;
