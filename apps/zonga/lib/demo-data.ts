/**
 * Zonga — Demo Data for Marketing Pages
 *
 * Rich, realistic seed data used when the database is empty (dev / demo mode).
 * Keeps marketing pages alive without requiring DB seeding.
 *
 * GOVERNANCE: DEMO-ONLY MODULE.
 * This file must not be treated as production data authority.
 */
import type { PublicArtist, PublicEvent, PublicRelease } from './public-data'

// ── Artists ─────────────────────────────────────────────────────────────────

export const demoArtists: PublicArtist[] = [
  {
    id: 'demo-artist-001',
    name: 'Amara Diouf',
    genre: 'Afrobeats',
    country: 'Senegal',
    bio: 'Amara Diouf blends Wolof rhythms with modern Afrobeats production, creating a sound that bridges Dakar street culture with global dancefloors. Her debut album "Ndakarou Nights" topped charts across West Africa.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80',
    followerCount: 124500,
    releaseCount: 14,
  },
  {
    id: 'demo-artist-002',
    name: 'Kofi Mensah',
    genre: 'Highlife',
    country: 'Ghana',
    bio: 'A modern Highlife torchbearer, Kofi Mensah fuses classic guitar melodies with electronic textures. His live performances across Accra have become legendary — blending tradition with innovation.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80',
    followerCount: 89200,
    releaseCount: 8,
  },
  {
    id: 'demo-artist-003',
    name: 'Naledi Khumalo',
    genre: 'Amapiano',
    country: 'South Africa',
    bio: 'Naledi Khumalo is a Johannesburg-born producer and vocalist who helped define the new wave of Amapiano. Known for her deep log-drum grooves and soulful vocal chops, she performs at festivals from Soweto to Berlin.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80',
    followerCount: 215000,
    releaseCount: 22,
  },
  {
    id: 'demo-artist-004',
    name: 'Bakari Traoré',
    genre: 'Mandé Blues',
    country: 'Mali',
    bio: 'Master of the kora and electric guitar, Bakari Traoré bridges centuries of Mandé griot tradition with contemporary blues. His albums have been praised by critics from Bamako to Brooklyn.',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&q=80',
    followerCount: 67800,
    releaseCount: 6,
  },
  {
    id: 'demo-artist-005',
    name: 'Ife Adeyemi',
    genre: 'Afro-R&B',
    country: 'Nigeria',
    bio: 'Lagos-born, London-raised — Ife Adeyemi weaves Yoruba melodies into silky R&B production. Her single "Ori Mi" became an anthem for the Nigerian diaspora, streaming over 50 million times worldwide.',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&q=80',
    followerCount: 340000,
    releaseCount: 18,
  },
  {
    id: 'demo-artist-006',
    name: 'DJ Kwame',
    genre: 'Afro-House',
    country: 'Ghana',
    bio: 'DJ Kwame is an Accra-based electronic producer blending Azonto rhythms with deep house. His Boiler Room set went viral, and he now headlines festivals across the continent.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80',
    followerCount: 156000,
    releaseCount: 31,
  },
  {
    id: 'demo-artist-007',
    name: 'Zawadi Mwangi',
    genre: 'Bongo Flava',
    country: 'Kenya',
    bio: 'Rising from Nairobi\'s vibrant music scene, Zawadi Mwangi brings Swahili lyricism to Bongo Flava beats. Her EP "Safari ya Muziki" won Best New Artist at the East African Music Awards.',
    avatarUrl: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&q=80',
    followerCount: 93400,
    releaseCount: 9,
  },
  {
    id: 'demo-artist-008',
    name: 'Moussa Diabaté',
    genre: 'Soukous',
    country: 'DR Congo',
    bio: 'Moussa Diabaté carries the Congolese rumba and soukous tradition into the modern era. His fingerpicking guitar style and jubilant rhythms fill dance halls from Kinshasa to Paris.',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&q=80',
    followerCount: 78900,
    releaseCount: 12,
  },
  {
    id: 'demo-artist-009',
    name: 'Fatima El-Amin',
    genre: 'Gnawa Fusion',
    country: 'Morocco',
    bio: 'Fatima El-Amin brings the mystical sounds of Gnawa music into a contemporary fusion of jazz and electronic. Based in Marrakech, she has performed at the Essaouira Gnaoua Festival three years running.',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=80',
    followerCount: 52300,
    releaseCount: 5,
  },
  {
    id: 'demo-artist-010',
    name: 'Tendai Moyo',
    genre: 'Chimurenga',
    country: 'Zimbabwe',
    bio: 'Tendai Moyo draws on the Chimurenga tradition of Zimbabwe, blending mbira melodies with modern production. His music tells stories of resilience, land, and identity.',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&q=80',
    followerCount: 41200,
    releaseCount: 7,
  },
  {
    id: 'demo-artist-011',
    name: 'Adama Sangaré',
    genre: 'Wassoulou',
    country: 'Mali',
    bio: 'Adama Sangaré is a powerful vocalist from the Wassoulou tradition. Her songs celebrate women\'s strength and rural life, resonating with audiences from Bamako to the Barbican.',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=80',
    followerCount: 61800,
    releaseCount: 10,
  },
  {
    id: 'demo-artist-012',
    name: 'Sekou Ouédraogo',
    genre: 'Afrobeats',
    country: 'Burkina Faso',
    bio: 'Sekou Ouédraogo is Ouagadougou\'s breakout star — his percussive Afrobeats style fuses Burkinabé folk patterns with Lagos-style production. His track "Burkina Rising" went continental.',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&q=80',
    followerCount: 47600,
    releaseCount: 4,
  },
]

