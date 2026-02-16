from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .vertex_service import VertexService
from .vision_service import VisionService


load_dotenv()

ENABLE_VERTEX = os.getenv("ENABLE_VERTEX", "true").lower() == "true"

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.vertex_service = None
    app.state.vertex_error = None
    try:
        app.state.vertex_service = VertexService() if ENABLE_VERTEX else None
    except Exception as exc:
        app.state.vertex_error = (
            "Vertex AI is not configured yet. Set VERTEX_ENDPOINT_ID when you deploy the endpoint."
        )
        print(f"[startup] Vertex service disabled: {exc}")
    app.state.vision_service = VisionService()
    yield


app = FastAPI(title="WasteML Compare API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are supported.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 10MB.")

    vertex_service = app.state.vertex_service
    vertex_error = app.state.vertex_error
    vision_service: VisionService = app.state.vision_service

    try:
        if vertex_service:
            vertex_start = time.perf_counter()
            vertex_result = vertex_service.predict(image_bytes)
            vertex_latency_ms = round((time.perf_counter() - vertex_start) * 1000, 2)
        else:
            vertex_result = {
                "prediction": "not_run",
                "confidence": 0.0,
                "raw": {"message": "Vertex disabled via ENABLE_VERTEX=false"},
            }
            vertex_latency_ms = 0.0

        vision_start = time.perf_counter()
        vision_result = vision_service.detect_labels(image_bytes)
        vision_latency_ms = round((time.perf_counter() - vision_start) * 1000, 2)

        if vertex_service:
            faster = "vertex" if vertex_latency_ms < vision_latency_ms else "vision"
        else:
            faster = "vision"

        return {
            "vertex": {
                "prediction": vertex_result["prediction"],
                "confidence": vertex_result["confidence"],
                "latency_ms": vertex_latency_ms,
                "raw": vertex_result["raw"],
                "available": vertex_service is not None,
                "error": vertex_error,
            },
            "vision": {
                "top_labels": vision_result["top_labels"],
                "latency_ms": vision_latency_ms,
                "raw": vision_result["raw"],
            },
            "comparison": {
                "faster": "vision" if not vertex_service or vision_latency_ms <= vertex_latency_ms else "vertex",
                "prediction_match": _prediction_match(
                    vertex_result["prediction"],
                    [item["label"] for item in vision_result["top_labels"]],
                ) if vertex_service else False,
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(exc)}") from exc


def _prediction_match(vertex_label: str, vision_labels: list[str]) -> bool:
    normalized_vertex = vertex_label.strip().lower()
    return any(normalized_vertex == label.strip().lower() for label in vision_labels)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
