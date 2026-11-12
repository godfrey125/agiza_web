import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bell, CheckCircle2, Copy, CreditCard, KeyRound, LockKeyhole, Mail, Pencil, Plus, RefreshCw,
  ScrollText, ShieldCheck, Store, Trash2, UserRound, Users, Wallet, XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { AuditLog, Role, StaffMember, User } from '../lib/types'
import { formatDate, formatDateTime, number, timeAgo } from '../lib/format'
import {
  Avatar, Badge, Button, EmptyState, ErrorState, Field, ImageUploader, Input, LoadingBlock,
  Modal, PageHeader, SearchInput, SectionCard, Select, StatusBadge, Tabs, Textarea, Toggle,
  useConfirm, useToast,
} from '../components/ui'

type SettingsBag = Record<string, any>

interface SettingsResponse {
  settings: SettingsBag
  permissions: string[]
}

const tabDefinitions = [
  { id: 'general', label: 'General', permission: 'settings.general' },
  { id: 'profile', label: 'Profile', permission: 'settings.profile' },
  { id: 'staff', label: 'Staff', permission: 'settings.staff' },
  { id: 'roles', label: 'Roles & permissions', permission: 'settings.roles' },
  { id: 'notifications', label: 'Notifications', permission: 'settings.notifications' },
  { id: 'payments', label: 'Payments', permission: 'settings.payments' },
  { id: 'security', label: 'Security', permission: 'settings.security' },
  { id: 'audit', label: 'Audit log', permission: 'audit.view' },
]

const permissionLabels: Record<string, string> = {
  'dashboard.view': 'View dashboard',
  'menu.view': 'View menu', 'menu.manage': 'Manage menu',
  'categories.view': 'View categories', 'categories.manage': 'Manage categories',
  'orders.view': 'View orders', 'orders.manage': 'Manage orders',
  'customers.view': 'View customers', 'customers.manage': 'Manage customers',
  'inventory.view': 'View inventory', 'inventory.manage': 'Manage inventory',
  'analytics.view': 'View analytics',
  'reports.view': 'View reports', 'reports.generate': 'Generate reports',
  'marketing.view': 'View marketing', 'marketing.manage': 'Manage marketing',
  'reviews.view': 'View reviews', 'reviews.manage': 'Manage reviews',
  'settings.view': 'View settings', 'settings.general': 'Edit general settings',
  'settings.profile': 'Edit own profile', 'settings.staff': 'Manage staff',
  'settings.roles': 'Manage roles & permissions', 'settings.notifications': 'Edit notifications',
  'settings.payments': 'Edit payments', 'settings.security': 'Manage security',
  'audit.view': 'View audit log',
}

function groupPermissions(permissions: string[]) {
  const groups = new Map<string, string[]>()
  permissions.forEach((permission) => {
    const group = permission.split('.')[0]
    groups.set(group, [...(groups.get(group) || []), permission])
  })
  return [...groups.entries()].map(([group, items]) => ({
    group: group[0].toUpperCase() + group.slice(1),
    items,
  }))
}

