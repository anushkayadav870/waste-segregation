from __future__ import annotations

import base64
import io
import os
from typing import Any, Callable

from google.cloud import aiplatform


class VertexPredictError(Exception):
    def __init__(self, message: str, instances: list[dict[str, Any]] | None = None):
        super().__init__(message)
        self.instances = instances or []
from PIL import Image


class VertexService:
    """Wrapper for Vertex AI Endpoint prediction."""

    def __init__(self) -> None:
        project_id = os.getenv("PROJECT_ID")
        location = os.getenv("LOCATION")
        endpoint_id = os.getenv("VERTEX_ENDPOINT_ID")

        if not project_id or not location or not endpoint_id:
            raise ValueError(
                "Missing Vertex config. Set PROJECT_ID, LOCATION, and VERTEX_ENDPOINT_ID."
            )

        aiplatform.init(project=project_id, location=location)
        self._endpoint = aiplatform.Endpoint(endpoint_name=endpoint_id)

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        safe_bytes, mime_type = self._ensure_jpeg_png(image_bytes)
        encoded = base64.b64encode(safe_bytes).decode("utf-8")
        instances, prediction_response = self._predict_with_fallback(encoded, mime_type)
        predictions = prediction_response.predictions

        parsed = self._parse_prediction(predictions)

        return {
            "prediction": parsed["prediction"],
            "confidence": parsed["confidence"],
            "raw": {
                "deployed_model_id": getattr(prediction_response, "deployed_model_id", None),
                "model": getattr(prediction_response, "model", None),
                "model_display_name": getattr(prediction_response, "model_display_name", None),
                "model_version_id": getattr(prediction_response, "model_version_id", None),
                "predictions": predictions,
                "request_instances": instances,
            },
        }

    def _predict_with_fallback(self, encoded: str, mime_type: str):
        builders: list[Callable[[str, str], list[dict[str, Any]]]] = [
            # Shape the model explicitly asks for: only image_bytes and key.
            lambda b64, _: [{"image_bytes": {"b64": b64}, "key": "0"}],
            # Variant with flat base64 string.
            lambda b64, _: [{"image_bytes": b64, "key": "0"}],
            # Variant with content + mimeType (kept as fallback if the model accepts it).
            lambda b64, mt: [{"content": b64, "mimeType": mt, "key": "0"}],
        ]

        last_error: Exception | None = None
        for build in builders:
            instances = build(encoded, mime_type)
            try:
                resp = self._endpoint.predict(instances=instances)
                return instances, resp
            except Exception as exc:  # broad to allow trying next shape
                last_error = exc
                continue

        if last_error:
            raise VertexPredictError(str(last_error), instances)
        raise VertexPredictError("Vertex prediction failed: no builders tried", [])

    @staticmethod
    def _ensure_jpeg_png(image_bytes: bytes) -> tuple[bytes, str]:
        """Convert incoming bytes to PNG if not already JPEG/PNG to satisfy model decoder."""
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                if img.format == "JPEG":
                    return image_bytes, "image/jpeg"
                if img.format == "PNG":
                    return image_bytes, "image/png"
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                return buffer.getvalue(), "image/png"
        except Exception:
            # If Pillow cannot decode, return original and let Vertex raise a clear error.
            return image_bytes, "application/octet-stream"

    @staticmethod
    def _parse_prediction(predictions: list[Any]) -> dict[str, Any]:
        if not predictions:
            return {"prediction": "unknown", "confidence": 0.0}

        first = predictions[0]

        # Common custom classifier shape: {displayNames: [...], confidences: [...]}.
        if isinstance(first, dict):
            display_names = first.get("displayNames") or first.get("display_names")
            confidences = first.get("confidences") or first.get("scores")

            if isinstance(display_names, list) and isinstance(confidences, list):
                if display_names and confidences:
                    max_idx = max(range(len(confidences)), key=lambda i: float(confidences[i]))
                    return {
                        "prediction": str(display_names[max_idx]),
                        "confidence": round(float(confidences[max_idx]), 4),
                    }

            # Variant: {labels: [...], scores: [...]} (labels may be base64 encoded).
            labels = first.get("labels")
            scores = first.get("scores")
            if isinstance(labels, list) and isinstance(scores, list) and labels and scores:
                decoded_labels: list[str] = []
                for label in labels:
                    if isinstance(label, str):
                        decoded_labels.append(VertexService._decode_label(label))
                    else:
                        decoded_labels.append(str(label))

                max_idx = max(range(len(scores)), key=lambda i: float(scores[i]))
                return {
                    "prediction": str(decoded_labels[max_idx]),
                    "confidence": round(float(scores[max_idx]), 4),
                }

            # Fallback for generic dict payloads.
            if "label" in first and "confidence" in first:
                return {
                    "prediction": str(first["label"]),
                    "confidence": round(float(first["confidence"]), 4),
                }

        # Fallback for list of numeric confidences with unknown class names.
        if isinstance(first, list) and first:
            max_idx = max(range(len(first)), key=lambda i: float(first[i]))
            return {
                "prediction": f"class_{max_idx}",
                "confidence": round(float(first[max_idx]), 4),
            }

        return {"prediction": str(first), "confidence": 0.0}

    @staticmethod
    def _decode_label(label: str) -> str:
        """Decode base64 labels that sometimes carry protobuf prefix bytes."""
        candidate = label.strip()
        missing = len(candidate) % 4
        if missing:
            candidate += "=" * (4 - missing)

        try:
            raw = base64.b64decode(candidate, validate=False)
            text = raw.decode("utf-8", errors="ignore").strip()
            return text or label
        except Exception:
            return label
