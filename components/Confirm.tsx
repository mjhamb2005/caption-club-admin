'use client'
import { useEffect, useRef, type ReactNode } from 'react'

// A centered "are you sure?" dialog. Escape or clicking outside cancels.
export default function Confirm({
  open, title, children, confirmLabel, busy, error, onCancel, onConfirm,
}: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; busy?: boolean; error?: string
  onCancel: () => void; onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref} className="b-dialog" aria-label={title}
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel() }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
    >
      <h2>{title}</h2>
      <div className="b-dialog-body">{children}</div>
      {error && <p className="b-error" role="alert">{error}</p>}
      <div className="b-dialog-actions">
        <button className="b-btn b-btn-outline" onClick={onCancel} disabled={busy} autoFocus>Keep it</button>
        <button className="b-btn b-btn-danger-solid" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </dialog>
  )
}
