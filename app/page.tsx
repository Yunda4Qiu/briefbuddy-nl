"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

type OutputLanguage = "English" | "Chinese" | "Dutch";

type AnalysisResult = {
  documentType: string;
  sender: string;
  needsAction: boolean;
  summary: string;
  actionNeeded: string;
  nextSteps: string[];
  deadline: string;
  deadlineDate: string | null;
  riskLevel: "low" | "medium" | "high" | "unclear";
  consequenceIfIgnored: string;
  suggestedReply: string;
  keyDutchWords: {
    dutch: string;
    meaning: string;
  }[];
  privacyWarning: string;
};

type PreviewPart = {
  text: string;
  redacted: boolean;
};

type RedactionMatch = {
  start: number;
  end: number;
  replacement: string;
};

type SelectedFileItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const exampleText = `Geachte heer Qiu,

Volgens onze administratie staat er nog een bedrag open van €127,45 voor uw zorgverzekering.
Wij verzoeken u vriendelijk dit bedrag uiterlijk op 30-06-2026 over te maken.

Naam: Yunda Qiu
Adres: Teststraat 12, 1234 AB Amsterdam
Geboortedatum: 01-01-1995
BSN: 123456789
IBAN: NL91ABNA0417164300
Telefoonnummer: 0612345678
E-mailadres: yunda.test@example.com

Indien wij voor 30-06-2026 geen betaling ontvangen, kunnen er extra incassokosten in rekening worden gebracht.

Met vriendelijke groet,

Administratie ZorgTest Nederland`;

function redactPrivateInfoWithPreview(input: string) {
  const patterns: { regex: RegExp; replacement: string }[] = [
    {
      regex: /\bNL\d{2}[A-Z]{4}\d{10}\b/g,
      replacement: "[IBAN removed]",
    },
    {
      regex: /\b06[-\s]?\d{8}\b/g,
      replacement: "[phone number removed]",
    },
    {
      regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      replacement: "[email removed]",
    },
    {
      regex: /\b\d{8,9}\b/g,
      replacement: "[possible BSN removed]",
    },
  ];

  const matches: RedactionMatch[] = [];

  for (const pattern of patterns) {
    for (const match of input.matchAll(pattern.regex)) {
      if (match.index === undefined) continue;

      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: pattern.replacement,
      });
    }
  }

  const sortedMatches = matches
    .sort((a, b) => a.start - b.start)
    .filter((match, index, array) => {
      if (index === 0) return true;
      const previous = array[index - 1];
      return match.start >= previous.end;
    });

  let redactedText = "";
  const previewParts: PreviewPart[] = [];
  let currentIndex = 0;

  for (const match of sortedMatches) {
    const before = input.slice(currentIndex, match.start);

    if (before) {
      redactedText += before;
      previewParts.push({ text: before, redacted: false });
    }

    redactedText += match.replacement;
    previewParts.push({ text: match.replacement, redacted: true });

    currentIndex = match.end;
  }

  const after = input.slice(currentIndex);

  if (after) {
    redactedText += after;
    previewParts.push({ text: after, redacted: false });
  }

  return {
    redactedText,
    previewParts,
    replacementCount: sortedMatches.length,
  };
}

