import argparse
import asyncio
import json
import statistics
import time
from pathlib import Path
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.retrieval.retriever import match_workspace_chunks
from app.services.providers.gemini import GeminiEmbeddingProvider


async def run_evaluation(
    workspace_id: UUID,
    qa_path: Path,
    output_path: Path | None = None,
) -> dict[str, Any]:
    """Runs retrieval and citation evaluation on qa_set.json against an ingested workspace."""
    with open(qa_path, "r", encoding="utf-8") as f:  # noqa: ASYNC230
        qa_set = json.load(f)

    print("\n========================================================")
    print(f"Starting Evaluation on {len(qa_set)} QA items")
    print(f"Workspace: {workspace_id}")
    print(f"Retrieval Min Score: {settings.RETRIEVAL_MIN_SCORE}, Top K: {settings.TOP_K}")
    print("========================================================\n")

    embed_provider = GeminiEmbeddingProvider()

    results: list[dict[str, Any]] = []
    latencies: list[float] = []

    answerable_count = 0
    hit_at_5_count = 0

    unanswerable_count = 0
    correct_refusal_count = 0

    async with AsyncSessionLocal() as db:
        for idx, item in enumerate(qa_set, start=1):
            qid = item["id"]
            question = item["question"]
            expected_doc = item.get("expected_doc")
            expected_page = item.get("expected_page")
            is_answerable = item.get("answerable", True)

            t0 = time.perf_counter()
            query_vec = await embed_provider.embed_query(question)
            retrieved = await match_workspace_chunks(
                db=db, workspace_id=workspace_id, query_vector=query_vec, k=settings.TOP_K
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000
            latencies.append(elapsed_ms)

            retrieved_docs = [r["filename"] for r in retrieved]
            top_score = float(retrieved[0]["similarity"]) if retrieved else 0.0

            hit = False
            refusal_correct = False

            if is_answerable:
                answerable_count += 1
                if expected_doc and any(expected_doc.lower() in d.lower() for d in retrieved_docs):
                    hit = True
                    hit_at_5_count += 1
            else:
                unanswerable_count += 1
                # If similarity is below threshold or no doc expected, refusal is expected
                if top_score < settings.RETRIEVAL_MIN_SCORE:
                    refusal_correct = True
                    correct_refusal_count += 1

            status_str = "HIT" if hit else ("REFUSAL_OK" if refusal_correct else "MISS")
            print(f"[{idx:02d}/{len(qa_set)}] {qid} ({status_str}) Score: {top_score:.3f} | Latency: {elapsed_ms:.1f}ms")

            results.append({
                "id": qid,
                "question": question,
                "expected_doc": expected_doc,
                "expected_page": expected_page,
                "answerable": is_answerable,
                "top_score": round(top_score, 4),
                "hit_at_5": hit,
                "refusal_correct": refusal_correct,
                "latency_ms": round(elapsed_ms, 2),
                "retrieved_files": retrieved_docs,
            })

    # Metrics calculation
    hit_at_5_rate = (hit_at_5_count / answerable_count) if answerable_count > 0 else 0.0
    refusal_rate = (correct_refusal_count / unanswerable_count) if unanswerable_count > 0 else 0.0
    median_lat = statistics.median(latencies) if latencies else 0.0

    summary = {
        "total_questions": len(qa_set),
        "answerable_questions": answerable_count,
        "unanswerable_questions": unanswerable_count,
        "hit_at_5_rate": round(hit_at_5_rate, 4),
        "refusal_accuracy": round(refusal_rate, 4),
        "median_latency_ms": round(median_lat, 2),
        "retrieval_min_score": settings.RETRIEVAL_MIN_SCORE,
        "top_k": settings.TOP_K,
        "results": results,
    }

    print("\n================== Evaluation Summary ==================")
    print(f"Hit@5 Rate:          {hit_at_5_rate * 100:.1f}% ({hit_at_5_count}/{answerable_count})")
    print(f"Refusal Accuracy:    {refusal_rate * 100:.1f}% ({correct_refusal_count}/{unanswerable_count})")
    print(f"Median Latency:      {median_lat:.1f} ms")
    print("========================================================\n")

    if output_path:
        with open(output_path, "w", encoding="utf-8") as out_f:  # noqa: ASYNC230
            json.dump(summary, out_f, indent=2)
        print(f"Saved evaluation results to {output_path}")

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run RAG retrieval evaluation against QA benchmark set.")
    parser.add_argument("--workspace-id", required=True, type=UUID, help="Target workspace UUID")
    parser.add_argument("--qa-path", default="backend/tests/eval/qa_set.json", type=Path, help="Path to qa_set.json")
    parser.add_argument("--output", default="backend/tests/eval/eval_results.json", type=Path, help="Path to output JSON")
    args = parser.parse_args()

    asyncio.run(run_evaluation(args.workspace_id, args.qa_path, args.output))
