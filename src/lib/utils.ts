import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Classnames ───────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Dates ────────────────────────────────────────────────────────────────────
export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy', { locale: fr })
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

export function formatDatetime(date: string | Date) {
  return format(new Date(date), "dd MMM yyyy 'à' HH'h'mm", { locale: fr })
}

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatCurrency(amount: number, currency = 'CAD') {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Status labels ────────────────────────────────────────────────────────────
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  en_cours: 'En cours',
  review: 'En révision',
  termine: 'Terminé',
  annule: 'Annulé',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-50 text-blue-700',
  review: 'bg-amber-50 text-amber-700',
  termine: 'bg-green-50 text-green-700',
  annule: 'bg-red-50 text-red-700',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  a_faire:  'À faire',
  en_cours: 'En cours',
  termine:  'Terminé',
  approuve: 'Approuvé',
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  a_faire:  'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-50  text-blue-700',
  termine:  'bg-green-50 text-green-700',
  approuve: 'bg-green-50 text-green-700',
}

export const PRIORITY_LABELS: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
}

export const PRIORITY_COLORS: Record<string, string> = {
  basse: 'text-gray-500',
  normale: 'text-blue-600',
  haute: 'text-amber-600',
  urgente: 'text-red-600',
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  prospect: 'Prospect',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  envoye: 'Envoyé',
  paye: 'Payé',
  en_retard: 'En retard',
  annule: 'Annulé',
}

export const MEMBER_INVOICE_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee:   'Envoyée',
  approuvee: 'Approuvée',
  payee:     'Payée',
}

export const MEMBER_INVOICE_STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100  text-gray-600',
  envoyee:   'bg-blue-50   text-blue-700',
  approuvee: 'bg-amber-50  text-amber-700',
  payee:     'bg-green-50  text-green-700',
}

export const BILLING_PERIOD_LABELS: Record<string, string> = {
  weekly:   'Hebdomadaire',
  biweekly: 'Aux 2 semaines',
  monthly:  'Mensuel',
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: 'Post',
  story: 'Story',
  reel: 'Reel',
  ad: 'Publicité',
  caption: 'Caption',
  script: 'Script',
  email: 'Email',
}

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  google: 'Google Ads',
  meta: 'Meta Ads',
}

// ─── Initials ─────────────────────────────────────────────────────────────────
export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── ID generation ────────────────────────────────────────────────────────────
export function generateId() {
  return Math.random().toString(36).substring(2, 11)
}

// ─── Durée (time tracking) ────────────────────────────────────────────────────
// Format compact "1h 23m" (ou "45m" sous l'heure, "0m" à zéro) — utilisé pour
// le chrono des tâches et les factures de membres.
export function formatDuration(totalSeconds: number) {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Format décimal "1.38" (heures) — utilisé pour les calculs de facturation
// horaire (heures × taux).
export function secondsToHours(totalSeconds: number) {
  return Math.round((totalSeconds / 3600) * 100) / 100
}

// Format complet "1h 23m 45s" (avec secondes) — utilisé pour l'affichage
// temps réel du chrono actif, contrairement à formatDuration (sans secondes)
// utilisé pour les totaux/historique.
export function formatDurationWithSeconds(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h === 0 && m === 0) return `${s}s`
  if (h === 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
