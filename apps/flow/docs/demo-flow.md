# Shop Quoter — Demo Flow

## Demo Scenario: End-to-End Quote Lifecycle

### Step 1: Login
- Sign in as `admin@demo-quoter.nzila.io`
- Verify dashboard loads with demo analytics

### Step 2: Create Quote
- Click "New Quote"
- Add customer: Demo Customer 1
- Add line items: Widget A (100 × $25), Widget B (50 × $75)
- Verify subtotal: $6,250

### Step 3: Price Calculation
- Observe automatic GST ($312.50) and QST ($623.44) calculation
- Verify total: $7,185.94

### Step 4: Policy Check
- Attempt price override above $10,000 threshold
- Observe policy engine requiring approval
- Approve with finance role

### Step 5: Send Quote
- Transition quote from DRAFT → SENT
- Verify audit trail entry created

### Step 6: Accept & Export
- Transition to ACCEPTED
- Export as JSON with evidence pack
- Verify evidence pack contains SBOM and policy checks

### Demo Analytics
- Show quotes this month: 47
- Conversion rate: 68%
- Average quote value: $8,500
