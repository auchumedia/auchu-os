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
export type OrgRole = 'owner' | 'director' | 'chef_equipe' | 'stratege' | 'monteur'

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
  id:             string
  org_id:         string
  code:           string
  role:           Exclude<OrgRole, 'owner'>
  team_id:        string | null
  invited_by:     string | null
  invited_name:   string | null
  invited_email:  string | null
  expires_at:     string
  used_at:        string | null
  used_by:        string | null
  created_at:     string
}

// ─── Équipes ──────────────────────────────────────────────────────────────────
export interface Team {
  id:         string
  org_id:     string
  name:       string
  chef_id:    string
  created_at: string
  updated_at: string
}

export interface TeamMembership {
  id:        string
  team_id:   string
  user_id:   string
  role:      Extract<OrgRole, 'chef_equipe' | 'stratege' | 'monteur'>
  joined_at: string
}

export interface TeamClient {
  id:          string
  team_id:     string
  client_id:   string
  assigned_at: string
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
  deliverables_video_organique: number
  deliverables_story: number
  deliverables_ad: number
  link_instagram: string | null
  link_facebook: string | null
  link_tiktok: string | null
  link_linkedin: string | null
  created_at: string
  updated_at: string
}

// ─── Accès plateformes (sensible — owner/director uniquement) ────────────────
export interface ClientPlatformAccess {
  id: string
  client_id: string
  instagram_email: string | null
  instagram_password: string | null
  facebook_email: string | null
  facebook_password: string | null
  tiktok_email: string | null
  tiktok_password: string | null
  linkedin_email: string | null
  linkedin_password: string | null
  notes: string | null
  updated_at: string
}

// ─── Documents client ─────────────────────────────────────────────────────────
export interface ClientDocument {
  id: string
  client_id: string
  name: string
  storage_path: string
  file_size: number | null
  created_at: string
  url?: string | null
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
export type ContentType = 'post' | 'reel' | 'story' | 'script_video' | 'ad' | 'caption' | 'script' | 'email' | 'video_organique'
export type ContentStatus = 'idee' | 'en_redaction' | 'pret' | 'approuve' | 'refuse' | 'draft' | 'review' | 'publie'
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'google' | 'meta' | 'toutes'

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
  position: number
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

// ─── Tâches ───────────────────────────────────────────────────────────────────
export type TaskPriority = 'basse' | 'normale' | 'haute' | 'urgente'
export type TaskStatus = 'a_faire' | 'en_cours' | 'termine'

export interface Task {
  id: string
  user_id: string
  client_id: string | null
  title: string
  description: string | null
  assigned_to: string | null
  assigned_by: string
  priority: TaskPriority
  status: TaskStatus
  deadline: string | null
  created_at: string
  updated_at: string
  client?: Pick<Client, 'id' | 'name' | 'company'> | null
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
