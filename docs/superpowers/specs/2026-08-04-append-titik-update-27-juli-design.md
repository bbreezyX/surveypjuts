# Append Titik Baru — UPDATE PER 27 JULI 2026

Tanggal: 2026-08-04  
Status: disetujui untuk implementasi

## 1. Masalah

Export qgis2web `UPDATE PER 27 JULI 2026` berisi 335 titik, sementara
`data/points.geojson` di repo masih 230. Selisihnya 105 titik baru (Kerinci 55,
Tanjung Jabung Timur 50). Schema export berbeda dari schema yang dibaca
`custom.js`, jadi replace mentah akan merusak popup/sidebar.

## 2. Keputusan yang sudah diambil

| Pertanyaan | Keputusan |
|---|---|
| Strategi | **Append saja** — tambah 105 titik baru; 230 titik lama tidak diubah |
| Schema target | Tetap schema existing (`Alamat`, `Foto Survey Awal`) |
| UI / `custom.js` | **Tidak diubah** |
| Layer batas (kabupaten, area, garis) | **Tidak diganti** |
| Titik tanpa tanggal (23) | Biarkan `Tanggal Dokumentasi` kosong; info tanggal tetap di `Keterangan` |

## 3. Sumber & match key

| | Existing | Export baru |
|---|---|---|
| File titik | `data/points.geojson` | `layers/UPDATEPER27JULI2026_4.js` (GeoJSON di dalam var JS) |
| Foto | `images/` (230 file) | `images/` export (317 file; 105 baru) |
| Kunci unik | `Nomor` (string) | `Nomor` (string) |

Hasil banding (match by `Nomor`):

- Shared: **230** — atribut & koordinat identik → skip
- Hanya di export: **105** → append
- Hanya di existing: **0**
- Koordinat pindah pada Nomor yang sama: **0**

## 4. Transform per feature baru

Setiap feature dengan `Nomor` yang belum ada di existing di-map ke schema lama:

| Field target | Sumber / aturan |
|---|---|
| `fid` | copy dari export (string, seperti existing) |
| `Nomor` | copy |
| `Nama Anggota` | copy |
| `Alamat` | compose dari kab/kec/desa (lihat §4.1) |
| `Longitude` | copy |
| `Latitude` | copy |
| `Tanggal Dokumentasi` | copy (boleh `null`) |
| `Keterangan` | copy (boleh `null`) |
| `Foto Survey Awal` | copy dari field export `Foto` (path Windows utuh) |

Field export yang **tidak** ditulis ke geojson: `Kabupaten/Kota`, `Kecamatan`,
`Desa/Kelurahan`, `Foto`, `Akurasi`.

Geometry Point `[lon, lat]` ikut dari export.

### 4.1 Aturan compose `Alamat`

Pola existing: `Desa Mangun Jayo, Kecamatan Tebo Tengah, Kabupaten Tebo`
(semua 230 titik lama memakai prefiks `Desa` + `Kabupaten`).

Untuk titik baru:

1. Ambil `desa = Desa/Kelurahan` (trim).
2. Jika `desa` sudah diawali `Desa `, `Desa`, `Kel.`, `Kel `, atau `Kelurahan`
   (case-insensitive pada token pertama) → pakai `desa` apa adanya.
3. Jika tidak → `desa = "Desa " + desa`.
4. `Alamat = "{desa}, Kecamatan {Kecamatan}, Kabupaten {Kabupaten/Kota}"`.

Contoh:

- `Kemantan Mudik` + `Air Hangat Timur` + `Kerinci`  
  → `Desa Kemantan Mudik, Kecamatan Air Hangat Timur, Kabupaten Kerinci`
- `Kel. Tanjung Solok` + `Kuala Jambi` + `Tanjung Jabung Timur`  
  → `Kel. Tanjung Solok, Kecamatan Kuala Jambi, Kabupaten Tanjung Jabung Timur`
- `Desa Teluk Majelis` + …  
  → `Desa Teluk Majelis, Kecamatan Kuala Jambi, Kabupaten Tanjung Jabung Timur`

## 5. Foto

- `custom.js` memakai `sanitizeMediaPath`: ganti `\`, `/`, `:` menjadi `_`.
- File di `images/` export sudah memakai nama hasil sanitasi itu.
- Saat append: nilai `Foto Survey Awal` = path Windows dari export (sama pola
  titik lama), agar sanitasi menghasilkan nama file yang sama.
- Copy **hanya** 105 file foto yang `Nomor`-nya termasuk titik baru, dari
  folder images export → `images/` repo.
- Jangan hapus atau overwrite 230 foto existing.

## 6. File yang berubah

1. `data/points.geojson` — features 230 → 335 (230 lama + 105 baru).
2. `images/` — +105 file jpg.
3. `layers/layers.js` — bump query cache pada URL geojson
   (`./data/points.geojson?v=…`) agar browser tidak memakai cache lama.

Tidak diubah: `custom.js`, `custom.css`, `index.html`, layer batas JS,
`resources/`.

## 7. Cara eksekusi

Satu skrip one-shot (Python di mesin lokal, tidak perlu ikut ke runtime web):

1. Parse GeoJSON dari `UPDATEPER27JULI2026_4.js`.
2. Load `data/points.geojson`.
3. Bangun set `Nomor` existing; filter 105 baru; transform; append.
4. Tulis ulang `points.geojson` (FeatureCollection valid, pretty atau compact
   konsisten dengan file sekarang).
5. Copy 105 foto baru.
6. Bump `?v=` di `layers/layers.js`.

Skrip boleh hidup sementara di `scripts/` atau dijalankan inline; tidak wajib
jadi bagian permanent pipeline kecuali berguna untuk update berikutnya.

## 8. Verifikasi

Setelah merge:

| Cek | Kriteria lulus |
|---|---|
| Jumlah feature | `len(features) == 335` |
| Nomor unik | 335 unique, supersets 230 Nomor lama |
| 230 lama | properties & geometry byte-sama / deep-equal dengan backup sebelum tulis |
| Foto baru | 105 path hasil `sanitizeMediaPath` ada di `images/` |
| Sample popup | Satu titik Kerinci + satu Tanjung Jabung Timur: Alamat terisi, foto load |
| Cache bust | `layers.js` URL `points.geojson` punya `?v=` baru |

## 9. Out of scope

- Migrasi schema ke kab/kec/desa terpisah di UI
- Mengisi manual 23 tanggal kosong
- Update / replace layer batas dari export
- Deploy ke production (terpisah setelah verifikasi lokal)
