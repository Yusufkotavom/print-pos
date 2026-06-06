# Rencana Local-First, PWA, Image Storage, dan App Wrapper

**Tanggal:** 2026-06-06  
**Tujuan:** Menjadikan FinOpenPOS tetap bisa dipakai saat internet tidak stabil, siap dipasang sebagai PWA, dan punya jalur jelas untuk Android/Desktop tanpa mengulang arsitektur.

---

## 1. Urutan Prioritas

| Prioritas | Area | Alasan |
|---:|---|---|
| 1 | Stabilkan model data server | Local-first butuh kontrak data jelas dulu. |
| 2 | Dexie local cache + draft | Nilai offline paling cepat tanpa risiko sync besar. |
| 3 | Sync queue transaksi/service | Fitur utama: kasir tetap jalan offline. |
| 4 | PWA app shell | Bisa install dan buka offline. |
| 5 | Image storage produk | Perlu strategi storage + sync, jangan dicampur awal. |
| 6 | Android wrapper | Setelah PWA stabil. |
| 7 | Desktop wrapper | Setelah web/PWA stabil dan kebutuhan native jelas. |

Prinsip: **web app tetap sumber utama**, wrapper hanya packaging dan native bridge.

---

## 2. Fase 0 — Fondasi Data dan API

### Tujuan

Pastikan data yang akan disimpan lokal punya bentuk stabil.

### Kerjakan dulu

1. Rapikan entity penting:
   - `products`
   - `customers`
   - `orders`
   - `order_items`
   - `service_orders`
   - `service_order_items`
   - `payments`
   - `payment_methods`
   - `company_settings`
2. Tambah/validasi field sync:
   - `id`
   - `user_uid`
   - `created_at`
   - `updated_at`
   - optional `deleted_at` untuk soft delete.
3. Hindari delete fisik untuk data transaksi.
4. Tentukan aturan stok:
   - stok server tetap authoritative.
   - offline boleh buat order, tetapi stok final divalidasi saat sync.

### Jangan dulu

- Jangan langsung bikin conflict resolver kompleks.
- Jangan langsung sync semua tabel.
- Jangan langsung image upload offline.

---

## 3. Fase 1 — Dexie Local Cache dan Draft Offline

### Tujuan

App bisa menyimpan data lokal tanpa langsung mengubah backend besar.

### Teknologi

Gunakan **Dexie**. Jangan raw IndexedDB kecuali ada kebutuhan khusus.

### Local DB schema awal

```ts
products: "id, serverId, name, sku, updatedAt"
customers: "id, serverId, name, phone, updatedAt"
orders: "id, serverId, status, paymentStatus, createdAt, updatedAt"
serviceOrders: "id, serverId, status, paymentStatus, createdAt, updatedAt"
payments: "id, serverId, orderId, serviceOrderId, createdAt"
syncQueue: "id, entity, operation, status, createdAt"
appMeta: "key"
```

### Kerjakan

1. Buat `apps/web/src/lib/local-db`.
2. Tambah Dexie schema dan migration versioning.
3. Buat repository layer:
   - `productLocalRepo`
   - `customerLocalRepo`
   - `orderLocalRepo`
   - `serviceOrderLocalRepo`
   - `syncQueueRepo`
4. Cache data read-only dulu:
   - product list
   - customer list
   - payment methods
5. Simpan draft POS/service order lokal.

### Output fase ini

- Jika refresh browser, draft tidak hilang.
- Produk/customer masih bisa dilihat dari cache saat offline.
- Belum perlu sync transaksi final.

---

## 4. Fase 2 — Offline Transaction dan Sync Queue

### Tujuan

Kasir bisa membuat transaksi/service order saat offline.

### Sync queue payload

```ts
type SyncOperation = {
  id: string;
  entity: "order" | "serviceOrder" | "payment" | "customer";
  operation: "create" | "update" | "delete";
  payload: unknown;
  status: "pending" | "syncing" | "success" | "failed" | "conflict";
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
```

### Kerjakan

1. Local ID pakai UUID.
2. Server response balikin `serverId`.
3. Simpan mapping `localId -> serverId`.
4. Jalankan sync saat:
   - app start
   - status online berubah
   - user klik `Sync now`
   - interval ringan saat online.
5. Tambah UI status:
   - Online
   - Offline
   - Pending sync count
   - Sync failed
6. Retry dengan backoff sederhana.

### Conflict rule awal

| Data | Rule awal |
|---|---|
| Product stock | Server authoritative |
| Payment | Tidak overwrite; append-only |
| Order/service create | Aman sync jika local ID belum pernah dipakai |
| Customer update | Last-write-wins sementara |
| Delete | Soft delete saja |

### Output fase ini

- Offline bisa buat order/service order.
- Saat online, data tersinkron ke server.
- Gagal sync terlihat jelas, tidak diam-diam hilang.

---

## 5. Fase 3 — PWA

### Tujuan

App bisa di-install dan punya offline shell.

### Kerjakan

1. Tambah `manifest.webmanifest`.
2. Tambah service worker.
3. Cache:
   - app shell
   - static assets
   - fonts/icons
