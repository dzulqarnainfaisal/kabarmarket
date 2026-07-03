/*
 * Skrip pengambil berita otomatis untuk Kabar Market.
 * ---------------------------------------------------------------
 * Mengambil berita terbaru dari NewsData.io, lalu menulisnya ke ../news.json.
 * Website akan otomatis membaca news.json tersebut.
 *
 * Cara jalan manual (untuk uji coba):
 *   NEWSDATA_KEY=api_key_kamu node automation/fetch-news.js
 *
 * Butuh Node.js versi 18 atau lebih baru (sudah punya fungsi fetch bawaan).
 * Daftar API key gratis di: https://newsdata.io/register
 *
 * CATATAN HAK CIPTA: skrip ini hanya menyimpan JUDUL + RINGKASAN + TAUTAN
 * ke sumber asli (gaya agregator), bukan menyalin isi artikel penuh.
 */

const fs = require('fs');
const path = require('path');

const KEY = process.env.NEWSDATA_KEY;
if (!KEY) {
  console.error('ERROR: environment variable NEWSDATA_KEY belum diisi.');
  process.exit(1);
}

const BASE = 'https://newsdata.io/api/1/latest';
const PER_CAT = 6; // jumlah berita per kategori

// SUMBER BERITA LOKAL:
// Karena kita memakai country:'id' + language:'id', berita OTOMATIS diambil dari
// beragam media lokal Indonesia — termasuk ANTARA, Kontan, CNN Indonesia, Detik,
// Kompas, Bisnis.com, Tempo, Liputan6, dan lainnya. Tidak perlu menambah satu per satu.
//
// (OPSIONAL) Kalau kamu mau MEMBATASI hanya ke media tertentu, isi variabel lingkungan
// NEWS_DOMAINS dengan daftar domain (maksimal 5, dipisah koma). Kalau dikosongkan,
// berita diambil dari SEMUA media lokal. Contoh:
//   NEWS_DOMAINS="antaranews.com,kontan.co.id,cnnindonesia.com,bisnis.com,kompas.com"
const DOMAINS = (process.env.NEWS_DOMAINS || '').trim();

// Kategori website + kata kunci pencariannya
const queries = [
  { cat: 'Ekonomi', extra: { category: 'business' } },
  { cat: 'Saham',   extra: { q: 'saham OR IHSG OR bursa efek OR emiten OR dividen OR BEI' } },
  { cat: 'Crypto',  extra: { q: 'kripto OR bitcoin OR ethereum OR crypto OR Bappebti' } },
];

function buildUrl(extra) {
  const params = new URLSearchParams({
    apikey: KEY,
    country: 'id',
    language: 'id',
    ...extra,
  });
  if (DOMAINS) params.set('domainurl', DOMAINS);
  return `${BASE}?${params.toString()}`;
}

function parseDate(iso) {
  if (!iso) return new Date();
  // Format NewsData.io: "2026-07-02 14:30:00" (UTC)
  return new Date(iso.replace(' ', 'T') + 'Z');
}

function relativeTime(iso) {
  const then = parseDate(iso);
  const mins = Math.max(1, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  return `${days} hari lalu`;
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(parseDate(iso));
}

async function run() {
  const all = [];
  const seen = new Set();

  for (const qc of queries) {
    try {
      const res = await fetch(buildUrl(qc.extra));
      const json = await res.json();
      if (json.status !== 'success') {
        console.error(`Peringatan (${qc.cat}):`, json.message || JSON.stringify(json));
        continue;
      }
      const items = (json.results || []).filter((it) => it.title && it.description);
      let added = 0;
      for (const it of items) {
        if (added >= PER_CAT) break;
        const key = it.title.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          cat: qc.cat,
          title: it.title.trim(),
          desc: it.description.trim(),
          time: relativeTime(it.pubDate),
          date: fmtDate(it.pubDate),
          source: it.source_id || it.source_name || 'Sumber berita',
          url: it.link || null,
          image: it.image_url || null,
          source_icon: it.source_icon || null,
          highlight: added === 0,
          body: [it.description.trim()],
        });
        added++;
      }
      console.log(`${qc.cat}: ${added} berita`);
    } catch (e) {
      console.error(`Gagal mengambil kategori ${qc.cat}:`, e.message);
    }
  }

  if (!all.length) {
    console.error('Tidak ada berita yang berhasil diambil. news.json tidak diubah.');
    process.exit(1);
  }

  const out = { updated: new Date().toISOString(), articles: all };
  const dest = path.join(__dirname, '..', 'news.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`OK: ${all.length} berita disimpan ke news.json`);
}

run();
