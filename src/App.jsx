import { useState, useEffect, useRef } from "react";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { Document, Packer, Paragraph } from "docx";
import { saveAs } from "file-saver";
import { FaGithub, FaInfoCircle } from "react-icons/fa";
import "./App.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}
function App() {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState("");
  const [text, setText] = useState(localStorage.getItem("text") || "");
  const [isExtracted, setIsExtracted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const prevUrl = useRef(null);

  // PDF controls
  const [pdfToDocx, setPdfToDocx] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // new: page range + chunking
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [chunkSize, setChunkSize] = useState(30); // pages per chunk
  const [confirmLarge, setConfirmLarge] = useState(false); // show confirm when large selection

  useEffect(() => {
    const storedText = localStorage.getItem("text");
    if (storedText) setText(storedText);

    const modalFlag = localStorage.getItem("ocr_modal_dismissed");
    setShowModal(!modalFlag);
  }, []);

  useEffect(() => {
    return () => {
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    };
  }, []);

  const handleChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;

    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);

    setFile(f);
    setIsExtracted(false);
    setText("");
    setError("");
    localStorage.removeItem("text");
    setProgress(0);
    setStartPage("");
    setEndPage("");

    if (f.type === "application/pdf") {
      setImg("");
    } else if (f.type.startsWith("image/")) {
      const newUrl = URL.createObjectURL(f);
      prevUrl.current = newUrl;
      setImg(newUrl);
    } else {
      setError("Unsupported file type. Upload PDF or image files.");
    }
  };

  // Validate requested page range
  const normalizeRange = (totalPages) => {
    let s = parseInt(startPage) || 1;
    let e = parseInt(endPage) || totalPages;
    if (s < 1) s = 1;
    if (e > totalPages) e = totalPages;
    if (s > e) [s, e] = [e, s]; // swap if reversed
    return { s, e };
  };

  // main extraction entry
  const handleExtract = async () => {
    if (!file) {
      setError("No file selected.");
      return;
    }

    setBusy(true);
    setError("");
    setProgress(0);

    try {
      if (file.type === "application/pdf") {
        // load pdf to get page count and check range
        const url = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        const total = pdfDoc.numPages;
        URL.revokeObjectURL(url);

        const { s, e } = normalizeRange(total);
        const pagesCount = e - s + 1;

        // if pages exceed chunkSize, ask for confirmation
        if (pagesCount > chunkSize && !confirmLarge) {
          setConfirmLarge(true);
          setBusy(false);
          return;
        }

        if (pdfToDocx) {
          await processPdfToDocxChunks(file, s, e, chunkSize);
          setIsExtracted(true);
        } else {
          setError("PDF uploaded. Enable 'PDF -> Word' to extract to docx.");
        }
      } else if (file.type.startsWith("image/")) {
        await ocrImage(file);
      } else {
        setError("Unsupported file type.");
      }
    } catch (err) {
      console.error(err);
      setError("Extraction failed. See console for details.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 600);
      setConfirmLarge(false);
    }
  };

  // single image OCR
  const ocrImage = async (imageFile) => {
    if (!img && imageFile && imageFile.type.startsWith("image/")) {
      const newUrl = URL.createObjectURL(imageFile);
      prevUrl.current = newUrl;
      setImg(newUrl);
    }

    const target = img || imageFile;
    const workerLogger = (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        setProgress(Math.round(m.progress * 100));
      }
    };

    const res = await Tesseract.recognize(target, "eng", {
      logger: workerLogger,
    });
    const extractedText = res.data.text.trim();
    setText(extractedText);
    setIsExtracted(true);
    localStorage.setItem("text", extractedText);
  };

  // Helper: process a single page range into a docx and trigger download
  const processRangeToDocx = async (pdfDoc, fromPage, toPage, outName) => {
    const paragraphs = [];
    const total = toPage - fromPage + 1;

    for (let i = fromPage; i <= toPage; i++) {
      setProgress(Math.round(((i - fromPage) / total) * 100)); // relative for this chunk
      const page = await pdfDoc.getPage(i);

      // try text extraction
      const textContent = await page.getTextContent();
      const pageText = textContent?.items?.map((it) => it.str).join(" ") || "";

      if (pageText && pageText.trim().length > 10) {
        paragraphs.push(new Paragraph(pageText));
      } else {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");

        await page.render({ canvasContext: ctx, viewport }).promise;

        const ocrRes = await Tesseract.recognize(canvas, "eng", {
          logger: () => {
            // per-page progress could be handled here
          },
        });

        const extracted = ocrRes.data.text.trim();
        paragraphs.push(new Paragraph(extracted || ""));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.remove();
      }

      // small yield
      await new Promise((r) => setTimeout(r, 30));
    }

    // build docx for the chunk
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs.length ? paragraphs : [new Paragraph("")],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, outName);
  };

  // Process PDF in chunks (splits into multiple docx files if needed)
  const processPdfToDocxChunks = async (
    pdfFile,
    start = 1,
    end = null,
    chunk = 30
  ) => {
    const url = URL.createObjectURL(pdfFile);
    const loadingTask = pdfjsLib.getDocument(url);
    const pdfDoc = await loadingTask.promise;
    const total = pdfDoc.numPages;
    const { s, e } = normalizeRange(total);

    const from = start || s;
    const to = end || e;

    // compute chunks
    const ranges = [];
    for (let p = from; p <= to; p += chunk) {
      const rStart = p;
      const rEnd = Math.min(p + chunk - 1, to);
      ranges.push([rStart, rEnd]);
    }

    // process each chunk sequentially (to avoid huge concurrency)
    for (let idx = 0; idx < ranges.length; idx++) {
      const [rStart, rEnd] = ranges[idx];
      const partName =
        ranges.length === 1
          ? (pdfFile.name || "extracted") + ".docx"
          : `${(pdfFile.name || "extracted").replace(/\.pdf$/i, "")}_part${
              idx + 1
            }.docx`;

      setProgress(Math.round((idx / ranges.length) * 100));
      await processRangeToDocx(pdfDoc, rStart, rEnd, partName);
      setProgress(Math.round(((idx + 1) / ranges.length) * 100));
      // small pause between chunks
      await new Promise((r) => setTimeout(r, 200));
    }

    URL.revokeObjectURL(url);
    setText(`Extraction complete. Downloaded ${ranges.length} file(s).`);
    localStorage.setItem(
      "text",
      ranges.length > 1
        ? `Downloaded ${ranges.length} files.`
        : "Downloaded docx."
    );
  };

  const saveAsWordFile = () => {
    if (!text) return;
    const doc = new Document({
      sections: [{ properties: {}, children: [new Paragraph(text)] }],
    });
    Packer.toBlob(doc).then((blob) => saveAs(blob, "extracted-text.docx"));
  };

  const handleDelete = () => {
    setText("");
    setIsExtracted(false);
    localStorage.removeItem("text");

    if (prevUrl.current) {
      URL.revokeObjectURL(prevUrl.current);
      prevUrl.current = null;
    }
    setImg("");
    setFile(null);
    setError("");
    setProgress(0);
  };

  // Large-confirm UI helpers
  const confirmAndProceed = () => {
    setConfirmLarge(false);
    setBusy(true);
    // call handleExtract again to continue flow
    setTimeout(() => {
      handleExtract();
    }, 80);
  };

  return (
    <div className="App" aria-live="polite">
      <a
        href="https://github.com/killmong/imgToText"
        target="_blank"
        rel="noreferrer"
      >
        <FaGithub className="github-icon" />
      </a>

      <main className="App-main">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h3>Image / PDF → Text (OCR)</h3>
            <p className="lead">
              Upload images or a PDF. Toggle PDF → Word to export .docx for
              multi-page PDFs.
            </p>
          </div>

          <button
            className="btn ghost"
            onClick={() => setShowModal(true)}
            title="Why scanned documents work best"
          >
            <FaInfoCircle />
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={pdfToDocx}
              onChange={(e) => setPdfToDocx(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>
              If PDF, convert pages to Word (.docx)
            </span>
          </label>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginLeft: "auto",
            }}
          >
            <label style={{ fontSize: 13 }}>
              Start
              <input
                type="number"
                min="1"
                value={startPage}
                onChange={(e) => setStartPage(e.target.value)}
                placeholder="1"
                style={{ marginLeft: 6, width: 80 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              End
              <input
                type="number"
                min="1"
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
                placeholder="last"
                style={{ marginLeft: 6, width: 80 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Chunk size
              <input
                type="number"
                min="1"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value || 30))}
                style={{ marginLeft: 6, width: 80 }}
              />
            </label>
          </div>
        </div>

        <div className="file-row" style={{ marginTop: 12 }}>
          <div className="file-field" role="group" aria-label="File selection">
            <div className="file-placeholder">
              <span className="title">
                {file ? file.name : "No file selected"}
              </span>
              <span className="sub">Supported: image/*, application/pdf</span>
            </div>
          </div>

          <label htmlFor="file" className="btn-upload">
            Upload
            <input
              type="file"
              id="file"
              accept=".pdf,image/*"
              onChange={handleChange}
            />
          </label>
        </div>

        {img && (
          <div className="preview">
            <img src={img} alt="Preview" />
          </div>
        )}

        <div className="actions" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={handleExtract}
            disabled={busy || !file}
          >
            {busy ? `Working... (${progress}%)` : "Start Extraction"}
          </button>
          <button
            className="btn ghost"
            onClick={handleDelete}
            disabled={busy || !file}
          >
            Reset
          </button>
        </div>

        <div
          className="progress-wrap"
          aria-hidden={!busy}
          style={{ marginTop: 12 }}
        >
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${busy ? progress : 0}%` }}
            />
          </div>
          <div className="small" style={{ marginTop: 8 }}>
            {busy ? `Processing: ${progress}%` : ""}
          </div>
        </div>

        {error && (
          <p className="small" style={{ color: "#ff7070", marginTop: 8 }}>
            {error}
          </p>
        )}
      </main>

      <div className="text-box" role="region" aria-label="Extracted text">
        <div className="meta">
          <h4>Extracted Text</h4>
          {isExtracted && (
            <div className="dog-container">
              <div className="dog-badge">
                <img
                  className="dog-img"
                  src="freepik__background__73602.png"
                  alt="Success"
                />
              </div>
            </div>
          )}
        </div>

        <div className="extracted" tabIndex={0}>
          {text ? text : "Your extracted text will appear here..."}
        </div>

        {text && (
          <div className="row-utility">
            <button className="btn primary" onClick={saveAsWordFile}>
              Save as Word
            </button>
            <button className="btn destructive" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* modal */}
      {showModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ocr-modal-title"
        >
          <div className="modal-card">
            <h3 id="ocr-modal-title">
              Best results: use scanned / high-contrast documents
            </h3>
            <p className="small" style={{ marginTop: 8 }}>
              For multi-page PDFs this tool will attempt to extract text from
              each page and produce one or more Word documents (split into parts
              if needed).
            </p>
            <p className="small" style={{ marginTop: 8 }}>
              For very large books ( ~100 pages) we recommend server-side
              processing for reliability and speed.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 18,
                alignItems: "center",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={() => setDontShowAgain((s) => !s)}
                />
                <span style={{ fontSize: 13 }}>Don't show again</span>
              </label>

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  className="btn ghost"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    if (dontShowAgain)
                      localStorage.setItem("ocr_modal_dismissed", "1");
                    setShowModal(false);
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* large-confirm overlay */}
      {confirmLarge && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="large-confirm-title"
        >
          <div className="modal-card">
            <h3 id="large-confirm-title">Large extraction</h3>
            <p className="small" style={{ marginTop: 8 }}>
              The selected range contains more than {chunkSize} pages.
              Processing large ranges client-side can take a long time and may
              be heavy on memory.
            </p>
            <p className="small" style={{ marginTop: 8 }}>
              Options:
              <ul style={{ marginTop: 8 }}>
                <li>Proceed and extract in multiple files (recommended).</li>
                <li>
                  Reduce the page range or increase chunk size if you understand
                  the memory tradeoff.
                </li>
                <li>Use a server-side processing flow for whole books.</li>
              </ul>
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                className="btn ghost"
                onClick={() => setConfirmLarge(false)}
              >
                Cancel
              </button>
              <button className="btn primary" onClick={confirmAndProceed}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
