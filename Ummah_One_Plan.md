# Ummah One — AI Guide Product Plan

Generated from prompt.md · 5 November 2026 · Draft for internal leadership

## 1. Mission and the 3X goal

| Item | Plan |
|---|---|
| Mission | Grow the Muslim economy **3X by 2034** (7 years from launch in 2027) |
| Measure | Total GDP of OIC Muslim countries |
| Reality check | 3X in 7 years needs about **17% growth every year** |
| Our role | 3X is the mission. Ummah One does not claim a share; it tracks its own numbers beside it |
| Areas we grow | Travel and tourism, education, culture, art, food and snacks, clothes and fashion, heritage, music, palaces, Muslim businesses |
| Money | No revenue planning for now |

## 2. What Ummah One is, and who it serves

- **One AI engine (RAG)** that powers the Ummah One app and also runs as a standalone product.
- Encourages well-to-do Muslims to travel to the **81 Muslim cities**, matched to their preferences.
- Points students to the **18 education cities**. Helps people discover and support **Muslim businesses and artists**.
- Open to everyone, including non-Muslims. Under-18s have full access.
- Mobile app, website and WhatsApp bot. English and Arabic at launch. Voice input later.

| Priority | User | What they get |
|---|---|---|
| 1 | Muslim businesses | Free profile: crafts, carpets and calligraphy; modest fashion; art; music and performers; perfume |
| 2 | Contributors | Add places and content; earn badges and levels (local guides, artists, businesses, travellers) |
| 3 | Families and travellers | City recommendations for every group; women-traveller features from day one |
| 4 | Students, from everywhere | Universities in the 18 cities, with estimated fees and living costs |
| – | Well-wishers | Elders, imams and mosque members who recommend places |

## 3. Product

| Part | What it includes | Not included |
|---|---|---|
| City pages (81) | Halal food; safety; budget; best season; family- and women-friendly ratings; heritage, palaces and museums; culture, art and music; local food and snacks; clothes, fashion and markets; Muslim businesses; wheelchair and elderly access; events calendar; safety disclaimer on every page | Mosques and prayer times; visas; prices; maps; itineraries; group trips; Umrah add-ons |
| Labels | **Halal-friendliness** label: Bali, Kotor, Budva, Podgorica, Ohrid. **Removed for safety** (terrorism / extreme violence): Grozny, Makhachkala, Derbent (Russia); Srinagar (India); Erbil (Iraq); Lahore (Pakistan) | – |
| Businesses and artists | Free listing for now; location and contact; individual artists and craftspeople get profiles; trust grows through verified customer reviews; owners can reply. Music: all music by Muslim artists | Online shop links |
| Education (18 cities) | All good universities; undergraduate, master's/PhD, medicine, short courses; estimated fees and living costs (estimate); information only | Scholarships; application help |
| Recommendations | AI asks: budget, month, interests, travel style, number of days (students: field and level). Ranking: **interests and budget, then safety, then heritage and culture, then halal-friendliness**. Always shows **why** and **sources** | – |
| Feedback and trust | Phone OTP login. Travel reviews need a photo taken at the place. Anonymous reviews allowed. Badges and levels. **The Ummah One team can override anything; user feedback comes second.** No sectarian or political content | Proof of study for university reviews |

## 4. How the RAG works

**Trusted sources → Knowledge base → AI guide → User → Verified feedback → team review → back into the knowledge base**

- **Sources:** official tourism websites, UNESCO, university websites, QS/THE, team research, verified user reviews and photos, contributor and well-wisher content. No Wikipedia.
- **Answers:** only from the knowledge base, always with sources.
- **Model path:** Claude on the cloud first, then Qwen or Llama on our own servers. The design is model-agnostic.
- **Updates:** content changes when a change is reported.
- **Build:** from scratch with BMAD and Claude Code. AI hosting under $50,000 in year 1.

## 5. Mosque promotion

| Item | Plan |
|---|---|
| Where | Mosques with average family income **above $60,000** (leadership decides). USA, UK, Canada, Western Europe, Singapore, high-income areas of Pakistan, Malaysia and Indonesia |
| Start with | Existing contacts: Los Angeles, London, Chicago, Michigan, Kuala Lumpur, Singapore, Kansas |
| Year-1 target | **50 mosques** |
| Outreach | Video calls, our own network, elders who know the imams |
| Inside the mosque | QR posters on notice boards; the mosque's WhatsApp group or newsletter; separate messages for women's and youth groups. Nothing sold inside the prayer hall |
| Partners | Mosques only. No universities, tourism boards, airlines or halal bodies |
| Approvals | No scholar approval needed. Mosques get nothing extra |

## 6. Timeline

