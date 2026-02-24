/**
 * Proxy Voting Component
 * 
 * Proxy delegation and management with:
 * - Assign proxy to another member
 * - View current proxy assignments
 * - Revoke proxy delegation
 * - Accept/decline proxy requests
 * - View proxy voting history
 * - Proxy chain visualization
 * - Notification system
 * - Time-bound proxies
 * 
 * @module components/voting/proxy-voting
 */

"use client";

import * as React from "react";
import { useState } from "react";
import {
  UserCheck,
  UserX,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  History,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Member {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  department?: string;
}

interface ProxyAssignment {
  id: string;
  fromMember: Member;
  toMember: Member;
  sessionId?: string;
  sessionTitle?: string;
  startDate: Date;
  endDate?: Date;
  status: "active" | "pending" | "revoked" | "expired";
  createdAt: Date;
}

interface ProxyVotingProps {
  currentMember: Member;
  availableMembers: Member[];
  currentProxies: ProxyAssignment[];
  receivedProxies: ProxyAssignment[];
  onAssignProxy?: (toMemberId: string, sessionId?: string, endDate?: Date) => Promise<void>;
  onRevokeProxy?: (proxyId: string) => Promise<void>;
  onAcceptProxy?: (proxyId: string) => Promise<void>;
  onDeclineProxy?: (proxyId: string) => Promise<void>;
}

export function ProxyVoting({
  currentMember,
  availableMembers,
  currentProxies,
  receivedProxies,
  onAssignProxy,
  onRevokeProxy,
  onAcceptProxy,
  onDeclineProxy,
}: ProxyVotingProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sessionScope, setSessionScope] = useState<string>("all");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const activeProxy = currentProxies.find((p) => p.status === "active");
  const pendingProxies = receivedProxies.filter((p) => p.status === "pending");

  const filteredMembers = availableMembers.filter(
    (member) =>
      member.id !== currentMember.id &&
      (member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.department?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAssignProxy = async () => {
    if (!selectedMember) return;

    setIsSubmitting(true);
    try {
      const endDateTime = endDate ? new Date(endDate) : undefined;
      if (onAssignProxy) {
        await onAssignProxy(
          selectedMember.id,
          sessionScope !== "all" ? sessionScope : undefined,
          endDateTime
        );
        toast({
          title: "Proxy assigned",
          description: `${selectedMember.name} will vote on your behalf.`,
        });
        setShowAssignDialog(false);
        setSelectedMember(null);
        setEndDate("");
        setSessionScope("all");
      }
    } catch (_error) {
      toast({
        title: "Assignment failed",
        description: "Failed to assign proxy. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeProxy = async (proxyId: string) => {
    if (!confirm("Are you sure you want to revoke this proxy assignment?")) {
      return;
    }

    try {
      if (onRevokeProxy) {
        await onRevokeProxy(proxyId);
        toast({
          title: "Proxy revoked",
          description: "The proxy assignment has been cancelled.",
        });
      }
    } catch (_error) {
      toast({
        title: "Revocation failed",
        description: "Failed to revoke proxy. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptProxy = async (proxyId: string) => {
    try {
      if (onAcceptProxy) {
        await onAcceptProxy(proxyId);
        toast({
          title: "Proxy accepted",
          description: "You can now vote on behalf of this member.",
        });
      }
    } catch (_error) {
      toast({
        title: "Accept failed",
        description: "Failed to accept proxy. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeclineProxy = async (proxyId: string) => {
    try {
      if (onDeclineProxy) {
        await onDeclineProxy(proxyId);
        toast({
          title: "Proxy declined",
          description: "The proxy request has been declined.",
        });
      }
    } catch (_error) {
      toast({
        title: "Decline failed",
        description: "Failed to decline proxy. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Proxy Alert */}
      {activeProxy && (
        <Alert>
          <UserCheck className="w-4 h-4" />
          <AlertTitle>Active Proxy Assignment</AlertTitle>
          <AlertDescription>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={activeProxy.toMember.imageUrl} />
                  <AvatarFallback>
                    {activeProxy.toMember.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{activeProxy.toMember.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProxy.sessionTitle || "All voting sessions"}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRevokeProxy(activeProxy.id)}
              >
                Revoke
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Proxy Requests */}
      {pendingProxies.length > 0 && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Pending Proxy Requests ({pendingProxies.length})</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              {pendingProxies.map((proxy) => (
                <div
                  key={proxy.id}
                  className="flex items-center justify-between p-2 bg-background rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={proxy.fromMember.imageUrl} />
                      <AvatarFallback>
                        {proxy.fromMember.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{proxy.fromMember.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {proxy.sessionTitle || "All sessions"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcceptProxy(proxy.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeclineProxy(proxy.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="assign">
        <TabsList>
          <TabsTrigger value="assign">Assign Proxy</TabsTrigger>
          <TabsTrigger value="received">
            Received Proxies
            {receivedProxies.filter((p) => p.status === "active").length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {receivedProxies.filter((p) => p.status === "active").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Assign Proxy Tab */}
        <TabsContent value="assign" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Assign Your Proxy</CardTitle>
                <Button
                  onClick={() => setShowAssignDialog(true)}
                  disabled={!!activeProxy}
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Assign Proxy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeProxy ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="w-12 h-12 mx-auto mb-4" />
                  <p>You have an active proxy assignment.</p>
                  <p className="text-sm mt-1">
                    Revoke your current proxy to assign a new one.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4" />
                  <p>Select a member to vote on your behalf</p>
                  <p className="text-sm mt-1">
                    Your proxy can vote in all sessions or specific ones
                  </p>
                </div>
              )}

              {currentProxies.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Current Assignments</h4>
                  <div className="space-y-2">
                    {currentProxies.map((proxy) => (
                      <div
                        key={proxy.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={proxy.toMember.imageUrl} />
                            <AvatarFallback>
                              {proxy.toMember.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{proxy.toMember.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {proxy.sessionTitle || "All sessions"}
                            </p>
                            {proxy.endDate && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                Until {proxy.endDate.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              proxy.status === "active"
                                ? "default"
                                : proxy.status === "pending"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {proxy.status}
                          </Badge>
                          {proxy.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeProxy(proxy.id)}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Received Proxies Tab */}
        <TabsContent value="received" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proxies You Can Vote For</CardTitle>
            </CardHeader>
            <CardContent>
              {receivedProxies.filter((p) => p.status === "active").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4" />
                  <p>No active proxy assignments</p>
                  <p className="text-sm mt-1">
                    Members can assign you as their proxy
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {receivedProxies
                    .filter((p) => p.status === "active")
                    .map((proxy) => (
                      <div
                        key={proxy.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={proxy.fromMember.imageUrl} />
                            <AvatarFallback>
                              {proxy.fromMember.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{proxy.fromMember.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {proxy.sessionTitle || "All sessions"}
                            </p>
                            {proxy.endDate && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                Until {proxy.endDate.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge>Active</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Proxy History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {[...currentProxies, ...receivedProxies]
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map((proxy) => {
                      const isReceived = receivedProxies.includes(proxy);
                      return (
                        <div
                          key={proxy.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Avatar className="w-8 h-8">
                                <AvatarImage
                                  src={
                                    isReceived
                                      ? proxy.fromMember.imageUrl
                                      : proxy.toMember.imageUrl
                                  }
                                />
                                <AvatarFallback>
                                  {(isReceived
                                    ? proxy.fromMember.name
                                    : proxy.toMember.name
                                  )
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <ArrowRight className="w-4 h-4 text-muted-foreground mx-1" />
                              <Avatar className="w-8 h-8">
                                <AvatarImage
                                  src={
                                    isReceived
                                      ? currentMember.imageUrl
                                      : proxy.toMember.imageUrl
                                  }
                                />
                                <AvatarFallback>
                                  {(isReceived
                                    ? currentMember.name
                                    : proxy.toMember.name
                                  )
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {isReceived ? "From" : "To"}{" "}
                                {isReceived ? proxy.fromMember.name : proxy.toMember.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {proxy.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              proxy.status === "active"
                                ? "default"
                                : proxy.status === "pending"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {proxy.status}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Proxy Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Proxy Voter</DialogTitle>
            <DialogDescription>
              Select a member who will vote on your behalf
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Members</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg p-2">
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      selectedMember?.id === member.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar>
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>
                        {member.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs opacity-80">{member.email}</p>
                      {member.department && (
                        <p className="text-xs opacity-60">{member.department}</p>
                      )}
                    </div>
                    {selectedMember?.id === member.id && (
                      <CheckCircle className="ml-auto w-5 h-5" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={sessionScope} onValueChange={setSessionScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="specific">Specific Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false);
                setSelectedMember(null);
                setEndDate("");
                setSessionScope("all");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignProxy}
              disabled={!selectedMember || isSubmitting}
            >
              {isSubmitting ? "Assigning..." : "Assign Proxy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

