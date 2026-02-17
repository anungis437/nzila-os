# Entertainment — Product Roadmap

> Quarterly feature roadmap for CongoWave (2025–2028) — music streaming, cultural content, and artist platform.

---

## Platform Overview

### CongoWave
- **Entity count**: 83+ database entities across 16 Django apps
- **Stack**: Django, PostgreSQL, Redis, Celery, AWS S3 (media storage)
- **Core modules**: Music catalog, user profiles, streaming engine, artist dashboard, playlists, social features
- **Current state**: MVP with core streaming, catalog management, user auth

---

## 2025 — MVP Launch & Community Validation

### Q3 2025 — Core Streaming MVP
- [x] Music catalog: upload, metadata, search (10K+ tracks)
- [x] User authentication: email, Google OAuth, phone number
- [x] Audio streaming: adaptive bitrate (64/128/256 kbps)
- [x] Basic playlist creation and sharing
- [ ] Artist profiles: bio, discography, social links
- [ ] Genre/mood-based browsing (Rumba, Soukous, Gospel, Ndombolo, Afrobeats)
- [ ] Basic recommendation engine (collaborative filtering)

### Q4 2025 — Engagement & Monetization
- [ ] Free tier with ads: pre-roll audio ads, banner ads
- [ ] Premium subscription: Stripe billing (diaspora markets)
- [ ] Offline listening: download for offline playback (Premium only)
- [ ] Social features: follow artists, share tracks, activity feed
- [ ] Curated playlists: editorial team creates weekly cultural playlists
- [ ] Push notifications: new releases, followed artist updates
- [ ] Basic analytics dashboard for artists

---

## 2026 — Growth & Catalog Expansion

### Q1 2026 — Catalog & Discovery
- [ ] Label partnership portal: bulk upload, royalty tracking, catalog management
- [ ] AI-powered recommendations: listening history + cultural affinity signals
- [ ] Advanced search: lyrics search, "Shazam-like" audio recognition
- [ ] Radio mode: continuous playback based on seed track/artist/genre
- [ ] Podcast support: African diaspora podcasts, cultural storytelling
- [ ] Catalog milestone: 100,000+ tracks

### Q2 2026 — Social & Community
- [ ] User-generated playlists marketplace (share, follow, embed)
- [ ] Artist live sessions: scheduled live audio/video streams
- [ ] Comments & reactions on tracks and playlists
- [ ] Community features: forums, cultural discussions, event boards
- [ ] Referral program: invite friends → free premium weeks
- [ ] WhatsApp sharing integration (deeplinks to tracks/playlists)

### Q3 2026 — Mobile Money & Africa Prep
- [ ] Mobile money billing engine: M-Pesa, Orange Money, Airtel Money
- [ ] Micro-subscriptions: daily ($0.10), weekly ($0.50), monthly ($2.99)
- [ ] Low-bandwidth mode: 32kbps streaming, compressed album art
- [ ] Data usage tracker: show users how much data each session uses
- [ ] SMS-based account management (for feature phone users)
- [ ] French-first UX audit and localization improvements

### Q4 2026 — Artist Ecosystem
- [ ] Artist Pro subscription: advanced analytics, promotion tools, fan insights
- [ ] Distribution pipeline: distribute via CongoWave to Spotify/Apple/YouTube
- [ ] Royalty calculator: transparent per-stream payout tracking
- [ ] Merch store integration: artist merchandise linked to profiles
- [ ] Collaboration tools: artist-to-artist connection, co-release features
- [ ] Event ticketing: sell concert/event tickets through artist profiles

---

## 2027 — In-Africa Launch & Original Content

### Q1 2027 — DRC Market Entry
- [ ] Vodacom DRC partnership: zero-rated streaming, telco billing
- [ ] Airtel DRC integration: data bundle partnerships
- [ ] Offline-first architecture: smart download manager (ML prediction)
- [ ] Local CDN deployment: edge servers in Kinshasa, Lubumbashi
- [ ] Lingala/Swahili language support in UI
- [ ] Local artist onboarding campaign (Kinshasa studios)

### Q2 2027 — Original Content
- [ ] CongoWave Originals: exclusive albums, live sessions, documentaries
- [ ] Video content: music videos, behind-the-scenes, cultural documentaries
- [ ] Podcast originals: African tech, diaspora stories, music history
- [ ] Virtual concerts: ticketed live-streamed performances
- [ ] Recording studio partnerships: Kinshasa, Brazzaville, Lagos, Nairobi

### Q3 2027 — Pan-African Expansion
- [ ] Launch in Congo-Brazzaville, Cameroon, Senegal
- [ ] Regional catalog curation: West Africa, East Africa, Southern Africa
- [ ] Multi-currency support: CDF, XAF, XOF, KES, NGN
- [ ] Regional pricing: country-specific subscription tiers
- [ ] Local payment providers: Wave (Senegal), Flutterwave (Nigeria), KCB (Kenya)
- [ ] Catalog milestone: 500,000+ tracks

### Q4 2027 — Platform Intelligence
- [ ] ML-powered music discovery: "Discover Weekly" equivalent
- [ ] Mood/activity playlists: workout, study, party, spiritual, nostalgic
- [ ] Audio quality: lossless streaming option (FLAC) for Premium
- [ ] Smart speaker integration: Alexa, Google Home
- [ ] CarPlay / Android Auto integration

---

## 2028 — Scale & Ecosystem

### Q1-Q2 2028 — Creator Economy
- [ ] Artist funding: fan crowdfunding for album projects
- [ ] NFT-like digital collectibles: limited edition releases, virtual concert tickets
- [ ] Fan clubs: paid fan memberships with exclusive content
- [ ] Sync licensing marketplace: connect artists with content creators
- [ ] AI music production tools: beat generation, mixing assistance
- [ ] Artist development program: mentorship, recording grants

### Q3-Q4 2028 — Global Presence
- [ ] Launch in 10+ African countries
- [ ] Diaspora presence in 5+ Western markets
- [ ] CongoWave Radio: 24/7 curated streaming channels
- [ ] Cross-platform integration: TikTok sounds, Instagram stories
- [ ] User milestone: 200,000 active users
- [ ] Revenue milestone: $2M ARR
- [ ] Series A preparation: growth metrics, market leadership in niche

---

## Technical Milestones

| Quarter | Milestone | KPI |
|---|---|---|
| Q3 2025 | MVP launch | 500 users |
| Q4 2025 | Premium + ads | $2K MRR |
| Q2 2026 | 100K catalog | 2,000 MAU |
| Q4 2026 | Artist Pro | 50 artists onboarded |
| Q1 2027 | DRC launch | 5,000 DRC users |
| Q3 2027 | Pan-African | 3 new countries |
| Q4 2027 | 500K catalog | 50,000 MAU |
| Q4 2028 | Scale | 200K users, $2M ARR |

---

## Dependencies & Risks

### Critical Dependencies
- Music licensing agreements with major Congolese/African labels
- Telco partnerships for zero-rated streaming in Africa
- Mobile money integrator reliability (M-Pesa API uptime)
- CDN infrastructure in Sub-Saharan Africa

### Key Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Licensing disputes | Medium | High | Pre-negotiated royalty rates, escrow for disputed tracks |
| Low conversion (free→paid) | High | Medium | Aggressive free tier limits, community-driven premium content |
| Telco partnership delays | Medium | High | Multi-telco strategy, direct mobile money as backup |
| High data costs for users | High | Medium | Ultra-low bandwidth mode, offline-first features |
| Competition from Spotify Africa expansion | Medium | Medium | Cultural depth and community — Spotify can't replicate |
