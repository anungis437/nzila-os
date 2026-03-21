# Legacy Trade Apps — Domain Model Extraction

> **Purpose**: Canonical reference for building the new unified trade app.
> **Sources**: `nzila-trade-os-main` (trade-os) and `nzila_eexports-main` (eexports).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [APP 1: nzila-trade-os-main](#2-app-1-nzila-trade-os-main)
3. [APP 2: nzila_eexports-main](#3-app-2-nzila_eexports-main)
4. [Cross-App Comparison & Overlap](#4-cross-app-comparison--overlap)
5. [Canonical Model Recommendations](#5-canonical-model-recommendations)

---

## 1. Architecture Overview

### trade-os (General Trade Platform)

- **Base**: Django ORM with custom `BaseModel` (provides `id`, `created_date`, `updated_date`)
- **Money**: Custom `MoneyField` storing amounts in cents (`BigIntegerField`), with `to_cents()`/`from_cents()` helpers
- **DB**: PostgreSQL (SearchVectorField, GinIndex for full-text search)
- **Currency**: `CURRENCY_CHOICES` from `core.constants` — USD, EUR, GBP, CAD, GHS, NGN, KES, ZAR
- **Security**: `EncryptedCharField` for sensitive data (API keys, webhook secrets)
- **FSM**: Manual state machine via `can_transition_to()` / `transition_status()` (not django-fsm)
- **Accounting**: Double-entry `LedgerEntry` model (debit/credit pairs)

### eexports (Canadian Vehicle Export Platform)

- **Base**: Standard Django `models.Model` with `created_at`/`updated_at` (auto_now_add/auto_now)
- **Money**: Native `DecimalField` (max_digits=10-12, decimal_places=2), CAD primary currency
- **Users**: Custom `AbstractUser` with role field (admin/dealer/broker/buyer)
- **Domain**: Canadian diaspora buyers exporting vehicles to Africa
- **Compliance**: PIPEDA/Law 25, OMVIC/AMVIC, ISO 6346/18602/28000, SOLAS VGM, CBSA/ACI
- **i18n**: `gettext_lazy` throughout, English/French
- **Sanitization**: `sanitize_html()` on all user-generated text fields

---

## 2. APP 1: nzila-trade-os-main

### 2.1 deals/models.py (1151 lines)

#### `Deal`

| Field | Type | Notes |
|-------|------|-------|
| deal_number | CharField(unique) | Auto-generated |
| corridor | FK → Corridor | |
| seller_org | FK → Organization | |
| buyer_org | FK → Organization | |
| lead | FK → Lead (nullable) | |
| external_buyer_name | CharField | |
| product_category | CharField | See PRODUCT_CATEGORY_CHOICES |
| requires_sample | BooleanField | |
| deal_type | CharField | import / export / domestic |
| status | CharField | See STATUS_CHOICES |
| agreed_price_cents | MoneyField | Stored in cents |
| currency | CharField(3) | CURRENCY_CHOICES |
| deposit_amount_cents | MoneyField | |
| payment_terms | TextField | |
| notes | TextField | |
| approved_by | FK → User (nullable) | |
| approved_at | DateTimeField | |
| closed_at | DateTimeField | |

**STATUS_CHOICES**: `draft → pending_approval → approved → deposit_pending → docs_pending → ready_to_ship → shipped → in_transit → arrived → delivered → closed → disputed → cancelled`

**DEAL_TYPE_CHOICES**: `import`, `export`, `domestic`

**PRODUCT_CATEGORY_CHOICES**: `Hair`, `Beauty`, `Fashion`, `Food`, `Cosmetics`, `Building`, `Home`, `Electronics`, `Agriculture`, `Vehicles`, `Other`

**Methods**: `can_transition_to(new_status)`, `transition_status(new_status, user)`. Auto-creates `DealCommission` on delivery.

#### `DealItem`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| inventory | FK → InventoryItem (nullable) | |
| product_variant | FK → ProductVariant (nullable) | |
| quantity | IntegerField | |
| unit_price_cents | MoneyField | |
| total_price_cents | MoneyField | |
| lot_number | CharField | |
| production_date / expiry_date | DateField | |
| qc_status | CharField | pending / in_progress / passed / failed / conditional |
| notes | TextField | |

#### `DealPricing`

| Field | Type | Notes |
|-------|------|-------|
| deal | OneToOne → Deal | |
| base_price_cents | MoneyField | |
| currency | CharField(3) | |
| shipping_cost_cents | MoneyField | |
| insurance_cost_cents | MoneyField | |
| customs_duties_cents | MoneyField | |
| platform_fee_cents | MoneyField | |
| other_fees_cents | MoneyField | |
| total_price_cents | MoneyField | Auto-calculated on save |

#### `ReferralAgreement`

| Field | Type | Notes |
|-------|------|-------|
| referrer_org | FK → Organization | |
| referred_org | FK → Organization | |
| corridor | FK → Corridor | |
| commission_rate | DecimalField | |
| commission_type | CharField | percentage / fixed |
| status | CharField | active / inactive / expired |
| valid_from / valid_until | DateField | |

#### `DealCommission`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| organization | FK → Organization | |
| commission_type | CharField | referral / platform_fee / service_fee / partner_share |
| amount_cents | MoneyField | |
| currency | CharField(3) | |
| payout_status | CharField | pending / processing / paid / failed |
| payout_date | DateField | |
| payout_reference | CharField | |

#### `DealMilestone`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| partner_assignment | FK → ShipmentPartnerAssignment (nullable) | |
| milestone_type | CharField | sample_approval / deposit_received / goods_dispatched / customs_cleared / goods_delivered |
| status | CharField | pending / in_progress / completed / skipped |
| sequence_order | IntegerField | Enforces sequential completion |
| completed_at | DateTimeField | |
| completed_by | FK → User | |
| notes | TextField | |

#### `MilestonePayment`

| Field | Type | Notes |
|-------|------|-------|
| milestone | FK → DealMilestone | |
| escrow_transaction | FK → EscrowTransaction | |
| payment_percentage | DecimalField | |
| payment_amount_cents | MoneyField | |
| payment_currency | CharField(3) | |
| payment_status | CharField | pending / processing / completed / failed |

---

### 2.2 listings/models.py (508 lines)

#### `Listing`

| Field | Type | Notes |
|-------|------|-------|
| supplier_org | FK → Organization | |
| product | FK → Product | |
| product_variant | FK → ProductVariant (nullable) | |
| title | CharField | |
| description | TextField | |
| sku | CharField | |
| base_price_cents | MoneyField | |
| currency | CharField(3) | |
| moq | IntegerField | Minimum order quantity |
| lead_time_days | IntegerField | |
| ships_from_country / city | CharField | |
| status | CharField | draft / active / paused / out_of_stock / discontinued |
| visibility | CharField | public / private / restricted |
| track_inventory | BooleanField | |
| available_quantity | IntegerField | |
| search_vector | SearchVectorField | PostgreSQL FTS |
| search_keywords | TextField | |
| published_at | DateTimeField | |

#### `PriceBreak`

| Field | Type | Notes |
|-------|------|-------|
| listing | FK → Listing | |
| min_quantity | IntegerField | |
| unit_price_cents | MoneyField | |
| | | Unique: listing + min_quantity |

#### `ListingInventory`

| Field | Type | Notes |
|-------|------|-------|
| listing | FK → Listing | |
| warehouse_location | CharField | |
| allocated_quantity | IntegerField | |
| priority | IntegerField | |

#### `ListingImage`

| Field | Type | Notes |
|-------|------|-------|
| listing | FK → Listing | |
| image_url | URLField | |
| alt_text | CharField | |
| display_order | IntegerField | |
| is_primary | BooleanField | |

#### `Offer`

| Field | Type | Notes |
|-------|------|-------|
| listing | FK → Listing | |
| buyer_org | FK → Organization | |
| created_by | FK → User | |
| offer_number | CharField(unique) | |
| unit_price_cents | MoneyField | |
| min_quantity / max_quantity | IntegerField | |
| valid_from / valid_until | DateTimeField | |
| status | CharField | draft / sent / accepted / declined / expired / withdrawn |
| notes | TextField | |
| message_to_buyer | TextField | |
| responded_at | DateTimeField | |
| buyer_response_note | TextField | |

---

### 2.3 shipments/models.py (983 lines)

#### `Shipment`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| corridor | FK → Corridor | |
| tracking_number | CharField(unique) | |
| carrier_name / carrier_contact | CharField | |
| status | CharField | See STATUS_CHOICES |
| shipping_method | CharField | air_freight / sea_freight / road_transport / rail / courier |
| origin / destination / current_location | CharField | |
| estimated_departure / actual_departure | DateTimeField | |
| estimated_arrival / actual_arrival | DateTimeField | |
| total_weight / total_volume | DecimalField | |
| number_of_packages | IntegerField | |
| insurance_value / insurance_currency | MoneyField / CharField | |
| customs_cleared | BooleanField | |
| customs_clearance_date | DateTimeField | |
| special_instructions / notes | TextField | |

**STATUS_CHOICES**: `pending → in_transit → customs_clearance → out_for_delivery → delivered → delayed → cancelled`

#### `ShipmentMilestone`

| Field | Type | Notes |
|-------|------|-------|
| shipment | FK → Shipment | |
| milestone_type | CharField | departed / in_transit / customs_inspection / customs_cleared / out_for_delivery / delivered / delayed / exception |
| location | CharField | |
| timestamp | DateTimeField | |
| notes | TextField | |
| recorded_by | FK → User | |

#### `ShipmentItem`

| Field | Type | Notes |
|-------|------|-------|
| shipment | FK → Shipment | |
| deal_item | FK → DealItem | |
| quantity_shipped | IntegerField | |
| package_number | CharField | |
| weight | DecimalField | |
| notes | TextField | |

#### `ShipmentPartnerAssignment`

| Field | Type | Notes |
|-------|------|-------|
| shipment | FK → Shipment | |
| partner | FK → ExecutionPartner | |
| assigned_by | FK → User | |
| milestone_type | CharField | pickup / export_clearance / international_transit / import_clearance / qc_inspection / warehousing / last_mile_delivery |
| status | CharField | pending / accepted / in_progress / completed / failed / cancelled |
| evidence_required | BooleanField | |
| evidence_types | JSONField | |
| sla_deadline | DateTimeField | |
| escalation tracking fields | Various | |

#### `PartnerAttestation`

| Field | Type | Notes |
|-------|------|-------|
| assignment | FK → ShipmentPartnerAssignment | |
| photo1 / photo2 / photo3 | ImageField | |
| document | FileField | |
| gps_latitude / gps_longitude | DecimalField | |
| gps_captured_at | DateTimeField | |
| gps_accuracy | FloatField | |
| signature_image | ImageField | |
| signatory details | CharField fields | |
| review_status | CharField | pending / approved / rejected / clarification_requested |
| notes | TextField | |
| completeness_score | property | Computed |

---

### 2.4 organizations/models.py (1221 lines)

#### `Organization`

| Field | Type | Notes |
|-------|------|-------|
| name | CharField | |
| type | CharField | exporter / importer / both / service_provider |
| country / city / address | CharField | |
| phone / email / website | CharField | |
| tax_id / registration_number | CharField | |
| business_license | CharField | |
| license_expiry_date | DateField | |
| verification_tier | CharField | unverified / verified / trusted |
| compliance_status | CharField | compliant / pending_review / non_compliant / expired |
| credit_limit / credit_limit_currency / credit_limit_used | MoneyField / CharField | |
| payment_terms_days | IntegerField | |
| is_supplier | BooleanField | |
| **Supplier scoring** | DecimalFields | defect_rate, doc_accuracy, ontime_ship, dispute_rate, avg_dispute_days |
| **Buyer scoring** | DecimalFields | payment_punctuality, avg_payment_delay, clearance_readiness, dispute_initiation, repeat_purchase |
| total_deals / active_deals | IntegerField | |

**STATUS_CHOICES**: `active / inactive / suspended / pending_verification`

#### `OrganizationMembership`

| Field | Type | Notes |
|-------|------|-------|
| organization | FK → Organization | |
| user | FK → User | |
| role | CharField | owner / admin / manager / member / viewer |
| status | CharField | active / inactive / suspended / pending |
| permissions | JSONField | |
| is_primary | BooleanField | |
| invited_by | FK → User | |

#### `VerificationRequest`

| Field | Type | Notes |
|-------|------|-------|
| organization | FK → Organization | |
| requested_tier | CharField | |
| current_tier | CharField | |
| status | CharField | pending / under_review / approved / rejected / more_info_required |
| requested_by | FK → User | |
| business_justification | TextField | |
| document_ids | JSONField | |

#### `OrganizationScore`

Historical scoring snapshot — FK → Organization, all supplier/buyer metrics as DecimalFields.

#### `OrganizationDocument`

| Field | Type | Notes |
|-------|------|-------|
| organization | FK → Organization | |
| document_type | CharField | business_license / tax_certificate / export_license / import_license / certification / insurance / other |
| title / document_number | CharField | |
| file_path | CharField | |
| file_size | IntegerField | |
| issue_date / expiry_date | DateField | |
| verification fields | Various | |

#### `ExecutionPartner`

| Field | Type | Notes |
|-------|------|-------|
| organization | OneToOne → Organization | |
| partner_type | CharField | freight_forwarder / clearing_agent / quality_inspector / warehouse / last_mile / customs_broker / insurance_provider |
| service_categories | JSONField | |
| geographic_coverage | JSONField | |
| sla_config | JSONField | response_hours, completion_hours |
| **Performance** | DecimalFields | sla_compliance_rate, exception_rate, proof_quality_score |
| total_assignments / total_completions | IntegerField | |

#### `CorridorPartner`

FK → Corridor + FK → ExecutionPartner. Fields: product_categories(JSON), is_primary, sla_config(JSON), fee_structure(JSON), performance tracking.

#### `PartnerPerformanceMetric`

FK → ExecutionPartner. Monthly rollup — assignment volume, SLA metrics, quality metrics, exception tracking.

---

### 2.5 brokers/models.py (772 lines)

#### `BrokerFirmProfile`

| Field | Type | Notes |
|-------|------|-------|
| organization | FK → Organization | |
| legal_name / trade_name | CharField | |
| cra_business_number | CharField | Canadian tax ID |
| address / contacts | JSONField | |
| broker_license_identifiers | JSONField | |
| service_coverage | JSONField | |
| data_exchange_mode | CharField | manual / csv / sftp / api / edi |
| integration_config | JSONField | |
| api_secret_key | CharField | |
| sla_json | JSONField | |
| escalation_contacts | JSONField | |
| status | CharField | pending / active / suspended / terminated |

#### `BrokerAssignment`

FK → Corridor + FK → BrokerFirmProfile. `assignment_type`: primary / backup / client_provided. UniqueConstraint on active per type.

#### `ImportClearanceCase`

| Field | Type | Notes |
|-------|------|-------|
| corridor | FK → Corridor | |
| related_order / related_shipment | FK (nullable) | |
| importer_of_record | FK → Organization | |
| broker_firm | FK → BrokerFirmProfile | |
| assigned_broker_agent | FK → User | |
| status | CharField | intake / assigned / doc_review / ready_for_entry / entry_submitted / under_review / inspection / payment_pending / released / closed / cancelled |
| clearance_mode | CharField | nzila_managed / client_managed |
| target/actual clearance dates | DateTimeField | |
| milestones | JSONField | |
| commercial_value_cad | DecimalField | |
| duty_tax_estimate_cad | DecimalField | |
| customs_entry_number | CharField | |
| hs_codes | JSONField | |
| sla_deadline | DateTimeField | |
| doc_completeness_pct | DecimalField | |

#### `ClearanceDocument`

FK → ImportClearanceCase + FK → Document. Types: commercial_invoice / packing_list / bill_of_lading / certificate_of_origin / import_permit / phytosanitary_cert / inspection_cert / sds / other. Status: missing / requested / submitted / approved / rejected.

#### `ClearanceException`

FK → ImportClearanceCase. Exception types, severity (low/medium/high), status (open/in_progress/escalated/resolved/closed), SLA tracking.

#### `BrokerServiceEvent`

FK → ImportClearanceCase. Time-tracking events with event_type, minutes_spent, actor, billable flag, rate_cad_per_hour.

---

### 2.6 documents/models.py

#### `DocumentType`

| Field | Type | Notes |
|-------|------|-------|
| code | CharField(unique) | |
| name | CharField | |
| category | CharField | Same PRODUCT_CATEGORY_CHOICES as Deal |
| required | BooleanField | |
| must_be_verified | BooleanField | |
| template_url | URLField | |
| description | TextField | |
| is_active | BooleanField | |

#### `DocumentPack`

OneToOne → Deal. Status: `incomplete / complete / verified`. Has `update_status()`.

#### `Document`

| Field | Type | Notes |
|-------|------|-------|
| document_pack | FK → DocumentPack | |
| document_type | FK → DocumentType | |
| document_type_code / product_category | CharField | |
| file_name / file_url / file_path | CharField | |
| file_size | IntegerField | |
| mime_type | CharField | |
| uploaded_by | FK → User | |
| status | CharField | pending_upload / uploaded / pending_review / verified / rejected |
| rejection_reason | TextField | |

#### `MediaFile`

Generic polymorphic via `entity_type` + `org_id`. File types: image / video / pdf / other.

---

### 2.7 finance/models.py (2888 lines)

#### `Invoice`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| from_org / to_org | FK → Organization | |
| invoice_number | CharField(unique) | |
| amount_cents | MoneyField | |
| currency | CharField(3) | |
| due_date | DateField | |
| paid_date | DateField | |
| status | CharField | draft / sent / paid / overdue / cancelled |

#### `InvoiceLineItem`

FK → Invoice. Fields: description, quantity, unit_price_cents, total_cents.

#### `Payment`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| invoice | FK → Invoice | |
| from_org / to_org | FK → Organization | |
| amount_cents | MoneyField | |
| currency | CharField(3) | |
| payment_type | CharField | deposit / final_payment / commission / refund / partial_payment / other |
| payment_method | CharField | |
| transaction_reference | CharField | |
| status | CharField | pending / processing / completed / failed / refunded |
| webhook_payload | JSONField | |

Creates double-entry `LedgerEntry` on completion.

#### `EscrowAccount`

| Field | Type | Notes |
|-------|------|-------|
| deal | OneToOne → Deal | |
| account_number | CharField(unique) | |
| balance_amount_cents | MoneyField | |
| balance_currency | CharField(3) | |
| status | CharField | inactive / active / hold / closed |

Methods: `deposit()`, `release()` — both create `LedgerEntry` pairs.

#### `EscrowTransaction`

| Field | Type | Notes |
|-------|------|-------|
| escrow_account | FK → EscrowAccount | |
| from_account / to_account | FK → EscrowAccount | |
| related_milestone | FK → DealMilestone | |
| payment | FK → Payment | |
| transaction_type | CharField | deposit / release / return / hold / fee_deduction |
| status | CharField | pending / processing / completed / failed / reversed |
| amount_cents | MoneyField | |
| currency | CharField(3) | |
| original_amount / original_currency / exchange_rate | Multi-currency support | |
| provider_transaction_id | CharField | |
| webhook_data | JSONField | |

#### `PartnerFee`

FK → EscrowTransaction + FK → ExecutionPartner. Fields: fee_amount_cents, fee_percentage, fee_currency, status (pending/deducted/paid_out/failed), payout tracking.

#### `EscrowEvent`

FK → Deal. Event types: deposit_received / funds_released / funds_returned / funds_held. Links to Payment.

#### `ExchangeRate`

| Field | Type | Notes |
|-------|------|-------|
| base_currency / target_currency | CharField(3) | |
| rate | DecimalField(12,6) | |
| effective_date | DateField | |
| source | CharField | Default: exchangerate-api.com |
| is_active | BooleanField | |
| | | Unique: base + target + effective_date |

Class methods: `get_latest_rate()`, `convert()`, `get_supported_currencies()`.

#### `CurrencyPreference`

OneToOne → User. `preferred_currency` CharField(3).

#### `PaymentProvider`

| Field | Type | Notes |
|-------|------|-------|
| name | CharField | |
| provider_type | CharField | stripe / flutterwave |
| api_key | EncryptedCharField | |
| webhook_secret | EncryptedCharField | |
| is_active / is_test_mode | BooleanField | |
| supported_currencies | JSONField | |
| default_for_region | CharField | global / africa / europe / north_america / asia |
| config | JSONField | |

#### `PaymentIntent`

| Field | Type | Notes |
|-------|------|-------|
| escrow_transaction | OneToOne → EscrowTransaction | |
| provider | FK → PaymentProvider | |
| provider_intent_id | CharField(unique) | |
| amount_cents | MoneyField | |
| currency | CharField(3) | |
| status | CharField | created / requires_action / processing / succeeded / failed / canceled |
| deal | FK → Deal | |
| created_by | FK → User | |
| raw_webhook_payload | JSONField | |
| error_message | TextField | |

#### `FeeRule`

| Field | Type | Notes |
|-------|------|-------|
| name | CharField(unique) | |
| fee_type | CharField | marketplace_commission / payment_processing / listing_fee / transaction_fee / subscription_fee / premium_placement / verification_fee |
| calculation_method | CharField | percentage / fixed / tiered |
| value | DecimalField(10,4) | |
| tier_config | JSONField | For tiered pricing |
| applies_to | CharField | deal / order / listing / all |
| currency | CharField(3) | |
| min_fee_cents / max_fee_cents | MoneyField | |
| is_active | BooleanField | |
| effective_from / effective_until | DateTimeField | |

Method: `calculate_fee(amount)` with tiered support.

#### `PayoutSchedule`

| Field | Type | Notes |
|-------|------|-------|
| seller | FK → Organization | |
| order | FK → Order (nullable) | |
| deal | FK → Deal (nullable) | |
| amount_cents | MoneyField | |
| platform_fee_cents | MoneyField | |
| payment_processing_fee_cents | MoneyField | |
| net_amount_cents | MoneyField | |
| currency | CharField(3) | |
| scheduled_date / processed_date | DateTimeField | |
| status | CharField | pending / scheduled / processing / completed / failed / cancelled / on_hold |
| payment_method | CharField | bank_transfer / mobile_money / paypal / stripe / flutterwave / paystack / manual |
| payment_reference | CharField | |
| payment_details | JSONField | |
| failure_reason | TextField | |
| retry_count | IntegerField | |

#### `LedgerEntry`

| Field | Type | Notes |
|-------|------|-------|
| entry_type | CharField | credit / debit |
| account_type | CharField | seller / buyer / platform / escrow / payment_processor / bank |
| organization | FK → Organization (nullable) | |
| order | FK → Order (nullable) | |
| deal | FK → Deal (nullable) | |
| escrow_account | FK → EscrowAccount (nullable) | |
| payout | FK → PayoutSchedule (nullable) | |
| amount_cents | MoneyField | |
| currency | CharField(3) | |
| balance_before_cents / balance_after_cents | MoneyField | |
| transaction_type | CharField | order_payment / deal_payment / payout / refund / fee_collection / escrow_deposit / escrow_release / escrow_hold / adjustment |
| description | TextField | |
| reference | CharField | |
| metadata | JSONField | |
| created_by | FK → User | |

Class method: `validate_transaction_balance()` — ensures debits == credits.

#### `KYCVerification`

| Field | Type | Notes |
|-------|------|-------|
| user | FK → User (nullable) | |
| organization | FK → Organization (nullable) | Must have one or the other |
| verification_type | CharField | individual / business |
| provider | CharField | onfido / smile_identity / sumsub / manual |
| status | CharField | pending / submitted / under_review / approved / rejected / expired |
| provider_verification_id | CharField | |
| verification_data | JSONField | |
| confidence_score | DecimalField(5,2) | 0-100 |
| rejection_reason | TextField | |
| expiry_date | DateTimeField | |

#### `KYCDocument`

FK → KYCVerification. Document types: passport / national_id / drivers_license / residence_permit / selfie / proof_of_address / business_license / certificate_of_incorporation / tax_certificate / memorandum / articles / director_id / shareholder_registry. Status: pending / approved / rejected / expired.

#### `AMLRiskProfile`

| Field | Type | Notes |
|-------|------|-------|
| user | OneToOne → User (nullable) | |
| organization | OneToOne → Organization (nullable) | |
| risk_score | IntegerField | 0-100 |
| risk_level | CharField | low / medium / high / prohibited |
| risk_factors | JSONField | |
| high_risk_countries / sanctioned_countries | JSONField | |
| total_transaction_volume_cents | MoneyField | |
| large_transaction_count | IntegerField | |
| suspicious_pattern_count | IntegerField | |
| is_pep | BooleanField | Politically Exposed Person |
| is_sanctioned | BooleanField | |
| requires_enhanced_due_diligence | BooleanField | |

#### `AMLTransaction`

Compliance-monitored transactions. Fields: transaction_reference(unique), sender/recipient user/org FKs, amount_cents, risk_flags(JSON), risk_score, status (pending/cleared/flagged/under_investigation/reported), SAR filing details.

---

### 2.8 leads/models.py

#### `Lead`

| Field | Type | Notes |
|-------|------|-------|
| contact_name / email / phone / company / position | CharField | |
| source | CharField | website / referral / trade_show / cold_call / social_media / email_campaign / partner / other |
| interest | CharField | import / export / both |
| interested_products / interested_corridors | JSONField | |
| estimated_deal_value / currency | MoneyField / CharField | |
| status | CharField | new / contacted / qualified / proposal / negotiation / converted / lost / disqualified |
| score | IntegerField | 0-100 |
| quality | CharField | hot / warm / cold |
| assigned_to | FK → User | |
| organization | FK → Organization | |
| last_contact_date / next_followup_date | DateField | |
| conversion fields | Various | |
| loss_reason | CharField | |

#### `LeadActivity`

FK → Lead. Activity types: call / email / meeting / note / task / follow_up. Outcome: positive / neutral / negative.

#### `LeadConversion`

OneToOne → Lead, FK → Deal. Fields: conversion_date, days_to_convert, activities_count, conversion_notes.

---

### 2.9 orders/models.py (799 lines)

#### `Order`

| Field | Type | Notes |
|-------|------|-------|
| buyer_org | FK → Organization | |
| order_number | CharField(unique) | |
| status | CharField | cart / pending_payment / paid / processing / fulfilled / shipped / delivered / completed / cancelled / refunded / escalated_to_deal |
| subtotal_cents / shipping_cost_cents / platform_fee_cents / tax_amount_cents / total_amount_cents | MoneyField | |
| currency | CharField(3) | |
| shipping_address / billing_address | JSONField | |
| escalated_to_deal | OneToOne → Deal (nullable) | |
| escalation_reason | CharField | |

#### `OrderItem`

FK → Order + FKs to Product, ProductVariant, Listing, supplier_org. Fields: quantity, unit_price_cents, subtotal_cents, fulfillment_status (pending/processing/fulfilled/shipped/delivered/cancelled).

#### `OrderPayment`

FK → Order. Payment methods: stripe / bank_transfer / escrow / wallet / other. Status: pending / processing / completed / failed / refunded.

#### `OrderFulfillment`

FK → Order + FK → supplier_org + FK → Shipment. M2M → OrderItem. Fields: fulfillment_number(unique), status (pending/picking/packing/ready_to_ship/shipped/cancelled).

#### `ReturnRequest`

FK → Order. M2M → OrderItem. Fields: rma_number(unique), reason (defective/wrong_item/not_as_described/damaged/change_of_mind/other), status (requested/approved/rejected/in_transit/received/inspected/refunded/closed), refund_amount_cents.

---

### 2.10 rfq/models.py (695 lines)

#### `RFQ`

| Field | Type | Notes |
|-------|------|-------|
| buyer_org | FK → Organization | |
| corridor | FK → Corridor | |
| target_suppliers | M2M → Organization | |
| rfq_number | CharField(unique) | |
| title / description | CharField / TextField | |
| status | CharField | draft / sent / quoted / negotiating / accepted / expired / cancelled |
| valid_until | DateTimeField | |
| attachments | JSONField | |
| search_vector | SearchVectorField | |
| accepted_quote | FK → Quote (nullable) | |

#### `RFQLine`

FK → RFQ + FKs to Product, ProductVariant. Fields: line_number, description, quantity_requested, unit_of_measure, target_price_cents, target_currency, specifications(JSON).

#### `Quote`

| Field | Type | Notes |
|-------|------|-------|
| rfq | FK → RFQ | |
| supplier_org | FK → Organization | |
| quote_number | CharField(unique) | |
| status | CharField | draft / sent / revised / accepted / rejected / expired / withdrawn |
| revision_number | IntegerField | |
| total_quoted_amount_cents | MoneyField | |
| currency | CharField(3) | |
| converted_to_deal | OneToOne → Deal (nullable) | |

#### `QuoteLine`

FK → Quote + FK → RFQLine. Fields: unit_price_cents, currency, quantity_offered, lead_time_days, moq, incoterm (EXW/FOB/CIF/DDP).

---

### 2.11 corridors/models.py

#### `Corridor`

| Field | Type | Notes |
|-------|------|-------|
| name | CharField | |
| origin_country / destination_country | CharField | |
| status | CharField | active / inactive / under_review |
| is_active | BooleanField | |
| config | JSONField | |
| description / notes | TextField | |

#### `CorridorTemplate`

FK → Corridor. Product categories (vehicles-focused: cars/motorcycles/trucks/buses/agricultural_equipment/construction_equipment/electronics/machinery/food_products/textiles/other). Fields: required_documents(JSON), required_qc_checklists(M2M), customs_requirements, estimated_transit_days, estimated_customs_days.

#### `CorridorRequirement`

FK → Corridor. Requirement types: document / inspection / compliance / certification / other. Fields: title, description, is_mandatory, applies_to_categories(JSON), sort_order.

---

### 2.12 monetization/models.py (687 lines)

#### `PricingPlan`

| Field | Type | Notes |
|-------|------|-------|
| name / slug | CharField | |
| audience | CharField | importer / exporter / broker / forwarder / supplier / all |
| monthly_fee_cents / annual_fee_cents | MoneyField | |
| limits_json / features_json | JSONField | |
| is_public / is_active | BooleanField | |
| display_order | IntegerField | |

#### `Subscription`

| Field | Type | Notes |
|-------|------|-------|
| organization | FK → Organization | |
| user | FK → User | |
| plan | FK → PricingPlan | |
| status | CharField | trial / active / past_due / canceled / expired |
| billing_interval | CharField | monthly / annual |
| billing_provider / billing_subscription_id / billing_customer_id | CharField | |
| current_period_start / current_period_end | DateTimeField | |
| trial_end | DateTimeField | |
| cancel_at_period_end | BooleanField | |

#### `CorridorFeeOverride`

FK → Organization + FK → Corridor. Fields: fee_type, override_amount_cents, is_percentage, reason, valid_from/until.

#### `PremiumPlacementRule`

FK → Corridor. Pricing models: fixed / auction / cpm. Fields: product_category, placement_type, reserve_price_cents, duration_days, max_slots.

#### `PromotionCredit`

FK → Organization + FK → User. Fields: amount_cents, remaining_cents, reason, promotion_code, expires_at.

#### `ListingPlacement`

FK → Listing + FK → PremiumPlacementRule + FK → Organization. Status: pending / active / paused / expired / cancelled. Fields: bid_amount_cents, impressions, clicks.

---

## 3. APP 2: nzila_eexports-main

### 3.1 accounts/models.py — User

#### `User` (extends AbstractUser)

| Field | Type | Notes |
|-------|------|-------|
| role | CharField | admin / dealer / broker / buyer |
| phone / company_name / address / country | CharField | |
| preferred_language | CharField | en / fr |
| stripe_customer_id | CharField | |
| two_factor_enabled / two_factor_secret / phone_verified | BooleanField / CharField | |
| **PIPEDA/Law 25 Consent** | | |
| data_processing_consent / marketing_consent / third_party_sharing_consent | BooleanField | |
| consent_date / consent_ip_address / consent_version | Various | |
| data_export_requested_date / data_deletion_requested_date / data_rectification_requested_date | DateTimeField | |
| data_transfer_consent_africa | BooleanField | |
| **Diaspora Buyer Fields** | | |
| is_diaspora_buyer | BooleanField | |
| canadian_city / canadian_province / canadian_postal_code | CharField | |
| destination_country / destination_city | CharField | |
| buyer_type | CharField | personal / family / business |
| residency_status | CharField | citizen / pr / work_permit / study_permit / visitor |
| prefers_in_person_inspection | BooleanField | |
| **Dealer Showroom** | | |
| showroom_address / showroom_city / showroom_province / showroom_postal_code / showroom_phone | CharField | |
| business_hours | TextField | |
| allows_test_drives / requires_appointment | BooleanField | |
| **Notification Preferences** | | |
| sms/email/whatsapp/push_notifications_enabled | BooleanField | |
| notification_frequency | CharField | instant / hourly / daily / weekly / never |
| **Geo/Proximity** | | |
| latitude / longitude | DecimalField(9,6) | |
| travel_radius_km | IntegerField | 50/100/200/500/1000 |

---

### 3.2 vehicles/models.py (590 lines)

#### `Vehicle`

| Field | Type | Notes |
|-------|------|-------|
| dealer | FK → User (role=dealer) | |
| make / model / year | CharField / IntegerField | |
| vin | CharField(17, unique) | |
| condition | CharField | new / used_excellent / used_good / used_fair |
| mileage | IntegerField | km |
| color | CharField | |
| fuel_type | CharField | gasoline / diesel / electric / hybrid / plug-in-hybrid |
| transmission | CharField | |
| engine_type | CharField | 4-cylinder / 6-cylinder / 8-cylinder / electric / hybrid / diesel |
| drivetrain | CharField | fwd / rwd / awd / 4wd |
| price_cad | DecimalField(10,2) | |
| status | CharField | available / reserved / sold / shipped / delivered |
| description | TextField | |
| location | CharField | |
| latitude / longitude | DecimalField(9,6) | |
| main_image | ImageField | |
| lien_checked / lien_status | BooleanField / CharField | PPSA lien search |

#### `VehicleImage`

FK → Vehicle. Supports image + video. Fields: media_type, caption, is_primary, order, duration_seconds, thumbnail.

#### `Offer`

| Field | Type | Notes |
|-------|------|-------|
| vehicle | FK → Vehicle | |
| buyer | FK → User (role=buyer) | |
| offer_amount_cad | DecimalField | |
| message | TextField | |
| status | CharField | pending / accepted / rejected / countered / withdrawn / expired |
| counter_amount_cad | DecimalField | |
| counter_message | TextField | |
| valid_until | DateTimeField | |

#### `VehicleInspectionSlot`

FK → Vehicle. Fields: date, start_time, end_time, is_available, max_attendees.

#### `InspectionAppointment`

FK → VehicleInspectionSlot + FK → User(buyer). Status: pending / confirmed / completed / cancelled / no_show. Fields: contact_phone, contact_email, number_of_people, buyer_notes, dealer_notes, vehicle_rating, dealer_rating, interested_in_purchase.

---

### 3.3 deals/models.py (642 lines) + financial_models.py (777 lines)

#### `Lead`

| Field | Type | Notes |
|-------|------|-------|
| buyer | FK → User (role=buyer) | |
| vehicle | FK → Vehicle | |
| broker | FK → User (role=broker, nullable) | |
| status | CharField | new / contacted / qualified / negotiating / converted / lost |
| source | CharField | website / referral / broker / direct |
| notes | TextField | |
| last_contacted | DateTimeField | |

Method: `is_stalled()` — no update in 7 days.

#### `Deal`

| Field | Type | Notes |
|-------|------|-------|
| lead | OneToOne → Lead (nullable) | |
| vehicle | FK → Vehicle | |
| buyer | FK → User (role=buyer) | |
| dealer | FK → User (role=dealer) | |
| broker | FK → User (role=broker, nullable) | |
| status | CharField | pending_docs / docs_verified / payment_pending / payment_received / ready_to_ship / shipped / completed / cancelled |
| agreed_price_cad | DecimalField(10,2) | |
| payment_method | CharField | bank_transfer / credit_card / wire / mobile_money / cash / crypto / financing |
| payment_status | CharField | pending / partial / paid / refunded / failed |
| completed_at | DateTimeField | |
| notes | TextField | |

Methods: `create_financial_terms()`, `create_standard_payment_schedule()`, `setup_financing()`, `get_payment_status_summary()`, `process_payment()`, `is_stalled()`.

#### `Document`

FK → Deal. Types: title / id / payment_proof / export_permit / customs / other. Status: pending / verified / rejected.

#### `DealFinancialTerms`

| Field | Type | Notes |
|-------|------|-------|
| deal | OneToOne → Deal | |
| total_price | DecimalField(12,2) | |
| currency | FK → Currency | |
| total_price_usd | DecimalField(12,2) | For reporting |
| deposit_percentage | DecimalField(5,2) | Default 20% |
| deposit_amount | DecimalField(12,2) | |
| deposit_due_date | DateTimeField | |
| deposit_paid / deposit_paid_at | BooleanField / DateTimeField | |
| balance_remaining | DecimalField(12,2) | |
| balance_due_date | DateTimeField | |
| total_paid | DecimalField(12,2) | |
| locked_exchange_rate / exchange_rate_locked_at | DecimalField / DateTimeField | |
| payment_term_days | IntegerField | Default 30 |
| grace_period_days | IntegerField | Default 3 |
| is_financed | BooleanField | |
| deposit_refundable / refund_percentage | BooleanField / DecimalField | |

#### `PaymentMilestone`

| Field | Type | Notes |
|-------|------|-------|
| deal_financial_terms | FK → DealFinancialTerms | |
| milestone_type | CharField | deposit / inspection / documentation / pre_shipment / delivery / custom |
| name / description | CharField / TextField | |
| sequence | IntegerField | |
| amount_due / amount_paid | DecimalField | |
| currency | FK → Currency | |
| due_date / paid_at | DateTimeField | |
| status | CharField | pending / partial / paid / overdue / waived |
| payments | M2M → Payment | |
| reminder_sent | BooleanField | |

#### `FinancingOption`

| Field | Type | Notes |
|-------|------|-------|
| deal | OneToOne → Deal | |
| financing_type | CharField | in_house / partner_lender / bank_loan / lease |
| lender_name / lender_contact | CharField | |
| financed_amount / down_payment | DecimalField(12,2) | |
| interest_rate | DecimalField(5,2) | Annual % |
| term_months | IntegerField | |
| monthly_payment / total_interest / total_amount | DecimalField(12,2) | Auto-calculated |
| status | CharField | pending_approval / approved / active / completed / defaulted / cancelled |
| credit_score / credit_check_passed | IntegerField / BooleanField | |
| first_payment_date / final_payment_date | DateField | |

Method: `generate_installment_schedule()` — creates monthly `FinancingInstallment` records.

#### `FinancingInstallment`

FK → FinancingOption. Fields: installment_number, due_date, amount_due, principal_amount, interest_amount, late_fee, amount_paid, remaining_balance, status (pending/paid/late/defaulted), days_late. Late fee calculation at 5% default.

---

### 3.4 commissions/models.py (800 lines)

#### `BrokerTier`

| Field | Type | Notes |
|-------|------|-------|
| broker | OneToOne → User | |
| current_tier | CharField | starter / bronze / silver / gold / platinum / diamond |
| country | CharField | African country (CI default) |
| city / timezone | CharField | |
| qualified_buyers_network | IntegerField | |
| buyer_conversion_rate | DecimalField(5,2) | |
| deals_this_month / total_deals | IntegerField | |
| volume_this_month / total_commissions_earned / average_deal_value | DecimalField | |
| streak_days / highest_month / last_deal_date | Gamification fields | |
| achievement_boost | DecimalField(4,2) | Permanent % boost |

Tier rates: starter=3%, bronze=3.5%, silver=4%, gold=4.5%, platinum=5%, diamond=5.5%.
Thresholds: 5/10/20/40/80 deals/month.

#### `DealerTier`

| Field | Type | Notes |
|-------|------|-------|
| dealer | OneToOne → User | |
| current_tier | CharField | standard / preferred / elite / premier |
| province | CharField | Canadian province |
| is_rural / is_first_nations | BooleanField | Market bonuses |
| omvic_certified / amvic_certified | BooleanField | |
| deals_this_quarter / total_deals | IntegerField | |
| average_deal_value / total_commissions_earned | DecimalField | |
| welcome_bonus_paid / first_deal_bonus_paid / fast_start_bonus_paid | BooleanField | |

Tier rates: standard=5%, preferred=5.5%, elite=6%, premier=6.5%.
Market bonuses: major province +0.5%, maritime +0.75%, rural +1%, First Nations +1.5%.

#### `BonusTransaction`

FK → User. Types: welcome / first_deal / fast_start / certification / referral / achievement / milestone. Status: pending / approved / paid / cancelled.

#### `Commission`

| Field | Type | Notes |
|-------|------|-------|
| deal | FK → Deal | |
| recipient | FK → User | |
| commission_type | CharField | broker / dealer |
| amount_cad | DecimalField(10,2) | |
| amount_usd | DecimalField(10,2) | |
| exchange_rate | DecimalField(10,6) | |
| payment_currency | CharField | CAD / USD |
| percentage | DecimalField(5,2) | |
| status | CharField | pending / approved / paid / cancelled |

Signal: `post_save` on Deal → auto-creates broker + dealer commissions with tier-based rates on completion.

#### `InterestRate` (in commissions module)

Province + credit_tier + rate_percentage. Used for financing rate management.

---

### 3.5 shipments/models.py (954 lines) + tracking_models.py

#### `Shipment`

| Field | Type | Notes |
|-------|------|-------|
| deal | OneToOne → Deal | |
| tracking_number | CharField(unique) | |
| shipping_company | CharField | |
| origin_port / destination_port / destination_country | CharField | |
| status | CharField | pending / in_transit / customs / delivered / delayed |
| GPS: current_latitude / current_longitude / last_location_update | DecimalField / DateTimeField | |
| **Container (ISO 6346)** | | |
| container_number / container_type | CharField | 20ft/40ft/40ft_high_cube/roro/flatbed/specialized |
| **Seal Tracking** | | |
| seal_number / seal_type | CharField | bolt/cable/electronic/barrier |
| seal_applied_at / seal_applied_by | Various | |
| seal_verified_at_origin / seal_verified_at_destination | BooleanField | |
| seal_intact | BooleanField | |
| **Lloyd's Register** | | |
| lloyd_register_tracking_id / lloyd_register_service_level / lloyd_register_certificate | Various | |
| lloyd_register_status | CharField | not_registered → ... → certificate_issued |
| **ISO 28000 Security** | | |
| security_risk_level | CharField | low / medium / high / critical |
| security_assessment fields | Various | |
| insurance_company / insurance_policy_number / insurance_coverage_amount | Various | |
| ctpat_compliant / iso_18602_compliant / iso_28000_audit_date | Various | |
| **SOLAS VGM** | | |
| vgm_weight_kg / vgm_method / vgm_certified_by / vgm_certification_date | Various | |
| **AMS (US Customs)** | | |
| ams_filing_number / ams_submission_date / ams_status / ams_scac_code | Various | |
| **ACI (Canada CBSA)** | | |
| aci_submission_date / cargo_control_document_number / pars_number / paps_number | Various | |
| aci_status | CharField | |
| **AES (US Export)** | | |
| aes_itn_number / schedule_b_code / export_license fields | Various | |
| **ENS (EU Entry)** | | |
| ens_mrn_number / ens_status / ens_lrn_number | Various | |
| **ISPS (Port Security)** | | |
| isps_facility_security_level / port certifications / SSAS | Various | |
| **HS Tariff & Customs** | | |
| hs_tariff_code / customs_value_declared / duty_paid / customs_broker | Various | |
| **Hazmat** | | |
| contains_hazmat / un_number / imdg_class / hazmat_emergency_contact | Various | |
| **Bill of Lading** | | |
| bill_of_lading_number / type / date / freight_terms / incoterm | Various | |
| consignee_name / consignee_address / notify_party | Various | |
| vessel_name / voyage_number / imo_vessel_number | Various | |

#### `ShipmentUpdate`

FK → Shipment. ISO 18602-compliant updates: iso_message_type (IFTSTA/GATELOC/CUSCAR/CONTRL/APERAK), iso_message_xml, verification_method (visual/rfid/gps/document/surveyor/customs), GPS coords.

#### `ShipmentMilestone` (tracking_models.py)

FK → Shipment. Types: pickup / departed_origin / in_transit / arrived_port / customs_clearance / out_for_delivery / delivered. Fields: title, description, location, lat/long, completed_at, is_completed, order.

#### `ShipmentPhoto` (tracking_models.py)

FK → Shipment. Types: loading / in_transit / arrival / customs / delivery / damage / other. Fields: photo, caption, description, location, lat/long, taken_at, uploaded_by.

---

### 3.6 documents/models.py

#### `ExportDocument`

| Field | Type | Notes |
|-------|------|-------|
| vehicle | FK → Vehicle | |
| buyer | FK → User (nullable) | |
| document_type | CharField | CBSA_FORM_1 / TITLE_GUIDE_{province} / LIEN_CERTIFICATE / EXPORT_CHECKLIST / BILL_OF_SALE / OTHER |
| file | FileField | pdf/doc/docx/jpg/png |
| status | CharField | PENDING / GENERATED / DELIVERED / EXPIRED / FAILED |
| expires_at | DateTimeField | |

#### `ExportChecklist`

OneToOne → Vehicle. Boolean checklist: title_verified, lien_checked, insurance_confirmed, payment_cleared, inspection_completed, cbsa_form_generated, title_guide_provided, export_ready. Method: `check_completion()`, `get_completion_percentage()`.

---

### 3.7 financing/models.py

#### `InterestRate`

Credit tiers: excellent(750+) / good(650-749) / fair(600-649) / poor(550-599) / bad(<550). Loan terms: 12-84 months. Per-tier annual rate + loan term.

#### `LoanScenario`

FK → User + FK → Vehicle. Full financing calculator: vehicle_price, down_payment, trade_in_value, loan_term_months, credit_tier, province. Calculates: PST/GST/HST by province, loan_amount, monthly_payment, total_interest, total_cost. Provincial tax rates hardcoded for all 13 provinces/territories.

#### `TradeInEstimate`

FK → User. Vehicle trade-in value estimation (mock KBB Canada). Three values: trade_in_value, private_party_value, retail_value. Depreciation algorithm: 20% year 1, 15% subsequent, mileage/condition/provincial adjustments.

---

### 3.8 payments/models.py

#### `Currency`

Fields: code(unique, ISO 4217), name, symbol, exchange_rate_to_usd, is_active, is_african, country, stripe_supported.

#### `PaymentMethod`

FK → User. Types: card / bank_account / mobile_money / crypto / cash / interac_etransfer. Card details (last4, brand, exp), bank details, mobile money (M-Pesa, MTN), Interac e-Transfer (email, security Q&A).

#### `Payment`

| Field | Type | Notes |
|-------|------|-------|
| user | FK → User | |
| deal | FK → Deal (nullable) | |
| shipment | FK → Shipment (nullable) | |
| payment_method | FK → PaymentMethod | |
| payment_for | CharField | deal_deposit / deal_final / deal_full / shipment / commission / other |
| amount | DecimalField(12,2) | |
| currency | FK → Currency | |
| amount_in_usd | DecimalField(12,2) | For reporting |
| stripe_payment_intent_id / stripe_charge_id / stripe_customer_id | CharField | |
| status | CharField | pending / processing / succeeded / failed / refunded / partially_refunded / canceled |
| refund_amount / refund_reason / refunded_at | Various | |
| receipt_url | URLField | |
| invoice | FK → Invoice | |

#### `Invoice`

FK → User + FK → Deal + FK → Shipment. Fields: invoice_number(unique), subtotal, tax_rate/amount, discount_amount, total, amount_paid, currency, issue_date, due_date, paid_date, pdf_file. Status: draft / sent / paid / partially_paid / overdue / canceled.

#### `InvoiceItem`

FK → Invoice. Fields: description, quantity, unit_price, amount, order.

#### `Transaction`

FK → User + FK → Payment + FK → Invoice. Audit trail. Types: payment / refund / commission / fee / adjustment / transfer. Tracks balance_before / balance_after. Reference number (unique).

#### `ExchangeRateLog`

FK → Currency. Fields: rate_to_usd, source, timestamp.

---

### 3.9 inspections/models.py (560 lines)

#### `ThirdPartyInspector`

| Field | Type | Notes |
|-------|------|-------|
| name / company | CharField | |
| city / province / address / postal_code | CharField | Canadian provinces |
| latitude / longitude | DecimalField(9,6) | |
| phone / email / website | Various | |
| certifications | CharField | ase / ari / red_seal / provincially_licensed / caa_approved / manufacturer_certified / independent |
| additional_certifications | TextField | |
| years_experience | IntegerField | |
| specializations | TextField | |
| mobile_service / service_radius_km | BooleanField / IntegerField | |
| inspection_fee / mobile_fee_extra | DecimalField | CAD |
| rating | DecimalField(3,2) | 0-5 stars |
| total_inspections / total_reviews | IntegerField | |
| is_active / is_verified | BooleanField | |

#### `InspectionReport`

| Field | Type | Notes |
|-------|------|-------|
| vehicle | FK → Vehicle | |
| inspector | FK → ThirdPartyInspector | |
| buyer | FK → User | |
| report_type | CharField | pre_purchase / comprehensive / mechanical / body_frame / electrical / safety / emissions |
| inspection_date | DateField | |
| report_file | FileField | |
| status | CharField | scheduled / in_progress / completed / cancelled |
| overall_condition | CharField | excellent / good / fair / poor / not_recommended |
| issues_found / recommendations | TextField | |
| estimated_repair_cost | DecimalField | CAD |
| Component scores (0-10) | IntegerFields | engine, transmission, suspension, brakes, body, interior |
| inspection_fee_paid | DecimalField | |
| payment_status | CharField | pending / paid / refunded |

#### `InspectorReview`

FK → ThirdPartyInspector + FK → User + OneToOne → InspectionReport. Rating: 1-5 overall + professionalism / thoroughness / communication / value sub-ratings. Helpful votes. Auto-updates inspector rating on save.

---

## 4. Cross-App Comparison & Overlap

| Domain | trade-os | eexports | Key Differences |
|--------|----------|----------|-----------------|
| **Users** | External (no User model; references `settings.AUTH_USER_MODEL`) | Custom `AbstractUser` with role (admin/dealer/broker/buyer), PIPEDA consent, diaspora fields | eexports has rich user model; trade-os uses Organization membership |
| **Organizations** | Full model: type, verification tiers, compliance, scoring, documents | No org model — uses User.role + company_name | trade-os is org-centric; eexports is user-centric |
| **Deals** | Complex FSM (12 statuses), multi-product, corridor-linked, org-to-org | Simpler (8 statuses), single vehicle, user-to-user, CAD-only pricing | trade-os is B2B; eexports is C2C/B2C |
| **Deal Items** | `DealItem` with inventory/variant links, QC status | One Vehicle per Deal (no line items) | trade-os handles general goods; eexports is vehicle-specific |
| **Leads** | Rich: scoring (0-100), quality, CRM-style activities, conversion tracking | Simpler: buyer+vehicle+broker, stale check | |
| **Money** | MoneyField (cents), multi-currency (8 currencies) | DecimalField, CAD primary with USD conversion | trade-os is precision-first; eexports is simpler |
| **Payments** | Double-entry ledger, escrow, milestone payments, multiple providers (Stripe+Flutterwave) | Direct Stripe integration, per-user payment methods, Interac e-Transfer | trade-os has escrow; eexports has financing installments |
| **Invoices** | Org-to-org, cents-based | User-facing, standard decimals | |
| **Commissions** | `DealCommission` (org-level): referral/platform_fee/service_fee/partner_share | `Commission` (user-level): broker/dealer with tiered rates, gamification, bonuses | eexports has sophisticated tier system |
| **Shipments** | Multi-item, partner assignments, attestations, milestone gates | Single vehicle, massive ISO compliance (VGM, AMS, ACI, ENS, ISPS, HS, Hazmat, B/L), Lloyd's Register | eexports has regulatory depth; trade-os has partner coordination |
| **Documents** | DocumentType catalog, DocumentPack per deal, MediaFile generic | ExportDocument (CBSA-focused), ExportChecklist, basic Deal documents | Different document taxonomies |
| **Corridors** | Full model with templates, requirements, fee overrides | No corridor model — implicit Canada→Africa | |
| **Inspections** | QC via partner attestations in shipments | Dedicated module: ThirdPartyInspector, InspectionReport, scheduling | eexports has pre-purchase inspections |
| **Financing** | Escrow-based, no consumer financing | Full consumer financing: loan scenarios, installments, trade-in, provincial taxes | |
| **KYC/AML** | KYCVerification, KYCDocument, AMLRiskProfile, AMLTransaction | PIPEDA consent fields on User model | trade-os has dedicated compliance models |
| **Monetization** | PricingPlan, Subscription, placement rules, promotion credits | Commission tiers, bonuses, dealer/broker gamification | Different monetization strategies |

---

## 5. Canonical Model Recommendations

### Core Entities (Merge Both)

1. **Organization** — trade-os `Organization` as base, absorb eexports dealer/broker profiles
2. **User + Membership** — trade-os `OrganizationMembership` + eexports role/consent fields
3. **Deal** — Unified FSM combining both apps' statuses; support both single-item and multi-item
4. **DealItem** — Keep from trade-os; vehicle becomes a product type
5. **Product/Vehicle** — Abstract product with vehicle specialization
6. **Corridor** — Keep from trade-os; make it configurable per product type

### Financial (Merge Both)

7. **MoneyField** — Standardize on cents storage (trade-os pattern)
2. **Currency + ExchangeRate** — Merge both; use trade-os `ExchangeRate` with eexports `Currency` metadata
3. **Invoice + InvoiceLineItem** — Merge patterns; org-to-org + user-facing
4. **Payment** — Unified with double-entry ledger (trade-os), add eexports payment methods
5. **EscrowAccount + EscrowTransaction** — Keep from trade-os
6. **FinancingOption + Installment** — Port from eexports
7. **PaymentMilestone** — Merge DealMilestone (trade-os) + PaymentMilestone (eexports)
8. **Commission** — Unified with tier support from eexports + org-level from trade-os
9. **FeeRule + PayoutSchedule** — Keep from trade-os

### Logistics (Merge Both)

16. **Shipment** — Base from trade-os; add ISO/regulatory fields from eexports as optional
2. **ShipmentMilestone** — Merge both milestone models
3. **ShipmentPartnerAssignment + PartnerAttestation** — Keep from trade-os
4. **ShipmentUpdate/Photo** — Absorb eexports tracking into trade-os milestone system

### Documentation & Compliance

20. **DocumentType + Document** — trade-os catalog + eexports CBSA types
2. **ExportChecklist** — Port from eexports as configurable checklist
3. **KYC/AML** — Keep trade-os models; add PIPEDA consent from eexports
4. **Inspection** — Port eexports inspector/report models; integrate with trade-os partner system

### Commercial

24. **Listing + PriceBreak** — Keep from trade-os
2. **RFQ + Quote** — Keep from trade-os
3. **Order + Fulfillment** — Keep from trade-os
4. **Lead + LeadActivity** — Merge; trade-os is more complete

### Platform

28. **PricingPlan + Subscription** — Keep from trade-os
2. **BrokerTier + DealerTier** — Port from eexports as configurable tier system
3. **BrokerFirmProfile + ImportClearanceCase** — Keep from trade-os
