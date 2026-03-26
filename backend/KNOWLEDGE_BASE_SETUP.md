# Knowledge Base (RAG) System - Setup Guide

## Overview

Sistem RAG (Retrieval Augmented Generation) untuk AISYA memungkinkan AI assistant menjawab pertanyaan berdasarkan dokumen yang diupload oleh sekolah. Sistem ini menggunakan:

- **pgvector**: Extension PostgreSQL untuk vector similarity search
- **Gemini Embedding API**: Generate embeddings (768 dimensions)
- **FastAPI**: Backend endpoints untuk upload, retrieve, dan delete
- **Multi-format support**: PDF, DOCX, dan TXT

## Database Setup

### 1. Aktifkan pgvector di Supabase

**Via Dashboard:**
1. Buka Supabase Dashboard
2. Pergi ke **Database** → **Extensions**
3. Cari "vector" dan klik **Enable**

**Via SQL Editor:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Jalankan Database Migration

Jalankan file `database_setup_knowledge.sql` melalui Supabase SQL Editor:

```bash
# Copy isi file database_setup_knowledge.sql dan paste di SQL Editor
# Atau gunakan CLI:
supabase db push
```

File ini akan membuat:
- Tabel `knowledge_docs` (metadata dokumen)
- Tabel `knowledge_chunks` (chunks teks dengan vector embeddings)
- Function `match_knowledge_chunks` untuk similarity search
- Index HNSW untuk performa vector search
- Row Level Security policies

## Backend Setup

### 1. Install Dependencies

Dependencies baru sudah ditambahkan ke `requirements.txt`:
- `PyPDF2`: Parse PDF files
- `python-docx`: Parse DOCX files

Rebuild Docker container untuk install dependencies:

```bash
docker compose -f docker-compose.dev.yml up --build
```

### 2. Verify Gemini API Key

Pastikan `GEMINI_API_KEY` sudah di-set di file `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## API Endpoints

### Upload Dokumen

**POST** `/api/knowledge/upload`

Upload file PDF, DOCX, atau TXT ke knowledge base.

**Request:**
```bash
curl -X POST "http://localhost:8000/api/knowledge/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"
```

**Response:**
```json
{
  "success": true,
  "message": "Dokumen berhasil diupload dan diproses menjadi 15 chunks",
  "doc_id": 1,
  "chunks_created": 15
}
```

**Proses yang terjadi:**
1. File di-parse menjadi text
2. Text di-chunk (500 karakter dengan overlap 50)
3. Setiap chunk di-embed menggunakan Gemini (768 dimensions)
4. Embedding disimpan ke `knowledge_chunks` dengan pgvector

### List Dokumen

**GET** `/api/knowledge/documents`

Ambil daftar dokumen yang sudah diupload.

**Request:**
```bash
curl "http://localhost:8000/api/knowledge/documents" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "id": 1,
    "ra_id": 1,
    "nama_file": "kurikulum_merdeka.pdf",
    "uploaded_at": "2026-03-10T08:30:00Z",
    "total_chunks": 15
  }
]
```

### Delete Dokumen

**DELETE** `/api/knowledge/documents/{id}`

Hapus dokumen dan semua chunks-nya.

**Request:**
```bash
curl -X DELETE "http://localhost:8000/api/knowledge/documents/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Dokumen berhasil dihapus"
}
```

## RAG Integration dengan Chat

Chat endpoint (`POST /api/chat/rooms/{room_id}/messages`) sekarang otomatis melakukan retrieval:

### Alur RAG:

1. **User mengirim pesan**: "Apa itu capaian pembelajaran?"
2. **Generate query embedding**: Pesan di-convert ke vector (768 dim)
3. **Similarity search**: Cari chunks dengan cosine similarity > 0.5
4. **Build context**: Top 3 chunks digabung sebagai konteks
5. **Enhanced prompt**: Prompt ke Gemini dilengkapi dengan konteks
6. **AI response**: Gemini menjawab berdasarkan konteks + knowledge-nya

### Contoh Enhanced Prompt:

```
Kamu adalah asisten AI untuk guru RA.

Berikut adalah informasi relevan dari knowledge base:

[Dokumen 1] Capaian pembelajaran adalah kompetensi...
[Dokumen 2] Dalam kurikulum merdeka, CP dibagi...
[Dokumen 3] Asesmen CP dilakukan melalui...

---

Gunakan informasi di atas untuk menjawab pertanyaan berikut...

