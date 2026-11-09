const $ = id => document.getElementById(id);
const SPACE = 'Lightricks/LTX-2.5';
let imageFile = null, previewUrl = null, job = null, cancelled = false, busy = false;
const presets = {
  hero: 'Luxury product film. Preserve the reference product shape, colors and label as closely as possible. Very slow camera push-in, soft lateral studio light, subtle realistic reflections. The product remains still. No additional objects or text.',
  macro: 'Macro beauty film of the reference product. Slow lateral camera movement reveals the material texture and soft reflections. Shallow depth of field, premium studio lighting. Keep the product shape and colors consistent. No added text.',
  fashion: 'Photorealistic fashion editorial. Preserve the reference outfit, colors and details. Natural subtle body movement, a soft breeze in the fabric, fixed camera and consistent lighting. No added text.'
};
function status(message, badge = 'PRÊT') { $('status').textContent = message; $('badge').textContent = badge; }
function setImage(file) {
  if (busy) return;
  if (file && (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024)) {
    $('image').value = ''; status('Choisis une image PNG, JPG ou WebP de moins de 15 Mo.', 'IMAGE À VÉRIFIER'); return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  imageFile = file || null; previewUrl = file ? URL.createObjectURL(file) : null;
  $('thumb').hidden = !file; $('upload-label').hidden = !!file; $('remove').hidden = !file;
  if (file) $('thumb').src = previewUrl; else { $('thumb').removeAttribute('src'); $('image').value = ''; }
}
$('image').addEventListener('change', e => setImage(e.target.files[0]));
$('remove').onclick = () => setImage(null);
for (const type of ['dragover', 'dragleave', 'drop']) $('drop').addEventListener(type, e => {
  e.preventDefault(); $('drop').classList.toggle('drag', type === 'dragover');
  if (type === 'drop') setImage(e.dataTransfer.files[0]);
});
document.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => { $('prompt').value = presets[button.dataset.preset]; });
$('embed').onclick = () => { $('frame').src = 'https://lightricks-ltx-2-5.hf.space'; $('frame').hidden = false; $('embed').hidden = true; };
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('prompt').value); $('copy').textContent = 'Prompt copié'; }
  catch { $('prompt').focus(); $('prompt').select(); status('Sélectionne et copie le prompt manuellement.'); }
};
function lock(value) {
  busy = value;
  for (const el of $('form').querySelectorAll('input,select,textarea,button')) el.disabled = value;
  $('cancel').disabled = false; $('cancel').hidden = !value;
  $('generate').textContent = value ? 'Génération en cours…' : 'Générer ma vidéo ↗';
}
$('cancel').onclick = async () => {
  cancelled = true; $('cancel').disabled = true;
  try { if (job) await job.cancel(); } catch { /* The stream may already be closed. */ }
  status('Annulation demandée. Le service peut terminer un calcul déjà lancé.', 'ANNULÉ');
};
$('form').addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  const prompt = $('prompt').value.trim(); if (!prompt) { $('prompt').focus(); return; }
  const seed = Number($('seed').value);
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) { status('Le seed doit être un entier entre 0 et 2147483647.'); return; }
  const [width,height] = $('format').value.split(',').map(Number);
  const parameters = {prompt,image_path:imageFile,height,width,duration_s:Number($('duration').value),seed,decoder:$('decoder').value,auto_len:false,randomize_seed:$('random').checked,do_enhance:$('enhance').checked};
  let token = $('token').value.trim();
  if (token && !token.startsWith('hf_')) { status('Le token Hugging Face doit commencer par hf_.'); return; }
  cancelled = false; lock(true); $('download').hidden = true; $('video').hidden = true; $('video').pause(); $('video').removeAttribute('src'); $('empty').hidden = false; $('result-meta').textContent = '';
  status('Connexion au service gratuit Hugging Face…', 'CONNEXION');
  let received = false;
  try {
    const {Client} = await import('https://cdn.jsdelivr.net/npm/@gradio/client@2.7.2/+esm');
    if (cancelled) return;
    const client = await Client.connect(SPACE, {events:['data','status'], ...(token ? {hf_token:token} : {})});
    token = ''; $('token').value = '';
    if (cancelled) return;
    job = client.submit('/run', parameters);
    status('Demande envoyée. En attente d’un GPU disponible…', 'EN ATTENTE');
    for await (const message of job) {
      if (cancelled) break;
      if (message.type === 'status') {
        if (message.stage === 'error') throw new Error(message.message || 'La génération a été refusée par Hugging Face.');
        const rank = Number.isFinite(message.position) ? ` Position : ${message.position + 1}.` : '';
        status(message.stage === 'pending' ? `Dans la file d’attente.${rank}` : 'Le modèle prépare ta vidéo…', 'EN COURS');
      }
      if (message.type === 'data') {
        const data = message.data;
        const file = data?.[0]?.video || data?.[0];
        const rawUrl = typeof file === 'string' ? file : file?.url;
        if (!rawUrl) throw new Error('Le service n’a pas renvoyé de lien vidéo exploitable.');
        const url = new URL(rawUrl, 'https://lightricks-ltx-2-5.hf.space');
        if (url.protocol !== 'https:' || !(url.hostname.endsWith('.hf.space') || url.hostname.endsWith('.huggingface.co') || url.hostname === 'huggingface.co')) throw new Error('Domaine du fichier vidéo inattendu.');
        $('video').src = url.href; $('video').hidden = false; $('empty').hidden = true;
        $('download').href = url.href; $('download').hidden = false;
        $('result-meta').textContent = `Seed : ${data[2] ?? seed} · Durée : ${data[3] ?? 'voir vidéo'}. Télécharge le résultat : le lien est temporaire.`;
        received = true; status('Ta vidéo est prête. Vérifie le rendu puis télécharge-la.', 'TERMINÉ');
      }
    }
    if (!received && !cancelled) throw new Error('La connexion s’est fermée sans vidéo. Réessaie ou ouvre la démo officielle.');
  } catch (error) {
    if (!cancelled) {
      const detail = String(error?.message || error).slice(0,500);
      status(`Génération indisponible : ${detail}. Si le quota est épuisé, attends son renouvellement. Pour une demande de connexion, utilise la démo officielle.`, 'INDISPONIBLE');
      $('fallback').open = true;
    }
  } finally {
    token = ''; $('token').value = ''; job = null; lock(false);
  }
});

