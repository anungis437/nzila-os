/**
 * Member Profile Page
 * 
 * Comprehensive profile view integrating:
 * - Member profile card with details
 * - Personal documents
 * - Training history
 * - Claims list
 * - Engagement metrics
 * 
 * @page app/[locale]/profile/page.tsx
 */

"use client";

export const dynamic = 'force-dynamic';

import * as React from "react";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  FileText,
  Edit,
} from "lucide-react";

interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  status: string;
  joinDate: string;
  membershipNumber: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export default function ProfilePage() {
  const { user } = useUser();
  const [memberData, setMemberData] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/v2/members/me');
        if (res.ok) {
          const data = await res.json();
          setMemberData({
            id: data.id ?? user?.id ?? '',
            firstName: data.firstName ?? data.first_name ?? user?.firstName ?? '',
            lastName: data.lastName ?? data.last_name ?? user?.lastName ?? '',
            email: data.email ?? user?.primaryEmailAddress?.emailAddress ?? '',
            phone: data.phone ?? '',
            department: data.department ?? '',
            position: data.position ?? '',
            status: data.status ?? 'active',
            joinDate: data.joinDate ?? data.join_date ?? data.createdAt ?? '',
            membershipNumber: data.membershipNumber ?? data.membership_number ?? '',
            address: data.address ?? '',
            emergencyContact: data.emergencyContact ?? data.emergency_contact ?? {
              name: '',
              relationship: '',
              phone: '',
            },
          });
        } else {
          // Fallback to Clerk user data
          setMemberData({
            id: user?.id ?? '',
            firstName: user?.firstName ?? '',
            lastName: user?.lastName ?? '',
            email: user?.primaryEmailAddress?.emailAddress ?? '',
            phone: '',
            department: '',
            position: '',
            status: 'active',
            joinDate: user?.createdAt ? new Date(user.createdAt).toISOString() : '',
            membershipNumber: '',
            address: '',
            emergencyContact: { name: '', relationship: '', phone: '' },
          });
        }
      } catch {
        // Fallback to Clerk
        setMemberData({
          id: user?.id ?? '',
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
          email: user?.primaryEmailAddress?.emailAddress ?? '',
          phone: '',
          department: '',
          position: '',
          status: 'active',
          joinDate: user?.createdAt ? new Date(user.createdAt).toISOString() : '',
          membershipNumber: '',
          address: '',
          emergencyContact: { name: '', relationship: '', phone: '' },
        });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-gray-600">Unable to load profile.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-gray-600 mt-2">View and manage your member profile</p>
        </div>
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* Profile Summary Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-12 w-12 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">
                  {memberData.firstName} {memberData.lastName}
                </h2>
                <Badge variant="default">{memberData.status}</Badge>
              </div>
              <p className="text-gray-600 mt-1">
                {memberData.position}, {memberData.department}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{memberData.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{memberData.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{memberData.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>
                    Member since {memberData.joinDate ? new Date(memberData.joinDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Membership Number:{" "}
                  <span className="font-mono font-semibold">
                    {memberData.membershipNumber}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="training">Training History</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Full Name
                  </label>
                  <p>
                    {memberData.firstName} {memberData.lastName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Department
                  </label>
                  <p>{memberData.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Position
                  </label>
                  <p>{memberData.position}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p>{memberData.emergencyContact.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Relationship
                  </label>
                  <p>{memberData.emergencyContact.relationship}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p>{memberData.emergencyContact.phone}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Your personal documents and uploaded files will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Training History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Your completed courses and certifications will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Your submitted claims and their status will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Your engagement scores and activity history will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
