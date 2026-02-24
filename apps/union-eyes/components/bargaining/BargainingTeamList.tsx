/**
 * Bargaining Team List Component
 * 
 * Display and manage bargaining committee members.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Mail, Phone, Briefcase, Star } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isChief: boolean;
  organization?: string;
  title?: string;
  expertise?: string[];
  isActive: boolean;
}

interface BargainingTeamListProps {
  teamMembers: TeamMember[];
}

const roleLabels: Record<string, string> = {
  chief_negotiator: "Chief Negotiator",
  committee_member: "Committee Member",
  researcher: "Researcher",
  note_taker: "Note Taker",
  subject_expert: "Subject Expert",
  observer: "Observer",
  legal_counsel: "Legal Counsel",
  financial_advisor: "Financial Advisor",
};

const roleColors: Record<string, string> = {
  chief_negotiator: "bg-purple-500",
  committee_member: "bg-blue-500",
  researcher: "bg-green-500",
  note_taker: "bg-yellow-500",
  subject_expert: "bg-orange-500",
  observer: "bg-gray-500",
  legal_counsel: "bg-red-500",
  financial_advisor: "bg-indigo-500",
};

export function BargainingTeamList({ teamMembers }: BargainingTeamListProps) {
  const activeMembers = teamMembers.filter(m => m.isActive);
  const _inactiveMembers = teamMembers.filter(m => !m.isActive);
  const chiefNegotiator = activeMembers.find(m => m.isChief);

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bargaining Team</CardTitle>
            <CardDescription>
              Committee members participating in negotiations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{activeMembers.length}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Chief Negotiator */}
          {chiefNegotiator && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Chief Negotiator
              </h3>
              <div className="border-l-4 border-l-purple-500 p-4 border rounded-lg bg-purple-50/30">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-purple-500 text-white">
                      {getInitials(chiefNegotiator.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{chiefNegotiator.name}</h4>
                      <Badge className={roleColors[chiefNegotiator.role]}>
                        {roleLabels[chiefNegotiator.role]}
                      </Badge>
                    </div>
                    {chiefNegotiator.title && (
                      <p className="text-sm text-muted-foreground">
                        {chiefNegotiator.title}
                      </p>
                    )}
                    {chiefNegotiator.organization && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {chiefNegotiator.organization}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      {chiefNegotiator.email && (
                        <a
                          href={`mailto:${chiefNegotiator.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {chiefNegotiator.email}
                        </a>
                      )}
                      {chiefNegotiator.phone && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {chiefNegotiator.phone}
                        </span>
                      )}
                    </div>
                    {chiefNegotiator.expertise && chiefNegotiator.expertise.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {chiefNegotiator.expertise.map((exp, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {exp}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Committee Members */}
          {activeMembers.filter(m => !m.isChief).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Committee Members ({activeMembers.filter(m => !m.isChief).length})
              </h3>
              <div className="space-y-3">
                {activeMembers
                  .filter(m => !m.isChief)
                  .map((member) => (
                    <div key={member.id} className="p-3 border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{member.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {roleLabels[member.role]}
                            </Badge>
                          </div>
                          {member.title && (
                            <p className="text-sm text-muted-foreground">
                              {member.title}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {member.email && (
                              <a
                                href={`mailto:${member.email}`}
                                className="flex items-center gap-1 hover:underline"
                              >
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </a>
                            )}
                            {member.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {member.phone}
                              </span>
                            )}
                          </div>
                          {member.expertise && member.expertise.length > 0 && ( <div className="flex flex-wrap gap-1 mt-2">
                              {member.expertise.map((exp, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {exp}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* No Members */}
          {activeMembers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4" />
              <p>No team members assigned</p>
              <p className="text-sm">Add members to your bargaining committee</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
