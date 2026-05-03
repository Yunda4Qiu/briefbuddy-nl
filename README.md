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

The goal is not to replace official advice, but to help users quickly understand what the message wants from them.

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

## Tech stack

- [Next.js](https://nextjs.org/)
- React
- TypeScript
- Tailwind CSS
- DeepSeek API
- OpenAI-compatible API client

---

## Current MVP features

- Paste Dutch text
- Analyze the text with DeepSeek
- Return structured JSON
- Display the result in clear cards
- Show document type, summary, action, deadline, risk level, consequence, reply template, and key Dutch words
- Basic privacy reminder before submission

---

## Model

This MVP currently uses:

```ts
model: "deepseek-chat"