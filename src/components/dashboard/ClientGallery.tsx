import Link from 'next/link'
import { getInitials, avatarColorFromName, cn } from '@/lib/utils'

export interface ClientCard {
  id: string
  name: string
  logo_url: string | null
  status: string
  pendingReview: number
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  actif:    { label: 'Actif',    cls: 'bg-green-100 text-green-700' },
  prospect: { label: 'Prospect', cls: 'bg-blue-100  text-blue-700'  },
  inactif:  { label: 'Inactif',  cls: 'bg-gray-100  text-gray-500'  },
}

export default function ClientGallery({ title, clients }: { title: string; clients: ClientCard[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <span className="text-xs text-gray-400 ml-auto">{clients.length} contact{clients.length !== 1 ? 's' : ''}</span>
      </div>

      {clients.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-400">Aucun contact assigné pour l'instant</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {clients.map(c => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.inactif
            return (
              <Link
                key={c.id}
                href={`/dashboard/clients/${c.id}`}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02]"
              >
                {c.logo_url ? (
                  <img
                    src={c.logo_url}
                    alt={c.name}
                    className="w-full object-cover"
                    style={{ height: 180 }}
                  />
                ) : (
                  <div
                    className={cn('w-full flex items-center justify-center text-3xl font-semibold', avatarColorFromName(c.name))}
                    style={{ height: 180 }}
                  >
                    {getInitials(c.name)}
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-gray-900 text-sm truncate">{c.name}</p>
                    {c.pendingReview > 0 && (
                      <span
                        title={`${c.pendingReview} contenu${c.pendingReview > 1 ? 's' : ''} en attente d'approbation`}
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center justify-center"
                      >
                        {c.pendingReview}
                      </span>
                    )}
                  </div>
                  <span className={cn('inline-flex mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full', badge.cls)}>
                    {badge.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
