# Desain Ulang Panel Sidebar — Peta Sebaran PJUTS 2026

Tanggal: 2026-07-29
Status: disetujui untuk implementasi

## 1. Masalah

Panel data sekarang menumpuk lima blok chrome sebelum baris data pertama muncul:
statistik tiga angka, baris pencarian, chip filter aktif, label
"KELOMPOKKAN BERDASARKAN:", lalu tab pengelompokan. Akibatnya:

- Kotak pencarian terpotong (`Cari nomor, peng…`) karena tombol "Lihat semua"
  berbagi baris dengannya.
- Statistik `230 titik · 12 pengusul · 230 tampil` sulit dibaca ketika dua
  angkanya kembar — pembaca tidak tahu beda "titik" dan "tampil".
- Masthead adalah kartu mengambang terpisah dari panel, sehingga ada dua kartu
  dengan dua bayangan yang bersaing di sudut kiri atas.
- Accordion menjorok ke dalam: saat satu grup terbuka, grup lain tetap terlihat
  dalam keadaan diredupkan (`is-muted`), yang menimbulkan pertanyaan "kenapa
  yang ini abu-abu?" bagi pengguna awam.

## 2. Keputusan yang sudah diambil

| Pertanyaan | Keputusan |
|---|---|
| Cakupan | Sidebar **dan** masthead digabung jadi satu kartu. Kontrol peta (zoom, layer switcher, skala) **tidak** disentuh. |
| Model navigasi | **Drill-down dua layar**, menggantikan accordion. |
| Mobile | Dua layar yang sama hidup di dalam bottom sheet. Masthead **tetap** bar tipis mengambang di atas peta pada `<960px`. |

## 3. Arsitektur panel

Satu kartu mengambang, empat zona. Tiga zona tetap, satu menggulir.

```
╭─ #sidebar ────────────────────────────╮
│ .panel-brand      (tetap, desktop)    │
│ .panel-nav        (tetap, per layar)  │
│ .sidebar-scroll   (menggulir)         │
│ .sidebar-footer   (tetap)             │
╰───────────────────────────────────────╯
```

- `.panel-brand` — lambang Jambi + kicker "Pemprov Jambi · Dinas ESDM" + judul
  "Peta Sebaran PJUTS 2026". Isinya dipindahkan dari `<header class="masthead">`.
  Disembunyikan pada `<960px`, di mana `.masthead` yang lama tetap dipakai.

  Kedua blok sama-sama memakai `<h1>`, dan yang tidak aktif disembunyikan dengan
  `display: none` — bukan `visibility: hidden` atau `aria-hidden`. `display: none`
  mengeluarkan elemen dari pohon aksesibilitas, sehingga tepat satu `<h1>` yang
  terekspos pada tiap ukuran layar meskipun ada dua di sumber HTML.
- `.panel-nav` — isinya berganti mengikuti layar aktif (lihat §5).
- `.sidebar-scroll` — satu-satunya area yang menggulir. Tidak ada gulir bersarang.
- `.sidebar-footer` — kredit sumber data, satu baris.

## 4. Model state

State navigasi **tidak menambah variabel baru**. Variabel `activeGroup` yang
sudah ada di `custom.js` sudah berarti "grup yang sedang memfilter peta", jadi
ia langsung menjadi penanda layar:

| `activeGroup` | Layar |
|---|---|
| `null` | Layar 1 — daftar grup |
| `"<nama grup>"` | Layar 2 — daftar titik di grup itu |

Semantik filter peta tidak berubah: `visibleIds` tetap satu-satunya sumber
kebenaran untuk "titik apa yang ada di peta sekarang", dan tetap diisi ulang di
dalam `renderList()`.

## 5. Spesifikasi layar

### 5.1 Layar 1 — daftar grup (`activeGroup === null`)

`.panel-nav` berisi, dari atas ke bawah:

1. **Kotak pencarian lebar penuh.** Placeholder `Cari nomor, pengusul, alamat…`
   tidak lagi terpotong karena tidak berbagi baris dengan tombol apa pun.
   Elemennya adalah `#list-search` yang sudah ada — lihat §7.
