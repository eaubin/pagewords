const STORAGE_KEY = "pagewords.v1";

const quickFileInput = document.getElementById("quick-file");
const quickMethod = document.getElementById("quick-method");
const quickWordsPerLineGroup = document.getElementById("quick-words-per-line-group");
const quickWordsPerLine = document.getElementById("quick-words-per-line");
const quickWordCount = document.getElementById("quick-word-count");
const quickLineCount = document.getElementById("quick-line-count");
const quickMethodUsed = document.getElementById("quick-method-used");
const quickOcrDetails = document.getElementById("quick-ocr-details");
const quickOcrText = document.getElementById("quick-ocr-text");

const bookTitle = document.getElementById("book-title");
const bookTotalPages = document.getElementById("book-total-pages");
const bookMethod = document.getElementById("book-method");
const bookWordsPerLineGroup = document.getElementById("book-words-per-line-group");
const bookWordsPerLine = document.getElementById("book-words-per-line");
const bookFileInput = document.getElementById("book-file");
const bookAvgWords = document.getElementById("book-avg-words");
const bookTotalWords = document.getElementById("book-total-words");
const bookPagesScanned = document.getElementById("book-pages-scanned");
const bookScanList = document.getElementById("book-scan-list");
const bookSave = document.getElementById("book-save");
const bookReset = document.getElementById("book-reset");
const historyList = document.getElementById("history-list");

const state = loadState();

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

function setMethodVisibility(selectEl, groupEl) {
  groupEl.style.display = selectEl.value === "fast" ? "grid" : "none";
}

setMethodVisibility(quickMethod, quickWordsPerLineGroup);
setMethodVisibility(bookMethod, bookWordsPerLineGroup);

quickMethod.addEventListener("change", () => {
  setMethodVisibility(quickMethod, quickWordsPerLineGroup);
});

bookMethod.addEventListener("change", () => {
  setMethodVisibility(bookMethod, bookWordsPerLineGroup);
});

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
  setQuickResult("Processing...", "--", "--");
  const result = await analyzeFile(file, {
    method: quickMethod.value,
    wordsPerLine: Number(quickWordsPerLine.value || 10),
  });
  renderQuickResult(result);
  quickFileInput.value = "";
});

bookFileInput.addEventListener("change", async () => {
  const file = bookFileInput.files && bookFileInput.files[0];
  if (!file) {
    return;
  }
  const result = await analyzeFile(file, {
    method: bookMethod.value,
    wordsPerLine: Number(bookWordsPerLine.value || 10),
  });
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

function setQuickResult(wordCount, lineCount, method) {
  quickWordCount.textContent = wordCount;
  quickLineCount.textContent = lineCount;
  quickMethodUsed.textContent = method;
}

function renderQuickResult(result) {
  setQuickResult(result.wordCount, result.lineCount || "--", result.methodLabel);
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
    meta.textContent = `${scan.wordCount} words · ${scan.methodLabel}`;
    item.appendChild(header);
    item.appendChild(meta);
    if (scan.lineCount) {
      const line = document.createElement("div");
      line.className = "scan-meta";
      line.textContent = `Lines detected: ${scan.lineCount}`;
      item.appendChild(line);
    }
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
    return;
  }
  const totalWords = scans.reduce((sum, scan) => sum + scan.wordCount, 0);
  const avgWords = Math.round(totalWords / count);
  bookAvgWords.textContent = avgWords;

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

async function analyzeFile(file, options) {
  const method = options.method;
  const wordsPerLine = Number(options.wordsPerLine) || 10;

  if (method === "ocr") {
    return await analyzeWithOcr(file);
  }
  const canvas = await renderToCanvas(file);
  const { lineCount, threshold } = estimateLines(canvas);
  const wordCount = Math.max(1, Math.round(lineCount * wordsPerLine));
  return {
    id: crypto.randomUUID(),
    methodLabel: `Fast estimate (${wordsPerLine} words/line)`,
    wordCount,
    lineCount,
    threshold,
    createdAt: new Date().toISOString(),
  };
}

async function analyzeWithOcr(file) {
  if (!window.Tesseract) {
    alert("OCR library not loaded. Check your connection.");
  }
  const { data } = await window.Tesseract.recognize(file, "eng", {
    logger: () => {},
  });
  const text = data.text || "";
  const words = text.match(/[\p{L}\p{N}']+/gu) || [];
  return {
    id: crypto.randomUUID(),
    methodLabel: "OCR word count",
    wordCount: words.length,
    lineCount: countLinesFromText(text),
    ocrText: text.slice(0, 1200),
    createdAt: new Date().toISOString(),
  };
}

async function renderToCanvas(file) {
  const image = await loadImage(file);
  const maxSize = 1200;
  const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
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

function estimateLines(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixels = width * height;
  let sum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += gray;
  }

  const mean = sum / pixels;
  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    variance += (gray - mean) ** 2;
  }
  const stdev = Math.sqrt(variance / pixels);
  const threshold = Math.max(40, mean - stdev * 0.5);

  const rowDensity = new Array(height).fill(0);
  let index = 0;
  for (let y = 0; y < height; y += 1) {
    let darkCount = 0;
    for (let x = 0; x < width; x += 1) {
      const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
      if (gray < threshold) {
        darkCount += 1;
      }
      index += 4;
    }
    rowDensity[y] = darkCount / width;
  }

  const smoothed = rowDensity.map((_, y) => {
    let sumDensity = 0;
    let count = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const sample = rowDensity[y + offset];
      if (sample !== undefined) {
        sumDensity += sample;
        count += 1;
      }
    }
    return sumDensity / count;
  });

  const minDensity = 0.05;
  const minLineHeight = Math.max(4, Math.round(height * 0.008));
  let lineCount = 0;
  let inLine = false;
  let lineStart = 0;

  for (let y = 0; y < height; y += 1) {
    if (smoothed[y] > minDensity) {
      if (!inLine) {
        inLine = true;
        lineStart = y;
      }
    } else if (inLine) {
      if (y - lineStart >= minLineHeight) {
        lineCount += 1;
      }
      inLine = false;
    }
  }
  if (inLine && height - lineStart >= minLineHeight) {
    lineCount += 1;
  }

  return { lineCount, threshold: Math.round(threshold) };
}

function countLinesFromText(text) {
  return text.split(/\n+/).filter((line) => line.trim().length > 0).length || 0;
}

renderBookScans();
renderBookStats();
renderHistory();
