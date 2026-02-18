from __future__ import annotations

import io
from typing import Any

import torch
import clip
from PIL import Image


class ClipService:
    """Wrapper for OpenAI CLIP zero-shot classification."""

    def __init__(self, classes: list[str]) -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)
        self.model.eval()
        self.classes = classes

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_input = self.preprocess(pil_img).unsqueeze(0).to(self.device)

        with torch.no_grad():
            img_feat = self.model.encode_image(img_input)
            img_feat /= img_feat.norm(dim=-1, keepdim=True)

            text_tokens = clip.tokenize(
                [f"a photo of {c} waste" for c in self.classes]
            ).to(self.device)

            text_feat = self.model.encode_text(text_tokens)
            text_feat /= text_feat.norm(dim=-1, keepdim=True)

            sims = (img_feat @ text_feat.T).squeeze(0)

        scores = {
            self.classes[i]: float(sims[i])
            for i in range(len(self.classes))
        }

        best_class = max(scores, key=scores.get)

        return {
            "prediction": best_class,
            "confidence": round(scores[best_class], 4),
            "raw": scores,
        }
