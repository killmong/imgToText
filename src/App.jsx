import React, { useState, useEffect, useRef } from "react";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { Document, Packer, Paragraph } from "docx";
import { saveAs } from "file-saver";
import { FaGithub, FaInfoCircle } from "react-icons/fa";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

// NOTE: This file includes component + scoped CSS (in a <style> block) so you
// can drop it into a single-file demo. If you prefer separate CSS, extract the
// contents of the `css` template string into App.css and import it normally.

const css = `
:root{
  --bg-1: #070810;
  --glass: rgba(255,255,255,0.03);
  --glass-2: rgba(255,255,255,0.06);
  --accent: #FF6500;
  --accent-2: #1E3E62;
  --muted: rgba(255,255,255,0.72);
  --card-radius: 16px;
  --gap: 18px;
  --max-width: 1100px;
  --glass-border: rgba(255,255,255,0.04);
}
*{box-sizing:border-box}
html,body,#root{height:100%}
body{
  margin:0;
  min-height:100vh;
  font-family: Inter, Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  background: radial-gradient(1200px 600px at 10% 10%, rgba(47,84,255,0.08), transparent 8%),
              linear-gradient(180deg,#07102a 0%, #0f1724 60%);
  color:var(--muted);
  -webkit-font-smoothing:antialiased;
  padding:36px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.App{
  width:100%;
  max-width:var(--max-width);
  display:grid;
  grid-template-columns: 1fr 420px;
  gap:28px;
  align-items:start;
}
@media (max-width:980px){
  .App{grid-template-columns:1fr; padding:12px}
}

.card{
  background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
  border-radius:var(--card-radius);
  padding:26px;
  box-shadow: 0 10px 40px rgba(2,6,23,0.6);
  border:1px solid var(--glass-border);
  backdrop-filter: blur(8px) saturate(120%);
  transition: transform .18s ease, box-shadow .18s ease;
}
.card:hover{transform:translateY(-6px)}

.header-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.title{color:#fff;font-weight:700;font-size:18px}
.lead{margin:0;color:rgba(255,255,255,0.7);font-size:13.5px}

.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px}
.switch{display:inline-flex;align-items:center;gap:8px}
.switch input{width:18px;height:18px}

.file-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:14px}
.file-field{
  display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border:1px dashed rgba(255,255,255,0.04);
}
.file-field.drag{
  border-style:solid;
  box-shadow:0 8px 30px rgba(0,0,0,0.6), inset 0 0 40px rgba(255,101,0,0.03);
}
.file-placeholder{overflow:hidden}
.file-placeholder .title{color:#fff;font-weight:700;font-size:14px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
.file-placeholder .sub{font-size:12px;color:rgba(255,255,255,0.6)}

.btn-upload{
  background:linear-gradient(90deg,var(--accent),#ff8a42);border:none;color:white;padding:10px 14px;border-radius:10px;font-weight:700;cursor:pointer;box-shadow:0 8px 28px rgba(255,101,0,0.12);display:inline-flex;align-items:center;gap:8px}
.btn-upload:active{transform:translateY(1px)}

.preview{margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.03);background:linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0.02));}
.preview img{width:100%;display:block;height:auto;max-height:420px;object-fit:contain}

.actions{display:flex;gap:12px;margin-top:14px}
.btn{flex:1;padding:12px 16px;border-radius:12px;font-weight:800;border:none;cursor:pointer;transition:transform .12s ease,box-shadow .12s}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9)}
.btn.primary{background:linear-gradient(90deg,#2978f2,#7b61ff);color:white;box-shadow:0 12px 32px rgba(43,92,255,0.12)}
.btn.destructive{background:linear-gradient(90deg,#ff6b6b,#ef4444);color:white;box-shadow:0 12px 32px rgba(239,68,68,0.12)}

.progress-wrap{margin-top:14px}
.progress-track{height:10px;background:linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));border-radius:999px;overflow:hidden;border:1px solid rgba(255,255,255,0.03)}
.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,var(--accent),#ffd19a);transition:width .28s ease}
.progress-label{margin-top:8px;color:rgba(255,255,255,0.7);font-size:13px}

.text-box{display:flex;flex-direction:column;gap:12px;padding:22px;min-height:320px}
.text-box h4{margin:0;color:#fff;font-weight:700}
.extracted{flex:1;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));padding:14px;border-radius:10px;color:rgba(255,255,255,0.95);font-size:15px;line-height:1.6;overflow:auto;white-space:pre-wrap}

.row-utility{display:flex;gap:10px;margin-top:8px}
.small{font-size:13px;color:rgba(255,255,255,0.65)}

.github-icon{position:fixed;right:22px;top:18px;width:48px;height:48px;color:white;opacity:0.95;border-radius:12px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));display:flex;align-items:center;justify-content:center;padding:8px;box-shadow:0 6px 24px rgba(0,0,0,0.45)}
.github-icon:hover{transform:scale(1.06)}

/* dog badge */
.dog-container{display:flex;align-items:center;gap:8px}
.dog-badge{width:56px;height:56px;border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#fff,#f7f7f7);box-shadow:0 12px 30px rgba(0,0,0,0.45);transform-origin:center;animation:float 2.8s ease-in-out infinite}
@keyframes float{0%{transform:translateY(0)}50%{transform:translateY(-8px) rotate(-2deg)}100%{transform:translateY(0)}}

/* modal */
.modal-overlay{position:fixed;inset:0;background:linear-gradient(180deg, rgba(2,6,23,0.6), rgba(2,6,23,0.8));display:flex;align-items:center;justify-content:center;padding:24px;z-index:80}
.modal-card{width:100%;max-width:640px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,0.04);box-shadow:0 18px 60px rgba(0,0,0,0.6)}
.modal-card h3{margin:0;color:#fff}
.modal-card .actions{margin-top:18px}

/* subtle glass decorations */
.header-accent{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.02);color:var(--accent)}

/* cool glowing text */
.glow{color:transparent;background:linear-gradient(90deg,var(--accent), #ffd19a);-webkit-background-clip:text;background-clip:text;font-weight:800}
.subtle{color:rgba(255,255,255,0.7)}

/* small responsive tweaks */
@media (max-width:560px){
  .file-row{grid-template-columns:1fr}
  .github-icon{display:none}
}
`;

