'use client';

type LabelItem = {
  label: string;
  confidence: number;
};

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
    top_labels: LabelItem[];
    latency_ms: number;
    raw: unknown;
  };
  comparison: {
    faster: 'vertex' | 'vision';
    prediction_match: boolean;
  };
};

type ResultComparisonProps = {
  result: PredictionResult;
  showVertex: boolean;
  showVision: boolean;
  showRawJson: boolean;
};

function StatusBadge({ prediction }: { prediction: string }) {
  const isUnrecognized = prediction.toLowerCase() === 'unrecognized';
  const isAmbiguous = prediction.toLowerCase().includes('ambiguous');

  if (isUnrecognized) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Unrecognized (Not Waste)
      </span>
    );
  }

  if (isAmbiguous) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        Ambiguous Prediction
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 uppercase">
      Confirmed {prediction}
    </span>
  );
}

function InsightCard({ result }: { result: PredictionResult }) {
  const topVision = result.vision.top_labels[0];
  const confidenceDelta = Math.abs(result.vertex.confidence - (topVision?.confidence ?? 0));

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Comparison Insights</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <p><strong>Faster:</strong> {result.comparison.faster === 'vertex' ? 'Vertex AI' : 'Vision API'}.</p>
        <p><strong>Specificity:</strong> Vertex AI gives a single structured class, Vision provides general descriptive labels.</p>
        <p><strong>Confidence gap:</strong> {(confidenceDelta * 100).toFixed(1)} percentage points (top prediction).</p>
        <p>
          <strong>Summary:</strong> Vertex AI is specialized and returns structured class labels. Vision API is
          general-purpose and returns multiple descriptive labels.
        </p>
      </div>
    </div>
  );
}

function LatencyBar({ vertexMs, visionMs }: { vertexMs: number; visionMs: number }) {
  const max = Math.max(vertexMs, visionMs, 1);
  const vertexWidth = (vertexMs / max) * 100;
  const visionWidth = (visionMs / max) * 100;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">Response Time Comparison</h3>
      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-sm"><span>Vertex AI</span><span>{vertexMs} ms</span></div>
          <div className="h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-sky" style={{ width: `${vertexWidth}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm"><span>Vision API</span><span>{visionMs} ms</span></div>
          <div className="h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-mint" style={{ width: `${visionWidth}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultComparison({
  result,
  showVertex,
  showVision,
  showRawJson,
}: ResultComparisonProps) {
  const topVision = result.vision.top_labels[0];

  return (
    <div className="space-y-6">
      {!result.comparison.prediction_match && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Warning: Vertex AI prediction and Vision labels do not clearly match.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {showVertex && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <strong>Predicted class:</strong>
                <StatusBadge prediction={result.vertex.prediction} />
              </div>
              {result.vertex.prediction.includes('ambiguous') && (
                <p className="text-[10px] text-slate-500 italic ml-1">
                  * Confidence was below 60% threshold.
                </p>
              )}
              <p><strong>Confidence:</strong> {(result.vertex.confidence * 100).toFixed(2)}%</p>
              <p className={result.comparison.faster === 'vertex' ? 'font-semibold text-mint' : ''}>
                <strong>Latency:</strong> {result.vertex.latency_ms} ms
              </p>
            </div>
            {showRawJson && (
              <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(result.vertex.raw, null, 2)}
              </pre>
            )}
          </section>
        )}

        {showVision && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <strong>Predicted class:</strong>
                <StatusBadge prediction={result.vision.prediction} />
              </div>
              {result.vision.prediction.includes('ambiguous') && (
                <p className="text-[10px] text-slate-500 italic ml-1">
                  * Confidence was below 60% threshold.
                </p>
              )}
              <p><strong>Confidence:</strong> {(result.vision.confidence * 100).toFixed(2)}%</p>
              <p className={result.comparison.faster === 'vision' ? 'font-semibold text-mint' : ''}>
                <strong>Latency:</strong> {result.vision.latency_ms} ms
              </p>
              <p className="mt-2 text-xs text-slate-500 italic">
                Uses keyword mapping from Vision API labels with CLIP fallback.
              </p>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {result.vision.top_labels.map((item) => (
                <li key={item.label}>
                  {item.label}: {(item.confidence * 100).toFixed(2)}%
                </li>
              ))}
            </ul>
            {showRawJson && (
              <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(result.vision.raw, null, 2)}
              </pre>
            )}
          </section>
        )}
      </div>

      <LatencyBar vertexMs={result.vertex.latency_ms} visionMs={result.vision.latency_ms} />
      <InsightCard result={result} />
    </div>
  );
}
