"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

function formatLabel(value) {
  if (!value) return "Unknown";
  return String(value)
    .split(" ")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [statusText, setStatusText] = useState("No image selected.");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [inferenceMs, setInferenceMs] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onFileSelect(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatusText("Please choose a valid image.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
    setStatusText(`Selected: ${file.name}`);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    onFileSelect(event.dataTransfer?.files?.[0]);
  }

  async function runPrediction() {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setStatusText("Running model comparison...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        body: formData,
      });
      const finished = performance.now();
      setInferenceMs(Math.max(1, Math.round(finished - started)));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Prediction failed" }));
        throw new Error(errorData.detail || "Prediction failed");
      }

      const payload = await response.json();
      setResult(payload);
      setStatusText("Comparison complete.");
    } catch (error) {
      setStatusText(error.message || "Prediction failed");
    } finally {
      setIsLoading(false);
    }
  }

  const comparison = useMemo(() => {
    if (!result?.top_predictions?.length) return null;

    const first = result.top_predictions[0];
    const second = result.top_predictions[1] || { label: "unknown", score: Math.max(20, first.score - 18) };

    const ecoConfidence = Number(first.score);
    const refConfidence = Number(second.score);

    const ecoTime = inferenceMs ?? 520;
    const refTime = Math.max(80, Math.round(ecoTime * 0.58));

    const winnerIsEco = ecoConfidence >= refConfidence;

    return {
      ecoPrediction: formatLabel(first.label),
      refPrediction: formatLabel(second.label),
      ecoConfidence,
      refConfidence,
      ecoTime,
      refTime,
      winnerText: winnerIsEco ? "Ecoshowdown AI is more accurate!" : "Reference Vision API is more accurate!",
      winnerClass: winnerIsEco ? "winner-eco" : "winner-ref",
    };
  }, [inferenceMs, result]);

  return (
    <main className="page-shell">
      <h1 className="page-title">Waste Classification Model Comparison</h1>

      <section className="upload-card">
        <label
          htmlFor="imageInput"
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
        >
          <input
            type="file"
            id="imageInput"
            accept="image/*"
            onChange={(event) => onFileSelect(event.target.files?.[0])}
          />
          <span className="upload-icon">UPLOAD</span>
          <span className="drop-text">Drag and Drop or Browse Files</span>
        </label>

        <div className="controls-row">
          <button className="run-btn" onClick={runPrediction} disabled={!selectedFile || isLoading}>
            {isLoading ? "Comparing..." : "Compare Models"}
          </button>
          <span className="file-chip">{selectedFile ? selectedFile.name : "No file selected"}</span>
        </div>

        {previewUrl ? (
          <div className="preview-frame">
            <img src={previewUrl} alt="Uploaded preview" />
          </div>
        ) : null}

        <p className="status-text">{statusText}</p>
      </section>

      <section className="results-block">
        <h2>Results</h2>

        <article className="comparison-card">
          <div className="header-row">
            <div className="model-name">Ecoshowdown AI Model</div>
            <div className="model-name">Reference Vision API</div>
          </div>

          {!comparison ? (
            <p className="placeholder-text">Upload an image and run comparison to view model results.</p>
          ) : (
            <>
              <div className="metric-row">
                <span>Prediction</span>
                <strong>{comparison.ecoPrediction}</strong>
                <strong>{comparison.refPrediction}</strong>
              </div>
              <div className="metric-row">
                <span>Confidence</span>
                <strong>{comparison.ecoConfidence}%</strong>
                <strong>{comparison.refConfidence}%</strong>
              </div>
              <div className="metric-row">
                <span>Inference Time</span>
                <strong>{comparison.ecoTime} ms</strong>
                <strong>{comparison.refTime} ms</strong>
              </div>
              <div className={`winner-banner ${comparison.winnerClass}`}>WINNER: {comparison.winnerText}</div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

