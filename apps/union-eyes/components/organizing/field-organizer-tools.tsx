"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Phone,
  Home,
  Building,
  MessageSquare,
  Users,
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  WifiOff,
  Wifi,
  FileText,
  TrendingUp,
  Target,
} from "lucide-react";
 
import { format } from "date-fns";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  commitmentLevel: string;
  cardSigned: boolean;
  lastContactDate?: string;
  phone?: string;
}

interface Activity {
  id: string;
  contactId: string;
  contactName: string;
  activityType: "house_visit" | "phone_call" | "workplace_visit" | "text_message" | "meeting";
  activityDate: string;
  duration: number;
  location?: string;
  gpsCoordinates?: { lat: number; lng: number };
  contactMade: boolean;
  commitmentLevelBefore?: string;
  commitmentLevelAfter?: string;
  cardSigned: boolean;
  issuesDiscussed: string[];
  concernsRaised: string[];
  interactionQuality: "poor" | "fair" | "good" | "excellent";
  likelyToVoteYes: boolean;
  potentialLeader: boolean;
  followUpNeeded: boolean;
  notes: string;
  synced: boolean;
}

const COMMITMENT_LEVELS = [
  { value: "unknown", label: "Unknown", color: "gray" },
  { value: "unaware", label: "Unaware", color: "gray" },
  { value: "aware", label: "Aware", color: "blue" },
  { value: "interested", label: "Interested", color: "blue" },
  { value: "supporter", label: "Supporter", color: "green" },
  { value: "activist", label: "Activist", color: "green" },
  { value: "leader", label: "Leader", color: "purple" },
];

const ACTIVITY_TYPES = [
  { value: "house_visit", label: "House Visit", icon: Home },
  { value: "phone_call", label: "Phone Call", icon: Phone },
  { value: "workplace_visit", label: "Workplace Visit", icon: Building },
  { value: "text_message", label: "Text Message", icon: MessageSquare },
  { value: "meeting", label: "Meeting", icon: Users },
];