// ── Releases (for artist profiles) ──────────────────────────────────────────

export const demoReleases: Record<string, PublicRelease[]> = {
  'demo-artist-001': [
    { id: 'rel-001a', title: 'Ndakarou Nights', releaseType: 'album', coverArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop&q=80', releaseDate: '2026-01-15', trackCount: 12, creatorId: 'demo-artist-001', creatorName: 'Amara Diouf' },
    { id: 'rel-001b', title: 'Teranga', releaseType: 'single', coverArtUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop&q=80', releaseDate: '2025-11-02', trackCount: 1, creatorId: 'demo-artist-001', creatorName: 'Amara Diouf' },
    { id: 'rel-001c', title: 'Dakar Dawn EP', releaseType: 'ep', coverArtUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop&q=80', releaseDate: '2025-06-20', trackCount: 5, creatorId: 'demo-artist-001', creatorName: 'Amara Diouf' },
  ],
  'demo-artist-003': [
    { id: 'rel-003a', title: 'Piano Ya Mzansi', releaseType: 'album', coverArtUrl: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=400&h=400&fit=crop&q=80', releaseDate: '2026-02-28', trackCount: 14, creatorId: 'demo-artist-003', creatorName: 'Naledi Khumalo' },
    { id: 'rel-003b', title: 'Jozi Groove Sessions', releaseType: 'ep', coverArtUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=400&fit=crop&q=80', releaseDate: '2025-09-15', trackCount: 6, creatorId: 'demo-artist-003', creatorName: 'Naledi Khumalo' },
  ],
  'demo-artist-005': [
    { id: 'rel-005a', title: 'Ori Mi', releaseType: 'single', coverArtUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop&q=80', releaseDate: '2025-12-01', trackCount: 1, creatorId: 'demo-artist-005', creatorName: 'Ife Adeyemi' },
    { id: 'rel-005b', title: 'Between Two Worlds', releaseType: 'album', coverArtUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop&q=80', releaseDate: '2025-08-10', trackCount: 11, creatorId: 'demo-artist-005', creatorName: 'Ife Adeyemi' },
    { id: 'rel-005c', title: 'Lagos to London', releaseType: 'ep', coverArtUrl: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&h=400&fit=crop&q=80', releaseDate: '2025-03-22', trackCount: 4, creatorId: 'demo-artist-005', creatorName: 'Ife Adeyemi' },
  ],
  'demo-artist-006': [
    { id: 'rel-006a', title: 'Accra After Dark', releaseType: 'album', coverArtUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=400&fit=crop&q=80', releaseDate: '2026-03-01', trackCount: 10, creatorId: 'demo-artist-006', creatorName: 'DJ Kwame' },
    { id: 'rel-006b', title: 'Azonto Frequencies', releaseType: 'ep', coverArtUrl: 'https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=400&h=400&fit=crop&q=80', releaseDate: '2025-10-18', trackCount: 5, creatorId: 'demo-artist-006', creatorName: 'DJ Kwame' },
  ],
}

// ── Events ──────────────────────────────────────────────────────────────────

export const demoEvents: PublicEvent[] = [
  {
    id: 'demo-event-001',
    title: 'AfroVibe Festival 2026',
    description: 'The largest Afrobeats and Amapiano festival in West Africa — three days of non-stop music, food, art, and culture. Headlined by Ife Adeyemi, DJ Kwame, and surprise guests.',
    venue: 'Eko Atlantic Arena',
    city: 'Lagos',
    country: 'Nigeria',
    startDate: '2026-06-14T18:00:00Z',
    endDate: '2026-06-16T23:59:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=400&fit=crop&q=80',
    creatorName: 'Ife Adeyemi',
    ticketCount: 4,
  },
  {
    id: 'demo-event-002',
    title: 'Amapiano Sundays — Johannesburg',
    description: 'Every Sunday, the best Amapiano DJs and producers take over Constitution Hill for an all-day groove. Featuring Naledi Khumalo and rotating guests.',
    venue: 'Constitution Hill',
    city: 'Johannesburg',
    country: 'South Africa',
    startDate: '2026-04-06T12:00:00Z',
    endDate: '2026-04-06T22:00:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=400&fit=crop&q=80',
    creatorName: 'Naledi Khumalo',
    ticketCount: 2,
  },
  {
    id: 'demo-event-003',
    title: 'Sahel Sounds — Live in Bamako',
    description: 'An intimate evening of Mandé blues, kora, and desert rock at the Institut Français. Featuring Bakari Traoré and Adama Sangaré in a rare joint performance.',
    venue: 'Institut Français du Mali',
    city: 'Bamako',
    country: 'Mali',
    startDate: '2026-05-10T19:30:00Z',
    endDate: '2026-05-10T23:00:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=400&fit=crop&q=80',
    creatorName: 'Bakari Traoré',
    ticketCount: 3,
  },
  {
    id: 'demo-event-004',
    title: 'Dakar Beats — Album Launch Party',
    description: 'Amara Diouf launches "Ndakarou Nights" with a full live band, dancers, and special guests at the iconic Théâtre National Daniel Sorano.',
    venue: 'Théâtre National Daniel Sorano',
    city: 'Dakar',
    country: 'Senegal',
    startDate: '2026-04-25T20:00:00Z',
    endDate: '2026-04-25T23:30:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop&q=80',
    creatorName: 'Amara Diouf',
    ticketCount: 2,
  },
  {
    id: 'demo-event-005',
    title: 'Gnaoua World Music Festival',
    description: 'Essaouira\'s legendary festival returns with Fatima El-Amin headlining the Gnawa-jazz fusion stage. Four days of music, workshops, and Moroccan hospitality.',
    venue: 'Place Moulay Hassan',
    city: 'Essaouira',
    country: 'Morocco',
    startDate: '2026-06-26T17:00:00Z',
    endDate: '2026-06-29T23:59:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=800&h=400&fit=crop&q=80',
    creatorName: 'Fatima El-Amin',
    ticketCount: 3,
  },
  {
    id: 'demo-event-006',
    title: 'Nairobi Nights — Bongo Flava Edition',
    description: 'East Africa\'s premier Bongo Flava showcase. Zawadi Mwangi headlines alongside Kenya\'s finest, with food trucks, art installations, and a silent disco.',
    venue: 'Uhuru Gardens',
    city: 'Nairobi',
    country: 'Kenya',
    startDate: '2026-05-17T16:00:00Z',
    endDate: '2026-05-17T23:00:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&h=400&fit=crop&q=80',
    creatorName: 'Zawadi Mwangi',
    ticketCount: 3,
  },
  {
    id: 'demo-event-007',
    title: 'Kinshasa Rumba Revival',
    description: 'A celebration of Congolese rumba and soukous music at the Grand Hôtel de Kinshasa. Moussa Diabaté leads a 12-piece orchestra through the golden classics and new originals.',
    venue: 'Grand Hôtel de Kinshasa',
    city: 'Kinshasa',
    country: 'DR Congo',
    startDate: '2026-07-05T19:00:00Z',
    endDate: '2026-07-05T23:30:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=400&fit=crop&q=80',
    creatorName: 'Moussa Diabaté',
    ticketCount: 2,
  },
  {
    id: 'demo-event-008',
    title: 'Accra House Music Marathon',
    description: 'DJ Kwame curates a 12-hour non-stop electronic music experience on the Labadi beachfront. Afro-house, Azonto-tech, and deep grooves from sunset to sunrise.',
    venue: 'Labadi Beach',
    city: 'Accra',
    country: 'Ghana',
    startDate: '2026-08-15T18:00:00Z',
    endDate: '2026-08-16T06:00:00Z',
    coverImageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=400&fit=crop&q=80',
    creatorName: 'DJ Kwame',
    ticketCount: 3,
  },
]

// ── Facets derived from demo data ───────────────────────────────────────────

export const demoGenres = [...new Set(demoArtists.map((a) => a.genre).filter(Boolean))] as string[]
export const demoCountries = [...new Set(demoArtists.map((a) => a.country).filter(Boolean))] as string[]
