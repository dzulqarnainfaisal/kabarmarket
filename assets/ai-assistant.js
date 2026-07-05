/* =====================================================================
   Kabar Market - Asisten Edukasi (widget chat AI)
   ---------------------------------------------------------------------
   Widget ini menyuntik dirinya sendiri ke halaman. Cukup sertakan satu
   baris <script src="assets/ai-assistant.js" defer></script> di tiap halaman.

   >>> WAJIB DIISI: alamat Cloudflare Worker kamu (lihat worker/README-DEPLOY.md)
   Setelah men-deploy Worker, ganti nilai di bawah dengan URL Worker-mu,
   contoh: 'https://km-ai-worker.namakamu.workers.dev'
   ===================================================================== */
(function () {
  'use strict';
  var WORKER_URL = window.KM_AI_ENDPOINT || 'https://km-ai-worker.GANTI-SUBDOMAIN.workers.dev';
  var CONFIGURED = WORKER_URL.indexOf('GANTI-SUBDOMAIN') === -1;

  // Jangan tampilkan dua kali
  if (window.__KM_AI_LOADED) return;
  window.__KM_AI_LOADED = true;

  var messages = []; // riwayat percakapan {role, content}
  var busy = false;

  /* ---------- Gaya ---------- */
  var css = ''
    + '#kmai-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:9px;'
    +   'background:var(--gold,#E7A33E);color:#1a1204;border:none;border-radius:999px;padding:12px 18px;'
    +   'font-family:Inter,sans-serif;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);'
    +   'transition:transform .15s ease, box-shadow .15s ease;}'
    + '#kmai-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.45);}'
    + '#kmai-fab svg{width:20px;height:20px;}'
    + '#kmai-panel{position:fixed;right:20px;bottom:84px;z-index:9999;width:min(390px,calc(100vw - 32px));'
    +   'height:min(560px,calc(100vh - 120px));background:var(--ink-2,#121D2E);border:1px solid var(--line,rgba(237,239,243,.12));'
    +   'border-radius:18px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5);'
    +   'font-family:Inter,sans-serif;color:var(--paper,#EDEFF3);}'
    + '#kmai-panel.open{display:flex;}'
    + '.kmai-head{padding:14px 16px;background:var(--ink-3,#1A2740);border-bottom:1px solid var(--line,rgba(237,239,243,.12));'
    +   'display:flex;align-items:center;gap:10px;}'
    + '.kmai-head .dot{width:9px;height:9px;border-radius:50%;background:var(--gain,#22B27D);box-shadow:0 0 8px var(--gain,#22B27D);}'
    + '.kmai-head h4{font-family:"Space Grotesk",sans-serif;font-size:15px;font-weight:700;margin:0;line-height:1.1;}'
    + '.kmai-head p{font-size:11.5px;color:var(--muted,#7C8A9C);margin:2px 0 0;}'
    + '.kmai-head .close{margin-left:auto;background:none;border:none;color:var(--muted,#7C8A9C);font-size:22px;cursor:pointer;line-height:1;padding:0 4px;}'
    + '.kmai-head .close:hover{color:var(--paper,#EDEFF3);}'
    + '.kmai-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;}'
    + '.kmai-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;}'
    + '.kmai-msg.user{align-self:flex-end;background:var(--gold,#E7A33E);color:#1a1204;border-bottom-right-radius:4px;}'
    + '.kmai-msg.bot{align-self:flex-start;background:var(--ink-3,#1A2740);color:var(--paper,#EDEFF3);border-bottom-left-radius:4px;}'
    + '.kmai-msg.bot a{color:var(--gold,#E7A33E);}'
    + '.kmai-typing{align-self:flex-start;color:var(--muted,#7C8A9C);font-size:13px;padding:4px 6px;}'
    + '.kmai-typing span{display:inline-block;width:6px;height:6px;margin:0 1px;border-radius:50%;background:var(--muted,#7C8A9C);animation:kmai-b 1s infinite;}'
    + '.kmai-typing span:nth-child(2){animation-delay:.2s;}.kmai-typing span:nth-child(3){animation-delay:.4s;}'
    + '@keyframes kmai-b{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}'
    + '.kmai-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 8px;}'
    + '.kmai-chip{background:var(--ink-3,#1A2740);border:1px solid var(--line,rgba(237,239,243,.12));color:var(--paper,#EDEFF3);'
    +   'font-size:12px;padding:6px 11px;border-radius:999px;cursor:pointer;}'
    + '.kmai-chip:hover{border-color:var(--gold,#E7A33E);}'
    + '.kmai-foot{border-top:1px solid var(--line,rgba(237,239,243,.12));padding:10px 12px;}'
    + '.kmai-inrow{display:flex;gap:8px;align-items:flex-end;}'
    + '.kmai-inrow textarea{flex:1;resize:none;max-height:90px;background:var(--ink,#0B1420);color:var(--paper,#EDEFF3);'
    +   'border:1px solid var(--line,rgba(237,239,243,.12));border-radius:12px;padding:10px 12px;font-family:Inter,sans-serif;font-size:13.5px;line-height:1.4;}'
    + '.kmai-inrow textarea:focus{outline:none;border-color:var(--gold,#E7A33E);}'
    + '.kmai-send{background:var(--gold,#E7A33E);color:#1a1204;border:none;border-radius:12px;width:40px;height:40px;'
    +   'cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;}'
    + '.kmai-send:disabled{opacity:.5;cursor:not-allowed;}'
    + '.kmai-send svg{width:18px;height:18px;}'
    + '.kmai-disc{font-size:10.5px;color:var(--muted,#7C8A9C);text-align:center;margin-top:7px;line-height:1.4;}'
    ;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- DOM ---------- */
  var fab = document.createElement('button');
  fab.id = 'kmai-fab';
  fab.setAttribute('aria-label', 'Buka Asisten Edukasi');
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg><span>Tanya AI</span>';

  var panel = document.createElement('div');
  panel.id = 'kmai-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Asisten Edukasi Kabar Market');
  panel.innerHTML = ''
    + '<div class="kmai-head"><span class="dot"></span>'
    +   '<div><h4>Asisten Kabar Market</h4><p>Bantu memahami istilah &amp; berita</p></div>'
    +   '<button class="close" aria-label="Tutup">&times;</button></div>'
    + '<div class="kmai-body" id="kmai-body"></div>'
    + '<div class="kmai-chips" id="kmai-chips"></div>'
    + '<div class="kmai-foot"><div class="kmai-inrow">'
    +   '<textarea id="kmai-input" rows="1" placeholder="Tanya istilah atau minta penjelasan berita..."></textarea>'
    +   '<button class="kmai-send" id="kmai-send" aria-label="Kirim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
    +   '</div><div class="kmai-disc">Asisten edukasi. Bukan nasihat keuangan atau ajakan beli/jual.</div></div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var body = panel.querySelector('#kmai-body');
  var input = panel.querySelector('#kmai-input');
  var sendBtn = panel.querySelector('#kmai-send');
  var chipsWrap = panel.querySelector('#kmai-chips');

  /* ---------- Util ---------- */
  function esc(s){ return String(s).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function linkify(s){ return esc(s).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function addMsg(role, text){
    var d = document.createElement('div');
    d.className = 'kmai-msg ' + (role === 'user' ? 'user' : 'bot');
    d.innerHTML = linkify(text);
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }
  function showTyping(){
    var t = document.createElement('div');
    t.className = 'kmai-typing';
    t.id = 'kmai-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
  }
  function hideTyping(){ var t = document.getElementById('kmai-typing'); if(t) t.remove(); }

  function pageContext(){
    var ctx = 'Halaman: ' + (document.title || 'Kabar Market');
    var sel = '';
    try { sel = String(window.getSelection ? window.getSelection().toString() : '').trim(); } catch(e){}
    if (sel && sel.length > 5) ctx += '\nTeks yang sedang dibaca pengguna: "' + sel.slice(0, 800) + '"';
    return ctx;
  }

  /* ---------- Kirim ---------- */
  function send(text){
    text = (text || input.value || '').trim();
    if (!text || busy) return;
    input.value = '';
    input.style.height = 'auto';
    addMsg('user', text);
    messages.push({ role: 'user', content: text });
    if (chipsWrap) chipsWrap.style.display = 'none';

    if (!CONFIGURED){
      addMsg('bot', 'Asisten AI belum diaktifkan. Pemilik situs perlu men-deploy Cloudflare Worker lalu mengisi alamatnya di assets/ai-assistant.js (lihat worker/README-DEPLOY.md).');
      return;
    }

    busy = true; sendBtn.disabled = true;
    showTyping();
    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(-10), context: pageContext() })
    })
    .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
    .then(function(res){
      hideTyping();
      var reply = (res.j && (res.j.reply || res.j.answer || res.j.text)) || '';
      if (!res.ok || !reply){
        addMsg('bot', (res.j && res.j.error) ? ('Maaf, terjadi kendala: ' + res.j.error) : 'Maaf, asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi ya.');
      } else {
        addMsg('bot', reply);
        messages.push({ role: 'assistant', content: reply });
      }
    })
    .catch(function(){
      hideTyping();
      addMsg('bot', 'Maaf, koneksi ke asisten gagal. Periksa koneksi internet lalu coba lagi.');
    })
    .finally(function(){ busy = false; sendBtn.disabled = false; input.focus(); });
  }

  /* ---------- Sapaan & saran ---------- */
  var SUGGEST = ['Apa itu IHSG?', 'Jelaskan inflasi', 'Apa itu dividen?', 'Ringkas berita di halaman ini'];
  function renderChips(){
    chipsWrap.innerHTML = '';
    SUGGEST.forEach(function(q){
      var c = document.createElement('button');
      c.className = 'kmai-chip';
      c.textContent = q;
      c.onclick = function(){ send(q); };
      chipsWrap.appendChild(c);
    });
  }
  var greeted = false;
  function openPanel(){
    panel.classList.add('open');
    if (!greeted){
      greeted = true;
      addMsg('bot', 'Halo! Saya asisten edukasi Kabar Market. Tanya saja istilah ekonomi/pasar (misal "apa itu IHSG?") atau minta saya menjelaskan berita yang sedang kamu baca. Saya tidak memberi rekomendasi beli/jual, ya.');
      renderChips();
    }
    setTimeout(function(){ input.focus(); }, 50);
  }
  function closePanel(){ panel.classList.remove('open'); }

  /* ---------- Event ---------- */
  fab.addEventListener('click', function(){ panel.classList.contains('open') ? closePanel() : openPanel(); });
  panel.querySelector('.close').addEventListener('click', closePanel);
  sendBtn.addEventListener('click', function(){ send(); });
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
  input.addEventListener('input', function(){ input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closePanel(); });
})();
