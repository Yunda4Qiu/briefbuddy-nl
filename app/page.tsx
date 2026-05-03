"use client";

import { useState } from "react";

type AnalysisResult = {
  documentType: string;
  summary: string;
  actionNeeded: string;
  deadline: string;
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

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [originalTextBeforeRedaction, setOriginalTextBeforeRedaction] =
    useState<string | null>(null);

  const [highlightedPreview, setHighlightedPreview] = useState<PreviewPart[]>(
    []
  );

  async function analyzeText() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
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

  function riskBadgeClass(risk: string) {
    if (risk === "high") return "bg-red-100 text-red-800 border-red-200";
    if (risk === "medium")
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (risk === "low") return "bg-green-100 text-green-800 border-green-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <section className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            BriefBuddy NL
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Paste a Dutch letter or email. Get a plain-language action summary.
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Dutch letter, email, or message
          </label>

          <p className="mt-1 text-sm text-slate-500">
            Remove private information such as BSN, IBAN, address, date of
            birth, phone number, and medical details before submitting.
          </p>

          <textarea
            className="mt-4 h-64 w-full rounded-xl border border-slate-300 p-4 text-sm outline-none transition-colors duration-150 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="Paste Dutch text here..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setHighlightedPreview([]);
              setOriginalTextBeforeRedaction(null);
            }}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              Remove obvious private info
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
              {loading ? "Analyzing..." : "Explain this letter"}
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Document type</p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {result.documentType}
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${riskBadgeClass(
                    result.riskLevel
                  )}`}
                >
                  {result.riskLevel.toUpperCase()} RISK
                </span>
              </div>
            </div>

            <ResultCard title="Summary" content={result.summary} />
            <ResultCard title="Action needed" content={result.actionNeeded} />
            <ResultCard title="Deadline" content={result.deadline} />
            <ResultCard
              title="What happens if ignored?"
              content={result.consequenceIfIgnored}
            />
            <ResultCard title="Suggested reply" content={result.suggestedReply} />

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