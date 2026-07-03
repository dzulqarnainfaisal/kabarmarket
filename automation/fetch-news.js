#!/usr/bin/env node
/*
 * fetch-news.js  —  Pengambil berita Kabar Market via RSS media Indonesia.
 * ---------------------------------------------------------------------------
 * REAL-TIME, GRATIS, TANPA API KEY.
 * Mengambil langsung dari RSS resmi media (ANTARA, Detik Finance, CNBC
 * Indonesia, Tempo, Liputan6, dll), lalu mengelompokkan ke Ekonomi / Saham /
 * Crypto berdasarkan kata kunci, dan menyimpan ke ../news.json.
 *
 * Gaya agregator: hanya judul + ringkasan + tautan ke sumber asli (bukan
 * menyalin isi penuh) — aman hak cipta, seperti Google News.
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
];

function loadFeeds() {
	const env = (process.env.NEWS_FEEDS || '').trim();
	if (!env) return DEFAULT_FEEDS;
	return env.split(',').map((chunk) => {
		const [url, source] = chunk.split('|').map((s) => (s || '').trim());
		return { url, source: source || hostOf(url) };
	}).filter((f) => f.url);
}

const PER_CAT = 6; // jumlah berita per kategori

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

	// Kelompokkan ke kategori
	const buckets = { Ekonomi: [], Saham: [], Crypto: [] };
	for (const a of unique) {
		const cat = classify(a.title + ' ' + a.desc);
		if (buckets[cat].length >= PER_CAT) continue;
		buckets[cat].push(a);
	}

	// Jika Crypto/Saham kurang, biarkan apa adanya (Ekonomi biasanya paling banyak).
	const articles = [];
	for (const cat of ['Ekonomi', 'Saham', 'Crypto']) {
		let added = 0;
		for (const a of buckets[cat]) {
			articles.push({
				cat,
				title: a.title,
				desc: a.desc,
				time: relTime(a.when),
				date: fmtDate(a.when),
				source: a.source,
				url: a.url,
				image: a.image || null,
				source_icon: null,
				highlight: added === 0, // berita terbaru tiap kategori jadi "Populer"
				body: [a.desc],
			});
			added++;
		}
	}

	if (articles.length === 0) {
		console.error('Tidak ada berita terambil — news.json TIDAK diubah.');
		process.exit(1);
	}

	const outPath = path.join(__dirname, '..', 'news.json');
	const payload = { updated: new Date().toISOString(), articles };
	fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
	console.error('OK: ' + articles.length + ' berita ditulis ke news.json');
	console.error('  Ekonomi=' + buckets.Ekonomi.length + ' Saham=' + buckets.Saham.length + ' Crypto=' + buckets.Crypto.length);
}

main();
