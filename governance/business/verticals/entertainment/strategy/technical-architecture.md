# Entertainment — Technical Architecture

> System architecture for CongoWave — music streaming, content delivery, and artist platform.

---

## System Overview

### Platform Specifications
- **Entity count**: 83+ database models across 16 Django apps
- **Codebase**: Python/Django monolith with microservice extraction planned
- **Database**: PostgreSQL (primary), Redis (cache, sessions, real-time)
- **Task queue**: Celery + Redis (audio processing, notifications, analytics)
- **Media storage**: AWS S3 (audio files, album art, artist media)
- **CDN**: CloudFront (audio streaming delivery)

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Web App  │  │ iOS App  │  │ Android  │              │
│  │ (React)  │  │ (Swift)  │  │ (Kotlin) │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └──────────────┼──────────────┘                    │
│                      ▼                                   │
│              ┌───────────────┐                           │
│              │   API Gateway │                           │
│              │   (Kong/NGINX)│                           │
│              └───────┬───────┘                           │
├──────────────────────┼──────────────────────────────────┤
│                Service Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Catalog  │  │ Streaming│  │  User    │  │ Artist │ │
│  │ Service  │  │ Service  │  │ Service  │  │Service │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
├───────┼──────────────┼──────────────┼───────────┼───────┤
│                Data Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │PostgreSQL│  │  Redis   │  │ AWS S3   │              │
│  │ (Primary)│  │ (Cache)  │  │ (Media)  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

## Django App Architecture (16 Apps)

### Core Applications
| App | Purpose | Key Models |
|---|---|---|
| `accounts` | User authentication, profiles, preferences | User, Profile, Preference |
| `catalog` | Music catalog management, metadata | Track, Album, Artist, Genre |
| `streaming` | Audio delivery, playback, quality management | Stream, PlaybackSession, Quality |
| `playlists` | Playlist creation, curation, sharing | Playlist, PlaylistTrack, CuratedPlaylist |
| `social` | Follows, shares, activity feed | Follow, Share, Activity, Comment |
| `search` | Full-text and semantic music search | SearchIndex, SearchHistory |

### Business Applications
| App | Purpose | Key Models |
|---|---|---|
| `subscriptions` | Premium plans, billing, trials | Plan, Subscription, Payment |
| `ads` | Ad serving for free tier | AdCampaign, AdPlacement, Impression |
| `artists` | Artist dashboard, analytics, tools | ArtistProfile, Release, Royalty |
| `labels` | Label partnerships, bulk management | Label, LabelArtist, Distribution |
| `events` | Concert listings, ticketing | Event, Venue, Ticket, RSVP |
| `merch` | Artist merchandise (future) | Product, Order, Inventory |

### Infrastructure Applications
| App | Purpose | Key Models |
|---|---|---|
| `analytics` | Listening analytics, reports | ListeningEvent, DailyStats, Report |
| `notifications` | Push, email, SMS notifications | Notification, Template, Channel |
| `payments` | Payment processing engine | Transaction, PaymentMethod, Invoice |
| `admin_tools` | Internal tools, moderation | ContentFlag, ModerationAction, BulkOp |

---

## Audio Streaming Pipeline

### Ingestion Flow
```
Artist/Label Upload → Format Validation → Audio Processing → Storage
     │                     │                    │              │
     ▼                     ▼                    ▼              ▼
┌─────────┐         ┌──────────┐        ┌──────────┐   ┌──────────┐
│ Upload  │         │ Validate │        │ Transcode│   │  S3      │
│ (S3     │    →    │ Format,  │   →    │ to HLS   │ → │ Storage  │
│ Direct) │         │ Duration,│        │ 64/128/  │   │ + Meta   │
│         │         │ Metadata │        │ 256 kbps │   │ in PG    │
└─────────┘         └──────────┘        └──────────┘   └──────────┘
                                              │
                                              ▼
                                        ┌──────────┐
                                        │ Generate │
                                        │ Waveform │
                                        │ + Preview│
                                        └──────────┘
```

### Transcoding Profiles
| Profile | Bitrate | Use Case | File Size (4min track) |
|---|---|---|---|
| Low | 64 kbps AAC | Low-bandwidth markets (Africa) | ~1.9 MB |
| Standard | 128 kbps AAC | Default streaming | ~3.8 MB |
| High | 256 kbps AAC | Premium quality | ~7.5 MB |
| Lossless | FLAC | Audiophile tier (2028) | ~30 MB |

