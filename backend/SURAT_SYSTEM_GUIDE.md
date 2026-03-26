# Sistem Surat (Letter Management System)

## Overview

Sistem manajemen surat untuk AISYA yang mendukung:
- **Template surat** dengan placeholder dinamis
- **Auto-numbering** dengan format standar Indonesia
- **Generate surat** dari template dengan parameter
- **Export PDF** otomatis dengan format profesional

## Database Tables

### 1. template_surat
Menyimpan template surat yang dapat digunakan ulang.

**Columns:**
- `id`: Primary key
- `ra_id`: Foreign key ke ra_profiles
- `nama_template`: Nama template (misal: "Undangan Rapat Orang Tua")
- `jenis_surat`: Kategori surat (undangan/keterangan/pemberitahuan/permohonan/lainnya)
- `konten_template`: Konten dengan placeholder `{{variable}}`
- `created_at`: Timestamp

### 2. surat
Menyimpan surat yang sudah di-generate.

**Columns:**
- `id`: Primary key
- `ra_id`: Foreign key ke ra_profiles
- `template_id`: Foreign key ke template_surat (nullable)
- `nomor_surat`: Nomor surat unik (format: 001/RA/III/2026)
- `judul`: Judul surat
- `konten_final`: Konten yang sudah diisi
- `file_pdf_url`: URL file PDF (optional)
- `created_by`: Foreign key ke profiles
- `created_at`: Timestamp

### 3. nomor_surat_counter
Counter untuk auto-generate nomor surat per RA, tahun, dan bulan.

**Columns:**
- `ra_id`: Foreign key ke ra_profiles
- `tahun`: Tahun (4 digit)
- `bulan`: Bulan (1-12)
- `counter`: Counter value (auto-increment)
- Primary key: (ra_id, tahun, bulan)

## API Endpoints

### Template Surat CRUD

#### 1. Create Template
**POST** `/api/template-surat/`

Create template surat baru.

**Request Body:**
```json
{
  "nama_template": "Undangan Rapat Orang Tua",
  "jenis_surat": "undangan",
  "konten_template": "Kepada Yth.\nBapak/Ibu {{nama_wali}}\n\nKami mengundang pada:\nTanggal: {{tanggal}}\nTempat: {{tempat}}"
}
```

**Response:**
```json
{
  "id": 1,
  "ra_id": 1,
  "nama_template": "Undangan Rapat Orang Tua",
  "jenis_surat": "undangan",
  "konten_template": "Kepada Yth.\nBapak/Ibu {{nama_wali}}...",
  "created_at": "2026-03-10T10:00:00Z"
}
```

#### 2. List Templates
**GET** `/api/template-surat/`

Ambil semua template milik RA.

**Response:**
```json
[
  {
    "id": 1,
    "ra_id": 1,
    "nama_template": "Undangan Rapat Orang Tua",
    "jenis_surat": "undangan",
    "konten_template": "...",
    "created_at": "2026-03-10T10:00:00Z"
  }
]
```

#### 3. Get Template Detail
**GET** `/api/template-surat/{id}`

**Response:** Same as create response

#### 4. Get Template Placeholders
**GET** `/api/template-surat/{id}/placeholders`

Ambil list placeholder yang ada di template (berguna untuk UI form).

**Response:**
```json
{
  "template_id": 1,
  "nama_template": "Undangan Rapat Orang Tua",
  "placeholders": ["nama_wali", "tanggal", "tempat"]
}
```

#### 5. Update Template
**PUT** `/api/template-surat/{id}`

**Request Body:** (all fields optional)
```json
{
  "nama_template": "Undangan Rapat - Updated",
  "jenis_surat": "undangan",
  "konten_template": "..."
}
```

#### 6. Delete Template
**DELETE** `/api/template-surat/{id}`

**Response:**
```json
{
  "success": true,
  "message": "Template berhasil dihapus"
}
```

### Surat Management

#### 1. Generate Surat
**POST** `/api/surat/generate`

Generate surat dari template dengan nomor otomatis.

**Request Body:**
```json
{
  "template_id": 1,
  "judul": "Undangan Rapat Wali Murid Kelompok A",
  "kode_surat": "RA",
  "parameters": {
    "nama_wali": "Bapak Ahmad",
    "tanggal": "15 Maret 2026",
    "tempat": "Ruang Aula RA Al-Hidayah"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Surat berhasil di-generate",
  "surat_id": 10,
  "nomor_surat": "001/RA/III/2026"
}
```

**Process:**
1. Ambil template dari database
2. Generate nomor surat otomatis (001/RA/III/2026)
3. Replace semua placeholder dengan values dari parameters
4. Simpan surat ke database
5. Return nomor surat dan ID

#### 2. List Surat
**GET** `/api/surat/`

**Response:**
```json
[
  {
    "id": 10,
    "nomor_surat": "001/RA/III/2026",
    "judul": "Undangan Rapat Wali Murid Kelompok A",
    "jenis_surat": "undangan",
    "created_at": "2026-03-10T11:00:00Z"
  }
]
```

