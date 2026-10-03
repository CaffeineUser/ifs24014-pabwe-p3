'use strict';

(() => {
  const STORAGE_KEY = 'expense-tracker:v1';
  const CATEGORIES = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Gaji', 'Lainnya'];
  const TYPES = ['Pemasukan', 'Pengeluaran'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 });
  const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

  const el = {
    list: $('#list'), empty: $('#empty'), count: $('#count'), status: $('#status'),
    sumIn: $('#sum-in'), sumOut: $('#sum-out'), sumBal: $('#sum-bal'),
    q: $('#q'), fType: $('#flt-type'), fCat: $('#flt-cat'), sort: $('#sort'),
    formAdd: $('#form-add'), formEdit: $('#form-edit'), editFields: $('#edit-fields'),
    dlgEdit: $('#dlg-edit'), dlgDel: $('#dlg-del'), delMsg: $('#del-msg'), delOk: $('#del-ok')
  };

  const state = { items: load(), q: '', type: 'all', cat: 'all', sort: 'newest', editId: null, delId: null };

  /* ---------- Util ---------- */
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  const announce = (msg) => { el.status.textContent = ''; requestAnimationFrame(() => { el.status.textContent = msg; }); };
  const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  /* ---------- Persistensi ---------- */
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((t) => t && typeof t.title === 'string' && TYPES.includes(t.type) &&
        Number.isFinite(t.amount) && t.amount > 0 && isDate(t.date))
        .map((t) => ({ id: String(t.id || uid()), title: t.title, category: String(t.category || 'Lainnya'),
          amount: t.amount, type: t.type, date: t.date }));
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); }
    catch { announce('Data tidak dapat disimpan. Penyimpanan peramban penuh atau dinonaktifkan.'); }
  }

  /* ---------- Validasi ---------- */
  function validate(form) {
    const f = form.elements;
    const data = {
      title: f.title.value.trim(), category: f.category.value, type: f.type.value,
      date: f.date.value, amount: Number(f.amount.value)
    };
    const errors = {};
    if (!data.title) errors.title = 'Judul wajib diisi.';
    else if (data.title.length > 80) errors.title = 'Judul maksimal 80 karakter.';
    if (!CATEGORIES.includes(data.category)) errors.category = 'Pilih salah satu kategori.';
    if (f.amount.value.trim() === '') errors.amount = 'Jumlah wajib diisi.';
    else if (!Number.isFinite(data.amount) || data.amount <= 0) errors.amount = 'Jumlah harus berupa angka lebih dari 0.';
    if (!TYPES.includes(data.type)) errors.type = 'Pilih tipe transaksi.';
    if (!data.date) errors.date = 'Tanggal wajib diisi.';
    else if (!isDate(data.date)) errors.date = 'Format tanggal tidak valid.';

    let firstInvalid = null;
    ['title', 'category', 'amount', 'type', 'date'].forEach((name) => {
      const input = f[name];
      const msg = $(`#${input.getAttribute('aria-describedby')}`, form);
      if (errors[name]) {
        input.setAttribute('aria-invalid', 'true');
        msg.textContent = errors[name]; msg.hidden = false;
        firstInvalid = firstInvalid || input;
      } else {
        input.removeAttribute('aria-invalid');
        msg.textContent = ''; msg.hidden = true;
      }
    });
    if (firstInvalid) { firstInvalid.focus(); announce('Formulir belum valid. Periksa kolom yang ditandai.'); return null; }
    return data;
  }
  const clearErrors = (form) => {
    $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
    $$('.err', form).forEach((e) => { e.textContent = ''; e.hidden = true; });
  };

  /* ---------- Render ---------- */
  const option = (value, label = value) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };

  function visibleItems() {
    const q = state.q.toLowerCase();
    const out = state.items.filter((t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (state.type === 'all' || t.type === state.type) &&
      (state.cat === 'all' || t.category === state.cat));
    const by = {
      newest: (a, b) => b.date.localeCompare(a.date),
      oldest: (a, b) => a.date.localeCompare(b.date),
      high: (a, b) => b.amount - a.amount,
      low: (a, b) => a.amount - b.amount
    };
    return out.sort(by[state.sort]);
  }

  function renderSummary() {
    const sum = (type) => state.items.reduce((n, t) => (t.type === type ? n + t.amount : n), 0);
    const inc = sum('Pemasukan'), exp = sum('Pengeluaran');
    el.sumIn.textContent = rupiah.format(inc);
    el.sumOut.textContent = rupiah.format(exp);
    el.sumBal.textContent = rupiah.format(inc - exp);
    el.sumBal.className = inc - exp < 0 ? 'out' : '';
  }

  function txNode(t) {
    const li = document.createElement('li');
    li.className = 'tx'; li.dataset.id = t.id;
    const isIn = t.type === 'Pemasukan';

    const main = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = t.title;
    const meta = document.createElement('div'); meta.className = 'meta';
    const bType = document.createElement('span'); bType.className = `badge ${isIn ? 'in' : 'out'}`; bType.textContent = t.type;
    const bCat = document.createElement('span'); bCat.className = 'badge'; bCat.textContent = t.category;
    const time = document.createElement('time'); time.dateTime = t.date; time.textContent = dateFmt.format(toDate(t.date));
    meta.append(bType, bCat, time);
    main.append(h, meta);

    const amt = document.createElement('div');
    amt.className = `amt ${isIn ? 'in' : 'out'}`;
    amt.textContent = `${isIn ? '+' : '−'}${rupiah.format(t.amount)}`;

    const act = document.createElement('div'); act.className = 'act';
    [['edit', 'Ubah'], ['delete', 'Hapus']].forEach(([action, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.dataset.action = action; b.textContent = label;
      b.setAttribute('aria-label', `${label} transaksi ${t.title}`);
      act.append(b);
    });
    li.append(main, amt, act);
    return li;
  }

  function render() {
    renderSummary();
    const items = visibleItems();
    const frag = document.createDocumentFragment();
    items.forEach((t) => frag.append(txNode(t)));
    el.list.replaceChildren(frag);

    const none = state.items.length === 0;
    el.empty.hidden = items.length > 0;
    if (!el.empty.hidden) {
      el.empty.innerHTML = none
        ? '<strong>Belum ada transaksi</strong>Isi formulir di samping untuk mencatat transaksi pertama Anda.'
        : '<strong>Tidak ada transaksi yang cocok</strong>Ubah kata kunci atau filter untuk melihat hasil lain.';
    }
    el.count.textContent = none ? '' : `Menampilkan ${items.length} dari ${state.items.length} transaksi`;
  }

  /* ---------- Form tambah ---------- */
  function initForms() {
    const catSelect = $('#f-category');
    catSelect.append(option('', 'Pilih kategori'));
    CATEGORIES.forEach((c) => { catSelect.append(option(c)); el.fCat.append(option(c)); });
    el.formAdd.elements.date.value = today();

    // Klon field untuk dialog ubah dengan id unik
    const clone = $('#fields').cloneNode(true);
    clone.id = 'edit-fields-inner';
    $$('[id]', clone).forEach((n) => { n.id += '-e'; });
    $$('[for]', clone).forEach((n) => n.setAttribute('for', `${n.getAttribute('for')}-e`));
    $$('[aria-describedby]', clone).forEach((n) => n.setAttribute('aria-describedby', `${n.getAttribute('aria-describedby')}-e`));
    el.editFields.replaceWith(clone);
    el.editFields = clone;
  }

  el.formAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validate(el.formAdd);
    if (!data) return;
    state.items.push({ id: uid(), ...data });
    save();
    el.formAdd.reset();
    el.formAdd.elements.date.value = today();
    clearErrors(el.formAdd);
    render();
    announce(`Transaksi ${data.title} ditambahkan.`);
    el.formAdd.elements.title.focus();
  });

  /* ---------- Modal ubah & hapus ---------- */
  el.list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const item = state.items.find((t) => t.id === id);
    if (!item) return;
    if (btn.dataset.action === 'edit') {
      state.editId = id;
      const f = el.formEdit.elements;
      f.title.value = item.title; f.category.value = item.category; f.amount.value = item.amount;
      f.type.value = item.type; f.date.value = item.date;
      clearErrors(el.formEdit);
      el.dlgEdit.showModal();
      f.title.focus();
    } else {
      state.delId = id;
      el.delMsg.textContent = `Transaksi "${item.title}" sebesar ${rupiah.format(item.amount)} akan dihapus dan tidak dapat dikembalikan.`;
      el.dlgDel.showModal();
    }
  });

  el.formEdit.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validate(el.formEdit);
    if (!data) return;
    const item = state.items.find((t) => t.id === state.editId);
    if (item) Object.assign(item, data);
    save(); render();
    el.dlgEdit.close();
    announce(`Transaksi ${data.title} diperbarui.`);
  });

  el.delOk.addEventListener('click', () => {
    const item = state.items.find((t) => t.id === state.delId);
    state.items = state.items.filter((t) => t.id !== state.delId);
    save(); render();
    el.dlgDel.close();
    if (item) announce(`Transaksi ${item.title} dihapus.`);
    ($('#q') || document.body).focus();
  });

  [el.dlgEdit, el.dlgDel].forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  });

  /* ---------- Cari, filter, urutkan ---------- */
  let timer;
  el.q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = el.q.value.trim(); render(); }, 150);
  });
  el.fType.addEventListener('change', () => { state.type = el.fType.value; render(); });
  el.fCat.addEventListener('change', () => { state.cat = el.fCat.value; render(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });

  /* ---------- Tab (ARIA + keyboard) ---------- */
  const tabs = $$('[role=tab]');
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      selectTab(tabs[(keys[e.key] + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- Init ---------- */
  initForms();
  render();
})();

/* =====================================================
   UTILITAS BERSAMA
   Form pencarian tidak boleh submit (inline handler diblokir CSP)
   ===================================================== */
document.addEventListener('submit', (e) => {
  if (e.target.matches('form[role=search]')) e.preventDefault();
});

/* =====================================================
   BOOKMARK MANAGER
   localStorage memakai key sendiri agar tidak bentrok
   dengan Expense Tracker
   ===================================================== */
(() => {
  const STORAGE_KEY = 'bookmark-manager:v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

  const el = {
    list: $('#bm-list'), empty: $('#bm-empty'), count: $('#bm-count'), status: $('#status'),
    q: $('#bm-q'), fCat: $('#bm-flt-cat'), sort: $('#bm-sort'), cats: $('#bm-cats'),
    formAdd: $('#bm-form-add'), formEdit: $('#bm-form-edit'), editFields: $('#bm-edit-fields'),
    dlgEdit: $('#dlg-bm-edit'), dlgDel: $('#dlg-bm-del'), delMsg: $('#bm-del-msg'), delOk: $('#bm-del-ok')
  };
  const state = { items: load(), q: '', cat: 'all', sort: 'newest', editId: null, delId: null };

  /* ---------- Util ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const announce = (msg) => { el.status.textContent = ''; requestAnimationFrame(() => { el.status.textContent = msg; }); };

  // Validasi URL: wajib http(s)://, tanpa spasi, host valid. Mengembalikan URL ternormalisasi atau null.
  function parseUrl(raw) {
    const s = String(raw).trim();
    if (!/^https?:\/\/\S+$/i.test(s)) return null;
    try {
      const u = new URL(s);
      return /^https?:$/.test(u.protocol) && u.hostname ? u.href : null;
    } catch { return null; }
  }

  /* ---------- Persistensi ---------- */
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((b) => b && typeof b.title === 'string' && b.title && parseUrl(b.url) &&
        typeof b.category === 'string' && b.category && Number.isFinite(b.createdAt))
        .map((b) => ({ id: String(b.id || uid()), title: b.title, url: parseUrl(b.url), category: b.category,
          note: typeof b.note === 'string' ? b.note : '', createdAt: b.createdAt }));
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); }
    catch { announce('Data tidak dapat disimpan. Penyimpanan peramban penuh atau dinonaktifkan.'); }
  }

  /* ---------- Validasi ---------- */
  function validate(form, ignoreId = null) {
    const f = form.elements;
    const url = parseUrl(f.url.value);
    const typedCat = f.category.value.trim().replace(/\s+/g, ' ');
    // Samakan ejaan dengan kategori yang sudah ada (tidak peka huruf besar/kecil)
    const category = state.items.find((b) => b.category.toLowerCase() === typedCat.toLowerCase())?.category || typedCat;
    const data = { title: f.title.value.trim(), url, category, note: f.note.value.trim().slice(0, 200) };

    const errors = {};
    if (!data.title) errors.title = 'Nama wajib diisi.';
    else if (data.title.length > 80) errors.title = 'Nama maksimal 80 karakter.';
    if (!f.url.value.trim()) errors.url = 'URL wajib diisi.';
    else if (!url) errors.url = 'URL harus diawali http:// atau https:// dan berformat benar, tanpa spasi.';
    else if (state.items.some((b) => b.url === url && b.id !== ignoreId)) errors.url = 'URL ini sudah tersimpan.';
    if (!category) errors.category = 'Kategori wajib diisi.';
    else if (category.length > 30) errors.category = 'Kategori maksimal 30 karakter.';

    let firstInvalid = null;
    ['title', 'url', 'category'].forEach((name) => {
      const input = f[name];
      const msg = $(`#${input.getAttribute('aria-describedby')}`, form);
      if (errors[name]) {
        input.setAttribute('aria-invalid', 'true');
        msg.textContent = errors[name]; msg.hidden = false;
        firstInvalid = firstInvalid || input;
      } else {
        input.removeAttribute('aria-invalid');
        msg.textContent = ''; msg.hidden = true;
      }
    });
    if (firstInvalid) { firstInvalid.focus(); announce('Formulir belum valid. Periksa kolom yang ditandai.'); return null; }
    return data;
  }
  const clearErrors = (form) => {
    $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
    $$('.err', form).forEach((e) => { e.textContent = ''; e.hidden = true; });
  };

  /* ---------- Render ---------- */
  const option = (value, label = value) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };

  function refreshCategories() {
    const cats = [...new Set(state.items.map((b) => b.category))].sort((a, b) => a.localeCompare(b, 'id'));
    if (state.cat !== 'all' && !cats.includes(state.cat)) state.cat = 'all';
    el.cats.replaceChildren(...cats.map((c) => option(c)));
    el.fCat.replaceChildren(option('all', 'Semua kategori'), ...cats.map((c) => option(c)));
    el.fCat.value = state.cat;
  }

  function visibleItems() {
    const q = state.q.toLowerCase();
    const out = state.items.filter((b) =>
      (state.cat === 'all' || b.category === state.cat) &&
      (!q || `${b.title} ${b.url} ${b.category} ${b.note}`.toLowerCase().includes(q)));
    const by = {
      newest: (a, b) => b.createdAt - a.createdAt,
      az: (a, b) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' }),
      za: (a, b) => b.title.localeCompare(a.title, 'id', { sensitivity: 'base' })
    };
    return out.sort(by[state.sort]);
  }

  // Tautan eksternal: tab baru + rel aman
  function link(href, text) {
    const a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.append(text);
    const hint = document.createElement('span');
    hint.className = 'vh'; hint.textContent = ' (buka di tab baru)';
    a.append(hint);
    return a;
  }

  function node(b) {
    const li = document.createElement('li');
    li.className = 'bm'; li.dataset.id = b.id;

    const h = document.createElement('h3'); h.append(link(b.url, b.title));
    const url = document.createElement('p'); url.className = 'url'; url.append(link(b.url, b.url));

    const meta = document.createElement('div'); meta.className = 'meta';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = b.category;
    const time = document.createElement('time');
    time.dateTime = new Date(b.createdAt).toISOString();
    time.textContent = `Disimpan ${dateFmt.format(b.createdAt)}`;
    meta.append(badge, time);
    li.append(h, url, meta);

    if (b.note) { const n = document.createElement('p'); n.className = 'note'; n.textContent = b.note; li.append(n); }

    const act = document.createElement('div'); act.className = 'act';
    [['edit', 'Ubah'], ['delete', 'Hapus']].forEach(([action, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn'; btn.dataset.action = action; btn.textContent = label;
      btn.setAttribute('aria-label', `${label} bookmark ${b.title}`);
      act.append(btn);
    });
    li.append(act);
    return li;
  }

  function render() {
    refreshCategories();
    const items = visibleItems();
    const frag = document.createDocumentFragment();
    items.forEach((b) => frag.append(node(b)));
    el.list.replaceChildren(frag);

    const none = state.items.length === 0;
    el.empty.hidden = items.length > 0;
    if (!el.empty.hidden) {
      el.empty.innerHTML = none
        ? '<strong>Belum ada bookmark</strong>Isi formulir di samping untuk menyimpan tautan favorit pertama Anda.'
        : '<strong>Tidak ada bookmark yang cocok</strong>Ubah kata kunci atau kategori untuk melihat hasil lain.';
    }
    el.count.textContent = none ? '' : `Menampilkan ${items.length} dari ${state.items.length} bookmark`;
  }

  /* ---------- Form tambah ---------- */
  function initForms() {
    // Klon field untuk dialog ubah dengan id unik
    const clone = $('#bm-fields').cloneNode(true);
    clone.id = 'bm-edit-fields-inner';
    $$('[id]', clone).forEach((n) => { n.id += '-e'; });
    $$('[for]', clone).forEach((n) => n.setAttribute('for', `${n.getAttribute('for')}-e`));
    $$('[aria-describedby]', clone).forEach((n) => n.setAttribute('aria-describedby', `${n.getAttribute('aria-describedby')}-e`));
    el.editFields.replaceWith(clone);
    el.editFields = clone;
  }

  el.formAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validate(el.formAdd);
    if (!data) return;
    state.items.push({ id: uid(), createdAt: Date.now(), ...data });
    save();
    el.formAdd.reset();
    clearErrors(el.formAdd);
    render();
    announce(`Bookmark ${data.title} ditambahkan.`);
    el.formAdd.elements.title.focus();
  });

  /* ---------- Modal ubah & hapus ---------- */
  el.list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const item = state.items.find((b) => b.id === id);
    if (!item) return;
    if (btn.dataset.action === 'edit') {
      state.editId = id;
      const f = el.formEdit.elements;
      f.title.value = item.title; f.url.value = item.url; f.category.value = item.category; f.note.value = item.note;
      clearErrors(el.formEdit);
      el.dlgEdit.showModal();
      f.title.focus();
    } else {
      state.delId = id;
      el.delMsg.textContent = `Bookmark "${item.title}" akan dihapus dan tidak dapat dikembalikan.`;
      el.dlgDel.showModal();
    }
  });

  el.formEdit.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = validate(el.formEdit, state.editId);
    if (!data) return;
    const item = state.items.find((b) => b.id === state.editId);
    if (item) Object.assign(item, data);
    save(); render();
    el.dlgEdit.close();
    announce(`Bookmark ${data.title} diperbarui.`);
  });

  el.delOk.addEventListener('click', () => {
    const item = state.items.find((b) => b.id === state.delId);
    state.items = state.items.filter((b) => b.id !== state.delId);
    save(); render();
    el.dlgDel.close();
    if (item) announce(`Bookmark ${item.title} dihapus.`);
    el.q.focus();
  });

  [el.dlgEdit, el.dlgDel].forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  });

  /* ---------- Cari, filter, urutkan ---------- */
  let timer;
  el.q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = el.q.value.trim(); render(); }, 150);
  });
  el.fCat.addEventListener('change', () => { state.cat = el.fCat.value; render(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; render(); });

  /* ---------- Init ---------- */
  initForms();
  render();
})();

