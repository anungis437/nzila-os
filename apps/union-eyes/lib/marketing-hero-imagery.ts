/**
 * Marketing Hero Imagery Mappings
 *
 * All imagery sourced from Unsplash (public, CC0 license, no attribution required).
 * Each page has ONE unique image — no reuse across pages.
 */

export const heroImagery = {
  trust: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1920&q=80&auto=format',
  story: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=80&auto=format',
  governance: 'https://images.unsplash.com/photo-1552664751-121d75d85e4d?w=1920&q=80&auto=format',
  contact: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1920&q=80&auto=format',
  pilotRequest: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80&auto=format',
  caseStudies: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80&auto=format',
  status: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80&auto=format',
  pricing: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80&auto=format',
  insights: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&q=80&auto=format',
  solutions: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1920&q=80&auto=format',
  executiveLeadership: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80&auto=format',
  governanceLeadership: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=80&auto=format',
  operationsLeadership: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1920&q=80&auto=format',
  technologyLeadership: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1920&q=80&auto=format',
  labourLeadership: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80&auto=format',
  procurementLeadership: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80&auto=format',
  institutionalContinuity: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1920&q=80&auto=format',
  governanceIntelligenceModule: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80&auto=format',
  organizationalMemoryModule: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1920&q=80&auto=format',
  executiveIntelligenceModule: 'https://images.unsplash.com/photo-1474631245212-32dc3c8310c6?w=1920&q=80&auto=format',
  operationalCoherenceModule: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80&auto=format',
  explainableIntelligenceModule: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80&auto=format',
  platform: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80&auto=format',
} as const;

export type HeroImageKey = keyof typeof heroImagery;
