// Carbon Accounting Service
// Calculate and track Union Eyes' carbon emissions (Scope 1, 2, 3)
// Monitor renewable energy commitments and SBTi targets


/**
 * Carbon Accounting Service
 * 
 * Tracks Union Eyes' carbon footprint:
 * - Scope 1: Direct emissions (currently 0 - no owned infrastructure)
 * - Scope 2: Indirect electricity emissions (cloud data centers)
 * - Scope 3: Supply chain emissions (remote work, SaaS vendors, travel, hardware)
 * 
 * Aligns with Science Based Targets initiative (SBTi):
 * - 2026 baseline: 225 tonnes CO2e/year
 * - 2030 target: 112.5 tonnes CO2e/year (50% reduction)
 * - 2050 target: Net-zero (90% reduction + 10% carbon removal)
 */

// Renewable energy regions (approved for deployment)
const RENEWABLE_REGIONS = {
  azure: [
    { region: 'canadacentral', name: 'Canada Central (Montreal)', renewable: 99, source: 'Hydro (Quebec)', pue: 1.2 },
    { region: 'canadaeast', name: 'Canada East (Quebec City)', renewable: 95, source: 'Hydro (Quebec)', pue: 1.3 },
  ],
  aws: [
    { region: 'us-west-2', name: 'US West (Oregon)', renewable: 95, source: 'Hydro, Wind', pue: 1.2 },
  ],
  gcp: [
    { region: 'northamerica-northeast1', name: 'North America Northeast (Montreal)', renewable: 100, source: 'Hydro', pue: 1.1 },
  ],
};