function isValidISODate(date: string | null): date is string {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function createICSContent(result: AnalysisResult) {
  if (!isValidISODate(result.deadlineDate)) return "";

  const date = result.deadlineDate.replaceAll("-", "");
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const title = "BriefBuddy NL deadline reminder";
  const description = [
    `Document type: ${result.documentType}`,
    `Sender: ${result.sender}`,
    `Action needed: ${result.actionNeeded}`,
    `Risk level: ${result.riskLevel}`,
  ]
    .join("\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BriefBuddy NL//Deadline Reminder//EN
BEGIN:VEVENT
UID:briefbuddy-${Date.now()}@briefbuddy-nl
DTSTAMP:${now}
DTSTART;VALUE=DATE:${date}
SUMMARY:${title}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read image file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Could not read image file."));
    };

    reader.readAsDataURL(file);
  });
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatFileSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function createFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function Home() {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const [text, setText] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>("English");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");

  const [originalTextBeforeRedaction, setOriginalTextBeforeRedaction] =
    useState<string | null>(null);

  const [highlightedPreview, setHighlightedPreview] = useState<PreviewPart[]>(
    []
  );

  const [copyStatus, setCopyStatus] = useState("");
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);

  async function analyzeText() {
    setLoading(true);
    setError("");
    setResult(null);
    setCopyStatus("");
    setFeedback(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze text.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function buildSelectedFileItems(files: File[]) {
    const validFiles = files.filter((file) => isImageFile(file) || isPdfFile(file));

    if (validFiles.length !== files.length) {
      setError("Some files were skipped. Please choose only image or PDF files.");
    } else {
      setError("");
    }

    const items: SelectedFileItem[] = [];

    for (const file of validFiles) {
      let previewUrl = "";

      if (isImageFile(file)) {
        try {
          previewUrl = await readFileAsDataURL(file);
        } catch {
          previewUrl = "";
        }
      }

      items.push({
        id: createFileId(file),
        file,
        previewUrl,
      });
    }

    return items;
  }

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const newItems = await buildSelectedFileItems(files);

    setSelectedFiles((current) => [...current, ...newItems]);
    setResult(null);
    setOcrStatus("");

    event.target.value = "";
  }

  async function extractTextFromFiles() {
    if (selectedFiles.length === 0) return;

    setOcrLoading(true);
    setError("");
    setResult(null);
    setHighlightedPreview([]);
    setOriginalTextBeforeRedaction(null);
    setOcrStatus(`Preparing ${selectedFiles.length} file(s)...`);

    const extractedSections: string[] = [];
    const failedFiles: string[] = [];

    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        const item = selectedFiles[index];

        setOcrStatus(
          `Extracting text from ${index + 1}/${selectedFiles.length}: ${
            item.file.name
          }`
        );

        const formData = new FormData();
        formData.append("file", item.file);

        const res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || !data.text || typeof data.text !== "string") {
          failedFiles.push(item.file.name);
          continue;
        }

        extractedSections.push(
          `--- ${item.file.name} ---\n${data.text.trim()}`
        );
      }

      if (extractedSections.length === 0) {
        throw new Error(
          "No text could be extracted from the selected files. Try clearer images or higher-quality PDFs."
        );
      }

      setText(extractedSections.join("\n\n"));

      if (failedFiles.length > 0) {
        setError(
          `Text was extracted from ${extractedSections.length} file(s), but these file(s) failed: ${failedFiles.join(
            ", "
          )}`
        );
      } else {
        setError("");
      }

      setOcrStatus(`Text extracted from ${extractedSections.length} file(s).`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while extracting text from the files."
      );
    } finally {
      setOcrLoading(false);
    }
  }

  function removeSelectedFile(id: string) {
    setSelectedFiles((current) => current.filter((item) => item.id !== id));
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
    setOcrStatus("");
  }

  function handleRedactPrivateInfo() {
    if (!text.trim()) return;

    const { redactedText, previewParts, replacementCount } =
      redactPrivateInfoWithPreview(text);

    if (replacementCount === 0) {
      setError("No obvious private information was found.");
      setHighlightedPreview([]);
      return;
    }

    setError("");
    setOriginalTextBeforeRedaction(text);
    setText(redactedText);
    setHighlightedPreview(previewParts);
  }

  function handleUndoRedaction() {
    if (!originalTextBeforeRedaction) return;

    setText(originalTextBeforeRedaction);
    setOriginalTextBeforeRedaction(null);
    setHighlightedPreview([]);
    setError("");
  }

  function handleUseExample() {
    setText(exampleText);
    setResult(null);
    setError("");
    setOriginalTextBeforeRedaction(null);
    setHighlightedPreview([]);
    setCopyStatus("");
    setFeedback(null);
  }

  async function handleCopyReply() {
    if (!result?.suggestedReply) return;

    try {
      await navigator.clipboard.writeText(result.suggestedReply);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Copy failed");
      window.setTimeout(() => setCopyStatus(""), 1800);
    }
  }

  function handleDownloadCalendarReminder() {
    if (!result || !isValidISODate(result.deadlineDate)) return;

    downloadTextFile(
      "briefbuddy-deadline.ics",
      createICSContent(result),
      "text/calendar;charset=utf-8"
    );
  }

  function riskBadgeClass(risk: string) {
    if (risk === "high") return "bg-red-100 text-red-800 border-red-200";
    if (risk === "medium")
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (risk === "low") return "bg-green-100 text-green-800 border-green-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  }

  function actionBadgeClass(needsAction: boolean) {
    return needsAction
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <section className="mb-8 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Dutch letter helper
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            BriefBuddy NL
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Paste, photograph, or upload Dutch letters. Get a plain-language
            action summary.
          </p>
        </section>

        <section className="mb-5 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Photo, image, or PDF upload
              </h2>
              <p className="mt-2 text-xs text-slate-400">
                For privacy, review the extracted text and remove sensitive
                details before analysis.
              </p>
            </div>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFilesSelected}
          />

          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="
                rounded-xl border border-slate-300 bg-white px-4 py-3
                font-medium text-slate-700 shadow-sm transition-all duration-150
                hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md
                active:translate-y-0 active:bg-slate-100 active:shadow-sm
              "
            >
              Take photo
            </button>

            <button
              onClick={() => imageInputRef.current?.click()}
              className="
                rounded-xl border border-slate-300 bg-white px-4 py-3
                font-medium text-slate-700 shadow-sm transition-all duration-150
                hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md
                active:translate-y-0 active:bg-slate-100 active:shadow-sm
              "
            >
              Add images
            </button>

            <button
              onClick={() => pdfInputRef.current?.click()}
              className="
                rounded-xl border border-slate-300 bg-white px-4 py-3
                font-medium text-slate-700 shadow-sm transition-all duration-150
                hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md
                active:translate-y-0 active:bg-slate-100 active:shadow-sm
              "
            >
              Add PDFs
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Selected files
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedFiles.length} file(s) selected
                  </p>
                </div>

                <button
                  onClick={clearSelectedFiles}
                  className="
                    rounded-lg border border-slate-300 bg-white px-3 py-1.5
                    text-sm font-medium text-slate-700 transition-all duration-150
                    hover:border-slate-400 hover:bg-slate-50
                    active:bg-slate-100
                  "
                >
                  Remove all
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {item.file.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {isPdfFile(item.file) ? "PDF" : "Image"} ·{" "}
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>

                      <button
                        onClick={() => removeSelectedFile(item.id)}
                        className="
                          rounded-lg border border-slate-300 bg-white px-3 py-1.5
                          text-xs font-medium text-slate-700 transition-all
                          hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100
                        "
                      >
                        Remove
                      </button>
                    </div>

                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt="Selected letter preview"
                        className="mt-3 max-h-56 w-full rounded-xl border border-slate-200 object-contain"
                      />
                    ) : (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        PDF selected. Preview is not shown, but text can be
                        extracted.
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={extractTextFromFiles}
                disabled={ocrLoading || selectedFiles.length === 0}
                className="
                  mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white shadow-sm
                  transition-all duration-150
                  hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-md
                  active:translate-y-0 active:bg-slate-950 active:shadow-sm
                  disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none
                  disabled:hover:translate-y-0
                "
              >
                {ocrLoading
                  ? "Extracting text..."
                  : `Extract text from ${selectedFiles.length} file(s)`}
              </button>

              {(ocrLoading || ocrStatus) && (
                <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                  {ocrStatus || "Preparing OCR..."}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Dutch letter, email, or message
              </label>

              <p className="mt-1 text-sm text-slate-500">
                Remove private information such as BSN, IBAN, address, date of
                birth, phone number, and medical details before submitting.
              </p>
            </div>

            <div className="shrink-0">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Output language
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value as OutputLanguage);
                  setResult(null);
                  setError("");
                  setCopyStatus("");
                  setFeedback(null);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-200 sm:w-36"
              >
                <option value="English">English</option>
                <option value="Chinese">Chinese</option>
                <option value="Dutch">Dutch</option>
              </select>
            </div>
          </div>

          <textarea
            className="mt-4 h-64 w-full rounded-xl border border-slate-300 p-4 text-sm outline-none transition-colors duration-150 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="Paste Dutch text here, or extract text from uploaded images/PDFs..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setHighlightedPreview([]);
              setOriginalTextBeforeRedaction(null);
              setResult(null);
              setCopyStatus("");
              setFeedback(null);
            }}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button
              onClick={handleUseExample}
              className="
                rounded-xl border border-slate-300 bg-white px-4 py-3
                font-medium text-slate-700 shadow-sm transition-all duration-150
                hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md
                active:translate-y-0 active:bg-slate-100 active:shadow-sm
              "
            >
              Try example
            </button>

            <button
              onClick={handleRedactPrivateInfo}
              disabled={!text.trim()}
              className="
                rounded-xl border border-amber-300 bg-amber-50 px-4 py-3
                font-medium text-amber-900 shadow-sm transition-all duration-150
                hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-100 hover:shadow-md
                active:translate-y-0 active:bg-amber-200 active:shadow-sm
                disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100
                disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0
              "
            >
              Remove private info
            </button>

            <button
              onClick={analyzeText}
              disabled={loading || text.trim().length < 10}
              className="
                rounded-xl bg-slate-900 px-4 py-3 font-medium text-white shadow-sm
                transition-all duration-150
                hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-md
                active:translate-y-0 active:bg-slate-950 active:shadow-sm
                disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none
                disabled:hover:translate-y-0
              "
            >
              {loading ? "Analyzing..." : `Explain in ${language}`}
            </button>
          </div>

          {originalTextBeforeRedaction && (
            <button
              onClick={handleUndoRedaction}
              className="
                mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3
                font-medium text-slate-700 shadow-sm transition-all duration-150
                hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md
                active:translate-y-0 active:bg-slate-100 active:shadow-sm
              "
            >
              Undo redaction and restore original text
            </button>
          )}

          {highlightedPreview.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-amber-950">
                  Redacted preview
                </h3>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                  Highlighted parts were replaced
                </span>
              </div>

              <div className="whitespace-pre-wrap rounded-xl border border-amber-100 bg-white p-4 text-sm leading-6 text-slate-800">
                {highlightedPreview.map((part, index) =>
                  part.redacted ? (
                    <mark
                      key={index}
                      className="rounded-md bg-yellow-200 px-1 py-0.5 text-slate-900"
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={index}>{part.text}</span>
                  )
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        {result && (
          <section className="mt-8 space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Document type</p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {result.documentType}
                  </h2>

                  <p className="mt-3 text-sm text-slate-500">Sender</p>
                  <p className="font-medium text-slate-800">{result.sender}</p>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${riskBadgeClass(
                      result.riskLevel
                    )}`}
                  >
                    {result.riskLevel.toUpperCase()} RISK
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${actionBadgeClass(
                      result.needsAction
                    )}`}
                  >
                    {result.needsAction ? "ACTION NEEDED" : "NO CLEAR ACTION"}
                  </span>
                </div>
              </div>
            </div>

            <ResultCard title="Summary" content={result.summary} />
            <ResultCard title="Action needed" content={result.actionNeeded} />

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">
                Next steps
              </h3>

              {result.nextSteps.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No clear next steps found.
                </p>
              ) : (
                <ol className="list-decimal space-y-2 pl-5 text-slate-700">
                  {result.nextSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">
                    Deadline
                  </h3>
                  <p className="whitespace-pre-wrap text-slate-700">
                    {result.deadline}
                  </p>
                </div>

                {isValidISODate(result.deadlineDate) && (
                  <button
                    onClick={handleDownloadCalendarReminder}
                    className="
                      rounded-xl border border-blue-300 bg-blue-50 px-4 py-2
                      text-sm font-medium text-blue-800 shadow-sm transition-all
                      hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md
                      active:translate-y-0 active:bg-blue-200 active:shadow-sm
                    "
                  >
                    Add to calendar
                  </button>
                )}
              </div>
            </div>

            <ResultCard
              title="What happens if ignored?"
              content={result.consequenceIfIgnored}
            />

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Suggested reply
                </h3>

                <button
                  onClick={handleCopyReply}
                  className="
                    rounded-lg border border-slate-300 bg-white px-3 py-1.5
                    text-sm font-medium text-slate-700 transition-all duration-150
                    hover:border-slate-400 hover:bg-slate-50
                    active:bg-slate-100
                  "
                >
                  {copyStatus || "Copy"}
                </button>
              </div>

              <p className="whitespace-pre-wrap text-slate-700">
                {result.suggestedReply}
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">
                Key Dutch words
              </h3>

              {result.keyDutchWords.length === 0 ? (
                <p className="text-sm text-slate-600">No key words found.</p>
              ) : (
                <div className="space-y-2">
                  {result.keyDutchWords.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <p className="font-medium text-slate-900">{item.dutch}</p>
                      <p className="text-sm text-slate-600">{item.meaning}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="rounded-2xl border bg-white p-4 text-sm text-slate-500 shadow-sm">
              {result.privacyWarning}
            </p>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Was this useful?
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Your feedback helps improve the next version.
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setFeedback("yes")}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    feedback === "yes"
                      ? "border-green-300 bg-green-100 text-green-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Yes
                </button>

                <button
                  onClick={() => setFeedback("no")}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    feedback === "no"
                      ? "border-red-300 bg-red-100 text-red-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  No
                </button>
              </div>

              {feedback && (
                <p className="mt-3 text-sm text-slate-600">
                  Thanks for the feedback.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ResultCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="whitespace-pre-wrap text-slate-700">{content}</p>
    </div>
  );
}