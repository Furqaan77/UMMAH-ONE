# Build Decisions (website + app)

Answers from the build question round, 10 November 2026. Skipped questions are in SKIPPED_QUESTIONS.md.

| # | Topic | Decision |
|---|---|---|
| 1 | Screens | Chat plus separate screens later. **For now: chatbot only** (Q4) |
| 2 | Builds | Two separate builds: website in Next.js, mobile app separately |
| 3 | App | React Native + Expo (iOS and Android), TypeScript |
| 5 | Content | None yet. Use sample data marked "sample, to verify"; real content added later |
| 6 | AI model | Qwen running locally. **Changes prompt.md** (which said Claude first) |
| 7 | Model runner | Ollama |
| 8 | Model size | Chosen: Qwen 7B/8B. **This Mac (M3, 8 GB) runs Qwen3 4B Instruct, with Qwen2.5-VL 3B for photos.** Model name is a setting |
| 9 | Login and database | Supabase (phone OTP needs an SMS provider such as Twilio behind it; test code until then) |
| 10 | Logo | Star + "1" + path logo, English and Arabic wordmark. Save it at brand/logo.png. Name and logo still need a lawyer's check (to verify) |
| 11 | Code location | Inside this repo: `website/` and `app/` |
| 12 | Chat history | Saved in Supabase for logged-in users; users can delete it (GDPR) |
| 13 | Model hosting | On the owner's machine for testing; choose a server before launch |
| 14 | Build order | Website chat first, then the app |
| 15 | Line above each answer | "Sources used (N) >", which opens the sources |
| 16 | Language | Automatic (reply in the user's language; screen follows the browser) plus a language button in the menu. Arabic is right-to-left |
| 17 | 👍 👎 | Saved for team review; 👎 asks "What was wrong?" |
| 18 | + button | Quick options (Plan a trip, Find a university, Find a business) plus photo upload |
| 19 | Mic | Shown now, using the browser's free speech-to-text |

## Later decisions (10 Nov 2026)
- 6 travel places removed for safety: Grozny, Makhachkala, Derbent (Russia), Srinagar (India), Erbil (Iraq), Lahore (Pakistan). The list is now 81.
- After the website, the mobile app was built next. Login waits for Supabase keys and an SMS sender.
- The app uses the website's backend, so both give the same answers.

## Travel data (11 Nov 2026)
- Travel answers now use the team's "Halal Travel — 81 City Guides", saved at `website/data/travel/ALL-81-CITIES.md`. Marked "to verify".
- Two files were given: a PDF (10 Nov) and a Markdown copy (11 Nov). The Markdown copy is used: it is newer, adds the ratings (calm, character, energy), and is easier for the computer to read.
- Each city gives the AI: overview + halal food line + ratings, and 20 things to do. Each region also has a ratings table, so the AI can compare cities.
- None of the 6 removed places is in the guides.
- Other categories (education, culture, food, clothes, heritage, handicrafts, business) will be added later by the team.

## Food data and halal rule (11 Nov 2026)
- Food answers use the team's "Halal Food — 81 Cities.pdf" (5 dishes per city), saved at `website/data/food/`. Marked "to verify".
- **Halal rule (Furqaan):** never include food that might involve alcohol, pork or anything haram. At ingest, any dish or activity that names pork, alcohol, a dish known to contain them (e.g. buzara, black risotto) or an alcohol venue (pub, beach club, rooftop lounge) is removed and listed in the report. Prose that warns travellers ("some stalls use pork") is kept. The AI is also told never to recommend haram food or drink.
- Removed on 11 Nov: Kotor black risotto and buzara mussels, Bali ayam betutu, Dubai rooftop lounge/beach club, Kotor konoba item and one Kotor food sentence.
- Lists to extend: `website/lib/rag/haram.ts`.

## Design (from the Qwen chat screenshots)
- Plain white background; large, bold, dark text; long answers in short paragraphs
- Top bar: ☰ menu (left), "Ummah One" title (centre-left), new-chat icon (right)
- User message: light grey rounded bubble, on the right
- AI answer: plain text with no bubble; "Sources used (N) >" line above it
- Actions under each answer: copy, 👍, 👎, share, retry, more (…)
- Round floating scroll button on the right, above the input bar
- Input bar: rounded, light grey, with + on the left, mic, and a round send button
