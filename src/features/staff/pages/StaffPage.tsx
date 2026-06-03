import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Plus,
  ShieldCheck,
  Users2,
  CheckCircle2,
  Clock3,
  PencilLine,
  KeyRound,
  Globe,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Input, Modal } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import type { Branch, StaffAccessMode, StaffMember, StaffPermissions } from '@/types/database';
import {
  STAFF_DEFAULT_PERMISSIONS,
  STAFF_FEATURES,
} from '@/lib/staffAccess';
import { buildStaffLink, createStaffMember, listStaffMembers, updateStaffMember } from '../services/staffService';
import { cn, getInitials } from '@/lib/utils';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const FEATURE_GROUPS = [
  {
    title: 'Core Actions',
    keys: ['newBill', 'addFarmer', 'billHistory', 'farmerList'] as const,
  },
  {
    title: 'Business Modules',
    keys: ['inventory', 'suppliers', 'cashbook', 'expenses', 'reports'] as const,
  },
  {
    title: 'Administration',
    keys: ['settings', 'branches', 'staffManagement', 'dashboard'] as const,
  },
];

type FormState = {
  name: string;
  phone: string;
  pin: string;
  confirmPin: string;
  allBranches: boolean;
  selectedBranchIds: string[];
  permissions: StaffPermissions;
  isActive: boolean;
};

const getDefaultFormState = (branches: Branch[]): FormState => ({
  name: '',
  phone: '',
  pin: '',
  confirmPin: '',
  allBranches: true,
  selectedBranchIds: branches.filter((branch) => branch.is_active).map((branch) => branch.id),
  permissions: { ...STAFF_DEFAULT_PERMISSIONS },
  isActive: true,
});

const clonePermissions = (permissions: StaffPermissions): StaffPermissions => ({ ...permissions });

const getDefaultBranchSelection = (branches: Branch[]): string[] => {
  const activeBranches = branches.filter((branch) => branch.is_active).map((branch) => branch.id);
  if (activeBranches.length > 0) return activeBranches;
  return branches.length > 0 ? [branches[0].id] : [];
};

const StaffPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { branches } = useBranchStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [sharePayload, setSharePayload] = useState<{
    title: string;
    staffName: string;
    pin: string;
    link: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [formState, setFormState] = useState<FormState>(getDefaultFormState(branches));

  const staffQuery = useQuery({
    queryKey: ['staff-members', user?.id],
    queryFn: () => listStaffMembers(user!.id),
    enabled: !!user?.id,
  });

  const staffMembers = staffQuery.data ?? [];
  const pagedStaffMembers = useLoadMoreList(staffMembers, {
    initialCount: 3,
    step: 3,
    resetDeps: [staffMembers.length],
  });

  const activeStaffCount = useMemo(
    () => staffMembers.filter((member) => member.is_active).length,
    [staffMembers]
  );

  const staffWithBranchRestrictions = useMemo(
    () => staffMembers.filter((member) => member.branch_ids.length > 0).length,
    [staffMembers]
  );

  const createMutation = useMutation({
    mutationFn: createStaffMember,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff-members', user?.id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ staffId, data }: { staffId: string; data: Parameters<typeof updateStaffMember>[2] }) =>
      updateStaffMember(staffId, user!.id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff-members', user?.id] });
    },
  });

  const primaryBranchForSelection = (branchIds: string[]) => {
    if (branchIds.length > 0) {
      return branches.find((branch) => branchIds.includes(branch.id)) || branches.find((branch) => branch.is_main) || branches[0] || null;
    }
    return branches.find((branch) => branch.is_main) || branches[0] || null;
  };

  const openCreateModal = () => {
    setFormState(getDefaultFormState(branches));
    setIsCreateOpen(true);
  };

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormState({
      name: staff.name,
      phone: staff.phone || '',
      pin: '',
      confirmPin: '',
      allBranches: staff.branch_ids.length === 0,
      selectedBranchIds: staff.branch_ids.length > 0 ? [...staff.branch_ids] : getDefaultBranchSelection(branches),
      permissions: clonePermissions(staff.permissions),
      isActive: staff.is_active,
    });
  };

  const closeEditModal = () => {
    setEditingStaff(null);
    setFormState(getDefaultFormState(branches));
  };

  const closeResetModal = () => {
    setResetTarget(null);
    setResetPin('');
    setResetConfirmPin('');
  };

  const setFeatureMode = (featureKey: keyof StaffPermissions, mode: StaffAccessMode) => {
    setFormState((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [featureKey]: mode,
      },
    }));
  };

  const toggleBranch = (branchId: string) => {
    setFormState((current) => {
      const selected = current.selectedBranchIds.includes(branchId)
        ? current.selectedBranchIds.filter((id) => id !== branchId)
        : [...current.selectedBranchIds, branchId];

      const nextSelection = selected.length > 0 ? selected : getDefaultBranchSelection(branches);

      return {
        ...current,
        allBranches: false,
        selectedBranchIds: nextSelection,
      };
    });
  };

  const toggleAllBranches = () => {
    setFormState((current) => {
      const nextAllBranches = !current.allBranches;
      return {
        ...current,
        allBranches: nextAllBranches,
        selectedBranchIds: nextAllBranches
          ? []
          : current.selectedBranchIds.length > 0
            ? current.selectedBranchIds
            : getDefaultBranchSelection(branches),
      };
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard.');
    } catch {
      toast.error('Unable to copy to clipboard.');
    }
  };

  const getModeButtonStyle = (mode: StaffAccessMode, currentMode: StaffAccessMode): React.CSSProperties => {
    if (currentMode !== mode) return {};

    if (mode === 'visible') {
      return {
        backgroundColor: '#14679f',
        color: '#ffffff',
        boxShadow: '0 8px 18px rgba(20, 103, 159, 0.2)',
      };
    }

    if (mode === 'disabled') {
      return {
        backgroundColor: '#fff7ed',
        color: '#c2410c',
        boxShadow: '0 8px 18px rgba(234, 88, 12, 0.12)',
      };
    }

    return {
      backgroundColor: '#0f172a',
      color: '#ffffff',
      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.2)',
    };
  };

  const renderPermissionControls = (permissions: StaffPermissions) => (
    <div className="space-y-4">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">
              {group.title}
            </div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Hidden / Disabled / Visible
            </div>
          </div>
          <div className="space-y-3">
            {group.keys.map((featureKey) => {
              const definition = STAFF_FEATURES.find((feature) => feature.key === featureKey);
              if (!definition) return null;

              const currentMode = permissions[featureKey];
              return (
                <div key={featureKey} className="rounded-2xl border border-border bg-white px-4 py-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary">{definition.label}</div>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">{definition.description}</p>
                    </div>
                    <div className="grid min-w-full grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-2 sm:min-w-[20rem]">
                      {(['hidden', 'disabled', 'visible'] as StaffAccessMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setFeatureMode(featureKey, mode)}
                          className={cn(
                            'flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-center text-[0.68rem] font-black uppercase tracking-[0.14em] transition-all',
                            currentMode === mode
                              ? 'border-transparent'
                              : 'border-primary/15 bg-primary/8 text-primary/75 hover:border-primary/20 hover:text-primary'
                          )}
                          style={getModeButtonStyle(mode, currentMode)}
                          aria-pressed={currentMode === mode}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const handleSubmitCreate = async () => {
    if (!user?.id) return;

    const trimmedName = formState.name.trim();
    const trimmedPhone = formState.phone.trim();
    const selectedBranches = formState.allBranches ? [] : formState.selectedBranchIds.length > 0 ? formState.selectedBranchIds : getDefaultBranchSelection(branches);

    if (!trimmedName) {
      toast.error('Staff name is required.');
      return;
    }
    if (!/^\d{4}$/.test(formState.pin)) {
      toast.error('PIN must be exactly 4 digits.');
      return;
    }
    if (formState.pin !== formState.confirmPin) {
      toast.error('PIN confirmation does not match.');
      return;
    }

    try {
      setIsSaving(true);
      const created = await createMutation.mutateAsync({
        dealerId: user.id,
        name: trimmedName,
        phone: trimmedPhone || null,
        pin: formState.pin,
        branchIds: selectedBranches,
        permissions: formState.permissions,
        isActive: formState.isActive,
      });

      const primaryBranch = primaryBranchForSelection(selectedBranches);
      const link = primaryBranch ? buildStaffLink(window.location.origin, user.shop_name, primaryBranch.name) : '';
      setSharePayload({
        title: 'Staff created',
        staffName: created.name,
        pin: formState.pin,
        link,
      });

      setIsCreateOpen(false);
      setFormState(getDefaultFormState(branches));
      toast.success(`Staff "${created.name}" created successfully.`);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to create staff.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!user?.id || !editingStaff) return;

    const trimmedName = formState.name.trim();
    const trimmedPhone = formState.phone.trim();
    const selectedBranches = formState.allBranches ? [] : formState.selectedBranchIds.length > 0 ? formState.selectedBranchIds : getDefaultBranchSelection(branches);

    if (!trimmedName) {
      toast.error('Staff name is required.');
      return;
    }
    if (formState.pin && !/^\d{4}$/.test(formState.pin)) {
      toast.error('PIN must be exactly 4 digits.');
      return;
    }
    if (formState.pin && formState.pin !== formState.confirmPin) {
      toast.error('PIN confirmation does not match.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateMutation.mutateAsync({
        staffId: editingStaff.id,
        data: {
          name: trimmedName,
          phone: trimmedPhone || null,
          branchIds: selectedBranches,
          permissions: formState.permissions,
          isActive: formState.isActive,
          pin: formState.pin || undefined,
        },
      });

      if (formState.pin) {
        const primaryBranch = primaryBranchForSelection(selectedBranches);
        const link = primaryBranch ? buildStaffLink(window.location.origin, user.shop_name, primaryBranch.name) : '';
        setSharePayload({
          title: 'PIN updated',
          staffName: updated.name,
          pin: formState.pin,
          link,
        });
      }

      setEditingStaff(null);
      toast.success(`Staff "${updated.name}" updated successfully.`);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to update staff.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPin = async () => {
    if (!user?.id || !resetTarget) return;

    if (!/^\d{4}$/.test(resetPin)) {
      toast.error('PIN must be exactly 4 digits.');
      return;
    }
    if (resetPin !== resetConfirmPin) {
      toast.error('PIN confirmation does not match.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateMutation.mutateAsync({
        staffId: resetTarget.id,
        data: {
          name: resetTarget.name,
          phone: resetTarget.phone,
          branchIds: resetTarget.branch_ids,
          permissions: resetTarget.permissions,
          isActive: resetTarget.is_active,
          pin: resetPin,
        },
      });

      const primaryBranch = primaryBranchForSelection(resetTarget.branch_ids);
      const link = primaryBranch ? buildStaffLink(window.location.origin, user.shop_name, primaryBranch.name) : '';
      setSharePayload({
        title: 'PIN reset',
        staffName: updated.name,
        pin: resetPin,
        link,
      });

      closeResetModal();
      toast.success(`PIN reset for "${updated.name}".`);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to reset PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStaffCard = (staff: StaffMember) => {
    const visibleCount = Object.values(staff.permissions).filter((mode) => mode === 'visible').length;
    const disabledCount = Object.values(staff.permissions).filter((mode) => mode === 'disabled').length;
    const hiddenCount = Object.values(staff.permissions).filter((mode) => mode === 'hidden').length;
    const primaryBranch = staff.branch_ids.length > 0
      ? branches.find((branch) => staff.branch_ids.includes(branch.id)) || branches.find((branch) => branch.is_main) || branches[0] || null
      : branches.find((branch) => branch.is_main) || branches[0] || null;
    const shareLink = primaryBranch ? buildStaffLink(window.location.origin, user?.shop_name || '', primaryBranch.name) : '';

    return (
      <div
        key={staff.id}
        className={cn(
          'flex flex-col gap-4 rounded-[1.4rem] border px-4 py-4 transition-all sm:px-5',
          staff.is_active
            ? 'border-border bg-white hover:border-primary/20 hover:shadow-[0_10px_28px_rgba(20,103,159,0.08)]'
            : 'border-dashed border-border bg-surface/40'
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black">
                {getInitials(staff.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-extrabold tracking-[-0.02em] text-text-primary">{staff.name}</h3>
                  {staff.is_active ? (
                    <Badge variant="success" className="normal-case tracking-[0.02em]">Active</Badge>
                  ) : (
                    <Badge variant="warning" className="normal-case tracking-[0.02em]">Inactive</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-text-secondary">{staff.phone || 'No phone added'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-text-muted">
                  <span>{staff.branch_ids.length === 0 ? 'All branches' : `${staff.branch_ids.length} branch${staff.branch_ids.length === 1 ? '' : 'es'}`}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[22rem]">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Copy className="h-4 w-4" />}
              onClick={() => copyToClipboard(shareLink)}
              disabled={!shareLink}
              fullWidth
            >
              Copy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<KeyRound className="h-4 w-4" />}
              onClick={() => setResetTarget(staff)}
              fullWidth
            >
              PIN
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<PencilLine className="h-4 w-4" />}
              onClick={() => openEditModal(staff)}
              fullWidth
            >
              Edit
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface/35 p-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-muted">Visible</div>
            <div className="mt-1 text-lg font-black text-text-primary">{visibleCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface/35 p-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-muted">Disabled</div>
            <div className="mt-1 text-lg font-black text-text-primary">{disabledCount}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface/35 p-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-muted">Hidden</div>
            <div className="mt-1 text-lg font-black text-text-primary">{hiddenCount}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Branches</div>
          <div className="flex flex-wrap items-center gap-2">
          {(staff.branch_ids.length > 0 ? staff.branch_ids : branches.map((branch) => branch.id))
            .slice(0, 4)
            .map((branchId) => {
              const branch = branches.find((item) => item.id === branchId);
              if (!branch) return null;
              return (
                <Badge key={branch.id} variant="info" className="normal-case tracking-[0.02em]">
                  {branch.name}
                </Badge>
              );
            })}
          {staff.branch_ids.length > 4 ? (
            <Badge variant="neutral" className="normal-case tracking-[0.02em]">
              +{staff.branch_ids.length - 4} more
            </Badge>
          ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Access Control"
        title="Staff"
        description="Create staff profiles, assign branches, set PINs, and decide which parts of the app each staff member can see."
        action={
          <Button leftIcon={<Plus className="h-4.5 w-4.5" />} onClick={openCreateModal}>
            Add Staff
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Total staff</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">{staffMembers.length}</div>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Active staff</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">{activeStaffCount}</div>
            </div>
            <div className="rounded-2xl bg-success-light p-3 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Branch limited</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">{staffWithBranchRestrictions}</div>
            </div>
            <div className="rounded-2xl bg-info-light p-3 text-primary">
              <Globe className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Default quick actions</div>
              <div className="mt-2 text-base font-black tracking-[-0.04em] text-text-primary">
                Bill + Farmer
              </div>
            </div>
            <div className="rounded-2xl bg-surface p-3 text-text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Staff list"
          description="Each staff record gets one PIN and an optional branch scope. The same portal link can be shared with staff after creation."
          headerAction={
            <Button leftIcon={<Plus className="h-4.5 w-4.5" />} onClick={openCreateModal}>
              Add Staff
            </Button>
          }
          className="space-y-4"
        >
          {staffQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-[1.4rem] bg-surface" />
              ))}
            </div>
          ) : staffMembers.length > 0 ? (
            <div className="space-y-4">
              {pagedStaffMembers.visibleItems.map((staff) => renderStaffCard(staff))}
            </div>
          ) : null}

          {staffMembers.length > 0 ? (
            <ListLoadMore
              shown={pagedStaffMembers.visibleCount}
              total={pagedStaffMembers.totalCount}
              onLoadMore={pagedStaffMembers.loadMore}
              label="Load more staff"
            />
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-border bg-surface/35 px-5 py-10 text-center">
              <Users2 className="mx-auto h-10 w-10 text-primary/60" />
              <h3 className="mt-4 text-base font-extrabold text-text-primary">No staff yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
                Add your first staff profile to generate a PIN and a branch login link.
              </p>
              <Button className="mt-6" leftIcon={<Plus className="h-4.5 w-4.5" />} onClick={openCreateModal}>
                Add Staff
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Access model"
          description="This panel defines which features a staff member can use after unlocking the portal."
          className="space-y-4"
        >
          <div className="rounded-[1.35rem] bg-gradient-to-br from-primary to-primary-light p-5 text-white shadow-[0_14px_30px_rgba(20,103,159,0.14)]">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/75">Default preset</div>
            <div className="mt-2 text-2xl font-black tracking-[-0.04em]">Add Bill + Add Farmer</div>
            <p className="mt-2 text-sm leading-6 text-white/82">
              Every other feature starts hidden and can be turned on, disabled, or kept hidden per staff member.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="text-sm font-bold text-text-primary">Branch assignments</div>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Leave the branch list empty to let the staff member use all current and future branches.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {branches.map((branch) => (
                <Badge key={branch.id} variant={branch.is_main ? 'info' : 'neutral'} className="normal-case tracking-[0.02em]">
                  {branch.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/35 p-4 text-sm leading-6 text-text-secondary">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="font-bold text-text-primary">PIN rules</div>
                <p className="mt-1">
                  PINs are 4 digits, unique per dealer, and can be reset at any time from the staff card.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <Modal
        isOpen={isCreateOpen || !!editingStaff}
        onClose={() => {
          if (editingStaff) {
            closeEditModal();
          } else {
            setIsCreateOpen(false);
            setFormState(getDefaultFormState(branches));
          }
        }}
        title={editingStaff ? 'Edit Staff' : 'Add Staff'}
        footerButtons={[
          {
            label: 'Cancel',
            variant: 'outline',
            onClick: () => {
              if (editingStaff) {
                closeEditModal();
              } else {
                setIsCreateOpen(false);
                setFormState(getDefaultFormState(branches));
              }
            },
            type: 'button',
          },
          {
            label: editingStaff ? 'Save Changes' : 'Save Staff',
            variant: 'primary',
            onClick: editingStaff ? handleSubmitEdit : handleSubmitCreate,
            loading: isSaving,
            disabled: isSaving,
            type: 'button',
          },
        ]}
        className="max-w-4xl"
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Staff name"
              value={formState.name}
              onChange={(e) => setFormState((current) => ({ ...current, name: e.target.value }))}
              placeholder="e.g. Ravi"
              autoFocus
            />
            <Input
              label="Phone number"
              value={formState.phone}
              onChange={(e) => setFormState((current) => ({ ...current, phone: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={editingStaff ? 'New PIN (leave blank to keep existing)' : 'PIN'}
              value={formState.pin}
              onChange={(e) => setFormState((current) => ({ ...current, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="4-digit PIN"
              type="password"
            />
            <Input
              label="Confirm PIN"
              value={formState.confirmPin}
              onChange={(e) => setFormState((current) => ({ ...current, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="Confirm PIN"
              type="password"
            />
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-text-primary">Branch scope</div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Turn off “all branches” to choose one or more branch locations manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAllBranches}
                  className={cn('billing-toggle shrink-0', formState.allBranches ? 'billing-toggle--active' : '')}
                  aria-pressed={formState.allBranches}
                  aria-label="Toggle all branches"
                >
                  <span className="billing-toggle__thumb" />
                </button>
              </div>

            {!formState.allBranches ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {branches.map((branch) => {
                  const selected = formState.selectedBranchIds.includes(branch.id);
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => toggleBranch(branch.id)}
                        className={cn(
                          'min-h-12 rounded-2xl border px-3.5 py-3 text-left transition-all',
                          selected
                            ? 'border-primary bg-primary/10 text-primary shadow-[0_8px_20px_rgba(20,103,159,0.08)]'
                          : 'border-primary/15 bg-primary/8 text-primary/75 hover:border-primary/20 hover:text-primary'
                      )}
                      aria-pressed={selected}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold tracking-[-0.02em]">{branch.name}</div>
                          <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                            {branch.is_main ? 'Main branch' : branch.is_active ? 'Active branch' : 'Inactive branch'}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-black',
                            selected
                              ? 'border-primary bg-primary text-white'
                              : 'border-primary/15 bg-primary/8 text-transparent'
                          )}
                        >
                          ✓
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 text-sm font-semibold text-text-secondary">
                Staff can log in from any active branch path.
              </div>
            )}
          </div>

          <div className="space-y-4">
            {renderPermissionControls(formState.permissions)}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/35 px-4 py-4">
            <div>
              <div className="text-sm font-bold text-text-primary">Active status</div>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Inactive staff cannot unlock the portal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormState((current) => ({ ...current, isActive: !current.isActive }))}
              className={cn('billing-toggle shrink-0', formState.isActive ? 'billing-toggle--active' : '')}
              aria-pressed={formState.isActive}
              aria-label="Toggle staff active state"
            >
              <span className="billing-toggle__thumb" />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!resetTarget}
        onClose={closeResetModal}
        title="Reset Staff PIN"
        footerButtons={[
          {
            label: 'Cancel',
            variant: 'outline',
            onClick: closeResetModal,
            type: 'button',
          },
          {
            label: 'Reset PIN',
            variant: 'primary',
            onClick: handleResetPin,
            loading: isSaving,
            disabled: isSaving,
            type: 'button',
          },
        ]}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface/35 p-4 text-sm leading-6 text-text-secondary">
            Resetting the PIN will immediately invalidate the old one.
          </div>
          <Input
            label="New PIN"
            value={resetPin}
            onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4-digit PIN"
            type="password"
            autoFocus
          />
          <Input
            label="Confirm PIN"
            value={resetConfirmPin}
            onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Confirm PIN"
            type="password"
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        title={sharePayload?.title || 'Share Staff Access'}
        footerButtons={[
          {
            label: 'Close',
            variant: 'outline',
            onClick: () => setSharePayload(null),
            type: 'button',
          },
        ]}
      >
        {sharePayload ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="text-sm font-bold text-text-primary">{sharePayload.staffName}</div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">
                Share this PIN and link with the staff member. The PIN is only shown once.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">PIN</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-2xl font-black tracking-[0.18em] text-text-primary">{sharePayload.pin}</div>
                <Button size="sm" variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={() => copyToClipboard(sharePayload.pin)}>
                  Copy PIN
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Link</div>
              <div className="mt-2 break-all text-sm font-semibold text-text-primary">{sharePayload.link}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<LinkIcon className="h-4 w-4" />}
                  onClick={() => copyToClipboard(`${sharePayload.link}\nPIN: ${sharePayload.pin}`)}
                >
                  Copy Link + PIN
                </Button>
                <Button size="sm" variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={() => copyToClipboard(sharePayload.link)}>
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageShell>
  );
};

export default StaffPage;
