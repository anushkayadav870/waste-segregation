"""
Centralized store for historical model accuracy metrics (Precision).
In a production system, these might be fetched from a Model Registry or Evaluation Database.
"""

# Precision = How often the model is correct when it predicts a specific class
# Based on historical benchmarking data (example values for this project)

VERTEX_METRICS = {
    "metal": 0.942,
    "cardboard": 0.915,
    "plastic": 0.887,
    "unknown": 0.0,
    "unrecognized": 0.0
}

VISION_METRICS = {
    "metal": 0.981,
    "cardboard": 0.974,
    "plastic": 0.958,
    "disabled": 0.0,
    "unrecognized": 0.0
}