/* =====================================================
   QUIZ APP
   Soal berupa array of object; skor tertinggi disimpan
   di localStorage dengan key sendiri.
   ===================================================== */
(() => {
  const STORAGE_KEY = 'quiz-app:v1:highscore';
  const SECONDS_PER_QUESTION = 20;

  // Bank soal: tambah objek baru di sini, UI menyesuaikan otomatis.
  const QUESTIONS = [
    { question: 'Elemen HTML semantik mana yang tepat untuk menandai navigasi utama situs?',
      options: ['<nav>', '<div class="nav">', '<section>', '<aside>'], answer: 0,
      explanation: '<nav> memberi makna landmark navigasi sehingga mudah dikenali pembaca layar dan mesin pencari.' },
    { question: 'Properti CSS mana yang mengatur jarak di dalam sebuah elemen, antara konten dan border?',
      options: ['margin', 'padding', 'gap', 'outline-offset'], answer: 1,
      explanation: 'padding mengatur ruang di dalam border, sedangkan margin mengatur jarak di luar border.' },
    { question: 'Metode array mana yang mengembalikan array baru berisi elemen yang memenuhi suatu syarat?',
      options: ['forEach', 'push', 'filter', 'find'], answer: 2,
      explanation: 'filter menghasilkan array baru. find hanya mengembalikan satu elemen pertama yang cocok.' },
    { question: 'Apa hasil dari typeof null di JavaScript?',
      options: ['"null"', '"undefined"', '"object"', '"number"'], answer: 2,
      explanation: 'Ini perilaku historis JavaScript yang dipertahankan demi kompatibilitas.' },
    { question: 'Cara paling aman menyisipkan teks dari pengguna ke DOM untuk menghindari XSS adalah …',
      options: ['innerHTML', 'outerHTML', 'document.write', 'textContent'], answer: 3,
      explanation: 'textContent memperlakukan masukan sebagai teks biasa, bukan markup HTML.' },
    { question: 'Atribut mana yang sebaiknya dipasang bersama target="_blank" pada tautan eksternal?',
      options: ['rel="noopener noreferrer"', 'rel="stylesheet"', 'download', 'hreflang="id"'], answer: 0,
      explanation: 'noopener mencegah halaman tujuan mengakses window.opener milik halaman Anda.' },
    { question: 'Apa fungsi localStorage.setItem("k", "v")?',
      options: ['Menyimpan pasangan key–value di peramban dan tetap ada setelah ditutup', 'Menyimpan data di server selama 24 jam', 'Menyimpan data hanya sampai tab ditutup', 'Mengirim cookie ke server pada tiap permintaan'], answer: 0,
      explanation: 'localStorage bertahan sampai dihapus. Data yang hilang saat tab ditutup adalah sessionStorage.' },
    { question: 'Operator === di JavaScript membandingkan …',
      options: ['nilai dan tipe tanpa konversi tipe', 'hanya nilai dengan konversi tipe', 'hanya tipe data', 'alamat memori untuk semua tipe'], answer: 0,
      explanation: '=== bersifat strict, jadi 5 === "5" bernilai false. Operator == melakukan konversi tipe.' }
  ].filter((q) => q.question && Array.isArray(q.options) && q.options.length >= 4 &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);

  const $ = (id) => document.getElementById(id);
  const el = {
    start: $('quiz-start'), play: $('quiz-play'), result: $('quiz-result'),
    intro: $('quiz-intro'), hs: $('quiz-hs'), timerOn: $('quiz-timer-on'), startBtn: $('quiz-start-btn'),
    step: $('quiz-step'), timer: $('quiz-timer'), progress: $('quiz-progress'),
    legend: $('quiz-q'), options: $('quiz-options'), err: $('quiz-err'), feedback: $('quiz-feedback'),
    answerBtn: $('quiz-answer'), nextBtn: $('quiz-next'),
    resultTitle: $('quiz-result-title'), score: $('quiz-score'), msg: $('quiz-msg'),
    hsNote: $('quiz-hs-note'), review: $('quiz-review'), again: $('quiz-again')
  };

  const state = { phase: 'idle', round: [], index: 0, score: 0, answers: [], useTimer: true,
    deadline: 0, timerId: null, qStart: 0, elapsed: 0 };

  /* ---------- Util ---------- */
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const make = (tag, props = {}, text = '') => { const n = document.createElement(tag); Object.assign(n, props); if (text) n.textContent = text; return n; };
  const screen = (name) => { el.start.hidden = name !== 'start'; el.play.hidden = name !== 'play'; el.result.hidden = name !== 'result'; };

  /* ---------- High score ---------- */
  function loadHigh() {
    try {
      const h = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return h && Number.isInteger(h.score) && Number.isInteger(h.total) && h.total > 0 && Number.isFinite(h.seconds) ? h : null;
    } catch { return null; }
  }
  function saveHigh(rec) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch { /* penyimpanan tidak tersedia */ } }
  // Lebih baik = rasio benar lebih tinggi; jika sama, waktu lebih singkat.
  const isBetter = (a, b) => !b || a.score * b.total > b.score * a.total ||
    (a.score * b.total === b.score * a.total && a.seconds < b.seconds);
  const describe = (h) => `${h.score} / ${h.total} (${h.seconds} dtk)`;

  function renderHigh() {
    const h = loadHigh();
    el.hs.textContent = h ? `Skor tertinggi Anda: ${describe(h)}.` : 'Belum ada skor tertinggi. Selesaikan kuis untuk mencatatnya.';
  }

  /* ---------- Timer (berbasis deadline agar tidak melenceng) ---------- */
  function stopTimer() { clearInterval(state.timerId); state.timerId = null; }
  function tick() {
    const left = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    const txt = `Sisa waktu: ${left} dtk`;
    if (el.timer.textContent !== txt) { el.timer.textContent = txt; el.timer.classList.toggle('low', left <= 5); }
    if (left === 0) grade(null);
  }
  function startTimer() {
    stopTimer();
    state.deadline = Date.now() + SECONDS_PER_QUESTION * 1000;
    el.timer.hidden = false;
    tick();
    state.timerId = setInterval(tick, 250);
  }

  /* ---------- Alur kuis ---------- */
  function startQuiz() {
    if (!QUESTIONS.length) return;
    // Acak urutan soal dan opsi; kunci jawaban dilacak lewat properti correct
    state.round = shuffle(QUESTIONS).map((q) => ({
      q, opts: shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })))
    }));
    Object.assign(state, { index: 0, score: 0, answers: [], elapsed: 0, useTimer: el.timerOn.checked });
    screen('play');
    showQuestion();
  }

  function showQuestion() {
    const item = state.round[state.index];
    const last = state.index === state.round.length - 1;
    state.phase = 'playing';
    el.step.textContent = `Soal ${state.index + 1} dari ${state.round.length}`;
    el.progress.max = state.round.length;
    el.progress.value = state.index;
    el.legend.textContent = item.q.question;
    el.options.replaceChildren(...item.opts.map((o, i) => {
      const label = make('label', { className: 'opt' });
      label.append(make('input', { type: 'radio', name: 'answer', value: String(i) }), make('span', {}, o.text));
      return label;
    }));
    el.feedback.replaceChildren();
    el.feedback.className = 'fb';
    el.err.hidden = true;
    el.answerBtn.hidden = false;
    el.nextBtn.hidden = true;
    el.nextBtn.textContent = last ? 'Lihat hasil' : 'Soal berikutnya';
    state.qStart = Date.now();
    if (state.useTimer) startTimer(); else { stopTimer(); el.timer.hidden = true; }
    el.legend.focus();
  }

  // Penilaian: choice = indeks opsi, atau null jika waktu habis
  function grade(choice) {
    if (state.phase !== 'playing') return;
    stopTimer();
    state.elapsed += Date.now() - state.qStart;
    const item = state.round[state.index];
    const correctIdx = item.opts.findIndex((o) => o.correct);
    const ok = choice === correctIdx;
    if (ok) state.score++;
    state.answers.push({ question: item.q.question, chosen: choice === null ? null : item.opts[choice].text,
      correct: item.opts[correctIdx].text, ok, explanation: item.q.explanation });
    state.phase = 'answered';

    [...el.options.children].forEach((label, i) => {
      label.firstElementChild.disabled = true;
      const mark = (cls, text) => { label.classList.add(cls); label.append(make('strong', { className: 'mark' }, text)); };
      if (i === correctIdx) mark('ok', 'Jawaban benar');
      else if (i === choice) mark('bad', 'Jawaban Anda salah');
    });
    const lead = ok ? 'Benar! ' : choice === null ? 'Waktu habis. ' : 'Kurang tepat. ';
    el.feedback.className = `fb ${ok ? 'ok' : 'bad'}`;
    el.feedback.replaceChildren(make('p', {}, lead + item.q.explanation));
    el.err.hidden = true;
    el.answerBtn.hidden = true;
    el.nextBtn.hidden = false;
    el.timer.classList.remove('low');
    el.nextBtn.focus();
  }

  function finish() {
    state.phase = 'done';
    const total = state.round.length;
    const pct = Math.round((state.score / total) * 100);
    const rec = { score: state.score, total, seconds: Math.round(state.elapsed / 1000), date: new Date().toISOString() };
    const prev = loadHigh();

    let note;
    if (state.score > 0 && isBetter(rec, prev)) { saveHigh(rec); note = `Rekor baru! Skor tertinggi kini ${describe(rec)}.`; }
    else if (prev) note = `Skor tertinggi Anda tetap ${describe(prev)}.`;
    else note = 'Jawab minimal satu soal dengan benar untuk menyimpan skor tertinggi.';

    el.score.replaceChildren(
      make('span', { ariaHidden: 'true' }, `${state.score} / ${total}`),
      make('span', { className: 'vh' }, `${state.score} dari ${total} soal benar`));
    el.msg.textContent = `${pct}% benar. ` + (pct >= 90 ? 'Luar biasa!' : pct >= 70 ? 'Bagus, tinggal sedikit lagi.' : pct >= 50 ? 'Lumayan, terus berlatih.' : 'Jangan menyerah, coba lagi.')
      + ` Waktu menjawab: ${rec.seconds} dtk.`;
    el.hsNote.textContent = note;

    el.review.replaceChildren(...state.answers.map((a) => {
      const li = make('li');
      li.append(make('strong', {}, a.question),
        make('p', {}, `Jawaban Anda: ${a.chosen ?? 'tidak dijawab (waktu habis)'} — ${a.ok ? 'benar' : 'salah'}`));
      if (!a.ok) li.append(make('p', {}, `Jawaban benar: ${a.correct}`));
      li.append(make('p', {}, a.explanation));
      return li;
    }));
    el.progress.value = total;
    renderHigh();
    screen('result');
    el.resultTitle.focus();
  }

  /* ---------- Event ---------- */
  el.startBtn.addEventListener('click', startQuiz);
  el.again.addEventListener('click', startQuiz);
  el.nextBtn.addEventListener('click', () => {
    if (state.phase !== 'answered') return;
    state.index++;
    if (state.index >= state.round.length) finish(); else showQuestion();
  });
  el.play.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.phase !== 'playing') return;
    const checked = el.play.querySelector('input[name="answer"]:checked');
    if (!checked) {
      el.err.textContent = 'Pilih salah satu jawaban sebelum menekan Jawab.';
      el.err.hidden = false;
      el.play.querySelector('input[name="answer"]').focus();
      return;
    }
    grade(Number(checked.value));
  });
  el.options.addEventListener('change', () => { el.err.hidden = true; });

  /* ---------- Init ---------- */
  el.intro.textContent = `${QUESTIONS.length} soal pilihan ganda tentang HTML, CSS, dan JavaScript. Urutan soal dan opsi diacak setiap kali main.`;
  el.startBtn.disabled = QUESTIONS.length === 0;
  renderHigh();
  screen('start');
})();