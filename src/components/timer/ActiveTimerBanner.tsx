'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Pause, Play, Square } from 'lucide-react'
import { useTimer } from '@/lib/timer/TimerContext'
import { cn, formatDurationWithSeconds } from '@/lib/utils'

// Bannière persistante — visible sur toutes les pages du dashboard tant qu'un
// chrono est actif (en cours ou en pause), pas seulement sur /dashboard/taches.
export default function ActiveTimerBanner() {
  const { activeEntry, elapsedSeconds, busy, pause, resume, stop } = useTimer()
  const pathname = usePathname()

  if (!activeEntry) return null

  const isPaused = !activeEntry.segment_started_at
  const onTachesPage = pathname === '/dashboard/taches'

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 text-white rounded-xl px-4 py-3 flex-wrap mb-6',
      isPaused ? 'bg-amber-500' : 'bg-auchu-600'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {isPaused ? (
          <Pause className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <span className="relative flex w-2.5 h-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60" />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-white" />
          </span>
        )}
        <p className="text-sm font-medium truncate">
          {isPaused ? 'En pause' : 'En cours'} :{' '}
          {onTachesPage ? (
            <span>{activeEntry.task_title || 'Tâche'}</span>
          ) : (
            <Link href="/dashboard/taches" className="underline underline-offset-2 hover:no-underline">
              {activeEntry.task_title || 'Tâche'}
            </Link>
          )}
          {' '}— <span className="tabular-nums">{formatDurationWithSeconds(elapsedSeconds)}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isPaused ? (
          <button
            onClick={resume}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
          >
            <Play className="w-3 h-3 fill-current" />
            Reprendre
          </button>
        ) : (
          <button
            onClick={pause}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
          >
            <Pause className="w-3 h-3" />
            Pause
          </button>
        )}
        <button
          onClick={stop}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
        >
          <Square className="w-3 h-3 fill-current" />
          Arrêter
        </button>
      </div>
    </div>
  )
}
