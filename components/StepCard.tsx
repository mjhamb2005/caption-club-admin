import Link from 'next/link'

// One prompt chain step: its order, model, backup model, settings and the full prompt template.
export default function StepCard({ step, chain }: { step: any; chain?: { id: number; name: string } }) {
  const model = Array.isArray(step.model) ? step.model[0] : step.model
  const fallback = Array.isArray(step.fallback) ? step.fallback[0] : step.fallback
  return (
    <article className="b-step">
      <div className="b-step-n" aria-hidden="true">{step.step_order}</div>
      <div className="b-step-body">
        <h3>{step.name}{chain && <small> · <Link className="b-link" href={`/prompt-chains/${chain.id}`}>{chain.name}</Link></small>}</h3>
        <dl className="b-facts">
          <div><dt>Input</dt><dd>{step.step_order === 1 ? 'The photo' : 'Text from the step before'}</dd></div>
          <div><dt>Model</dt><dd>{model ? <>{model.name} <code>{model.api_model_id}</code>{!model.is_active && <span className="b-pill off">off</span>}</> : <span className="b-pill down">None</span>}</dd></div>
          <div><dt>Backup</dt><dd>{fallback ? <>{fallback.name} <code>{fallback.api_model_id}</code></> : '—'}</dd></div>
          <div><dt>Temperature</dt><dd>{step.temperature ?? 'Model default'}</dd></div>
          <div><dt>Output</dt><dd>{step.json_output ? 'JSON' : 'Text'}</dd></div>
        </dl>
        <details className="b-prompt" open={!chain}>
          <summary>Prompt template</summary>
          <pre>{step.prompt_template}</pre>
        </details>
      </div>
    </article>
  )
}
