/* =====================================================================
 * Kabar Market - Endpoint AI (Cloudflare Pages Function)
 * ---------------------------------------------------------------------
 * Berjalan di alamat SAMA dengan situsmu: POST /api/ai
 * Ter-deploy OTOMATIS bersama situs saat kamu push/upload ke GitHub
 * (Cloudflare Pages mendeteksi folder /functions secara otomatis).
 *
 * Kamu TIDAK perlu terminal atau deploy Worker terpisah. Cukup set secret
 * GROQ_API_KEY di dashboard Cloudflare Pages (Settings > Variables and Secrets).
 * Lihat CARA-AKTIFKAN-AI.md.
 *
 * Prioritas mesin (otomatis, berdasarkan secret yang diset):
 *  1) GROQ (GROQ_API_KEY)   - GRATIS + cepat + canggih (default openai/gpt-oss-120b)
 *  2) NVIDIA (NVIDIA_API_KEY)- gratis via trial NVIDIA
 *  3) OpenAI (OPENAI_API_KEY)- berbayar per pemakaian
 *  4) Workers AI (binding AI)- bila diaktifkan di Pages (opsional)
 * ===================================================================== */

const SYSTEM_PROMPT = [
  'Kamu adalah "Asisten Edukasi Kabar Market", asisten pada situs berita ekonomi & pasar berbahasa Indonesia.',
  'TUJUANMU: membantu pembaca MEMAHAMI istilah ekonomi/pasar dan MENJELASKAN isi berita dengan bahasa yang sederhana, netral, dan mudah dipahami orang awam.',
  '',
  'ATURAN WAJIB:',
  '1. JANGAN PERNAH memberi rekomendasi beli/jual/tahan, sinyal trading, target harga, atau prediksi harga aset apa pun (saham, kripto, mata uang, komoditas).',
  '2. Jika pengguna meminta nasihat investasi atau "sebaiknya beli apa", tolak dengan sopan dan alihkan ke penjelasan edukatif, lalu ingatkan untuk berkonsultasi dengan penasihat keuangan berizin.',
  '3. Jawab HANYA seputar ekonomi, pasar modal, kripto, keuangan, dan literasi finansial. Untuk topik di luar itu, arahkan kembali dengan sopan.',
  '4. Gunakan Bahasa Indonesia yang ringkas, jelas, dan ramah. Hindari jargon; kalau memakai istilah, jelaskan singkat.',
  '5. Jangan mengarang data/angka pasti (harga real-time, kurs terkini). Jika tak yakin, katakan dengan jujur dan jelaskan konsepnya saja.',
  '6. Jaga jawaban tetap padat (idealnya di bawah 180 kata) kecuali diminta lebih rinci.',
  '7. Selalu bersikap netral dan tidak menakut-nakuti atau membujuk.',
].join('\n');

const MODEL_GROQ = 'openai/gpt-oss-120b'; // Groq (gratis, cepat, canggih). Alternatif hemat kuota: 'llama-3.1-8b-instant'
const MODEL_OPENAI = 'gpt-4o-mini';
const MODEL_NVIDIA = 'z-ai/glm-5.2';
const MODEL_CF = '@cf/meta/llama-3.1-8b-instruct';
const MAX_MSGS = 10;
const MAX_CHARS = 1500;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let payload;
  try { payload = await request.json(); } catch (_) { return json({ error: 'Body harus JSON.' }, 400); }

  let msgs = Array.isArray(payload && payload.messages) ? payload.messages : [];
  const ctx = typeof (payload && payload.context) === 'string' ? payload.context.slice(0, 1000) : '';

  msgs = msgs
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MSGS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') {
    return json({ error: 'Tidak ada pertanyaan.' }, 400);
  }

  let systemContent = SYSTEM_PROMPT;
  if (ctx) systemContent += '\n\nKonteks halaman yang sedang dibuka pengguna:\n' + ctx;
  const chat = [{ role: 'system', content: systemContent }, ...msgs];

  try {
    // --- GROQ (prioritas utama: gratis + tercepat + canggih) ---
    if (env.GROQ_API_KEY) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({ model: env.GROQ_MODEL || MODEL_GROQ, messages: chat, temperature: 0.3, max_tokens: 500 }),
      });
      if (!r.ok) { const t = await r.text(); return json({ error: 'AI error (Groq): ' + t.slice(0, 200) }, 502); }
      const d = await r.json();
      const reply = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      return json({ reply: (reply || '').trim() });
    }

    // --- NVIDIA / GLM-5.2 (alternatif gratis via trial) ---
    if (env.NVIDIA_API_KEY) {
      const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.NVIDIA_API_KEY },
        body: JSON.stringify({ model: env.NVIDIA_MODEL || MODEL_NVIDIA, messages: chat, temperature: 0.3, max_tokens: 500 }),
      });
      if (!r.ok) { const t = await r.text(); return json({ error: 'AI error (NVIDIA): ' + t.slice(0, 200) }, 502); }
      const d = await r.json();
      const reply = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      return json({ reply: (reply || '').trim() });
    }

    // --- OpenAI (opsional, berbayar) ---
    if (env.OPENAI_API_KEY) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.OPENAI_API_KEY },
        body: JSON.stringify({ model: env.OPENAI_MODEL || MODEL_OPENAI, messages: chat, temperature: 0.3, max_tokens: 500 }),
      });
      if (!r.ok) { const t = await r.text(); return json({ error: 'AI error: ' + t.slice(0, 200) }, 502); }
      const d = await r.json();
      const reply = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      return json({ reply: (reply || '').trim() });
    }

    // --- Workers AI (opsional, bila binding AI diaktifkan di Pages) ---
    if (env.AI) {
      const out = await env.AI.run(env.CF_MODEL || MODEL_CF, { messages: chat, max_tokens: 500, temperature: 0.3 });
      const reply = (out && (out.response || out.result || '')) || '';
      return json({ reply: String(reply).trim() });
    }

    return json({ error: 'Belum ada mesin AI. Set secret GROQ_API_KEY di dashboard Cloudflare Pages (Settings > Variables and Secrets), lalu deploy ulang.' }, 500);
  } catch (err) {
    return json({ error: 'Gagal memproses: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}

// Kalau dibuka lewat GET (mis. diketik di browser), beri pesan jelas.
export async function onRequestGet() {
  return json({ error: 'Endpoint ini hanya menerima POST dari widget chat.' }, 405);
}
