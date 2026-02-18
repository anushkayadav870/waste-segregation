const dropZone = document.getElementById("dropZone");
const imageInput = document.getElementById("imageInput");
const previewShell = document.getElementById("previewShell");
const previewImage = document.getElementById("previewImage");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusText = document.getElementById("statusText");
const resultCore = document.getElementById("resultCore");

let selectedFile = null;

function setFile(file) {
  selectedFile = file;
  analyzeBtn.disabled = !file;

  if (!file) {
    previewShell.hidden = true;
    statusText.textContent = "No image selected.";
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  previewImage.src = imageUrl;
  previewShell.hidden = false;
  statusText.textContent = `Selected: ${file.name}`;
}

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) {
    setFile(file);
  }
});

imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    setFile(file);
  }
});

const DISPOSAL_GUIDE = {
  "cardboard": "Keep dry, flatten boxes, and place in paper/cardboard recycling.",
  "metal": "Rinse metal cans and drop into metal recycling collection.",
  "plastic": "Rinse plastic containers and place them in plastic recycling bins.",
  "paper": "Keep clean and dry; recycle with paper products.",
  "glass": "Rinse and separate by local rules before putting in glass recycling.",
  "trash": "Not recyclable in most programs. Dispose in general waste.",
  "unrecognized": "Item not recognized as waste. Please check and try again.",
};

function renderResult(data) {
  const vision = data.vision;
  const vertex = data.vertex;

  // Use vision top_labels for the score list
  const scores = (vision.top_labels || [])
    .map((item) => {
      const scoreNum = Math.round(item.confidence * 100);
      return `<li><span>${item.label}</span><div class="bar"><span style="width:${scoreNum}%"></span></div><strong>${scoreNum}%</strong></li>`;
    })
    .join("");

  const prediction = vision.prediction.split(' (')[0].toLowerCase(); // Handle "ambiguous (label)"
  const tip = DISPOSAL_GUIDE[prediction] || "Follow local recycling guidelines for this item.";

  resultCore.innerHTML = `
    <div class="result-head">
      <h3 class="result-label">${vision.prediction}</h3>
      <span class="badge">${Math.round(vision.confidence * 100)}% confidence</span>
    </div>
    <div class="comparison-info">
      <p><small>Vertex AI: ${vertex.prediction} (${Math.round(vertex.confidence * 100)}%)</small></p>
    </div>
    <ul class="score-list">${scores}</ul>
    <p class="tip">${tip}</p>
  `;
}

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  statusText.textContent = "Running segregation scan";

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const response = await fetch("/predict", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Prediction failed" }));
      throw new Error(errorData.detail || "Prediction failed");
    }

    const data = await response.json();
    renderResult(data);
    statusText.textContent = "Analysis complete.";
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Run Segregation Scan";
  }
});