2. **Baris kelompok.** Label pendek `Kelompok` diikuti segmented control
   `[ Pengusul | Kabupaten ]`. Menggantikan label balok
   "KELOMPOKKAN BERDASARKAN:" + tab. Ini membalik keputusan commit `0fe2da9`
   secara sadar: label satu baris penuh dipakai untuk menerangkan kontrol yang
   sudah menjelaskan dirinya sendiri.
3. **Baris ringkasan.** Teks konteks di kiri, tombol teks `Lihat semua` di kanan.

`.sidebar-scroll` berisi baris grup. Tiap baris adalah `<button class="group-row">`:

```
[ Nama grup .............. 15  › ]
```

- Nama grup di kiri, mengisi ruang sisa.
- Jumlah titik sebagai angka polos (`15`), bukan `15 titik` — kata "titik"
  berulang 12 kali tidak menambah makna dan membuat kolom angka tidak rata.
- **Chevron menghadap kanan** (`.group-row__chevron`), berwarna `--blue`.
  Ini penanda utama "masuk ke dalam", konvensi yang sama dengan daftar
  Pengaturan di iOS/Android sehingga tidak perlu dipelajari.
- Tinggi baris minimal 44px agar nyaman disentuh.
- Hover/fokus: latar `--blue-tint`.

Klik baris grup → `setActiveGroup(group.name)`. Bukan lagi toggle: dari layar 1
satu-satunya arah adalah masuk.

### 5.2 Layar 2 — titik dalam grup (`activeGroup` terisi)

`.panel-nav` berisi:

1. **Baris kembali.** `‹ Semua pengusul` (atau `‹ Semua kabupaten` mengikuti
   `groupMode`). Elemen `<button class="panel-back">`.
2. **Judul grup** — nama grup, ukuran judul.
3. **Baris ringkasan** — `25 titik · peta difilter ke grup ini`.
4. **Kotak pencarian** dengan placeholder `Cari di grup ini…`.

Seluruh blok 1–3 berlatar `--blue-tint` supaya terbaca sebagai satu header
konteks yang jelas berbeda dari layar 1.

Tombol `Lihat semua` (`#fit-map`) **tidak muncul** di layar 2 — tombol kembali
sudah melakukan hal yang sama dan lebih jelas maksudnya. Elemennya disembunyikan,
bukan dihapus dari DOM, agar listener-nya tetap utuh.

`.sidebar-scroll` berisi baris titik. Struktur `.item` yang ada
(`.item-code`, `.item-copy`, `.item-headline`, `.item-label`, `.item-coord`,
`.item-subline`) **dipertahankan apa adanya** — baris ini sudah bekerja baik dan
bukan bagian dari masalah. Yang berubah hanya wadahnya: tidak ada lagi
`.group-items` yang menjorok di bawah header accordion.

Klik `‹` → `setActiveGroup(null)`, kembali ke layar 1 dan peta kembali penuh.

### 5.3 Chip filter aktif dihapus

Elemen `#active-filter` beserta `.active-filter__label`, `__value`, `__clear`
dihapus dari `index.html` dan `custom.css`; fungsi `renderActiveFilter()` serta
listener `#active-filter-clear` dihapus dari `custom.js`.

Alasan: tugasnya sudah diambil alih header layar 2. Pengguna sedang berdiri di
layar grup tersebut, jadi memberi tahu "peta difilter ke X" lewat chip terpisah
adalah pengulangan. Tombol `‹` menggantikan tombol `×` pada chip.

## 6. Baris ringkasan

Tiga elemen hitungan (`#count-points`, `#count-groups`, `#count-groups-label`,
`#count-visible`) diganti satu elemen `#list-summary` yang isinya menyesuaikan
keadaan:

| Keadaan | Isi |
|---|---|
| Layar 1, tanpa query | `230 titik · 12 pengusul` |
| Layar 1, tanpa query, mode kabupaten | `230 titik · 9 kabupaten` |
| Layar 1, ada query | `18 titik cocok di 4 pengusul` |
| Layar 1, query nihil | `Tidak ada titik yang cocok` |
| Layar 2 | `25 titik · peta difilter ke grup ini` |
| Layar 2, ada query | `6 dari 25 titik · peta difilter ke grup ini` |
| Data gagal dimuat | `Data titik belum tersedia` |

Angka diformat `toLocaleString("id-ID")` seperti sekarang.

