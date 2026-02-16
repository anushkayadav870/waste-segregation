from __future__ import annotations

import base64
import os
from typing import Any

from google.cloud import aiplatform


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
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        instances = [{"content": encoded}]

        prediction_response = self._endpoint.predict(instances=instances)
        predictions = prediction_response.predictions

        parsed = self._parse_prediction(predictions)

        return {
            "prediction": parsed["prediction"],
            "confidence": parsed["confidence"],
            "raw": {
                "deployed_model_id": prediction_response.deployed_model_id,
                "model": prediction_response.model,
                "model_version_id": prediction_response.model_version_id,
                "predictions": predictions,
            },
        }

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