4. Jangan cache API sebagai sumber utama. API result masuk Dexie.
5. Tambah offline fallback page.
6. Tambah install prompt.
7. Tambah icon set:
   - 192x192
   - 512x512
   - maskable icon.

### Output fase ini

- Browser bisa install app.
- App bisa dibuka saat offline.
- POS/service page tetap bisa pakai cache lokal.

---

## 6. Fase 4 — Image Storage Produk

### Tujuan

Produk punya gambar yang aman, cepat, dan tetap bisa bekerja offline.

### Rekomendasi bertahap

#### Tahap 4A — Online image storage dulu

Gunakan object storage untuk file asli:

- Cloudflare R2, Supabase Storage, S3-compatible, atau storage server sendiri.
- Database simpan metadata saja:
  - `image_url`
  - `image_key`
  - `image_width`
  - `image_height`
  - `image_blurhash` optional
  - `image_updated_at`

Kerjakan:

1. Tambah field image di product.
2. Upload gambar saat online.
3. Optimasi ukuran sebelum upload.
4. Tampilkan placeholder jika gambar belum ada.

#### Tahap 4B — Local image cache

Setelah online storage stabil:

1. Cache thumbnail di Dexie sebagai Blob.
2. Simpan metadata:
   - `productId`
   - `imageKey`
   - `blob`
   - `updatedAt`
3. Batasi cache size.
4. Tambah cleanup cache lama.

#### Tahap 4C — Offline image upload queue

Belakangan:

1. Jika offline, simpan image Blob lokal.
2. Tambah item ke `syncQueue` entity `productImage`.
3. Upload saat online.
4. Setelah sukses, hapus Blob lokal besar.

### Jangan awal

- Jangan simpan semua gambar full-size di IndexedDB.
- Jangan base64 image di database SQL.
- Jangan upload offline sebelum sync queue data stabil.

---

## 7. Fase 5 — Android Wrapper

### Rekomendasi

Gunakan **Capacitor** setelah PWA stabil.

### Alasan

- Cocok untuk web app existing.
- Bisa tetap pakai Next.js/PWA sebagai basis.
- Native bridge tersedia saat dibutuhkan.

### Native feature yang mungkin dibutuhkan

1. Barcode scanner kamera.
2. Bluetooth printer thermal.
3. File picker untuk import produk.
4. Share invoice/WhatsApp.
5. Push/local notifications.

### Urutan

1. Pastikan PWA stabil.
2. Tambah Capacitor project.
3. Build Android wrapper.
4. Test storage Dexie di WebView.
5. Baru tambah plugin native satu per satu.

---

## 8. Fase 6 — Desktop Wrapper

### Rekomendasi

Gunakan **Tauri** jika ingin ringan. Gunakan Electron hanya jika butuh ekosistem plugin besar.

### Pertimbangan

Tauri bagus untuk:

- ukuran app kecil
- performa bagus
- akses file system/printer via Rust plugin

Electron bagus untuk:

- plugin JS luas
- integrasi printer lebih banyak referensi
- packaging lebih familiar

### Urutan

1. Finalkan PWA/local-first dulu.
2. Tentukan kebutuhan desktop:
   - print struk langsung?
   - backup lokal?
   - import/export file?
   - multi-device LAN?
3. Pilih Tauri/Electron.
4. Buat wrapper minimal.
5. Baru tambah native integration.

---

## 9. Risiko Teknis

| Risiko | Mitigasi |
|---|---|
| Data dobel saat sync | Pakai local UUID + idempotency key. |
| Stok tidak akurat offline | Server authoritative, tampilkan warning saat sync conflict. |
| Payment konflik | Payment append-only, tidak delete fisik. |
| IndexedDB penuh karena gambar | Cache thumbnail saja, full image di object storage. |
| Wrapper Android beda behavior | Test Dexie, service worker, dan auth di WebView sejak awal wrapper. |
| Desktop printing kompleks | Jangan jadikan syarat fase awal. |

---

## 10. Roadmap Ringkas

### Sprint 1

- Tambah Dexie.
- Local cache product/customer/payment methods.
- Draft POS/service order lokal.

### Sprint 2

- Sync queue create order/service order.
- UI online/offline/pending sync.
- Retry sync.

### Sprint 3

- PWA manifest + service worker.
- Offline shell.
- Install prompt.

### Sprint 4

- Product image online storage.
- Product image metadata.
- Thumbnail display.

### Sprint 5

- Local thumbnail cache.
- Offline image upload queue jika dibutuhkan.

### Sprint 6

- Android wrapper dengan Capacitor.
- Test Dexie/auth/PWA behavior.

### Sprint 7

- Desktop wrapper prototype.
- Pilih Tauri atau Electron berdasarkan kebutuhan printer/file.

---

## 11. Keputusan Awal yang Disarankan

1. Pakai **Dexie**, bukan raw IndexedDB.
2. PWA dulu sebelum Android/Desktop.
3. Image storage online dulu, offline image upload belakangan.
4. Stok dan payment tetap server authoritative.
5. Wrapper tidak boleh mengubah core business logic.
6. Sync queue wajib punya UI visible, agar kasir tahu data belum terkirim.