Fungsi `updateGroupStats()` dan `setCountsUnknown()` diganti satu fungsi
`renderSummary()` yang dipanggil dari `renderList()`.

## 7. Perilaku pencarian

- **Layar 1 + query** → mencari ke **seluruh 230 titik**, bukan menyaring nama
  grup. Hasilnya baris titik rata (tanpa header grup), dengan nama grup
  ditempelkan sebagai konteks di `.item-subline`. Ini menjadikan pencarian
  jalan pintas yang melewati drill-down.
- **Layar 2 + query** → tercakup hanya pada `activeGroup`.
- Kedua layar memakai **satu elemen input yang sama**, `#list-search`. Yang
  berganti hanyalah atribut `placeholder`-nya, diatur di dalam `renderList()`.
  Tidak ada input kedua: menduplikasi elemen akan memecah listener debounce dan
  membuat dua sumber kebenaran untuk teks pencarian.
- Debounce 250ms dan `fitToVisible()` setelah render tetap seperti sekarang.
- Isi kotak pencarian **dikosongkan** setiap kali `setActiveGroup()` dipanggil,
  supaya query layar 1 tidak bocor ke layar 2 dan sebaliknya.
- Keadaan kosong memakai `buildEmptyState(hasQuery)` yang sudah ada.

`markDuplicates()` / `needsCoordHint()` tetap dipakai untuk baris titik di
kedua konteks.

## 8. Warna

Tidak ada token baru. Blok `:root` di `custom.css` dipakai apa adanya.

| Token | Peran baru |
|---|---|
| `--yellow` | Penanda **aktif**: garis bawah segmen terpilih, titik baris terpilih. Tidak lagi menyoroti angka statistik. |
| `--blue` | Apa pun yang bisa diklik: chevron, tombol teks, ikon pencarian aktif. |
| `--blue-deep` | Judul grup pada layar 2, teks tombol kembali. |
| `--blue-tint` | Hover baris, latar header layar 2, latar trek segmented control. |
| `--ink` / `--ink-soft` | Teks utama / kode nomor. |
| `--muted` / `--muted-2` | Baris ringkasan, subline, placeholder. |
| `--divider` / `--hairline` / `--hairline-strong` | Garis pemisah zona dan tepi kontrol. |

## 9. Mobile (`<960px`)

- `.panel-brand` disembunyikan; `.masthead` yang lama tetap tampil sebagai bar
  tipis mengambang di atas peta, persis seperti sekarang.
- Bottom sheet, `--sheet-peek`, `#sheet-handle`, kelas `is-panel-open` /
  `is-popup-open`, dan animasi `translate3d` **tidak berubah**.
- Area peek 178px akan memperlihatkan: gagang sheet, kotak pencarian, baris
  kelompok, dan sedikit baris pertama — lebih berguna daripada baris statistik
  yang sekarang mengisi ruang itu.
- Tinggi sentuh minimum 44px berlaku untuk `.group-row`, `.panel-back`, dan
  `.item`.
- Perilaku `focusItem(item, { closePanel: true })` yang menutup sheet saat titik
  dipilih tetap berlaku.

## 10. Aksesibilitas

- `.group-row` dan `.panel-back` adalah `<button type="button">` sungguhan.
- `aria-expanded` / `aria-controls` **dihapus** dari baris grup — tidak ada lagi
  daerah yang membuka-tutup di tempat. Sebagai gantinya `.group-row` memakai
  `aria-label` berisi `"<nama grup>, <n> titik, buka daftar"`.
- `#list-data` tetap `aria-live="polite"` supaya pergantian layar diumumkan.
- **Pengelolaan fokus** (menggantikan `restoreFocusGroup` yang sekarang):
  - Masuk ke layar 2 → fokus pindah ke `.panel-back`.
  - Kembali ke layar 1 → fokus kembali ke `.group-row` grup asal.
  - Variabel `restoreFocusGroup` dipertahankan untuk menyimpan nama grup asal.
