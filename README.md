# WasteML Compare

WasteML Compare is a full-stack academic demonstration platform that compares specialized Google Vertex AI classification against a Hybrid Vision + CLIP engine for waste segregation.

## 🚀 System Features

- **Hybrid Engine**: Combines Google Cloud Vision API (label detection) with OpenAI CLIP (zero-shot classification) for highly accurate fallback.
- **Waste Guard**: A robustness layer that blocks non-waste items (e.g., cars, apples, people) by analyzing domain labels.
- **Confidence Floors**: Predictions with < 60% confidence are flagged as "ambiguous" to ensure integrity.
- **Side-by-Side Comparison**: Direct visualization of latency, confidence, and prediction matches between models.

---

## 🛠️ Backend Setup (FastAPI)

1. **Environment Setup**:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configuration**:
   - Create a `.env` file in the `backend` folder (see `.env.example`).
   - Ensure your `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account JSON.

3. **Execution**:
   ```bash
   # Run on port 8005 (to avoid local conflicts)
   uvicorn main:app --reload --port 8005
   ```

---

## 💻 Frontend Setup (Next.js)

1. **Installation**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configuration**:
   - Create `.env.local` to point to the backend:
     `NEXT_PUBLIC_API_BASE_URL=http://localhost:8005`

3. **Execution**:
   ```bash
   # Defaults to port 3000 or 3001
   npm run dev
   ```

---

## 📤 Pushing to Development

Follow these steps to push your changes to the `dev` branch:

1. **Stage Changes**:
   ```bash
   git add .
   ```

2. **Commit**:
   ```bash
   git commit -m "feat: complete integration, robust waste-guard, and hybrid engine polish"
   ```

3. **Push**:
   ```bash
   # Ensure you are on the dev branch (or creates it if it doesn't exist)
   git checkout -b dev
   git push origin dev
   ```

---

## 📂 Project Structure Note
- Key business logic: `backend/app/vision_clip_service.py` and `backend/main.py`.
- Archived development scripts can be found in `archived_tests.zip`.

---

## ⚖️ License
Academic/Research Use Only.
