/* DIVIDUAL remote storage and public archive. No Firebase. */
(() => {
  'use strict';
  const config = window.DIVIDUAL_CONFIG;
  const liveMode = true;
  const voiceId = id => 'VOICE ' + String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  const validate = answers => {
    if (!Array.isArray(answers) || answers.length !== 3 || answers.some(x => typeof x !== 'string' || !x.trim() || x.trim().length > 72)) throw new Error('Complete all three fragments.');
    return answers.map(x => x.trim());
  };
  async function request(path, options = {}) {
    const result = await fetch(path, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
    let data = {};
    try { data = await result.json(); } catch { /* handled below */ }
    if (!result.ok) throw new Error(data.error || 'Connection interrupted. Please try again.');
    return data;
  }
  async function submit(answers) {
    const data = await request('/api/share', { method:'POST', body:JSON.stringify({visibility:'public',answers:validate(answers)}) });
    return { id:data.id };
  }
  async function sharePrivate() {
    // Intentionally send NO answers. The visitor's poem remains on this phone only.
    return request('/api/share', { method:'POST', body:JSON.stringify({visibility:'private'}) });
  }
  function appendVerse(element, template, answer, placeholder='[your words]') {
    element.textContent = '';
    const parts = String(template).split('{blank}');
    element.append(document.createTextNode(parts[0] || ''));
    const mark = document.createElement('span');
    mark.className = answer ? 'filled' : 'empty';
    mark.textContent = answer || placeholder;
    element.append(mark, document.createTextNode(parts.slice(1).join('{blank}')));
  }
  function renderPoem(parent, answers) {
    parent.replaceChildren();
    config.poems.forEach((p,i) => {
      const sec = document.createElement('section'); sec.className='stanza';
      const head = document.createElement('div'); head.className='stanza-title'; head.textContent=p.label;
      const verse = document.createElement('div'); verse.className='verse';
      appendVerse(verse,p.template,answers[i]||'');
      sec.append(head,verse); parent.append(sec);
    });
  }
  async function watchPoems(onPoems, onError = () => {}) {
    let stopped=false;
    let last='';
    const refresh=async()=>{
      try {
        const data=await request('/api/archive');
        if (stopped) return;
        const marker=JSON.stringify(data.poems.map(p=>p.id));
        if (marker !== last) { last=marker; onPoems(data.poems); }
      } catch (e) { if (!stopped) onError(e); }
    };
    await refresh();
    const interval=setInterval(refresh,6000);
    document.addEventListener('visibilitychange', refresh);
    return ()=>{stopped=true;clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
  }
  window.Dividual={config,liveMode,voiceId,validate,submit,sharePrivate,appendVerse,renderPoem,watchPoems};
})();
