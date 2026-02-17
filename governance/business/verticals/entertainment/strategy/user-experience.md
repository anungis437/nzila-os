# Entertainment — User Experience Strategy

> UX strategy for CongoWave — music streaming for the African diaspora, designed for cultural connection and diverse network conditions.

---

## User Personas

### 1. Diaspora Music Lover — "Serge"
- **Profile**: 32, Congolese-Canadian in Toronto, software developer, grew up listening to Rumba/Soukous
- **Pain Points**: Can't find classic Congolese albums on Spotify, frustrated by poor metadata (artist names misspelled), no cultural context
- **Needs**: Deep Congolese/African catalog, accurate metadata, curated playlists by era/genre/mood
- **Usage**: 2+ hours daily, morning commute + evening, shared playlists with family in Kinshasa
- **Value Prop**: "Every Congolese album you grew up with — finally in one place, properly cataloged"

### 2. Young Afrobeats Fan — "Amina"
- **Profile**: 22, university student in Montreal, second-generation diaspora, listens to Afrobeats + Amapiano + pop
- **Pain Points**: Uses Spotify but wants more African variety, discovery limited to mainstream Afrobeats
- **Needs**: Genre diversity (not just Afrobeats), social sharing, concert discovery, affordable pricing
- **Usage**: 3+ hours daily, background listening + active discovery, TikTok sharing
- **Value Prop**: "Discover African music beyond what Spotify shows you"

### 3. In-Africa Listener — "Patrick"
- **Profile**: 28, Kinshasa, works in mobile phone retail, limited data budget, feature phone + smartphone
- **Pain Points**: High data costs (1GB = half-day wages), unreliable connectivity, limited payment options
- **Needs**: Offline listening, ultra-low data mode, mobile money payments, micro-subscriptions
- **Usage**: Downloads at WiFi spots, offline listening throughout the day
- **Value Prop**: "All your music, even without data — pay with mobile money"

### 4. Independent Artist — "Fally"
- **Profile**: 35, musician in Brazzaville, records in home studio, 10K followers on Facebook, zero streaming presence
- **Pain Points**: No way to get music on streaming platforms (complex, expensive), can't track who listens
- **Needs**: Easy upload, fan analytics, distribution to global platforms, royalty payments to mobile money
- **Usage**: Weekly uploads, daily analytics check, fan engagement
- **Value Prop**: "Upload today, stream worldwide tomorrow — get paid to your M-Pesa"

---

## Core UX Flows

### Music Discovery
```
Home Screen:
┌─────────────────────────────────────────┐
│ 🎵 CongoWave                    🔍 👤  │
│                                         │
│ ▶ Continue Listening                    │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│ │ 🎵 │ │ 🎵 │ │ 🎵 │ │ 🎵 │           │
│ │Trek│ │Muse│ │Sol │ │Gos │           │
│ └────┘ └────┘ └────┘ └────┘           │
│                                         │
│ 📻 Your Daily Mix                       │
│ ┌────────────────────────────────┐     │
│ │ Based on: Rumba, Soukous, OK  │     │
│ │ Jazz — 35 tracks, 2h 15min    │     │
│ │ [▶ Play] [♡ Save]             │     │
│ └────────────────────────────────┘     │
│                                         │
│ 🔥 Trending in the Diaspora            │
│ 🌍 New from Kinshasa                    │
│ 🎹 Classic Rumba Essentials             │
│ 🎤 Editors' Pick: Women of Congolese...│
└─────────────────────────────────────────┘
```

### Now Playing Screen
```
┌─────────────────────────────────────────┐
│            ▼ Now Playing                │
│                                         │
│        ┌──────────────────┐             │
│        │                  │             │
│        │   Album Art      │             │
│        │   (500×500)      │             │
│        │                  │             │
│        └──────────────────┘             │
│                                         │
│  Indépendance Cha Cha                   │
│  Grand Kallé et l'African Jazz          │
│                                         │
│  ──●────────────────── 2:34 / 4:12      │
│                                         │
│  ◁◁    ▶    ▷▷                          │
│                                         │
│  🔀   ♡   📋   🔊   ⋮                  │
│                                         │
│  About This Track:                      │
│  "Released in 1960, this song became    │
│   the anthem of Congolese independence" │
│                                         │
│  📖 Read More • 🎤 Artist Bio          │
└─────────────────────────────────────────┘
```

### Offline Download Manager
```
┌─────────────────────────────────────────┐
│ 📥 Downloads                     ⚙️     │
│                                         │
│ Storage: 1.2 GB / 8 GB used            │
│ ████████░░░░░░░░░░░░░░░ 15%            │
│                                         │
│ Download Quality: [Low 64kbps ▼]       │
│ (saves 4x storage vs Standard)          │
│                                         │
│ ✅ Daily Mix — 35 tracks (68 MB)       │
│ ✅ Classic Rumba — 50 tracks (95 MB)   │
│ 🔄 New Releases — downloading 12/20    │
│ ⏸ Kinshasa Live Sessions (paused)      │
│                                         │
│ Auto-download when on WiFi: [ON]       │
│ Delete played downloads after: [7 days] │
└─────────────────────────────────────────┘
```

