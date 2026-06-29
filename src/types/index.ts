// ─── Auth ───────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  agency_name: string | null
  role: 'owner' | 'manager' | 'employee'
  created_at: string
}

// ─── Organisation & équipe ────────────────────────────────────────────────────
export type OrgPlan = 'free' | 'starter' | 'agence' | 'pro'
export type OrgRole = 'owner' | 'manager' | 'partner' | 'editor' | 'viewer'

export interface Organization {
  id: string
  name: string
  owner_id: string
  plan: OrgPlan
  max_members: number
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  status: 'actif' | 'inactif'
  joined_at: string
  profile?: { full_name: string | null; email: string | null; avatar_url: string | null }
}

export interface Invitation {
  id: string
  org_id: string
  code: string
  role: Exclude<OrgRole, 'owner'>
  invited_by: string | null
  expires_at: string
  used_at: string | null
  used_by: string | null
  created_at: string
}


export interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  industry: string | null
  status: 'actif' | 'inactif' | 'prospect'
  monthly_budget: number | null
  brand_tone: string | null
  brand_notes: string | null
  internal_notes: string | null
  platforms: string[]
  logo_url: string | null
  brand_primary: string
  brand_secondary: string
  portal_token: string | null
  portal_enabled: boolean
  assigned_partner: string | null
  created_at: string
  updated_at: string
}

// ─── Projets ─────────────────────────────────────────────────────────────────
export type ProjectStatus = 'todo' | 'en_cours' | 'review' | 'termine' | 'annule'
export type ProjectPriority = 'basse' | 'normale' | 'haute' | 'urgente'

export interface Project {
  id: string
  client_id: string
  user_id: string
  title: string
  description: string | null
  status: ProjectStatus
  priority: ProjectPriority
  deadline: string | null
  assigned_to: string | null
  tags: string[]
  created_at: string
  updated_at: string
  client?: Client
}

// ─── Contenu ──────────────────────────────────────────────────────────────────
export type ContentType = 'post' | 'reel' | 'story' | 'script_video' | 'ad' | 'caption' | 'script' | 'email'
export type ContentStatus = 'idee' | 'en_redaction' | 'pret' | 'approuve' | 'refuse' | 'draft' | 'review' | 'publie'
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'google' | 'meta'

export interface ContentPiece {
  id: string
  client_id: string
  project_id: string | null
  user_id: string
  title: string
  type: ContentType
  platform: Platform
  status: ContentStatus
  body: string | null
  description: string | null
  script: string | null
  assigned_to: string | null
  client_notes:    string | null
  reference_links: ReferenceLink[]
  variants:        ContentVariant[]
  scheduled_at: string | null
  published_at: string | null
  ai_generated: boolean
  created_at: string
  updated_at: string
  client?: Client
}

export interface ContentVariant {
  id: string
  label: string
  body: string
}

export interface ReferenceLink {
  url:      string
  title:    string
  platform: string
}

// ─── Calendrier d'événements ──────────────────────────────────────────────────
export type CalendarEventType = 'tournage' | 'publication' | 'reunion' | 'deadline'

export interface CalendarEvent {
  id: string
  user_id: string
  client_id: string | null
  type: CalendarEventType
  title: string
  date: string
  location: string | null
  participants: string[] | null
  platform: string | null
  content_piece_id: string | null
  notes: string | null
  created_at: string
}

// ─── Équipe ───────────────────────────────────────────────────────────────────
export interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string
  role: string
  avatar_url: string | null
  status: 'actif' | 'inactif'
  hourly_rate: number | null
  created_at: string
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'envoye' | 'paye' | 'en_retard' | 'annule'

export interface Invoice {
  id: string
  client_id: string | null
  user_id: string
  invoice_number: string
  status: InvoiceStatus
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tps_amount: number
  tvq_amount: number
  tax_amount: number
  total: number
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  client?: Client | null
}

export interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

// ─── Dépenses ─────────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'logiciels' | 'publicite' | 'equipement' | 'deplacements'
  | 'formation' | 'services' | 'loyer' | 'telephone' | 'autre'

export interface Expense {
  id: string
  user_id: string
  client_id: string | null
  title: string
  amount: number
  category: ExpenseCategory
  date: string
  notes: string | null
  created_at: string
  client?: Pick<Client, 'id' | 'name'> | null
}

// ─── Agents IA ────────────────────────────────────────────────────────────────
export type AgentMode = 'social' | 'ads' | 'caption' | 'script' | 'email'

export interface AgentContentRequest {
  client_id?: string
  client_name: string
  brief: string
  tone: string
  platform: Platform | string
  mode: AgentMode
  language: 'fr' | 'en' | 'bilingual'
}

export interface AgentContentResponse {
  variants: { label: string; body: string }[]
  mode: AgentMode
  tokens_used: number
}

export interface DayTask {
  heure: string
  duree: string
  titre: string
  client: string
  detail: string
  priorite: 'haute' | 'moyenne' | 'basse'
  type: 'creation' | 'admin' | 'reunion' | 'review' | 'pause'
}

export interface DayPlan {
  stats: { clients: number; blocs: number; heures_focus: number }
  blocs: DayTask[]
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  clients_actifs: number
  projets_en_cours: number
  contenu_cette_semaine: number
  revenue_mois: number
  factures_en_attente: number
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}
