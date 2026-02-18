FROM python:3.11-slim-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl libglib2.0-0 libjpeg-dev libpng-dev python3-dev python3-distutils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip setuptools wheel

COPY requirements.txt .
RUN pip install -r requirements.txt

WORKDIR /app
COPY . .

ENV GOOGLE_APPLICATION_CREDENTIALS=/app/gcp_keys/waste-ml-key.json

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
