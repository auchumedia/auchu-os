'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, User, Loader2, Check, Mail, Phone,
  MapPin, Palette, Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgSettingsData {
  id:               string
  name:             string
  logo_url:         string | null
  primary_color:    string | null
  secondary_color:  string | null
  email:            string | null
  phone:            string | null
  address_street:   string | null
  address_city:     string | null
  address_province: string | null
  address_postal:   string | null
  address_country:  string | null
  website:          string | null
}

export interface ProfileSettingsData {
  full_name:  string | null
  email:      string | null
  avatar_url: string | null
  title:      string | null
}

interface Props {
  userId:  string
  isOwner: boolean
  org:     OrgSettingsData | null
  profile: ProfileSettingsData
}

// ─── Color swatch picker ──────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange }: {
  label:    string
  value:    string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className="label mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-auchu-300 transition-colors bg-white group w-full"
      >
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 border border-white shadow-sm ring-1 ring-gray-200 group-hover:scale-105 transition-transform"
          style={{ background: value }}
        />
        <span className="text-sm font-mono text-gray-700 flex-1 text-left">{value}</span>
        <Palette className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>
      <input
        ref={ref}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  )
}

// ─── Avatar upload zone ───────────────────────────────────────────────────────

function AvatarZone({
  url, initials, onClick, uploading, shape = 'circle',
}: {
  url:       string
  initials:  string
  onClick:   () => void
  uploading: boolean
  shape?:    'circle' | 'rounded'
}) {
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      aria-label="Changer la photo"
      className={cn(
        'relative w-20 h-20 flex-shrink-0 group overflow-hidden cursor-pointer',
        'bg-auchu-50 flex items-center justify-center',
        'border-2 border-dashed border-auchu-200 hover:border-auchu-400 transition-colors',
        shapeClass,
      )}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-auchu-700 font-bold text-xl select-none">{initials}</span>
      )}
      <div className={cn(
        'absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity',
        'opacity-0 group-hover:opacity-100',
        shapeClass,
      )}>
        {uploading
          ? <Loader2 className="w-5 h-5 text-white animate-spin" />
          : <Camera className="w-5 h-5 text-white" />
        }
      </div>
    </button>
  )
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveButton({ section, saving, saved, onClick }: {
  section: 'org' | 'profile'
  saving:  'org' | 'profile' | null
  saved:   'org' | 'profile' | null
  onClick: () => void
}) {
  const isLoading = saving === section
  const isDone    = saved  === section
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!saving}
      className={cn(
        'btn-primary disabled:opacity-60 transition-all min-w-[130px] justify-center',
        isDone && 'bg-green-600 hover:bg-green-700',
      )}
    >
      {isLoading ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
      ) : isDone ? (
        <><Check className="w-4 h-4" /> Sauvegardé !</>
      ) : (
        'Sauvegarder'
      )}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsClient({ userId, isOwner, org, profile }: Props) {

  // ── Org form ─────────────────────────────────────────────────────────────────
  const [orgForm, setOrgForm] = useState({
    name:             org?.name             ?? '',
    logo_url:         org?.logo_url         ?? '',
    primary_color:    org?.primary_color    ?? '#4f46e5',
    secondary_color:  org?.secondary_color  ?? '#7c3aed',
    email:            org?.email            ?? '',
    phone:            org?.phone            ?? '',
    address_street:   org?.address_street   ?? '',
    address_city:     org?.address_city     ?? '',
    address_province: org?.address_province ?? '',
    address_postal:   org?.address_postal   ?? '',
    address_country:  org?.address_country  ?? 'Canada',
    website:          org?.website          ?? '',
  })

  // ── Profile form ──────────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    full_name:  profile.full_name  ?? '',
    avatar_url: profile.avatar_url ?? '',
    title:      profile.title      ?? '',
  })

  const [saving,    setSaving]    = useState<'org' | 'profile' | null>(null)
  const [saved,     setSaved]     = useState<'org' | 'profile' | null>(null)
  const [uploading, setUploading] = useState<'logo' | 'avatar' | null>(null)
  const [orgError,  setOrgError]  = useState<string | null>(null)
  const [profError, setProfError] = useState<string | null>(null)

  const logoRef   = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  // Helpers
  const setOrg  = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setOrgForm(f => ({ ...f, [k]: e.target.value }))
  const setProf = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfileForm(f => ({ ...f, [k]: e.target.value }))

  // ── Upload ────────────────────────────────────────────────────────────────────
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const supabase = createClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${folder}_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('org-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) { console.error('[upload]', error); return null }
    return supabase.storage.from('org-assets').getPublicUrl(path).data.publicUrl
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading('logo')
    const url = await uploadFile(file, 'logo')
    if (url) setOrgForm(f => ({ ...f, logo_url: url }))
    setUploading(null)
    if (logoRef.current) logoRef.current.value = ''
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading('avatar')
    const url = await uploadFile(file, 'avatar')
    if (url) setProfileForm(f => ({ ...f, avatar_url: url }))
    setUploading(null)
    if (avatarRef.current) avatarRef.current.value = ''
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const flash = (section: 'org' | 'profile') => {
    setSaved(section)
    setTimeout(() => setSaved(null), 2500)
  }

  const saveOrg = async () => {
    setSaving('org'); setOrgError(null)
    const res = await fetch('/api/settings/org', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(orgForm),
    })
    setSaving(null)
    if (res.ok) { flash('org') } else {
      const j = await res.json()
      setOrgError(j.error ?? 'Erreur de sauvegarde')
    }
  }

  const saveProfile = async () => {
    setSaving('profile'); setProfError(null)
    const res = await fetch('/api/settings/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(profileForm),
    })
    setSaving(null)
    if (res.ok) { flash('profile') } else {
      const j = await res.json()
      setProfError(j.error ?? 'Erreur de sauvegarde')
    }
  }

  const orgInitials     = orgForm.name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ORG'
  const profileInitial  = (profileForm.full_name || profile.email || 'U').charAt(0).toUpperCase()

  return (
    <div className="space-y-8">

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION ORGANISATION
      ══════════════════════════════════════════════════════════════════════ */}
      {isOwner && org && (
        <section className="card space-y-6">

          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-auchu-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-auchu-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Mon organisation</h2>
          </div>

          {/* Logo + nom */}
          <div className="flex items-start gap-5">
            <div>
              <AvatarZone
                url={orgForm.logo_url}
                initials={orgInitials}
                onClick={() => logoRef.current?.click()}
                uploading={uploading === 'logo'}
                shape="rounded"
              />
              <input
                ref={logoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="sr-only"
                onChange={handleLogoUpload}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="label">Nom de l'organisation</label>
              <input
                className="input"
                value={orgForm.name}
                onChange={setOrg('name')}
                placeholder="Auchu Média"
              />
              <p className="text-xs text-gray-400 mt-1">
                Cliquez sur le logo pour le remplacer (JPEG, PNG ou SVG · max 5 Mo)
              </p>
            </div>
          </div>

          {/* Couleurs */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Identité visuelle
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorPicker
                label="Couleur principale"
                value={orgForm.primary_color}
                onChange={v => setOrgForm(f => ({ ...f, primary_color: v }))}
              />
              <ColorPicker
                label="Couleur secondaire"
                value={orgForm.secondary_color}
                onChange={v => setOrgForm(f => ({ ...f, secondary_color: v }))}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Utilisées dans les emails d'invitation, les factures et le portail client.
            </p>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Contact
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Email de contact</label>
                  <input
                    className="input"
                    type="email"
                    value={orgForm.email}
                    onChange={setOrg('email')}
                    placeholder="bonjour@agence.com"
                  />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input
                    className="input"
                    type="tel"
                    value={orgForm.phone}
                    onChange={setOrg('phone')}
                    placeholder="+1 (514) 000-0000"
                  />
                </div>
              </div>
              <div>
                <label className="label">Site web</label>
                <input
                  className="input"
                  type="url"
                  value={orgForm.website}
                  onChange={setOrg('website')}
                  placeholder="https://agence.com"
                />
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Adresse
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Rue</label>
                <input
                  className="input"
                  value={orgForm.address_street}
                  onChange={setOrg('address_street')}
                  placeholder="123 rue Principale"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ville</label>
                  <input
                    className="input"
                    value={orgForm.address_city}
                    onChange={setOrg('address_city')}
                    placeholder="Montréal"
                  />
                </div>
                <div>
                  <label className="label">Province</label>
                  <input
                    className="input"
                    value={orgForm.address_province}
                    onChange={setOrg('address_province')}
                    placeholder="QC"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Code postal</label>
                  <input
                    className="input"
                    value={orgForm.address_postal}
                    onChange={setOrg('address_postal')}
                    placeholder="H2X 1Y6"
                  />
                </div>
                <div>
                  <label className="label">Pays</label>
                  <input
                    className="input"
                    value={orgForm.address_country}
                    onChange={setOrg('address_country')}
                    placeholder="Canada"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Erreur + Save */}
          {orgError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {orgError}
            </p>
          )}
          <div className="pt-2 border-t border-gray-100">
            <SaveButton section="org" saving={saving} saved={saved} onClick={saveOrg} />
          </div>

        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION MON PROFIL
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="card space-y-6">

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-auchu-100 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-auchu-600" />
          </div>
          <h2 className="font-semibold text-gray-900">Mon profil</h2>
        </div>

        {/* Avatar + résumé */}
        <div className="flex items-center gap-5">
          <div>
            <AvatarZone
              url={profileForm.avatar_url}
              initials={profileInitial}
              onClick={() => avatarRef.current?.click()}
              uploading={uploading === 'avatar'}
              shape="circle"
            />
            <input
              ref={avatarRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {profileForm.full_name || 'Votre nom'}
            </p>
            {profileForm.title && (
              <p className="text-sm text-gray-500 truncate">{profileForm.title}</p>
            )}
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              Cliquez sur la photo pour la changer (max 5 Mo)
            </p>
          </div>
        </div>

        {/* Champs */}
        <div className="space-y-3">
          <div>
            <label className="label">Nom complet</label>
            <input
              className="input"
              value={profileForm.full_name}
              onChange={setProf('full_name')}
              placeholder="Samuel Martin"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input bg-gray-50 cursor-not-allowed"
              value={profile.email ?? ''}
              readOnly
              disabled
            />
            <p className="text-xs text-gray-400 mt-1">
              Modifiable uniquement via les paramètres Supabase Auth.
            </p>
          </div>
          <div>
            <label className="label">Titre / Poste</label>
            <input
              className="input"
              value={profileForm.title}
              onChange={setProf('title')}
              placeholder="Directeur, Fondateur, Designer créatif…"
            />
          </div>
        </div>

        {/* Erreur + Save */}
        {profError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {profError}
          </p>
        )}
        <div className="pt-2 border-t border-gray-100">
          <SaveButton section="profile" saving={saving} saved={saved} onClick={saveProfile} />
        </div>

      </section>
    </div>
  )
}
