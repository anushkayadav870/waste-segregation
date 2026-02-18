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

function renderResult(data) {
  const scores = data.top_predictions
    .map((item) => {
      return `<li><span>${item.label}</span><div class="bar"><span style="width:${item.score}%"></span></div><strong>${item.score}%</strong></li>`;
    })
    .join("");

  resultCore.innerHTML = `
    <div class="result-head">
      <h3 class="result-label">${data.predicted_label}</h3>
      <span class="badge">${data.confidence}% confidence</span>
    </div>
    <ul class="score-list">${scores}</ul>
    <p class="tip">${data.disposal_tip}</p>
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
    const response = await fetch("/api/predict", {
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