### Streaming Delivery
- **Protocol**: HLS (HTTP Live Streaming) with adaptive bitrate
- **CDN**: CloudFront with edge locations optimized for target markets
- **Caching**: Redis cache for track metadata, user preferences, playlist data
- **Offline**: Encrypted download with DRM (Widevine/FairPlay) for Premium users
- **Analytics**: per-stream tracking (30-second play = 1 stream for royalty counting)

---

## Database Architecture

### PostgreSQL Schema Design
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Artist     │───→│    Album     │───→│    Track     │
│ name,bio,img │    │ title,year   │    │ title,dur,   │
│ genre,country│    │ cover_art    │    │ audio_url,   │
│ verified     │    │ genre,label  │    │ genre,bpm    │
└──────────────┘    └──────────────┘    └──────────────┘
       │                                       │
       ▼                                       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ ArtistFollow │    │   Playlist   │───→│PlaylistTrack │
│ user,artist  │    │ name,user,   │    │ playlist,    │
│ followed_at  │    │ public,desc  │    │ track,order  │
└──────────────┘    └──────────────┘    └──────────────┘
       │                                       │
       ▼                                       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     User     │    │ Subscription │    │  ListenEvent │
│ email,name,  │───→│ plan,status, │    │ user,track,  │
│ country,lang │    │ payment_ref  │    │ duration,ts  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Key Indexes
- `track_genre_idx`: Genre-based browsing (B-tree on genre + release_date)
- `track_search_idx`: GIN index on tsvector for full-text track/artist search
- `listen_user_ts_idx`: User listening history (user_id + timestamp DESC)
- `playlist_popular_idx`: Playlist discovery (follower_count DESC)

---

## Recommendation Engine

### Collaborative Filtering
- User-track interaction matrix (listen count, skip rate, save rate)
- Similar user clustering: users who listen to X also listen to Y
- Cold start: genre/country preferences from onboarding survey

### Content-Based Features
- Audio feature extraction: BPM, key, energy, danceability (Essentia/librosa)
- Metadata similarity: genre, era, language, instrumentation
- Cultural affinity: geographic/cultural proximity scoring

### Hybrid Pipeline
```
User History ─┐
              ├──→ Feature Merge ──→ Ranking Model ──→ Top 50 Recommendations
Audio Features┘        │                                      │
                       ▼                                      ▼
              Diversity Filter                         Personalized
              (genre mix, new vs familiar)             Daily Mix
```

---

## Infrastructure

### Cloud Architecture
| Component | Service | Region |
|---|---|---|
| Application | AWS EC2 / ECS Fargate | us-east-1 (primary) |
| Database | AWS RDS PostgreSQL | us-east-1 |
| Cache | AWS ElastiCache Redis | us-east-1 |
| Media Storage | AWS S3 | us-east-1 + af-south-1 |
| CDN | CloudFront | Global (edge optimized) |
| Task Queue | AWS SQS + Celery | us-east-1 |
| Search | Elasticsearch (OpenSearch) | us-east-1 |
| Monitoring | CloudWatch + Sentry | Global |

### Scaling Strategy
- **Horizontal**: ECS auto-scaling based on concurrent streams (target: 10K concurrent)
- **Database**: Read replicas for analytics queries, connection pooling (PgBouncer)
- **CDN**: CloudFront PoPs in Africa (af-south-1 Cape Town, Lagos planned)
- **Media**: S3 cross-region replication to af-south-1 for low-latency African delivery

### Migration Path (2026-2027)
- Phase 1: Django monolith with DRF API → React frontend (current → Q4 2025)
- Phase 2: Extract streaming service as independent microservice (2026)
- Phase 3: Extract recommendation engine as ML microservice (2026)
- Phase 4: Add Africa edge infrastructure (CDN + media replication) (2027)
- Phase 5: Consider Azure migration to align with Nzila corporate infrastructure (2027-2028)

---

## Security & Content Protection

### DRM (Digital Rights Management)
- Widevine L1 (Android) + FairPlay (iOS) for Premium offline downloads
- Server-side encryption of audio files at rest (AES-256)
- Token-based stream URLs with 24-hour expiry
- Geo-restriction: content availability per licensing territory

### API Security
- JWT token authentication with refresh token rotation
- Rate limiting: 100 requests/minute per user, 1000/minute per IP
- CORS: whitelisted origins only
- Input validation: Pydantic/DRF serializer validation on all endpoints

### Content Moderation
- Automated audio fingerprinting: detect duplicate/pirated content
- Metadata review workflow: flag inappropriate content before publish
- DMCA takedown process: 24-hour response SLA
