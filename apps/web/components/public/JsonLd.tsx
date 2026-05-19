export default function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://nzilaventures.com/#organization',
    name: 'Nzila Ventures',
    url: 'https://nzilaventures.com',
    logo: 'https://nzilaventures.com/file.svg',
    description:
      'Operating company behind Nzila OS, building institutional continuity infrastructure for trust-sensitive organizations.',
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
      'Institutional Continuity',
      'Operational Memory',
      'Governance Infrastructure',
      'Trust Infrastructure',
      'Union Operations',
      'Auditability',
      'Data Sovereignty',
      'Explainable AI',
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://nzilaventures.com/#website',
    name: 'Nzila Ventures',
    url: 'https://nzilaventures.com',
    description:
      'Institutional continuity infrastructure for organizations where governance, operational memory, and trust must survive transition.',
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