#### 3. Get Surat Detail
**GET** `/api/surat/{id}`

**Response:**
```json
{
  "id": 10,
  "ra_id": 1,
  "template_id": 1,
  "nomor_surat": "001/RA/III/2026",
  "judul": "Undangan Rapat Wali Murid Kelompok A",
  "konten_final": "Kepada Yth.\nBapak Ahmad\n\nKami mengundang pada:\nTanggal: 15 Maret 2026...",
  "file_pdf_url": null,
  "created_by": 5,
  "created_at": "2026-03-10T11:00:00Z"
}
```

#### 4. Download PDF
**GET** `/api/surat/{id}/pdf`

Download surat dalam format PDF.

**Response:** Binary PDF file
**Filename:** `surat-001-RA-III-2026.pdf`

**PDF Format:**
- Header dengan nomor surat (kanan atas)
- Judul (tengah, bold)
- Konten surat
- Font: Times New Roman
- Margin: 2cm

#### 5. Delete Surat
**DELETE** `/api/surat/{id}`

**Response:**
```json
{
  "success": true,
  "message": "Surat berhasil dihapus"
}
```

## Nomor Surat Auto-Numbering

### Format
```
[counter]/[kode]/[bulan_romawi]/[tahun]
```

**Example:** `001/RA/III/2026`

- **counter**: Auto-increment dimulai dari 001 setiap bulan
- **kode**: Kode surat (default: "RA", bisa custom via parameter)
- **bulan_romawi**: I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII
- **tahun**: 4 digit (2026)

### Counter Logic

1. Sistem cek counter untuk: `(ra_id, tahun, bulan)` saat ini
2. Jika belum ada, create dengan counter = 1
3. Jika sudah ada, increment counter
4. Counter akan **auto-reset** setiap bulan baru

**Contoh:**
- Maret 2026: 001/RA/III/2026, 002/RA/III/2026, ...
- April 2026: 001/RA/IV/2026, 002/RA/IV/2026, ... (counter reset ke 001)

## Template Placeholders

### Cara Menggunakan

Gunakan format `{{nama_variable}}` dalam konten template.

**Example Template:**
```
Kepada Yth.
{{nama_wali}}
{{alamat}}

Dengan hormat,
Kami mengundang Bapak/Ibu untuk menghadiri:

Hari/Tanggal : {{tanggal}}
Waktu        : {{waktu}}
Tempat       : {{tempat}}
Acara        : {{acara}}

Hormat kami,
{{nama_kepala}}
```

**Generate Request:**
```json
{
  "parameters": {
    "nama_wali": "Bapak Ahmad Hidayat",
    "alamat": "Jl. Merdeka No. 123",
    "tanggal": "Sabtu, 15 Maret 2026",
    "waktu": "09.00 - 11.00 WIB",
    "tempat": "Ruang Aula RA Al-Hidayah",
    "acara": "Rapat Wali Murid",
    "nama_kepala": "Ibu Siti Nur Halimah, S.Pd"
  }
}
```

**Result:**
```
Kepada Yth.
Bapak Ahmad Hidayat
Jl. Merdeka No. 123

Dengan hormat,
Kami mengundang Bapak/Ibu untuk menghadiri:

Hari/Tanggal : Sabtu, 15 Maret 2026
Waktu        : 09.00 - 11.00 WIB
Tempat       : Ruang Aula RA Al-Hidayah
Acara        : Rapat Wali Murid

Hormat kami,
Ibu Siti Nur Halimah, S.Pd
```

## Contoh Template

### 1. Undangan Rapat Orang Tua

```
UNDANGAN

Kepada Yth.
Bapak/Ibu Wali Murid {{kelompok}}
Di Tempat

Assalamu'alaikum Wr. Wb.

Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri:

Hari/Tanggal : {{tanggal}}
Waktu        : {{waktu}}
Tempat       : {{tempat}}
Acara        : {{acara}}

Demikian undangan ini kami sampaikan. Atas perhatian dan kehadiran Bapak/Ibu, kami ucapkan terima kasih.

Wassalamu'alaikum Wr. Wb.

{{tempat}}, {{tanggal_surat}}
Kepala RA {{nama_ra}}

{{nama_kepala}}
```

**Placeholders:** kelompok, tanggal, waktu, tempat, acara, tanggal_surat, nama_ra, nama_kepala

### 2. Surat Keterangan Siswa

