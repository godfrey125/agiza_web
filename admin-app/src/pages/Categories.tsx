import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, FolderOpen, Pencil, Plus, Tags, Trash2, UtensilsCrossed } from 'lucide-react'
import { api } from '../lib/api'
import type { Category, CategoryResponse } from '../lib/types'
import { currency, number } from '../lib/format'
import {
  Button, EmptyState, ErrorState, Field, FoodImage, ImageUploader, Input, LoadingBlock,
  Modal, PageHeader, SearchInput, Select, StatusBadge, Textarea, useConfirm, useToast,
} from '../components/ui'

const empty = { name: '', description: '', imageUrl: '', status: 'ACTIVE' }

export default function CategoriesPage() {
  const [data, setData] = useState<CategoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const result = await api.get<CategoryResponse>(`/api/categories?q=${encodeURIComponent(query)}&status=${status}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load categories.')
    } finally {
      setLoading(false)
    }
  }, [query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setForm({ name: category.name, description: category.description || '', imageUrl: category.image_url || '', status: category.status })
    setFormError('')
    setModalOpen(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return setFormError('Category name is required.')
    setSaving(true)
    setFormError('')
    try {
      if (editing) await api.put(`/api/categories/${editing.id}`, form)
      else await api.post('/api/categories', form)
      toast(editing ? 'Category updated.' : 'Category created.', 'success')
      setModalOpen(false)
      load(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the category.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (category: Category) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: category.itemCount > 0
        ? `“${category.name}” still contains ${category.itemCount} menu item${category.itemCount === 1 ? '' : 's'}. Move them to another category first.`
        : `“${category.name}” will be permanently removed from the workspace.`,
      confirmLabel: 'Delete category',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api/categories/${category.id}`)
      toast('Category deleted.', 'success')
      load(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the category.', 'error')
    }
  }

  const summary = data?.summary
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Categories' }]}
        eyebrow="Menu architecture"
        title="Categories"
        description="Group the menu into a clear structure guests can browse and your team can report on."
        actions={<Button icon={<Plus size={16} />} onClick={openCreate}>Add category</Button>}
      />

      {!loading && summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['All categories', summary.total, 'text-ink'],
            ['Active', summary.active, 'text-success'],
            ['Inactive', summary.inactive, 'text-coral'],
            ['Uncategorized items', summary.withoutCategory, 'text-primary'],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="card p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
              <p className={`mt-1 font-display text-2xl font-extrabold ${tone}`}>{number(Number(value))}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-5 flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search categories…" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="text-xs sm:w-[150px]">
          <option value="all">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>

      {loading ? (
        <div className="card p-5"><LoadingBlock rows={7} /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Tags size={24} />}
          title="No categories match"
          message="Try a different search or status, or create a new category to organise the menu."
          action={<Button icon={<Plus size={15} />} onClick={openCreate}>Add category</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Category</th><th>Menu items</th><th>Revenue</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {data.items.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <FoodImage src={category.image_url} alt={category.name} className="h-11 w-11 shrink-0" />
                      <div className="min-w-0">
                        <Link to={`/categories/${category.id}`} className="table-primary block hover:text-primary">{category.name}</Link>
                        <p className="table-secondary max-w-[360px] truncate">{category.description || 'No description yet.'}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="font-semibold text-ink">{number(category.itemCount)}</p>
                    <p className="text-[10px] text-muted">{number(category.availableItems)} available</p>
                  </td>
                  <td className="font-semibold text-ink">{currency(category.revenue)}</td>
                  <td><StatusBadge status={category.status} /></td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Link to={`/categories/${category.id}`} className="icon-btn h-8 w-8" aria-label="View category"><Eye size={14} /></Link>
                      <button type="button" onClick={() => openEdit(category)} className="icon-btn h-8 w-8" aria-label="Edit category"><Pencil size={14} /></button>
                      <button type="button" onClick={() => remove(category)} className="icon-btn h-8 w-8 hover:text-coral" aria-label="Delete category"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="card flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-primary"><Tags size={16} /></span>
          <div><p className="text-xs font-bold text-ink">Clear structure</p><p className="mt-1 text-[11px] leading-5 text-muted">Categories flow into the dashboard donut, menu filters and category reports.</p></div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-soft-green text-success"><UtensilsCrossed size={16} /></span>
          <div><p className="text-xs font-bold text-ink">Menu-aware</p><p className="mt-1 text-[11px] leading-5 text-muted">Categories with menu items are protected from accidental deletion.</p></div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-soft-yellow text-[#9A7214]"><FolderOpen size={16} /></span>
          <div><p className="text-xs font-bold text-ink">Status control</p><p className="mt-1 text-[11px] leading-5 text-muted">Deactivate a category without deleting its items or history.</p></div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit category' : 'Add category'}
        description="A category groups related dishes and appears in reporting."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} icon={<Tags size={15} />}>{editing ? 'Save changes' : 'Create category'}</Button>
          </>
        )}
      >
        <form onSubmit={save} className="space-y-4">
          {formError && <div className="rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{formError}</div>}
          <Field label="Category name" required>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Main Course" />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="How should this category be described?" className="min-h-[90px]" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <ImageUploader value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} label="Category image" />
        </form>
      </Modal>
    </div>
  )
}