function FormNotice({ error }: { error: string }) {
  if (!error) return null
  return <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{error}</div>
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

function GeneralTab({ settings }: { settings: SettingsBag }) {
  const [form, setForm] = useState({
    restaurantName: settings['general.restaurantName'] || '',
    tagline: settings['general.tagline'] || '',
    description: settings['general.description'] || '',
    contact: settings['general.contact'] || '',
    email: settings['general.email'] || '',
    address: settings['general.address'] || '',
    businessHours: settings['general.businessHours'] || '',
    currency: settings['general.currency'] || 'TZS (TSh)',
    timezone: settings['general.timezone'] || 'Africa/Dar_es_Salaam',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.restaurantName.trim()) return setError('Restaurant name cannot be empty.')
    setSaving(true)
    try {
      await api.put('/api/settings/general', form)
      toast('General settings saved.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save general settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <SectionCard title="Restaurant identity" description="Shown across receipts, reports and the workspace.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurant name" required><Input value={form.restaurantName} onChange={(event) => setForm({ ...form, restaurantName: event.target.value })} /></Field>
          <Field label="Tagline"><Input value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} placeholder="Modern coastal kitchen" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell guests and staff what makes the restaurant special." /></Field>
        </div>
      </SectionCard>
      <SectionCard title="Contact & location" description="Used on invoices and printable receipts.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><Input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="+255 …" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="hello@restaurant.com" /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          <Field label="Business hours"><Input value={form.businessHours} onChange={(event) => setForm({ ...form, businessHours: event.target.value })} placeholder="Mon–Sun · 11:00 AM – 11:00 PM" /></Field>
          <Field label="Currency"><Select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>TZS (TSh)</option><option>USD ($)</option><option>KES (KSh)</option><option>AED (د.إ)</option><option>GBP (£)</option></Select></Field>
          <Field label="Time zone"><Select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option>Africa/Dar_es_Salaam</option><option>Africa/Nairobi</option><option>Asia/Dubai</option><option>Europe/London</option><option>America/New_York</option></Select></Field>
        </div>
      </SectionCard>
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-muted">Changes are stored in the restaurant settings table and applied to new receipts and exports.</p>
        <Button type="submit" loading={saving} icon={<Store size={15} />}>Save general settings</Button>
      </div>
      <FormNotice error={error} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { user, setUser, refresh } = useAuth()
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', phone: user?.phone || '', avatarUrl: user?.avatarUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Name cannot be empty.')
    setSaving(true)
    try {
      const result = await api.put<{ message: string; user: User }>('/api/profile', form)
      setUser(result.user)
      toast('Profile updated.', 'success')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
      <form onSubmit={save} className="space-y-5">
        <SectionCard title="Your profile" description="This is how you appear across the workspace and in audit records.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Email" required><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <div className="sm:col-span-2"><ImageUploader value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} label="Profile photo" /></div>
          </div>
          <FormNotice error={error} />
          <div className="mt-4 flex justify-end border-t border-line pt-4"><Button type="submit" loading={saving} icon={<UserRound size={15} />}>Save profile</Button></div>
        </SectionCard>
      </form>
      <div className="space-y-4">
        <div className="card p-5 text-center">
          <Avatar src={user.avatarUrl} name={user.name} size={78} className="mx-auto" />
          <p className="mt-3 font-display text-lg font-extrabold text-ink">{user.name}</p>
          <p className="text-xs text-muted">{user.email}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2"><StatusBadge status={user.status} /><Badge className="badge-orange">{user.role.name}</Badge></div>
          <p className="mt-4 border-t border-line pt-3 text-[10px] text-muted">Member since {formatDate(user.createdAt)}</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-ink"><ShieldCheck size={15} className="text-primary" /> Account protection</p>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">Two-factor authentication is {user.twoFactorEnabled ? 'enabled' : 'not enabled'} for this account.</p>
          <a href="/settings?tab=security" className="btn-secondary btn-sm mt-3 w-full justify-center">Open security settings</a>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const emptyStaff = { name: '', email: '', phone: '', password: '', roleId: '', status: 'ACTIVE', avatarUrl: '' }

function StaffTab() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [form, setForm] = useState({ ...emptyStaff })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const staffData = await api.get<{ staff: StaffMember[] }>('/api/staff')
      setStaff(staffData.staff)
      try {
        const roleData = await api.get<{ roles: Role[] }>('/api/roles')
        setRoles(roleData.roles)
      } catch {
        const unique = new Map<string, Role>()
        staffData.staff.forEach((member) => unique.set(member.role.id, member.role))
        setRoles([...unique.values()])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyStaff, roleId: roles.find((role) => role.id !== 'super_admin')?.id || roles[0]?.id || '' })
    setFormError('')
    setModalOpen(true)
  }
  const openEdit = (member: StaffMember) => {
    setEditing(member)
    setForm({ name: member.name, email: member.email, phone: member.phone, password: '', roleId: member.role.id, status: member.status, avatarUrl: member.avatarUrl })
    setFormError('')
    setModalOpen(true)
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!form.name.trim() || !form.email.trim()) return setFormError('Name and email are required.')
    if (!editing && form.password.length < 8) return setFormError('The initial password must be at least 8 characters.')
    if (!form.roleId) return setFormError('Choose a role.')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (editing) delete payload.password
      if (editing) await api.put(`/api/staff/${editing.id}`, payload)
      else await api.post('/api/staff', payload)
      toast(editing ? 'Staff account updated.' : 'Staff account created.', 'success')
      setModalOpen(false)
      load(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this staff account.')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (member: StaffMember) => {
    const ok = await confirm({ title: 'Remove staff account?', message: `${member.name} will no longer be able to sign in. Their historical orders and audit records stay.`, confirmLabel: 'Remove account', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/staff/${member.id}`)
      toast('Staff account removed.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove this account.', 'error')
    }
  }

  return (
    <SectionCard title="Staff accounts" description="People who can access this workspace. Roles decide what each person sees." action={<Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>Add staff</Button>} bodyClassName="p-0">
      {loading ? <div className="p-5"><LoadingBlock rows={6} /></div> : error ? <div className="p-5"><ErrorState message={error} onRetry={() => load()} /></div> : !staff.length ? <div className="p-5"><EmptyState icon={<Users size={24} />} title="No staff accounts" message="Add a staff member to give someone access to the workspace." action={<Button icon={<Plus size={15} />} onClick={openCreate}>Add staff</Button>} /></div> : (
        <div className="table-wrap rounded-none border-0">
          <table className="data-table min-w-[820px]">
            <thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>2FA</th><th>Last sign-in</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td><div className="flex items-center gap-3"><Avatar src={member.avatarUrl} name={member.name} size={36} /><div className="min-w-0"><p className="table-primary">{member.name}{member.id === user?.id && <span className="ml-2 text-[10px] font-semibold text-primary">You</span>}</p><p className="table-secondary">{member.email}{member.phone ? ` · ${member.phone}` : ''}</p></div></div></td>
                  <td><Badge className="badge-orange">{member.role.name}</Badge></td>
                  <td><StatusBadge status={member.status} /></td>
                  <td>{member.twoFactorEnabled ? <Badge className="badge-green">Enabled</Badge> : <Badge className="badge-gray">Off</Badge>}</td>
                  <td className="text-xs text-muted">{member.lastLogin ? timeAgo(member.lastLogin) : 'Never'}</td>
                  <td className="text-xs text-muted">{formatDate(member.createdAt)}</td>
                  <td><div className="flex justify-end gap-1.5"><button type="button" onClick={() => openEdit(member)} className="icon-btn h-8 w-8" aria-label="Edit staff"><Pencil size={14} /></button>{member.id !== user?.id && <button type="button" onClick={() => remove(member)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Remove staff"><Trash2 size={14} /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit staff account' : 'Add staff account'} description="Role permissions are enforced by the server on every request." width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving} icon={<Users size={15} />}>{editing ? 'Save changes' : 'Create account'}</Button></>}>
        <form onSubmit={save} className="space-y-4">
          <FormNotice error={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Email" required><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Role" required><Select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}><option value="">Choose role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></Field>
            {!editing && <Field label="Initial password" required hint="At least 8 characters."><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></Field>}
            <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select></Field>
            <div className="sm:col-span-2"><ImageUploader value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} label="Profile photo" /></div>
          </div>
        </form>
      </Modal>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const emptyRole = { name: '', description: '', permissions: [] as string[] }

function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [form, setForm] = useState({ ...emptyRole })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get<{ roles: Role[]; permissions: string[] }>('/api/roles')
      setRoles(data.roles)
      setPermissions(data.permissions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load roles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  const groups = useMemo(() => groupPermissions(permissions), [permissions])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyRole })
    setFormError('')
    setModalOpen(true)
  }
  const openEdit = (role: Role) => {
    setEditing(role)
    setForm({ name: role.name, description: role.description || '', permissions: [...role.permissions] })
    setFormError('')
    setModalOpen(true)
  }
  const togglePermission = (permission: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }))
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Role name is required.')
    setSaving(true)
    try {
      if (editing) await api.put(`/api/roles/${editing.id}`, form)
      else await api.post('/api/roles', form)
      toast(editing ? 'Role updated.' : 'Role created.', 'success')
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this role.')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (role: Role) => {
    const ok = await confirm({ title: 'Delete role?', message: `The “${role.name}” role will be deleted. Roles with staff members cannot be removed.`, confirmLabel: 'Delete role', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/roles/${role.id}`)
      toast('Role deleted.', 'success')
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete this role.', 'error')
    }
  }

  if (loading) return <div className="card p-5"><LoadingBlock rows={6} /></div>
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="section-title">Roles & permissions</h2><p className="mt-0.5 text-xs text-muted">Every permission is checked by the API, not just hidden in the interface.</p></div>
        <Button icon={<Plus size={15} />} onClick={openCreate}>Create role</Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${role.locked ? 'bg-soft-yellow text-[#9A7214]' : 'bg-peach text-primary'}`}><ShieldCheck size={18} /></span>
                <div><p className="font-display text-base font-bold text-ink">{role.name}</p><p className="mt-0.5 text-xs text-muted">{role.description || 'No description'}</p></div>
              </div>
              <div className="flex items-center gap-1.5">
                {!role.locked && <button type="button" onClick={() => openEdit(role)} className="icon-btn h-8 w-8" aria-label="Edit role"><Pencil size={14} /></button>}
                {!role.locked && <button type="button" onClick={() => remove(role)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete role"><Trash2 size={14} /></button>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {role.permissions.includes('*') ? <Badge className="badge-green">Full access</Badge> : role.permissions.slice(0, 7).map((permission) => (
                <span key={permission} className="rounded-md bg-[#f7f3ed] px-1.5 py-1 text-[9px] font-medium text-[#6c665f]">{permissionLabels[permission] || permission}</span>
              ))}
              {!role.permissions.includes('*') && role.permissions.length > 7 && <span className="rounded-md bg-[#f7f3ed] px-1.5 py-1 text-[9px] font-semibold text-muted">+{role.permissions.length - 7} more</span>}
              {!role.permissions.length && <span className="text-[10px] text-muted">No permissions assigned</span>}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px]">
              <span className="text-muted"><Users size={11} className="mr-1 inline" />{number(role.userCount || 0)} staff member{(role.userCount || 0) === 1 ? '' : 's'}</span>
              <span className="font-semibold text-ink">{role.permissions.includes('*') ? 'All permissions' : `${role.permissions.length} permissions`}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit role' : 'Create role'} description="Choose exactly what this role can view and manage." width="max-w-3xl"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={save} loading={saving} icon={<ShieldCheck size={15} />}>{editing ? 'Save role' : 'Create role'}</Button></>}>
        <form onSubmit={save} className="space-y-4">
          <FormNotice error={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" required><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Shift supervisor" /></Field>
            <Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this role is responsible for" /></Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-xs font-bold text-ink">Permissions <span className="font-normal text-muted">({form.permissions.length} selected)</span></p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, permissions: [...permissions] })} className="text-[11px] font-semibold text-primary hover:underline">Select all</button>
              <span className="text-[#ddd5ca]">·</span>
              <button type="button" onClick={() => setForm({ ...form, permissions: [] })} className="text-[11px] font-semibold text-muted hover:text-ink">Clear all</button>
            </div>
          </div>
          <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.group} className="rounded-xl border border-line p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{group.group}</p>
                <div className="space-y-1.5">
                  {group.items.map((permission) => (
                    <label key={permission} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 text-xs text-[#5f5a53] hover:bg-[#fcfaf6]">
                      <input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} className="h-3.5 w-3.5 accent-[#F05A32]" />
                      {permissionLabels[permission] || permission}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notifications and payments
// ---------------------------------------------------------------------------

function NotificationsTab({ settings }: { settings: SettingsBag }) {
  const [form, setForm] = useState({
    newOrder: Boolean(settings['notifications.newOrder']),
    lowStock: Boolean(settings['notifications.lowStock']),
    payment: Boolean(settings['notifications.payment']),
    review: Boolean(settings['notifications.review']),
    dailySummary: Boolean(settings['notifications.dailySummary']),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put('/api/settings/notifications', form)
      toast('Notification preferences saved.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notification settings.')
    } finally {
      setSaving(false)
    }
  }
  const items = [
    { key: 'newOrder' as const, label: 'New order alerts', description: 'Show an in-app notification whenever a new order is created.' },
    { key: 'lowStock' as const, label: 'Low stock alerts', description: 'Notify the team when an inventory item reaches its minimum level.' },
    { key: 'payment' as const, label: 'Payment updates', description: 'Record an in-app update when an order payment status changes.' },
    { key: 'review' as const, label: 'New reviews', description: 'Surface new guest reviews in the notification centre.' },
    { key: 'dailySummary' as const, label: 'Daily summary', description: 'Keep a daily performance summary notification in the workspace.' },
  ]
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
      <SectionCard title="Notification preferences" description="These are in-app controls. Email and SMS delivery require a provider configured on the server.">
        <div className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.key} className="py-4 first:pt-0 last:pb-0">
              <Toggle checked={form[item.key]} onChange={(value) => setForm({ ...form, [item.key]: value })} label={item.label} description={item.description} />
            </div>
          ))}
        </div>
        <FormNotice error={error} />
        <div className="mt-4 flex justify-end border-t border-line pt-4"><Button onClick={save} loading={saving} icon={<Bell size={15} />}>Save preferences</Button></div>
      </SectionCard>
      <div className="card p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-ink"><Bell size={16} className="text-primary" /> Where alerts appear</p>
        <p className="mt-2 text-[11px] leading-5 text-muted">Notifications are stored in the database and shown in the top-bar bell. Nothing is sent to an external email or SMS address unless a provider is connected.</p>
        <div className="mt-4 rounded-xl bg-[#fbf8f3] p-3 text-[11px] leading-5 text-muted">Low-stock notices are generated automatically when stock falls at or below the reorder minimum.</div>
      </div>
    </div>
  )
}

function PaymentsTab({ settings }: { settings: SettingsBag }) {
  const [form, setForm] = useState({
    cash: Boolean(settings['payments.cash']),
    card: Boolean(settings['payments.card']),
    mobileMoney: Boolean(settings['payments.mobileMoney']),
    bankTransfer: Boolean(settings['payments.bankTransfer']),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const connected = Boolean(settings['payments.providerConnected'])
  const provider = settings['payments.provider'] || 'Not connected'
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put('/api/settings/payments', form)
      toast('Payment methods saved.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment settings.')
    } finally {
      setSaving(false)
    }
  }
  const methods = [
    { key: 'cash' as const, label: 'Cash', description: 'Record cash payments taken at the counter or table.' },
    { key: 'card' as const, label: 'Card', description: 'Record card payments processed on a terminal.' },
    { key: 'mobileMoney' as const, label: 'Mobile money', description: 'Record M-Pesa, Airtel Money and Tigo Pesa payments.' },
    { key: 'bankTransfer' as const, label: 'Bank transfer', description: 'Record direct bank transfers for catering and events.' },
  ]
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
      <SectionCard title="Accepted payment methods" description="These methods can be selected when creating or editing an order.">
        <div className="divide-y divide-line">
          {methods.map((method) => (
            <div key={method.key} className="py-4 first:pt-0 last:pb-0"><Toggle checked={form[method.key]} onChange={(value) => setForm({ ...form, [method.key]: value })} label={method.label} description={method.description} /></div>
          ))}
        </div>
        <FormNotice error={error} />
        <div className="mt-4 flex justify-end border-t border-line pt-4"><Button onClick={save} loading={saving} icon={<CreditCard size={15} />}>Save payment methods</Button></div>
      </SectionCard>
      <div className="space-y-4">
        <div className={`card p-5 ${connected ? 'border-[#d6eddd]' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-ink"><Wallet size={16} className="text-primary" /> Online gateway</p>
            <StatusBadge status={connected ? 'ACTIVE' : 'NOT CONNECTED'} />
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">{connected ? `Provider: ${provider}. The gateway is enabled and credentials are held on the server.` : 'No payment provider credentials are configured. Online card and mobile money processing is unavailable; only offline payment records can be kept.'}</p>
          {!connected && <div className="mt-3 rounded-xl border border-[#f2e3d8] bg-[#fff8f2] p-3 text-[11px] leading-5 text-[#8a5b46]">A gateway only shows as connected when the server has a real provider API key. Nothing is simulated in the browser.</div>}
        </div>
        <div className="card p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-ink"><LockKeyhole size={16} className="text-success" /> Credentials stay private</p>
          <p className="mt-2 text-[11px] leading-5 text-muted">Provider secrets are read from server environment variables and are never exposed to the React frontend or stored in the database.</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

interface SecurityData {
  twoFactorEnabled: boolean
  sessions: { id: string; tokenHash: string; createdAt: string; expiresAt: string; userAgent: string; current: boolean }[]
  loginHistory: { id: number; email: string; ip: string; userAgent: string; success: boolean; createdAt: string }[]
  sessionPolicy: string
  limitations: string[]
}

function SecurityTab() {
  const { refresh } = useAuth()
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [enableCode, setEnableCode] = useState('')
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableForm, setDisableForm] = useState({ password: '', code: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState('')
  const [formError, setFormError] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const security = await api.get<SecurityData>('/api/security')
      setData(security)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load security settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const startSetup = async () => {
    setBusy('setup')
    setFormError('')
    try {
      const result = await api.post<{ secret: string; otpauthUrl: string; message: string }>('/api/auth/2fa/setup')
      setSetup({ secret: result.secret, otpauthUrl: result.otpauthUrl })
      toast('Authenticator secret generated.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start 2FA setup.', 'error')
    } finally {
      setBusy('')
    }
  }
  const enable2fa = async () => {
    setBusy('enable')
    setFormError('')
    try {
      await api.post('/api/auth/2fa/enable', { code: enableCode })
      toast('Two-factor authentication enabled.', 'success')
      setSetup(null)
      setEnableCode('')
      await Promise.all([load(false), refresh()])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not enable 2FA.')
    } finally {
      setBusy('')
    }
  }
  const disable2fa = async () => {
    setBusy('disable')
    setFormError('')
    try {
      await api.post('/api/auth/2fa/disable', disableForm)
      toast('Two-factor authentication disabled.', 'success')
      setDisableOpen(false)
      setDisableForm({ password: '', code: '' })
      await Promise.all([load(false), refresh()])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not disable 2FA.')
    } finally {
      setBusy('')
    }
  }
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (passwordForm.newPassword.length < 8) return setFormError('The new password must be at least 8 characters.')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setFormError('The new passwords do not match.')
    setBusy('password')
    try {
      await api.put('/api/security/password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
      toast('Password updated. Other sessions were signed out.', 'success')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      load(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setBusy('')
    }
  }
  const revoke = async (session: SecurityData['sessions'][number]) => {
    const ok = await confirm({ title: 'Revoke session?', message: session.current ? 'This is your current session. Revoking it will sign you out.' : `This will sign out the session from ${session.userAgent || 'an unknown device'}.`, confirmLabel: 'Revoke session', tone: 'danger' })
    if (!ok) return
    try {
      await api.delete(`/api/security/sessions/${session.tokenHash}`)
      toast('Session revoked.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not revoke the session.', 'error')
    }
  }
  const revokeOthers = async () => {
    const ok = await confirm({ title: 'Sign out other sessions?', message: 'Every other active session for your account will be revoked.', confirmLabel: 'Sign out others' })
    if (!ok) return
    try {
      await api.post('/api/security/sessions/revoke-others')
      toast('Other sessions signed out.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not revoke the sessions.', 'error')
    }
  }
  const copySecret = async () => {
    if (!setup) return
    try {
      await navigator.clipboard.writeText(setup.secret)
      toast('Secret copied.', 'success')
    } catch {
      toast('Could not copy. Select the secret manually.', 'warning')
    }
  }

  if (loading) return <div className="card p-5"><LoadingBlock rows={8} /></div>
  if (error || !data) return <ErrorState message={error || 'Security data unavailable.'} onRetry={() => load()} />

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <SectionCard title="Two-factor authentication" description="Authenticator-app codes are verified on the server." action={<StatusBadge status={data.twoFactorEnabled ? 'ACTIVE' : 'DISABLED'} />}>
          {setup ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-[#fcfaf6] p-4">
                <p className="text-xs font-bold text-ink">Add this secret to your authenticator app</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-ink">{setup.secret}</code>
                  <button type="button" onClick={copySecret} className="icon-btn h-8 w-8 shrink-0" aria-label="Copy secret"><Copy size={14} /></button>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted">Then enter the six-digit code shown in the app.</p>
              </div>
              <Field label="Six-digit code" required><Input value={enableCode} onChange={(event) => setEnableCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" className="font-mono tracking-[0.35em]" /></Field>
              <FormNotice error={formError} />
              <div className="flex gap-2"><Button onClick={enable2fa} loading={busy === 'enable'} icon={<CheckCircle2 size={15} />}>Enable 2FA</Button><Button variant="secondary" onClick={() => { setSetup(null); setFormError('') }}>Cancel</Button></div>
            </div>
          ) : data.twoFactorEnabled ? (
            <div>
              <div className="flex items-start gap-3 rounded-xl bg-soft-green p-4"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-success" /><div><p className="text-sm font-bold text-ink">Your account is protected</p><p className="mt-1 text-[11px] leading-5 text-muted">A six-digit authenticator code is required after your password at sign-in.</p></div></div>
              <Button variant="secondary" className="mt-4" onClick={() => { setDisableOpen(true); setFormError('') }} icon={<XCircle size={15} />}>Disable two-factor</Button>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 rounded-xl bg-[#fbf8f3] p-4"><KeyRound size={19} className="mt-0.5 shrink-0 text-[#9A7214]" /><div><p className="text-sm font-bold text-ink">Authenticator app not enabled</p><p className="mt-1 text-[11px] leading-5 text-muted">Add a second layer of protection to your account. Email and SMS fallback codes are not configured.</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2"><Button onClick={startSetup} loading={busy === 'setup'} icon={<ShieldCheck size={15} />}>Set up authenticator</Button><Button variant="secondary" onClick={() => load()} icon={<RefreshCw size={14} />}>Refresh</Button></div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Change password" description="Use at least 8 characters. Other sessions are signed out after a change.">
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Current password" required><Input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" required><Input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm new password" required><Input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} autoComplete="new-password" /></Field>
            <div className="flex justify-end"><Button type="submit" loading={busy === 'password'} icon={<LockKeyhole size={15} />}>Update password</Button></div>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Active sessions" description="Devices currently signed in to your account." action={<Button variant="secondary" size="sm" onClick={revokeOthers}>Sign out other sessions</Button>} bodyClassName="p-0">
        <div className="table-wrap rounded-none border-0">
          <table className="data-table min-w-[700px]">
            <thead><tr><th>Device</th><th>Started</th><th>Expires</th><th>Status</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {data.sessions.map((session) => (
                <tr key={session.tokenHash}>
                  <td><p className="max-w-[380px] truncate text-xs font-medium text-ink">{session.userAgent || 'Unknown client'}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{session.id}…</p></td>
                  <td className="text-xs text-muted">{formatDateTime(session.createdAt)}</td>
                  <td className="text-xs text-muted">{formatDateTime(session.expiresAt)}</td>
                  <td>{session.current ? <Badge className="badge-green">This device</Badge> : <Badge className="badge-gray">Active</Badge>}</td>
                  <td><div className="flex justify-end"><button type="button" onClick={() => revoke(session)} className="text-[11px] font-semibold text-coral hover:underline">Revoke</button></div></td>
                </tr>
              ))}
              {!data.sessions.length && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted">No active sessions.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Recent sign-in history" description="The latest 20 authentication attempts for this account." bodyClassName="p-0">
          <div className="max-h-[390px] overflow-y-auto">
            <table className="data-table min-w-[620px]">
              <thead><tr><th>Result</th><th>When</th><th>IP address</th><th>Device</th></tr></thead>
              <tbody>
                {data.loginHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td><StatusBadge status={entry.success ? 'SUCCESS' : 'FAILED'} /></td>
                    <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(entry.createdAt)}</td>
                    <td className="font-mono text-[10px] text-muted">{entry.ip || '—'}</td>
                    <td className="max-w-[240px] truncate text-xs text-muted">{entry.userAgent || 'Unknown device'}</td>
                  </tr>
                ))}
                {!data.loginHistory.length && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted">No sign-in history yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <div className="space-y-4">
          <div className="card p-4"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Session policy</p><p className="mt-1 font-display text-lg font-extrabold text-ink">{data.sessionPolicy}</p><p className="mt-1 text-[11px] leading-5 text-muted">Sessions expire automatically and are revoked when an account is deactivated.</p></div>
          <div className="card p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-ink"><ShieldCheck size={14} className="text-primary" /> Security limitations</p>
            <ul className="mt-2 space-y-2 text-[11px] leading-5 text-muted">{data.limitations.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>
          </div>
        </div>
      </div>

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable two-factor authentication" description="Confirm with your password or a current authenticator code." width="max-w-md"
        footer={<><Button variant="secondary" onClick={() => setDisableOpen(false)}>Cancel</Button><Button variant="danger" onClick={disable2fa} loading={busy === 'disable'}>Disable 2FA</Button></>}>
        <div className="space-y-4">
          <FormNotice error={formError} />
          <Field label="Current password"><Input type="password" value={disableForm.password} onChange={(event) => setDisableForm({ ...disableForm, password: event.target.value })} autoComplete="current-password" /></Field>
          <p className="text-center text-[11px] text-muted">or</p>
          <Field label="Authenticator code"><Input value={disableForm.code} onChange={(event) => setDisableForm({ ...disableForm, code: event.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" className="font-mono tracking-[0.35em]" /></Field>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')
  const [knownActions, setKnownActions] = useState<string[]>([])

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (query) params.set('q', query)
      if (action !== 'all') params.set('action', action)
      const result = await api.get<{ logs: AuditLog[] }>(`/api/audit?${params.toString()}`)
      setLogs(result.logs)
      if (action === 'all' && !query) setKnownActions([...new Set(result.logs.map((log) => log.action))].sort())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log.')
    } finally {
      setLoading(false)
    }
  }, [query, action])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 220)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search action, entity or staff…" />
        <div className="flex flex-1 justify-end gap-2">
          <Select value={action} onChange={(event) => setAction(event.target.value)} className="text-xs lg:w-[230px]">
            <option value="all">All audit actions</option>
            {knownActions.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ').toLowerCase()}</option>)}
          </Select>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />} onClick={() => load(false)}>Refresh</Button>
        </div>
      </div>

      {loading ? <div className="card p-5"><LoadingBlock rows={8} /></div> : error ? <ErrorState message={error} onRetry={() => load()} /> : !logs.length ? (
        <EmptyState icon={<ScrollText size={24} />} title="No audit entries match" message="Try a different search term or action filter." />
      ) : (
        <div className="table-wrap">
          <table className="data-table min-w-[820px]">
            <thead><tr><th>Action</th><th>Entity</th><th>Details</th><th>Staff</th><th>When</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td><span className="rounded-md bg-[#f7f3ed] px-1.5 py-1 font-mono text-[9px] font-semibold text-[#6c665f]">{log.action.replace(/_/g, ' ')}</span></td>
                  <td className="text-xs text-muted">{log.entityType}{log.entityId ? ` #${log.entityId}` : ''}</td>
                  <td className="max-w-[380px] text-xs text-[#5f5a53]"><p className="truncate">{log.details}</p></td>
                  <td><div className="flex items-center gap-2"><Avatar src={log.user?.avatarUrl} name={log.user?.name} size={26} /><div><p className="text-[11px] font-semibold text-ink">{log.user?.name || 'System'}</p><p className="text-[10px] text-muted">{log.user?.email || 'Automatic process'}</p></div></div></td>
                  <td className="whitespace-nowrap text-[10px] text-muted">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[10px] text-muted"><span>Showing the {logs.length} most recent matching entries.</span><span>Audit records are append-only.</span></div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { hasPermission } = useAuth()
  const [settings, setSettings] = useState<SettingsBag | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  const allowedTabs = useMemo(() => tabDefinitions.filter((tab) => hasPermission(tab.permission)), [hasPermission])
  const tabParam = searchParams.get('tab')
  const activeTab = allowedTabs.find((tab) => tab.id === tabParam)?.id || allowedTabs[0]?.id || 'general'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get<SettingsResponse>('/api/settings')
      setSettings(result.settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const changeTab = (id: string) => setSearchParams({ tab: id }, { replace: true })
  const reloadSettings = () => { load().catch(() => toast('Could not refresh settings.', 'error')) }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'System' }, { label: 'Settings' }]}
        eyebrow="Control center"
        title="Settings"
        description="Manage the restaurant profile, your account, staff access and the security posture of the workspace."
        actions={<Button variant="secondary" icon={<RefreshCw size={15} />} onClick={reloadSettings}>Refresh</Button>}
      />

      {loading ? (
        <div className="space-y-4"><div className="skeleton h-12 rounded-xl" /><div className="card p-5"><LoadingBlock rows={8} /></div></div>
      ) : error || !settings ? (
        <ErrorState message={error || 'Settings unavailable.'} onRetry={load} />
      ) : !allowedTabs.length ? (
        <EmptyState icon={<LockKeyhole size={24} />} title="No settings access" message="Your role does not include any settings permissions." />
      ) : (
        <div className="space-y-5">
          <Tabs tabs={allowedTabs.map((tab) => ({ id: tab.id, label: tab.label }))} active={activeTab} onChange={changeTab} />
          {activeTab === 'general' && <GeneralTab key="general" settings={settings} />}
          {activeTab === 'profile' && <ProfileTab key="profile" />}
          {activeTab === 'staff' && <StaffTab key="staff" />}
          {activeTab === 'roles' && <RolesTab key="roles" />}
          {activeTab === 'notifications' && <NotificationsTab key="notifications" settings={settings} />}
          {activeTab === 'payments' && <PaymentsTab key="payments" settings={settings} />}
          {activeTab === 'security' && <SecurityTab key="security" />}
          {activeTab === 'audit' && <AuditTab key="audit" />}
        </div>
      )}
    </div>
  )
}