export default function FieldOrganizerTools({ campaignId: _campaignId }: { campaignId: string }) {
  const [isOnline, setIsOnline] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const [contacts] = useState<Contact[]>([
    {
      id: "1",
      firstName: "John",
      lastName: "Anderson",
      jobTitle: "Production Worker",
      department: "Assembly",
      commitmentLevel: "supporter",
      cardSigned: true,
      lastContactDate: "2025-12-05",
      phone: "555-0101",
    },
    {
      id: "2",
      firstName: "Maria",
      lastName: "Rodriguez",
      jobTitle: "Quality Inspector",
      department: "Quality Control",
      commitmentLevel: "interested",
      cardSigned: false,
      lastContactDate: "2025-12-03",
      phone: "555-0102",
    },
    {
      id: "3",
      firstName: "David",
      lastName: "Chen",
      jobTitle: "Maintenance Tech",
      department: "Maintenance",
      commitmentLevel: "activist",
      cardSigned: true,
      lastContactDate: "2025-12-04",
      phone: "555-0103",
    },
  ]);

  const [newActivity, setNewActivity] = useState({
    activityType: "house_visit" as const,
    duration: 30,
    location: "",
    contactMade: true,
    commitmentLevelAfter: "",
    cardSigned: false,
    issuesDiscussed: [] as string[],
    concernsRaised: [] as string[],
    interactionQuality: "good" as const,
    likelyToVoteYes: true,
    potentialLeader: false,
    followUpNeeded: false,
    notes: "",
  });

  // Simulate online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Request GPS permission
  const enableGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGpsEnabled(true);
        },
        (_error) => {
alert("Unable to access GPS. Location tracking will not be available.");
        }
      );
    }
  };

  const handleLogActivity = () => {
    if (!selectedContact) return;

    const activity: Activity = {
      // eslint-disable-next-line react-hooks/purity
      id: Date.now().toString(),
      contactId: selectedContact.id,
      contactName: `${selectedContact.firstName} ${selectedContact.lastName}`,
      activityType: newActivity.activityType,
      activityDate: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      duration: newActivity.duration,
      location: newActivity.location || currentLocation ? "GPS Location" : undefined,
      gpsCoordinates: currentLocation || undefined,
      contactMade: newActivity.contactMade,
      commitmentLevelBefore: selectedContact.commitmentLevel,
      commitmentLevelAfter: newActivity.commitmentLevelAfter || selectedContact.commitmentLevel,
      cardSigned: newActivity.cardSigned,
      issuesDiscussed: newActivity.issuesDiscussed,
      concernsRaised: newActivity.concernsRaised,
      interactionQuality: newActivity.interactionQuality,
      likelyToVoteYes: newActivity.likelyToVoteYes,
      potentialLeader: newActivity.potentialLeader,
      followUpNeeded: newActivity.followUpNeeded,
      notes: newActivity.notes,
      synced: isOnline,
    };

    setActivities([activity, ...activities]);
    if (!isOnline) {
      setUnsyncedCount(unsyncedCount + 1);
    }
    setShowActivityDialog(false);
    resetForm();
  };

  const syncActivities = () => {
    // Simulate syncing unsynced activities
    const updatedActivities = activities.map((a) => ({ ...a, synced: true }));
    setActivities(updatedActivities);
    setUnsyncedCount(0);
  };

  const resetForm = () => {
    setNewActivity({
      activityType: "house_visit",
      duration: 30,
      location: "",
      contactMade: true,
      commitmentLevelAfter: "",
      cardSigned: false,
      issuesDiscussed: [],
      concernsRaised: [],
      interactionQuality: "good",
      likelyToVoteYes: true,
      potentialLeader: false,
      followUpNeeded: false,
      notes: "",
    });
    setSelectedContact(null);
  };

  const getCommitmentBadge = (level: string) => {
    const config = COMMITMENT_LEVELS.find((c) => c.value === level);
    if (!config) return null;

    const colorClasses = {
      gray: "bg-gray-100 text-gray-800",
      blue: "bg-blue-100 text-blue-800",
      green: "bg-green-100 text-green-800",
      purple: "bg-purple-100 text-purple-800",
    };

    return (
      <Badge className={colorClasses[config.color as keyof typeof colorClasses]}>
        {config.label}
      </Badge>
    );
  };

  const getActivityIcon = (type: string) => {
    const config = ACTIVITY_TYPES.find((a) => a.value === type);
    return config ? config.icon : FileText;
  };

  const todayActivities = activities.filter(
    (a) => format(new Date(a.activityDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
  );

  const contactsMadeToday = todayActivities.filter((a) => a.contactMade).length;
  const cardsSignedToday = todayActivities.filter((a) => a.cardSigned).length;
  const followUpsNeeded = activities.filter((a) => a.followUpNeeded && !a.synced).length;

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card className={isOnline ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-green-600" />
                ) : (
                  <WifiOff className="w-5 h-5 text-orange-600" />
                )}
                <span className="font-semibold">
                  {isOnline ? "Online Mode" : "Offline Mode"}
                </span>
              </div>
              
              {!gpsEnabled ? (
                <Button size="sm" variant="outline" onClick={enableGPS}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Enable GPS
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Navigation className="w-4 h-4" />
                  <span>GPS Active</span>
                </div>
              )}
            </div>

            {unsyncedCount > 0 && (
              <Button size="sm" onClick={syncActivities} disabled={!isOnline}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Sync {unsyncedCount} Activities
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            <CardDescription>Today's Activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayActivities.length}</div>
            <p className="text-sm text-muted-foreground mt-1">logged activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contacts Made</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{contactsMadeToday}</div>
            <p className="text-sm text-muted-foreground mt-1">successful contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cards Signed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{cardsSignedToday}</div>
            <p className="text-sm text-muted-foreground mt-1">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Follow-Ups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{followUpsNeeded}</div>
            <p className="text-sm text-muted-foreground mt-1">need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact List & Log Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact List */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Contacts</CardTitle>
            <CardDescription>Select a contact to log an activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contacts.map((contact) => (
                <Card
                  key={contact.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedContact(contact);
                    setShowActivityDialog(true);
                    setNewActivity({
                      ...newActivity,
                      commitmentLevelAfter: contact.commitmentLevel,
                    });
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {contact.firstName} {contact.lastName}
                          </span>
                          {contact.cardSigned && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Card Signed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {contact.jobTitle} â€¢ {contact.department}
                        </p>
                        {contact.lastContactDate && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last contact: {format(new Date(contact.lastContactDate), "MMM dd, yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {getCommitmentBadge(contact.commitmentLevel)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Your recent field work</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.slice(0, 5).map((activity) => {
                const Icon = getActivityIcon(activity.activityType);
                return (
                  <Card key={activity.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{activity.contactName}</span>
                            {!activity.synced && (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                <WifiOff className="w-3 h-3 mr-1" />
                                Unsynced
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {ACTIVITY_TYPES.find((t) => t.value === activity.activityType)?.label}
                            {" â€¢ "}
                            {activity.duration} min
                            {" â€¢ "}
                            {format(new Date(activity.activityDate), "MMM dd, h:mm a")}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {activity.contactMade ? (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Contact Made
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                No Contact
                              </Badge>
                            )}
                            {activity.cardSigned && (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                Card Signed
                              </Badge>
                            )}
                            {activity.followUpNeeded && (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                Follow-Up Needed
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {activities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No activities logged yet</p>
                  <p className="text-sm mt-2">Select a contact to log your first activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Log Activity: {selectedContact?.firstName} {selectedContact?.lastName}
            </DialogTitle>
            <DialogDescription>
              Record your interaction with this contact
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Activity Type */}
            <div className="space-y-2">
              <Label htmlFor="activityType">Activity Type *</Label>
              <Select
                value={newActivity.activityType}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onValueChange={(value: any) => setNewActivity({ ...newActivity, activityType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                value={newActivity.duration}
                onChange={(e) => setNewActivity({ ...newActivity, duration: parseInt(e.target.value) || 0 })}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  placeholder="Enter location or use GPS"
                  value={newActivity.location}
                  onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                  className="flex-1"
                />
                {gpsEnabled && currentLocation && (
                  <Button variant="outline" size="icon">
                    <Navigation className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Contact Made */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="contactMade"
                checked={newActivity.contactMade}
                onCheckedChange={(checked) =>
                  setNewActivity({ ...newActivity, contactMade: checked as boolean })
                }
              />
              <label htmlFor="contactMade" className="text-sm font-medium">
                Successfully made contact
              </label>
            </div>

            {newActivity.contactMade && (
              <>
                {/* Commitment Level After */}
                <div className="space-y-2">
                  <Label htmlFor="commitmentAfter">Commitment Level After</Label>
                  <Select
                    value={newActivity.commitmentLevelAfter}
                    onValueChange={(value) => setNewActivity({ ...newActivity, commitmentLevelAfter: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMITMENT_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Interaction Quality */}
                <div className="space-y-2">
                  <Label htmlFor="quality">Interaction Quality</Label>
                  <Select
                    value={newActivity.interactionQuality}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onValueChange={(value: any) => setNewActivity({ ...newActivity, interactionQuality: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cardSigned"
                      checked={newActivity.cardSigned}
                      onCheckedChange={(checked) =>
                        setNewActivity({ ...newActivity, cardSigned: checked as boolean })
                      }
                    />
                    <label htmlFor="cardSigned" className="text-sm font-medium">
                      Authorization card signed during this interaction
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="likelyToVote"
                      checked={newActivity.likelyToVoteYes}
                      onCheckedChange={(checked) =>
                        setNewActivity({ ...newActivity, likelyToVoteYes: checked as boolean })
                      }
                    />
                    <label htmlFor="likelyToVote" className="text-sm font-medium">
                      Likely to vote YES in election
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="potentialLeader"
                      checked={newActivity.potentialLeader}
                      onCheckedChange={(checked) =>
                        setNewActivity({ ...newActivity, potentialLeader: checked as boolean })
                      }
                    />
                    <label htmlFor="potentialLeader" className="text-sm font-medium">
                      Potential organizing leader
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="followUp"
                      checked={newActivity.followUpNeeded}
                      onCheckedChange={(checked) =>
                        setNewActivity({ ...newActivity, followUpNeeded: checked as boolean })
                      }
                    />
                    <label htmlFor="followUp" className="text-sm font-medium">
                      Follow-up needed
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Notes about the interaction, issues discussed, concerns raised..."
                value={newActivity.notes}
                onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })}
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowActivityDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleLogActivity}>
                <FileText className="w-4 h-4 mr-2" />
                Log Activity
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

