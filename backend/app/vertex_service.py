import base64
import os
import json
import re
from io import BytesIO
from typing import Any

import requests
import google.auth
import google.auth.transport.requests
from PIL import Image

class VertexService:
    """Wrapper for Vertex AI Endpoint prediction."""

    def __init__(self) -> None:
        self.project_number = os.getenv("VERTEX_PROJECT_NUMBER")
        self.location = os.getenv("LOCATION")
        self.endpoint_id = os.getenv("VERTEX_ENDPOINT_ID")

        if not self.project_number or not self.location or not self.endpoint_id:
            raise ValueError(
                "Missing Vertex config. Set VERTEX_PROJECT_NUMBER, LOCATION, and VERTEX_ENDPOINT_ID."
            )

        # Build the dedicated prediction URL
        self.base_dns = f"{self.endpoint_id}.{self.location}-{self.project_number}.prediction.vertexai.goog"
        self.url = f"https://{self.base_dns}/v1/projects/{self.project_number}/locations/{self.location}/endpoints/{self.endpoint_id}:predict"
        
        # Initialize credentials
        self.credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        self.auth_req = google.auth.transport.requests.Request()

    def _get_token(self) -> str:
        if not self.credentials.valid:
            self.credentials.refresh(self.auth_req)
        return self.credentials.token

    def _ensure_compatible_image(self, image_bytes: bytes) -> bytes:
        """Verify image format and convert to JPEG if it's WebP or other unsupported types."""
        try:
            img = Image.open(BytesIO(image_bytes))
            if img.format in ["JPEG", "PNG", "GIF", "BMP"]:
                return image_bytes
            
            # Convert to RGB and save as JPEG
            buffer = BytesIO()
            img.convert("RGB").save(buffer, format="JPEG")
            return buffer.getvalue()
        except Exception:
            return image_bytes

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        image_bytes = self._ensure_compatible_image(image_bytes)
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        
        # AutoML Vision model requires image_bytes and a key
        payload = {
            "instances": [
                {
                    "image_bytes": {"b64": encoded},
                    "key": "1"
                }
            ]
        }
        
        try:
            token = self._get_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(self.url, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            predictions = result.get("predictions", [])
            parsed = self._parse_prediction(predictions)
            parsed["raw"] = result
            return parsed
        except Exception as e:
            return {"prediction": f"error: {e}", "confidence": 0.0, "time": 0.0, "raw": {}}

    @staticmethod
    def _parse_prediction(predictions: list[Any]) -> dict[str, Any]:
        if not predictions:
            return {"prediction": "unknown", "confidence": 0.0, "time": 0.0}

        first = predictions[0]
        labels = first.get("labels")
        scores = first.get("scores")

        if labels and scores:
            idx = max(range(len(scores)), key=lambda i: scores[i])
            raw_label = labels[idx]
            
            # Decode base64 label and extract practical part
            try:
                decoded_bytes = base64.b64decode(raw_label)
                decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
                
                # Priority 1: Check for known categories
                for target in ["plastic", "cardboard", "metal"]:
                    if target in decoded_str:
                        clean_label = target
                        break
                else:
                    # Priority 2: Extract last alphabetical sequence of length 3+
                    matches = re.findall(r'[a-zA-Z]{3,}', decoded_str)
                    if matches:
                        clean_label = matches[-1]
                    else:
                        clean_label = "".join(c for c in decoded_str if ord(c) >= 32).strip()
            except Exception:
                clean_label = raw_label

            return {
                "prediction": clean_label,
                "confidence": round(float(scores[idx]), 4),
                "time": 0.0,
            }

        return {"prediction": "unknown", "confidence": 0.0, "time": 0.0}
