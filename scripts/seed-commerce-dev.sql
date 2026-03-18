-- ============================================================================
-- Commerce Dev Seed — matches current Drizzle schema
-- Org: ShopMoiCa (11111111-1111-1111-1111-111111111111)
-- Run against NATIVE PostgreSQL (port 5433):
--   $env:PGPASSWORD = "nzila_dev"
--   Get-Content scripts/seed-commerce-dev.sql | & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nzila -d nzila_automation -p 5433 -h localhost
-- ============================================================================

BEGIN;

-- ── Org ─────────────────────────────────────────────────────────────────────

INSERT INTO orgs (id, clerk_org_id, legal_name, jurisdiction, incorporation_number, registered_office_address, fiscal_year_end, policy_config, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'org_3B5A2N3XFYlFlefvZ5e8xYkMv5j', 'ShopMoiCa Demo Corp', 'QC-CA', 'NEQ-1234567',
   '{"street":"1000 Rue de la Gauchetière","city":"Montréal","province":"QC","postal":"H3B 4W5","country":"CA"}',
   '12-31', '{"tier":"PREMIUM"}', 'active')
ON CONFLICT (id) DO UPDATE SET clerk_org_id = EXCLUDED.clerk_org_id;

-- ── Customers ───────────────────────────────────────────────────────────────

