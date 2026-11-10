import LegalPage from '@/components/legal/LegalPage'

export const metadata = { title: 'Politique de confidentialité' }

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="9 novembre 2026">
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">1. À propos d'AuchuOS</h2>
        <p>
          AuchuOS est l'outil interne de gestion d'AuchuMedia, une agence basée au Québec, Canada.
          Il est utilisé exclusivement par les membres de l'équipe AuchuMedia pour gérer leurs
          contacts, projets et contenus, ainsi que par les clients d'AuchuMedia via un portail qui
          leur est dédié. AuchuOS n'est pas un produit public et n'est pas offert à d'autres
          entreprises.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">2. Renseignements que nous traitons</h2>
        <p>
          Selon votre rôle, AuchuOS traite vos informations de compte (nom, courriel), les
          renseignements des contacts et clients de l'agence (coordonnées, contenus, projets,
          tâches), le temps travaillé et, pour les propriétaires et directeurs, les données
          financières de l'agence (revenus, dépenses).
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">3. Hébergement des données</h2>
        <p>
          Les données d'AuchuOS sont hébergées chez <strong>Vercel</strong> (infrastructure
          applicative) et <strong>Supabase</strong> (base de données et authentification).
          AuchuMedia s'assure que ces fournisseurs offrent des garanties de protection adéquates
          pour les renseignements qui y sont confiés.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">4. Connexion à QuickBooks Online</h2>
        <p>
          AuchuOS peut se connecter à QuickBooks Online afin d'afficher les revenus et les
          dépenses de l'agence. Cette connexion est <strong>en lecture seule</strong> : AuchuOS
          consulte les factures, les achats et les dépenses déjà enregistrés dans QuickBooks, sans
          jamais créer, modifier ou supprimer quoi que ce soit dans votre compte QuickBooks.
        </p>
        <p className="mt-2">
          Les jetons d'accès utilisés pour cette connexion sont chiffrés et ne sont jamais partagés
          avec un tiers. Vous pouvez déconnecter QuickBooks à tout moment depuis les paramètres
          d'AuchuOS.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">5. Partage des données</h2>
        <p>
          AuchuMedia ne vend aucune donnée et ne partage aucun renseignement personnel ou financier
          avec des tiers, à l'exception des fournisseurs d'hébergement mentionnés ci-dessus,
          strictement nécessaires au fonctionnement d'AuchuOS.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">6. Sécurité</h2>
        <p>
          Nous appliquons des mesures raisonnables pour protéger vos renseignements : chiffrement
          des jetons d'accès, accès restreint selon votre rôle dans l'agence, et hébergement chez
          des fournisseurs reconnus.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">7. Vos droits</h2>
        <p>
          Conformément à la <strong>Loi 25</strong> du Québec sur la protection des renseignements
          personnels, vous pouvez à tout moment demander l'accès à vos renseignements, leur
          correction ou leur suppression, et déconnecter l'intégration QuickBooks. Pour exercer ces
          droits, écrivez-nous à l'adresse ci-dessous.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">8. Modifications</h2>
        <p>
          Cette politique peut être mise à jour pour refléter des changements dans nos pratiques ou
          nos obligations légales. La date de la dernière mise à jour apparaît en haut de cette
          page.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">9. Contact</h2>
        <p>
          Pour toute question concernant cette politique ou vos renseignements personnels, écrivez
          à{' '}
          <a href="mailto:raphael@auchumedia.com" className="text-auchu-600 hover:underline">
            raphael@auchumedia.com
          </a>.
        </p>
      </section>
    </LegalPage>
  )
}
