/**
 * Member Profile Card Detailed Component
 * 
 * Comprehensive member profile display with:
 * - Personal information
 * - Employment details
 * - Membership status
 * - Contact information
 * - Quick actions
 * - Activity summary
 * 
 * @module components/members/member-profile-card-detailed
 */

"use client";

import * as React from "react";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Award,
  TrendingUp,
  Edit,
  MoreHorizontal,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface MemberProfile {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: "active" | "inactive" | "suspended" | "retired";
  membershipType: "regular" | "honorary" | "retiree";
  joinDate: Date;
  // Employment
  employer?: string;
  department?: string;
  jobTitle?: string;
  location?: string;
  // Union Info
  chapter?: string;
  seniorityDate?: Date;
  duesStatus: "current" | "overdue" | "exempt";
  // Statistics
  claimsCount: number;
  eventsAttended: number;
  lastActivity?: Date;
}

export interface MemberProfileCardDetailedProps {
  member: MemberProfile;
  onEdit?: () => void;
  onViewDetails?: () => void;
  onSendMessage?: () => void;
  onViewClaims?: () => void;
  className?: string;
}

const statusConfig = {
  active: { label: "Active", variant: "success" as const },
  inactive: { label: "Inactive", variant: "secondary" as const },
  suspended: { label: "Suspended", variant: "destructive" as const },
  retired: { label: "Retired", variant: "outline" as const },
};

const duesStatusConfig = {
  current: { label: "Current", variant: "success" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
  exempt: { label: "Exempt", variant: "secondary" as const },
};

export function MemberProfileCardDetailed({
  member,
  onEdit,
  onViewDetails,
  onSendMessage,
  onViewClaims,
  className,
}: MemberProfileCardDetailedProps) {
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header with gradient */}
      <div className="h-20 bg-linear-to-r from-blue-500 to-blue-600" />

      <CardHeader className="relative pb-0">
        <div className="flex items-start justify-between">
          <Avatar className="w-24 h-24 border-4 border-white -mt-12 shadow-lg">
            <AvatarImage src={member.avatar} alt={`${member.firstName} ${member.lastName}`} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button size="icon" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onViewDetails && (
                  <DropdownMenuItem onClick={onViewDetails}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Full Profile
                  </DropdownMenuItem>
                )}
                {onSendMessage && (
                  <DropdownMenuItem onClick={onSendMessage}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Message
                  </DropdownMenuItem>
                )}
                {onViewClaims && (
                  <DropdownMenuItem onClick={onViewClaims}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    View Claims
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Suspend Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-2xl font-bold">
              {member.firstName} {member.lastName}
            </h3>
            <Badge variant={statusConfig[member.status].variant}>
              {statusConfig[member.status].label}
            </Badge>
            <Badge variant="outline">
              Member #{member.memberNumber}
            </Badge>
          </div>
          <p className="text-gray-600 mt-1">{member.jobTitle}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Contact Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Contact Information
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline">
                {member.email}
              </a>
            </div>
            {member.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${member.phone}`} className="text-blue-600 hover:underline">
                  {member.phone}
                </a>
              </div>
            )}
            {member.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{member.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Employment Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Employment
          </h4>
          <div className="space-y-2">
            {member.employer && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span>
                  {member.employer}
                  {member.department && ` - ${member.department}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Membership Info */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Membership Details
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Join Date</div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                {format(member.joinDate, "MMM d, yyyy")}
              </div>
            </div>
            {member.seniorityDate && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Seniority Date</div>
                <div className="flex items-center gap-2 text-sm">
                  <Award className="h-4 w-4 text-gray-400" />
                  {format(member.seniorityDate, "MMM d, yyyy")}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 mb-1">Dues Status</div>
              <Badge variant={duesStatusConfig[member.duesStatus].variant}>
                <CreditCard className="h-3 w-3 mr-1" />
                {duesStatusConfig[member.duesStatus].label}
              </Badge>
            </div>
            {member.chapter && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Chapter</div>
                <div className="text-sm font-medium">{member.chapter}</div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Activity Summary
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {member.claimsCount}
              </div>
              <div className="text-xs text-gray-600 mt-1">Claims</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {member.eventsAttended}
              </div>
              <div className="text-xs text-gray-600 mt-1">Events</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <TrendingUp className="h-6 w-6 mx-auto text-purple-600 mb-1" />
              <div className="text-xs text-gray-600">Engagement</div>
            </div>
          </div>
          {member.lastActivity && (
            <p className="text-xs text-gray-500 text-center mt-3">
              Last active: {format(member.lastActivity, "PPp")}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="pt-4 border-t flex gap-2">
          {onSendMessage && (
            <Button variant="outline" className="flex-1" onClick={onSendMessage}>
              <Mail className="h-4 w-4 mr-2" />
              Message
            </Button>
          )}
          {onViewDetails && (
            <Button className="flex-1" onClick={onViewDetails}>
              View Full Profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

