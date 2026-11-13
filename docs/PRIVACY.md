# Privacy & Data Policy

## 1. Overview
The Company Knowledge Assistant processes uploaded documents (PDF, DOCX, TXT) and user inquiries to generate strictly grounded answers with verifiable source citations. We are committed to transparency regarding how data is processed, stored, and protected.

---

## 2. LLM Provider Data Policy & Free-Tier Notice

### Free Tier (`LLM_TIER=free`)
When operating under Google AI Studio's free tier:
- Document chunks and queries sent to the Gemini API may be logged and reviewed by human annotators to improve Google products, per Google's Terms of Service.
- **Strict User Notice:** Users MUST NOT upload confidential, trade secret, personal identifiable information (PII), or regulated data while on the free tier.
- A required **confidentiality acknowledgment checkbox** is enforced in the user interface before any file upload is accepted (`POST /workspaces/{wid}/documents` requires `confidentiality_ack=true`).
- Each acknowledgment event is cryptographically recorded in the `audit_log` database table with the user ID and timestamp.

### Paid Tier (`LLM_TIER=paid`)
When upgraded to Google Cloud Vertex AI or a commercial billing account:
- Data sent to the Gemini API is not logged, retained, or utilized for foundation model training.
- The upload warning banner in the user interface automatically switches to standard commercial terms.

---

## 3. Data Storage & Lifecycle

### Document Storage
- Original uploaded documents are stored in a private Supabase Storage bucket (`documents`).
- The storage bucket has no public access policies; all downloads occur via short-lived (5-minute) backend-generated signed URLs available solely to verified workspace members.
- Client-supplied filenames are never used in storage paths. Paths strictly follow the convention `{workspace_id}/{document_id}/original`.

### Vector Embeddings & Chunks
- Document chunks and corresponding 768-dimensional L2-normalized vectors are stored in PostgreSQL using `pgvector`.
- Direct table access to `document_chunks`, `embedding_cache`, and `usage_events` is revoked from `anon` and `authenticated` Supabase roles. Only backend service operations can read or write vector tables.

### Data Retention & Cascading Deletion
- **Document Deletion:** Deleting a document immediately deletes its Storage object from Supabase, followed by database metadata and all associated chunk vectors in an atomic transaction.
- **Workspace Deletion:** Deleting a workspace cascades through the foreign keys to delete all associated documents, storage files, chunks, conversations, messages, and audit records.
- **Embedding Cache:** The content-hash keyed embedding cache (`embedding_cache`) avoids duplicate Gemini API calls for identical document text. Cache entries can be pruned periodically without affecting stored document chunks.

---

## 4. Public Demo Privacy Protections
- **No Persistence:** Conversations and messages submitted to the `/api/v1/demo/chat` endpoint are kept in transient React state only. They are NEVER written to the `conversations` or `messages` database tables.
- **Synthetic Data Only:** The public demo workspace contains solely synthetic, fictional corporate SOPs for "Acme Corp".
- **IP Address Hashing:** Client IP addresses are never stored in raw form. Daily abuse prevention uses a cryptographically salted SHA-256 hash:
  $$\text{ip\_hash} = \text{SHA256}(\text{client\_ip} : \text{YYYY-MM-DD} : \text{secret\_salt})$$
  This allows daily rate limiting (15 questions/day) without persistent tracking of individual visitor identities.