- Kontras: semua pasangan warna di §8 mempertahankan ambang AA 4.5:1 yang sudah
  dikoreksi pada `--muted` (#5a6b7d) dan `--muted-2` (#647587).
- `prefers-reduced-motion` — transisi antar layar mengikuti aturan yang sudah
  ada di blok media query tersebut.

## 11. Perubahan berkas

### `index.html`
- Isi `<header class="masthead">` diduplikasi menjadi `.panel-brand` di dalam
  `#sidebar`; `.masthead` tetap ada untuk mobile.
- `.sidebar-stats` beserta tiga `.stat` → satu `<p id="list-summary">`.
- `#active-filter` beserta anak-anaknya dihapus.
- `.group-mode-field` disederhanakan: `.group-mode-label` jadi teks pendek
  sebaris, `.group-mode` jadi segmented control.
- `#fit-map` pindah dari baris pencarian ke baris ringkasan.
- `.search-field` jadi lebar penuh.
- Bump `?v=` seluruh aset (konvensi `?v=YYYYMMDD<huruf>`).

### `custom.css`
- Bagian "Data panel" ditulis ulang: `.panel-brand`, `.panel-nav`,
  `.panel-back`, `.group-row`, `.list-summary`, segmented control.
- Dihapus: `.sidebar-stats`, `.stat*`, `.active-filter*`, `.group-toggle`,
  `.group-chevron`, `.group-title`, `.group-meta`, `.is-muted`, `.is-filtering`,
  `.group-items`.
- Dipertahankan: `.item*`, `.empty-state*`, `.skeleton*`, `.data-error*`,
  `.sidebar-footer`, seluruh bagian popup, seluruh bagian map furniture.
- `body.is-data-unavailable` diarahkan ulang dari `.sidebar-stats` /
  `.stat strong` ke `#list-summary`.
- Blok `@media (max-width: 959px)` disesuaikan untuk menyembunyikan
  `.panel-brand` dan merapikan `.panel-nav`.

### `custom.js`
- `renderList(query)` bercabang jadi `renderGroupScreen()` (layar 1) dan
  `renderItemScreen()` (layar 2), dipanggil dari `renderList()` sesuai
  `activeGroup`. Ini juga memecah fungsi yang sekarang panjang.
- `setActiveGroup()` mengosongkan `searchInput.value` dan mengatur fokus.
- `renderActiveFilter()` dihapus.
- `updateGroupStats()` + `setCountsUnknown()` → `renderSummary()`.
- `setDataControlsDisabled()` diarahkan ke selektor segmented control yang baru.
- `applyGroupMode()` menyesuaikan teks tombol kembali (`pengusul` / `kabupaten`).
- Tidak berubah: `buildGroupedItems`, `focusItem`, `fitToVisible`,
  `panelInset`, `handleMapSingleClick`, `buildPopupHtml`, `markDuplicates`,
  `buildEmptyState`, seluruh logika bottom sheet.

## 12. Di luar cakupan

- Kontrol peta bawaan: zoom, skala, layer switcher, atribusi.
- Popup informasi titik (`buildPopupHtml`) — tidak disentuh.
- Data, `layers/`, `styles/`, dan pipeline qgis2web.
- Penambahan token warna atau font baru.

## 13. Kriteria selesai

Diverifikasi lewat preview `python3 -m http.server 8765` pada viewport desktop
dan mobile:

1. Layar 1 memuat 12 baris pengusul dengan chevron kanan; ringkasan berbunyi
   `230 titik · 12 pengusul`.
2. Klik "Buya Syaparudin" → panel berganti ke layar 2, judul benar, ringkasan
   `25 titik · peta difilter ke grup ini`, peta menampilkan 25 pin saja.
3. Klik `‹ Semua pengusul` → kembali ke layar 1, peta kembali 230 pin, fokus
   kembali ke baris "Buya Syaparudin".
4. Mengetik di layar 1 menghasilkan daftar titik rata lintas grup; ringkasan
   berbunyi `N titik cocok di M pengusul`.
5. Mengetik di layar 2 hanya menyaring dalam grup itu.
6. Beralih ke tab "Kabupaten" mengembalikan panel ke layar 1 dan label tombol
   kembali menjadi `‹ Semua kabupaten`.
7. Kotak pencarian menampilkan placeholder penuh tanpa terpotong.
8. Pada `<960px`: masthead tetap di atas peta, sheet peek memperlihatkan
   pencarian + baris kelompok, drill-down bekerja, memilih titik menutup sheet.
9. Tidak ada galat di konsol.
10. Navigasi keyboard penuh: Tab menjangkau semua kontrol, fokus berpindah
    sesuai §10.
