# Fintech Product Roadmap 2025–2028

## Overview

This roadmap covers feature development across Nzila Corp's two fintech platforms — **DiasporaCore V2/C3UO** (community banking, remittances, tontines) and **STSA** (stock trading simulation & analytics) — culminating in a unified financial dashboard for diaspora users.

---

## DiasporaCore V2 / C3UO Roadmap

### Q1 2025 — Foundation & Tontine Management v2

- **Tontine Engine v2**: Redesigned contribution scheduling with flexible payout models (rotating, bidding, fixed-order), automated dispute resolution, group chat integration
- **Multi-Currency Wallet**: Support for CAD, USD, GBP, EUR, XAF (CFA Franc), NGN, KES, GHS with real-time FX rates
- **Interac e-Transfer Integration**: Instant CAD funding via Interac, reducing deposit friction for Canadian users
- **KPIs**: 20 tontine groups migrated, 500 wallets created, 95% Interac success rate

### Q2 2025 — Remittance Engine & Group Savings

- **Remittance Corridor Launch**: Canada → DRC, Canada → Nigeria, Canada → Ghana (Tier 1 corridors)
- **Group Savings Pools**: Shared savings accounts for families, associations, and church groups with admin controls and contribution tracking
- **Real-Time Remittance Tracking**: Push notifications at each stage (initiated → processing → partner pickup → delivered)
- **Mobile Money Disbursement**: M-Pesa (Kenya), Orange Money (DRC/Senegal), MTN MoMo (Ghana/Nigeria) integration
- **KPIs**: $50K monthly remittance volume, 30 savings pools active, <4hr average delivery time

### Q3 2025 — Micro-Lending & Credit Scoring

- **Micro-Lending Engine**: Peer-to-peer and pool-to-member lending within tontine groups, with automated repayment scheduling
- **Alternative Credit Scoring**: Proprietary model using tontine participation history, remittance frequency, savings behavior, and community reputation scores — designed for users with no traditional credit history
- **ACH Integration (US)**: USD funding for US-based users via ACH direct debit
- **KPIs**: 50 micro-loans issued, average loan size $200-$500, <5% default rate

### Q4 2025 — Credit Union White-Label & Multi-Tenancy

- **Credit Union Licensing Platform**: White-label DiasporaCore deployment for credit unions serving diaspora communities
- **Multi-Tenant Architecture**: Isolated tenant databases per credit union with shared infrastructure, configurable branding, custom fee structures
- **Admin Dashboard**: Credit union managers can onboard members, configure products, view compliance reports, manage loan portfolios
- **KPIs**: 2 credit union pilots signed, 500+ members onboarded through credit unions

---

### Q1-Q2 2026 — Scale & Expansion

- **UK Corridor Launch**: UK → Kenya, UK → Nigeria, UK → Ghana with GBP funding via Open Banking (PSD2)
- **SEPA Integration (EU)**: EUR funding for France/Belgium users
- **Tontine Marketplace**: Public directory of open tontine groups searchable by diaspora community, location, contribution level
- **Loyalty Program**: Points earned on remittances redeemable for fee discounts, STSA premium features, or marketplace credits

### Q3-Q4 2026 — Intelligence Layer

- **Financial Health Dashboard**: Unified view of remittance history, savings progress, loan obligations, credit score trajectory
- **Smart Remittance Routing**: AI-powered corridor selection optimizing for speed, cost, and recipient preference
- **Fraud Detection v2**: ML-based anomaly detection on transaction patterns, device fingerprinting, behavioral biometrics

---

## STSA Roadmap

### Q1 2025 — Paper Trading Enhancement

- **Enhanced Paper Trading**: Realistic simulation with slippage modeling, commission structures, and market impact
- **Portfolio Analytics Dashboard**: Risk metrics (Sharpe ratio, beta, drawdown), sector allocation, performance attribution
- **Market Data Integration**: Real-time quotes from NYSE, NASDAQ, TSX via IEX Cloud and Alpha Vantage APIs
- **KPIs**: 200 active paper traders, avg. session duration 15 min, 80% weekly retention

### Q2 2025 — Educational Content & Social Features

- **Trading Academy**: Structured learning paths for beginners — modules on stocks, ETFs, options basics, portfolio theory
- **Social Trading Feed**: Follow top performers, share trade ideas, comment on positions (anonymous leaderboards)
- **Watchlists & Alerts**: Custom watchlists with price alerts via push notification and SMS
- **KPIs**: 500 users enrolled in Trading Academy, 50+ social trading posts/week