Pertanyaan: Apa itu capaian pembelajaran?
```

### Konfigurasi RAG

Di `app/utils/retrieval.py`, Anda dapat menyesuaikan:

```python
context_chunks = retrieve_relevant_context(
    query=user_message,
    ra_id=ra_id,
    top_k=3,                    # Jumlah chunks yang diambil
    similarity_threshold=0.5    # Minimum similarity (0-1)
)
```

**Parameter tuning:**
- `top_k`: Semakin besar, semakin banyak konteks (tapi bisa terlalu panjang)
- `similarity_threshold`: 
  - 0.3-0.5: Lebih permisif (lebih banyak hasil, tapi bisa kurang relevan)
  - 0.6-0.8: Lebih ketat (hanya hasil yang sangat relevan)

## File Structure

```
backend/
├── app/
│   ├── models/
│   │   └── knowledge.py          # Pydantic models
│   ├── routers/
│   │   ├── knowledge.py          # Knowledge endpoints
│   │   └── chat.py               # Modified dengan RAG
│   └── utils/
│       ├── embeddings.py         # Gemini embedding wrapper
│       ├── file_parser.py        # PDF/DOCX/TXT parser
│       ├── text_processing.py    # Text chunking
│       └── retrieval.py          # RAG retrieval functions
├── database_setup_knowledge.sql  # Database migration
└── requirements.txt              # Updated dependencies
```

## Troubleshooting

### Error: "extension vector does not exist"

**Solusi:** Aktifkan pgvector di Supabase Dashboard (Database > Extensions)

### Error: "Failed to generate embedding"

**Solusi:** 
1. Cek `GEMINI_API_KEY` di `.env`
2. Verifikasi quota Gemini API di Google AI Studio

### Chunks tidak ditemukan saat retrieval

**Solusi:**
1. Cek apakah dokumen sudah diupload dengan benar
2. Turunkan `similarity_threshold` (misal dari 0.5 ke 0.3)
3. Periksa isi chunks di database:
   ```sql
   SELECT id, doc_id, LEFT(content, 100) FROM knowledge_chunks;
   ```

### RPC function error

**Solusi:** Pastikan function `match_knowledge_chunks` sudah dibuat di database.

```sql
-- Cek function exists
SELECT proname FROM pg_proc WHERE proname = 'match_knowledge_chunks';
```

## Performance Tips

### 1. Chunking Strategy

Default: 500 karakter dengan overlap 50. Sesuaikan di `text_processing.py`:

```python
chunks = chunk_text(
    text, 
    chunk_size=500,   # Lebih kecil = lebih granular, lebih banyak chunks
    overlap=50        # Overlap membantu konteks antar chunks
)
```

### 2. Index Type

HNSW (default) vs IVFFlat:
- **HNSW**: Lebih akurat, cocok untuk < 1M vectors
- **IVFFlat**: Lebih cepat insert, cocok untuk dataset besar

Ganti di `database_setup_knowledge.sql` jika perlu.

### 3. Batasi File Size

Tambahkan validasi di endpoint upload:

```python
# Max 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024

if len(file_content) > MAX_FILE_SIZE:
    raise HTTPException(400, "File terlalu besar (max 10MB)")
```

## Testing

### 1. Upload Test Document

```bash
# Buat file test.txt
echo "Kurikulum Merdeka adalah pendekatan belajar yang memberikan kebebasan..." > test.txt

# Upload
curl -X POST "http://localhost:8000/api/knowledge/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt"
```

### 2. Test Chat dengan RAG

```bash
# Kirim pertanyaan yang relevan dengan dokumen
curl -X POST "http://localhost:8000/api/chat/rooms/1/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Jelaskan tentang Kurikulum Merdeka"}'
```

### 3. Manual Similarity Search

Di Supabase SQL Editor:

```sql
-- Generate dummy embedding (ganti dengan embedding sebenarnya dari Gemini)
SELECT * FROM match_knowledge_chunks(
    (SELECT embedding FROM knowledge_chunks LIMIT 1),
    0.5,
    3,
    1
);
```

## Next Steps

1. **Frontend Integration**: Buat UI untuk upload dokumen di dashboard
2. **Batch Upload**: Support upload multiple files sekaligus
3. **Document Preview**: Tampilkan preview chunks saat upload
4. **Analytics**: Track dokumen mana yang paling sering di-retrieve
5. **Advanced RAG**: Implementasi re-ranking, hybrid search (keyword + semantic)

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Gemini Embedding API](https://ai.google.dev/docs/embeddings_guide)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-search)
