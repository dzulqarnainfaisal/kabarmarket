# Asisten Kabar Market - Panduan Aktivasi AI (Groq: gratis + tercepat)

Asisten AI ini punya 2 bagian:

1. **Widget chat** (`assets/ai-assistant.js`) - sudah otomatis muncul di semua halaman.
   - Bahkan tanpa langkah di bawah, widget SUDAH bisa menjawab istilah dasar (mode offline bawaan).
2. **Cloudflare Worker** (`worker/km-ai-worker.js`) - "otak" AI canggih + penyimpan API key secara aman.

Ikuti 3 langkah singkat berikut agar asisten bisa ngobrol bebas & pintar. Perkiraan waktu: ~5-10 menit, sekali saja.

---

## Kenapa Groq?

- **Gratis** - tanpa kartu kredit. Kuota harian gratisnya lebih dari cukup untuk situs berita kecil-menengah.
- **Tercepat** - berjalan di chip khusus (LPU), ~300+ token/detik, jadi jawaban keluar hampir instan.
- **Canggih** - default memakai model **GPT-OSS 120B** yang pintar untuk penjelasan & tanya-jawab.

---

## Persiapan (sekali saja)

1. Punya akun Cloudflare (gratis) - kamu sudah punya karena domain sudah di Cloudflare.
2. Pasang Node.js di komputermu (https://nodejs.org).

---

## Langkah 1 - Ambil API key Groq (gratis)

1. Buka https://console.groq.com/keys lalu masuk (bisa pakai akun Google).
2. Klik **"Create API Key"**, beri nama bebas, lalu **salin** key-nya (formatnya diawali `gsk_...`).
3. Simpan sementara di tempat aman. **Jangan** tempel key ini ke dalam file kode mana pun.

---

## Langkah 2 - Deploy Worker + pasang key

Buka terminal di dalam folder `worker/`, lalu jalankan berurutan:

```bash
npx wrangler login              # login ke Cloudflare (akan buka browser)
npx wrangler secret put GROQ_API_KEY   # saat diminta, TEMPEL key gsk_... dari Langkah 1
npx wrangler deploy             # unggah Worker
```

Setelah `deploy` selesai, terminal menampilkan URL Worker-mu, contoh:

```
https://km-ai-worker.NAMAKAMU.workers.dev
```

**Salin URL itu.**

> Karena key dipasang sebagai *secret*, key TIDAK pernah muncul di kode maupun di browser pengunjung. Aman.

---

## Langkah 3 - Hubungkan widget ke Worker

Buka file `assets/ai-assistant.js`, cari baris paling atas:

```js
var WORKER_URL = window.KM_AI_ENDPOINT || 'https://km-ai-worker.GANTI-SUBDOMAIN.workers.dev';
```

Ganti URL contoh itu dengan URL Worker-mu dari Langkah 2. Simpan, lalu deploy ulang situsmu.

Selesai! Klik tombol **"Tanya AI"** di kanan bawah, tanya misalnya "apa itu IHSG?" atau "jelaskan berita ini". Kalau jawabannya keluar cepat dan nyambung, berarti sudah aktif. 🎉

---

## Ganti model (opsional)

Default-nya `openai/gpt-oss-120b` (pintar + cepat). Kalau lalu lintas situs ramai dan ingin kuota lebih hemat + jawaban lebih ringan, di `wrangler.toml` aktifkan baris:

```toml
[vars]
GROQ_MODEL = "llama-3.1-8b-instant"
```

lalu `npx wrangler deploy` lagi. (Daftar model terbaru: https://console.groq.com/docs/models)

---

## Keamanan & biaya (disarankan)

- **Batasi domain**: di `wrangler.toml`, ganti `ALLOWED_ORIGIN = "*"` menjadi
  `ALLOWED_ORIGIN = "https://kabarmarket.web.id"` supaya hanya situsmu yang boleh memakai Worker. Deploy ulang setelah mengubah.
- **Rambu keamanan**: Worker sudah diprogram agar asisten TIDAK memberi rekomendasi beli/jual atau prediksi harga - hanya edukasi. Aturan ini bisa kamu ubah di `SYSTEM_PROMPT` dalam `km-ai-worker.js`.
- **Batas kuota Groq**: gratis dengan batas per menit/harian. Kalau kuota habis, Worker akan mengembalikan pesan error dan widget otomatis jatuh ke mode offline bawaan, jadi tombol "Tanya AI" tidak akan mati.

---

## Alternatif mesin AI (opsional)

Worker otomatis memilih mesin berdasarkan secret yang ada, dengan urutan prioritas:

1. **Groq** (`GROQ_API_KEY`) - disarankan: gratis + tercepat + canggih.
2. **NVIDIA / GLM-5.2** (`NVIDIA_API_KEY`) - gratis via trial NVIDIA.
3. **OpenAI** (`OPENAI_API_KEY`) - kualitas tinggi tapi berbayar.
4. **Cloudflare Workers AI** (tanpa key eksternal) - dipakai bila tidak ada secret di atas; gratis dalam batas 10.000 Neuron/hari.

Semua dipasang dengan pola sama: `npx wrangler secret put NAMA_KEY` lalu `npx wrangler deploy`.

---

## Kalau muncul pesan "belum diaktifkan" atau jawaban terasa terbatas

- Pastikan Langkah 3 sudah dilakukan (URL Worker di `assets/ai-assistant.js` bukan lagi contoh `GANTI-SUBDOMAIN`).
- Kalau URL belum diisi, widget tetap hidup tapi hanya menjawab dari daftar istilah bawaan (mode offline).
