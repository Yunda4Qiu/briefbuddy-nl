# BriefBuddy NL

BriefBuddy NL is a small web app that helps people in the Netherlands understand Dutch letters, emails, PDFs, and official messages.

Users can paste Dutch text, take a photo, upload images, or upload PDFs. BriefBuddy extracts the text when needed and returns a plain-language action summary:

- What the message is about
- Who the likely sender is
- Whether action may be needed
- Suggested next steps
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
- What should I do next?

BriefBuddy NL focuses on turning Dutch formal communication into a clear action summary.

---

## Current MVP features

- Paste Dutch text into the web app
- Take a photo of a Dutch letter on mobile
- Choose one or more images from the device
- Choose one or more PDF files
- Add files in multiple rounds instead of selecting everything at once
- Remove individual selected files or clear all selected files
- Extract text from images and PDFs with Azure Document Intelligence
- Combine extracted text from multiple files into one analysis input
- Analyze extracted or pasted text with DeepSeek
- Choose output language: English, Chinese, or Dutch
- Return a structured explanation
- Display document type, likely sender, summary, action needed, next steps, deadline, risk level, consequence, suggested reply, and key Dutch words
- Detect whether action is likely needed
- Extract a machine-readable deadline date when the text contains a clear absolute date
- Download a calendar reminder when a clear deadline date is available
- Remove obvious private information before analysis
- Highlight replaced sensitive information in a preview
- Restore the original text after redaction if the user changes their mind
- Try the app with a built-in example
- Copy the suggested reply to the clipboard
- Give quick usefulness feedback after analysis
- Basic privacy reminder before submission

---

## OCR and document extraction

BriefBuddy NL uses Azure Document Intelligence to extract text from uploaded files.

Supported input types include:

- Photos taken on mobile
- Image files such as JPG, PNG, WEBP, HEIC, and TIFF
- PDF files
- Multiple images or PDFs in one workflow

The app sends selected files to a server-side OCR route, extracts the text, and places the extracted content into the textarea before analysis.

For multi-file uploads, the extracted text is grouped by file name so users can still see which text came from which document.

---

## Privacy-focused redaction

The current MVP includes a simple redaction helper for obvious private information, including:

- Dutch IBAN-like values
- Dutch phone numbers
- Email addresses
- 8–9 digit numbers that may be BSN-like identifiers

After redaction, the app shows a highlighted preview so users can see where replacements were made.

This is not a complete privacy protection system. Users should still review the extracted or pasted text carefully and remove sensitive information before submitting it for analysis.

---

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Azure Document Intelligence
- DeepSeek API
- OpenAI-compatible API client
- Vercel

---

## Model

This MVP currently uses DeepSeek for text analysis:

```ts
model: "deepseek-chat"
```

---

# Current limitations

BriefBuddy NL is an early MVP and currently has several limitations:

- OCR quality still depends on the quality of the photo or PDF
- Very blurry, dark, tilted, or low-resolution images may produce poor text extraction
- The privacy redaction is rule-based and may miss names, full addresses, dates of birth, customer numbers, case numbers, or medical details
- It does not store user history
- It does not yet support user accounts or saved documents
- It does not provide professional legal, medical, financial, tax, housing, or immigration advice
- It relies on model output, so users should verify important information with the official sender or a qualified professional

---

# In development

The next development steps are focused on making the app safer, clearer, and more useful for real users.

## Short-term improvements

- Improve the visual design of the result cards
-  Add clearer loading and error states for multi-file OCR
- Show per-file OCR status and failures more clearly
- Improve redaction to detect more sensitive patterns, such as dates of birth, customer numbers, case numbers, and addresses
- Add a safer privacy review flow before analysis
- Add localized UI labels for English, Chinese, and Dutch
- Improve handling of relative deadlines such as “within 14 days”
- Improve mobile layout for photo-based workflows

## Medium-term features

- Allow users to edit and confirm extracted text before analysis in a clearer review step
- Add better document-type-specific prompts for tax, housing, healthcare, municipality, immigration, and payment letters
- Add optional export of the full analysis as a text file
- Add browser extension support for selected text on web pages
- Add optional analytics or feedback storage to understand which outputs are useful
- Improve deadline extraction and calendar reminder generation

## Possible long-term direction

- A personal dashboard for saved explanations
- User accounts with optional history
- Organization version for universities, relocation agencies, and international offices
- Domain-specific modes, such as housing, healthcare, tax, university, and municipality letters
- Human-reviewed templates for common Dutch administrative messages
- Stronger enterprise document processing with field extraction and document classification