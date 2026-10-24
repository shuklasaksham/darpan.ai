import { useEffect, useRef, useState } from 'react';
import { getHealth, uploadTake } from './api.js';

const fmtMb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const fmtSec = (s) => (s == null ? '—' : `${s.toFixed(1)}s`);

export default function App() {
  const inputRef = useRef(null);
  const [health, setHealth] = useState(null);
  const [state, setState] = useState({ phase: 'idle' }); // idle | uploading | done | error

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState({ phase: 'uploading', progress: 0, name: file.name, size: file.size });
    try {
      const take = await uploadTake(file, (p) => setState((s) => ({ ...s, progress: p })));
      setState({ phase: 'done', take });
    } catch (err) {
      setState({ phase: 'error', message: err.message });
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <span className="mark" aria-hidden="true" />
        <span className="brand">Darpan</span>
        <StatusDot health={health} />
      </header>

      <section className="hero">
        <p className="eyebrow">Your AI director</p>
        <h1>
          Shoot your reel.
          <br />
          Get notes like a pro.
        </h1>
        <p className="lede">Record a take, and Darpan tells you what to fix before the next one — framing, energy, hook, delivery.</p>
      </section>

      <section className="panel">
        {state.phase === 'uploading' && (
          <div className="progress">
            <div className="progress-label">
              <span>Uploading take</span>
              <span>{Math.round(state.progress * 100)}%</span>
            </div>
            <div className="bar">
              <div className="fill" style={{ width: `${state.progress * 100}%` }} />
            </div>
            <p className="muted">{fmtMb(state.size)}</p>
          </div>
        )}

        {state.phase === 'done' && (
          <div className="result">
            <p className="result-title">Take received</p>
            <dl>
              <div><dt>Length</dt><dd>{fmtSec(state.take.durationSec)}</dd></div>
              <div><dt>Frame</dt><dd>{state.take.width ? `${state.take.width}×${state.take.height}` : '—'}</dd></div>
              <div><dt>Audio</dt><dd>{state.take.hasAudio ? 'Yes' : 'None'}</dd></div>
            </dl>
            <p className="muted">Director's notes are coming next.</p>
          </div>
        )}

        {state.phase === 'error' && <p className="error">{state.message}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          capture="user"
          hidden
          onChange={onFile}
        />
        <button
          className="record"
          disabled={state.phase === 'uploading'}
          onClick={() => inputRef.current?.click()}
        >
          <span className="dot" aria-hidden="true" />
          {state.phase === 'idle' ? 'Record a take' : 'Record another take'}
        </button>
      </section>
    </main>
  );
}

function StatusDot({ health }) {
  if (!health) return <span className="status">…</span>;
  const ok = health.ok && health.ffmpeg !== 'missing';
  return (
    <span className={`status ${ok ? 'ok' : 'bad'}`} title={JSON.stringify(health.keys ?? {})}>
      {ok ? 'Ready' : 'Offline'}
    </span>
  );
}
