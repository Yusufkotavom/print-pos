# Rencana Produk FinOpenPOS untuk UMKM Percetakan dan Counter HP

**Tanggal:** 2026-06-05  
**Target pasar utama:** UMKM Indonesia, terutama percetakan kecil/menengah dan counter HP.  
**Tujuan:** Mengubah FinOpenPOS dari POS generik menjadi aplikasi kasir operasional harian yang kuat untuk transaksi campuran: produk fisik, jasa/service, uang muka, invoice, pelunasan, dan riwayat pelanggan.

---

## 1. Prinsip Produk

1. **Kasir cepat dulu, akuntansi mengikuti.** Kasir tidak boleh dipaksa mengisi data kompleks saat antrean ramai.
2. **Satu transaksi bisa campur produk dan service.** Contoh: beli casing + pasang tempered glass + service ganti LCD.
3. **Invoice bukan hanya struk.** Invoice harus bisa belum lunas, sebagian lunas, jatuh tempo, revisi, dan dicetak ulang.
4. **Riwayat pelanggan penting.** Counter HP dan percetakan sering melayani pelanggan berulang dengan komplain, garansi, revisi desain, atau cicilan pembayaran.
5. **Stok hanya untuk barang fisik.** Service tidak mengurangi stok, tapi bisa memakai bahan/sparepart.
6. **Mode sederhana harus tetap ada.** Banyak UMKM tidak butuh fitur pajak/akuntansi penuh di awal.

---

## 2. Product Type

### 2.1 Tipe Produk

Tambahkan field `product_type`:

- `product`: barang fisik yang punya stok.
- `service`: jasa tanpa stok langsung.
- `bundle`: paket gabungan item product/service. Bisa ditunda sampai fase berikutnya.

### 2.2 Aturan Dasar

| Tipe | Stok | Harga | Bisa masuk POS | Bisa masuk invoice | Contoh |
|---|---:|---:|---|---|---|
| `product` | Ya | Ya | Ya | Ya | Casing, tinta, kertas, charger |
| `service` | Tidak | Ya | Ya | Ya | Print A4, desain banner, install ulang, ganti LCD |
| `bundle` | Opsional | Ya | Ya | Ya | Paket cetak + laminasi, paket service + sparepart |

### 2.3 Service yang Memakai Sparepart/Bahan

Service bisa punya komponen opsional:

- `service_components`
  - `service_product_id`
  - `component_product_id`
  - `quantity`

Contoh:
- Service `Ganti LCD iPhone 11`
  - Komponen: `LCD iPhone 11` x1
- Service `Cetak foto 4R`
  - Komponen: `Kertas foto 4R` x1

Saat service dijual, sistem mengurangi stok komponennya, bukan stok service.

---

## 3. Recipe POS: Invoice, Pembayaran, Pelunasan

### 3.1 Tujuan

Mendukung alur transaksi UMKM yang sering terjadi:

1. Pelanggan pesan jasa/barang.
2. Kasir buat invoice.
3. Pelanggan bayar lunas atau DP.
4. Pesanan dikerjakan.
5. Pelanggan melunasi saat ambil barang.
6. Invoice dan riwayat pembayaran tetap rapi.

### 3.2 Status Invoice

Tambahkan status invoice/order:

- `draft`: belum final, masih diedit.
- `issued`: invoice aktif, belum lunas.
- `partially_paid`: sudah ada pembayaran sebagian.
- `paid`: lunas.
- `cancelled`: batal.
- `refunded`: dikembalikan.

### 3.3 Status Pengerjaan

Pisahkan status pembayaran dari status pengerjaan:

- `not_started`
- `in_progress`
- `ready`
- `delivered`
- `cancelled`

Contoh percetakan:
- Invoice `partially_paid`, pekerjaan `in_progress`.
- Invoice `paid`, pekerjaan `ready`.

Contoh counter HP:
- Invoice `issued`, pekerjaan `not_started`.
- Invoice `partially_paid`, pekerjaan `in_progress`.
- Invoice `paid`, pekerjaan `delivered`.

### 3.4 Payment Model

Jangan simpan pembayaran sebagai satu field di order saja. Buat tabel pembayaran terpisah:

- `payments`
  - `id`
  - `order_id`
  - `payment_method_id`
  - `amount`
  - `type`: `payment`, `refund`
  - `status`: `completed`, `voided`
  - `paid_at`
  - `notes`
  - `user_uid`
  - `created_at`

Invoice menghitung:

```text
paid_amount = sum(payments where type = payment and status = completed)
refund_amount = sum(payments where type = refund and status = completed)
outstanding_amount = order.total_amount - paid_amount + refund_amount
```

### 3.5 POS Flow: Bayar Lunas

1. Kasir pilih pelanggan opsional.
2. Kasir tambah item:
   - product biasa
   - service
   - campuran product + service
3. Kasir klik `Checkout`.
4. Pilih metode pembayaran.
5. Input jumlah bayar = total.
6. Sistem:
   - membuat order/invoice
   - membuat order_items
   - membuat payment
   - mengurangi stok product dan komponen service
   - set invoice `paid`
   - set pekerjaan `delivered` untuk transaksi langsung, atau `not_started` untuk job order
