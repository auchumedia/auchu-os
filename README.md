# AuchuOS — Plateforme agence tout-en-un

Plateforme SaaS pour agences de contenu, ads et gestion de médias sociaux. Remplace Notion, QuickBooks et les outils de scheduling avec des agents IA intégrés.

## Stack

- **Frontend** — Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Base de données** — Supabase (PostgreSQL + Auth + RLS)
- **IA** — Claude API (Anthropic) via SDK
- **Déploiement** — Vercel

## Démarrage rapide

### 1. Clone et installe

```bash
git clone https://github.com/TON-USER/auchu-os.git
cd auchu-os
npm install
```

### 2. Configure les variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplis `.env.local` avec :
- **Supabase** → [supabase.com](https://supabase.com) → ton projet → Settings → API
- **Anthropic** → [console.anthropic.com](https://console.anthropic.com) → API Keys

### 3. Initialise la base de données

Dans le dashboard Supabase → SQL Editor, colle et exécute le fichier :
```
supabase/migrations/001_initial_schema.sql
```

### 4. Lance en développement

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000)

---

## Déploiement sur Vercel

1. Push sur GitHub
2. Importe le repo sur [vercel.com](https://vercel.com)
3. Ajoute les variables d'environnement dans Vercel → Settings → Environment Variables
4. Deploy !

---

## Structure du projet

```
src/
├── app/
│   ├── auth/           # Login + Signup
│   ├── dashboard/      # CRM, Projets, Contenu, Finance
│   ├── agents/         # Agent contenu IA + Agent productivité
│   └── api/            # Routes API (agents, clients, projets)
├── components/
│   ├── layout/         # Sidebar, Header
│   ├── ui/             # Boutons, Inputs, Cards réutilisables
│   └── agents/         # Composants agents IA
├── lib/
│   ├── supabase/       # Client browser + serveur
│   ├── anthropic.ts    # Client IA + system prompts
│   └── utils.ts        # Helpers, formatters, cn()
└── types/              # TypeScript types complets
```

## Modules inclus

| Module | Description |
|--------|-------------|
| CRM Clients | Fiches clients, statut, budget, plateformes |
| Projets | Kanban, deadlines, priorités |
| Contenu | Calendrier éditorial, statuts d'approbation |
| Finance | Factures, suivi des paiements |
| Agent contenu IA | Posts, ads, captions, scripts, emails |
| Agent productivité IA | Plan de journée intelligent selon livrables |

---

Développé par AuchuMedia
