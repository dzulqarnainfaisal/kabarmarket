# Asisten Edukasi Kabar Market - Panduan Deploy

Asisten AI ini terdiri dari 2 bagian:

1. **Widget chat** (`assets/ai-assistant.js`) - sudah otomatis muncul di semua halaman.
2. **Cloudflare Worker** (`worker/km-ai-worker.js`) - "otak" AI + penyimpan rahasia API key.

Widget belum akan menjawab sampai Worker di-deploy dan alamatnya diisi. Ikuti langkah berikut.

---

## Persiapan (sekali saja)

1. Punya akun Cloudflare (gratis) - kamu sudah punya, karena domain sudah di Cloudflare.
2. Pasang Node.js di komputermu (https://nodejs.org).

---

## Langkah A - Deploy Worker

Buka terminal di dalam folder `worker/`, lalu jalankan:

```bash
npx wrangler login          # login ke akun Cloudflare (buka browser)
npx wrangler deploy         # unggah Worker
```

Setelah selesai, terminal akan menampilkan URL Worker-mu, contoh:

```
https://km-ai-worker.NAMAKAMU.workers.dev
```

Salin URL itu.

---

## Langkah B - Hubungkan widget ke Worker

Buka file `assets/ai-assistant.js`, cari baris paling atas:

```js
var WORKER_URL = window.KM_AI_ENDPOINT || 'https://km-ai-worker.GANTI-SUBDOMAIN.workers.dev';
```

Ganti URL contoh itu dengan URL Worker-mu dari Langkah A. Simpan, lalu deploy ulang situsmu.

---

## Pilihan model AI

### 1. Cloudflare Workers AI (default, GRATIS dalam batas tertentu)
Tidak perlu API key eksternal. Sudah aktif otomatis lewat binding `[ai]` di `wrangler.toml`.
Model default: `@cf/meta/llama-3.1-8b-instruct`. Cocok untuk edukasi ringan.

### 1b. NVIDIA - GLM-5.2 (prioritas utama, GRATIS via trial NVIDIA)
Model canggih GLM-5.2 lewat endpoint NVIDIA yang OpenAI-compatible. Ambil API key
gratis di https://build.nvidia.com/z-ai/glm-5.2 (klik "Get API Key", format `nvapi-...`),
lalu set sebagai **secret**:

```bash
npx wrangler secret put NVIDIA_API_KEY
# tempel API key NVIDIA-mu (nvapi-...) saat diminta
npx wrangler deploy
```

Begitu secret ini ada, Worker OTOMATIS memakai GLM-5.2 (model `z-ai/glm-5.2`) sebagai
prioritas utama, mengalahkan OpenAI & Workers AI. Untuk mengganti model, set var
`NVIDIA_MODEL` di `wrangler.toml` (salin id model persis dari halaman NVIDIA-nya).
Untuk menonaktifkan: `npx wrangler secret delete NVIDIA_API_KEY`.

> Catatan: akses gratis NVIDIA bersifat trial (ada rate limit, tanpa jaminan uptime).
> Untuk produksi ramai, siapkan cadangan Workers AI/OpenAI.

### 2. OpenAI (opsional, kualitas lebih tinggi, BERBAYAR)
Kalau ingin jawaban lebih pintar, set API key OpenAI sebagai **secret** (aman, tidak masuk kode):

```bash
npx wrangler secret put OPENAI_API_KEY
# tempel API key OpenAI-mu saat diminta
npx wrangler deploy
```

Bila NVIDIA_API_KEY TIDAK diset tapi OPENAI_API_KEY diset, Worker memakai OpenAI (model `gpt-4o-mini`).
Untuk kembali ke Workers AI, hapus secret: `npx wrangler secret delete OPENAI_API_KEY`.

---

## Keamanan & biaya (disarankan)

- **Batasi domain**: di `wrangler.toml`, ganti `ALLOWED_ORIGIN = "*"` menjadi
  `ALLOWED_ORIGIN = "https://kabarmarket.web.id"` supaya hanya situsmu yang bisa memakai Worker. Deploy ulang setelah mengubah.
- **Rambu keamanan**: Worker sudah diprogram agar asisten TIDAK memberi rekomendasi beli/jual atau prediksi harga - hanya edukasi. Kamu bisa mengubah aturan ini di `SYSTEM_PROMPT` dalam `km-ai-worker.js`.
- **Hemat biaya**: panjang & jumlah pesan sudah dibatasi otomatis. Workers AI punya kuota gratis harian; OpenAI berbayar per pemakaian.

---

## Uji coba cepat

Setelah deploy, buka situsmu, klik tombol **"Tanya AI"** di kanan bawah, lalu tanyakan
misalnya "apa itu IHSG?". Kalau muncul jawaban, berarti sudah berhasil. 🎉

Kalau muncul pesan "Asisten AI belum diaktifkan", berarti Langkah B belum dilakukan
(URL Worker di `assets/ai-assistant.js` masih contoh).
