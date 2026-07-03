/*
 * Skrip pengambil harga pasar otomatis untuk Kabar Market.
 * ---------------------------------------------------------------
 * Mengambil harga IHSG, USD/IDR, S&P 500, dan BBCA dari Yahoo Finance,
 * lalu menulisnya ke ../prices.json. Website akan otomatis membacanya.
 *
 * Tidak butuh API key. Yahoo Finance memblokir akses langsung dari browser
 * (CORS), jadi pengambilannya harus dari sisi server seperti di sini.
 *
 * Cara jalan manual (uji coba):
 *   node automation/fetch-prices.js
 *
 * Butuh Node.js versi 18 atau lebih baru (sudah punya fungsi fetch bawaan).
 *
 * Catatan: harga crypto (BTC, ETH, dll) TIDAK diambil di sini karena sudah
 * diambil langsung oleh website dari CoinGecko (live tiap 60 detik).
 */

const fs = require('fs');
const path = require('path');

// Simbol Yahoo Finance untuk tiap instrumen
const SYMBOLS = {
  'IHSG':    '%5EJKSE',  // ^JKSE = Jakarta Composite Index
  'USD/IDR': 'IDR=X',    // kurs USD ke IDR
  'BBCA':    'BBCA.JK',  // Bank Central Asia
  'BBRI':    'BBRI.JK',  // Bank Rakyat Indonesia
  'BMRI':    'BMRI.JK',  // Bank Mandiri
  'TLKM':    'TLKM.JK',  // Telkom Indonesia
  'ASII':    'ASII.JK',  // Astra International
  'S&P 500': '%5EGSPC',  // ^GSPC = S&P 500
};

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

async function quote(sym) {
  const url = `${BASE}${sym}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const meta = j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!meta) throw new Error('format tidak dikenali');
  const price = meta.regularMarketPrice;
  const prev = (meta.chartPreviousClose != null) ? meta.chartPreviousClose : meta.previousClose;
  const change = (prev && price != null) ? ((price - prev) / prev * 100) : 0;
  return { value: price, change: Number(change.toFixed(2)) };
}

async function run() {
  const items = {};
  for (const [key, sym] of Object.entries(SYMBOLS)) {
    try {
      items[key] = await quote(sym);
      console.log(`OK ${key}:`, items[key]);
    } catch (e) {
      console.error(`Gagal ambil ${key}:`, e.message);
    }
  }

  if (!Object.keys(items).length) {
    console.error('Tidak ada harga yang berhasil diambil. prices.json tidak diubah.');
    process.exit(1);
  }

  const out = { updated: new Date().toISOString(), items };
  const dest = path.join(__dirname, '..', 'prices.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`OK: ${Object.keys(items).length} harga disimpan ke prices.json`);
}

run();