// Blocked regions (high fossil fuel usage)
const BLOCKED_REGIONS = [
  { region: 'us-east-1', name: 'US East (Virginia)', renewable: 30, issue: 'Coal & natural gas' },
  { region: 'us-east-2', name: 'US East (Ohio)', renewable: 25, issue: 'Coal' },
  { region: 'ap-south-1', name: 'Asia Pacific (Mumbai)', renewable: 15, issue: 'Coal' },
  { region: 'eu-central-1', name: 'Europe (Frankfurt)', renewable: 40, issue: 'Coal & gas (mixed)' },
  { region: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', renewable: 35, issue: 'Natural gas' },
];

// Emission factors (kg CO2e per unit)
const EMISSION_FACTORS = {
  // Electricity (kg CO2e per kWh)
  electricity: {
    canadaCentral: 0.002, // Quebec hydro (very clean)
    canadaEast: 0.002, // Quebec hydro
    usWest2: 0.003, // Oregon (hydro + wind mix)
    default: 0.15, // Mixed grid (fallback)
  },
  
  // Travel (kg CO2e per km)
  travel: {
    flight: {
      economy: 0.15, // Short-haul economy
      economyLongHaul: 0.10, // Long-haul economy (more efficient per km)
      business: 0.30, // Business class (2x economy due to space)
    },
    train: 0.04, // Electric rail
    car: 0.17, // Average gasoline car
    bus: 0.06, // Coach bus
  },
  
  // Remote work (kg CO2e per employee per year)
  remoteWork: {
    electricity: 1200, // Home office electricity
    heating: 3600, // Home heating/cooling
    internet: 150, // Internet infrastructure
    total: 4950, // ~5 tonnes CO2e/employee/year
  },
  
  // Hardware (kg CO2e per device, amortized over lifespan)
  hardware: {
    laptop: 300, // Embedded emissions, 3-year lifespan = 100 kg/year
    monitor: 200, // 4-year lifespan = 50 kg/year
    phone: 80, // 2-year lifespan = 40 kg/year
  },
};

export interface MonthlyEmissions {
  month: string; // 'YYYY-MM'
  scope1: number; // Direct emissions (tonnes CO2e)
  scope2: number; // Indirect electricity (tonnes CO2e)
  scope3: number; // Supply chain (tonnes CO2e)
  total: number; // Total emissions (tonnes CO2e)
  breakdown: {
    cloudInfrastructure: number;
    remoteWork: number;
    saasVendors: number;
    travel: number;
    hardware: number;
  };
  renewablePercent: number; // % of electricity from renewable sources
  perMember: number; // Emissions per active member (kg CO2e)
}

export interface YearlyEmissions {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  sbtiTarget: number; // SBTi target for this year
  percentOfTarget: number; // % of target achieved
  reductionFromBaseline: number; // % reduction from 2026 baseline (225 tonnes)
}

export class CarbonAccountingService {
  private readonly BASELINE_YEAR = 2026;
  private readonly BASELINE_EMISSIONS = 225; // tonnes CO2e
  private readonly TARGET_2030 = 112.5; // 50% reduction
  private readonly TARGET_2050 = 22.5; // 90% reduction (net-zero with 10% removal)

  /**
   * Calculate Monthly Emissions
   * Compute Scope 1, 2, 3 emissions for a given month
   */
  async calculateMonthlyEmissions(year: number, month: number): Promise<MonthlyEmissions> {
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    
    // Scope 1: Direct emissions (always 0 for Union Eyes - no owned infrastructure)
    const scope1 = 0;
    
    // Scope 2: Indirect electricity (cloud infrastructure)
    const scope2 = await this.calculateScope2(year, month);
    
    // Scope 3: Supply chain emissions
    const scope3Breakdown = await this.calculateScope3(year, month);
    const scope3 = Object.values(scope3Breakdown).reduce((sum, val) => sum + val, 0);
    
    // Total emissions
    const total = scope1 + scope2 + scope3;
    
    // Calculate renewable percent (weighted by electricity usage)
    const renewablePercent = await this.calculateRenewablePercent(year, month);
    
    // Per-member emissions (get active member count for month)
    const activeMemberCount = await this.getActiveMemberCount(year, month);
    const perMember = activeMemberCount > 0 ? (total * 1000) / activeMemberCount : 0; // Convert to kg
    
    return {
      month: monthStr,
      scope1,
      scope2,
      scope3,
      total,
      breakdown: scope3Breakdown,
      renewablePercent,
      perMember,
    };
  }

  /**
   * Calculate Scope 2 Emissions
   * Indirect electricity emissions from cloud infrastructure
   */
  async calculateScope2(_year: number, _month: number): Promise<number> {
    // In production, this would query Azure usage metrics
    // For now, use estimated values based on carbon reduction plan
    
    // Monthly cloud infrastructure usage (kWh)
    const monthlyUsage = 150000; // 150,000 kWh/month (from plan)
    
    // Emission factor for Canada Central (Quebec hydro)
    const emissionFactor = EMISSION_FACTORS.electricity.canadaCentral; // 0.002 kg CO2e/kWh
    
    // Calculate emissions (kWh * kg/kWh / 1000 to convert to tonnes)
    const emissions = (monthlyUsage * emissionFactor) / 1000;
    
    return emissions; // ~0.3 tonnes CO2e/month
  }

  /**
   * Calculate Scope 3 Emissions
   * Supply chain and other indirect emissions
   */
  async calculateScope3(_year: number, _month: number): Promise<{
    remoteWork: number;
    saasVendors: number;
    travel: number;
    hardware: number;
  }> {
    const employeeCount = 20; // Estimated from carbon plan
    
    // Remote work emissions (monthly average)
    const remoteWorkAnnual = employeeCount * EMISSION_FACTORS.remoteWork.total; // kg/year
    const remoteWork = remoteWorkAnnual / 12 / 1000; // Convert to tonnes/month
    
    // SaaS vendors (estimated based on revenue share)
    // Annual: 40 tonnes, Monthly: 40/12 ≈ 3.33 tonnes
    const saasVendors = 40 / 12;
    
    // Business travel (minimal, mostly virtual)
    // Annual: 15 tonnes, Monthly: 15/12 ≈ 1.25 tonnes
    const travel = 15 / 12;
    
    // Hardware/electronics (amortized over lifespan)
    // Annual: 5 tonnes, Monthly: 5/12 ≈ 0.42 tonnes
    const hardware = 5 / 12;
    
    return {
      remoteWork,
      saasVendors,
      travel,
      hardware,
    };
  }

  /**
   * Calculate Renewable Energy Percent
   * % of electricity from renewable sources (weighted by usage)
   */
  async calculateRenewablePercent(_year: number, _month: number): Promise<number> {
    // Union Eyes deploys 100% to Canada Central (99% renewable)
    // In production, this would query actual deployment regions
    return 99;
  }

  /**
   * Get Active Member Count
   * Number of active members for per-member emissions calculation
   */
  async getActiveMemberCount(_year: number, _month: number): Promise<number> {
    // In production, query actual member data from database
    // For now, use estimated value from carbon plan
    return 5000;
  }

  /**
   * Calculate Yearly Emissions
   * Aggregate monthly emissions and compare to SBTi targets
   */
  async calculateYearlyEmissions(year: number): Promise<YearlyEmissions> {
    let scope1 = 0;
    let scope2 = 0;
    let scope3 = 0;
    
    // Aggregate monthly emissions
    for (let month = 1; month <= 12; month++) {
      const monthly = await this.calculateMonthlyEmissions(year, month);
      scope1 += monthly.scope1;
      scope2 += monthly.scope2;
      scope3 += monthly.scope3;
    }
    
    const total = scope1 + scope2 + scope3;
    
    // Calculate SBTi target for this year (linear interpolation)
    const sbtiTarget = this.getSBTiTarget(year);
    const percentOfTarget = sbtiTarget > 0 ? (total / sbtiTarget) * 100 : 0;
    
    // Calculate reduction from baseline
    const reductionFromBaseline = ((this.BASELINE_EMISSIONS - total) / this.BASELINE_EMISSIONS) * 100;
    
    return {
      year,
      scope1,
      scope2,
      scope3,
      total,
      sbtiTarget,
      percentOfTarget,
      reductionFromBaseline,
    };
  }

  /**
   * Get SBTi Target for Year
   * Calculate linear reduction path from baseline to 2030 target
   */
  private getSBTiTarget(year: number): number {
    if (year < this.BASELINE_YEAR) {
      return this.BASELINE_EMISSIONS;
    }
    
    if (year >= 2050) {
      return this.TARGET_2050;
    }
    
    // Linear interpolation between milestones
    if (year <= 2030) {
      // 2026 baseline (225) → 2030 target (112.5)
      const yearsFromBaseline = year - this.BASELINE_YEAR;
      const yearsBetweenMilestones = 2030 - this.BASELINE_YEAR; // 4 years
      const reductionPerYear = (this.BASELINE_EMISSIONS - this.TARGET_2030) / yearsBetweenMilestones;
      return this.BASELINE_EMISSIONS - (reductionPerYear * yearsFromBaseline);
    } else {
      // 2030 target (112.5) → 2050 target (22.5)
      const yearsFrom2030 = year - 2030;
      const yearsBetweenMilestones = 2050 - 2030; // 20 years
      const reductionPerYear = (this.TARGET_2030 - this.TARGET_2050) / yearsBetweenMilestones;
      return this.TARGET_2030 - (reductionPerYear * yearsFrom2030);
    }
  }

  /**
   * Verify Renewable Regions
   * Check if all deployments are in approved renewable energy regions
   */
  async verifyRenewableRegions(): Promise<{
    compliant: boolean;
    deployedRegions: string[];
    approvedRegions: string[];
    blockedRegions: string[];
    violations: Array<{ region: string; issue: string }>;
  }> {
    // In production, this would query actual deployment configs (Terraform, Azure)
    // For now, assume current deployment: Canada Central (compliant)
    
    const deployedRegions = ['canadacentral']; // Current production region
    const approvedRegions = RENEWABLE_REGIONS.azure.map(r => r.region);
    const blockedRegions = BLOCKED_REGIONS.map(r => r.region);
    
    const violations = deployedRegions
      .filter(region => blockedRegions.includes(region))
      .map(region => {
        const blocked = BLOCKED_REGIONS.find(r => r.region === region);
        return {
          region: blocked?.name || region,
          issue: blocked?.issue || 'High fossil fuel usage',
        };
      });
    
    const compliant = violations.length === 0;
    
    return {
      compliant,
      deployedRegions,
      approvedRegions,
      blockedRegions,
      violations,
    };
  }

  /**
   * Check if Region is Renewable
   * Validate region against approved renewable list
   */
  isRenewableRegion(provider: 'azure' | 'aws' | 'gcp', region: string): boolean {
    const approvedRegions = RENEWABLE_REGIONS[provider].map(r => r.region);
    return approvedRegions.includes(region);
  }

  /**
   * Get Region Details
   * Retrieve renewable energy information for a region
   */
  getRegionDetails(provider: 'azure' | 'aws' | 'gcp', region: string) {
    const regionData = RENEWABLE_REGIONS[provider].find(r => r.region === region);
    
    if (!regionData) {
      const blocked = BLOCKED_REGIONS.find(r => r.region === region);
      if (blocked) {
        return {
          found: true,
          approved: false,
          ...blocked,
        };
      }
      return {
        found: false,
        approved: false,
        region,
      };
    }
    
    return {
      found: true,
      approved: true,
      ...regionData,
    };
  }

  /**
   * Get Carbon Dashboard Data
   * Summary for admin dashboard
   */
  async getCarbonDashboard() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Current month emissions
    const currentMonthEmissions = await this.calculateMonthlyEmissions(currentYear, currentMonth);
    
    // Year-to-date emissions
    const ytdEmissions = await this.calculateYearlyEmissions(currentYear);
    
    // Renewable region compliance
    const regionCompliance = await this.verifyRenewableRegions();
    
    // Calculate if on track for 2030 target
    const yearsToTarget = 2030 - currentYear;
    const currentAnnualRate = ytdEmissions.total;
    const requiredAnnualReduction = (currentAnnualRate - this.TARGET_2030) / yearsToTarget;
    const onTrackFor2030 = ytdEmissions.reductionFromBaseline >= 
      ((currentYear - this.BASELINE_YEAR) / (2030 - this.BASELINE_YEAR)) * 50;
    
    return {
      currentMonth: currentMonthEmissions,
      yearToDate: ytdEmissions,
      regionCompliance,
      sbtiProgress: {
        baselineYear: this.BASELINE_YEAR,
        baselineEmissions: this.BASELINE_EMISSIONS,
        target2030: this.TARGET_2030,
        target2050: this.TARGET_2050,
        currentEmissions: ytdEmissions.total,
        reductionAchieved: ytdEmissions.reductionFromBaseline,
        requiredAnnualReduction,
        onTrackFor2030,
      },
      comparison: {
        industryAverage: 0.12, // tonnes CO2e per member
        unionEyesPerMember: currentMonthEmissions.perMember / 1000, // Convert kg to tonnes
        savingsPercent: Math.round((1 - (currentMonthEmissions.perMember / 1000) / 0.12) * 100),
      },
    };
  }

  /**
   * Get Historical Emissions
   * Yearly emissions from baseline to current year
   */
  async getHistoricalEmissions(startYear?: number, endYear?: number): Promise<YearlyEmissions[]> {
    const start = startYear || this.BASELINE_YEAR;
    const end = endYear || new Date().getFullYear();
    
    const results: YearlyEmissions[] = [];
    
    for (let year = start; year <= end; year++) {
      const emissions = await this.calculateYearlyEmissions(year);
      results.push(emissions);
    }
    
    return results;
  }

  /**
   * Project Future Emissions
   * Estimate emissions trajectory to 2050 based on current reduction rate
   */
  async projectFutureEmissions(targetYear: number): Promise<{
    projected: YearlyEmissions[];
    willMeet2030Target: boolean;
    willMeet2050Target: boolean;
    recommendations: string[];
  }> {
    const currentYear = new Date().getFullYear();
    const historicalData = await this.getHistoricalEmissions(this.BASELINE_YEAR, currentYear);
    
    // Calculate average annual reduction rate
    const recentYears = historicalData.slice(-3); // Last 3 years
    const avgReductionRate = recentYears.reduce((sum, y) => sum + y.reductionFromBaseline, 0) / recentYears.length;
    
    // Project future based on current trajectory
    const projected: YearlyEmissions[] = [];
    let currentEmissions = historicalData[historicalData.length - 1]?.total || this.BASELINE_EMISSIONS;
    
    for (let year = currentYear + 1; year <= targetYear; year++) {
      const reductionAmount = currentEmissions * (avgReductionRate / 100);
      currentEmissions = Math.max(currentEmissions - reductionAmount, 0);
      
      const sbtiTarget = this.getSBTiTarget(year);
      const reductionFromBaseline = ((this.BASELINE_EMISSIONS - currentEmissions) / this.BASELINE_EMISSIONS) * 100;
      
      projected.push({
        year,
        scope1: 0,
        scope2: currentEmissions * 0.2, // Assume 20% Scope 2
        scope3: currentEmissions * 0.8, // Assume 80% Scope 3
        total: currentEmissions,
        sbtiTarget,
        percentOfTarget: (currentEmissions / sbtiTarget) * 100,
        reductionFromBaseline,
      });
    }
    
    const emissions2030 = projected.find(p => p.year === 2030);
    const emissions2050 = projected.find(p => p.year === 2050);
    
    const willMeet2030Target = emissions2030 ? emissions2030.total <= this.TARGET_2030 : false;
    const willMeet2050Target = emissions2050 ? emissions2050.total <= this.TARGET_2050 : false;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!willMeet2030Target) {
      const gap = emissions2030 ? emissions2030.total - this.TARGET_2030 : 0;
      recommendations.push(`Current trajectory will miss 2030 target by ${gap.toFixed(1)} tonnes CO2e. Accelerate reduction initiatives.`);
    }
    
    if (!willMeet2050Target) {
      recommendations.push('Current trajectory will not achieve net-zero by 2050. Plan for carbon removal investments.');
    }
    
    if (avgReductionRate < 10) {
      recommendations.push('Annual reduction rate is below 10%. Focus on high-impact initiatives (edge computing, ARM processors).');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('On track to meet all SBTi targets. Continue current reduction initiatives.');
    }
    
    return {
      projected,
      willMeet2030Target,
      willMeet2050Target,
      recommendations,
    };
  }
}

// Export singleton instance
export const carbonAccountingService = new CarbonAccountingService();
