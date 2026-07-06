# Cara Mengaktifkan AI (Cloudflare Pages) - Simpel, tanpa terminal

Situsmu berjalan di **Cloudflare Pages**, jadi "otak" AI sudah ditanam langsung
di dalam situs (file `functions/api/ai.js`). Kamu **tidak perlu** deploy Worker
terpisah, tidak perlu terminal, dan tidak perlu menempel URL apa pun.

Cukup 3 langkah berikut.

---

## Langkah 1 - Ambil kunci Groq (gratis)

1. Buka https://console.groq.com/keys lalu masuk (bisa pakai akun Google).
2. Klik **Create API Key**, beri nama bebas, lalu **salin** kuncinya (diawali `gsk_...`).
3. Simpan sementara di Notepad. Jangan tempel ke file kode.

> Kalau kemarin kamu sudah punya kunci `gsk_...`, pakai yang itu saja.

---

## Langkah 2 - Upload semua file ke GitHub

Upload/commit isi folder ini ke repo GitHub-mu **seperti biasa**, termasuk folder
baru **`functions/`**. Cloudflare Pages akan otomatis mendeteksi `functions/api/ai.js`
dan membuat alamat `POST /api/ai` di situsmu.

> PENTING: pastikan `index.html` dan folder `functions/` berada di **akar repo**
> (bukan di dalam folder pembungkus `kabarmarket-deploy`).
> Folder lama `worker/` TIDAK lagi dipakai untuk cara ini. Boleh dibiarkan/dihapus.

---

## Langkah 3 - Isi kunci rahasia di Cloudflare Pages

1. Buka https://dash.cloudflare.com -> **Workers & Pages** -> pilih proyek situsmu (Pages).
2. Masuk **Settings** -> **Variables and Secrets** (atau "Environment variables").
3. Di bagian **Production**, klik **Add** lalu isi:
   - **Type:** Secret
   - **Name:** `GROQ_API_KEY`
   - **Value:** tempel kunci `gsk_...` dari Langkah 1
4. (Opsional) Tambah satu lagi kalau mau atur model:
   - **Name:** `GROQ_MODEL`
   - **Value:** `openai/gpt-oss-120b`  (default; alternatif hemat kuota: `llama-3.1-8b-instant`)
5. Klik **Save**.
6. Buka tab **Deployments** -> klik **Retry deployment** pada versi terbaru
   (atau push perubahan kecil ke GitHub) supaya kunci ikut terpasang.

---

## Selesai - Uji coba

Buka situsmu, klik tombol **"Tanya AI"** di kanan bawah, lalu tanya misalnya
"apa itu IHSG?" atau buka satu berita lalu ketik "jelaskan berita ini".

- Jawaban **panjang, nyambung, seperti ngobrol** = AI canggih sudah AKTIF.
- Jawaban **pendek/seperti kamus** = kunci belum terpasang; ulangi Langkah 3
  (pastikan sudah deploy ulang setelah menyimpan secret). Widget tetap hidup
  memakai mode offline bawaan, jadi tombol tidak pernah mati.

---

## Kalau muncul error "model ... deprecated"

Groq kadang memensiunkan model lama. Cukup ubah nilai secret **`GROQ_MODEL`** di
dashboard Pages ke model yang masih aktif, lalu deploy ulang. Daftar model terbaru:
https://console.groq.com/docs/models

Model yang disarankan & jarang berubah:
- `openai/gpt-oss-120b` (default, canggih)
- `llama-3.1-8b-instant` (paling irit kuota, sangat cepat)

---

## Keamanan

Karena endpoint `/api/ai` berada di domain situsmu sendiri, kunci Groq tersimpan
AMAN di server Cloudflare dan tidak pernah terlihat pengunjung. Tidak ada yang
perlu diatur soal domain/CORS.
