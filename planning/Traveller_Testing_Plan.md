# Ummah One — Traveller Testing Plan

16 Nov 2026 · For the Ummah One team · Short and simple

## 1. Goal

Check that the chatbot's city guides are correct, using people who have **really travelled** to our cities. Mr Tanveer approves every change, and only approved facts go into the chatbot.

## 2. Who

| Item | Plan |
|---|---|
| Testers | 50–100 people who have travelled to one or more of our 81 cities |
| Rule | Only answer about cities you have visited |
| Language | English or Arabic |
| Privacy | Anonymous: no name, email or phone number is asked. Testers are asked not to write personal details. |

## 3. What testers do

| Part | Link | What they do |
|---|---|---|
| A. Chatbot | https://debate-rehab-rumor.ngrok-free.dev | Ask about cities they visited. Tap thumbs up or thumbs down, or "Report a problem". Rate how the city felt. |
| B. Questionnaire | https://debate-rehab-rumor.ngrok-free.dev/check | Check the guide's own facts for each city they visited, about 5–10 minutes per city (estimate) |

The link is **temporary**: it changes if it is restarted. Always send the latest link.

## 4. The questionnaire (for each city)

- City, and the month and year of the visit
- **1. Things to do:** each item from the guide is Correct, Wrong, Not open or Don't know
- **2. What to buy and where:** Correct, Wrong or Don't know
- **3. Halal food:** easy, OK or hard to find
- **4. Ease of visit:** each score out of 10 feels right, Easier or Harder
- **5. How the city felt:** Very boring, Boring, Enjoyable or Most enjoyable
- "What's missing?" box in each part, and free writing at the end

## 5. Steps

| # | Step | Who |
|---|---|---|
| 1 | Pilot: send the links to 5 testers and fix anything confusing | Bushra |
| 2 | Send the links to all 50–100 testers. Spread the invites over a few days if possible. | Bushra |
| 3 | Collect the answers (saved automatically) | Website |
| 4 | Summary: where testers agree or disagree on each item | Claude |
| 5 | Check and approve the changes | Mr Tanveer |
| 6 | Add only the approved facts to the chatbot, then test it | Claude |

A fact is "likely true" when 3 or more testers agree (estimate; we can change this number). Disagreements go to Mr Tanveer.

## 6. Rules

- Nothing goes into the chatbot until Mr Tanveer has checked it.
- Halal only: no alcohol, pork or anything haram. No music for Saudi Arabia, Qatar and Kuwait.
- Answers are anonymous and stored on the Ummah One PC.

## 7. Good to know

- The chatbot runs on the Ummah One PC. **The PC must stay on** during the test.
- Testers see an ngrok warning page once. They click **"Visit Site"** to continue.
- If many people ask at the same moment, answers can be slower (estimate).
- The AI can make mistakes. That is why testers check it.

## 8. Still to build

- A team screen that sums up the answers (agree or disagree per item), for Mr Tanveer to review
- Later, a permanent link on a proper server, before launch