### Q3-Q4 2025 — African Stock Exchange Integration

- **NSE (Nigerian Stock Exchange)**: Live market data and paper trading for Nigerian equities
- **JSE (Johannesburg Stock Exchange)**: South African equity data integration
- **BRVM (West African Exchange)**: Francophone West African securities coverage
- **Dual-Market Portfolios**: Users can build portfolios spanning North American and African markets
- **KPIs**: 100 users trading African equities (paper), 3 African exchanges integrated

### Q1-Q2 2026 — Fractional Shares & Robo-Advisor

- **Fractional Share Trading**: Invest as little as $1 in any stock — critical for diaspora users building investment habits
- **Robo-Advisor (Nzila Invest)**: Goal-based automated portfolios — "Save for Home in Lagos", "Education Fund for Kids", "Retirement in Kinshasa"
- **Tax-Efficient Investing**: TFSA/RRSP optimization for Canadian users, ISA awareness for UK users
- **KPIs**: 1,000 fractional share accounts, $200K AUM in robo-advisor

### Q3-Q4 2026 — Advanced Trading

- **Options Trading Simulator**: Paper trading for options strategies with P&L visualization and Greeks dashboard
- **Crypto Watchlists**: Cryptocurrency price tracking and portfolio simulation (no live trading — regulatory)
- **API Access**: RESTful API for programmatic trading strategies and third-party bot integration

---

## Platform Integration Roadmap

### Unified Financial Dashboard (Q1 2027)

- **Single Sign-On**: One Nzila account spanning DiasporaCore and STSA
- **Unified Dashboard Home**: Combined view of remittance activity, savings/tontine progress, investment portfolio performance
- **Cross-Platform Transfers**: Move funds between DiasporaCore wallet and STSA trading account instantly
- **Integrated Notifications**: Single notification center for remittance status, tontine contributions due, stock price alerts, loan payments

### API Marketplace (Q2-Q3 2027)

- **Developer Portal**: Public API documentation, sandbox environment, API key management
- **Partner Integrations**: Pre-built connectors for accounting software (QuickBooks, Wave), CRM (HubSpot), and banking APIs
- **Third-Party Fintech Plugins**: Enable external developers to build on DiasporaCore — insurance products, bill payment, airtime top-up
- **Revenue Model**: API call pricing tiers, revenue share on marketplace transactions

### Mobile App (Q3 2027 – Q1 2028)

- **Technology**: React Native for cross-platform iOS/Android deployment from shared codebase
- **Core Features**: Full remittance flow, tontine management, trading dashboard, biometric authentication
- **Offline Mode**: Queue remittance requests and tontine contributions when connectivity is limited
- **Low-Data Mode**: Compressed assets, minimal background sync, text-first UI for users on limited data plans
- **Push Notifications**: Real-time transaction alerts, tontine reminders, market movers

---

## Quarterly KPI Summary

| Quarter | DiasporaCore Users | STSA Users | Remittance Volume | Revenue |
|---------|-------------------|------------|-------------------|---------|
| Q1 2025 | 200 | 100 | — | $2K |
| Q2 2025 | 500 | 200 | $50K/mo | $5K |
| Q4 2025 | 1,500 | 500 | $150K/mo | $20K |
| Q2 2026 | 3,000 | 1,000 | $500K/mo | $50K |
| Q4 2026 | 5,000 | 2,000 | $1M/mo | $100K |
| Q2 2027 | 8,000 | 3,500 | $2M/mo | $200K |
| Q4 2027 | 12,000 | 5,000 | $4M/mo | $350K |
| Q2 2028 | 18,000 | 7,000 | $6M/mo | $500K |
| Q4 2028 | 25,000 | 10,000 | $8M/mo | $600K |

---

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Regulatory delays (MSB licensing) | Begin applications 12 months early, engage compliance consultants |
| Mobile money API instability | Multi-provider fallback (M-Pesa + Orange Money + Airtel) per corridor |
| African exchange data quality | Partner with licensed data vendors, implement data validation layer |
| React Native performance | Budget for native module development for performance-critical features |
| Credit union adoption lag | Offer 6-month free pilot, dedicated onboarding support, guaranteed SLA |
