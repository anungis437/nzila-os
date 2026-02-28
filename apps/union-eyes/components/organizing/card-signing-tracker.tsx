"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSignature,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  Camera,
  User,
  Calendar,
  MapPin,
  Shield,
  Download,
  Send,
  Clock,
} from "lucide-react";
 
import { format } from "date-fns";

interface CardSigningEvent {
  id: string;
  contactName: string;
  signedDate: string;
  signedTime?: string;
  signingLocation: string;
  witnessedByName: string;
  cardStatus: "valid" | "invalid" | "challenged" | "withdrawn";
  cardType: string;
  voluntarySignature: boolean;
  signatureObtainedProperly: boolean;
  dateAccurate: boolean;
  submittedToNlrbClrb: boolean;
  submissionDate?: string;
  cardPhotoUrl?: string;
}

export default function CardSigningTracker({ campaignId: _campaignId }: { campaignId: string }) {
  const [cardEvents, setCardEvents] = useState<CardSigningEvent[]>([
    {
      id: "1",
      contactName: "John Anderson",
      signedDate: "2025-12-05",
      signedTime: "14:30",
      signingLocation: "Home visit - 123 Oak Street",
      witnessedByName: "Sarah Johnson",
      cardStatus: "valid",
      cardType: "authorization",
      voluntarySignature: true,
      signatureObtainedProperly: true,
      dateAccurate: true,
      submittedToNlrbClrb: false,
    },
    {
      id: "2",
      contactName: "Maria Rodriguez",
      signedDate: "2025-12-04",
      signedTime: "18:15",
      signingLocation: "Union hall",
      witnessedByName: "Michael Chen",
      cardStatus: "valid",
      cardType: "authorization",
      voluntarySignature: true,
      signatureObtainedProperly: true,
      dateAccurate: true,
      submittedToNlrbClrb: true,
      submissionDate: "2025-12-05",
    },
  ]);

  const [showNewCardDialog, setShowNewCardDialog] = useState(false);
  const [newCard, setNewCard] = useState({
    contactName: "",
    signedDate: format(new Date(), "yyyy-MM-dd"),
    signedTime: format(new Date(), "HH:mm"),
    signingLocation: "",
    witnessedByName: "",
    cardType: "authorization",
    voluntarySignature: true,
    signatureObtainedProperly: true,
    dateAccurate: true,
    notes: "",
  });

  // Campaign progress calculations
  const targetCardCount = 175;
  const validCards = cardEvents.filter((c) => c.cardStatus === "valid").length;
  const progressPercentage = (validCards / targetCardCount) * 100;
  const cardsNeeded = Math.max(0, targetCardCount - validCards);

  const submittedCards = cardEvents.filter((c) => c.submittedToNlrbClrb).length;
  const pendingSubmission = validCards - submittedCards;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      valid: { label: "Valid", variant: "outline" as const, icon: CheckCircle2, className: "bg-green-100 text-green-800 border-green-300" },
      invalid: { label: "Invalid", variant: "destructive" as const, icon: XCircle, className: "" },
      challenged: { label: "Challenged", variant: "outline" as const, icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      withdrawn: { label: "Withdrawn", variant: "secondary" as const, icon: XCircle, className: "" },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const handleAddCard = () => {
    const newCardEvent: CardSigningEvent = {
      id: Date.now().toString(),
      contactName: newCard.contactName,
      signedDate: newCard.signedDate,
      signedTime: newCard.signedTime,
      signingLocation: newCard.signingLocation,
      witnessedByName: newCard.witnessedByName,
      cardStatus: "valid",
      cardType: newCard.cardType,
      voluntarySignature: newCard.voluntarySignature,
      signatureObtainedProperly: newCard.signatureObtainedProperly,
      dateAccurate: newCard.dateAccurate,
      submittedToNlrbClrb: false,
    };

    setCardEvents([newCardEvent, ...cardEvents]);
    setShowNewCardDialog(false);
    
    // Reset form
    setNewCard({
      contactName: "",
      signedDate: format(new Date(), "yyyy-MM-dd"),
      signedTime: format(new Date(), "HH:mm"),
      signingLocation: "",
      witnessedByName: "",
      cardType: "authorization",
      voluntarySignature: true,
      signatureObtainedProperly: true,
      dateAccurate: true,
      notes: "",
    });
  };

  const handleBatchSubmit = () => {
    const updatedCards = cardEvents.map((card) => {
      if (card.cardStatus === "valid" && !card.submittedToNlrbClrb) {
        return {
          ...card,
          submittedToNlrbClrb: true,
          submissionDate: format(new Date(), "yyyy-MM-dd"),
        };
      }
      return card;
    });
    setCardEvents(updatedCards);
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valid Cards Signed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{validCards}</div>
            <p className="text-sm text-muted-foreground mt-1">of {targetCardCount} target</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cards Needed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{cardsNeeded}</div>
            <p className="text-sm text-muted-foreground mt-1">to reach target</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submitted to NLRB</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{submittedCards}</div>
            <p className="text-sm text-muted-foreground mt-1">{pendingSubmission} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{progressPercentage.toFixed(1)}%</div>
            <Progress value={progressPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Dialog open={showNewCardDialog} onOpenChange={setShowNewCardDialog}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none">
                  <FileSignature className="w-4 h-4 mr-2" />
                  Record Card Signing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Record Authorization Card Signing</DialogTitle>
                  <DialogDescription>
                    Document a new card signing event. Ensure all legal requirements are met.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Contact Information */}
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name *</Label>
                    <Input
                      id="contactName"
                      placeholder="John Doe"
                      value={newCard.contactName}
                      onChange={(e) => setNewCard({ ...newCard, contactName: e.target.value })}
                    />
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signedDate">Date Signed *</Label>
                      <Input
                        id="signedDate"
                        type="date"
                        value={newCard.signedDate}
                        onChange={(e) => setNewCard({ ...newCard, signedDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signedTime">Time Signed</Label>
                      <Input
                        id="signedTime"
                        type="time"
                        value={newCard.signedTime}
                        onChange={(e) => setNewCard({ ...newCard, signedTime: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label htmlFor="signingLocation">Signing Location *</Label>
                    <Input
                      id="signingLocation"
                      placeholder="e.g., Home visit, Union hall, Workplace"
                      value={newCard.signingLocation}
                      onChange={(e) => setNewCard({ ...newCard, signingLocation: e.target.value })}
                    />
                  </div>

                  {/* Witness */}
                  <div className="space-y-2">
                    <Label htmlFor="witnessedByName">Witnessed By (Organizer) *</Label>
                    <Input
                      id="witnessedByName"
                      placeholder="Organizer name"
                      value={newCard.witnessedByName}
                      onChange={(e) => setNewCard({ ...newCard, witnessedByName: e.target.value })}
                    />
                  </div>

                  {/* Card Type */}
                  <div className="space-y-2">
                    <Label htmlFor="cardType">Card Type</Label>
                    <Select value={newCard.cardType} onValueChange={(value) => setNewCard({ ...newCard, cardType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="authorization">Authorization Card</SelectItem>
                        <SelectItem value="membership">Membership Card</SelectItem>
                        <SelectItem value="interest">Interest Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Legal Compliance Checklist */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Legal Compliance Checklist
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="voluntary"
                          checked={newCard.voluntarySignature}
                          onCheckedChange={(checked) =>
                            setNewCard({ ...newCard, voluntarySignature: checked as boolean })
                          }
                        />
                        <label htmlFor="voluntary" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Signature was given voluntarily (no coercion)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="properly"
                          checked={newCard.signatureObtainedProperly}
                          onCheckedChange={(checked) =>
                            setNewCard({ ...newCard, signatureObtainedProperly: checked as boolean })
                          }
                        />
                        <label htmlFor="properly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Signature obtained properly (correct procedures followed)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="accurate"
                          checked={newCard.dateAccurate}
                          onCheckedChange={(checked) =>
                            setNewCard({ ...newCard, dateAccurate: checked as boolean })
                          }
                        />
                        <label htmlFor="accurate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Date on card is accurate
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Photo Upload */}
                  <div className="space-y-2">
                    <Label>Card Photo (Optional)</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">Upload photo of signed card</p>
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Additional notes about the signing..."
                      value={newCard.notes}
                      onChange={(e) => setNewCard({ ...newCard, notes: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowNewCardDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddCard}
                      disabled={
                        !newCard.contactName ||
                        !newCard.signedDate ||
                        !newCard.signingLocation ||
                        !newCard.witnessedByName ||
                        !newCard.voluntarySignature ||
                        !newCard.signatureObtainedProperly ||
                        !newCard.dateAccurate
                      }
                    >
                      <FileSignature className="w-4 h-4 mr-2" />
                      Record Card
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" disabled={pendingSubmission === 0} onClick={handleBatchSubmit}>
              <Send className="w-4 h-4 mr-2" />
              Submit {pendingSubmission} Cards to NLRB
            </Button>

            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Records
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Card Signing Events ({cardEvents.length})</CardTitle>
          <CardDescription>Chronological list of all authorization card signings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cardEvents.map((event) => (
              <Card key={event.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{event.contactName}</span>
                        {getStatusBadge(event.cardStatus)}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(event.signedDate), "MMM dd, yyyy")}
                            {event.signedTime && ` at ${event.signedTime}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{event.signingLocation}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>Witnessed by {event.witnessedByName}</span>
                        </div>
                      </div>

                      {/* Legal Compliance Indicators */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          {event.voluntarySignature && event.signatureObtainedProperly && event.dateAccurate ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Meets Legal Requirements</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 text-orange-600" />
                              <span className="text-orange-600">Legal Requirements Issue</span>
                            </>
                          )}
                        </div>
                        {event.submittedToNlrbClrb && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            <span className="text-blue-600">
                              Submitted {event.submissionDate && format(new Date(event.submissionDate), "MMM dd, yyyy")}
                            </span>
                          </div>
                        )}
                        {!event.submittedToNlrbClrb && event.cardStatus === "valid" && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span className="text-orange-600">Pending Submission</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {cardEvents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileSignature className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No card signing events recorded yet</p>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              <p className="text-sm mt-2">Click "Record Card Signing" to add your first event</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

