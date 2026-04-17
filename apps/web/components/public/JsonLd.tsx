export default function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://nzilaventures.com/#organization',
    name: 'Nzila Ventures',
    url: 'https://nzilaventures.com',
    logo: 'https://nzilaventures.com/file.svg',
    description:
      'Venture studio building 15 AI-powered platforms across 10+ verticals — healthcare, finance, agriculture, labor rights, and justice.',
    foundingDate: '2024',
    numberOfEmployees: {
      '@type': 'QuantitativeValue',
      value: 15,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Business Development',
      url: 'https://nzilaventures.com/contact',
    },
    knowsAbout: [
      'Artificial Intelligence',
      'Machine Learning',
      'Fintech',
      'Healthtech',
      'Agrotech',
      'Legaltech',
      'EdTech',
      'Social Impact Technology',
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://nzilaventures.com/#website',
    name: 'Nzila Ventures',
    url: 'https://nzilaventures.com',
    description:
      '15 AI-powered platforms across 10+ verticals. One unified Backbone. Series A ready.',
    inLanguage: 'en-CA',
    publisher: {
      '@id': 'https://nzilaventures.com/#organization',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
