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