7. Cetak struk/invoice.

### 3.6 POS Flow: DP / Belum Lunas

1. Kasir tambah item.
2. Kasir klik `Buat Invoice`.
3. Pilih pelanggan wajib jika invoice belum lunas.
4. Input DP, boleh `0`.
5. Sistem:
   - membuat order/invoice
   - membuat payment jika DP > 0
   - status invoice:
     - `issued` jika belum bayar
     - `partially_paid` jika DP > 0 dan belum lunas
   - status pengerjaan default `not_started`
6. Invoice bisa dicetak/WhatsApp.

### 3.7 Flow Pelunasan

1. Buka halaman invoice/order detail.
2. Sistem tampilkan:
   - total invoice
   - sudah dibayar
   - sisa tagihan
   - riwayat pembayaran
3. Kasir klik `Terima Pembayaran`.
4. Input nominal dan metode pembayaran.
5. Sistem:
   - tambah row `payments`
   - update invoice status:
     - tetap `partially_paid` jika masih sisa
     - `paid` jika lunas
6. Cetak bukti pelunasan.

### 3.8 Validasi Penting

- Tidak boleh bayar lebih dari sisa tagihan kecuali fitur kembalian/overpayment sudah didesain.
- Invoice belum lunas wajib punya pelanggan.
- Product fisik tidak boleh dijual melebihi stok kecuali `allow_negative_stock` aktif.
- Service boleh dijual tanpa stok, tapi komponennya tetap divalidasi jika ada.
- Pembayaran tidak boleh dihapus fisik; gunakan `voided` agar audit tetap aman.

---

## 4. Kebutuhan Khusus Percetakan

### 4.1 Item Service Percetakan

Contoh service:

- Print A4 BW per lembar
- Print A4 warna per lembar
- Fotocopy
- Laminating
- Jilid spiral
- Desain banner
- Cetak banner per meter
- Cetak foto
- Scan dokumen

### 4.2 Variasi Harga

Percetakan butuh harga dinamis:

- berdasarkan ukuran
- berdasarkan jumlah lembar
- berdasarkan warna/hitam putih
- berdasarkan bahan
- berdasarkan finishing
- berdasarkan tingkat urgensi

Saran model awal:

- Tetap pakai item service biasa.
- Tambahkan field `custom_description` dan `custom_price` di order item.
- Jangan langsung membangun pricing engine kompleks.

Contoh order item:

```text
Service: Cetak Banner
Deskripsi: Banner 3x1m bahan flexi China + mata ayam
Qty: 3 meter
Harga: 25.000/meter
Subtotal: 75.000
```

### 4.3 Job Ticket

Untuk percetakan, invoice sering perlu instruksi produksi:

- deadline
- file/desain sudah diterima atau belum
- ukuran
- bahan
- finishing
- catatan revisi
- status produksi

Tambahkan nanti:

- `jobs`
  - `order_id`
  - `status`
  - `deadline_at`
  - `production_notes`
  - `file_status`: `not_received`, `received`, `approved`

---

## 5. Kebutuhan Khusus Counter HP

### 5.1 Item Service Counter

Contoh service:

- Ganti LCD
- Ganti baterai
- Install ulang
- Flash firmware
- Bersihkan speaker
- Ganti konektor charger
- Backup data
- Pasang tempered glass

### 5.2 Data Perangkat

Counter HP perlu menyimpan data perangkat pelanggan:

- brand
- model
- IMEI/serial opsional
- keluhan
- kondisi awal
- kelengkapan: unit, charger, box, SIM tray
- pola/password opsional dengan catatan keamanan

Tambahkan nanti:

- `customer_devices`
- `service_tickets`

### 5.3 Garansi Service

Butuh garansi per service/sparepart:

- warranty_days di product/service
- warranty_until di order item
- catatan garansi tidak berlaku jika segel rusak/kena air

---

## 6. Rekomendasi Modul Prioritas

### Fase 1 — POS Core untuk Campuran Product + Service

1. Tambah `product_type`.
2. Ubah form produk agar bisa pilih `Product` atau `Service`.
3. Untuk service, stok disembunyikan atau otomatis `0`.
4. POS/cart bisa tambah product dan service.
5. Order item menyimpan snapshot nama, tipe, harga, dan deskripsi custom.
6. Delete product aman walau sudah dipakai order.

### Fase 2 — Invoice dan Pembayaran Bertahap

1. Tambah `payments` table.
2. Pisahkan `payment_status` dan `fulfillment_status`.
3. Tambah halaman order detail/invoice.
4. Tambah aksi `Terima Pembayaran`.
5. Tambah cetak invoice dan cetak bukti pembayaran.

### Fase 3 — Workflow Percetakan

1. Tambah job ticket.
2. Tambah deadline.
3. Tambah catatan produksi.
4. Tambah status file/desain.
5. Tambah tampilan antrian produksi.

