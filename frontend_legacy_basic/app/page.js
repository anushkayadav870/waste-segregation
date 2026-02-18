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

/* ── Status Badge (ported from 3000) ─── */
function StatusBadge({ prediction }) {
  const isUnrecognized = prediction.toLowerCase() === "unrecognized";
  const isAmbiguous = prediction.toLowerCase().includes("ambiguous");

  if (isUnrecognized) {
    return <span className="badge-status error">Unrecognized (Not Waste)</span>;
  }
  if (isAmbiguous) {
    return <span className="badge-status warning">Ambiguous Prediction</span>;
  }
  return <span className="badge-status success">Confirmed {formatLabel(prediction)}</span>;
}

/* ── Latency Bar (ported from 3000) ─── */
function LatencyBar({ vertexMs, visionMs }) {
  const max = Math.max(vertexMs, visionMs, 1);
  const vertexWidth = (vertexMs / max) * 100;
  const visionWidth = (visionMs / max) * 100;

  return (
    <div className="latency-bar-card">
      <h3>Response Time Comparison</h3>
      <div className="latency-bars">
        <div>
          <div className="bar-label"><span>Vertex AI</span><span>{vertexMs} ms</span></div>
          <div className="bar-track"><div className="bar-fill bar-fill-vertex" style={{ width: `${vertexWidth}%` }} /></div>
        </div>
        <div>
          <div className="bar-label"><span>Vision API</span><span>{visionMs} ms</span></div>
          <div className="bar-track"><div className="bar-fill bar-fill-vision" style={{ width: `${visionWidth}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

/* ── Insight Card (ported from 3000) ─── */
function InsightCard({ result }) {
  const topVision = result.vision.top_labels[0];
  const confidenceDelta = Math.abs(result.vertex.confidence - (topVision?.confidence ?? 0));

  return (
    <div className="insight-card">
      <h3>Comparison Insights</h3>
      <p><strong>Faster:</strong> {result.consensus.faster_model === "vertex" ? "Vertex AI" : "Vision API"}.</p>
      <p><strong>Specificity:</strong> Vertex AI gives a single structured class, Vision provides general descriptive labels.</p>
      <p><strong>Confidence gap:</strong> {(confidenceDelta * 100).toFixed(1)} percentage points (top prediction).</p>

      <div className="card-definitions">
        <h4>System Definitions</h4>
        <p><strong>Precision:</strong> Historical reliability of the model for this waste category.</p>
        <p><strong>Confidence:</strong> Mathematical probability for this specific image.</p>
      </div>

      <p className="mt-2 text-xs opacity-70">Vertex AI is specialized for waste classes, while Vision provides general visual context.</p>
    </div>
  );
}

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [statusText, setStatusText] = useState("No image selected.");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showVertex, setShowVertex] = useState(true);
  const [showVision, setShowVision] = useState(true);

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
    setStatusText("Ready to compare.");
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    onFileSelect(event.dataTransfer?.files?.[0]);
  }

  /* ── Prediction with 60s timeout (ported from 3000) ─── */
  async function runPrediction() {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setError(null);
    setStatusText("Running model comparison...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Prediction failed" }));
        throw new Error(errorData.detail || "Prediction failed");
      }

      const payload = await response.json();
      setResult(payload);
      setError(null);
      setStatusText("Comparison complete.");
    } catch (err) {
      const message = err.name === "AbortError" ? "Request timed out (60s)." : err.message || "Prediction failed";
      setError(message);
      setStatusText(message);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }

  const canRenderResults = useMemo(() => result && (showVertex || showVision), [result, showVertex, showVision]);

  const comparison = useMemo(() => {
    if (!result?.vision || !result?.vertex) return null;

    const vision = result.vision;
    const vertex = result.vertex;

    const ecoPrediction = formatLabel(vision.prediction);
    const refPrediction = formatLabel(vertex.prediction);

    const ecoConfidence = Math.round(vision.confidence * 100);
    const refConfidence = Math.round(vertex.confidence * 100);

    const ecoTime = vision.latency_ms;
    const refTime = vertex.latency_ms;

    const winnerIsEco = ecoConfidence >= refConfidence;

    return {
      ecoPrediction,
      refPrediction,
      ecoConfidence,
      refConfidence,
      ecoTime,
      refTime,
      winnerText: winnerIsEco ? "Google Vision AI is more confident!" : "Vertex AI is more confident!",
      winnerClass: winnerIsEco ? "winner-eco" : "winner-ref",
    };
  }, [result]);

  return (
    <main className="page-shell">
      <h1 className="page-title">Waste Classification Model Comparison</h1>

      {/* ── Upload Card ─── */}
      <section className="upload-card">
        <label
          htmlFor="imageInput"
          className={`drop-zone ${dragOver ? "drag-over" : ""} ${previewUrl ? "has-preview" : ""}`}
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
          {previewUrl && <img src={previewUrl} className="drop-zone-preview" alt="Preview" />}
          <div className="drop-zone-content">
            <span className="upload-icon">UPLOAD</span>
            <span className="drop-text">{previewUrl ? "Image Loaded - Tap to Change" : "Drag and Drop or Browse Files"}</span>
          </div>
        </label>

        <div className="controls-row centered">
          <button className="run-btn" onClick={runPrediction} disabled={!selectedFile || isLoading}>
            {isLoading ? "Comparing..." : "Compare Models"}
          </button>
          {selectedFile && !isLoading && (
            <button
              className="text-btn"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl("");
                setResult(null);
                setError(null);
                setStatusText("No image selected.");
              }}
              style={{ color: "#64748b" }}
            >
              Clear
            </button>
          )}
        </div>

        <p className="status-text">{statusText}</p>

        {error && <p className="error-text">{error}</p>}
      </section>

      {/* ── Display Options (ported from 3000) ─── */}
      {result && (
        <section className="display-options">
          <div className="controls-row">
            <label className="toggle-label">
              <input type="checkbox" checked={showVertex} onChange={(e) => setShowVertex(e.target.checked)} />
              Show Vertex
            </label>
            <label className="toggle-label">
              <input type="checkbox" checked={showVision} onChange={(e) => setShowVision(e.target.checked)} />
              Show Vision
            </label>
            <button className="text-btn" onClick={() => setShowRawJson(!showRawJson)}>
              {showRawJson ? "Hide Raw JSON" : "Show Raw JSON"}
            </button>
            {result.consensus.prediction_match ? (
              <span className="badge-status success">Predictions Align</span>
            ) : (
              <span className="badge-status warning">Predictions Differ</span>
            )}
          </div>
        </section>
      )}

      {/* ── Consensus Analysis ─── */}
      {result?.consensus && (
        <section className="consensus-card">
          <h2>Consensus Analysis</h2>
          <p className="consensus-reason">
            <strong>Finding:</strong> {result.consensus.reasoning}
          </p>
          <div className="consensus-reliability">
            Reliability Score: {(result.consensus.reliability * 100).toFixed(0)}%
          </div>
        </section>
      )}

      {/* ── Results ─── */}
      {canRenderResults && comparison && (
        <section className="results-block">
          <div className="res-header">
            <h2>Results</h2>
            <div className="status-notes">
              {(result.vision.prediction.includes("ambiguous") || result.vertex.prediction.includes("ambiguous")) && (
                <p className="note high-risk">
                  Low confidence detected. The model is unsure about this classification.
                </p>
              )}
            </div>
          </div>

          {!result.consensus.prediction_match && (
            <p className="mismatch-warning">
              ⚠ Warning: Vertex AI prediction and Vision labels do not clearly match.
            </p>
          )}

          <article className="comparison-card">
            <div className="header-row">
              <div className="model-name">Metric</div>
              {showVision && <div className="model-name">Pretrained Models</div>}
              {showVertex && <div className="model-name">Vertex AI(Custom)</div>}
            </div>

            {/* Status Row */}
            <div className="metric-row">
              <span>Status</span>
              {showVision && (
                <div className="badge-cell"><StatusBadge prediction={result.vision.prediction} /></div>
              )}
              {showVertex && (
                <div className="badge-cell"><StatusBadge prediction={result.vertex.prediction} /></div>
              )}
            </div>

            {/* Prediction Row */}
            <div className="metric-row">
              <span>Prediction</span>
              {showVision && <strong>{comparison.ecoPrediction}</strong>}
              {showVertex && <strong>{comparison.refPrediction}</strong>}
            </div>

            {/* Ambiguous Threshold Notes (ported from 3000) */}
            {(result.vision.prediction.includes("ambiguous") || result.vertex.prediction.includes("ambiguous")) && (
              <div className="metric-row">
                <span></span>
                {showVision && (
                  <span className="threshold-note">
                    {result.vision.prediction.includes("ambiguous") ? "* Confidence below 60% threshold" : ""}
                  </span>
                )}
                {showVertex && (
                  <span className="threshold-note">
                    {result.vertex.prediction.includes("ambiguous") ? "* Confidence below 60% threshold" : ""}
                  </span>
                )}
              </div>
            )}

            {/* Confidence Row */}
            <div className="metric-row">
              <span>Confidence</span>
              {showVision && <strong>{(result.vision.confidence * 100).toFixed(2)}%</strong>}
              {showVertex && <strong>{(result.vertex.confidence * 100).toFixed(2)}%</strong>}
            </div>

            {/* Precision Row */}
            <div className="metric-row">
              <span title="Historical accuracy of the model for this specific class">Precision</span>
              {showVision && <strong>{(result.vision.precision * 100).toFixed(1)}%</strong>}
              {showVertex && <strong>{(result.vertex.precision * 100).toFixed(1)}%</strong>}
            </div>

            {/* Inference Time Row */}
            <div className="metric-row">
              <span>Inference Time</span>
              {showVision && (
                <strong style={{ color: result.consensus.faster_model === "vision" ? "#10b981" : "inherit" }}>
                  {comparison.ecoTime} ms {result.consensus.faster_model === "vision" ? "⚡" : ""}
                </strong>
              )}
              {showVertex && (
                <strong style={{ color: result.consensus.faster_model === "vertex" ? "#10b981" : "inherit" }}>
                  {comparison.refTime} ms {result.consensus.faster_model === "vertex" ? "⚡" : ""}
                </strong>
              )}
            </div>

            <div className={`winner-banner ${comparison.winnerClass}`}>WINNER: {comparison.winnerText}</div>

            {/* Extra Insights */}
            <div className="extra-insights">
              {showVision && (
                <div className="labels-panel">
                  <h3>Vision Top Labels</h3>
                  <ul className="mini-list">
                    {result.vision.top_labels.map((l) => (
                      <li key={l.label}>
                        <span>{l.label}</span> <strong>{(l.confidence * 100).toFixed(2)}%</strong>
                      </li>
                    ))}
                  </ul>
                  <p className="mapping-note">Uses keyword mapping from Vision API labels with CLIP fallback.</p>
                  {showRawJson && (
                    <div className="raw-viewer mt-4">
                      <h4>Raw Vision Data</h4>
                      <pre>{JSON.stringify(result.vision.raw, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
              {showVertex && (
                <div className="insights-panel">
                  {showRawJson && (
                    <div className="raw-viewer mt-4">
                      <h4>Raw Vertex Data</h4>
                      <pre>{JSON.stringify(result.vertex.raw, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>

          {/* ── Latency Bar & Insight Card (ported from 3000) ─── */}
          <LatencyBar vertexMs={result.vertex.latency_ms} visionMs={result.vision.latency_ms} />
          <InsightCard result={result} />
        </section>
      )}
    </main>
  );
}
