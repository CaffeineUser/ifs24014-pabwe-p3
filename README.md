# 🛠️ Toolkit Harian

> **Tugas Praktikum 3 – Pemrograman Aplikasi Berbasis Web (PABWE)**
> NIM / Nama Mahasiswa: **IFS24014**

Aplikasi web satu halaman (*Single Page Application*) yang menggabungkan tiga fitur utilitas harian dalam satu antarmuka tab yang konsisten. Semua data tersimpan di peramban pengguna menggunakan `localStorage` — **tanpa backend, tanpa database, tanpa dependensi eksternal**.

---

## 🌐 Demo Langsung

| Fitur | URL Langsung |
|---|---|
| 💸 Catatan Pengeluaran | [`/?tab=pengeluaran`](https://ifs24014-pabwe-p3.netlify.app/?tab=pengeluaran) |
| 🔖 Bookmark Manager | [`/?tab=bookmark`](https://ifs24014-pabwe-p3.netlify.app/?tab=bookmark) |
| 🧠 Kuis Interaktif | [`/?tab=kuis`](https://ifs24014-pabwe-p3.netlify.app/?tab=kuis) |

---

## ✅ Checklist Kriteria Tugas

| # | Kriteria | Status |
|---|---|---|
| 1 | Terdapat 3 tab yang berfungsi; hanya satu panel aktif pada satu waktu | ✅ |
| 2 | Tab terakhir yang dibuka diingat dan dipulihkan saat reload (`localStorage`) | ✅ |
| 3 | Setiap fitur memakai key `localStorage` berbeda agar data tidak saling menimpa | ✅ |
| 4 | Kode di `assets/script.js` rapi, dikelompokkan per fitur, diberi komentar | ✅ |
| 5 | UI konsisten antar tab (warna, font, spacing) | ✅ |
| 6 | Tidak bergantung pada backend / API eksternal | ✅ |
| 7 | Hanya `index.html` + `assets/script.js` sebagai inti | ✅ |

---

## 📁 Struktur Proyek

```
ifs24014-pabwe-p3/
├── index.html          # Markup utama — semua panel tab ada di sini
└── assets/
    └── script.js       # Seluruh logika JS (5 bagian terstruktur)
```

> Tidak ada framework, tidak ada bundler, tidak ada `node_modules`.

---

## 🗂️ Arsitektur `assets/script.js`

File dibagi menjadi **5 bagian utama** dengan komentar pemisah yang jelas:

```
┌─────────────────────────────────────────────┐
│  1. UTILITAS BERSAMA & KEY localStorage     │
│     $(), $$(), uid(), announce(), dll.      │
├─────────────────────────────────────────────┤
│  2. CATATAN PENGELUARAN HARIAN              │
│     IIFE — key: expense-tracker:v1          │
│     CRUD transaksi, filter, sort, dialog    │
├─────────────────────────────────────────────┤
│  3. BOOKMARK / LINK MANAGER                 │
│     IIFE — key: bookmark-manager:v1         │
│     CRUD bookmark, kategori, validasi URL   │
├─────────────────────────────────────────────┤
│  4. KUIS INTERAKTIF                         │
│     IIFE — key: quiz-app:v1:highscore       │
│     Bank soal, acak, timer, high score      │
├─────────────────────────────────────────────┤
│  5. NAVIGASI TAB & ROUTER QUERY             │
│     Sinkronisasi URL (?tab=...) + LS        │
└─────────────────────────────────────────────┘
```

Setiap fitur dibungkus dalam **IIFE (Immediately Invoked Function Expression)** sehingga variabel dan *state* tiap fitur terisolasi dan tidak bisa saling bertabrakan.

---

## 🔑 Key `localStorage` yang Digunakan

```js
const STORAGE_KEYS = Object.freeze({
  expense:  'expense-tracker:v1',       // Array transaksi
  bookmark: 'bookmark-manager:v1',      // Array bookmark
  quiz:     'quiz-app:v1:highscore',    // Objek high score kuis
  tab:      'toolkit:active-tab:v1'     // String nama tab aktif terakhir
});
```

---

## 🔗 Sistem URL & Navigasi Tab

Navigasi tab menggunakan **dua lapisan** secara bersamaan:

```
Saat tab diklik
      │
      ├─► history.pushState() → URL berubah ke /?tab=pengeluaran
      │                         (dapat dibagikan / di-bookmark)
      │
      └─► localStorage.setItem() → Tab terakhir disimpan
                                   (dipulihkan saat reload tanpa URL)
```

**Prioritas saat halaman pertama kali dibuka:**
```
URL Query (?tab=...) → localStorage → Tab pertama (default)
```

Karena menggunakan **query parameter** (bukan path bersih `/pengeluaran`), URL ini **langsung berjalan di Netlify atau hosting statis mana pun** tanpa perlu konfigurasi rewrite / redirect tambahan.

---

## ✨ Fitur Detail

### 💸 1. Catatan Pengeluaran Harian

- Catat transaksi **Pemasukan** atau **Pengeluaran** dengan judul, kategori, jumlah, dan tanggal
- **Ringkasan saldo** dihitung otomatis secara real-time
- Filter berdasarkan tipe & kategori, pencarian judul, serta pengurutan (terbaru, terlama, terbesar, terkecil)
- Ubah atau hapus transaksi lewat **dialog modal** yang aksesibel

### 🔖 2. Bookmark / Link Manager

- Simpan tautan favorit dengan nama, URL, kategori, dan catatan opsional
- Validasi URL ketat (wajib `http://` / `https://`) dan deteksi duplikat
- Filter kategori dinamis (muncul otomatis dari data yang ada)
- Tautan eksternal dibuka di tab baru dengan `rel="noopener noreferrer"`

### 🧠 3. Kuis Interaktif

- **8 soal** pilihan ganda seputar HTML, CSS, dan JavaScript
- Urutan soal **dan** opsi jawaban diacak setiap sesi
- **Timer 20 detik** per soal (dapat dimatikan)
- Umpan balik langsung setelah menjawab beserta penjelasan
- **High score** tersimpan dan dibandingkan antar sesi

---

## 🎨 Desain & Aksesibilitas

- **Dark mode otomatis** via `prefers-color-scheme`
- Seluruh interaktif dapat diakses via **keyboard** (Tab, Arrow, Space, Enter)
- **ARIA roles** yang benar: `tablist`, `tab`, `tabpanel`, `role="status"` untuk live region
- Skip link "Lewati ke konten utama" untuk pengguna pembaca layar
- `focus-visible` outline yang jelas untuk navigasi keyboard

---

## 🚀 Cara Menjalankan Lokal

Cukup buka `index.html` langsung di peramban — tidak perlu server:

```bash
# Opsi 1: Klik dua kali file index.html di File Explorer

# Opsi 2: Menggunakan ekstensi Live Server di VS Code
# Klik kanan index.html → "Open with Live Server"

# Opsi 3: Python HTTP server
python -m http.server 8080
# Buka http://localhost:8080
```

---

## 🛡️ Keamanan

- **CSP (Content Security Policy)** ketat: `default-src 'none'`, hanya mengizinkan script dari file sendiri
- Teks pengguna selalu dimasukkan via `.textContent` (bukan `.innerHTML`) untuk mencegah **XSS**
- Semua data hanya tersimpan secara lokal di peramban pengguna, **tidak dikirim ke server mana pun**
