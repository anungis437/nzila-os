/**
 * Member Profile Page
 * View and edit member profile information
 */
"use client";


export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Calendar,
  MapPin,
  Edit,
  Save,
  X
} from "lucide-react";

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  hireDate?: string;
  unionJoinDate?: string;
  membershipNumber?: string;
  seniority?: string;
}

export default function MemberProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/members/me');
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile || {
            id: user?.id || '',
            name: user?.fullName || '',
            email: user?.emailAddresses[0]?.emailAddress || '',
          });
        }
      } catch (_error) {
} finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/members/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        setEditing(false);
      }
    } catch (_error) {
} finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>View and update your membership information</CardDescription>
          </div>
          {!editing ? (
            <Button onClick={() => setEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-gray-500" />
                  <Input
                    id="name"
                    value={profile?.name || ''}
                    onChange={(e) => setProfile({ ...profile!, name: e.target.value })}
                    disabled={!editing}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <Input
                    id="phone"
                    type="tel"
                    value={profile?.phone || ''}
                    onChange={(e) => setProfile({ ...profile!, phone: e.target.value })}
                    disabled={!editing}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="membershipNumber">Membership Number</Label>
                <Input
                  id="membershipNumber"
                  value={profile?.membershipNumber || 'Not assigned'}
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Employment Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Employment Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <Input
                    id="department"
                    value={profile?.department || ''}
                    onChange={(e) => setProfile({ ...profile!, department: e.target.value })}
                    disabled={!editing}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={profile?.position || ''}
                  onChange={(e) => setProfile({ ...profile!, position: e.target.value })}
                  disabled={!editing}
                />
              </div>

              <div>
                <Label htmlFor="hireDate">Hire Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Input
                    id="hireDate"
                    type="date"
                    value={profile?.hireDate ? new Date(profile.hireDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setProfile({ ...profile!, hireDate: e.target.value })}
                    disabled={!editing}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="unionJoinDate">Union Join Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Input
                    id="unionJoinDate"
                    type="date"
                    value={profile?.unionJoinDate ? new Date(profile.unionJoinDate).toISOString().split('T')[0] : ''}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seniority */}
          <div>
            <h3 className="text-lg font-medium mb-4">Union Membership</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-medium">Seniority</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {profile?.seniority || 'Not calculated'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
