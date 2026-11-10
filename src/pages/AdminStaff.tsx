import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SelectField, TextareaField } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useI18n } from '../i18n'
import { controlCopy } from '../i18n/control'
import { useAuth } from '../lib/auth'
import {
  ApiError,
  fetchAdminStaff,
  fetchMyPermissions,
  type AccountState,
  type StaffMember,
  type StaffRole,
  updateStaffRole,
} from '../lib/api'
import { cn, formatDateTime } from '../lib/utils'

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

function stateTone(state: AccountState) {
  if (state === 'ACTIVE') return 'success' as const
  if (state === 'WARNING' || state === 'RESTRICTED') return 'warning' as const
  if (state === 'UNDER_REVIEW' || state === 'PENDING_VERIFICATION') return 'orange' as const
  return 'error' as const
}

export function AdminStaff() {
  const { lang } = useI18n()
  const d = controlCopy[lang]
  const { user: currentUser } = useAuth()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [permissionError, setPermissionError] = useState('')

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
      if (cause instanceof ApiError && cause.status === 403) {
        setError('Your staff role does not include staff directory access.')
      } else {
        setError(cause instanceof Error ? cause.message : d.staff.error)
      }
    } finally {
      setLoading(false)
    }
  }, [d.staff.error])

  useEffect(() => {
    void load()
  }, [load])

  const startEditing = (member: StaffMember) => {
    setEditing(member)
    setNewRole(member.staff_role)
    setReason('')
    setSaveError('')
    setSuccess('')
    setPermissionError('')
  }

  const save = async () => {
    if (!editing) return
    setSaveError('')
    setSuccess('')
    if (!canManage) {
      setPermissionError('Only a super admin can change staff roles.')
      return
    }
    if (reason.trim().length < 5) {
      setSaveError('Enter a reason of at least 5 characters.')
      return
    }
    setSaving(true)
    try {
      await updateStaffRole(editing.id, newRole, reason.trim())
      setSuccess(d.staff.success)
      setEditing(null)
      setReason('')
      await load()
    } catch (cause) {
      setSaveError(cause instanceof ApiError ? cause.message : d.staff.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Eyebrow>{d.staff.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-[2.2rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[2.8rem]">
            {d.staff.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-muted">{d.staff.lead}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {d.common.refresh}
        </Button>
      </header>

      {error ? (
        <Alert tone="error" className="mt-5" title={d.common.error}>{error}</Alert>
      ) : null}
      {success ? (
        <Alert tone="success" className="mt-5">{success}</Alert>
      ) : null}
      {!canManage && !error ? (
        <Alert tone="warning" className="mt-5" title="Read-only">
          Your role can view the staff directory but cannot change roles.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-brand-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-brand-line bg-brand-cream/60 px-4 py-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
              {staff.length} staff accounts
            </p>
            <ShieldCheck className="h-4 w-4 text-brand-dark" aria-hidden="true" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent" aria-label={d.common.loading} />
            </div>
          ) : staff.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-brand-muted">{d.staff.empty}</p>
          ) : (
            <ul className="divide-y divide-brand-line">
              {staff.map((member) => (
                <li key={member.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-brand-charcoal">{member.name}</p>
                        {member.id === currentUser?.id ? <Badge tone="dark">You</Badge> : null}
                        {member.is_superuser ? <Badge tone="orange">Django superuser</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-[0.68rem] text-brand-muted">
                        {member.phone || member.email || '—'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="cream">{d.staffRoles[member.staff_role]}</Badge>
                        <Badge tone={stateTone(member.account_state)}>{d.states[member.account_state]}</Badge>
                        <span className="text-[0.65rem] text-brand-muted">
                          {d.staff.actionCount}: {member.action_count}
                        </span>
                      </div>
                      <p className="mt-2 text-[0.65rem] text-brand-muted">
                        {d.staff.lastLogin}: {formatDateTime(member.last_login)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={editing?.id === member.id ? 'dark' : 'secondary'}
                      size="sm"
                      onClick={() => startEditing(member)}
                      disabled={!canManage || member.is_superuser}
                    >
                      <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                      {d.staff.changeRole}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card h-fit p-5 xl:sticky xl:top-6">
          <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">
            {d.staff.changeRole}
          </h2>
          <p className="mt-1 text-xs leading-5 text-brand-muted">{d.staff.warning}</p>

          {!editing ? (
            <div className="mt-4 rounded-2xl border border-dashed border-brand-line bg-brand-cream/50 p-4 text-xs leading-5 text-brand-muted">
              Select a staff member to assign a role.
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-2xl border border-brand-line bg-brand-cream/40 p-3">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-muted">
                  {d.staff.user}
                </p>
                <p className="mt-1 text-sm font-bold text-brand-charcoal">{editing.name}</p>
                <p className="mt-0.5 text-[0.68rem] text-brand-muted">
                  {editing.phone || editing.email || '—'}
                </p>
              </div>

              <div className="mt-4">
                <SelectField
                  label={d.staff.staffRole}
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as StaffRole)}
                  options={ROLE_OPTIONS.map((role) => ({
                    value: role,
                    label: d.staffRoles[role],
                  }))}
                />
              </div>

              <div className="mt-4">
                <TextareaField
                  label={d.staff.reason}
                  hint={d.staff.reasonHint}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-24"
                />
              </div>

              {newRole === 'SUPER_ADMIN' && editing.staff_role !== 'SUPER_ADMIN' ? (
                <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-brand-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {d.staff.warning}
                </p>
              ) : null}

              {permissionError ? (
                <p className="mt-3 text-xs font-medium text-brand-error" role="alert">{permissionError}</p>
              ) : null}
              {saveError ? (
                <p className="mt-3 text-xs font-medium text-brand-error" role="alert">{saveError}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => void save()} loading={saving} disabled={saving || !canManage}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {d.staff.update}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  {d.common.cancel}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="surface-card mt-5 p-5">
        <h2 className="font-display text-lg font-extrabold tracking-[-0.03em] text-brand-charcoal">
          Permission boundaries
        </h2>
        <p className="mt-1 text-xs leading-5 text-brand-muted">
          These boundaries are enforced by the backend on every request.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-brand-line text-[0.6rem] uppercase tracking-[0.12em] text-brand-muted">
                <th className="py-2 pr-4 font-bold">Role</th>
                <th className="px-4 py-2 font-bold">Can do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {[
                ['SUPER_ADMIN', 'Full platform administration, staff roles and permanent termination'],
                ['OPERATIONS_MANAGER', 'Users, orders, deliveries, applications and temporary enforcement'],
                ['VERIFICATION_OFFICER', 'Vendor and rider applications, documents and verification requests'],
                ['FINANCE_OFFICER', 'Payments, reconciliation, financial reports and read-only user records'],
                ['CUSTOMER_SUPPORT', 'Complaints, disputes, warnings, appeals and account restoration'],
                ['TRUST_SAFETY_OFFICER', 'Investigations, restrictions, suspensions, appeals and audit review'],
                ['CONTENT_MANAGER', 'Website content, banners and promotional images'],
              ].map(([role, capability]) => (
                <tr key={role} className={cn(role === newRole && editing ? 'bg-brand-cream/50' : undefined)}>
                  <td className="py-2.5 pr-4 font-bold text-brand-charcoal">{d.staffRoles[role as StaffRole]}</td>
                  <td className="px-4 py-2.5 leading-5 text-brand-muted">{capability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
