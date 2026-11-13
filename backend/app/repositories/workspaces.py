import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def count_user_owned_workspaces(db: AsyncSession, user_id: UUID) -> int:
    """Counts active workspaces owned by a user."""
    res = await db.execute(
        text("SELECT COUNT(*) FROM workspaces WHERE owner_id = :uid"),
        {"uid": user_id},
    )
    return res.scalar() or 0


async def list_user_workspaces(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """Lists workspaces that the user belongs to."""
    query = text(
        """
        SELECT w.id, w.name, wm.role, w.is_demo, w.created_at
        FROM workspaces w
        JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = :uid
        ORDER BY w.created_at DESC;
        """
    )
    res = await db.execute(query, {"uid": user_id})
    return [dict(row) for row in res.mappings().all()]


async def create_workspace(
    db: AsyncSession, user_id: UUID, name: str
) -> dict[str, Any]:
    """Creates a new workspace and sets the user as owner in workspace_members."""
    # 1. Insert workspace
    insert_ws = text(
        """
        INSERT INTO workspaces (name, owner_id, is_demo)
        VALUES (:name, :uid, false)
        RETURNING id, name, owner_id, is_demo, created_at;
        """
    )
    res = await db.execute(insert_ws, {"name": name, "uid": user_id})
    ws = dict(res.mappings().one())
    workspace_id = ws["id"]

    # 2. Insert owner membership (scoped by workspace_id)
    insert_member = text(
        """
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (:wid, :uid, 'owner');
        """
    )
    await db.execute(insert_member, {"wid": workspace_id, "uid": user_id})

    # 3. Log audit event
    insert_audit = text(
        """
        INSERT INTO audit_log (user_id, workspace_id, action, detail)
        VALUES (:uid, :wid, 'workspace_create', CAST(:detail AS jsonb));
        """
    )
    await db.execute(
        insert_audit,
        {
            "uid": user_id,
            "wid": workspace_id,
            "detail": json.dumps({"name": name}),
        },
    )

    await db.commit()
    ws["role"] = "owner"
    return ws


async def get_workspace_detail(
    db: AsyncSession, workspace_id: UUID
) -> dict[str, Any] | None:
    """Gets workspace details and live statistics (docs, chunks, members).

    All queries take workspace_id.
    """
    ws_query = text(
        """
        SELECT id, name, owner_id, is_demo, created_at
        FROM workspaces
        WHERE id = :wid;
        """
    )
    ws_res = await db.execute(ws_query, {"wid": workspace_id})
    ws_row = ws_res.mappings().first()
    if not ws_row:
        return None

    stats_query = text(
        """
        SELECT
            (SELECT COUNT(*) FROM documents WHERE workspace_id = :wid) as document_count,
            (SELECT COUNT(*) FROM document_chunks WHERE workspace_id = :wid) as chunk_count,
            (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = :wid) as member_count;
        """
    )
    stats_res = await db.execute(stats_query, {"wid": workspace_id})
    stats_row = stats_res.mappings().one()

    ws_dict = dict(ws_row)
    ws_dict["stats"] = {
        "document_count": stats_row["document_count"],
        "chunk_count": stats_row["chunk_count"],
        "member_count": stats_row["member_count"],
    }
    return ws_dict


async def update_workspace_name(
    db: AsyncSession, workspace_id: UUID, name: str
) -> dict[str, Any] | None:
    """Updates a workspace name, always scoped by workspace_id."""
    query = text(
        """
        UPDATE workspaces
        SET name = :name
        WHERE id = :wid
        RETURNING id, name, owner_id, is_demo, created_at;
        """
    )
    res = await db.execute(query, {"wid": workspace_id, "name": name})
    row = res.mappings().first()
    if row:
        await db.commit()
        return dict(row)
    return None


async def delete_workspace(
    db: AsyncSession, workspace_id: UUID, user_id: UUID
) -> bool:
    """Deletes workspace (cascades to members, documents, chunks, conversations).

    Always scoped by workspace_id. Writes audit entry before deleting.
    """
    # 1. Audit log entry
    insert_audit = text(
        """
        INSERT INTO audit_log (user_id, workspace_id, action, detail)
        VALUES (:uid, :wid, 'workspace_delete', CAST(:detail AS jsonb));
        """
    )
    await db.execute(
        insert_audit,
        {
            "uid": user_id,
            "wid": workspace_id,
            "detail": json.dumps({"action": "workspace_deleted"}),
        },
    )

    # 2. Delete workspace
    del_query = text("DELETE FROM workspaces WHERE id = :wid;")
    res = await db.execute(del_query, {"wid": workspace_id})
    await db.commit()
    return (res.rowcount or 0) > 0


async def list_workspace_members(
    db: AsyncSession, workspace_id: UUID
) -> list[dict[str, Any]]:
    """Lists all members of a workspace. Always takes workspace_id."""
    query = text(
        """
        SELECT wm.user_id, p.email, p.display_name, wm.role, wm.created_at
        FROM workspace_members wm
        LEFT JOIN profiles p ON p.id = wm.user_id
        WHERE wm.workspace_id = :wid
        ORDER BY wm.created_at ASC;
        """
    )
    res = await db.execute(query, {"wid": workspace_id})
    return [dict(row) for row in res.mappings().all()]
