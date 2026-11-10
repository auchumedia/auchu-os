import LegalPage from '@/components/legal/LegalPage'

export const metadata = { title: "Conditions d'utilisation" }

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="9 novembre 2026">
      <section>
        <h2 className="font-semibold text-gray-900 mb-2">1. Objet</h2>
        <p>
          AuchuOS est un outil interne privé développé pour l'usage exclusif de l'équipe
          AuchuMedia et de ses clients, via le portail qui leur est dédié. Il n'est pas destiné à
          un usage public.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">2. Accès</h2>
        <p>
          L'accès à AuchuOS se fait uniquement sur invitation d'un membre autorisé d'AuchuMedia.
          Vous êtes responsable de la confidentialité de vos identifiants de connexion ainsi que
          de toute activité effectuée sous votre compte.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">3. Responsabilités de l'utilisateur</h2>
        <p>
          Vous vous engagez à utiliser AuchuOS de façon raisonnable, à ne pas tenter d'accéder à
          des renseignements qui ne vous sont pas destinés, et à nous signaler sans délai toute
          utilisation non autorisée de votre compte dont vous auriez connaissance.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">4. Disponibilité</h2>
        <p>
          AuchuOS est fourni « tel quel », sans garantie de disponibilité continue ni d'absence
          d'erreurs. Des interruptions de service peuvent survenir, notamment lors de mises à jour
          ou de maintenance.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">5. Droit applicable</h2>
        <p>
          Les présentes conditions sont régies par les lois applicables dans la province de
          Québec et au Canada.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">6. Contact</h2>
        <p>
          Pour toute question concernant ces conditions, écrivez à{' '}
          <a href="mailto:raphael@auchumedia.com" className="text-auchu-600 hover:underline">
            raphael@auchumedia.com
          </a>.
        </p>
      </section>
    </LegalPage>
  )
}
