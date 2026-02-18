from __future__ import annotations
import time
from typing import Any


class VisionClipService:
    """Separate Vision API + CLIP prediction (for comparison)."""

    KEYWORDS = {
        "metal": [
            "tin can", "aluminum can", "steel and tin cans", "drink can", "energy drink",
            "foil", "aluminium foil", "metal container", "scrap metal"
        ],
        "plastic": [
            "plastic bottle", "water bottle", "drinking water", "plastic container",
            "plastic wrap", "two-liter bottle", "fluid container", "shampoo bottle",
            "detergent bottle"
        ],
        "cardboard": [
            "cardboard box", "shipping box", "cardboard packaging", "corrugated box",
            "paper product", "packing materials"
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
                                "time": round(time.perf_counter() - start, 3),
                                "top_labels": vision_data["top_labels"],
                                "raw": vision_data["raw"],
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
                    "time": round(time.perf_counter() - start, 3),
                    "top_labels": vision_data.get("top_labels", []),
                    "raw": vision_data.get("raw", {}),
                }
            except Exception:
                pass

        return {
            "prediction": "disabled",
            "confidence": 0.0,
            "time": round(time.perf_counter() - start, 3),
            "top_labels": vision_data.get("top_labels", []),
            "raw": vision_data.get("raw", {}),
        }
