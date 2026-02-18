import os
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.vertex_service import VertexService
from app.vision_service import VisionService
from app.clip_service import ClipService
from app.vision_clip_service import VisionClipService

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ENABLE_VERTEX = os.getenv("ENABLE_VERTEX", "true").lower() == "true"
ENABLE_VISION = os.getenv("ENABLE_VISION", "true").lower() == "true"
ENABLE_CLIP = os.getenv("ENABLE_CLIP", "true").lower() == "true"

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Vertex Service Initialization
    app.state.vertex_service = None
    if ENABLE_VERTEX:
        try:
            app.state.vertex_service = VertexService()
            logger.info("VertexService initialized successfully.")
        except Exception as e:
            logger.warning(f"VertexService failed to initialize: {e}. Vertex predictions will be disabled.")

    # Vision and CLIP Services
    vision_service = None
    if ENABLE_VISION:
        try:
            vision_service = VisionService()
            logger.info("VisionService initialized successfully.")
        except Exception as e:
            logger.warning(f"VisionService failed to initialize: {e}.")

    clip_service = None
    if ENABLE_CLIP:
        try:
            clip_service = ClipService(classes=["metal", "cardboard", "plastic"])
            logger.info("ClipService initialized successfully.")
        except Exception as e:
            logger.warning(f"ClipService failed to initialize: {e}.")

    app.state.vision_clip_service = VisionClipService(vision_service, clip_service)
    yield

app = FastAPI(title="WasteML Compare API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Template and Static File Setup
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Domain Guard Config
NEGATIVE_DOMAINS = {"fruit", "vehicle", "animal", "person", "plant", "food", "organism", "clothing", "car", "automotive", "mammal", "wheel"}
POSITIVE_INDICATORS = {"waste", "trash", "garbage", "container", "packaging", "recycling", "bottle", "can", "box"}
CONFIDENCE_THRESHOLD = 0.60

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    # Vertex Prediction
    v_start = time.perf_counter()
    vertex_res = (
        app.state.vertex_service.predict(image_bytes)
        if app.state.vertex_service
        else {"prediction": "disabled", "confidence": 0.0, "raw": {}}
    )
    v_latency = int((time.perf_counter() - v_start) * 1000)

    # Vision + CLIP Prediction
    vc_start = time.perf_counter()
    vc_res = app.state.vision_clip_service.predict(image_bytes)
    vc_latency = int((time.perf_counter() - vc_start) * 1000)

    # Waste Guard Logic
    vision_labels = [L["label"].lower() for L in vc_res.get("top_labels", [])]
    is_negative = any(any(neg in label for neg in NEGATIVE_DOMAINS) for label in vision_labels)
    has_positive = any(any(pos in label for pos in POSITIVE_INDICATORS) for label in vision_labels)

    is_unrecognized = is_negative and not has_positive

    # Final result assembly with thresholds and guard
    v_pred = vertex_res["prediction"]
    v_conf = vertex_res["confidence"]
    if is_unrecognized or v_conf < CONFIDENCE_THRESHOLD:
        v_pred = "unrecognized" if is_unrecognized else f"ambiguous ({v_pred})"

    vc_pred = vc_res["prediction"]
    vc_conf = vc_res["confidence"]
    if is_unrecognized or vc_conf < CONFIDENCE_THRESHOLD:
        vc_pred = "unrecognized" if is_unrecognized else f"ambiguous ({vc_pred})"

    # Comparison Logic
    match = v_pred.lower() == vc_pred.lower()
    faster = "vertex" if v_latency < vc_latency else "vision"

    # Consensus Reasoning (Multi-Label Validation & Tie-Breaking)
    raw_v_pred = vertex_res.get("prediction", "disabled").lower()
    
    # 1. Multi-Label Validation: Check if Vertex pred is in Vision's descriptive labels
    is_validated = any(raw_v_pred in label for label in vision_labels)
    
    # 2. Recommendation Logic
    recommendation = v_pred
    reasoning = "Vertex AI (Custom) and Pretrained Models are in full agreement."
    reliability = max(v_conf, vc_conf)

    if is_unrecognized:
        recommendation = "unrecognized"
        reasoning = "Both models agree this item is outside the waste domain (Waste Guard trigger)."
        reliability = 1.0
    elif not match:
        if is_validated:
            recommendation = v_pred
            reasoning = f"Vertex predicted '{v_pred}', which was validated by Vision's descriptive labels."
        else:
            # Tie-break: Priority to Custom Model for specific waste classes
            recommendation = v_pred
            reasoning = f"Models disagree. Prioritizing Vertex AI as the domain specialist for waste classification."
            reliability = v_conf * 0.9 # Slight penalty for disagreement

    if "ambiguous" in v_pred and "ambiguous" in vc_pred:
        recommendation = "ambiguous"
        reasoning = "Both models are uncertain. Please provide a clearer image."
        reliability = 0.5

    return {
        "consensus": {
            "recommendation": recommendation,
            "reasoning": reasoning,
            "reliability": round(reliability, 2),
            "is_validated_by_vision": is_validated,
            "prediction_match": match,
            "faster_model": faster
        },
        "vertex": {
            "prediction": v_pred,
            "confidence": v_conf,
            "precision": vertex_res.get("precision", v_conf),
            "latency_ms": v_latency,
            "raw": {
                **vertex_res.get("raw", {}),
                "waste_guard": {
                    "is_negative": is_negative,
                    "has_positive": has_positive,
                    "is_unrecognized": is_unrecognized,
                    "threshold_applied": v_conf < CONFIDENCE_THRESHOLD
                }
            },
        },
        "vision": {
            "prediction": vc_pred,
            "confidence": vc_conf,
            "precision": vc_res.get("precision", vc_conf),
            "top_labels": vc_res.get("top_labels", []),
            "latency_ms": vc_latency,
            "raw": {
                **vc_res.get("raw", {}),
                "waste_guard": {
                    "is_negative": is_negative,
                    "has_positive": has_positive,
                    "is_unrecognized": is_unrecognized,
                    "threshold_applied": vc_conf < CONFIDENCE_THRESHOLD
                }
            },
        }
    }
