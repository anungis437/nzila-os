/**
 * Solutions carousel navigation helper
 * Defines the sequential order of solutions and provides navigation helpers
 */

export const SOLUTIONS_ORDER = [
  { name: 'executive-leadership', label: 'Union Executive Leadership', index: 0 },
  { name: 'governance-leadership', label: 'Governance Leadership', index: 1 },
  { name: 'operations-leadership', label: 'Operations Leadership', index: 2 },
  { name: 'technology-leadership', label: 'Technology Leadership', index: 3 },
  { name: 'labour-leadership', label: 'Policy & Labour Leadership', index: 4 },
  { name: 'procurement', label: 'Procurement Stakeholders', index: 5 },
];

export interface CarouselNav {
  previous?: { name: string; label: string; href: string };
  next?: { name: string; label: string; href: string };
}

export function getCarouselNav(currentSolutionName: string, locale: string): CarouselNav {
  const currentIndex = SOLUTIONS_ORDER.findIndex((s) => s.name === currentSolutionName);
  
  if (currentIndex === -1) {
    return {};
  }

  const nav: CarouselNav = {};

  // Add previous link if not first item
  if (currentIndex > 0) {
    const prev = SOLUTIONS_ORDER[currentIndex - 1];
    nav.previous = {
      name: prev.name,
      label: prev.label,
      href: `/${locale}/solutions/${prev.name}`,
    };
  }

  // Add next link if not last item
  if (currentIndex < SOLUTIONS_ORDER.length - 1) {
    const next = SOLUTIONS_ORDER[currentIndex + 1];
    nav.next = {
      name: next.name,
      label: next.label,
      href: `/${locale}/solutions/${next.name}`,
    };
  }

  return nav;
}
