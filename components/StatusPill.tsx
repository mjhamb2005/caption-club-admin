const LABEL: Record<string, string> = { succeeded: 'Succeeded', failed: 'Failed', running: 'Running', abandoned: 'Abandoned', ok: 'OK', error: 'Error' }
export default function StatusPill({ status }: { status: string }) {
  const cls = status === 'succeeded' || status === 'ok' ? 'up' : status === 'failed' || status === 'error' ? 'down' : 'off'
  return <span className={`b-pill ${cls}`}>{LABEL[status] ?? status}</span>
}
