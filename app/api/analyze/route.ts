import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

type OutputLanguage = "English" | "Chinese" | "Dutch";

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

function isValidOutputLanguage(language: unknown): language is OutputLanguage {
  return language === "English" || language === "Chinese" || language === "Dutch";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body.text;
    const language: OutputLanguage = isValidOutputLanguage(body.language)
      ? body.language
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
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `
You are BriefBuddy NL, a careful assistant for people in the Netherlands who receive Dutch letters, emails, or official messages.

Your job:
- Explain the Dutch text in plain ${language}.
- Identify what the user needs to do.
- Identify deadlines.
- Estimate practical risk level.
- Suggest a polite reply if useful.
- Explain key Dutch terms in ${language}.

Important rules:
- Return all user-facing explanations in ${language}.
- Keep the suggested reply in English unless the original message clearly requires Dutch.
- Do not provide legal, medical, financial, tax, immigration, or housing advice as a professional.
- If the message appears legal, medical, immigration-related, debt-related, housing-related, or urgent, tell the user to contact the official sender or a qualified professional.
- Do not invent deadlines.
- If something is unclear, say it is unclear.
- Do not exaggerate risk.
- Encourage the user to remove private information such as BSN, IBAN, address, date of birth, phone number, email address, customer number, case number, and medical details.

Risk-level guidance:
- Use "low" when the message is mostly informational or no action seems required.
- Use "medium" when the user may need to reply, pay, attend, submit information, or act before a deadline.
- Use "high" only when the message suggests serious consequences, debt collection, legal escalation, eviction, immigration consequences, missed official deadlines, or urgent health/safety matters.
- Use "unclear" when the text does not contain enough information.

Return ONLY valid JSON in this exact shape:
{
  "documentType": "string",
  "summary": "string",
  "actionNeeded": "string",
  "deadline": "string",
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
          `,
        },
        {
          role: "user",
          content: `
Analyze this Dutch letter/email/message:

${text}
          `,
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

    const parsed: AnalysisResult = JSON.parse(outputText);

    return Response.json(parsed);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Something went wrong while analyzing the text." },
      { status: 500 }
    );
  }
}