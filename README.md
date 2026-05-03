# BriefBuddy NL

BriefBuddy NL is a small web app that helps people in the Netherlands understand Dutch letters, emails, and official messages.

Users paste Dutch text into the app, and BriefBuddy returns a plain-language action summary:

- What the message is about
- What action may be needed
- Whether there is a deadline
- The practical risk level
- What may happen if the message is ignored
- A polite suggested reply
- Key Dutch words and meanings

The goal is not to replace official advice, but to help users quickly understand what a Dutch message wants from them.

Live demo: https://briefbuddy-nl.vercel.app/

---

## Why this app exists

Many international residents in the Netherlands receive Dutch letters from municipalities, tax authorities, housing providers, healthcare providers, universities, insurers, or collection agencies.

Translation tools can translate the text, but they often do not clearly answer:

- Do I need to do something?
- Is there a deadline?
- Is this urgent?
- What happens if I ignore it?
- How can I reply politely?

BriefBuddy NL focuses on turning Dutch formal communication into a clear action summary.

---

## Current MVP features

## Current MVP features

- Paste Dutch text into the web app
- Analyze the text with DeepSeek
- Choose output language: English, Chinese, or Dutch
- Return a structured explanation
- Display results in clear cards
- Show document type, summary, action needed, deadline, risk level, consequence, suggested reply, and key Dutch words
- Remove obvious private information before analysis
- Highlight replaced sensitive information in a preview
- Restore the original text after redaction if the user changes their mind
- Try the app with a built-in example
- Copy the suggested reply to the clipboard
- Give quick usefulness feedback after analysis
- Basic privacy reminder before submission

---

## Privacy-focused redaction

The current MVP includes a simple redaction helper for obvious private information, including:

- Dutch IBAN-like values
- Dutch phone numbers
- Email addresses
- 8–9 digit numbers that may be BSN-like identifiers

After redaction, the app shows a highlighted preview so users can see where replacements were made.

This is not a complete privacy protection system. Users should still review the text carefully and remove sensitive information before submitting it.

---

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- DeepSeek API
- OpenAI-compatible API client
- Vercel

---

## Model

This MVP currently uses:

```ts
model: "deepseek-chat"
```

---

# Current limitations

BriefBuddy NL is an early MVP and currently has several limitations:

- It only supports pasted text
- It does not yet support image upload or PDF upload
- The privacy redaction is rule-based and may miss names, addresses, dates of birth, customer numbers, case numbers, or medical details
- It does not store user history
- It does not provide professional legal, medical, financial, tax, housing, or immigration advice
- It relies on model output, so users should verify important information with the official sender or a qualified professional

---

# In development

The next development steps are focused on making the app more useful, safer, and easier to use.

--- 

## Short-term improvements

- Improve the visual design of the result cards
- Add clearer loading and error states
- Add copy buttons for suggested replies
- Add a feedback button for users to mark whether the explanation was useful
- Improve the redaction helper to detect more sensitive patterns
- Add support for Dutch date and deadline extraction
- Add a simple landing section explaining who the app is for

## Medium-term features

--- 

- Image upload with OCR
- PDF upload and text extraction
- Multi-language output options
- More precise risk-level rules for payment reminders, tax letters, municipality letters, healthcare letters, housing messages, and immigration-related messages
- Export deadline to calendar
- Browser extension for selected text on web pages
- Safer review flow before submitting sensitive text

## Possible long-term direction

--- 

- A personal dashboard for saved explanations
- User accounts with optional history
- Organization version for universities, relocation agencies, and international offices
- Domain-specific modes, such as housing, healthcare, tax, university, and municipality letters
- Human-reviewed templates for common Dutch administrative messages