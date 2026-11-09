const byId = id => document.getElementById(id);
const refs = [], shots = [];
let busy = false, cancelled = false, job = null, filmUrl = null;
const uid = () => crypto.randomUUID();
const total = () => shots.reduce((sum, s) => sum + s.duration, 0);
const say = text => { byId('board-status').textContent = text; };
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function button(text, fn) { const b = el('button',text); b.type = 'button'; b.disabled = busy; b.onclick = fn; return b; }
function clearFilm() {
  if (filmUrl) URL.revokeObjectURL(filmUrl);
  filmUrl = null; byId('film').pause(); byId('film').removeAttribute('src'); byId('film').hidden = true; byId('film-download').hidden = true;
}
function invalidate(shot) {
  if (shot.url) URL.revokeObjectURL(shot.url);
  shot.url = null; shot.blob = null; shot.state = 'À générer'; clearFilm();
}
function lock(value) {
  busy = value;
  document.querySelectorAll('#storyboard input,#storyboard select,#storyboard textarea,#storyboard button').forEach(n => n.disabled = value);
  // Avoid simultaneous jobs in the quick generator and the storyboard.
  document.querySelectorAll('#form input,#form select,#form textarea,#form button').forEach(n => n.disabled = value);
  byId('board-cancel').hidden = !value; byId('board-cancel').disabled = false;
  renderShots();
}
function renderRefs() {
  const list = byId('reference-list'); list.replaceChildren();
  refs.forEach(ref => {
    const card = el('div',undefined,'reference-card');
    const img = document.createElement('img'); img.src = ref.url; img.alt = ref.name;
    card.append(img,el('p',ref.name),button('Retirer', () => {
      if (busy) return;
      refs.splice(refs.indexOf(ref),1); URL.revokeObjectURL(ref.url);
      shots.filter(s => s.ref === ref.id).forEach(s => { s.ref = ''; invalidate(s); });
      renderRefs(); renderShots();
    })); list.append(card);
  });
  byId('reference-count').textContent = `${refs.length}/12 références`;
}
function addRef(blob,name) {
  if (refs.length >= 12) throw new Error('Maximum 12 références. Retire une image pour en ajouter une autre.');
  refs.push({id:uid(),blob,name,url:URL.createObjectURL(blob)}); renderRefs(); renderShots();
}
byId('references').onchange = async e => {
  if (busy) return;
  const files = [...e.target.files]; e.target.value = '';
  for (const file of files) {
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 15*1024*1024) throw new Error(`${file.name} : PNG, JPG ou WebP, 15 Mo maximum.`);
      const img = await createImageBitmap(file); img.close();
      addRef(file,file.name);
    } catch (err) { say(err.message); }
  }
};
let sourceUrl = null;
byId('reference-video').onchange = e => {
  if (busy) return;
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  if (!file.type.startsWith('video/') || file.size > 100*1024*1024) { say('Choisis une vidéo lisible par ton navigateur, de moins de 100 Mo.'); return; }
  const video = byId('reference-player'); video.pause();
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file); video.src = sourceUrl; video.dataset.filename = file.name;
  video.hidden = false; byId('capture-frame').hidden = false; byId('capture-frame').disabled = true;
  video.onloadeddata = () => { byId('capture-frame').disabled = busy; say('Déplace le curseur de la vidéo puis capture une ou plusieurs images de référence.'); };
  video.onerror = () => { byId('capture-frame').disabled = true; say('Ce format vidéo ne peut pas être décodé. Essaie un MP4 H.264 ou un WebM.'); };
};
byId('capture-frame').onclick = async () => {
  if (busy) return;
  const video = byId('reference-player'); video.pause();
  try {
    if (video.readyState < 2 || video.seeking) throw new Error('Attends que cette image de la vidéo soit chargée.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1,1536/Math.max(video.videoWidth,video.videoHeight));
    canvas.width = Math.round(video.videoWidth*scale); canvas.height = Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.94));
    if (!blob) throw new Error('Impossible de capturer cette image.');
    addRef(blob,`${video.dataset.filename} · ${video.currentTime.toFixed(2)} s`);
    say('Image extraite ajoutée aux références. Sélectionne-la dans un plan.');
  } catch (err) { say(err.message); }
};
function newShot(duration = 3, prompt = '', ref = '') { return {id:uid(),duration,prompt,ref,blob:null,url:null,state:'À générer'}; }
function renderShots() {
  const list = byId('shots'); list.replaceChildren();
  shots.forEach((shot,index) => {
    const card = el('div',undefined,'shot-card');
    const top = el('div',undefined,'shot-top'); top.append(el('h3',`Plan ${index+1}`),el('span',shot.state,'hint'));
    card.append(top);
    const refLabel = el('label','Référence de ce plan'); const select = el('select'); select.id = `ref-${shot.id}`; refLabel.htmlFor = select.id;
    select.append(new Option('Sans image · texte uniquement',''));
    refs.forEach(r => select.append(new Option(r.name,r.id))); select.value = shot.ref;
    select.onchange = () => { shot.ref = select.value; invalidate(shot); renderShots(); };
    const ref = refs.find(r=>r.id===shot.ref);
    if (ref) { const thumb = document.createElement('img'); thumb.className='shot-thumb'; thumb.src=ref.url; thumb.alt=ref.name; card.append(thumb); }
    const label = el('label','Mouvement / action'); const text = el('textarea'); text.rows=3; text.maxLength=4000; text.value=shot.prompt; text.id=`prompt-${shot.id}`; label.htmlFor=text.id;
    text.placeholder='Décris le mouvement et la lumière de ce plan…';
    text.onchange = () => renderShots();
    text.oninput = () => { shot.prompt=text.value; invalidate(shot); top.lastChild.textContent=shot.state; updateSummary(); };
    const lengthLabel = el('label','Durée du plan'); const length = el('select'); length.id=`duration-${shot.id}`; lengthLabel.htmlFor=length.id;
    [1,2,3,4,5].forEach(n=>length.append(new Option(`${n} seconde${n>1?'s':''}`,String(n)))); length.value=String(shot.duration);
    length.onchange=()=>{const previous=shot.duration;shot.duration=Number(length.value);if(total()>15){shot.duration=previous;length.value=String(previous);say('Le film ne peut pas dépasser 15 secondes.');return;}invalidate(shot);renderShots();};
    card.append(refLabel,select,label,text,lengthLabel,length);
    const actions = el('div',undefined,'shot-actions');
    const up=button('↑',()=>{[shots[index-1],shots[index]]=[shots[index],shots[index-1]];clearFilm();renderShots();}); up.setAttribute('aria-label',`Monter le plan ${index+1}`); up.disabled=busy||index===0;
    const down=button('↓',()=>{[shots[index+1],shots[index]]=[shots[index],shots[index+1]];clearFilm();renderShots();}); down.setAttribute('aria-label',`Descendre le plan ${index+1}`); down.disabled=busy||index===shots.length-1;
    const remove=button('Supprimer',()=>{invalidate(shot);shots.splice(index,1);renderShots();});remove.disabled=busy||shots.length===1;
    actions.append(up,down,remove);
    if (shot.url) {
      const play=button('Voir le clip',()=>{byId('film').src=shot.url;byId('film').hidden=false;});
      const link=el('a','Télécharger le clip');link.href=shot.url;link.download=`plan-${index+1}.mp4`;
      const redo=button('Regénérer',()=>{invalidate(shot);renderShots();}); actions.append(play,link,redo);
    }
    card.append(actions); card.querySelectorAll('input,select,textarea').forEach(n=>n.disabled=busy); list.append(card);
  }); updateSummary();
}
function updateSummary() {
  const ready = shots.filter(s=>s.blob).length;
  byId('board-total').textContent = `${total()} / 15 s · ${shots.length} plan${shots.length>1?'s':''} · ${ready} prêt${ready>1?'s':''}`;
  byId('add-shot').disabled = busy || total()>=15 || shots.length>=8;
  byId('board-generate').disabled = busy || !shots.length || ready===shots.length;
  byId('board-export').disabled = busy || !shots.length || ready!==shots.length;
}
byId('add-shot').onclick=()=>{if(!busy&&total()<15&&shots.length<8){shots.push(newShot(Math.min(3,15-total())));clearFilm();renderShots();}};
byId('preset-15').onclick=()=>{
  if(busy)return;
  if(shots.some(s=>s.prompt.trim()||s.blob)&&!confirm('Remplacer les plans actuels par trois plans de 5 secondes ?'))return;
  shots.forEach(invalidate);shots.length=0;
  const prompts=[
    'Premium product hero shot. Very slow camera push-in. Soft lateral studio light, consistent product shape and colors. No added text.',
    'Close-up product detail. Slow lateral camera movement, subtle material reflections and shallow depth of field. Preserve the reference appearance. No added text.',
    'Elegant final product shot. Static camera, soft natural reflections, restrained movement. Preserve the product shape and colors. No added text.'
  ];prompts.forEach((p,i)=>shots.push(newShot(5,p,refs[i]?.id||refs[0]?.id||'')));renderShots();
};
for(const id of ['board-format','board-decoder','board-seed','board-random']) byId(id).onchange=()=>{shots.forEach(invalidate);renderShots();};
byId('board-cancel').onclick=async()=>{cancelled=true;try{if(job)await job.cancel();}catch{}say('Arrêt demandé. Les clips déjà reçus sont conservés tant que cet onglet reste ouvert.');};
function checkVideoUrl(raw) {
  const url=new URL(raw,'https://lightricks-ltx-2-5.hf.space');
  if(url.protocol!=='https:'||!(url.hostname.endsWith('.hf.space')||url.hostname==='huggingface.co'||url.hostname.endsWith('.huggingface.co')))throw new Error('Le service a renvoyé un domaine vidéo inattendu.');
  return url.href;
}
byId('board-generate').onclick=async()=>{
  if(busy)return;
  if(byId('generate').disabled){say('Attends la fin de la génération du clip rapide.');return;}
  if(shots.some(s=>!s.prompt.trim())){say('Ajoute un prompt dans chaque plan avant de générer.');return;}
  const seed=Number(byId('board-seed').value);
  if(!Number.isInteger(seed)||seed<0||seed>2147483647){say('Le seed doit être un entier entre 0 et 2147483647.');return;}
  let token=byId('board-token').value.trim();if(token&&!token.startsWith('hf_')){say('Le token doit commencer par hf_.');return;}
  const [width,height]=byId('board-format').value.split(',').map(Number);
  const decoder=byId('board-decoder').value,randomize_seed=byId('board-random').checked;
  cancelled=false;lock(true);say('Connexion à Hugging Face…');
  let current=null;
  try{
    const {Client}=await import('https://cdn.jsdelivr.net/npm/@gradio/client@2.7.2/+esm');
    const client=await Client.connect('Lightricks/LTX-2.5',{events:['data','status'],...(token?{hf_token:token}:{})});token='';byId('board-token').value='';
    for(let i=0;i<shots.length;i++){
      if(cancelled)break;const shot=shots[i];if(shot.blob)continue;current=shot;
      const reference=refs.find(r=>r.id===shot.ref);
      shot.state='En cours…';renderShots();say(`Plan ${i+1}/${shots.length} : attente du GPU puis génération…`);
      job=client.submit('/run',{prompt:shot.prompt.trim(),image_path:reference?.blob||null,height,width,duration_s:shot.duration,seed,decoder,auto_len:false,randomize_seed,do_enhance:false});
      let result=null;
      for await(const message of job){
        if(cancelled)break;
        if(message.type==='status'){if(message.stage==='error')throw new Error(message.message||'Génération refusée.');const rank=Number.isFinite(message.position)?` · position ${message.position+1}`:'';say(`Plan ${i+1}/${shots.length} : ${message.stage==='pending'?'file d’attente'+rank:'génération en cours'}…`);}
        if(message.type==='data')result=message.data;
      }
      job=null;if(cancelled){shot.state='À reprendre';break;}
      const file=result?.[0]?.video||result?.[0];const raw=typeof file==='string'?file:file?.url;
      if(!raw)throw new Error('Aucun fichier vidéo reçu.');
      const response=await fetch(checkVideoUrl(raw),{signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw new Error('Impossible de récupérer le clip. Réessaie ce plan.');
      const blob=await response.blob();if(!blob.size)throw new Error('Le clip reçu est vide.');
      shot.blob=blob;shot.url=URL.createObjectURL(blob);shot.state='Prêt';shot.seed=result[2];
      byId('film').src=shot.url;byId('film').hidden=false;renderShots();
    }
    say(cancelled?'Arrêté. Clique sur Générer / reprendre pour les plans restants.':'Tous les plans sont prêts. Clique sur Assembler et exporter pour obtenir ton film.');
  }catch(err){if(current&&!current.blob)current.state='À reprendre';say(`Génération interrompue : ${String(err.message||err).slice(0,350)}. Les clips terminés sont conservés dans cet onglet. Reprends après le renouvellement du quota, ou utilise la démo officielle.`);}
  finally{job=null;token='';byId('board-token').value='';lock(false);}
};
function loaded(video,url){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error('Chargement vidéo trop long.'));},30000);const cleanup=()=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;};video.onloadeddata=()=>{cleanup();resolve();};video.onerror=()=>{cleanup();reject(new Error('Impossible de décoder un clip.'));};video.src=url;video.load();});}
byId('board-export').onclick=async()=>{
  if(busy||shots.some(s=>!s.blob))return;
  if(document.hidden){say('Garde cet onglet visible pendant l’export.');return;}
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){say('L’assemblage est indisponible dans ce navigateur. Télécharge les clips séparément ou ouvre le site dans Chrome.');return;}
  const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime){say('Aucun format d’export compatible. Télécharge chaque clip.');return;}
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  let audio=null,recorder=null,stream=null,frame=0,recorderError=null;
  const videos=[],sources=[];let hiddenDuringExport=false;
  const visibility=()=>{if(document.hidden){hiddenDuringExport=true;cancelled=true;}};
  cancelled=false;clearFilm();lock(true);byId('film').pause();say('Préparation du montage avec le son des clips…');
  const canvas=byId('export-canvas');const [width,height]=byId('board-format').value.split(',').map(Number);canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  try{
    if(!AudioCtx)throw new Error('L’export audio est indisponible dans ce navigateur.');
    audio=new AudioCtx();await audio.resume();const destination=audio.createMediaStreamDestination();
    for(const shot of shots){const v=document.createElement('video');v.playsInline=true;v.preload='auto';videos.push(v);await loaded(v,shot.url);const source=audio.createMediaElementSource(v);source.connect(destination);sources.push(source);}
    if(cancelled)throw new Error('Export annulé.');
    document.addEventListener('visibilitychange',visibility);
    ctx.drawImage(videos[0],0,0,width,height);canvas.hidden=false;
    stream=canvas.captureStream(24);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    const chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onerror=e=>{recorderError=e.error||new Error('Erreur d’encodage.');};
    const stopped=new Promise(resolve=>recorder.onstop=resolve);
    recorder.start(200);
    for(let i=0;i<videos.length;i++){
      if(cancelled)break;const v=videos[i];if(i&&recorder.state==='paused')recorder.resume();
      say(`Assemblage du plan ${i+1}/${shots.length}… Garde cet onglet visible.`);
      await v.play();
      await new Promise((resolve,reject)=>{
        const deadline=performance.now()+30000;
        const draw=()=>{
          if(recorderError){reject(recorderError);return;}
          if(performance.now()>deadline){reject(new Error('Lecture du clip bloquée.'));return;}
          if(cancelled||v.ended||v.currentTime>=Math.min(shots[i].duration,v.duration)){v.pause();resolve();return;}
          ctx.drawImage(v,0,0,width,height);frame=requestAnimationFrame(draw);
        };frame=requestAnimationFrame(draw);
        // A hidden tab stops requestAnimationFrame: this timer ensures cancellation completes.
        const check=setInterval(()=>{if(cancelled){clearInterval(check);cancelAnimationFrame(frame);v.pause();resolve();}else if(v.paused||v.ended)clearInterval(check);},200);
      });
      if(i<videos.length-1&&recorder.state==='recording')recorder.pause();
    }
    if(recorder.state!=='inactive')recorder.stop();await stopped;
    if(cancelled)throw new Error(hiddenDuringExport?'Export interrompu car l’onglet a été masqué. Relance en gardant cette page visible.':'Export annulé. Les clips restent disponibles.');
    if(recorderError)throw recorderError;
    const blob=new Blob(chunks,{type:mime});if(!blob.size)throw new Error('Export vide.');
    filmUrl=URL.createObjectURL(blob);byId('film').src=filmUrl;byId('film').hidden=false;
    const link=byId('film-download');link.href=filmUrl;link.download=`dani-motion-${total()}s.${mime.startsWith('video/mp4')?'mp4':'webm'}`;link.hidden=false;link.textContent=`Télécharger le film (${mime.startsWith('video/mp4')?'MP4':'WebM'})`;
    say(`Film assemblé avec audio : environ ${total()} secondes. L’export en temps réel peut légèrement varier en durée. Télécharge-le avant de fermer cet onglet.`);
  }catch(err){say(`Export : ${err.message}. Les clips individuels restent téléchargeables.`);}
  finally{document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(frame);videos.forEach(v=>{v.pause();v.removeAttribute('src');v.load();});sources.forEach(s=>s.disconnect());if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop());if(audio)await audio.close();canvas.hidden=true;lock(false);}
};
shots.push(newShot(3));renderShots();renderRefs();
window.addEventListener('beforeunload',e=>{if(refs.length||shots.some(s=>s.blob)||busy){e.preventDefault();e.returnValue='';}});