```
SURAT KETERANGAN

Yang bertanda tangan di bawah ini:

Nama            : {{nama_kepala}}
Jabatan         : Kepala RA {{nama_ra}}
Alamat          : {{alamat_ra}}

Dengan ini menerangkan bahwa:

Nama            : {{nama_siswa}}
Tempat/Tgl Lahir: {{tempat_lahir}}, {{tanggal_lahir}}
Jenis Kelamin   : {{jenis_kelamin}}
Alamat          : {{alamat_siswa}}

Adalah benar-benar siswa RA {{nama_ra}} Kelompok {{kelompok}} Tahun Ajaran {{tahun_ajaran}}.

Surat keterangan ini dibuat untuk {{keperluan}}.

Demikian surat keterangan ini dibuat dengan sebenarnya.

{{tempat}}, {{tanggal}}
Kepala RA

{{nama_kepala}}
```

**Placeholders:** nama_kepala, nama_ra, alamat_ra, nama_siswa, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat_siswa, kelompok, tahun_ajaran, keperluan, tempat, tanggal

### 3. Pemberitahuan Libur

```
PEMBERITAHUAN

Kepada Yth.
Bapak/Ibu Wali Murid RA {{nama_ra}}
Di Tempat

Assalamu'alaikum Wr. Wb.

Dengan ini kami beritahukan bahwa RA {{nama_ra}} akan libur pada:

Tanggal : {{tanggal_mulai}} s/d {{tanggal_selesai}}
Alasan  : {{alasan}}

Kegiatan belajar mengajar akan dimulai kembali pada {{tanggal_masuk}}.

Demikian pemberitahuan ini kami sampaikan. Terima kasih.

Wassalamu'alaikum Wr. Wb.

{{tempat}}, {{tanggal_surat}}
Kepala RA

{{nama_kepala}}
```

**Placeholders:** nama_ra, tanggal_mulai, tanggal_selesai, alasan, tanggal_masuk, tempat, tanggal_surat, nama_kepala

## Integration Tips

### 1. Workflow Generate Surat

```javascript
// Frontend flow
async function generateSurat(templateId, data) {
  // 1. Get template & placeholders
  const template = await fetch(`/api/template-surat/${templateId}`);
  const { placeholders } = await fetch(`/api/template-surat/${templateId}/placeholders`);
  
  // 2. Show form untuk isi placeholders
  const parameters = await showForm(placeholders);
  
  // 3. Generate surat
  const result = await fetch('/api/surat/generate', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      judul: data.judul,
      kode_surat: 'RA',
      parameters: parameters
    })
  });
  
  // 4. Download PDF
  window.open(`/api/surat/${result.surat_id}/pdf`);
}
```

### 2. Dynamic Form Generation

Gunakan endpoint `/placeholders` untuk generate form dinamis:

```javascript
const { placeholders } = await getPlaceholders(templateId);
// placeholders = ["nama_wali", "tanggal", "tempat"]

// Generate form fields
placeholders.forEach(field => {
  createInputField(field); // Create input for each placeholder
});
```

### 3. Bulk Generate

Untuk generate banyak surat sekaligus (misal: undangan untuk semua wali murid):

```javascript
const siswaList = await fetch('/api/siswa?kelompok_id=1');

for (const siswa of siswaList) {
  await fetch('/api/surat/generate', {
    method: 'POST',
    body: JSON.stringify({
      template_id: 1,
      judul: `Undangan Rapat Wali Murid - ${siswa.nama}`,
      parameters: {
        nama_wali: siswa.nama_wali,
        nama_siswa: siswa.nama,
        // ... field lainnya
      }
    })
  });
}
```

## Troubleshooting

### Counter tidak increment

**Solusi:** Cek `nomor_surat_counter` table:
```sql
SELECT * FROM nomor_surat_counter 
WHERE ra_id = 1 AND tahun = 2026 AND bulan = 3;
```

### Placeholder tidak ter-replace

**Solusi:** 
1. Pastikan nama placeholder di template sesuai dengan key di parameters
2. Gunakan format `{{variable}}` (bukan `{variable}` atau `[[variable]]`)
3. Cek endpoint `/placeholders` untuk list yang benar

### PDF tidak ter-generate

**Solusi:**
1. Pastikan WeasyPrint terinstall
2. Cek logs untuk error detail
3. Verifikasi konten HTML valid

## Best Practices

1. **Template Naming Convention**
   - Gunakan nama yang deskriptif: "Undangan Rapat Orang Tua" ✓
   - Hindari nama generik: "Template 1" ✗

2. **Placeholder Naming**
   - Gunakan snake_case: `nama_siswa`, `tanggal_lahir`
   - Gunakan nama yang jelas
   - Hindari singkatan tidak jelas

3. **Kode Surat**
   - Default: "RA" untuk surat umum
   - Custom: "RA-UM" (undangan), "RA-KET" (keterangan), dst
   - Konsisten per jenis surat

4. **Judul Surat**
   - Spesifik dan informatif
   - Include context: "Undangan Rapat Wali Murid Kelompok A - Maret 2026"

5. **Backup Template**
   - Export template penting secara berkala
   - Simpan versi backup sebelum update

## Database Migration

Jalankan [database_setup_surat.sql](database_setup_surat.sql) di Supabase SQL Editor untuk setup semua tabel, indexes, dan RLS policies.