### Fase 4 — Workflow Counter HP

1. Tambah data perangkat pelanggan.
2. Tambah service ticket.
3. Tambah checklist kondisi awal.
4. Tambah garansi service/sparepart.
5. Tambah cetak tanda terima service.

### Fase 5 — Laporan UMKM

1. Laporan penjualan harian.
2. Laporan pembayaran belum lunas.
3. Laporan produk/service terlaris.
4. Laporan stok menipis.
5. Laporan kas per metode pembayaran.
6. Laporan piutang pelanggan.

---

## 7. Perubahan Data Model yang Disarankan

### 7.1 Products

Tambahkan:

- `product_type`: `product | service`
- `sku` opsional
- `unit`: `pcs`, `lembar`, `meter`, `paket`, `service`
- `track_stock`: boolean
- `allow_negative_stock`: boolean
- `warranty_days`: integer nullable
- `is_active`: boolean

### 7.2 Order Items

Tambahkan snapshot agar riwayat tidak rusak saat produk diedit/dihapus:

- `item_name`
- `item_type`
- `description`
- `unit_price`
- `quantity`
- `subtotal`
- `warranty_until`

`product_id` tetap nullable untuk referensi historis.

### 7.3 Orders / Invoices

Tambahkan:

- `invoice_number`
- `customer_id` nullable untuk transaksi lunas cepat, wajib untuk invoice belum lunas
- `payment_status`
- `fulfillment_status`
- `due_date`
- `notes`
- `subtotal_amount`
- `discount_amount`
- `total_amount`

### 7.4 Payments

Tabel baru seperti di bagian payment model.

### 7.5 Stock Movements

Untuk audit stok:

- `stock_movements`
  - `product_id`
  - `type`: `sale`, `purchase`, `adjustment`, `return`
  - `quantity_delta`
  - `order_id`
  - `notes`
  - `created_at`

Jangan hanya mengubah angka `in_stock`; simpan pergerakannya.

---

## 8. Saran UX

### 8.1 Produk

- Badge `Product` / `Service` di tabel produk.
- Service tidak menampilkan stok sebagai field wajib.
- Product fisik menampilkan stok dan peringatan stok rendah.

### 8.2 POS

- Tab/filter: Semua, Produk, Service, Kategori.
- Cart item bisa edit harga dan deskripsi jika kasir punya izin.
- Tombol checkout:
  - `Bayar Lunas`
  - `Buat Invoice / DP`

### 8.3 Invoice Detail

Tampilkan ringkasan besar:

```text
Total: Rp 500.000
Dibayar: Rp 200.000
Sisa: Rp 300.000
Status: Belum Lunas
```

Aksi:

- Terima Pembayaran
- Cetak Invoice
- Cetak Bukti Bayar
- Tandai Siap
- Tandai Diambil
- Batalkan

### 8.4 Customer Detail

Tampilkan:

- total transaksi
- piutang berjalan
- invoice belum lunas
- riwayat service/print
- perangkat pelanggan untuk counter HP

---

## 9. Risiko dan Keputusan

### Risiko 1: Pricing percetakan terlalu kompleks

**Keputusan:** Awal gunakan custom description + custom price per order item. Pricing engine dibuat setelah pola transaksi nyata terlihat.

### Risiko 2: Service dan product dicampur tanpa snapshot

**Keputusan:** Order item wajib menyimpan snapshot nama/harga/tipe. Jangan bergantung pada table products untuk riwayat invoice.

### Risiko 3: Pembayaran diubah/hapus sembarangan

**Keputusan:** Payment tidak dihapus. Gunakan void/refund agar audit aman.

### Risiko 4: App menjadi terlalu kompleks untuk UMKM kecil

**Keputusan:** Semua fitur lanjutan harus opsional. Flow kasir cepat tetap satu layar.

---

## 10. Acceptance Criteria Awal

Fase awal dianggap berhasil jika:

1. Kasir bisa membuat produk fisik dan service.
2. Kasir bisa menjual product + service dalam satu cart.
3. Service tidak mengurangi stok.
4. Product mengurangi stok.
5. Invoice bisa dibuat lunas dan belum lunas.
6. Pembayaran sebagian bisa dicatat.
7. Pelunasan bisa dilakukan dari invoice detail.
8. Riwayat order tetap benar walaupun produk/service diubah atau dihapus.
9. Percetakan bisa mencatat order custom dengan deskripsi bebas.
10. Counter HP bisa mencatat minimal keluhan/service dalam catatan invoice sebelum modul device dibuat.

---

## 11. Rekomendasi Implementasi Terdekat

Urutan paling aman:

1. Tambah snapshot fields di `order_items`.
2. Tambah `product_type` dan `track_stock` di `products`.
3. Update UI product form dan product list.
4. Update POS/cart untuk menerima service.
5. Tambah `payments` table.
6. Ubah order create agar selalu membuat invoice + payment terpisah.
7. Tambah halaman order detail untuk pelunasan.
8. Tambah invoice print sederhana.
9. Baru masuk job ticket percetakan dan service ticket counter HP.
