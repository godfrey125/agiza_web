import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  SectionCard,
  Select,
  Textarea,
} from '../../components/ui'
import { cn, formatDateTime, number } from '../../lib/format'
import {
  fetchAdminStaff,
  fetchMyPermissions,
  MarketplaceApiError,
  updateStaffRole,
  type AccountState,
  type StaffMember,
  type StaffRole,
} from '../../lib/marketplace'

const ROLE_OPTIONS: StaffRole[] = [
  'SUPER_ADMIN',
  'OPERATIONS_MANAGER',
  'VERIFICATION_OFFICER',
  'FINANCE_OFFICER',
  'CUSTOMER_SUPPORT',
  'TRUST_SAFETY_OFFICER',
  'CONTENT_MANAGER',
  'NONE',
]

const ROLE_LABELS: Record<StaffRole, string> = {
  NONE: 'No staff role',
  SUPER_ADMIN: 'Super admin',
  OPERATIONS_MANAGER: 'Operations manager',
  VERIFICATION_OFFICER: 'Verification officer',
  FINANCE_OFFICER: 'Finance officer',
  CUSTOMER_SUPPORT: 'Customer support',
  TRUST_SAFETY_OFFICER: 'Trust & safety officer',
  CONTENT_MANAGER: 'Content manager',
}

const STATE_LABELS: Record<AccountState, string> = {
  ACTIVE: 'Active',
  WARNING: 'Warning',
  UNDER_REVIEW: 'Under review',
  TEMPORARILY_SUSPENDED: 'Suspended',
  RESTRICTED: 'Restricted',
  TERMINATED: 'Terminated',
  PENDING_VERIFICATION: 'Pending verification',
  REJECTED: 'Rejected',
}

function stateTone(state: AccountState) {
  if (state === 'ACTIVE') return 'badge-green'
  if (state === 'WARNING' || state === 'RESTRICTED') return 'badge-yellow'
  if (state === 'UNDER_REVIEW' || state === 'PENDING_VERIFICATION') return 'badge-orange'
  return 'badge-red'
}

const BOUNDARIES: Array<[StaffRole, string]> = [
  ['SUPER_ADMIN', 'Full platform administration, staff roles and permanent termination'],
  ['OPERATIONS_MANAGER', 'Users, orders, deliveries, applications and temporary enforcement'],
  ['VERIFICATION_OFFICER', 'Vendor and rider applications, documents and verification requests'],
  ['FINANCE_OFFICER', 'Payments, reconciliation, financial reports and read-only user records'],
  ['CUSTOMER_SUPPORT', 'Complaints, disputes, warnings, appeals and account restoration'],
  ['TRUST_SAFETY_OFFICER', 'Investigations, restrictions, suspensions, appeals and audit review'],
  ['CONTENT_MANAGER', 'Website content, banners and promotional images'],
]

