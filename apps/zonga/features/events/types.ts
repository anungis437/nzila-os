/**
 * Zonga — Event Domain Types
 */

export type EventLifecycleState =
  | 'draft'
  | 'published'
  | 'on_sale'
  | 'sold_out'
  | 'completed'
  | 'cancelled'

export interface ZongaEventFull {
  id: string
  orgId: string
  title: string
  description?: string
  venueId?: string
  venueName: string
  address?: string
  city: string
  country: string
  capacity: number
  startsAt: Date
  endsAt?: Date
  status: EventLifecycleState
  imageUrl?: string
  genre?: string
  createdBy: string
  lineup: EventLineupEntry[]
  ticketTypes: EventTicketTypeFull[]
  totalSold: number
  totalRevenue: number
  createdAt: Date
  updatedAt: Date
}

export interface EventLineupEntry {
  id: string
  artistId?: string
  artistName: string
  role: 'headliner' | 'performer' | 'dj' | 'host' | 'guest'
  setTime?: Date
  sortOrder: number
}

export interface EventTicketTypeFull {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  quantityTotal: number
  quantitySold: number
  quantityReserved: number
  saleStartsAt?: Date
  saleEndsAt?: Date
  maxPerOrder: number
  isActive: boolean
}

export interface TicketOrderFull {
  id: string
  eventId: string
  ticketTypeId?: string
  ticketTypeName?: string
  buyerId: string
  buyerEmail: string
  buyerName?: string
  quantity: number
  unitPrice: number
  totalAmount: number
  platformFee: number
  organizerNet?: number
  currency: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded' | 'expired'
  confirmationCode?: string
  tickets: IndividualTicket[]
  createdAt?: Date
}

export interface IndividualTicket {
  id: string
  orderId: string
  eventId: string
  ticketTypeId: string
  holderId?: string
  holderName?: string
  holderEmail?: string
  qrToken: string
  status: 'valid' | 'used' | 'cancelled' | 'transferred'
  checkedInAt?: Date
  createdAt?: Date
}

export interface CheckInResult {
  ok: boolean
  ticketId?: string
  holderName?: string
  ticketType?: string
  reason?: string
  message?: string
  alreadyCheckedIn?: boolean
}

/** Valid event state transitions */
export const EVENT_TRANSITIONS: Record<EventLifecycleState, EventLifecycleState[]> = {
  draft: ['published'],
  published: ['on_sale', 'cancelled'],
  on_sale: ['sold_out', 'completed', 'cancelled'],
  sold_out: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/** Platform fee percentage for ticket sales */
export const TICKET_PLATFORM_FEE_PCT = 5.0
