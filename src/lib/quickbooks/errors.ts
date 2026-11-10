// Jeté quand le refresh token QuickBooks est expiré/révoqué (invalid_grant)
// ou qu'aucune connexion n'existe — le code appelant doit marquer la
// connexion "reconnect_required" et laisser l'UI afficher le bouton
// "Reconnecter", jamais planter la page.
export class QuickBooksReconnectRequiredError extends Error {
  constructor(message = 'QuickBooks doit être reconnecté') {
    super(message)
    this.name = 'QuickBooksReconnectRequiredError'
  }
}

export class QuickBooksNotConnectedError extends Error {
  constructor(message = 'QuickBooks n\'est pas connecté') {
    super(message)
    this.name = 'QuickBooksNotConnectedError'
  }
}
