import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

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

function isValidOutputLanguage(language: unknown): language is OutputLanguage {
  return language === "English" || language === "Chinese" || language === "Dutch";
}

function isValidAnalysisResult(data: unknown): data is AnalysisResult {
  if (!data || typeof data !== "object") return false;

  const value = data as Partial<AnalysisResult>;

  return (
    typeof value.documentType === "string" &&
    typeof value.sender === "string" &&
    typeof value.needsAction === "boolean" &&
    typeof value.summary === "string" &&
    typeof value.actionNeeded === "string" &&
    Array.isArray(value.nextSteps) &&
    value.nextSteps.every((step) => typeof step === "string") &&
    typeof value.deadline === "string" &&
    (typeof value.deadlineDate === "string" || value.deadlineDate === null) &&
    (value.riskLevel === "low" ||
      value.riskLevel === "medium" ||
      value.riskLevel === "high" ||
      value.riskLevel === "unclear") &&
    typeof value.consequenceIfIgnored === "string" &&
    typeof value.suggestedReply === "string" &&
    Array.isArray(value.keyDutchWords) &&
    value.keyDutchWords.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.dutch === "string" &&
        typeof item.meaning === "string"
    ) &&
    typeof value.privacyWarning === "string"
  );
}

function containsChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function getUserFacingText(data: AnalysisResult) {
  return [
    data.documentType,
    data.sender,
    data.summary,
    data.actionNeeded,
    ...data.nextSteps,
    data.deadline,
    data.consequenceIfIgnored,
    data.suggestedReply,
    ...data.keyDutchWords.map((item) => item.meaning),
    data.privacyWarning,
  ].join("\n");
}

function buildSystemPrompt(outputLanguageInstruction: string) {
  return `
You are BriefBuddy NL, a careful assistant for people in the Netherlands who receive Dutch letters, emails, or official messages.

Your job:
- Explain the Dutch text in plain ${outputLanguageInstruction}.
- Identify the likely sender.
- Identify whether the user needs to take action.
- Identify deadlines.
- Extract a machine-readable deadline date only if there is a clear absolute date.
- Estimate practical risk level.
- Suggest 2 to 5 concrete next steps.
- Suggest a polite reply if useful.
- Explain key Dutch terms in ${outputLanguageInstruction}.

Language rules:
- The JSON property names must stay in English exactly as specified.
- All JSON string values shown to the user must be written in ${outputLanguageInstruction}.
- This includes documentType, sender, summary, actionNeeded, nextSteps, deadline, consequenceIfIgnored, suggestedReply, keyDutchWords.meaning, and privacyWarning.
- The only exception is keyDutchWords.dutch, which must keep the original Dutch word or phrase.
- If the selected output language is Simplified Chinese, do not write explanations in English.
- If the selected output language is Dutch, do not write explanations in English unless quoting the original message.
- The riskLevel value must remain one of these exact English enum values: "low", "medium", "high", "unclear".
- deadlineDate must remain null or a date string in YYYY-MM-DD format.

Important rules:
- Do not provide legal, medical, financial, tax, immigration, or housing advice as a professional.
- If the message appears legal, medical, immigration-related, debt-related, housing-related, or urgent, tell the user to contact the official sender or a qualified professional.
- Do not invent deadlines.
- Do not invent sender details.
- If the sender is unclear, use the equivalent of "Unclear" in ${outputLanguageInstruction}.
- If something is unclear, say it is unclear in ${outputLanguageInstruction}.
- Do not exaggerate risk.
- Encourage the user to remove private information such as BSN, IBAN, address, date of birth, phone number, email address, customer number, case number, and medical details.

Deadline date rules:
- "deadline" should describe the deadline in natural language using ${outputLanguageInstruction}.
- "deadlineDate" must be a string in YYYY-MM-DD format only when the letter contains a clear absolute date.
- If the text says only "within 14 days", "binnen 14 dagen", or another relative deadline without a document date, set "deadlineDate" to null.
- If there is no clear date, set "deadlineDate" to null.
- Never guess the current date.

Risk-level guidance:
- Use "low" when the message is mostly informational or no action seems required.
- Use "medium" when the user may need to reply, pay, attend, submit information, or act before a deadline.
- Use "high" only when the message suggests serious consequences, debt collection, legal escalation, eviction, immigration consequences, missed official deadlines, or urgent health/safety matters.
- Use "unclear" when the text does not contain enough information.

Return ONLY valid JSON in this exact shape:
{
  "documentType": "string",
  "sender": "string",
  "needsAction": true,
  "summary": "string",
  "actionNeeded": "string",
  "nextSteps": ["string"],
  "deadline": "string",
  "deadlineDate": "YYYY-MM-DD or null",
  "riskLevel": "low | medium | high | unclear",
  "consequenceIfIgnored": "string",
  "suggestedReply": "string",
  "keyDutchWords": [
    {
      "dutch": "string",
      "meaning": "string"
    }
  ],
  "privacyWarning": "string"
}
`;
}

function buildUserPrompt(text: string, outputLanguageInstruction: string) {
  return `
Analyze this Dutch letter/email/message.

Selected output language: ${outputLanguageInstruction}

Remember:
- Keep JSON keys in English.
- Write all user-facing JSON values in ${outputLanguageInstruction}.
- If the selected output language is Simplified Chinese, all explanations must be in Simplified Chinese.
- If the selected output language is Dutch, all explanations must be in Dutch.

Text to analyze:

${text}
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body.text;
    const language: OutputLanguage = isValidOutputLanguage(body.language)
      ? body.language
      : "English";

    const outputLanguageInstruction =
      language === "Chinese"
        ? "Simplified Chinese"
        : language === "Dutch"
        ? "Dutch"
        : "English";

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "Please provide text to analyze." },
        { status: 400 }
      );
    }

    if (text.length > 8000) {
      return Response.json(
        { error: "Text is too long. Please paste a shorter letter or email." },
        { status: 400 }
      );
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: "Missing DEEPSEEK_API_KEY in the environment variables." },
        { status: 500 }
      );
    }

    const completion = await client.chat.completions.create({
      // model: "deepseek-chat",
      model:"deepseek-v4-pro",
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(outputLanguageInstruction),
        },
        {
          role: "user",
          content: buildUserPrompt(text, outputLanguageInstruction),
        },
      ],
      response_format: {
        type: "json_object",
      },
    });

    const outputText = completion.choices[0]?.message?.content;

    if (!outputText) {
      return Response.json(
        { error: "No response was returned by the model." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    if (!isValidAnalysisResult(parsed)) {
      return Response.json(
        { error: "The analysis result was not in the expected format." },
        { status: 500 }
      );
    }

    if (language === "Chinese" && !containsChinese(getUserFacingText(parsed))) {
      return Response.json(
        {
          error:
            "The model did not return the analysis in Chinese. Please try again.",
        },
        { status: 500 }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Something went wrong while analyzing the text." },
      { status: 500 }
    );
  }
}