from __future__ import annotations
import time
from .model_metadata import VISION_METRICS
from typing import Any


class VisionClipService:
    """Separate Vision API + CLIP prediction (for comparison)."""

    KEYWORDS = {
        "metal": [
            "metal", "tin", "steel", "aluminum", "aluminium", "foil", "cans", "drink can",
            "steel and tin cans", "aluminium foil", "silver", "brass", "titanium",
            "energy drink", "bangle", "badge", "emblem", "gold", "aerosol", "canister"
        ],
        "plastic": [
            "plastic", "bottle", "container", "plastic bottle", "water bottle",
            "plastic wrap", "food storage containers", "bottled water", "two-liter bottle",
            "polyethylene", "pvc", "pet", "hdpe", "polypropylene"
        ],
        "cardboard": [
            "cardboard", "paper product", "paper", "cardboard packaging", "shipping box",
            "box", "packing materials", "construction paper", "corrugated board", "carton"
        ]
    }

    def __init__(self, vision_service=None, clip_service=None):
        self.vision = vision_service
        self.clip = clip_service

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        start = time.perf_counter()
        vision_data: dict[str, Any] = {"top_labels": [], "raw": {}}

        # Vision-first prediction
        if self.vision:
            try:
                vision_data = self.vision.detect_labels(image_bytes)
                for label in vision_data["top_labels"]:
                    text = label["label"].lower()
                    for cls, keywords in self.KEYWORDS.items():
                        if any(k in text for k in keywords):
                            return {
                                "prediction": cls,
                                "confidence": label["confidence"],
                                "precision": VISION_METRICS.get(cls, 0.0),
                                "time": round(time.perf_counter() - start, 3),
                                "top_labels": vision_data["top_labels"],
                                "raw": {
                                    "vision_api": vision_data["raw"],
                                    "clip_fallback": None
                                },
                            }
            except Exception:
                pass

        # CLIP fallback
        if self.clip:
            try:
                clip_res = self.clip.predict(image_bytes)
                return {
                    "prediction": clip_res["prediction"],
                    "confidence": clip_res["confidence"],
                    "precision": VISION_METRICS.get(clip_res["prediction"], 0.0),
                    "time": round(time.perf_counter() - start, 3),
                    "top_labels": vision_data.get("top_labels", []),
                    "raw": {
                        "vision_api": vision_data.get("raw", {}),
                        "clip_fallback": clip_res.get("raw", {})
                    },
                }
            except Exception:
                pass

        return {
            "prediction": "disabled",
            "confidence": 0.0,
            "precision": 0.0,
            "time": round(time.perf_counter() - start, 3),
            "top_labels": vision_data.get("top_labels", []),
            "raw": vision_data.get("raw", {}),
        }