export default function MarketplaceStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [newRole, setNewRole] = useState<StaffRole>('NONE')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState('')

  const canManage = permissions.includes('*') || permissions.includes('users.manage_roles')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [staffResponse, permissionResponse] = await Promise.all([
        fetchAdminStaff(),
        fetchMyPermissions(),
      ])
      setStaff(staffResponse.results)
      setPermissions(permissionResponse.permissions)
    } catch (cause) {
      if (cause instanceof MarketplaceApiError && cause.status === 403) {
        setError('Your staff role does not include staff directory access.')
      } else {
        setError(cause instanceof Error ? cause.message : 'The staff directory could not be loaded.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEditing = (member: StaffMember) => {
    setEditing(member)
    setNewRole(member.staff_role)
    setReason('')
    setSaveError('')
    setSuccess('')
  }

  const save = async () => {
    if (!editing) return
    setSaveError('')
    setSuccess('')
    if (!canManage) {
      setSaveError('Only a super admin can change staff roles.')
      return
    }
    if (reason.trim().length < 5) {
      setSaveError('Enter a reason of at least 5 characters.')
      return
    }
    setSaving(true)
    try {
      await updateStaffRole(editing.id, newRole, reason.trim())
      setSuccess('Staff role updated and written to the audit log.')
      setEditing(null)
      setReason('')
      await load()
    } catch (cause) {
      setSaveError(cause instanceof MarketplaceApiError ? cause.message : 'The role could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && staff.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Marketplace"
          title="Staff & roles"
          description="Grant only the access each officer needs. Permissions are enforced by the backend on every request."
        />
        <LoadingBlock rows={8} />
      </div>
    )
  }

  if (error && staff.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Marketplace" title="Staff & roles" />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Staff & roles"
        description="Promote staff into a defined role. Permissions are enforced by the backend on every request, not hidden in the browser."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <p className="rounded-xl border border-[#f4d7d2] bg-soft-red px-4 py-3 text-xs text-coral">{error}</p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-1.5 rounded-xl border border-[#cfe9d8] bg-soft-green px-4 py-3 text-xs font-medium text-success">
          <CheckCircle2 size={14} />
          {success}
        </p>
      ) : null}
      {!canManage && !error ? (
        <p className="rounded-xl border border-[#f3e2b5] bg-soft-yellow px-4 py-3 text-xs text-[#9A7214]">
          Read-only: your role can view the staff directory but cannot change roles.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)]">
        <SectionCard
          title={`${staff.length} staff accounts`}
          description="Accounts with an administrative role in the Django backend."
          bodyClassName="p-0"
        >
          {staff.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<UserCog size={22} />}
                title="No staff accounts"
                message="Promote an account to a staff role to see it here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {staff.map((member) => (
                <li key={member.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{member.name}</p>
                        {member.is_superuser ? <Badge className="badge-orange">Django superuser</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {member.phone || member.email || '—'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge className="badge-gray">{ROLE_LABELS[member.staff_role]}</Badge>
                        <Badge className={stateTone(member.account_state)}>
                          {STATE_LABELS[member.account_state] || member.account_state}
                        </Badge>
                        <span className="text-[10px] text-muted">
                          {number(member.action_count)} actions
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-muted">
                        Last sign-in: {formatDateTime(member.last_login)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEditing(member)}
                      disabled={!canManage || member.is_superuser}
                    >
                      <UserCog size={13} />
                      Change role
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Change role" description="Every role change is audited.">
            {!editing ? (
              <p className="rounded-xl border border-dashed border-line bg-[#fdfbf7] p-4 text-xs leading-5 text-muted">
                Select a staff member to assign a role.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Staff member</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{editing.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{editing.phone || editing.email || '—'}</p>
                </div>

                <Field label="Staff role">
                  <Select value={newRole} onChange={(event) => setNewRole(event.target.value as StaffRole)}>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Reason" hint="At least 5 characters.">
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="min-h-20"
                  />
                </Field>

                {newRole === 'SUPER_ADMIN' && editing.staff_role !== 'SUPER_ADMIN' ? (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-[#9A7214]">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    Super admin grants full platform access. Confirm this is intended.
                  </p>
                ) : null}

                {saveError ? (
                  <p className="text-xs font-medium text-coral" role="alert">
                    {saveError}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void save()} loading={saving} disabled={saving || !canManage}>
                    <CheckCircle2 size={15} />
                    Update role
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Permission boundaries" description="Enforced by the backend on every request.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-muted">
                    <th className="py-2 pr-4 font-bold">Role</th>
                    <th className="px-4 py-2 font-bold">Can do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {BOUNDARIES.map(([role, capability]) => (
                    <tr
                      key={role}
                      className={cn(role === newRole && editing ? 'bg-[#fffaf3]' : undefined)}
                    >
                      <td className="py-2.5 pr-4 font-semibold text-ink">{ROLE_LABELS[role]}</td>
                      <td className="px-4 py-2.5 leading-5 text-muted">{capability}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted">
        <ShieldCheck size={12} />
        Role changes are recorded with your identity and the reason you provide.
      </div>
    </div>
  )
}