| When | Step |
|---|---|
| Weeks 1–2 (Nov 2026) | BMAD planning: brief, requirements, architecture. Page templates for cities, universities, businesses and artists |
| Weeks 3–6 (to mid-Dec) | AI drafts 81 city pages and 18 education cities from approved sources; travel experts review; load into the knowledge base |
| Weeks 7–10 (to mid-Jan) | App, website and WhatsApp bot; OTP login; photo-checked reviews; badges; team override; English and Arabic |
| Weeks 11–12 (late Jan) | Test with contact mosques (QR posters, WhatsApp); fix issues |
| **Early Feb 2027** | **First version live** |
| 2027 | 50 mosques; report the six year-1 numbers |
| 2028 | Move to our own servers (Qwen or Llama); voice input |
| 2029–2034 | Grow mosques across all chosen countries (targets to set); check OIC GDP against 3X every year |

## 7. Year-1 numbers

| # | Number | How we measure it |
|---|---|---|
| 1 | Money spent in the 81 cities | Each city's official economic data (tourism revenue, GDP), shown beside our verified trips |
| 2 | Muslim businesses listed and visited | Live profiles; verified customer reviews |
| 3 | Students who applied to the 18 cities | Users reporting an application |
| 4 | Verified reviews | OTP login plus a photo |
| 5 | Active users | Monthly active users across app, web and WhatsApp |
| 6 | Verified trips taken | Trips confirmed by a photo review |

## 8. The 81 travel cities

[H] = halal-friendliness label

| Region | Cities |
|---|---|
| Middle East and Gulf (18) | Dubai, Abu Dhabi, Sharjah, AlUla, Jeddah, Riyadh, Abha, Al Ahsa, Doha, Muscat, Salalah, Manama, Kuwait City, Amman, Aqaba, Baku, Ganja, Dammam |
| Türkiye (13) | Istanbul, Cappadocia/Göreme, Antalya, Bodrum, Pamukkale, Fethiye, Izmir, Trabzon, Bursa, Marmaris, Alanya, Konya, Ankara |
| Balkans (11) | Kotor [H], Budva [H], Mostar, Sarajevo, Ohrid [H], Skopje, Tirana, Prizren, Pristina, Podgorica [H], Tetovo |
| North Africa (12) | Marrakesh, Essaouira, Cairo, Sharm El Sheikh, Hurghada, Alexandria, Tangier, Rabat, Casablanca, Tunis, Djerba, Sousse |
| Central Asia (10) | Samarkand, Bukhara, Almaty, Tashkent, Khiva, Astana, Bishkek, Turkistan, Dushanbe, Shymkent |
| Southeast and South Asia (9) | Bali [H], Langkawi, Kuala Lumpur, Penang, Yogyakarta, Baa Atoll, Malé, Hunza Valley, Skardu |
| East Africa (1) | Zanzibar City / Stone Town |
| Thailand (2) | Satun, Koh Lanta |
| India (4) | Kozhikode, Lakshadweep, Hyderabad, Lucknow |
| Russia (1) | Kazan |

Corrections before publishing:
- Lucknow is about 26% Muslim (city, 2011 census), not 40%.
- Hyderabad is about 30% (city) and 43% (district).
- Satun is 68–77% Muslim, depending on the source.
- No verified figure was found for Koh Lanta.

## 9. The 18 education cities (ranked)

| # | City | Flagship institutions |
|---|---|---|
| 1 | Kuala Lumpur | Universiti Malaya (QS 2026: 58th; QS 2027: 56th) |
| 2 | Istanbul | ITU, Boğaziçi, Istanbul University, Koç, Sabancı |
| 3 | Riyadh | King Saud University, Princess Nourah University |
| 4 | Dhahran / Dammam | KFUPM (QS 2026: 67th) |
| 5 | Ankara | METU, Bilkent |
| 6 | Doha | Education City (Weill Cornell Medicine–Qatar, Texas A&M at Qatar), Qatar University |
| 7 | Abu Dhabi | Khalifa University, NYU Abu Dhabi |
| 8 | Penang | Universiti Sains Malaysia |
| 9 | Cairo | Cairo University, Ain Shams University |
| 10 | Astana | Nazarbayev University (THE 2026: 401–500), Astana Medical University |
| 11 | Almaty | Al-Farabi KazNU, Kazakh National Medical University |
| 12 | Dubai | MBRU, Dubai Medical College, branch campuses |
| 13 | İzmir | IZTECH, Ege University |
| 14 | Amman | University of Jordan, JUST |
| 15 | Baku | Baku State University, Azerbaijan Medical University |
| 16 | Alexandria | Alexandria University |
| 17 | Tashkent | National University of Uzbekistan, Tashkent Pediatric Medical Institute |
| 18 | Rabat | Mohammed V University |

## 10. Watch-outs

- **3X is very hard:** about 17% growth every year for 7 years. Present it as the mission, with our own numbers beside it.
- **No education or heritage experts in the team:** have outside experts check the education and heritage pages before launch.
- **Children:** under-18s have full access, but US law (COPPA) requires blocking under-13s or getting parental consent (to verify with a lawyer).
- **Minimal GDPR** still means consent, a privacy policy and data deletion: a legal minimum in the UK and EU.
- **Stale information:** pages update only when someone reports a change. Keep the safety disclaimer on every page.
- **3 months is tight** for an app, a website, a WhatsApp bot and 105 pages. If time runs short, launch the website and WhatsApp first.
