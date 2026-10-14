import { useEffect, useRef, useState } from 'react'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.6)
  } catch {
    // sem áudio disponível: só vibração
  }
}

/** Barra fixa de descanso. `until` vem da sessão, então sobrevive a recarregar a página. */
export function RestTimer({
  until,
  total,
  onChange,
}: {
  until: number | undefined
  total: number | undefined
  onChange: (until: number | undefined) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const alerted = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!until) return
    setNow(Date.now()) // senão o primeiro quadro usa o horário de montagem
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [until])

  const left = until ? until - now : 0
  useEffect(() => {
    if (until && left <= 0 && alerted.current !== until) {
      alerted.current = until
      navigator.vibrate?.([200, 100, 200])
      beep()
      const t = setTimeout(() => onChange(undefined), 4000)
      return () => clearTimeout(t)
    }
  }, [until, left, onChange])

  if (!until) return null
  const done = left <= 0
  const pct = total ? Math.min(100, Math.max(0, (1 - left / (total * 1000)) * 100)) : 0

  return (
    <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-20 px-3 pb-2">
      <div
        className={`mx-auto max-w-xl overflow-hidden rounded-2xl border shadow-xl shadow-black/50 ${
          done ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-2'
        }`}
        role="timer"
        aria-live="polite"
      >
        {!done && <div className="h-1 bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />}
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="flex-1">
            <p className={`text-xs ${done ? '' : 'text-muted'}`}>{done ? 'Descanso encerrado' : 'Descanso'}</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{done ? 'Bora!' : mmss(left)}</p>
          </div>
          {!done && (
            <>
              <button onClick={() => onChange(until - 15000)} className="h-10 rounded-xl bg-surface px-3 text-sm">
                −15s
              </button>
              <button onClick={() => onChange(until + 15000)} className="h-10 rounded-xl bg-surface px-3 text-sm">
                +15s
              </button>
            </>
          )}
          <button
            onClick={() => onChange(undefined)}
            className={`h-10 rounded-xl px-3 text-sm font-medium ${done ? 'bg-accent-ink/10' : 'bg-accent text-accent-ink'}`}
          >
            {done ? 'Fechar' : 'Pular'}
          </button>
        </div>
      </div>
    </div>
  )
}