---

## Artist Dashboard UX

### Artist Home
```
┌─────────────────────────────────────────┐
│ 🎤 Artist Dashboard — Fally            │
│                                         │
│ This Month:                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │ 12,450   │ │ 342      │ │ $48.20   ││
│ │ Streams  │ │ New Fans │ │ Earnings ││
│ │ ↑ 23%   │ │ ↑ 15%   │ │ ↑ 31%   ││
│ └──────────┘ └──────────┘ └──────────┘│
│                                         │
│ Top Tracks:                             │
│ 1. Bolingo Na Ngai — 4,230 streams     │
│ 2. Kinshasa Nights — 3,102 streams     │
│ 3. Mama Africa — 2,890 streams         │
│                                         │
│ Fan Locations:                          │
│ 🇨🇦 Toronto 35% | 🇨🇩 Kinshasa 28%   │
│ 🇫🇷 Paris 15% | 🇺🇸 NYC 12%           │
│                                         │
│ [Upload New Track] [Withdraw Earnings]  │
└─────────────────────────────────────────┘
```

---

## Onboarding Flow

### Listener Onboarding (3 minutes)
```
Step 1: Welcome                     Step 2: Music Taste
┌───────────────────────┐          ┌───────────────────────┐
│ Welcome to CongoWave! │          │ What do you love?     │
│                       │          │                       │
│ The home of African   │    →     │ ○ Rumba & Soukous    │
│ music.                │          │ ○ Afrobeats          │
│                       │          │ ○ Amapiano           │
│ [Sign Up — Email]     │          │ ○ Gospel             │
│ [Sign Up — Google]    │          │ ○ Ndombolo           │
│ [Sign Up — Phone]     │          │ ○ African Jazz       │
│                       │          │ (select 3+)          │
└───────────────────────┘          └───────────────────────┘

Step 3: Pick Artists                Step 4: First Playlist
┌───────────────────────┐          ┌───────────────────────┐
│ Artists you might know│          │ Your first mix is     │
│                       │          │ ready! 🎉             │
│ [Franco] [Wemba]      │          │                       │
│ [Fally Ipupa]         │    →     │ ▶ "Serge's Intro Mix" │
│ [Koffi Olomide]       │          │ 25 tracks • 1h 40min  │
│ [Innoss'B] [Werrason] │          │                       │
│ [Ferre Gola]          │          │ [Play Now]            │
│ (follow 5+)           │          │ [Explore More]        │
└───────────────────────┘          └───────────────────────┘
```

### Artist Onboarding (5 minutes)
1. Verify identity: name, stage name, social media links
2. Upload first track: drag-and-drop with metadata form
3. Payment setup: bank account or mobile money (M-Pesa/Orange Money)
4. Profile completion: bio, photo, genre tags
5. Dashboard tour: streams, earnings, promotion tools

---

## Design System

### Visual Identity
- **Primary color**: Deep purple (#6B21A8) — creativity, culture, premium feel
- **Accent**: Gold (#F59E0B) — warmth, African heritage, celebration
- **Background**: Dark mode default (#0F0D15) — immersive listening experience
- **Text**: White (#F8FAFC) on dark, high contrast for outdoor mobile use
- **Typography**: Space Grotesk (headings) + Inter (body) — modern, readable

### Cultural Design Principles
1. **Celebrate heritage**: African patterns, organic shapes, warm color palette
2. **Storytelling**: Every track/album has cultural context (liner notes, history)
3. **Community first**: Social features are prominent, not hidden
4. **Inclusive**: Bilingual (FR/EN), screen reader friendly, low-bandwidth considered
5. **Joyful**: Music is celebration — the UX should feel alive, not clinical

### Component Library
- Audio player components (now playing, mini player, queue)
- Card components (track, album, artist, playlist)
- Waveform visualizer (lightweight canvas renderer)
- Cultural badges (verified artist, curator, early adopter)
- Engagement components (follow, share, comment, reaction)

---

## Accessibility

### Standards
- WCAG 2.1 AA compliance
- VoiceOver (iOS) + TalkBack (Android) full support
- Keyboard navigation for all desktop interactions
- Skip-to-content for screen readers
- Audio descriptions for visual content (album art, artist photos)

### Low-Bandwidth Accessibility
- Text-first loading: metadata loads before images
- Placeholder album art: colored gradient based on genre
- Image lazy loading: album art loads on scroll
- Progressive quality: start at 64kbps, upgrade if bandwidth allows
- Estimated data usage shown before streaming/downloading

### Responsive Design
- **Desktop** (≥1280px): Full library view, now playing sidebar
- **Tablet** (≥768px): Simplified navigation, larger touch targets
- **Mobile** (≥375px): Bottom tab navigation, mini player, gesture controls
- **Feature phone** (SMS/USSD): Basic catalog browsing and playback control
