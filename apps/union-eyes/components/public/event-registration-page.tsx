'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Ticket,
  Plus,
  Minus,
  Check,
  Download,
} from 'lucide-react';
import QRCode from 'qrcode';
import { getStripePromise } from '@/lib/stripe-elements';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = getStripePromise();

interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  eventDate: string;
  endDate: string | null;
  location: string;
  address: string | null;
  eventType: 'meeting' | 'rally' | 'training' | 'social' | 'conference' | 'other';
  capacity: number | null;
  currentRegistrations: number;
  allowGuests: boolean;
  requiresApproval: boolean;
  isFree: boolean;
  ticketPrice: number | null;
  imageUrl: string | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
}

interface EventTicket {
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  numberOfGuests: number;
  guestNames: string[];
  qrCode: string;
  registrationCode: string;
}

function EventCheckoutForm({
  eventId,
  totalAmount,
  attendeeData,
  onSuccess,
}: {
  eventId: string;
  totalAmount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attendeeData: any;
  onSuccess: (ticket: EventTicket) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/events/confirmation`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'An error occurred');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Create registration
        const response = await fetch('/api/events/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            ...attendeeData,
            stripePaymentIntentId: paymentIntent.id,
          }),
        });

        const ticket = await response.json();
        onSuccess(ticket);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {message && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {message}
        </div>
      )}
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full mt-6" size="lg">
        {isProcessing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
      </Button>
    </form>
  );
}

interface EventRegistrationPageProps {
  eventSlug: string;
}

export function PublicEventRegistrationPage({ eventSlug }: EventRegistrationPageProps) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'details' | 'form' | 'payment' | 'confirmation'>('details');
  const [numberOfGuests, setNumberOfGuests] = useState(0);
  const [clientSecret, setClientSecret] = useState('');
  const [ticket, setTicket] = useState<EventTicket | null>(null);

  // Form data
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [guestNames, setGuestNames] = useState<string[]>([]);

  useEffect(() => {
    fetchEvent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events/${eventSlug}`);
      if (!response.ok) throw new Error('Event not found');
      const data = await response.json();
      setEvent(data);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    setStep('form');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const attendeeData = {
      attendeeName,
      attendeeEmail,
      attendeePhone: attendeePhone || null,
      numberOfGuests,
      guestNames: guestNames.filter(name => name.trim()),
    };

    if (!event) return;

    if (event.isFree) {
      // Free event - register directly
      try {
        const response = await fetch('/api/events/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            ...attendeeData,
          }),
        });

        const ticketData = await response.json();
        setTicket(ticketData);
        setStep('confirmation');
      } catch (_error) {
}
    } else {
      // Paid event - proceed to payment
      const totalTickets = 1 + numberOfGuests;
      const totalAmount = (event.ticketPrice || 0) * totalTickets;

      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount * 100, // Convert to cents
            eventId: event.id,
            metadata: attendeeData,
          }),
        });

        const data = await response.json();
        setClientSecret(data.clientSecret);
        setStep('payment');
      } catch (_error) {
}
    }
  };

  const handlePaymentSuccess = (ticketData: EventTicket) => {
    setTicket(ticketData);
    setStep('confirmation');
  };

  const downloadTicket = async () => {
    if (!ticket) return;

    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, ticket.qrCode, { width: 256 });
    const qrDataUrl = canvas.toDataURL();

    // Create simple ticket HTML for print
    const ticketWindow = window.open('', '_blank');
    if (ticketWindow) {
      ticketWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Event Ticket</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
              .ticket { border: 2px solid #000; padding: 30px; border-radius: 10px; }
              h1 { margin-top: 0; }
              .qr-code { text-align: center; margin: 20px 0; }
              .details { line-height: 1.8; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="ticket">
              <h1>${event?.title}</h1>
              <div class="details">
                <p><strong>Attendee:</strong> ${ticket.attendeeName}</p>
                <p><strong>Date:</strong> ${new Date(event!.eventDate).toLocaleDateString()}</p>
                <p><strong>Location:</strong> ${event?.location}</p>
                <p><strong>Registration Code:</strong> ${ticket.registrationCode}</p>
                ${numberOfGuests > 0 ? `<p><strong>Guests:</strong> ${numberOfGuests}</p>` : ''}
              </div>
              <div class="qr-code">
                <img src="${qrDataUrl}" alt="QR Code" />
                <p>Scan this code at check-in</p>
              </div>
            </div>
          </body>
        </html>
      `);
      ticketWindow.document.close();
      ticketWindow.print();
    }
  };

  const addToCalendar = () => {
    if (!event) return;

    const startDate = new Date(event.eventDate);
    const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.location}${event.address ? `, ${event.address}` : ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${event.slug}.ics`;
    link.click();
  };

  const spotsRemaining = event?.capacity ? event.capacity - event.currentRegistrations : null;
  const isFull = spotsRemaining !== null && spotsRemaining <= 0;
  const totalTickets = 1 + numberOfGuests;
  const totalAmount = event ? (event.ticketPrice || 0) * totalTickets : 0;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-64 w-full mb-8" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Event Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The event you&apos;re looking for doesn&apos;t exist or has been cancelled.
        </p>
        <Button onClick={() => window.location.href = '/events'}>
          View All Events
        </Button>
      </div>
    );
  }

  // Confirmation Step
  if (step === 'confirmation' && ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">You&apos;re Registered!</h1>
            <p className="text-muted-foreground">
              Confirmation sent to {ticket.attendeeEmail}
            </p>
          </div>

          <div className="border rounded-lg p-6 mb-6">
            <h2 className="font-semibold text-lg mb-4">{event.title}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(event.eventDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(event.eventDate).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
              {numberOfGuests > 0 && (
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{numberOfGuests} guest{numberOfGuests > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <canvas
              ref={(canvas) => {
                if (canvas && ticket.qrCode) {
                  QRCode.toCanvas(canvas, ticket.qrCode, { width: 200 });
                }
              }}
              className="mx-auto mb-2"
            />
            <p className="text-sm text-muted-foreground">
              Show this QR code at check-in
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Registration Code: <strong>{ticket.registrationCode}</strong>
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={downloadTicket} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Ticket
            </Button>
            <Button onClick={addToCalendar} variant="outline" className="flex-1">
              <Calendar className="h-4 w-4 mr-2" />
              Add to Calendar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      {event.imageUrl && (
        <div
          className="h-64 bg-cover bg-center relative"
          style={{ backgroundImage: `url(${event.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {step === 'details' && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Badge>{event.eventType}</Badge>
                {event.isFree && <Badge variant="secondary">Free</Badge>}
                {isFull && <Badge variant="destructive">Full</Badge>}
              </div>
              <h1 className="text-4xl font-bold mb-3">{event.title}</h1>
              <p className="text-lg text-muted-foreground">{event.description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="p-6">
                <h2 className="font-semibold text-lg mb-4">Event Details</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {new Date(event.eventDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.eventDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">{event.location}</div>
                      {event.address && (
                        <div className="text-sm text-muted-foreground">{event.address}</div>
                      )}
                    </div>
                  </div>

                  {event.capacity && (
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{spotsRemaining}</span>
                        <span className="text-muted-foreground"> spots remaining</span>
                      </div>
                    </div>
                  )}

                  {!event.isFree && event.ticketPrice && (
                    <div className="flex items-center gap-3">
                      <Ticket className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">${event.ticketPrice}</span>
                        <span className="text-muted-foreground"> per ticket</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold text-lg mb-4">Registration</h2>
                {isFull ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">
                      This event is at full capacity
                    </p>
                    <Button variant="outline" disabled>
                      Registration Closed
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Your Ticket</span>
                          <span className="font-semibold">
                            {event.isFree ? 'Free' : `$${event.ticketPrice}`}
                          </span>
                        </div>
                      </div>

                      {event.allowGuests && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Number of Guests</span>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setNumberOfGuests(Math.max(0, numberOfGuests - 1))}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{numberOfGuests}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setNumberOfGuests(numberOfGuests + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {numberOfGuests > 0 && !event.isFree && (
                            <div className="text-sm text-muted-foreground">
                              {numberOfGuests} Ã— ${event.ticketPrice} = ${(event.ticketPrice || 0) * numberOfGuests}
                            </div>
                          )}
                        </div>
                      )}

                      {!event.isFree && (
                        <div className="pt-4 border-t">
                          <div className="flex items-center justify-between text-lg font-bold">
                            <span>Total</span>
                            <span>${totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button size="lg" className="w-full" onClick={handleRegister}>
                      {event.requiresApproval ? 'Request to Register' : 'Register Now'}
                    </Button>

                    {event.requiresApproval && (
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        Registration subject to approval
                      </p>
                    )}
                  </>
                )}
              </Card>
            </div>
          </>
        )}

        {step === 'form' && (
          <Card className="p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Registration Information</h2>
            <form onSubmit={handleSubmitForm} className="space-y-6">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={attendeePhone}
                  onChange={(e) => setAttendeePhone(e.target.value)}
                />
              </div>

              {numberOfGuests > 0 && (
                <div>
                  <Label>Guest Names</Label>
                  <div className="space-y-2 mt-2">
                    {Array.from({ length: numberOfGuests }).map((_, index) => (
                      <Input
                        key={index}
                        placeholder={`Guest ${index + 1} name`}
                        value={guestNames[index] || ''}
                        onChange={(e) => {
                          const newGuestNames = [...guestNames];
                          newGuestNames[index] = e.target.value;
                          setGuestNames(newGuestNames);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep('details')} className="flex-1">
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  {event.isFree ? 'Complete Registration' : 'Continue to Payment'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {step === 'payment' && (
          <Card className="p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Payment Information</h2>
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Amount:</span>
                <span className="text-2xl font-bold">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {totalTickets} ticket{totalTickets > 1 ? 's' : ''} Ã— ${event.ticketPrice}
              </div>
            </div>

            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <EventCheckoutForm
                  eventId={event.id}
                  totalAmount={totalAmount}
                  attendeeData={{
                    attendeeName,
                    attendeeEmail,
                    attendeePhone,
                    numberOfGuests,
                    guestNames,
                  }}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            )}

            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setStep('form')}
            >
              â† Back
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