export default function App() {
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
  const [chunkSize, setChunkSize] = useState(30);
  const [confirmLarge, setConfirmLarge] = useState(false);

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

  const normalizeRange = (totalPages) => {
    let s = parseInt(startPage) || 1;
    let e = parseInt(endPage) || totalPages;
    if (s < 1) s = 1;
    if (e > totalPages) e = totalPages;
    if (s > e) [s, e] = [e, s];
    return { s, e };
  };

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
        const url = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        const total = pdfDoc.numPages;
        URL.revokeObjectURL(url);

        const { s, e } = normalizeRange(total);
        const pagesCount = e - s + 1;

        if (pagesCount > chunkSize && !confirmLarge) {
          setConfirmLarge(true);
          setBusy(false);
          return;
        }

        if (pdfToDocx) {
          await processPdfToDocxChunks(file, s, e, chunkSize);
          setIsExtracted(true);
        } else {
          setError("PDF uploaded. Enable 'PDF → Word' to extract to docx.");
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

  const processRangeToDocx = async (pdfDoc, fromPage, toPage, outName) => {
    const paragraphs = [];
    const total = toPage - fromPage + 1;

    for (let i = fromPage; i <= toPage; i++) {
      setProgress(Math.round(((i - fromPage) / total) * 100));
      const page = await pdfDoc.getPage(i);

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
          logger: () => {},
        });

        const extracted = ocrRes.data.text.trim();
        paragraphs.push(new Paragraph(extracted || ""));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.remove();
      }

      await new Promise((r) => setTimeout(r, 30));
    }

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

    const ranges = [];
    for (let p = from; p <= to; p += chunk) {
      const rStart = p;
      const rEnd = Math.min(p + chunk - 1, to);
      ranges.push([rStart, rEnd]);
    }

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

  const confirmAndProceed = () => {
    setConfirmLarge(false);
    setBusy(true);
    setTimeout(() => {
      handleExtract();
    }, 80);
  };

  // Drag & drop UX helpers
  const fileFieldRef = useRef(null);
  useEffect(() => {
    const el = fileFieldRef.current;
    if (!el) return;
    const onDragOver = (e) => {
      e.preventDefault();
      el.classList.add("drag");
    };
    const onDragLeave = () => el.classList.remove("drag");
    const onDrop = (e) => {
      e.preventDefault();
      el.classList.remove("drag");
      const f = e.dataTransfer.files?.[0];
      if (f) {
        // synthetic file change
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(f);
        handleChange({ target: { files: dataTransfer.files } });
      }
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="App" aria-live="polite">
      <style>{css}</style>

      <a
        href="https://github.com/killmong/imgToText"
        target="_blank"
        rel="noreferrer"
        className="github-icon"
        aria-label="View source on GitHub"
      >
        <FaGithub />
      </a>

      <main className="card" aria-label="OCR controls">
        <div className="header-row">
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="title">Image / PDF → Text</span>
              <span className="header-accent">Preview • OCR • Export</span>
            </div>
            <p className="lead">
              Upload images or PDFs — get clean, copyable text or Word (.docx).
            </p>
          </div>

          <button
            className="btn ghost"
            onClick={() => setShowModal(true)}
            title="Why scanned documents work best"
            aria-haspopup="dialog"
          >
            <FaInfoCircle />
          </button>
        </div>

        <div className="controls">
          <label className="switch" title="Convert PDF pages to .docx">
            <input
              type="checkbox"
              checked={pdfToDocx}
              onChange={(e) => setPdfToDocx(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>
              <strong>
                {pdfToDocx ? "PDF → Word: ON" : "PDF → Word: OFF"}
              </strong>
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
                style={{
                  marginLeft: 6,
                  width: 90,
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "transparent",
                  color: "#fff",
                }}
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
                style={{
                  marginLeft: 6,
                  width: 90,
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "transparent",
                  color: "#fff",
                }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Chunk
              <input
                type="number"
                min="1"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value || 30))}
                style={{
                  marginLeft: 6,
                  width: 90,
                  padding: 6,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "transparent",
                  color: "#fff",
                }}
              />
            </label>
          </div>
        </div>

        <div className="file-row">
          <div
            className="file-field"
            ref={fileFieldRef}
            role="group"
            aria-label="File selection"
          >
            <div className="file-placeholder">
              <span className="title">
                {file ? file.name : "Drop or select a file"}
              </span>
              <span className="sub">
                Supported: image/*, application/pdf — drag & drop supported
              </span>
            </div>
          </div>

          <label className="btn-upload" htmlFor="file">
            <span
              style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
            >
              {file ? "Replace" : "Upload"}
            </span>
            <input
              type="file"
              id="file"
              accept=".pdf,image/*"
              onChange={handleChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {img && (
          <div className="preview" aria-hidden={!img}>
            <img src={img} alt="Preview" />
          </div>
        )}

        <div className="actions">
          <button
            className="btn primary"
            onClick={handleExtract}
            disabled={busy || !file}
            aria-busy={busy}
          >
            {busy ? (
              `Working… (${progress}%)`
            ) : (
              <span className="glow">Start Extraction</span>
            )}
          </button>

          <button
            className="btn ghost"
            onClick={handleDelete}
            disabled={busy || !file}
          >
            Reset
          </button>

          <button
            className="btn"
            style={{
              flex: 0.7,
              background: "linear-gradient(90deg,var(--accent-2), #0b2b52)",
              color: "#fff",
              boxShadow: "0 8px 30px rgba(10,30,60,0.16)",
            }}
            onClick={saveAsWordFile}
            disabled={!text}
            title="Save extracted text to .docx"
          >
            Export Word
          </button>
        </div>

        <div className="progress-wrap" aria-hidden={!busy}>
          <div className="progress-track" aria-hidden={!busy}>
            <div
              className="progress-fill"
              style={{ width: `${busy ? progress : 0}%` }}
            />
          </div>
          <div className="progress-label">
            {busy ? `Processing: ${progress}%` : ""}
          </div>
          {error && (
            <div style={{ marginTop: 8, color: "#ff7070" }}>{error}</div>
          )}
        </div>
      </main>

      <aside
        className="card text-box"
        role="region"
        aria-label="Extracted text"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <h4>Extracted Text</h4>
          {isExtracted && (
            <div className="dog-container" title="Extraction complete">
              <div className="dog-badge">
                <img
                  className="dog-img"
                  src="freepik__background__73602.png"
                  alt="Success"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="extracted" tabIndex={0}>
          {text ? (
            text
          ) : (
            <span className="subtle">
              Your extracted text will appear here — select a file and click
              Start.
            </span>
          )}
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
      </aside>

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
              Best results: scanned / high-contrast documents
            </h3>
            <p className="small" style={{ marginTop: 8 }}>
              For multi-page PDFs this tool will attempt to extract text from
              each page. For long books (100+ pages), consider server-side
              processing for speed and reliability.
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
              Processing large ranges client-side may be slow and memory
              intensive.
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
