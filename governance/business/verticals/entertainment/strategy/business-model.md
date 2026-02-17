# Entertainment — Business Model

> Revenue model, unit economics, and financial projections for CongoWave music streaming platform.

---

## Revenue Model

### Primary Revenue Streams

#### 1. Subscription Revenue (60% of revenue)
| Tier | Monthly Price | Target Segment | Margin |
|---|---|---|---|
| Premium (Diaspora) | $9.99/mo | Canada/US/EU diaspora | 55% |
| Premium (Africa) | $2.99/mo | In-Africa users | 35% |
| Family (Diaspora) | $14.99/mo | Households (up to 6) | 60% |
| Family (Africa) | $4.99/mo | African households | 40% |
| Student | $4.99/mo | University students | 45% |
| Artist Pro | $4.99/mo | Musicians/creators | 85% |

#### 2. Advertising Revenue (20% of revenue)
- Pre-roll audio ads (15-30 seconds between tracks)
- Display banners in free-tier app
- Sponsored playlists and artist promotions
- Programmatic: Google AdMob + direct-sold cultural brand partnerships
- Target eCPM: $4-8 (diaspora), $1-2 (Africa)
- Fill rate target: 70% (diaspora), 40% (Africa)

#### 3. Artist Services (10% of revenue)
- Distribution: distribute to Spotify/Apple/YouTube via CongoWave ($9.99/release)
- Promotion: featured placement, playlist inclusion ($50-500/campaign)
- Analytics Pro: advanced fan insights, demographic data, trend analysis
- Recording: partnership with studios (0% margin — brand building)

#### 4. Events & Experiences (10% of revenue)
- Virtual concert ticketing (10% commission on ticket sales)
- In-person event promotion (listing fees + ticketing commission)
- Merchandise storefront commission (15% on sales)
- Brand partnership events (sponsored concerts, cultural festivals)

---

## Unit Economics

### Diaspora User Economics
```
Monthly Revenue per Premium User:           $9.99
├── Music licensing costs (55%):            -$5.49
├── Infrastructure (hosting, CDN, storage): -$0.80
├── Payment processing (Stripe 2.9%):      -$0.29
├── Customer support:                       -$0.15
└── Gross Profit per User:                   $3.26 (32.6% margin)

Annual LTV (18-month avg retention):        $58.68
CAC (diaspora — community-driven):          $15.00
LTV/CAC Ratio:                              3.9x
Payback Period:                             4.6 months
```

### In-Africa User Economics
```
Monthly Revenue per Premium User:           $2.99
├── Music licensing costs (45%):            -$1.35
├── Infrastructure (hosting, CDN):          -$0.40
├── Mobile money processing (3.5%):         -$0.10
├── Customer support:                       -$0.05
└── Gross Profit per User:                   $1.09 (36.5% margin)

Annual LTV (12-month avg retention):        $13.08
CAC (in-Africa — telco partnership):        $3.00
LTV/CAC Ratio:                              4.4x
Payback Period:                             2.8 months
```

### Free Tier Economics
```
Monthly Ad Revenue per MAU:                 $0.40 (diaspora), $0.08 (Africa)
Infrastructure cost per MAU:                $0.15
Net per Free User:                          $0.25 (diaspora), -$0.07 (Africa)
Free-to-Premium Conversion Target:          5% (diaspora), 2% (Africa)
```

---

## Cost Structure

### Fixed Costs (Monthly)
| Category | Year 1 | Year 3 | Year 5 |
|---|---|---|---|
| Engineering team (2 FT → 5) | $8,000 | $25,000 | $50,000 |
| Infrastructure (AWS) | $500 | $3,000 | $15,000 |
| Music licensing (minimum guarantees) | $1,000 | $5,000 | $20,000 |
| Content curation team | $0 | $3,000 | $8,000 |
| Office/admin | $500 | $2,000 | $5,000 |
| **Total Fixed** | **$10,000** | **$38,000** | **$98,000** |

### Variable Costs (Per Unit)
| Category | Cost | Scale Effect |
|---|---|---|
| Music streaming royalty | $0.004-0.006/stream | Decreasing per-stream with volume |
| CDN delivery | $0.01/GB | Decreasing with commitment |
| Payment processing | 2.9% + $0.30 (Stripe) | Flat |
| Mobile money processing | 3.5% (M-Pesa/Orange) | Flat |
| SMS notifications | $0.01/SMS | Flat |

