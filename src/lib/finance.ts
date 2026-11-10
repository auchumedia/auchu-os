// Catégories de dépenses — partagées entre l'API (/api/finance/depenses,
// validation) et l'UI (sélecteur du formulaire "+ Dépense", bulles par
// catégorie). Garder cette liste comme unique source de vérité.
export const EXPENSE_CATEGORIES = [
  'Logiciels', 'Sous-traitants', 'Matériel', 'Publicité', 'Déplacements', 'Bureau', 'Taxes', 'Autre',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
