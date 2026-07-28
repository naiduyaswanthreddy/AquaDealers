import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Plus,
  ShieldCheck,
  Users2,
  CheckCircle2,
  PencilLine,
  KeyRound,
  Globe,
  Link as LinkIcon,
  Trash2,
  Clock,
  Activity,
  WifiOff,
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
import { buildStaffLink, createStaffMember, deleteStaffMember, listStaffMembers, updateStaffMember } from '../services/staffService';
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

  const neverLoggedIn = useMemo(
    () => staffMembers.filter((member) => !member.last_login_at).length,
    [staffMembers]
  );

  const activeThisWeek = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    return staffMembers.filter((m) => m.last_login_at && new Date(m.last_login_at).getTime() > sevenDaysAgo).length;
  }, [staffMembers]);

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

  const deleteMutation = useMutation({
    mutationFn: (staffId: string) => deleteStaffMember(staffId, user!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff-members', user?.id] });
    },
  });
  const [deleteTarget, setDeleteTarget] = React.useState<StaffMember | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');

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
      const link = primaryBranch ? buildStaffLink(window.location.origin, user.shop_name, primaryBranch.name, created.access_token) : '';
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
        const link = primaryBranch ? buildStaffLink(window.location.origin, user.shop_name, primaryBranch.name, updated.access_token) : '';
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
      const link = primaryBranch ? buildStaffLink(window.location.origin, user.shop_name, primaryBranch.name, updated.access_token) : '';
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

  const formatLastSeen = (lastLoginAt: string | null): { label: string; status: 'active' | 'idle' | 'dormant' | 'never' } => {
    if (!lastLoginAt) return { label: 'Never logged in', status: 'never' };
    const diffMs = Date.now() - new Date(lastLoginAt).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    let label: string;
    if (diffMins < 60) label = diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    else if (diffHours < 24) label = `${diffHours}h ago`;
    else if (diffDays === 1) label = 'Yesterday';
    else if (diffDays < 7) label = `${diffDays} days ago`;
    else if (diffDays < 30) label = `${Math.floor(diffDays / 7)}w ago`;
    else if (diffDays < 365) label = `${Math.floor(diffDays / 30)}mo ago`;
    else label = `${Math.floor(diffDays / 365)}y ago`;
    const status = diffDays < 7 ? 'active' : diffDays < 30 ? 'idle' : 'dormant';
    return { label, status };
  };

  const renderStaffCard = (staff: StaffMember) => {
    const visibleCount = Object.values(staff.permissions).filter((mode) => mode === 'visible').length;
    const disabledCount = Object.values(staff.permissions).filter((mode) => mode === 'disabled').length;
    const hiddenCount = Object.values(staff.permissions).filter((mode) => mode === 'hidden').length;
    const { label: lastSeenLabel, status: activityStatus } = formatLastSeen(staff.last_login_at);
    const primaryBranch = staff.branch_ids.length > 0
      ? branches.find((branch) => staff.branch_ids.includes(branch.id)) || branches.find((branch) => branch.is_main) || branches[0] || null
      : branches.find((branch) => branch.is_main) || branches[0] || null;
    const shareLink = primaryBranch ? buildStaffLink(window.location.origin, user?.shop_name || '', primaryBranch.name, staff.access_token) : '';

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

          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[26rem]">
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
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => { setDeleteTarget(staff); setDeleteConfirmText(''); }}
              fullWidth
            >
              Delete
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

        {/* Branches */}
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
            {staff.branch_ids.length > 4 && (
              <Badge variant="neutral" className="normal-case tracking-[0.02em]">
                +{staff.branch_ids.length - 4} more
              </Badge>
            )}
          </div>
        </div>

        {/* Activity row */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/35 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {activityStatus === 'active' && <Activity className="h-4 w-4 shrink-0 text-emerald-500" />}
            {activityStatus === 'idle' && <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
            {(activityStatus === 'dormant' || activityStatus === 'never') && <WifiOff className="h-4 w-4 shrink-0 text-slate-400" />}
            <div className="min-w-0">
              <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-text-muted">Last Active</div>
              <div className={`text-sm font-bold truncate ${
                activityStatus === 'active' ? 'text-emerald-600'
                : activityStatus === 'idle' ? 'text-amber-600'
                : 'text-text-secondary'
              }`}>
                {lastSeenLabel}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${
              activityStatus === 'active'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : activityStatus === 'idle'
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                : activityStatus === 'never'
                ? 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                activityStatus === 'active' ? 'bg-emerald-500 animate-pulse'
                : activityStatus === 'idle' ? 'bg-amber-400'
                : 'bg-slate-300'
              }`} />
              {activityStatus === 'active' ? 'Online recently'
                : activityStatus === 'idle' ? 'Occasional'
                : activityStatus === 'never' ? 'Never used'
                : 'Dormant'}
            </span>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
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

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Active staff</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">{activeStaffCount}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Branch limited</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-text-primary">{staffWithBranchRestrictions}</div>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Globe className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Active this week</div>
              <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-emerald-600">{activeThisWeek}</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-muted">Never logged in</div>
              <div className={`mt-2 text-3xl font-black tracking-[-0.05em] ${neverLoggedIn > 0 ? 'text-rose-500' : 'text-text-primary'}`}>{neverLoggedIn}</div>
            </div>
            <div className={`rounded-2xl p-3 ${neverLoggedIn > 0 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
              <WifiOff className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

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

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleteMutation.isPending) { setDeleteTarget(null); setDeleteConfirmText(''); } }}
        title="Delete staff member"
        footerButtons={[
          {
            label: 'Cancel',
            variant: 'outline',
            onClick: () => { setDeleteTarget(null); setDeleteConfirmText(''); },
            disabled: deleteMutation.isPending,
            type: 'button',
          },
          {
            label: deleteMutation.isPending ? 'Deleting…' : 'Delete permanently',
            variant: 'danger',
            onClick: async () => {
              if (!deleteTarget || deleteConfirmText.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) return;
              try {
                await deleteMutation.mutateAsync(deleteTarget.id);
                toast.success(`Removed ${deleteTarget.name}.`);
                setDeleteTarget(null);
                setDeleteConfirmText('');
              } catch (e: any) {
                toast.error(e?.message || 'Failed to delete staff.');
              }
            },
            disabled: deleteMutation.isPending || !deleteTarget || deleteConfirmText.trim().toLowerCase() !== (deleteTarget?.name || '').trim().toLowerCase(),
            loading: deleteMutation.isPending,
            type: 'button',
          },
        ]}
      >
        {deleteTarget && (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-900">
              <div className="font-black">Delete <span className="underline">{deleteTarget.name}</span>?</div>
              <ul className="mt-2 ml-4 list-disc text-[13px] leading-6 text-rose-800">
                <li>The staff member will lose access immediately — any live sessions are revoked.</li>
                <li>Their invite link becomes invalid.</li>
                <li>Historical bills / payments they created are kept unchanged.</li>
                <li>This cannot be undone — you'd have to re-create the staff to restore access.</li>
              </ul>
            </div>
            <Input
              label={`Type "${deleteTarget.name}" to confirm`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteTarget.name}
              autoFocus
            />
          </div>
        )}
      </Modal>
    </PageShell>
  );
};

export default StaffPage;