---

## Financial Projections

### Revenue Forecast
| Year | Premium Subs | Free MAU | Sub Revenue | Ad Revenue | Services | Total Revenue |
|---|---|---|---|---|---|---|
| 2025 | 200 | 1,000 | $18K | $3K | $1K | $22K |
| 2026 | 1,500 | 8,000 | $135K | $25K | $15K | $175K |
| 2027 | 8,000 | 40,000 | $480K | $80K | $40K | $600K |
| 2028 | 25,000 | 120,000 | $1.2M | $200K | $100K | $1.5M |
| 2029 | 60,000 | 300,000 | $2.5M | $500K | $250K | $3.25M |
| 2030 | 120,000 | 600,000 | $4.5M | $1M | $500K | $6M |

### Burn Rate & Runway
| Year | Revenue | Costs | Net Burn | Cumulative |
|---|---|---|---|---|
| 2025 | $22K | $130K | -$108K | -$108K |
| 2026 | $175K | $500K | -$325K | -$433K |
| 2027 | $600K | $800K | -$200K | -$633K |
| 2028 | $1.5M | $1.2M | +$300K | -$333K |
| 2029 | $3.25M | $2.5M | +$750K | +$417K |

### Funding Requirements
- **Pre-seed** (2025): $150K — MVP launch, initial catalog licensing
- **Seed** (2026): $500K — catalog expansion, mobile app development, telco partnerships
- **Series A** (2028): $3M — pan-African expansion, original content, marketing scale
- Total pre-profitability funding: ~$700K

---

## Music Licensing Strategy

### Licensing Models
| Source | Model | Rate | Coverage |
|---|---|---|---|
| Independent Congolese artists | Direct deal | Rev share 70/30 | Exclusive catalog |
| African indie labels | Blanket license | $0.004/stream | 50K+ tracks |
| Major labels (UMG, Sony, Warner) | Standard license | $0.005-0.006/stream | Global catalog |
| Collective management (SOCODA) | Blanket license | % of revenue | DRC repertoire |
| User-uploaded content | Platform hosting | Rev share 85/15 | User-generated |

### Competitive Advantage in Licensing
- Direct relationships with Congolese artists (lower per-stream rates)
- SOCODA (Société Congolaise du Droit d'Auteur) partnership for DRC repertoire
- Label deals focused on underrepresented catalogs (lower minimum guarantees)
- Revenue share model incentivizes artists to promote CongoWave vs Spotify

---

## Key Business Metrics

### North Star Metrics
- **Monthly Active Listeners (MAL)**: listeners who play 1+ track/month
- **Premium Conversion Rate**: free → paid percentage
- **Streams per User per Day**: engagement depth

### Operational KPIs
| Metric | Year 1 Target | Year 3 Target |
|---|---|---|
| MAL | 800 | 40,000 |
| Premium subs | 200 | 8,000 |
| Conversion rate | 8% | 12% |
| Avg streams/user/day | 8 | 15 |
| Churn rate (monthly) | 8% | 5% |
| Catalog size | 25,000 | 500,000 |
| Artist partners | 50 | 2,000 |
| NPS | 40 | 55 |

---

## Competitive Moat

### Defensibility Factors
1. **Cultural curation depth**: No competitor has equivalent Congolese/Central African music expertise
2. **Artist relationships**: Direct deals with 500+ independent African artists
3. **Community network effects**: Cultural events, forums, social features create switching costs
4. **Bilingual (FR/EN)**: Francophone Africa vastly underserved by Spotify/Apple
5. **Low-bandwidth innovation**: Optimized streaming for African mobile networks
6. **Mobile money**: Native payment integration that global platforms lack

### Exit Scenarios (5-7 year horizon)
- **Acquisition by major platform** (Spotify, Apple, Tencent Music): $20-50M for catalog + user base + African market presence
- **Acquisition by African telco** (MTN, Safaricom, Airtel): $10-30M for content platform
- **Independent growth**: Profitable at 60K+ premium subscribers
- **Strategic merger**: Combine with Boomplay/Mdundo for pan-African dominance
