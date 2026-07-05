#!/usr/bin/env node
/*
 * fetch-news.js  -  Pengambil berita Kabar Market via RSS media Indonesia.
 * ---------------------------------------------------------------------------
 * REAL-TIME, GRATIS, TANPA API KEY.
 * Mengambil langsung dari RSS resmi media (ANTARA, Detik Finance, CNBC
 * Indonesia, Tempo, Liputan6, dll), lalu mengelompokkan ke Ekonomi / Saham /
 * Crypto berdasarkan kata kunci, dan menyimpan ke ../news.json.
 *
 * Gaya agregator: hanya judul + ringkasan + tautan ke sumber asli (bukan
 * menyalin isi penuh) - aman hak cipta, seperti Google News.
 *
 * Jalankan: node automation/fetch-news.js
 */

const fs = require('fs');
const path = require('path');

// Daftar RSS. Bisa ditimpa lewat env NEWS_FEEDS = "url|Nama Sumber, url|Nama, ..."
const DEFAULT_FEEDS = [
	{ url: 'https://www.antaranews.com/rss/ekonomi', source: 'ANTARA' },
	{ url: 'https://finance.detik.com/rss', source: 'Detik Finance' },
	{ url: 'https://www.cnbcindonesia.com/market/rss', source: 'CNBC Indonesia' },
	{ url: 'https://www.cnbcindonesia.com/news/rss', source: 'CNBC Indonesia' },
	{ url: 'https://rss.tempo.co/ekonomi', source: 'Tempo' },
	{ url: 'https://feed.liputan6.com/rss/saham', source: 'Liputan6' },
	{ url: 'https://feed.liputan6.com/rss/bisnis', source: 'Liputan6' },
	// --- Crypto Indonesia ---
	{ url: 'https://coinvestasi.com/feed', source: 'Coinvestasi', cat: 'Crypto' },
	// --- Crypto internasional (update cepat & real-time global; dampak makro spt suku bunga The Fed) ---
	{ url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', cat: 'Crypto', translate: true },
	{ url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', cat: 'Crypto', translate: true },
	{ url: 'https://decrypt.co/feed', source: 'Decrypt', cat: 'Crypto', translate: true },
	{ url: 'https://bitcoinmagazine.com/.rss/full', source: 'Bitcoin Magazine', cat: 'Crypto', translate: true },
	// --- Saham internasional (Wall Street & pasar global; diterjemahkan otomatis ke Bahasa) ---
	{ url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com', cat: 'Saham', region: 'Internasional', translate: true },
	{ url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch', cat: 'Saham', region: 'Internasional', translate: true },
	{ url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', source: 'CNBC Markets', cat: 'Saham', region: 'Internasional', translate: true },
	{ url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance', cat: 'Saham', region: 'Internasional', translate: true },
];

function loadFeeds() {
	const env = (process.env.NEWS_FEEDS || '').trim();
	if (!env) return DEFAULT_FEEDS;
	return env.split(',').map((chunk) => {
		const [url, source, cat, region] = chunk.split('|').map((s) => (s || '').trim());
		return { url, source: source || hostOf(url), cat: cat || null, region: region || null };
	}).filter((f) => f.url);
}

const PER_CAT = 6; // jumlah berita per kategori (tampilan awal per halaman)
const ARCHIVE_PER_CAT = Infinity; // tanpa batas - SEMUA berita lama disimpan (untuk paginasi). Ganti ke angka mis. 100 untuk membatasi.
const DO_TRANSLATE = process.env.TRANSLATE !== '0'; // set TRANSLATE=0 untuk mematikan

// --- Filter kualitas berita ---------------------------------------------------
// Buang konten promosi/iklan/hiburan yang bukan berita pasar (mis. "Full Day Sale",
// diskon, giveaway, gosip, zodiak, dll) agar kualitas berita lebih terjaga.
const BLOCK_RE = /(full day sale|banting harga|diskon|obral|\bpromo\b|voucher|kupon|cashback|flash sale|harga murah|termurah|gratis ongkir|serba gratis|giveaway|berhadiah|undian|kode redeem|beli sekarang|buruan|link nonton|nonton film|streaming film|jadwal tayang|sinopsis|spoiler|zodiak|horoskop|ramalan|primbon|resep masak|gaya hidup|lifestyle|wisata kuliner|selebriti|selebgram|\bartis\b|gosip|prediksi skor|hasil pertandingan|klasemen liga|transfer pemain|jadwal sholat|kata mutiara|ucapan selamat)/i;
// Kata kunci relevansi ekonomi/pasar. Berita tanpa kategori feed eksplisit harus
// menyinggung salah satu topik ini agar dianggap layak tayang.
const RELEVAN_RE = /(ekonomi|ihsg|saham|bursa|emiten|rupiah|dolar|dollar|inflasi|deflasi|suku bunga|bank indonesia|\bbi\b|the fed|obligasi|surat utang|sukuk|investasi|investor|pasar modal|reksa ?dana|makro|neraca|ekspor|impor|\bpdb\b|apbn|pajak|cukai|komoditas|nikel|batu ?bara|emas|minyak|\bgas\b|kripto|crypto|bitcoin|ethereum|blockchain|token|dividen|\bipo\b|laba|rugi|pendapatan|kuartal|perbankan|fintech|\bbumn\b|nilai tukar|indeks|perdagangan|harga pangan|subsidi|utang|anggaran|moneter|fiskal|manufaktur|industri|properti)/i;

// Ganti em dash / en dash jadi tanda hubung biasa agar tidak muncul di web.
function stripDash(s) {
	return typeof s === 'string' ? s.replace(/[\u2014\u2013]/g, '-') : s;
}

function isQuality(a) {
	const t = ((a.title || '') + ' ' + (a.desc || '')).toLowerCase();
	if (BLOCK_RE.test(t)) return false;                   // jelas iklan/hiburan
	if ((a.title || '').trim().length < 20) return false; // judul terlalu pendek/clickbait
	if (a.cat) return true;                               // dari feed khusus (Saham/Crypto) - sudah relevan
	return RELEVAN_RE.test(t);                             // wajib relevan ke ekonomi/pasar
}

function hostOf(u) {
	try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return 'Sumber'; }
}

// --- Pembersih teks: buang CDATA, tag HTML, decode entitas umum ---
function decode(s) {
	if (!s) return '';
	return String(s)
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;|&#x27;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&hellip;|&#8230;/g, '\u2026')
		.replace(/&#8211;|&ndash;/g, '-')
		.replace(/&#8212;|&mdash;/g, '-')
		.replace(/&[a-z]+;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function tag(block, name) {
	const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
	return m ? m[1] : '';
}

function imageOf(block) {
	let m = block.match(/<enclosure[^>]*url="([^"]+)"/i);
	if (m) return m[1];
	m = block.match(/<media:content[^>]*url="([^"]+)"/i);
	if (m) return m[1];
	m = block.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
	if (m) return m[1];
	m = block.match(/<img[^>]*src="([^"]+)"/i); // kadang gambar ada di dalam <description>
	if (m) return m[1];
	return null;
}

function classify(text) {
	const t = (text || '').toLowerCase();
	if (/(kripto|crypto|bitcoin|\bbtc\b|ethereum|\beth\b|blockchain|aset digital|token kripto|\bkoin\b|\bnft\b|binance|solana|dogecoin)/.test(t)) return 'Crypto';
	if (/(saham|ihsg|emiten|bursa efek|\bbei\b|dividen|\bipo\b|\brups\b|indeks harga saham|\blq45\b|right issue)/.test(t)) return 'Saham';
	return 'Ekonomi';
}

function trimDesc(s, n = 220) {
	if (!s) return '';
	if (s.length <= n) return s;
	const cut = s.slice(0, n);
	const sp = cut.lastIndexOf(' ');
	return (sp > 60 ? cut.slice(0, sp) : cut).trim() + '\u2026';
}

function relTime(d) {
	const diff = Date.now() - d.getTime();
	const m = Math.round(diff / 60000);
	if (m < 1) return 'Baru saja';
	if (m < 60) return m + ' menit lalu';
	const h = Math.round(m / 60);
	if (h < 24) return h + ' jam lalu';
	const hari = Math.round(h / 24);
	return hari + ' hari lalu';
}

function fmtDate(d) {
	const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
	return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

// Parse tanggal Indonesia "2 Jul 2026" -> ms (untuk arsip lama tanpa ts).
function parseIndoDate(s) {
	if (!s) return 0;
	const bulan = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5, Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11 };
	const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
	if (!m) return 0;
	const mo = bulan[m[2]];
	if (mo === undefined) return 0;
	return new Date(parseInt(m[3], 10), mo, parseInt(m[1], 10)).getTime();
}

async function fetchFeed(feed) {
	try {
		const res = await fetch(feed.url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KabarMarketBot/1.0)' },
			redirect: 'follow',
		});
		if (!res.ok) { console.error('  [skip]', feed.url, '->', res.status); return []; }
		const xml = await res.text();
		const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
		const out = [];
		for (const it of items) {
			const title = decode(tag(it, 'title'));
			const desc = decode(tag(it, 'description') || tag(it, 'summary'));
			let link = decode(tag(it, 'link'));
			if (!link) link = decode(tag(it, 'guid'));
			const pub = decode(tag(it, 'pubDate') || tag(it, 'dc:date'));
			if (!title || !link) continue;
			const when = pub && !isNaN(Date.parse(pub)) ? new Date(pub) : new Date();
			out.push({
				title,
				desc: trimDesc(desc || title),
				url: link,
				image: imageOf(it),
				source: feed.source,
				cat: feed.cat || null,
				region: feed.region || 'Indonesia',
				translate: feed.translate || false,
				when,
			});
		}
		console.error('  [ok]  ', feed.url, '->', out.length, 'item');
		return out;
	} catch (e) {
		console.error('  [err] ', feed.url, '->', e.message);
		return [];
	}
}

// --- Terjemahan otomatis ke Bahasa Indonesia (gratis, tanpa API key) ---
async function translateId(text) {
	const s = (text || '').trim();
	if (!s) return text;
	try {
		const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=' + encodeURIComponent(s);
		const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KabarMarketBot/1.0)' } });
		if (!res.ok) return text;
		const data = await res.json();
		if (!Array.isArray(data) || !Array.isArray(data[0])) return text;
		const out = data[0].map((seg) => (seg && seg[0]) ? seg[0] : '').join('');
		return out || text;
	} catch (e) {
		console.error('  [translate err]', e.message);
		return text;
	}
}

async function main() {
	const FEEDS = loadFeeds();
	console.error('Mengambil', FEEDS.length, 'RSS feed...');
	const results = await Promise.all(FEEDS.map(fetchFeed));
	const raw = [].concat(...results);

	// Dedupe berdasarkan judul (normalisasi)
	const seen = new Set();
	const unique = [];
	for (const a of raw) {
		const key = a.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(a);
	}

	// Urutkan terbaru dulu
	unique.sort((a, b) => b.when - a.when);

	// Saring berita berkualitas (buang promosi/iklan/hiburan).
	const quality = unique.filter(isQuality);
	console.error('Setelah filter kualitas:', quality.length, 'dari', unique.length, 'berita');

	// Kelompokkan ke kategori (simpan hingga ARCHIVE_PER_CAT agar berita lama tak hilang)
	const buckets = { Ekonomi: [], Saham: [], Crypto: [] };
	for (const a of quality) {
		const cat = a.cat || classify(a.title + ' ' + a.desc);
		if (buckets[cat].length >= ARCHIVE_PER_CAT) continue;
		buckets[cat].push(a);
	}

	// Jika Crypto/Saham kurang, biarkan apa adanya (Ekonomi biasanya paling banyak).
	const articles = [];
	for (const cat of ['Ekonomi', 'Saham', 'Crypto']) {
		let added = 0;
		for (const a of buckets[cat]) {
			let tTitle = a.title, tDesc = a.desc;
			if (DO_TRANSLATE && a.translate) {
				tTitle = await translateId(a.title);
				tDesc = await translateId(a.desc);
			}
			articles.push({
				cat,
				title: tTitle,
				desc: tDesc,
				time: relTime(a.when),
				date: fmtDate(a.when),
				source: a.source,
				url: a.url,
				region: a.region || 'Indonesia',
				image: a.image || null,
				source_icon: null,
				ts: (a.when instanceof Date ? a.when : new Date(a.when)).toISOString(), // waktu absolut untuk urutan & merge
				highlight: false, // ditentukan ulang setelah merge
				body: [tDesc],
			});
			added++;
		}
	}

	if (articles.length === 0) {
		console.error('Tidak ada berita terambil - news.json TIDAK diubah.');
		process.exit(1);
	}

	const outPath = path.join(__dirname, '..', 'news.json');

	// --- Gabungkan dengan arsip lama agar berita lama TIDAK hilang ---
	let existing = [];
	try {
		const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
		existing = Array.isArray(prev) ? prev : (prev && prev.articles) || [];
	} catch (_) { existing = []; }

	function keyOf(a) {
		const u = (a.url || '').trim();
		if (u) return 'u:' + u;
		return 't:' + (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
	}
	function tsOf(a) {
		if (a.ts) { const p = Date.parse(a.ts); if (!isNaN(p)) return p; }
		return parseIndoDate(a.date);
	}

	// Berita baru diutamakan, lalu arsip lama yang belum ada.
	const merged = new Map();
	for (const a of articles) { const k = keyOf(a); if (!merged.has(k)) merged.set(k, a); }
	for (const a of existing) {
		if (!isQuality(a)) continue; // arsip lama pun ikut disaring kualitasnya
		const k = keyOf(a);
		if (!merged.has(k)) merged.set(k, a);
	}

	// Kelompokkan ulang per kategori, urutkan terbaru dulu, batasi arsip.
	const finalBuckets = { Ekonomi: [], Saham: [], Crypto: [] };
	for (const a of merged.values()) {
		const cat = ['Ekonomi', 'Saham', 'Crypto'].includes(a.cat) ? a.cat : classify((a.title || '') + ' ' + (a.desc || ''));
		a.cat = cat;
		finalBuckets[cat].push(a);
	}

	const finalArticles = [];
	for (const cat of ['Ekonomi', 'Saham', 'Crypto']) {
		let list = finalBuckets[cat];
		list.sort((x, y) => tsOf(y) - tsOf(x));   // terbaru dulu
		list = list.slice(0, ARCHIVE_PER_CAT);    // arsip maksimum per kategori
		list.forEach((a, i) => {
			if (a.ts) { const d = new Date(a.ts); a.time = relTime(d); a.date = fmtDate(d); } // segarkan waktu relatif
			a.highlight = i === 0;                 // berita terbaru per kategori = "Populer"
			a.title = stripDash(a.title);          // bersihkan em/en dash dari konten berita
			a.desc = stripDash(a.desc);
			if (Array.isArray(a.body)) a.body = a.body.map(stripDash);
		});
		finalArticles.push(...list);
	}

	const payload = { updated: new Date().toISOString(), articles: finalArticles };
	fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
	console.error('OK: ' + finalArticles.length + ' berita ditulis ke news.json (arsip digabung)');
	console.error('  Ekonomi=' + finalBuckets.Ekonomi.length + ' Saham=' + finalBuckets.Saham.length + ' Crypto=' + finalBuckets.Crypto.length);
}

main();
