const STORAGE_KEY = "pagewords.v1";

const quickFileInput = document.getElementById("quick-file");
const quickWordCount = document.getElementById("quick-word-count");
const quickOcrConfidence = document.getElementById("quick-ocr-confidence");
const quickOcrDetails = document.getElementById("quick-ocr-details");
const quickOcrText = document.getElementById("quick-ocr-text");

const bookTitle = document.getElementById("book-title");
const bookTotalPages = document.getElementById("book-total-pages");
const bookFileInput = document.getElementById("book-file");
const bookAvgWords = document.getElementById("book-avg-words");
const bookTotalWords = document.getElementById("book-total-words");
const bookPagesScanned = document.getElementById("book-pages-scanned");
const bookAvgConfidence = document.getElementById("book-avg-confidence");
const bookScanList = document.getElementById("book-scan-list");
const bookSave = document.getElementById("book-save");
const bookReset = document.getElementById("book-reset");
const historyList = document.getElementById("history-list");
const historyExport = document.getElementById("history-export");

const state = loadState();
let ocrWorkerPromise = null;

function createBlankBook() {
  return {
    id: crypto.randomUUID(),
    title: "",
    totalPages: "",
    scans: [],
    createdAt: new Date().toISOString(),
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { currentBook: createBlankBook(), history: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      currentBook: parsed.currentBook || createBlankBook(),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch (err) {
    console.warn("Failed to read saved state", err);
    return { currentBook: createBlankBook(), history: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

bookTitle.value = state.currentBook.title || "";
bookTotalPages.value = state.currentBook.totalPages || "";

bookTitle.addEventListener("input", () => {
  state.currentBook.title = bookTitle.value.trim();
  saveState();
  renderHistory();
});

bookTotalPages.addEventListener("input", () => {
  state.currentBook.totalPages = bookTotalPages.value;
  saveState();
  renderBookStats();
});

quickFileInput.addEventListener("change", async () => {
  const file = quickFileInput.files && quickFileInput.files[0];
  if (!file) {
    return;
  }
  setQuickResult("Processing...", "Working...");
  const result = await analyzeWithOcr(file);
  renderQuickResult(result);
  quickFileInput.value = "";
});

bookFileInput.addEventListener("change", async () => {
  const file = bookFileInput.files && bookFileInput.files[0];
  if (!file) {
    return;
  }
  bookAvgConfidence.textContent = "Working...";
  const result = await analyzeWithOcr(file);
  state.currentBook.scans.push(result);
  saveState();
  renderBookScans();
  renderBookStats();
  bookFileInput.value = "";
});

bookSave.addEventListener("click", () => {
  if (!state.currentBook.scans.length) {
    alert("Add at least one scanned page before saving.");
    return;
  }
  const snapshot = { ...state.currentBook };
  snapshot.savedAt = new Date().toISOString();
  state.history.unshift(snapshot);
  state.currentBook = createBlankBook();
  bookTitle.value = "";
  bookTotalPages.value = "";
  saveState();
  renderBookScans();
  renderBookStats();
  renderHistory();
});

bookReset.addEventListener("click", () => {
  if (!confirm("Clear the current book?") ) {
    return;
  }
  state.currentBook = createBlankBook();
  bookTitle.value = "";
  bookTotalPages.value = "";
  saveState();
  renderBookScans();
  renderBookStats();
});

historyExport.addEventListener("click", () => {
  if (!state.history.length) {
    alert("No saved books to export.");
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    books: state.history,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `book-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

function setQuickResult(wordCount, confidence) {
  quickWordCount.textContent = wordCount;
  quickOcrConfidence.textContent = confidence;
}

function renderQuickResult(result) {
  setQuickResult(result.wordCount, formatConfidence(result.confidence));
  quickOcrText.textContent = result.ocrText ? result.ocrText.trim() : "";
  quickOcrDetails.style.display = result.ocrText ? "block" : "none";
}

function renderBookScans() {
  bookScanList.innerHTML = "";
  if (!state.currentBook.scans.length) {
    const empty = document.createElement("p");
    empty.textContent = "No scans yet. Add a page above.";
    empty.className = "scan-meta";
    bookScanList.appendChild(empty);
    return;
  }
  state.currentBook.scans.forEach((scan, index) => {
    const item = document.createElement("div");
    item.className = "scan-item";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = `Page ${index + 1}`;
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.currentBook.scans.splice(index, 1);
      saveState();
      renderBookScans();
      renderBookStats();
    });
    header.appendChild(title);
    header.appendChild(remove);
    const meta = document.createElement("div");
    meta.className = "scan-meta";
    meta.textContent = `${scan.wordCount} words · OCR ${formatConfidence(scan.confidence)}`;
    item.appendChild(header);
    item.appendChild(meta);
    if (scan.ocrText) {
      const details = document.createElement("details");
      details.className = "details";
      const summary = document.createElement("summary");
      summary.textContent = "Detected text";
      const pre = document.createElement("pre");
      pre.textContent = scan.ocrText.trim();
      details.appendChild(summary);
      details.appendChild(pre);
      item.appendChild(details);
    }
    bookScanList.appendChild(item);
  });
}

function renderBookStats() {
  const scans = state.currentBook.scans;
  const count = scans.length;
  bookPagesScanned.textContent = count;
  if (!count) {
    bookAvgWords.textContent = "--";
    bookTotalWords.textContent = "--";
    bookAvgConfidence.textContent = "--";
    return;
  }
  const totalWords = scans.reduce((sum, scan) => sum + scan.wordCount, 0);
  const avgWords = Math.round(totalWords / count);
  bookAvgWords.textContent = avgWords;
  const avgConfidence =
    scans.reduce((sum, scan) => sum + (scan.confidence || 0), 0) / count;
  bookAvgConfidence.textContent = formatConfidence(avgConfidence);

  const totalPages = Number(state.currentBook.totalPages);
  if (Number.isFinite(totalPages) && totalPages > 0) {
    bookTotalWords.textContent = Math.round(avgWords * totalPages);
  } else {
    bookTotalWords.textContent = "--";
  }
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.textContent = "No saved books yet.";
    empty.className = "scan-meta";
    historyList.appendChild(empty);
    return;
  }

  state.history.forEach((book, index) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = book.title || "Untitled book";
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      if (!confirm("Delete this saved book?") ) {
        return;
      }
      state.history.splice(index, 1);
      saveState();
      renderHistory();
    });
    header.appendChild(title);
    header.appendChild(remove);
    item.appendChild(header);

    const stats = document.createElement("div");
    const scans = book.scans || [];
    const totalWords = scans.reduce((sum, scan) => sum + scan.wordCount, 0);
    const avgWords = scans.length ? Math.round(totalWords / scans.length) : 0;
    const estimate = book.totalPages ? Math.round(avgWords * Number(book.totalPages)) : "--";
    stats.className = "scan-meta";
    stats.textContent = `${scans.length} scans · avg ${avgWords} words/page · total ${estimate}`;
    item.appendChild(stats);

    const meta = document.createElement("div");
    meta.className = "scan-meta";
    const date = book.savedAt || book.createdAt;
    meta.textContent = date ? `Saved ${new Date(date).toLocaleDateString()}` : "";
    item.appendChild(meta);

    historyList.appendChild(item);
  });
}

async function analyzeWithOcr(file) {
  if (!window.Tesseract) {
    alert("OCR library not loaded. Check your connection.");
  }
  const worker = await getOcrWorker();
  const imageDataUrl = await preprocessImage(file);
  const { data } = await worker.recognize(imageDataUrl);
  const text = data.text || "";
  const words = text.match(/[\p{L}\p{N}']+/gu) || [];
  return {
    id: crypto.randomUUID(),
    wordCount: words.length,
    confidence: data.confidence || 0,
    ocrText: text.slice(0, 1600),
    createdAt: new Date().toISOString(),
  };
}

async function preprocessImage(file) {
  const image = await loadImage(file);
  const maxSize = 1600;
  const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  applyContrast(ctx, canvas.width, canvas.height, 30);
  return canvas.toDataURL("image/png");
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applyContrast(ctx, width, height, contrast) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    const adjusted = clamp(factor * (gray - 128) + 128, 0, 255);
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }
  ctx.putImageData(imageData, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatConfidence(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "--";
  }
  return `${Math.round(value)}%`;
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await window.Tesseract.createWorker();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: 6,
        user_defined_dpi: "300",
      });
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

renderBookScans();
renderBookStats();
renderHistory();