INSERT INTO commerce_customers (id, org_id, name, email, phone, company, address, notes, metadata)
VALUES
  ('aaaaaaaa-0001-4000-a000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Marie Tremblay', 'marie@tremblay-fils.ca', '+1-514-555-0101', 'Tremblay & Fils',
   '{"street":"450 Rue Saint-Jean","city":"Montréal","province":"QC","postal":"H2Y 2R5","country":"CA"}',
   'Long-standing customer, prefers blue/white scheme', '{}'),

  ('aaaaaaaa-0001-4000-a000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Jean-Paul Bergeron', 'jp@bergeron-industriel.ca', '+1-418-555-0202', 'Bergeron Industriel',
   '{"street":"1200 Boul. Industriel","city":"Québec","province":"QC","postal":"G1K 7P4","country":"CA"}',
   'Industrial shelving — high-volume buyer', '{}'),

  ('aaaaaaaa-0001-4000-a000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Sophie Lavoie', 'sophie@lavoie-imports.ca', '+1-613-555-0303', 'Lavoie Imports',
   '{"street":"88 Wellington St","city":"Ottawa","province":"ON","postal":"K1A 0A6","country":"CA"}',
   'Office furniture specialist', '{}'),

  ('aaaaaaaa-0001-4000-a000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Pierre Gagnon', 'pierre@gagnon-construction.ca', '+1-450-555-0404', 'Gagnon Construction',
   '{"street":"3400 Autoroute Laval","city":"Laval","province":"QC","postal":"H7T 2H6","country":"CA"}',
   'Construction equipment buyer', '{}'),

  ('aaaaaaaa-0001-4000-a000-000000000005', '11111111-1111-1111-1111-111111111111',
   'Isabelle Roy', 'isabelle@roy-distribution.ca', '+1-438-555-0505', 'Roy Distribution',
   '{"street":"7600 Rue Transcanadienne","city":"Saint-Laurent","province":"QC","postal":"H4T 1V5","country":"CA"}',
   'Distribution center racking', '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Suppliers ───────────────────────────────────────────────────────────────

INSERT INTO commerce_suppliers (id, org_id, name, contact_name, email, phone, address, payment_terms, lead_time_days, rating, status, notes, tags, metadata)
VALUES
  ('bbbbbbbb-0001-4000-b000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Maple Sign Co', 'Daniel Côté', 'orders@maplesign.ca', '+1-514-555-1001',
   '{"street":"200 Rue Sainte-Catherine","city":"Montréal","province":"QC","postal":"H2X 1L4","country":"CA"}',
   'Net 30', 14, 5, 'active', 'Reliable signage supplier', '["signage","exterior"]', '{}'),

  ('bbbbbbbb-0001-4000-b000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Steel Grade Shelving', 'Marc Pelletier', 'po@steelgrade.ca', '+1-416-555-1002',
   '{"street":"5500 Dixie Rd","city":"Mississauga","province":"ON","postal":"L4W 4N2","country":"CA"}',
   'Net 45', 21, 4, 'active', 'Heavy-duty industrial shelving', '["shelving","industrial"]', '{}'),

  ('bbbbbbbb-0001-4000-b000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Apex Furniture Mfg', 'Louise Bélanger', 'sales@apexfurniture.ca', '+1-819-555-1003',
   '{"street":"1800 Boul. de lUniversité","city":"Sherbrooke","province":"QC","postal":"J1K 2R1","country":"CA"}',
   'Net 60', 28, 4, 'active', 'Custom office furniture manufacturer', '["furniture","office"]', '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Products ────────────────────────────────────────────────────────────────

INSERT INTO commerce_products (id, org_id, sku, name, name_fr, description, description_fr, category, subcategory, base_price, cost_price, supplier_id, status, weight_grams, dimensions, packaging_type, tags, customizable, metadata)
VALUES
  ('cccccccc-0001-4000-c000-000000000001', '11111111-1111-1111-1111-111111111111',
   'SIGN-LG-001', 'Large Exterior Sign', 'Grande Enseigne Extérieure',
   'Durable aluminum exterior sign with weather-resistant coating', 'Enseigne extérieure en aluminium durable avec revêtement résistant aux intempéries',
   'Signage', 'Exterior', 1200.00, 680.00,
   'bbbbbbbb-0001-4000-b000-000000000001', 'active', 15000, '{"width_cm":120,"height_cm":80,"depth_cm":5}', 'crate',
   '["exterior","aluminum","custom"]', true, '{}'),

  ('cccccccc-0001-4000-c000-000000000002', '11111111-1111-1111-1111-111111111111',
   'SIGN-SM-002', 'Interior Directional Sign', 'Panneau Directionnel Intérieur',
   'Acrylic wayfinding sign for interior use', 'Panneau de signalisation en acrylique pour usage intérieur',
   'Signage', 'Interior', 150.00, 55.00,
   'bbbbbbbb-0001-4000-b000-000000000001', 'active', 1200, '{"width_cm":40,"height_cm":25,"depth_cm":2}', 'box',
   '["interior","acrylic","wayfinding"]', true, '{}'),

  ('cccccccc-0001-4000-c000-000000000003', '11111111-1111-1111-1111-111111111111',
   'SHELF-HD-003', 'Heavy-Duty Shelving Unit', 'Étagère Industrielle Robuste',
   'Steel heavy-duty shelving unit for industrial use', 'Étagère en acier robuste pour usage industriel',
   'Shelving', 'Industrial', 450.00, 280.00,
   'bbbbbbbb-0001-4000-b000-000000000002', 'active', 45000, '{"width_cm":120,"height_cm":200,"depth_cm":60}', 'pallet',
   '["steel","industrial","heavy-duty"]', false, '{}'),

  ('cccccccc-0001-4000-c000-000000000004', '11111111-1111-1111-1111-111111111111',
   'BRKT-WL-004', 'Wall Bracket Kit', 'Ensemble de Supports Muraux',
   'Heavy-duty wall bracket kit for shelving systems', 'Ensemble de supports muraux pour systèmes d''étagères',
   'Shelving', 'Accessories', 35.00, 14.00,
   'bbbbbbbb-0001-4000-b000-000000000002', 'active', 2500, '{"width_cm":30,"height_cm":30,"depth_cm":10}', 'box',
   '["brackets","mounting","hardware"]', false, '{}'),

  ('cccccccc-0001-4000-c000-000000000005', '11111111-1111-1111-1111-111111111111',
   'DESK-EX-005', 'Executive Desk', 'Bureau Exécutif',
   'Solid walnut executive desk with cable management', 'Bureau exécutif en noyer massif avec gestion des câbles',
   'Furniture', 'Desks', 2200.00, 1350.00,
   'bbbbbbbb-0001-4000-b000-000000000003', 'active', 65000, '{"width_cm":180,"height_cm":76,"depth_cm":90}', 'blanket-wrap',
   '["walnut","executive","premium"]', true, '{}'),

  ('cccccccc-0001-4000-c000-000000000006', '11111111-1111-1111-1111-111111111111',
   'CHAIR-ERG-006', 'Ergonomic Chair', 'Chaise Ergonomique',
   'Adjustable ergonomic office chair with lumbar support', 'Chaise de bureau ergonomique ajustable avec support lombaire',
   'Furniture', 'Chairs', 850.00, 420.00,
   'bbbbbbbb-0001-4000-b000-000000000003', 'active', 18000, '{"width_cm":70,"height_cm":130,"depth_cm":70}', 'box',
   '["ergonomic","adjustable","lumbar"]', false, '{}'),

  ('cccccccc-0001-4000-c000-000000000007', '11111111-1111-1111-1111-111111111111',
   'RACK-PAL-007', 'Pallet Racking System', 'Système de Rayonnage à Palettes',
   'Heavy-duty pallet rack system, per bay', 'Système de rayonnage à palettes, par travée',
   'Racking', 'Pallet', 320.00, 190.00,
   'bbbbbbbb-0001-4000-b000-000000000002', 'active', 85000, '{"width_cm":275,"height_cm":600,"depth_cm":110}', 'pallet',
   '["racking","warehouse","pallet"]', false, '{}'),

  ('cccccccc-0001-4000-c000-000000000008', '11111111-1111-1111-1111-111111111111',
   'DRILL-IND-008', 'Industrial Drill Press', 'Perceuse Industrielle à Colonne',
   'Floor-standing industrial drill press with variable speed', 'Perceuse à colonne industrielle au sol à vitesse variable',
   'Equipment', 'Drilling', 4500.00, 2800.00,
   NULL, 'active', 120000, '{"width_cm":60,"height_cm":180,"depth_cm":60}', 'crate',
   '["industrial","drill","variable-speed"]', false, '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Inventory ───────────────────────────────────────────────────────────────

INSERT INTO commerce_inventory (id, org_id, product_id, current_stock, allocated_stock, available_stock, reorder_point, min_stock_level, max_stock_level, location, stock_status, last_restocked_at, metadata)
VALUES
  ('dddddddd-0001-4000-d000-000000000001', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000001', 12, 2, 10, 5, 3, 30, 'Warehouse A - Bay 1', 'in_stock', NOW() - INTERVAL '10 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000002', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000002', 85, 12, 73, 20, 10, 200, 'Warehouse A - Bay 2', 'in_stock', NOW() - INTERVAL '5 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000003', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000003', 6, 0, 6, 10, 5, 50, 'Warehouse B - Bay 1', 'low_stock', NOW() - INTERVAL '30 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000004', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000004', 150, 20, 130, 50, 25, 300, 'Warehouse B - Bay 2', 'in_stock', NOW() - INTERVAL '7 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000005', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000005', 3, 3, 0, 5, 2, 15, 'Warehouse C - Showroom', 'out_of_stock', NOW() - INTERVAL '45 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000006', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000006', 22, 10, 12, 10, 5, 40, 'Warehouse C - Showroom', 'in_stock', NOW() - INTERVAL '3 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000007', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000007', 2, 0, 2, 10, 5, 100, 'Warehouse B - Bay 3', 'low_stock', NOW() - INTERVAL '60 days', '{}'),

  ('dddddddd-0001-4000-d000-000000000008', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0001-4000-c000-000000000008', 0, 0, 0, 2, 1, 8, 'Warehouse A - Heavy', 'out_of_stock', NOW() - INTERVAL '90 days', '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Quotes ──────────────────────────────────────────────────────────────────

INSERT INTO commerce_quotes (id, org_id, customer_id, ref, current_version, status, pricing_tier, currency, subtotal, tax_total, total, valid_until, notes, metadata, created_by)
VALUES
  ('eeeeeeee-0001-4000-e000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000001', 'SQ-2026-001', 1, 'draft', 'standard', 'CAD',
   3600.00, 539.10, 4139.10, NOW() + INTERVAL '30 days',
   'Client prefers blue/white colour scheme', '{"title":"Custom Signage Package — Tremblay"}', 'demo-sales'),

  ('eeeeeeee-0001-4000-e000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000002', 'SQ-2026-002', 2, 'revised', 'standard', 'CAD',
   9700.00, 1452.08, 11152.08, NOW() + INTERVAL '15 days',
   'Client wants revised delivery timeline', '{"title":"Industrial Shelving — Bergeron"}', 'demo-sales'),

  ('eeeeeeee-0001-4000-e000-000000000003', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000003', 'SQ-2026-003', 1, 'accepted', 'premium', 'CAD',
   19500.00, 2919.38, 22419.38, NOW() + INTERVAL '45 days',
   '30% deposit required before production', '{"title":"Office Furniture Set — Lavoie"}', 'demo-sales'),

  ('eeeeeeee-0001-4000-e000-000000000004', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000004', 'SQ-2026-004', 1, 'accepted', 'standard', 'CAD',
   12200.00, 1826.70, 14026.70, NOW() + INTERVAL '60 days',
   NULL, '{"title":"Construction Equipment — Gagnon"}', 'demo-sales'),

  ('eeeeeeee-0001-4000-e000-000000000005', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000005', 'SQ-2026-005', 1, 'accepted', 'standard', 'CAD',
   20500.00, 3069.88, 23569.88, NOW() + INTERVAL '90 days',
   NULL, '{"title":"Distribution Center Racking — Roy"}', 'demo-sales'),

  ('eeeeeeee-0001-4000-e000-000000000006', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000001', 'SQ-2026-006', 1, 'accepted', 'standard', 'CAD',
   600.00, 89.85, 689.85, NOW() - INTERVAL '15 days',
   NULL, '{"title":"Replacement Signs — Tremblay (follow-up)"}', 'demo-sales'),

  ('eeeeeeee-0001-4000-e000-000000000007', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000002', 'SQ-2026-007', 1, 'accepted', 'standard', 'CAD',
   4500.00, 673.88, 5173.88, NOW() - INTERVAL '60 days',
   NULL, '{"title":"Shelving Phase 1 — Bergeron (historical)"}', 'demo-sales')
ON CONFLICT (id) DO NOTHING;


-- ── Quote Lines ─────────────────────────────────────────────────────────────

INSERT INTO commerce_quote_lines (id, org_id, quote_id, description, sku, quantity, unit_price, discount, line_total, sort_order, metadata)
VALUES
  -- SQ-2026-001 lines
  ('ff000001-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000001', 'Large Exterior Sign', 'SIGN-LG-001', 2, 1200.00, 0, 2400.00, 1, '{}'),
  ('ff000001-0001-4000-f000-000000000002', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000001', 'Interior Directional Sign', 'SIGN-SM-002', 8, 150.00, 0, 1200.00, 2, '{}'),

  -- SQ-2026-002 lines
  ('ff000002-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000002', 'Heavy-Duty Shelving Unit', 'SHELF-HD-003', 20, 450.00, 0, 9000.00, 1, '{}'),
  ('ff000002-0001-4000-f000-000000000002', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000002', 'Wall Bracket Kit', 'BRKT-WL-004', 20, 35.00, 0, 700.00, 2, '{}'),

  -- SQ-2026-003 lines
  ('ff000003-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000003', 'Executive Desk', 'DESK-EX-005', 5, 2200.00, 0, 11000.00, 1, '{}'),
  ('ff000003-0001-4000-f000-000000000002', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000003', 'Ergonomic Chair', 'CHAIR-ERG-006', 10, 850.00, 0, 8500.00, 2, '{}'),

  -- SQ-2026-004 lines
  ('ff000004-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000004', 'Industrial Drill Press', 'DRILL-IND-008', 2, 4500.00, 0, 9000.00, 1, '{}'),
  ('ff000004-0001-4000-f000-000000000002', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000004', 'Heavy-Duty Shelving Unit', 'SHELF-HD-003', 4, 450.00, 0, 1800.00, 2, '{}'),

  -- SQ-2026-005 lines
  ('ff000005-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000005', 'Pallet Racking System', 'RACK-PAL-007', 50, 320.00, 0, 16000.00, 1, '{}'),
  ('ff000005-0001-4000-f000-000000000002', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000005', 'Wall Bracket Kit', 'BRKT-WL-004', 100, 35.00, 0, 3500.00, 2, '{}'),

  -- SQ-2026-006 lines
  ('ff000006-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000006', 'Interior Directional Sign', 'SIGN-SM-002', 4, 150.00, 0, 600.00, 1, '{}'),

  -- SQ-2026-007 lines
  ('ff000007-0001-4000-f000-000000000001', '11111111-1111-1111-1111-111111111111',
   'eeeeeeee-0001-4000-e000-000000000007', 'Heavy-Duty Shelving Unit', 'SHELF-HD-003', 10, 450.00, 0, 4500.00, 1, '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Orders ──────────────────────────────────────────────────────────────────

INSERT INTO commerce_orders (id, org_id, customer_id, quote_id, ref, status, currency, subtotal, tax_total, total, shipping_address, billing_address, notes, metadata, created_by)
VALUES
  -- Order 1: Created (awaiting deposit) from quote 3
  ('11111111-0001-4000-1000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000003', 'eeeeeeee-0001-4000-e000-000000000003',
   'SO-2026-001', 'created', 'CAD', 19500.00, 2919.38, 22419.38,
   '{"street":"88 Wellington St","city":"Ottawa","province":"ON","postal":"K1A 0A6","country":"CA"}',
   '{"street":"88 Wellington St","city":"Ottawa","province":"ON","postal":"K1A 0A6","country":"CA"}',
   'Blocked: deposit not received', '{}', 'demo-sales'),

  -- Order 2: Confirmed (deposit paid, ready for procurement) from quote 4
  ('11111111-0001-4000-1000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000004', 'eeeeeeee-0001-4000-e000-000000000004',
   'SO-2026-002', 'confirmed', 'CAD', 12200.00, 1826.70, 14026.70,
   '{"street":"3400 Autoroute Laval","city":"Laval","province":"QC","postal":"H7T 2H6","country":"CA"}',
   '{"street":"3400 Autoroute Laval","city":"Laval","province":"QC","postal":"H7T 2H6","country":"CA"}',
   NULL, '{}', 'demo-sales'),

  -- Order 3: In fulfillment (production) from quote 5
  ('11111111-0001-4000-1000-000000000003', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000005', 'eeeeeeee-0001-4000-e000-000000000005',
   'SO-2026-003', 'fulfillment', 'CAD', 20500.00, 3069.88, 23569.88,
   '{"street":"7600 Rue Transcanadienne","city":"Saint-Laurent","province":"QC","postal":"H4T 1V5","country":"CA"}',
   '{"street":"7600 Rue Transcanadienne","city":"Saint-Laurent","province":"QC","postal":"H4T 1V5","country":"CA"}',
   NULL, '{}', 'demo-sales'),

  -- Order 4: In fulfillment (vendor delayed) — direct order, no quote
  ('11111111-0001-4000-1000-000000000004', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000001', NULL,
   'SO-2026-004', 'fulfillment', 'CAD', 7800.00, 1168.05, 8968.05,
   '{"street":"450 Rue Saint-Jean","city":"Montréal","province":"QC","postal":"H2Y 2R5","country":"CA"}',
   '{"street":"450 Rue Saint-Jean","city":"Montréal","province":"QC","postal":"H2Y 2R5","country":"CA"}',
   'Vendor Maple Sign Co delayed by 5 days', '{}', 'demo-admin'),

  -- Order 5: Shipped from quote 6
  ('11111111-0001-4000-1000-000000000005', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000001', 'eeeeeeee-0001-4000-e000-000000000006',
   'SO-2026-005', 'shipped', 'CAD', 600.00, 89.85, 689.85,
   '{"street":"450 Rue Saint-Jean","city":"Montréal","province":"QC","postal":"H2Y 2R5","country":"CA"}',
   '{"street":"450 Rue Saint-Jean","city":"Montréal","province":"QC","postal":"H2Y 2R5","country":"CA"}',
   NULL, '{}', 'demo-sales'),

  -- Order 6: Completed (full lifecycle) from quote 7
  ('11111111-0001-4000-1000-000000000006', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0001-4000-a000-000000000002', 'eeeeeeee-0001-4000-e000-000000000007',
   'SO-2026-006', 'completed', 'CAD', 4500.00, 673.88, 5173.88,
   '{"street":"1200 Boul. Industriel","city":"Québec","province":"QC","postal":"G1K 7P4","country":"CA"}',
   '{"street":"1200 Boul. Industriel","city":"Québec","province":"QC","postal":"G1K 7P4","country":"CA"}',
   NULL, '{}', 'demo-sales')
ON CONFLICT (id) DO NOTHING;


-- ── Order Lines ─────────────────────────────────────────────────────────────

INSERT INTO commerce_order_lines (id, org_id, order_id, quote_line_id, description, sku, quantity, unit_price, discount, line_total, sort_order, metadata)
VALUES
  -- SO-2026-001 lines (from SQ-003 quote)
  ('22222222-0001-4000-2000-000000000001', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000001', 'ff000003-0001-4000-f000-000000000001',
   'Executive Desk', 'DESK-EX-005', 5, 2200.00, 0, 11000.00, 1, '{}'),
  ('22222222-0001-4000-2000-000000000002', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000001', 'ff000003-0001-4000-f000-000000000002',
   'Ergonomic Chair', 'CHAIR-ERG-006', 10, 850.00, 0, 8500.00, 2, '{}'),

  -- SO-2026-002 lines (from SQ-004 quote)
  ('22222222-0001-4000-2000-000000000003', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000002', 'ff000004-0001-4000-f000-000000000001',
   'Industrial Drill Press', 'DRILL-IND-008', 2, 4500.00, 0, 9000.00, 1, '{}'),
  ('22222222-0001-4000-2000-000000000004', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000002', 'ff000004-0001-4000-f000-000000000002',
   'Heavy-Duty Shelving Unit', 'SHELF-HD-003', 4, 450.00, 0, 1800.00, 2, '{}'),

  -- SO-2026-003 lines (from SQ-005 quote)
  ('22222222-0001-4000-2000-000000000005', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000003', 'ff000005-0001-4000-f000-000000000001',
   'Pallet Racking System', 'RACK-PAL-007', 50, 320.00, 0, 16000.00, 1, '{}'),
  ('22222222-0001-4000-2000-000000000006', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000003', 'ff000005-0001-4000-f000-000000000002',
   'Wall Bracket Kit', 'BRKT-WL-004', 100, 35.00, 0, 3500.00, 2, '{}'),

  -- SO-2026-004 lines (direct order — custom sign job)
  ('22222222-0001-4000-2000-000000000007', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000004', NULL,
   'Large Exterior Sign — Custom', 'SIGN-LG-001', 3, 1200.00, 0, 3600.00, 1, '{}'),
  ('22222222-0001-4000-2000-000000000008', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000004', NULL,
   'Interior Directional Sign', 'SIGN-SM-002', 28, 150.00, 0, 4200.00, 2, '{}'),

  -- SO-2026-005 lines (from SQ-006 quote)
  ('22222222-0001-4000-2000-000000000009', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000005', 'ff000006-0001-4000-f000-000000000001',
   'Interior Directional Sign', 'SIGN-SM-002', 4, 150.00, 0, 600.00, 1, '{}'),

  -- SO-2026-006 lines (from SQ-007 quote)
  ('22222222-0001-4000-2000-000000000010', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000006', 'ff000007-0001-4000-f000-000000000001',
   'Heavy-Duty Shelving Unit', 'SHELF-HD-003', 10, 450.00, 0, 4500.00, 1, '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Invoices ────────────────────────────────────────────────────────────────

INSERT INTO commerce_invoices (id, org_id, order_id, customer_id, ref, status, currency, subtotal, tax_total, total, amount_paid, amount_due, due_date, issued_at, paid_at, notes, metadata, created_by)
VALUES
  -- Invoice 1: Draft for order 1 (deposit invoice)
  ('33333333-0001-4000-3000-000000000001', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000001', 'aaaaaaaa-0001-4000-a000-000000000003',
   'INV-2026-001', 'draft', 'CAD', 19500.00, 2919.38, 22419.38, 0, 22419.38,
   NOW() + INTERVAL '30 days', NULL, NULL,
   'Deposit invoice — 30% required', '{}', 'demo-finance'),

  -- Invoice 2: Issued for order 2 (deposit paid)
  ('33333333-0001-4000-3000-000000000002', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000002', 'aaaaaaaa-0001-4000-a000-000000000004',
   'INV-2026-002', 'partial_paid', 'CAD', 12200.00, 1826.70, 14026.70, 4208.01, 9818.69,
   NOW() + INTERVAL '45 days', NOW() - INTERVAL '10 days', NULL,
   '30% deposit received', '{}', 'demo-finance'),

  -- Invoice 3: Sent for order 5 (shipped, awaiting final payment)
  ('33333333-0001-4000-3000-000000000003', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000005', 'aaaaaaaa-0001-4000-a000-000000000001',
   'INV-2026-003', 'sent', 'CAD', 600.00, 89.85, 689.85, 0, 689.85,
   NOW() + INTERVAL '30 days', NOW() - INTERVAL '5 days', NULL,
   NULL, '{}', 'demo-finance'),

  -- Invoice 4: Paid for order 6 (completed lifecycle)
  ('33333333-0001-4000-3000-000000000004', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000006', 'aaaaaaaa-0001-4000-a000-000000000002',
   'INV-2026-004', 'paid', 'CAD', 4500.00, 673.88, 5173.88, 5173.88, 0,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '25 days',
   'Full payment received via EFT', '{}', 'demo-finance'),

  -- Invoice 5: Overdue for order 3 (production in progress)
  ('33333333-0001-4000-3000-000000000005', '11111111-1111-1111-1111-111111111111',
   '11111111-0001-4000-1000-000000000003', 'aaaaaaaa-0001-4000-a000-000000000005',
   'INV-2026-005', 'overdue', 'CAD', 20500.00, 3069.88, 23569.88, 7070.96, 16498.92,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '35 days', NULL,
   'Deposit paid; balance overdue', '{}', 'demo-finance')
ON CONFLICT (id) DO NOTHING;


-- ── Invoice Lines ───────────────────────────────────────────────────────────

INSERT INTO commerce_invoice_lines (id, org_id, invoice_id, order_line_id, description, quantity, unit_price, line_total, sort_order, metadata)
VALUES
  -- INV-2026-001 lines
  ('44444444-0001-4000-4000-000000000001', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000001', '22222222-0001-4000-2000-000000000001',
   'Executive Desk', 5, 2200.00, 11000.00, 1, '{}'),
  ('44444444-0001-4000-4000-000000000002', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000001', '22222222-0001-4000-2000-000000000002',
   'Ergonomic Chair', 10, 850.00, 8500.00, 2, '{}'),

  -- INV-2026-002 lines
  ('44444444-0001-4000-4000-000000000003', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000002', '22222222-0001-4000-2000-000000000003',
   'Industrial Drill Press', 2, 4500.00, 9000.00, 1, '{}'),
  ('44444444-0001-4000-4000-000000000004', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000002', '22222222-0001-4000-2000-000000000004',
   'Heavy-Duty Shelving Unit', 4, 450.00, 1800.00, 2, '{}'),

  -- INV-2026-003 lines
  ('44444444-0001-4000-4000-000000000005', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000003', '22222222-0001-4000-2000-000000000009',
   'Interior Directional Sign', 4, 150.00, 600.00, 1, '{}'),

  -- INV-2026-004 lines
  ('44444444-0001-4000-4000-000000000006', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000004', '22222222-0001-4000-2000-000000000010',
   'Heavy-Duty Shelving Unit', 10, 450.00, 4500.00, 1, '{}'),

  -- INV-2026-005 lines
  ('44444444-0001-4000-4000-000000000007', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000005', '22222222-0001-4000-2000-000000000005',
   'Pallet Racking System', 50, 320.00, 16000.00, 1, '{}'),
  ('44444444-0001-4000-4000-000000000008', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000005', '22222222-0001-4000-2000-000000000006',
   'Wall Bracket Kit', 100, 35.00, 3500.00, 2, '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Purchase Orders ─────────────────────────────────────────────────────────

INSERT INTO commerce_purchase_orders (id, org_id, supplier_id, ref, status, currency, subtotal, tax_total, shipping_cost, total, expected_delivery_date, sent_at, notes, metadata, created_by)
VALUES
  ('55555555-0001-4000-5000-000000000001', '11111111-1111-1111-1111-111111111111',
   'bbbbbbbb-0001-4000-b000-000000000002', 'PO-2026-001', 'draft', 'CAD',
   10800.00, 1617.30, 0, 12417.30, NOW() + INTERVAL '21 days', NULL,
   'Shelving for Gagnon order', '{}', 'demo-admin'),

  ('55555555-0001-4000-5000-000000000002', '11111111-1111-1111-1111-111111111111',
   'bbbbbbbb-0001-4000-b000-000000000002', 'PO-2026-002', 'acknowledged', 'CAD',
   20500.00, 3069.88, 250.00, 23819.88, NOW() + INTERVAL '14 days', NOW() - INTERVAL '7 days',
   'Racking for Roy distribution center', '{}', 'demo-admin'),

  ('55555555-0001-4000-5000-000000000003', '11111111-1111-1111-1111-111111111111',
   'bbbbbbbb-0001-4000-b000-000000000001', 'PO-2026-003', 'sent', 'CAD',
   7800.00, 1168.05, 150.00, 9118.05, NOW() + INTERVAL '10 days', NOW() - INTERVAL '3 days',
   'Signs for Tremblay — vendor delayed', '{}', 'demo-admin'),

  ('55555555-0001-4000-5000-000000000004', '11111111-1111-1111-1111-111111111111',
   'bbbbbbbb-0001-4000-b000-000000000001', 'PO-2026-004', 'received', 'CAD',
   600.00, 89.85, 0, 689.85, NOW() - INTERVAL '10 days', NOW() - INTERVAL '20 days',
   'Replacement signs delivered', '{}', 'demo-admin'),

  ('55555555-0001-4000-5000-000000000005', '11111111-1111-1111-1111-111111111111',
   'bbbbbbbb-0001-4000-b000-000000000003', 'PO-2026-005', 'partial_received', 'CAD',
   19500.00, 2919.38, 500.00, 22919.38, NOW() - INTERVAL '5 days', NOW() - INTERVAL '30 days',
   'Furniture for Lavoie — desks received, chairs pending', '{}', 'demo-admin')
ON CONFLICT (id) DO NOTHING;


-- ── Purchase Order Lines ────────────────────────────────────────────────────

INSERT INTO commerce_purchase_order_lines (id, org_id, purchase_order_id, product_id, description, sku, quantity, quantity_received, unit_cost, line_total, sort_order, metadata)
VALUES
  -- PO-2026-001 lines
  ('66666666-0001-4000-6000-000000000001', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000001', 'cccccccc-0001-4000-c000-000000000003',
   'Heavy-Duty Shelving Unit', 'SHELF-HD-003', 24, 0, 280.00, 6720.00, 1, '{}'),
  ('66666666-0001-4000-6000-000000000002', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000001', 'cccccccc-0001-4000-c000-000000000004',
   'Wall Bracket Kit', 'BRKT-WL-004', 24, 0, 14.00, 336.00, 2, '{}'),

  -- PO-2026-002 lines
  ('66666666-0001-4000-6000-000000000003', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000002', 'cccccccc-0001-4000-c000-000000000007',
   'Pallet Racking System', 'RACK-PAL-007', 50, 20, 190.00, 9500.00, 1, '{}'),
  ('66666666-0001-4000-6000-000000000004', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000002', 'cccccccc-0001-4000-c000-000000000004',
   'Wall Bracket Kit', 'BRKT-WL-004', 100, 40, 14.00, 1400.00, 2, '{}'),

  -- PO-2026-003 lines
  ('66666666-0001-4000-6000-000000000005', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000003', 'cccccccc-0001-4000-c000-000000000001',
   'Large Exterior Sign', 'SIGN-LG-001', 3, 0, 680.00, 2040.00, 1, '{}'),
  ('66666666-0001-4000-6000-000000000006', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000003', 'cccccccc-0001-4000-c000-000000000002',
   'Interior Directional Sign', 'SIGN-SM-002', 28, 0, 55.00, 1540.00, 2, '{}'),

  -- PO-2026-004 lines
  ('66666666-0001-4000-6000-000000000007', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000004', 'cccccccc-0001-4000-c000-000000000002',
   'Interior Directional Sign', 'SIGN-SM-002', 4, 4, 55.00, 220.00, 1, '{}'),

  -- PO-2026-005 lines
  ('66666666-0001-4000-6000-000000000008', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000005', 'cccccccc-0001-4000-c000-000000000005',
   'Executive Desk', 'DESK-EX-005', 5, 5, 1350.00, 6750.00, 1, '{}'),
  ('66666666-0001-4000-6000-000000000009', '11111111-1111-1111-1111-111111111111',
   '55555555-0001-4000-5000-000000000005', 'cccccccc-0001-4000-c000-000000000006',
   'Ergonomic Chair', 'CHAIR-ERG-006', 10, 3, 420.00, 4200.00, 2, '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Payments ────────────────────────────────────────────────────────────────

INSERT INTO commerce_payments (id, org_id, invoice_id, amount, method, reference, paid_at, metadata)
VALUES
  -- Deposit payment for INV-2026-002 (30% of $14026.70)
  ('77777777-0001-4000-7000-000000000001', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000002', 4208.01, 'eft', 'EFT-2026-0042', NOW() - INTERVAL '8 days', '{}'),

  -- Full payment for INV-2026-004
  ('77777777-0001-4000-7000-000000000002', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000004', 5173.88, 'eft', 'EFT-2026-0038', NOW() - INTERVAL '25 days', '{}'),

  -- Deposit payment for INV-2026-005 (30% of $23569.88)
  ('77777777-0001-4000-7000-000000000003', '11111111-1111-1111-1111-111111111111',
   '33333333-0001-4000-3000-000000000005', 7070.96, 'credit_card', 'CC-2026-9182', NOW() - INTERVAL '30 days', '{}')
ON CONFLICT (id) DO NOTHING;


-- ── Stock Movements ─────────────────────────────────────────────────────────

INSERT INTO commerce_stock_movements (id, org_id, inventory_id, product_id, movement_type, quantity, reference_type, reference_id, reason, performed_by, metadata)
VALUES
  -- Restock of large signs
  ('88888888-0001-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'dddddddd-0001-4000-d000-000000000001', 'cccccccc-0001-4000-c000-000000000001',
   'inbound', 10, 'purchase_order', '55555555-0001-4000-5000-000000000004',
   'Received from PO-2026-004', 'demo-admin', '{}'),

  -- Allocation of signs for order 4
  ('88888888-0001-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111',
   'dddddddd-0001-4000-d000-000000000001', 'cccccccc-0001-4000-c000-000000000001',
   'outbound', -2, 'order', '11111111-0001-4000-1000-000000000004',
   'Allocated to SO-2026-004', 'demo-sales', '{}'),

  -- Restock of small signs
  ('88888888-0001-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111',
   'dddddddd-0001-4000-d000-000000000002', 'cccccccc-0001-4000-c000-000000000002',
   'inbound', 50, 'purchase_order', '55555555-0001-4000-5000-000000000004',
   'Received from PO-2026-004', 'demo-admin', '{}'),

  -- Allocation of desks for Lavoie order
  ('88888888-0001-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111',
   'dddddddd-0001-4000-d000-000000000005', 'cccccccc-0001-4000-c000-000000000005',
   'outbound', -3, 'order', '11111111-0001-4000-1000-000000000001',
   'Allocated to SO-2026-001 (Lavoie furniture)', 'demo-sales', '{}'),

  -- Return/adjustment of chairs
  ('88888888-0001-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111',
   'dddddddd-0001-4000-d000-000000000006', 'cccccccc-0001-4000-c000-000000000006',
   'adjustment', 2, NULL, NULL,
   'Inventory count correction', 'demo-admin', '{}'),

  -- Partial receipt of racking
  ('88888888-0001-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111',
   'dddddddd-0001-4000-d000-000000000007', 'cccccccc-0001-4000-c000-000000000007',
   'inbound', 20, 'purchase_order', '55555555-0001-4000-5000-000000000002',
   'Partial receipt from PO-2026-002 (20 of 50 bays)', 'demo-admin', '{}')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT 'commerce_customers' AS tbl, COUNT(*) FROM commerce_customers WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_products', COUNT(*) FROM commerce_products WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_suppliers', COUNT(*) FROM commerce_suppliers WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_inventory', COUNT(*) FROM commerce_inventory WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_quotes', COUNT(*) FROM commerce_quotes WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_quote_lines', COUNT(*) FROM commerce_quote_lines WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_orders', COUNT(*) FROM commerce_orders WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_order_lines', COUNT(*) FROM commerce_order_lines WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_invoices', COUNT(*) FROM commerce_invoices WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_invoice_lines', COUNT(*) FROM commerce_invoice_lines WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_purchase_orders', COUNT(*) FROM commerce_purchase_orders WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_po_lines', COUNT(*) FROM commerce_purchase_order_lines WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_payments', COUNT(*) FROM commerce_payments WHERE org_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'commerce_stock_movements', COUNT(*) FROM commerce_stock_movements WHERE org_id = '11111111-1111-1111-1111-111111111111';
