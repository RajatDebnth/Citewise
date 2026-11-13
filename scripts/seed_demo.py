import asyncio
import hashlib
import sys
import uuid
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.db import AsyncSessionLocal
from app.core.storage import storage_service
from app.services.ingestion.worker import process_document_job
from app.services.providers.gemini import GeminiEmbeddingProvider
from sqlalchemy import text


async def seed_demo():
    print("Starting Demo Workspace & SOP Document Seeding...")
    seed_docs_dir = Path(__file__).resolve().parent.parent / "supabase" / "seed" / "demo_docs"

    if not seed_docs_dir.exists():
        print(f"Error: Seed documents directory not found at {seed_docs_dir}")
        return

    provider = GeminiEmbeddingProvider()

    async with AsyncSessionLocal() as db:
        # 1. Find a profile to own the demo workspace
        res = await db.execute(text("SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1;"))
        owner_row = res.mappings().first()
        if not owner_row:
            print("No profile found. Checking auth.users or creating system profile...")
            # Try to see if auth.users has an entry
            auth_res = await db.execute(text("SELECT id FROM auth.users LIMIT 1;"))
            auth_row = auth_res.mappings().first()
            if auth_row:
                owner_id = auth_row["id"]
                await db.execute(
                    text("INSERT INTO profiles (id, email, display_name) VALUES (:id, 'system@acme.example', 'Acme System') ON CONFLICT DO NOTHING;"),
                    {"id": owner_id},
                )
                await db.commit()
            else:
                print("Error: No users found in auth.users or profiles. Please sign up at least one user first.")
                return
        else:
            owner_id = owner_row["id"]

        # 2. Check for existing demo workspace
        ws_res = await db.execute(text("SELECT id, name FROM workspaces WHERE is_demo = true LIMIT 1;"))
        demo_ws = ws_res.mappings().first()

        if not demo_ws:
            demo_ws_id = uuid.uuid4()
            print(f"Creating new demo workspace with id {demo_ws_id}...")
            await db.execute(
                text(
                    """
                    INSERT INTO workspaces (id, name, owner_id, is_demo)
                    VALUES (:id, 'Acme Corp SOPs (Public Demo)', :owner_id, true);
                    """
                ),
                {"id": demo_ws_id, "owner_id": owner_id},
            )
            await db.execute(
                text(
                    """
                    INSERT INTO workspace_members (workspace_id, user_id, role)
                    VALUES (:wid, :uid, 'owner')
                    ON CONFLICT DO NOTHING;
                    """
                ),
                {"wid": demo_ws_id, "uid": owner_id},
            )
            await db.commit()
        else:
            demo_ws_id = demo_ws["id"]
            print(f"Found existing demo workspace '{demo_ws['name']}' ({demo_ws_id})")

        # 3. Process demo documents
        doc_files = sorted(list(seed_docs_dir.glob("*.txt")) + list(seed_docs_dir.glob("*.pdf")) + list(seed_docs_dir.glob("*.docx")))
        print(f"Found {len(doc_files)} seed document files to ingest.")

        for doc_file in doc_files:
            content_bytes = doc_file.read_bytes()
            sha256 = hashlib.sha256(content_bytes).hexdigest()
            filename = doc_file.name

            # Check if document already exists
            existing_doc = await db.execute(
                text("SELECT id, status, chunk_count FROM documents WHERE workspace_id = :wid AND sha256 = :sha256;"),
                {"wid": demo_ws_id, "sha256": sha256},
            )
            existing = existing_doc.mappings().first()

            if existing and existing["status"] == "ready":
                print(f"Document '{filename}' already exists and is ready ({existing['chunk_count']} chunks). Skipping.")
                continue

            doc_id = existing["id"] if existing else uuid.uuid4()
            storage_path = f"{demo_ws_id}/{doc_id}/original"

            print(f"Uploading '{filename}' ({len(content_bytes)} bytes) to storage path: {storage_path}...")
            await storage_service.upload_file(
                storage_path=storage_path,
                content=content_bytes,
                mime_type="text/plain" if filename.endswith(".txt") else "application/pdf",
            )

            if not existing:
                await db.execute(
                    text(
                        """
                        INSERT INTO documents (id, workspace_id, uploader_id, filename, storage_path, mime_type, size_bytes, sha256, status)
                        VALUES (:id, :wid, :uid, :filename, :storage_path, :mime, :size, :sha256, 'pending');
                        """
                    ),
                    {
                        "id": doc_id,
                        "wid": demo_ws_id,
                        "uid": owner_id,
                        "filename": filename,
                        "storage_path": storage_path,
                        "mime": "text/plain" if filename.endswith(".txt") else "application/pdf",
                        "size": len(content_bytes),
                        "sha256": sha256,
                    },
                )
                await db.commit()

            doc_dict = {
                "id": doc_id,
                "workspace_id": demo_ws_id,
                "storage_path": storage_path,
                "filename": filename,
                "mime_type": "text/plain" if filename.endswith(".txt") else "application/pdf",
                "size_bytes": len(content_bytes),
            }

            print(f"Ingesting document '{filename}' via worker pipeline...")
            try:
                await process_document_job(doc_dict, db, provider)
                print(f"Successfully processed '{filename}' into ready state!")
            except Exception as e:  # noqa: BLE001
                print(f"Failed to process '{filename}': {e}")

    print("\nDemo workspace seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_demo())
