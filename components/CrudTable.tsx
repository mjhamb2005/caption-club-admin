'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sbBrowser } from '@/lib/sb/browser'
import Confirm from './Confirm'

// One table + one dialog for every simple create/read/update/delete page in Backstage.
// Rows come from the server page; after a save the page refreshes so the table always shows the database.

export type Option = { value: string; label: string }
export type Field = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'bool' | 'select'
  required?: boolean
  help?: string
  placeholder?: string
  options?: Option[]          // for select; value '' means null
  lower?: boolean             // store lowercase (domains, emails)
  min?: number
  max?: number
  step?: number
  maxLength?: number
  createOnly?: boolean        // shown when creating, read-only afterwards
}
export type Column = {
  key: string
  label: string
  kind?: 'text' | 'bool' | 'date' | 'mono' | 'clamp' | 'num' | 'option'
  options?: Option[]          // for kind 'option': show the label for a stored value
}

type Props = {
  table: string
  noun: string                // "term", "LLM model"
  rows: Record<string, any>[]
  columns: Column[]
  fields: Field[]
  searchKeys: string[]
  defaults?: Record<string, any>
  deleteNote?: string
  emptyHint?: string
}

const show = (v: any, c: Column) => {
  if (v === null || v === undefined || v === '') return <span className="b-muted-inline">—</span>
  switch (c.kind) {
    case 'bool': return v ? <span className="b-pill up">On</span> : <span className="b-pill off">Off</span>
    case 'date': return <time dateTime={v}>{String(v).slice(0, 10)}</time>
    case 'mono': return <code>{String(v)}</code>
    case 'clamp': return <span className="b-clamp" title={String(v)}>{String(v)}</span>
    case 'num': return String(v)
    case 'option': return c.options?.find((o) => o.value === String(v))?.label ?? String(v)
    default: return String(v)
  }
}

export function friendlyDbError(e: { code?: string; message?: string; details?: string } | null, noun: string) {
  if (!e) return ''
  if (e.code === '23505') return `That ${noun} already exists.`
  if (e.code === '23503') return `This ${noun} is still being used somewhere else (for example, a model still points at this provider). Change or remove those first.`
  if (e.code === '23514') return `One of the values isn’t allowed. Check the format and length of each field.`
  if (e.code === '42501' || /row-level security|permission/i.test(e.message ?? '')) return 'Your account isn’t allowed to do that. Are you still a superadmin?'
  if (/does not exist|schema cache/i.test(e.message ?? '')) return 'That table doesn’t exist yet. Run supabase/week7-setup.sql in the Supabase SQL Editor.'
  return e.message || 'Something went wrong. Try again.'
}

