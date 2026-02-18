'use client';

import axios from 'axios';
import { useMemo, useState } from 'react';
import ResultComparison from '@/components/ResultComparison';
import UploadCard from '@/components/UploadCard';

type PredictionResult = {
  vertex: {
    prediction: string;
    confidence: number;
    latency_ms: number;
    raw: unknown;
  };
  vision: {
    prediction: string;
    confidence: number;
    top_labels: { label: string; confidence: number }[];
    latency_ms: number;
    raw: unknown;
  };
  comparison: {
    faster: 'vertex' | 'vision';
    prediction_match: boolean;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function HomePage() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showVertex, setShowVertex] = useState(true);
  const [showVision, setShowVision] = useState(true);

  const canRenderResults = useMemo(() => result && (showVertex || showVision), [result, showVertex, showVision]);

  const handleAnalyze = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post<PredictionResult>(`${API_BASE_URL}/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      });

      setResult(response.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message || 'Request failed.');
      } else {
        setError('Unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">WasteML Compare</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">
          Academic demo comparing a custom Google Vertex AI waste classifier against Google Cloud Vision API label
          detection for prediction style, confidence, latency, and usability.
        </p>
      </header>

      <div className="space-y-6">
        <UploadCard onAnalyze={handleAnalyze} loading={loading} />

        {result && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="text-xl font-semibold text-ink">Display Options</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5">
                <input type="checkbox" checked={showVertex} onChange={(e) => setShowVertex(e.target.checked)} />
                Show Vertex
              </label>
              <label className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5">
                <input type="checkbox" checked={showVision} onChange={(e) => setShowVision(e.target.checked)} />
                Show Vision
              </label>
              <button
                className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                onClick={() => setShowRawJson((prev) => !prev)}
              >
                {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
              </button>
              {result.comparison.prediction_match ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Predictions align</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Predictions differ</span>
              )}
            </div>
          </section>
        )}

        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {canRenderResults && result && (
          <ResultComparison
            result={result}
            showRawJson={showRawJson}
            showVertex={showVertex}
            showVision={showVision}
          />
        )}
      </div>
    </main>
  );
}
