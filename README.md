# Dani Motion Studio

Interface web française pour la démo gratuite Lightricks/LTX-2.5 sur Hugging Face. Application statique, responsive, sans serveur ni installation pour l'utilisateur.

## Utilisation

Importez éventuellement un packshot, saisissez le prompt, choisissez le format et une durée de 2 à 5 secondes, puis générez. Trois suggestions de prompts sont incluses. La génération et l'audio dépendent du modèle externe. Les résultats ne sont pas simulés.

La démo officielle est également intégrée à la demande. Un lien externe reste disponible si les cookies ou la connexion ne fonctionnent pas dans l'iframe. Cette intégration ne synchronise pas les réglages du formulaire personnalisé.

## GitHub et mise en ligne

Placez `index.html`, `style.css` et `app.js` à la racine d'un dépôt. Pour un dépôt compatible avec GitHub Pages : Settings → Pages → Deploy from a branch → main → /(root) → Save. La disponibilité de Pages pour un dépôt privé dépend du plan GitHub. Ne rendez pas votre dépôt public sans le vouloir. Les mêmes trois fichiers peuvent être hébergés sur n'importe quel hébergement statique HTTPS.

## Connexion et limites

- API : `Lightricks/LTX-2.5`, endpoint `/run` via `@gradio/client` 2.7.2, importé depuis jsDelivr.
- Schéma vérifié le 8 novembre 2026 via `/gradio_api/info`. Aucun poids de modèle n'est inclus.
- ZeroGPU impose des quotas et une file d'attente. La gratuité et la disponibilité sont gérées par Hugging Face et l'auteur du Space, pas par cette interface.
- Le formulaire essaie l'API publique. Une session ouverte sur huggingface.co n'authentifie pas automatiquement cet appel. Si nécessaire, le champ facultatif accepte un token Hugging Face personnel conservé uniquement en mémoire ; sinon utilisez la démo officielle.
- Les images et prompts sont envoyés au Space lors d'une génération. Aucun stockage de token, d'image ou de vidéo dans GitHub ou localStorage.
- Le lien vidéo peut expirer : téléchargez vos résultats.
- Le modèle peut altérer les textes, les logos ou la géométrie ; la fidélité exacte n'est pas garantie.
- Le Space peut changer son API. Les erreurs sont affichées et l'accès officiel reste proposé.

## Validation

Syntaxe JavaScript et cohérence des paramètres vérifiées. Le schéma API a été obtenu depuis le service réel. Une génération complète avec quota utilisateur et le comportement visuel dans un navigateur restent à valider après hébergement.
