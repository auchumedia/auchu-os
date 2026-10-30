'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveTimerEntry {
  id: string
  task_id: string
  task_title: string | null
  accumulated_seconds: number
  segment_started_at: string | null
}

interface TimerContextValue {
  activeEntry: ActiveTimerEntry | null
  elapsedSeconds: number
  busy: boolean
  loaded: boolean
  refresh: () => Promise<void>
  start: (taskId: string) => Promise<{ stoppedTaskId: string | null } | null>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<{ taskId: string } | null>
}

const TimerContext = createContext<TimerContextValue | null>(null)

const STORAGE_KEY = 'auchu:active-timer'
const POLL_INTERVAL_MS = 5000

// ─── localStorage : cache d'affichage instantané, jamais la source de vérité ──
// Sert uniquement à éviter que la bannière disparaisse une fraction de
// seconde le temps qu'une nouvelle page charge et refetch le serveur.

function readCache(): ActiveTimerEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveTimerEntry) : null
  } catch {
    return null
  }
}

function writeCache(entry: ActiveTimerEntry | null) {
  if (typeof window === 'undefined') return
  try {
    if (entry) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage indisponible (navigation privée, quota dépassé) — non bloquant,
    // le fetch serveur reste la source de vérité de toute façon.
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TimerProvider({
  children, initialActiveEntry,
}: {
  children: React.ReactNode
  initialActiveEntry: ActiveTimerEntry | null
}) {
  // Hydratation instantanée : valeur SSR si dispo, sinon cache local — jamais
  // un écran vide le temps du premier fetch client.
  const [activeEntry, setActiveEntry] = useState<ActiveTimerEntry | null>(
    () => initialActiveEntry ?? readCache()
  )
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [busy, setBusy]       = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const hasHydratedFromServer = useRef(false)

  useEffect(() => { writeCache(activeEntry) }, [activeEntry])

  // Tick chaque seconde uniquement pendant qu'un segment tourne (pas en pause,
  // pas à l'arrêt) — évite des re-renders inutiles le reste du temps.
  useEffect(() => {
    if (!activeEntry?.segment_started_at) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeEntry?.segment_started_at])

  // Seule source de vérité pour l'état actif : GET /api/time-entries?active=true.
  // Appelée au montage (sur CHAQUE page, via le layout) puis toutes les 5s —
  // ce qui rattrape aussi bien un chrono démarré/arrêté dans un autre onglet.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries?active=true')
      if (res.ok) {
        const { data } = await res.json()
        setActiveEntry(data ?? null)
        setNowTick(Date.now())
      }
    } finally {
      hasHydratedFromServer.current = true
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const start = useCallback(async (taskId: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })
      if (!res.ok) return null
      const { data, stopped } = await res.json()
      setActiveEntry({
        id: data.id,
        task_id: data.task_id,
        task_title: data.task_title ?? null,
        accumulated_seconds: data.accumulated_seconds,
        segment_started_at: data.segment_started_at,
      })
      setNowTick(Date.now())
      return { stoppedTaskId: stopped?.task_id ?? null }
    } finally {
      setBusy(false)
    }
  }, [])

  const pause = useCallback(async () => {
    if (!activeEntry) return
    setBusy(true)
    try {
      const res = await fetch(`/api/time-entries/${activeEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pause' }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // accumulated_seconds vient du serveur — jamais recalculé localement.
        setActiveEntry(prev => prev ? { ...prev, accumulated_seconds: data.accumulated_seconds, segment_started_at: null } : prev)
      }
    } finally {
      setBusy(false)
    }
  }, [activeEntry])

  const resume = useCallback(async () => {
    if (!activeEntry) return
    setBusy(true)
    try {
      const res = await fetch(`/api/time-entries/${activeEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume' }),
      })
      if (res.ok) {
        const { data } = await res.json()
        // On repart du accumulated_seconds ET segment_started_at renvoyés par
        // le serveur — c'est ce qui garantit qu'on ne "repart jamais à zéro".
        setActiveEntry(prev => prev
          ? { ...prev, accumulated_seconds: data.accumulated_seconds, segment_started_at: data.segment_started_at }
          : prev)
        setNowTick(Date.now())
      }
    } finally {
      setBusy(false)
    }
  }, [activeEntry])

  const stop = useCallback(async () => {
    if (!activeEntry) return null
    setBusy(true)
    const taskId = activeEntry.task_id
    try {
      const res = await fetch(`/api/time-entries/${activeEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }),
      })
      if (!res.ok) return null
      setActiveEntry(null)
      return { taskId }
    } finally {
      setBusy(false)
    }
  }, [activeEntry])

  const elapsedSeconds = activeEntry
    ? activeEntry.accumulated_seconds + (activeEntry.segment_started_at
        ? Math.max(0, Math.floor((nowTick - new Date(activeEntry.segment_started_at).getTime()) / 1000))
        : 0)
    : 0

  return (
    <TimerContext.Provider value={{ activeEntry, elapsedSeconds, busy, loaded, refresh, start, pause, resume, stop }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer() doit être utilisé sous <TimerProvider>')
  return ctx
}
