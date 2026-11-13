# Privacy & Data Policy

## 1. Overview
The Company Knowledge Assistant processes uploaded documents (PDF, DOCX, TXT) and user queries to generate grounded answers with verifiable citations.

## 2. LLM Provider Data Policy
- **Free Tier (`LLM_TIER=free`):**
  When configured on Google AI Studio's free tier, prompts, queries, and document chunks sent to the model may be logged and reviewed by human annotators to improve Google products.
  **Important:** Do not upload confidential, sensitive personal, or regulated proprietary documents while running on the free tier. Users are prompted with a confidentiality acknowledgment banner prior to document upload.
- **Paid Tier (`LLM_TIER=paid`):**
  When connected to Google Cloud Vertex AI or a commercial billing account, data is not logged or used for model training.

## 3. Storage & Retention
- **Original Files:** Uploaded files are stored in a private Supabase Storage bucket (`documents`) accessible solely through backend authentication.
- **Vector Embeddings & Chunks:** Document chunks and corresponding 768-dimensional vector representations are stored in PostgreSQL with pgvector under strict row-level workspace separation.
- **Embedding Cache:** Content-hash keyed embeddings (`embedding_cache`) are purged automatically after 30 days of inactivity.
- **Deletion:** Deleting a document immediately cascades to remove its Storage object, database metadata, and chunk vectors. Deleting a workspace removes all associated documents, conversations, and audit trails.

