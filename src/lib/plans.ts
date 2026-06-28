import type { OrgPlan } from '@/types'

export const PLAN_LIMITS: Record<OrgPlan, { label: string; max: number; price: number }> = {
  free:    { label: 'Free',    max: 1,   price: 0   },
  starter: { label: 'Starter', max: 3,   price: 79  },
  agence:  { label: 'Agence',  max: 8,   price: 149 },
  pro:     { label: 'Pro',     max: 999, price: 299 },
}
