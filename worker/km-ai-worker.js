/* =====================================================================
 * Kabar Market - AI Worker (Cloudflare Workers)
 * ---------------------------------------------------------------------
 * Perantara aman antara widget chat dan model AI. Tugasnya:
 *  - Menyembunyikan kredensial (API key TIDAK pernah ada di sisi browser).
 *  - Menerapkan "rambu" (system prompt) agar asisten hanya mengedukasi,
 *    TIDAK memberi rekomendasi beli/jual atau prediksi harga.
 *  - Membatasi panjang & jumlah pesan agar hemat biaya.
 *
 * Tiga mode (prioritas otomatis berdasarkan secret yang diset):
 *  1) NVIDIA (GLM-5.2): aktif bila secret NVIDIA_API_KEY diset. Gratis via
 *     endpoint OpenAI-compatible NVIDIA build (trial - ada rate limit).
 *  2) OpenAI: aktif bila secret OPENAI_API_KEY diset (berbayar per pemakaian).
 *  3) DEFAULT: Cloudflare Workers AI (gratis dalam batas tertentu, tanpa
 *     API key eksternal). Perlu binding [ai] di wrangler.toml.
 *
 * Lihat README-DEPLOY.md untuk langkah deploy.
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

const MODEL_CF = '@cf/meta/llama-3.1-8b-instruct';
const MODEL_OPENAI = 'gpt-4o-mini';
const MODEL_NVIDIA = 'z-ai/glm-5.2'; // GLM-5.2 via NVIDIA (endpoint OpenAI-compatible)
const MAX_MSGS = 10;
const MAX_CHARS = 1500;

function corsHeaders(origin, allowed) {
  const allow = (allowed === '*' || !allowed) ? '*' : (origin && allowed.split(',').map(s => s.trim()).includes(origin) ? origin : allowed.split(',')[0].trim());
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors),
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Gunakan metode POST.' }, 405, cors);

    let payload;
    try { payload = await request.json(); } catch (_) { return json({ error: 'Body harus JSON.' }, 400, cors); }

    let msgs = Array.isArray(payload && payload.messages) ? payload.messages : [];
    const context = typeof (payload && payload.context) === 'string' ? payload.context.slice(0, 1000) : '';

    // Bersihkan & batasi pesan
    msgs = msgs
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MSGS)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') {
      return json({ error: 'Tidak ada pertanyaan.' }, 400, cors);
    }

    let systemContent = SYSTEM_PROMPT;
    if (context) systemContent += '\n\nKonteks halaman yang sedang dibuka pengguna:\n' + context;

    const chat = [{ role: 'system', content: systemContent }, ...msgs];

    try {
      // --- Mode NVIDIA / GLM-5.2 (prioritas, aktif bila ada secret NVIDIA_API_KEY) ---
      // Endpoint OpenAI-compatible, jadi format request/response sama seperti OpenAI.
      if (env.NVIDIA_API_KEY) {
        const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.NVIDIA_API_KEY },
          body: JSON.stringify({ model: env.NVIDIA_MODEL || MODEL_NVIDIA, messages: chat, temperature: 0.3, max_tokens: 500 }),
        });
        if (!r.ok) { const t = await r.text(); return json({ error: 'AI error (NVIDIA): ' + t.slice(0, 200) }, 502, cors); }
        const d = await r.json();
        const reply = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        return json({ reply: (reply || '').trim() }, 200, cors);
      }

      // --- Mode OpenAI (opsional, aktif bila ada secret) ---
      if (env.OPENAI_API_KEY) {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.OPENAI_API_KEY },
          body: JSON.stringify({ model: env.OPENAI_MODEL || MODEL_OPENAI, messages: chat, temperature: 0.3, max_tokens: 500 }),
        });
        if (!r.ok) { const t = await r.text(); return json({ error: 'AI error: ' + t.slice(0, 200) }, 502, cors); }
        const d = await r.json();
        const reply = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        return json({ reply: (reply || '').trim() }, 200, cors);
      }

      // --- Mode default: Cloudflare Workers AI ---
      if (!env.AI) {
        return json({ error: 'Worker belum dikonfigurasi: aktifkan binding [ai] atau set OPENAI_API_KEY.' }, 500, cors);
      }
      const out = await env.AI.run(env.CF_MODEL || MODEL_CF, { messages: chat, max_tokens: 500, temperature: 0.3 });
      const reply = (out && (out.response || out.result || '')) || '';
      return json({ reply: String(reply).trim() }, 200, cors);
    } catch (err) {
      return json({ error: 'Gagal memproses: ' + (err && err.message ? err.message : String(err)) }, 500, cors);
    }
  },
};
