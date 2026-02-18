from __future__ import annotations

from typing import Any

from google.cloud import vision


class VisionService:
    """Wrapper for Google Cloud Vision label detection."""

    def __init__(self) -> None:
        self._client = vision.ImageAnnotatorClient()

    def detect_labels(self, image_bytes: bytes, max_results: int = 5) -> dict[str, Any]:
        image = vision.Image(content=image_bytes)
        response = self._client.label_detection(image=image, max_results=max_results)

        if response.error.message:
            raise RuntimeError(f"Vision API error: {response.error.message}")

        labels = [
            {
                "label": annotation.description,
                "confidence": round(float(annotation.score), 4),
                "precision": float(annotation.score),
            }
            for annotation in response.label_annotations
        ]

        return {
            "top_labels": labels,
            "raw": {
                "label_annotations": [
                    {
                        "description": item.description,
                        "score": round(float(item.score), 6),
                        "topicality": round(float(item.topicality), 6),
                    }
                    for item in response.label_annotations
                ]
            },
        }
