from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import random
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

LABELS = ("cardboard", "metal", "plastic", "paper", "glass", "trash")

DISPOSAL_GUIDE = {
    "cardboard": "Keep dry, flatten boxes, and place in paper/cardboard recycling.",
    "metal": "Rinse metal cans and drop into metal recycling collection.",
    "plastic": "Rinse plastic containers and place them in plastic recycling bins.",
    "paper": "Keep clean and dry; recycle with paper products.",
    "glass": "Rinse and separate by local rules before putting in glass recycling.",
    "trash": "Not recyclable in most programs. Dispose in general waste.",
}

app = FastAPI(title="Waste Segregation UI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def infer_label(filename: str, payload: bytes) -> str:
    lowered = filename.lower()
    for label in LABELS:
        if label in lowered:
            return label

    digest = hashlib.sha256(payload).hexdigest()
    index = int(digest[:8], 16) % len(LABELS)
    return LABELS[index]


def build_scores(predicted: str, seed: int) -> list[dict[str, float | str]]:
    rng = random.Random(seed)
    baseline = {label: rng.uniform(0.05, 0.22) for label in LABELS}
    baseline[predicted] += rng.uniform(0.35, 0.55)

    total = sum(baseline.values())
    scores = [
        {"label": label, "score": round((score / total) * 100, 2)}
        for label, score in baseline.items()
    ]
    return sorted(scores, key=lambda item: item["score"], reverse=True)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/predict")
async def predict(file: UploadFile = File(...)) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    predicted = infer_label(file.filename or "", content)
    seed = int(hashlib.md5(content).hexdigest()[:8], 16)
    top_predictions = build_scores(predicted=predicted, seed=seed)
    confidence = top_predictions[0]["score"]

    return {
        "filename": file.filename,
        "predicted_label": predicted,
        "confidence": confidence,
        "top_predictions": top_predictions,
        "disposal_tip": DISPOSAL_GUIDE[predicted],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "note": "This endpoint is UI-ready and deterministic. Replace infer_label with your ML model inference.",
    }