export default function CrudTable({ table, noun, rows, columns, fields, searchKeys, defaults = {}, deleteNote, emptyHint }: Props) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Record<string, any> | null>(null) // {} = creating
  const [form, setForm] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [doomed, setDoomed] = useState<Record<string, any> | null>(null)
  const [toast, setToast] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const creating = editing !== null && editing.id === undefined

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (editing && !d.open) d.showModal()
    if (!editing && d.open) d.close()
  }, [editing])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const term = q.trim().toLowerCase()
  const shown = useMemo(
    () => (term ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(term))) : rows),
    [rows, term, searchKeys],
  )

  function open(row: Record<string, any> | null) {
    const base = row ?? defaults
    setForm(Object.fromEntries(fields.map((f) => [f.key, base[f.key] ?? (f.type === 'bool' ? true : '')])))
    setError('')
    setEditing(row ?? {})
  }

  function payload() {
    const out: Record<string, any> = {}
    for (const f of fields) {
      if (f.createOnly && !creating) continue
      let v = form[f.key]
      if (f.type === 'bool') { out[f.key] = !!v; continue }
      if (f.type === 'number') {
        if (v === '' || v === null || v === undefined) { if (f.required) throw new Error(`${f.label} is required.`); out[f.key] = null; continue }
        const n = Number(v)
        if (!Number.isFinite(n)) throw new Error(`${f.label} must be a number.`)
        if (f.min !== undefined && n < f.min) throw new Error(`${f.label} must be at least ${f.min}.`)
        if (f.max !== undefined && n > f.max) throw new Error(`${f.label} must be at most ${f.max}.`)
        out[f.key] = n
        continue
      }
      v = String(v ?? '').trim()
      if (f.lower) v = v.toLowerCase()
      if (!v) { if (f.required) throw new Error(`${f.label} is required.`); out[f.key] = null; continue }
      out[f.key] = f.type === 'select' && /^\d+$/.test(v) ? Number(v) : v
    }
    return out
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const body = payload()
      const supabase = sbBrowser()
      const res = creating
        ? await supabase.from(table).insert(body).select('id')
        : await supabase.from(table).update(body).eq('id', editing!.id).select('id')
      if (res.error) throw new Error(friendlyDbError(res.error, noun))
      if (!res.data?.length) throw new Error('Nothing was saved. Your account may not be allowed to change this.')
      setEditing(null)
      setToast(creating ? `Added the ${noun}.` : `Saved the ${noun}.`)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!doomed) return
    setBusy(true)
    setError('')
    const { data, error: e } = await sbBrowser().from(table).delete().eq('id', doomed.id).select('id')
    setBusy(false)
    if (e) return setError(friendlyDbError(e, noun))
    if (!data?.length) return setError('Nothing was deleted. Your account may not be allowed to delete this.')
    setDoomed(null)
    setToast(`Deleted the ${noun}.`)
    router.refresh()
  }

  const titleOf = (r: Record<string, any>) => String(r[searchKeys[0]] ?? `#${r.id}`)

  return (
    <>
      <div className="b-filters">
        <input className="b-search" type="search" placeholder={`Search ${noun}s`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${noun}s`} />
        <span className="b-count">{shown.length} of {rows.length}</span>
        <button className="b-btn b-btn-primary" onClick={() => open(null)}>+ Add {noun}</button>
      </div>

      {shown.length === 0 ? (
        <div className="b-empty">
          <h2>{rows.length ? `No ${noun}s match` : `No ${noun}s yet`}</h2>
          <p>{rows.length ? 'Try a different search.' : emptyHint ?? `Add the first one.`}</p>
          {!rows.length && <button className="b-btn b-btn-primary" onClick={() => open(null)}>+ Add {noun}</button>}
        </div>
      ) : (
        <div className="b-table-wrap">
          <table className="b-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key} className={c.kind === 'num' ? 'num' : undefined}>{c.label}</th>)}<th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  {columns.map((c) => <td key={c.key} className={c.kind === 'num' ? 'num' : undefined}>{show(r[c.key], c)}</td>)}
                  <td className="b-row-actions">
                    <button className="b-btn b-btn-outline b-btn-sm" onClick={() => open(r)} aria-label={`Edit ${titleOf(r)}`}>Edit</button>
                    <button className="b-btn b-btn-danger b-btn-sm" onClick={() => { setError(''); setDoomed(r) }} aria-label={`Delete ${titleOf(r)}`}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialog} className="b-dialog b-dialog-form" aria-label={creating ? `Add ${noun}` : `Edit ${noun}`}
        onCancel={(e) => { e.preventDefault(); if (!busy) setEditing(null) }}
      >
        <form onSubmit={(e) => { e.preventDefault(); save() }}>
          <h2>{creating ? `Add ${noun}` : `Edit ${noun}`}</h2>
          <div className="b-form-grid">
            {fields.map((f) => {
              const locked = f.createOnly && !creating
              const id = `f-${table}-${f.key}`
              if (f.type === 'bool') {
                return (
                  <label key={f.key} className="b-check b-check-field">
                    <input type="checkbox" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
                    <span>{f.label}{f.help && <small>{f.help}</small>}</span>
                  </label>
                )
              }
              return (
                <label key={f.key} className="b-field" htmlFor={id}>
                  <span>{f.label}{!f.required && <small> (optional)</small>}</span>
                  {f.type === 'textarea' ? (
                    <textarea id={id} rows={4} value={form[f.key] ?? ''} maxLength={f.maxLength} placeholder={f.placeholder} required={f.required}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : f.type === 'select' ? (
                    <select id={id} className="b-input" value={String(form[f.key] ?? '')} required={f.required} disabled={locked}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      {!f.required && <option value="">—</option>}
                      {f.required && !form[f.key] && <option value="" disabled>Choose…</option>}
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id={id} className="b-input" type={f.type === 'number' ? 'number' : 'text'} value={form[f.key] ?? ''} placeholder={f.placeholder}
                      maxLength={f.maxLength} min={f.min} max={f.max} step={f.step} required={f.required} readOnly={locked}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                  {f.help && <small className="b-help">{f.help}</small>}
                </label>
              )
            })}
          </div>
          {error && <p className="b-error" role="alert">{error}</p>}
          <div className="b-dialog-actions">
            <button type="button" className="b-btn b-btn-outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="b-btn b-btn-primary" disabled={busy}>{busy ? 'Saving…' : creating ? `Add ${noun}` : 'Save changes'}</button>
          </div>
        </form>
      </dialog>

      <Confirm
        open={!!doomed} title={`Delete this ${noun}?`} confirmLabel="Delete" busy={busy} error={doomed ? error : ''}
        onCancel={() => setDoomed(null)} onConfirm={remove}
      >
        <p><b>{doomed ? titleOf(doomed) : ''}</b> will be removed for good.{deleteNote ? ` ${deleteNote}` : ''}</p>
      </Confirm>

      {toast && <div className="b-toast" role="status">{toast}</div>}
    </>
  )
}
