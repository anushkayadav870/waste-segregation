# WasteML Compare

WasteML Compare is a full-stack academic demo that compares:
- Google Vertex AI custom image classification
- Google Cloud Vision API label detection

It visualizes differences in prediction style, confidence, latency, output format, and practical usability.

## Project Structure

```text
backend/
  app/
    __init__.py
    main.py
    vision_service.py
    vertex_service.py
  requirements.txt
  .env.example

frontend/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    UploadCard.tsx
    ResultComparison.tsx
  package.json
  next.config.js
  postcss.config.js
  tailwind.config.ts
  tsconfig.json
  .env.local.example
```

## Backend Setup (FastAPI)

1. Create and activate a Python 3.10 virtual environment:

```bash
cd backend
python3.10 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create local env file:

```bash
cp .env.example .env
```

4. Fill `.env` values:
- `GOOGLE_APPLICATION_CREDENTIALS` - absolute path to your service account JSON
- `VERTEX_ENDPOINT_ID` - deployed Vertex endpoint ID
- `PROJECT_ID` - GCP project ID
- `LOCATION` - endpoint region, e.g. `us-central1`

5. Run API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `http://localhost:8000/health`

## Frontend Setup (Next.js 14)

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Create frontend env file:

```bash
cp .env.local.example .env.local
```

3. Confirm backend URL in `.env.local`:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

4. Start frontend:

```bash
npm run dev
```

Open: `http://localhost:3000`

## API Contract

`POST /predict` with form-data key `file` (image)

Example response:

```json
{
  "vertex": {
    "prediction": "plastic",
    "confidence": 0.97,
    "latency_ms": 320.4,
    "raw": {}
  },
  "vision": {
    "top_labels": [
      { "label": "Plastic", "confidence": 0.94 },
      { "label": "Bottle", "confidence": 0.91 }
    ],
    "latency_ms": 180.2,
    "raw": {}
  },
  "comparison": {
    "faster": "vision",
    "prediction_match": true
  }
}
```

## Notes

- Backend currently allows `image/jpeg`, `image/png`, and `image/webp` up to 10MB.
- CORS is enabled for `http://localhost:3000`.
- Vertex response parsing supports common custom classifier output shapes and includes fallback parsing.
