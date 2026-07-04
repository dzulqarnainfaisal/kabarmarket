
  // Jam realtime WIB + status Pasar (jam Bursa Efek Indonesia / IDX)
  // Hari libur bursa 2026 = libur nasional + cuti bersama (SKB 3 Menteri & Kalender Libur Bursa BEI 2026)
  const HARI_LIBUR_BURSA = new Set([
    '2026-01-01','2026-01-16','2026-02-16','2026-02-17','2026-03-18','2026-03-19',
    '2026-03-20','2026-03-23','2026-03-24','2026-04-03','2026-05-01','2026-05-14',
    '2026-05-15','2026-05-27','2026-05-28','2026-06-01','2026-06-16','2026-08-17',
    '2026-08-25','2026-12-24','2026-12-25','2026-12-31'
  ]);
  const wibFmt = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Jakarta', hour12:false,
    weekday:'short', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit' });
  function statusPasar(p){
    const tgl = p.year + '-' + p.month + '-' + p.day;
    const hari = p.weekday;
    if(hari === 'Sat' || hari === 'Sun') return 'closed';
    if(HARI_LIBUR_BURSA.has(tgl)) return 'closed';
    const menit = parseInt(p.hour,10)*60 + parseInt(p.minute,10);
    const jumat = (hari === 'Fri');
    const s1buka = 9*60;                        // 09:00
    const s1tutup = jumat ? (11*60+30) : (12*60);   // Jumat 11:30, lainnya 12:00
    const s2buka = jumat ? (14*60) : (13*60+30);    // Jumat 14:00, lainnya 13:30
    const s2tutup = 15*60+49;                   // 15:49
    if(menit >= s1buka && menit < s1tutup) return 'open';
    if(menit >= s2buka && menit <= s2tutup) return 'open';
    if(menit >= s1tutup && menit < s2buka) return 'break';
    return 'closed';
  }
  const LABEL_PASAR = { open:'Pasar buka', break:'Istirahat siang', closed:'Pasar tutup' };
  function updateClock(){
    const parts = {};
    wibFmt.formatToParts(new Date()).forEach(function(x){ parts[x.type] = x.value; });
    const clockEl = document.getElementById('clock');
    if(clockEl) clockEl.textContent = parts.hour + ':' + parts.minute + ':' + parts.second + ' WIB';
    const st = statusPasar(parts);
    const labelEl = document.getElementById('marketLabel');
    if(labelEl) labelEl.textContent = LABEL_PASAR[st];
    const dotEl = document.getElementById('marketDot');
    if(dotEl) dotEl.className = 'live is-' + st;
  }
  setInterval(updateClock, 1000); updateClock();

  // Menu mobile (tombol garis tiga / hamburger)
  (function(){
    const btn = document.getElementById('hamburgerBtn');
    const menu = document.getElementById('navLinks');
    if(!btn || !menu) return;
    btn.addEventListener('click', function(){
      const open = menu.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        menu.classList.remove('open');
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded','false');
      });
    });
  })();

  const CG_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana&vs_currencies=usd&include_24hr_change=true';
  // ===== DATA PASAR LIVE =====
  // Sumber data:
  //  - Crypto (BTC, ETH, BNB, SOL): CoinGecko -> live langsung di browser (refresh 60 dtk)
  //  - IHSG, USD/IDR, S&P 500, BBCA: file prices.json yang diisi otomatis oleh
  //    GitHub Actions dari Yahoo Finance (aktif setelah website online). Refresh 5 mnt.
  //  - Jika keduanya gagal (mis. dibuka offline): tampilkan data contoh (fallback).

  const marketFallback = {
    'IHSG':    {label:'IHSG',           value:7412.88, change:0.42,  fmt:'id'},
    'USD/IDR': {label:'USD/IDR',        value:16245,   change:-0.08, fmt:'id'},
    'BTC':     {label:'Bitcoin (BTC)',  value:67230,   change:1.85,  fmt:'usd'},
    'ETH':     {label:'Ethereum (ETH)', value:3512,    change:0.94,  fmt:'usd'},
    'BBCA':    {label:'BBCA',           value:9875,    change:0.25,  fmt:'id'},
    'BBRI':    {label:'BBRI',           value:4520,    change:0.67,  fmt:'id'},
    'BMRI':    {label:'BMRI',           value:6875,    change:-0.36, fmt:'id'},
    'TLKM':    {label:'TLKM',           value:3180,    change:0.32,  fmt:'id'},
    'ASII':    {label:'ASII',           value:5125,    change:-0.19, fmt:'id'},
    'S&P 500': {label:'S&P 500',        value:5980.12, change:-0.15, fmt:'id'},
    'BNB':     {label:'BNB',            value:585,     change:0.5,   fmt:'usd'},
    'SOL':     {label:'SOL',            value:168.4,   change:-2.1,  fmt:'usd'},
  };
  const market = JSON.parse(JSON.stringify(marketFallback));

  function fmtNum(v, kind){
    if(kind==='usd') return '$'+Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
    return Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});
  }
  function chgStr(c){ const up=Number(c)>=0; return {txt:(up?'+':'')+Number(c).toFixed(2)+'%', up}; }

  function renderTicker(){
    const order=['IHSG','USD/IDR','BBCA','BBRI','BMRI','TLKM','ASII','BTC','ETH','BNB','SOL','S&P 500'];
    const strip=document.getElementById('tickerStrip'); if(!strip) return;
    const build=()=>order.map(k=>{
      const m=market[k]; const c=chgStr(m.change);
      return `<span class="tick"><span class="name">${k}</span><span class="val">${fmtNum(m.value,m.fmt)}</span><span class="${c.up?'up':'down'}">${c.txt} ${c.up?'▲':'▼'}</span></span>`;
    }).join('');
    strip.innerHTML = build()+build();
  }

  function renderSnapshot(){
    const keys=['IHSG','BTC','ETH','USD/IDR'];
    const grid=document.getElementById('snapGrid'); if(!grid) return;
    grid.innerHTML = keys.map(k=>{
      const m=market[k]; const c=chgStr(m.change);
      return `<div class="snap-card"><div class="label">${m.label}</div><div class="value mono">${fmtNum(m.value,m.fmt)}</div><div class="change mono ${c.up?'up':'down'}">${c.txt} ${c.up?'▲':'▼'}</div></div>`;
    }).join('');
  }
  function renderMarket(){ renderTicker(); renderSnapshot(); }
  renderMarket();

  const snapNote=document.getElementById('snapNote');
  let cryptoOK=false, stocksOK=false;
  function updateNote(){
    if(cryptoOK && stocksOK) snapNote.textContent='Crypto: CoinGecko (realtime) · Pasar: Yahoo Finance (delay ~15 mnt)';
    else if(cryptoOK) snapNote.textContent='Harga crypto live · IHSG & USD/IDR pakai data contoh';
    else if(stocksOK) snapNote.textContent='Harga pasar live (delay ~15 mnt) · crypto pakai data contoh';
    else snapNote.textContent='Menampilkan data contoh (harga live belum tersedia)';
  }

  // 1) Crypto live via CoinGecko (CORS terbuka, tanpa API key)
  async function loadCrypto(){
    try{
      const res=await fetch(CG_URL,{cache:'no-store'});
      if(!res.ok) throw 0;
      const d=await res.json();
      const map={BTC:'bitcoin',ETH:'ethereum',BNB:'binancecoin',SOL:'solana'};
      for(const k in map){ const o=d[map[k]]; if(o && typeof o.usd==='number'){ market[k].value=o.usd; if(typeof o.usd_24h_change==='number') market[k].change=o.usd_24h_change; } }
      cryptoOK=true;
    }catch(e){ /* pakai fallback */ }
    renderMarket(); updateNote();
  }

  // 2) IHSG, USD/IDR, S&P 500, BBCA via prices.json (diisi otomatis oleh server)
  async function loadStocks(){
    try{
      const res=await fetch('prices.json',{cache:'no-store'});
      if(!res.ok) throw 0;
      const d=await res.json();
      const list=d.items||d;
      for(const k in list){ if(market[k]){ if(typeof list[k].value==='number') market[k].value=list[k].value; if(typeof list[k].change==='number') market[k].change=list[k].change; } }
      stocksOK=true;
    }catch(e){ /* pakai fallback */ }
    renderMarket(); updateNote();
  }

  loadCrypto(); loadStocks();
  setInterval(loadCrypto, 60000);   // crypto tiap 60 detik
  setInterval(loadStocks, 300000);  // pasar tiap 5 menit

  // Data berita contoh
  let articles = [
    {cat:'Ekonomi', image:'data:image/jpeg;base64,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', highlight:true, title:'Inflasi Terkendali, Bank Sentral Isyaratkan Suku Bunga Tetap', desc:'Data terbaru menunjukkan tekanan harga bahan pokok mereda, membuka ruang bagi kebijakan moneter yang lebih akomodatif.', time:'1 jam lalu', date:'2 Jul 2026', source:'Redaksi Kabar Market', body:['Data inflasi terbaru menunjukkan tekanan harga pada kelompok bahan pokok mulai mereda dibanding bulan-bulan sebelumnya. Kondisi ini memberi ruang bagi bank sentral untuk menahan suku bunga acuan di level saat ini.', 'Bagi pelaku pasar, suku bunga yang stabil umumnya dianggap positif untuk sektor yang sensitif terhadap biaya pinjaman, seperti properti dan otomotif. Meski begitu, arah kebijakan ke depan tetap bergantung pada data ekonomi berikutnya.']},
    {cat:'Saham', image:'data:image/jpeg;base64,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', highlight:true, title:'Sektor Energi Pimpin Penguatan IHSG Pekan Ini', desc:'Saham-saham tambang batu bara dan minyak mencatat kenaikan signifikan seiring lonjakan harga komoditas global.', time:'3 jam lalu', date:'2 Jul 2026', source:'Redaksi Kabar Market', body:['Indeks Harga Saham Gabungan (IHSG) menguat pekan ini dengan sektor energi sebagai penopang utama. Saham-saham tambang batu bara dan minyak mencatat kenaikan seiring pergerakan harga komoditas global.', 'Kenaikan pada satu sektor tidak selalu mencerminkan kondisi seluruh pasar. Investor biasanya melihat pergerakan indeks sektoral untuk memahami sektor mana yang sedang menjadi perhatian pelaku pasar.']},
    {cat:'Crypto', image:'data:image/jpeg;base64,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', highlight:true, title:'Regulator Siapkan Aturan Baru untuk Bursa Aset Kripto', desc:'Rancangan regulasi ini bertujuan memperkuat perlindungan investor ritel di tengah pertumbuhan pesat adopsi kripto.', time:'4 jam lalu', date:'2 Jul 2026', source:'Redaksi Kabar Market', body:['Regulator dilaporkan tengah menyiapkan rancangan aturan baru yang bertujuan memperkuat perlindungan bagi investor ritel di pasar aset kripto. Aturan ini muncul di tengah pertumbuhan adopsi kripto yang cukup pesat.', 'Regulasi yang lebih jelas sering dipandang sebagai langkah untuk meningkatkan kepercayaan pengguna. Namun, dampaknya terhadap pasar bisa beragam dan biasanya baru terlihat setelah aturan resmi diberlakukan.']},
    {cat:'Ekonomi', image:'data:image/jpeg;base64,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', title:'Neraca Dagang Surplus, Ekspor Manufaktur Jadi Penopang', desc:'Surplus perdagangan bulan ini didorong oleh permintaan ekspor produk manufaktur bernilai tambah tinggi.', time:'6 jam lalu', date:'2 Jul 2026', source:'Redaksi Kabar Market', body:['Neraca perdagangan kembali mencatat surplus pada periode ini, dengan ekspor produk manufaktur bernilai tambah tinggi sebagai pendorong utama. Surplus terjadi ketika nilai ekspor melampaui nilai impor.', 'Surplus perdagangan yang konsisten umumnya dianggap sebagai sinyal positif bagi stabilitas nilai tukar. Meski demikian, komposisi ekspor dan impor tetap penting untuk menilai kualitas surplus tersebut.']},
    {cat:'Saham', image:'data:image/jpeg;base64,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', title:'IPO Startup Teknologi Kelebihan Permintaan 12 Kali Lipat', desc:'Antusiasme investor terhadap penawaran saham perdana ini mencerminkan optimisme terhadap sektor digital.', time:'7 jam lalu', date:'2 Jul 2026', source:'Redaksi Kabar Market', body:['Sebuah startup teknologi mencatat kelebihan permintaan hingga belasan kali lipat pada penawaran saham perdananya (IPO). Antusiasme tinggi ini mencerminkan minat investor terhadap sektor digital.', 'Kelebihan permintaan saat IPO tidak menjamin pergerakan harga setelah saham tercatat di bursa. Harga saham pasca-IPO tetap dipengaruhi kinerja perusahaan dan kondisi pasar secara keseluruhan.']},
    {cat:'Crypto', image:'data:image/jpeg;base64,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', title:'Volume Perdagangan Altcoin Melonjak Usai Update Jaringan', desc:'Peningkatan efisiensi jaringan mendorong minat trader terhadap sejumlah token dengan kapitalisasi menengah.', time:'8 jam lalu', date:'2 Jul 2026', source:'Redaksi Kabar Market', body:['Volume perdagangan sejumlah altcoin melonjak setelah pembaruan jaringan yang meningkatkan efisiensi transaksi. Peningkatan aktivitas ini menarik perhatian trader terhadap token berkapitalisasi menengah.', 'Lonjakan volume dalam waktu singkat dapat disertai volatilitas harga yang tinggi. Karena itu, memahami dasar teknologi dan risiko masing-masing aset tetap penting sebelum mengambil keputusan.']},
  ];
  let currentCat = 'Semua';
  let currentSearch = '';
  let currentRegion = 'Semua';
  const pillClass = {Ekonomi:'ekonomi', Saham:'saham', Crypto:'crypto'};
  function deepCleanDash(v){
    if (typeof v === "string") return v.replace(/[\u2014\u2013]/g, "-");
    if (Array.isArray(v)) return v.map(deepCleanDash);
    if (v && typeof v === "object"){ var o={}; for (var k in v) o[k]=deepCleanDash(v[k]); return o; }
    return v;
  }
  function renderNews(){
    if((window.KM_PAGE||{}).home){ renderHome(); return; }
    const grid = document.getElementById('newsGrid');
    if(!grid) return;
    var __cat = (window.KM_PAGE||{}).cat || currentCat;
    let list = __cat === 'Semua' ? articles.slice() : articles.filter(a => a.cat === __cat);
    const q = currentSearch.trim().toLowerCase();
    if(q){
      list = articles.filter(a => searchHaystack(a).includes(q));
    }
    if(__cat === 'Saham' && currentRegion !== 'Semua'){
      list = list.filter(a => (a.region || 'Indonesia') === currentRegion);
    }
    if(list.length === 0){
      grid.innerHTML = '<p class="no-result">Tidak ada berita yang cocok dengan pencarianmu.</p>';
      renderPager('pagination',1,1,null);
      return;
    }
    list.sort((a,b)=>(b.highlight?1:0)-(a.highlight?1:0));
    list = paginateList(list, 'pagination', function(){ renderNews(); scrollToEl('berita'); });
    grid.innerHTML = list.map(a => `
      <button class="card news-card-btn${a.highlight ? ' is-popular' : ''}" data-idx="${articles.indexOf(a)}">
        ${a.highlight ? '<span class="popular-badge">🔥 Populer</span>' : ''}
        ${a.image ? `<img class="card-img" src="${a.image}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <span class="pill ${pillClass[a.cat]}">${a.cat}</span>
        <h3>${a.title}</h3>
        <p>${a.desc}</p>
        <div class="meta-row card-meta">
          <span class="card-source">${a.source}</span>
          <span>·</span>
          <span>${a.date}</span>
          <span>·</span>
          <span>${a.time}</span>
        </div>
        <span class="read-more">Baca selengkapnya →</span>
        <div class="disclaimer-inline"><span class="mark">⚠</span><span>Bukan ajakan membeli/menjual.</span></div>
      </button>
    `).join('');
    document.querySelectorAll('.news-card-btn').forEach(card => {
      card.addEventListener('click', () => openNewsModal(parseInt(card.dataset.idx)));
    });
  }
  function renderHighlights(){
    if(!articles || !articles.length) return;
    if(!document.getElementById('heroMainClick')) return;
    const pick = []; const used = new Set();
    ['Ekonomi','Saham','Crypto'].forEach(c => {
      const i = articles.findIndex((a, idx) => a.cat === c && !used.has(idx));
      if(i >= 0){ pick.push(i); used.add(i); }
    });
    for(let i = 0; i < articles.length && pick.length < 3; i++){ if(!used.has(i)){ pick.push(i); used.add(i); } }
    const m = articles[pick[0]];
    if(m){
      const mp = document.getElementById('heroMainPill');
      mp.className = 'pill ' + (pillClass[m.cat] || '');
      mp.textContent = m.cat;
      var __hImg = document.getElementById('heroMainImg');
      if(__hImg){ if(m.image){ __hImg.src = m.image; __hImg.style.display = ''; __hImg.onerror = function(){ __hImg.style.display = 'none'; }; } else { __hImg.removeAttribute('src'); __hImg.style.display = 'none'; } }
      document.getElementById('heroMainTitle').textContent = m.title;
      document.getElementById('heroMainDesc').textContent = m.desc;
      document.getElementById('heroMainMeta').textContent = (m.source || '') + (m.time ? ' · ' + m.time : '');
      document.getElementById('heroMainClick').onclick = () => openNewsModal(pick[0]);
    }
    [0,1].forEach(k => {
      const idx = pick[k+1];
      const card = document.getElementById('heroSide' + k);
      if(!card) return;
      if(idx === undefined){ card.style.display = 'none'; return; }
      const a = articles[idx];
      card.style.display = '';
      var __sImg = document.getElementById('heroSide' + k + 'Img');
      if(__sImg){ if(a.image){ __sImg.src = a.image; __sImg.style.display=''; __sImg.onerror=function(){ __sImg.style.display='none'; }; } else { __sImg.removeAttribute('src'); __sImg.style.display='none'; } }
      const eb = document.getElementById('heroSide' + k + 'Eyebrow');
      eb.textContent = a.cat;
      eb.style.color = a.cat === 'Saham' ? 'var(--gain)' : (a.cat === 'Crypto' ? 'var(--gold)' : (a.cat === 'Investasi' ? '#9db4f0' : 'var(--muted)'));
      document.getElementById('heroSide' + k + 'Title').textContent = a.title;
      const sp = document.getElementById('heroSide' + k + 'Pill');
      sp.className = 'pill ' + (pillClass[a.cat] || '');
      sp.textContent = a.cat;
      document.getElementById('heroSide' + k + 'Time').textContent = a.time || '';
      card.style.cursor = 'pointer';
      card.onclick = () => openNewsModal(idx);
    });
  }
  renderNews();
  renderHighlights();

  // Muat berita otomatis dari news.json (diperbarui oleh skrip otomatisasi).
  // Jika file belum ada (mis. dibuka langsung sebagai file lokal), pakai berita contoh di atas.
  fetch('news.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const list = Array.isArray(data) ? data : (data && data.articles);
      if (Array.isArray(list) && list.length) { articles = deepCleanDash(list); renderNews(); renderHighlights(); }
    })
    .catch(() => {});

  document.querySelectorAll('#filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.filter;
      renderNews();
    });
  });

  document.querySelectorAll('#regionFilter .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#regionFilter .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRegion = btn.dataset.region;
      setPageParam(1);
      renderNews();
    });
  });

  const newsSearchInput = document.getElementById('newsSearch');
  if(newsSearchInput){
    newsSearchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      setPageParam(1);
      renderNews();
    });
    // Dukung pencarian via URL (?q=...) untuk Sitelinks Searchbox Google
    try {
      const q = new URLSearchParams(location.search).get('q');
      if (q) {
        currentSearch = q;
        newsSearchInput.value = q;
        renderNews();
      }
    } catch (err) {}
  }

  document.querySelectorAll('nav.links a[data-filter]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const f = link.dataset.filter;
      currentCat = f;
      document.querySelectorAll('#filters .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
      renderNews();
      const sec = document.getElementById('berita');
      if(sec) sec.scrollIntoView({behavior:'smooth'});
    });
  });

  // ===== DATA EDUKASI =====
  const eduArticles = [
    {
      cat:'Saham',
      title:'Apa Itu Saham dan Bagaimana Cara Kerjanya',
      summary:'Kenalan dengan konsep dasar kepemilikan perusahaan lewat saham, sebelum masuk ke istilah yang lebih teknis.',
      body:[
        'Saham adalah bukti kepemilikan atas sebagian kecil sebuah perusahaan. Saat kamu membeli saham, secara teknis kamu memiliki persentase kecil dari perusahaan tersebut, sebanding dengan jumlah saham yang kamu pegang dibanding total saham yang beredar.',
        'Perusahaan menjual saham ke publik lewat proses yang disebut IPO (Initial Public Offering) untuk mengumpulkan dana segar, misalnya buat ekspansi bisnis. Setelah itu, saham diperjualbelikan antar investor di bursa efek, harganya naik-turun tergantung permintaan dan penawaran.',
        'Ada dua cara utama investor mendapat keuntungan dari saham: kenaikan harga (capital gain) saat dijual lebih mahal dari harga beli, dan dividen, yaitu pembagian sebagian laba perusahaan ke pemegang saham secara berkala.'
      ],
      referralText:'Kalau kamu ingin mulai memantau atau membeli saham, kamu perlu akun di aplikasi sekuritas yang terdaftar dan diawasi OJK.',
      referralBtn:'Lihat Aplikasi Sekuritas',
      referralUrl:'#'
    },
    {
      cat:'Saham',
      title:'Mengenal IHSG dan Fungsinya',
      summary:'Kenapa angka IHSG sering disebut di berita, dan apa artinya buat investor pemula.',
      body:[
        'IHSG (Indeks Harga Saham Gabungan) adalah angka yang menggambarkan pergerakan rata-rata harga seluruh saham yang tercatat di Bursa Efek Indonesia. Kalau IHSG naik, secara umum artinya mayoritas saham di bursa sedang menguat, begitu juga sebaliknya.',
        'IHSG berguna sebagai indikator kesehatan pasar saham secara keseluruhan, bukan patokan satu saham tertentu. Investor sering memakainya untuk melihat tren besar (bullish/bearish) sebelum menganalisis saham spesifik.',
        'Selain IHSG, ada juga indeks-indeks sektoral (misalnya indeks perbankan, indeks energi) yang mengukur pergerakan kelompok saham tertentu saja.'
      ],
      referralText:'Untuk memantau pergerakan IHSG dan saham secara real-time, kamu butuh aplikasi trading dengan data pasar langsung.',
      referralBtn:'Coba Aplikasi Trading',
      referralUrl:'#'
    },
    {
      cat:'Saham',
      title:'Cara Membuka Rekening Efek untuk Pemula',
      summary:'Langkah-langkah umum yang biasanya dilalui sebelum bisa mulai membeli saham pertamamu.',
      body:[
        'Untuk membeli saham, kamu perlu membuka Rekening Dana Nasabah (RDN) melalui perusahaan sekuritas yang terdaftar resmi di OJK dan Bursa Efek Indonesia. Prosesnya kini umumnya bisa dilakukan online lewat aplikasi.',
        'Dokumen yang biasanya dibutuhkan: KTP, NPWP (opsional di beberapa sekuritas), buku tabungan, dan foto/tanda tangan digital. Proses verifikasi umumnya memakan waktu 1-3 hari kerja.',
        'Setelah akun aktif, kamu perlu menyetor dana ke RDN sebelum bisa mulai membeli saham. Banyak sekuritas kini membolehkan modal awal yang relatif kecil, jadi kamu bisa mulai belajar dengan nominal yang nyaman buatmu.'
      ],
      referralText:'Beberapa aplikasi sekuritas menawarkan proses pendaftaran cepat dan modal awal kecil, cocok untuk pemula.',
      referralBtn:'Buka Rekening Efek',
      referralUrl:'#'
    },
    {
      cat:'Crypto',
      title:'Apa Itu Cryptocurrency dan Blockchain',
      summary:'Dasar-dasar teknologi di balik Bitcoin dan aset kripto lainnya, dijelaskan tanpa istilah yang bikin pusing.',
      body:[
        'Cryptocurrency adalah aset digital yang menggunakan kriptografi untuk mengamankan transaksi dan mengontrol pembuatan unit baru. Berbeda dengan uang konvensional, cryptocurrency tidak dikelola oleh bank sentral atau pemerintah tertentu.',
        'Teknologi di baliknya disebut blockchain, yaitu buku catatan digital yang tersebar di banyak komputer (node) sekaligus. Setiap transaksi dicatat dalam "blok" yang saling terhubung, sehingga sulit diubah atau dipalsukan tanpa terdeteksi.',
        'Bitcoin adalah cryptocurrency pertama, diperkenalkan tahun 2009. Setelahnya, muncul ribuan cryptocurrency lain (disebut altcoin) dengan tujuan dan teknologi yang berbeda-beda, dari Ethereum yang mendukung aplikasi terdesentralisasi, hingga stablecoin yang nilainya dipatok ke mata uang fiat.'
      ],
      referralText:'Untuk mulai memiliki aset kripto, kamu memerlukan akun di exchange (bursa kripto) yang legal dan terdaftar serta diawasi OJK.',
      referralBtn:'Lihat Exchange Kripto',
      referralUrl:'#'
    },
    {
      cat:'Crypto',
      title:'Apa Itu Wallet dan Cara Menyimpan Aset Kripto dengan Aman',
      summary:'Perbedaan hot wallet dan cold wallet, serta praktik dasar menjaga keamanan aset digitalmu.',
      body:[
        'Wallet (dompet kripto) adalah alat untuk menyimpan, mengirim, dan menerima aset kripto. Wallet tidak benar-benar "menyimpan" koin secara fisik, melainkan menyimpan kunci privat (private key) yang membuktikan kepemilikanmu atas aset di blockchain.',
        'Ada dua jenis utama: hot wallet (terhubung internet, seperti aplikasi di exchange atau ponsel, praktis tapi lebih rentan diretas) dan cold wallet (perangkat fisik offline, lebih aman untuk penyimpanan jangka panjang, tapi kurang praktis untuk transaksi harian).',
        'Prinsip keamanan dasar: jangan pernah membagikan private key atau seed phrase (frasa pemulihan) ke siapa pun, termasuk pihak yang mengaku dari exchange resmi. Aktifkan autentikasi dua faktor (2FA) di setiap akun exchange yang kamu gunakan.'
      ],
      referralText:'Beberapa exchange menyediakan fitur keamanan bawaan yang memudahkan pemula mengelola aset kripto dengan lebih aman.',
      referralBtn:'Lihat Exchange Kripto',
      referralUrl:'#'
    },
    {
      cat:'Crypto',
      title:'Risiko Volatilitas dalam Investasi Kripto',
      summary:'Kenapa harga kripto bisa naik-turun tajam dalam waktu singkat, dan bagaimana bersikap terhadapnya.',
      body:[
        'Volatilitas adalah seberapa besar dan cepat harga suatu aset berubah. Aset kripto umumnya jauh lebih volatil dibanding saham atau emas, karena pasarnya masih relatif baru, likuiditasnya bervariasi antar koin, dan sangat dipengaruhi sentimen berita maupun regulasi.',
        'Pergerakan harga 10-20% dalam sehari bukan hal aneh di pasar kripto, terutama untuk koin dengan kapitalisasi pasar lebih kecil. Ini berbeda dengan pasar saham yang biasanya punya batas auto-reject harian.',
        'Karena volatilitas tinggi ini, banyak edukator finansial menyarankan agar alokasi ke aset kripto disesuaikan dengan profil risiko masing-masing individu, dan sebaiknya menggunakan dana yang memang siap menanggung fluktuasi besar, bukan dana kebutuhan pokok.'
      ],
      referralText:'Pelajari lebih lanjut fitur manajemen risiko yang biasanya tersedia di exchange kripto resmi.',
      referralBtn:'Lihat Exchange Kripto',
      referralUrl:'#'
    },
  ];

  var eduIcon = {
    Investasi: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M16 4h5v5"/></svg>',
    Saham: '<svg viewBox="0 0 24 24" fill="#fff"><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="17" rx="1"/></svg>',
    Crypto: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.52 2.75 2.084v.006z"/></svg>'
  };
  function eduCatClass(cat){ var m={Investasi:'investasi',Saham:'saham',Crypto:'crypto'}; return m[cat]||'investasi'; }
  function eduChipHTML(cat){ var cls=eduCatClass(cat); var ic=eduIcon[cat]||eduIcon.Investasi; return '<span class="edu-chip '+cls+'">'+ic+'</span>'; }
  function renderEdu(filter){
    filter = filter || currentEduFilter;
    if((window.KM_PAGE||{}).home){ renderEduPreview(); return; }
    const grid = document.getElementById('eduGrid');
    if(!grid) return;
    let list = filter === 'Semua' ? eduArticles.slice() : eduArticles.filter(a => a.cat === filter);
    const q = (currentEduSearch || '').trim().toLowerCase();
    if(q){
      list = list.filter(a => (a.title||'').toLowerCase().includes(q) || (a.summary||'').toLowerCase().includes(q) || (Array.isArray(a.body) ? a.body.join(' ').toLowerCase().includes(q) : false));
    }
    if(list.length === 0){
      grid.innerHTML = '<p class="no-result">Tidak ada materi yang cocok dengan pencarianmu.</p>';
      renderPager('eduPagination',1,1,null);
      return;
    }
    list = paginateList(list, 'eduPagination', function(){ renderEdu(currentEduFilter); scrollToEl('edukasi'); });
    grid.innerHTML = list.map((a, i) => `
      <button class="edu-card ${eduCatClass(a.cat)}" data-idx="${eduArticles.indexOf(a)}">
        ${eduChipHTML(a.cat)}
        <span class="edu-num mono">${String(i+1).padStart(2,'0')} · ${a.cat}</span>
        <h3>${a.title}</h3>
        <p>${a.summary}</p>
        <span class="read-more">Baca materi →</span>
      </button>
    `).join('');
    document.querySelectorAll('.edu-card').forEach(card => {
      card.addEventListener('click', () => openEduModal(parseInt(card.dataset.idx)));
    });
  }
  let currentEduFilter = 'Semua';
  let currentEduSearch = '';
  renderEdu(currentEduFilter);

  // Muat materi edukasi dari edu.json (kamu tulis sendiri). Jika belum ada, pakai contoh di atas.
  fetch('edu.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const list = Array.isArray(data) ? data : (data && data.articles);
      if (Array.isArray(list) && list.length) { eduArticles.length = 0; list.forEach(x => eduArticles.push(deepCleanDash(x))); renderEdu(currentEduFilter); }
    })
    .catch(() => {});

  document.querySelectorAll('#eduFilters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#eduFilters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEduFilter = btn.dataset.edufilter;
      renderEdu(currentEduFilter);
    });
  });

  const eduSearchInput = document.getElementById('eduSearch');
  if(eduSearchInput){
    eduSearchInput.addEventListener('input', (e) => {
      currentEduSearch = e.target.value;
      renderEdu(currentEduFilter);
    });
  }

  const partners = {
    Crypto: [
      {name:'Pintu', tag:'Exchange kripto lokal', url:'https://apps.pintu.co.id/fjuG/pintureferralcode', logo:'data:image/png;base64,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'},
      {name:'Binance', tag:'Exchange kripto global', url:'https://www.bmwweb.biz/referral/earn-together/refer2earn-usdc/claim?hl=id&ref=GRO_28502_8U5RM&utm_source=referral_entrance', logo:'data:image/png;base64,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'},
      {name:'MEXC', tag:'Exchange kripto global', url:'https://promote.mexc.fm/r/PweN8uAhsd', logo:'data:image/png;base64,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'},
    ],
    Saham: [
      {name:'Ajaib', tag:'Sekuritas saham lokal', url:'https://ajaib.onelink.me/SIjL/fdfkae1q', logo:'data:image/png;base64,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'},
    ],
  };
  // "Dasar Investasi" memakai referral Pintu (kripto) + Ajaib (saham) sekaligus.
  partners.Investasi = [partners.Crypto[0], partners.Saham[0]];
  function renderPartners(container, cat){
    if(!container) return false;
    const list = partners[cat] || [];
    container.innerHTML = list.map(pt => `
      <a class="partner" href="${pt.url}" target="_blank" rel="noopener sponsored nofollow">
        <span class="logo-chip"><img class="p-logo" src="${pt.logo}" alt="${pt.name}"></span>
        <span class="p-tag">${pt.tag}</span>
        <span class="p-cta">Daftar →</span>
      </a>
    `).join('');
    return list.length > 0;
  }
  const pillClassMap = {Ekonomi:'ekonomi', Saham:'saham', Crypto:'crypto', Investasi:'investasi'};
  const defaultReferralText = {
    Investasi: "Kalau kamu ingin mulai praktik langsung, kamu bisa memakai aplikasi yang sudah terdaftar dan diawasi resmi: Pintu untuk aset kripto (diawasi OJK) dan Ajaib untuk saham/reksa dana (terdaftar OJK). Tautan di bawah adalah tautan referral, kami dapat memperoleh komisi tanpa biaya tambahan untukmu.",
    Saham: "Kalau kamu ingin mulai berinvestasi saham, kamu bisa memakai Ajaib yang sudah terdaftar dan diawasi OJK. Tautan di bawah adalah tautan referral, kami dapat memperoleh komisi tanpa biaya tambahan untukmu.",
    Crypto: "Kalau kamu ingin mulai membeli aset kripto, kamu bisa memakai Pintu yang sudah terdaftar dan diawasi OJK. Tautan di bawah adalah tautan referral, kami dapat memperoleh komisi tanpa biaya tambahan untukmu.",
    _: "Tautan di bawah adalah tautan referral, kami dapat memperoleh komisi tanpa biaya tambahan untukmu."
  };
  function openEduModal(idx){
    const a = eduArticles[idx];
    var __ec = pillClassMap[a.cat] || 'investasi';
    var __eb = document.getElementById('eduModalBanner');
    if(__eb){ __eb.className = 'edu-modal-head'; __eb.innerHTML = '<span class="edu-modal-chip ' + __ec + '">' + (eduIcon[a.cat]||eduIcon.Investasi) + '</span>'; }
    document.getElementById('eduModalPill').className = 'pill ' + pillClassMap[a.cat];
    document.getElementById('eduModalPill').textContent = a.cat;
    document.getElementById('eduModalTitle').textContent = a.title;
    document.getElementById('eduModalBody').innerHTML = (a.body || []).map(p => `<p>${p}</p>`).join('');
    const eduRef = document.getElementById('eduModalReferral');
    const eduParts = partners[a.cat] || [];
    if (eduParts.length) { document.getElementById('eduModalReferralText').textContent = a.referralText || defaultReferralText[a.cat] || defaultReferralText._; eduRef.style.display = ''; renderPartners(document.getElementById('eduPartnerGrid'), a.cat); }
    else { eduRef.style.display = 'none'; }
    document.getElementById('eduModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeEduModal(){
    var __m0=document.getElementById('eduModal'); if(__m0) __m0.classList.remove('open');
    document.body.style.overflow = '';
  }
  var __emc = document.getElementById('eduModalClose');
  if(__emc){
    __emc.addEventListener('click', closeEduModal);
    document.getElementById('eduModal').addEventListener('click', (e) => { if(e.target.id === 'eduModal') closeEduModal(); });
  }
  function openNewsModal(idx){
    const a = articles[idx];
    document.getElementById('newsModalPill').className = 'pill ' + pillClass[a.cat];
    document.getElementById('newsModalPill').textContent = a.cat;
    document.getElementById('newsModalTitle').textContent = a.title;
    document.getElementById('newsModalMeta').textContent = a.source + ' · ' + a.date + ' · ' + a.time;
    const nImg = document.getElementById('newsModalImg');
    if (a.image) { nImg.src = a.image; nImg.style.display = ''; nImg.onerror = () => { nImg.style.display = 'none'; }; }
    else { nImg.removeAttribute('src'); nImg.style.display = 'none'; }
    const summary = a.desc || (a.body && a.body.length ? a.body[0] : '');
    let bodyHtml = `<p>${summary}</p>`;
    var __click = a.url ? ' href="' + a.url + '" target="_blank" rel="noopener nofollow"' : ' href="#" onclick="return false;"';
    bodyHtml += '<a class="source-more"' + __click + '>Baca selengkapnya</a>';
    document.getElementById('newsModalBody').innerHTML = bodyHtml;
    const nBox = document.getElementById('newsModalReferral');
    const nHas = renderPartners(document.getElementById('newsPartnerGrid'), a.cat);
    nBox.style.display = nHas ? '' : 'none';
    document.getElementById('newsModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeNewsModal(){
    var __m1=document.getElementById('newsModal'); if(__m1) __m1.classList.remove('open');
    document.body.style.overflow = '';
  }
  var __nmc = document.getElementById('newsModalClose');
  if(__nmc){
    __nmc.addEventListener('click', closeNewsModal);
    document.getElementById('newsModal').addEventListener('click', (e) => { if(e.target.id === 'newsModal') closeNewsModal(); });
  }
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ closeEduModal(); closeNewsModal(); closePrivacyModal(); } });
  function openPrivacyModal(){ document.getElementById('privacyModal').classList.add('open'); }
  function closePrivacyModal(){ var __m2=document.getElementById('privacyModal'); if(__m2) __m2.classList.remove('open'); }
  document.querySelectorAll('.open-privacy').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); openPrivacyModal(); }));
  // ===== NEWSLETTER FORMS (Brevo) =====
  document.querySelectorAll('form.nl-form').forEach((f) => {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = f.querySelector('input[type="email"]');
      const email = input ? input.value.trim() : '';
      const msg = f.parentElement.querySelector('.nl-msg');
      const show = (t) => { if(msg){ msg.textContent = t; msg.style.display = 'block'; } };
      if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
        show('Masukkan alamat email yang valid ya.');
        return;
      }
      const action = (f.getAttribute('action') || '').trim();
      if(action && action !== '#'){
        try {
          const data = new URLSearchParams(new FormData(f));
          fetch(action, { method: 'POST', mode: 'no-cors', body: data });
        } catch(err) {}
      }
      show('\u2713 Terima kasih! Cek email ' + email + ' untuk konfirmasi langgananmu.');
      if(input){ input.value = ''; }
    });
  });
  var __pmc = document.getElementById('privacyModalClose');
  if(__pmc){
    __pmc.addEventListener('click', closePrivacyModal);
    document.getElementById('privacyModal').addEventListener('click', (e) => { if(e.target.id === 'privacyModal') closePrivacyModal(); });
  }


  /* ===== Multi-halaman: preview, paginasi, helper ===== */
  function newsCardHTML(a){
    return '<button class="card news-card-btn'+(a.highlight?' is-popular':'')+'" data-idx="'+articles.indexOf(a)+'">'
      + (a.highlight?'<span class="popular-badge">🔥 Populer</span>':'')
      + (a.image?'<img class="card-img" src="'+a.image+'" alt="" loading="lazy" onerror="this.remove()">':'')
      + '<span class="pill '+(pillClass[a.cat]||'')+'">'+a.cat+'</span>'
      + '<h3>'+a.title+'</h3><p>'+a.desc+'</p>'
      + '<div class="meta-row card-meta"><span class="card-source">'+a.source+'</span><span>·</span><span>'+a.date+'</span><span>·</span><span>'+a.time+'</span></div>'
      + '<span class="read-more">Baca selengkapnya →</span>'
      + '<div class="disclaimer-inline"><span class="mark">⚠</span><span>Bukan ajakan membeli/menjual.</span></div>'
      + '</button>';
  }
  function bindNewsCards(){
    document.querySelectorAll('.news-card-btn').forEach(function(card){
      card.addEventListener('click', function(){ openNewsModal(parseInt(card.dataset.idx)); });
    });
  }
  function renderNewsPreviews(){
    var cats = [['Ekonomi','previewEkonomi'],['Saham','previewSaham'],['Crypto','previewCrypto']];
    cats.forEach(function(pair){
      var g = document.getElementById(pair[1]); if(!g) return;
      var list = articles.filter(function(a){ return a.cat===pair[0]; });
      list.sort(function(a,b){ return (b.highlight?1:0)-(a.highlight?1:0); });
      list = list.slice(0,6);
      if(!list.length){ g.innerHTML = '<p class="no-result">Belum ada berita '+pair[0]+'.</p>'; return; }
      g.innerHTML = list.map(newsCardHTML).join('');
    });
    bindNewsCards();
  }
  function eduCardHTML(a, i){
    return '<button class="edu-card '+eduCatClass(a.cat)+'" data-idx="'+eduArticles.indexOf(a)+'">'
      + eduChipHTML(a.cat)
      + '<span class="edu-num mono">'+String(i+1).padStart(2,'0')+' · '+a.cat+'</span>'
      + '<h3>'+a.title+'</h3><p>'+a.summary+'</p>'
      + '<span class="read-more">Baca materi →</span></button>';
  }
  function bindEduCards(){
    document.querySelectorAll('.edu-card').forEach(function(card){
      card.addEventListener('click', function(){ openEduModal(parseInt(card.dataset.idx)); });
    });
  }
  function renderEduPreview(){
    var g = document.getElementById('eduPreview'); if(!g) return;
    var list = eduArticles.slice(0,8);
    g.innerHTML = list.map(function(a,i){ return eduCardHTML(a,i); }).join('');
    bindEduCards();
  }
  function getPageParam(){
    try{ var p = parseInt(new URLSearchParams(location.search).get('page'), 10); return (p && p>0) ? p : 1; }catch(e){ return 1; }
  }
  function setPageParam(n){
    try{ var u = new URL(location.href); if(n<=1){ u.searchParams.delete('page'); } else { u.searchParams.set('page', String(n)); } history.pushState(null, '', u.toString()); }catch(e){}
  }
  function scrollToEl(id){
    var el = document.getElementById(id); if(!el) return;
    try{ window.scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' }); }catch(e){ window.scrollTo(0, Math.max(0, el.offsetTop - 70)); }
  }
  function paginateList(list, containerId, onGo){
    var per = 10;
    var pages = Math.max(1, Math.ceil(list.length / per));
    var page = Math.min(getPageParam(), pages);
    renderPager(containerId, page, pages, onGo);
    var s0 = (page - 1) * per;
    return list.slice(s0, s0 + per);
  }
  function renderPager(containerId, page, pages, onGo){
    var el = document.getElementById(containerId); if(!el) return;
    if(pages <= 1){ el.innerHTML = ''; return; }
    var h = '<button class="page-btn page-nav"'+(page<=1?' disabled':'')+' data-go="'+(page-1)+'">← Sebelumnya</button>';
    var i;
    for(i=1; i<=pages; i++){ h += '<button class="page-btn'+(i===page?' active':'')+'" data-go="'+i+'">'+i+'</button>'; }
    h += '<button class="page-btn page-nav"'+(page>=pages?' disabled':'')+' data-go="'+(page+1)+'">Selanjutnya →</button>';
    el.innerHTML = h;
    if(!onGo) return;
    Array.prototype.forEach.call(el.querySelectorAll('.page-btn'), function(b){
      if(b.hasAttribute('disabled')) return;
      b.addEventListener('click', function(){ var n = parseInt(b.getAttribute('data-go'), 10); setPageParam(n); onGo(); });
    });
  }
  window.addEventListener('popstate', function(){
    var p = window.KM_PAGE || {};
    if(p.cat){ renderNews(); } else if(p.edu){ renderEdu(currentEduFilter); }
  });


  /* ===== Pencarian global (judul + ringkasan + sumber + isi berita) ===== */
  function searchHaystack(a){
    var b = a.body; if(Array.isArray(b)) b = b.join(' ');
    return ((a.title||'')+' '+(a.desc||'')+' '+(a.source||'')+' '+(a.cat||'')+' '+(b||'')).toLowerCase();
  }
  function renderHome(){
    var q = (currentSearch||'').trim().toLowerCase();
    var previews = document.getElementById('homePreviews');
    var results = document.getElementById('homeSearchResults');
    if(!q){
      if(results){ results.style.display='none'; results.innerHTML=''; }
      renderPager('homeSearchPager',1,1,null);
      if(previews) previews.style.display='';
      renderNewsPreviews();
      return;
    }
    if(previews) previews.style.display='none';
    if(!results) return;
    results.style.display='';
    var list = articles.filter(function(a){ return searchHaystack(a).includes(q); });
    if(!list.length){
      results.innerHTML = '<p class="no-result">Tidak ada hasil untuk "'+q+'".</p>';
      renderPager('homeSearchPager',1,1,null);
      return;
    }
    list.sort(function(a,b){ return (b.highlight?1:0)-(a.highlight?1:0); });
    list = paginateList(list, 'homeSearchPager', function(){ renderHome(); scrollToEl('berita'); });
    results.innerHTML = list.map(newsCardHTML).join('');
    bindNewsCards();
  }
