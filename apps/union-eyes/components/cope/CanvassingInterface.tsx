/**
 * Canvassing Interface Component
 * Log door-knocking and phone banking activities with daily summaries
 * Phase 3: COPE Political Action UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Home,
  Phone,
  User,
  Trophy,
} from 'lucide-react';
import { format } from 'date-fns';

interface CanvassingActivity {
  id: string;
  activity_date: string;
  volunteer_name: string;
  activity_type: string;
  contacts_made: number;
  support_level: string;
  voter_response: string;
  notes: string;
}

interface DailySummary {
  activity_date: string;
  total_activities: number;
  total_contacts: number;
  unique_volunteers: number;
  strong_support: number;
  support: number;
  undecided: number;
  oppose: number;
  strong_oppose: number;
  doors_knocked: number;
  phone_calls: number;
  petitions_signed: number;
}

interface VolunteerLeader {
  volunteer_name: string;
  total_activities: number;
  total_contacts: number;
  avg_contacts_per_activity: number;
}

interface CanvassingInterfaceProps {
  campaignId: string;
  organizationId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activityTypeIcons: Record<string, any> = {
  door_knock: Home,
  phone_call: Phone,
  petition: User,
};

const supportLevelColors: Record<string, string> = {
  strong_support: 'bg-green-600',
  support: 'bg-green-400',
  undecided: 'bg-yellow-400',
  oppose: 'bg-orange-400',
  strong_oppose: 'bg-red-600',
  not_home: 'bg-gray-400',
  refused: 'bg-slate-500',
};

export function CanvassingInterface({ campaignId, organizationId }: CanvassingInterfaceProps) {
  const [activities, setActivities] = useState<CanvassingActivity[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [volunteerLeaders, setVolunteerLeaders] = useState<VolunteerLeader[]>([]);
  const [_loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    volunteerName: '',
    activityType: 'door_knock',
    contactsMade: '1',
    supportLevel: 'undecided',
    voterResponse: '',
    notes: '',
  });

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cope/canvassing?campaignId=${campaignId}`);
      
      if (!response.ok) throw new Error('Failed to fetch activities');
      
      const data = await response.json();
      setActivities(data.data.activities || []);
      setDailySummary(data.data.summary || null);
      
      // Calculate volunteer leaders
      const volunteerStats: Record<string, { activities: number; contacts: number }> = {};
      (data.data.activities || []).forEach((activity: CanvassingActivity) => {
        if (!volunteerStats[activity.volunteer_name]) {
          volunteerStats[activity.volunteer_name] = { activities: 0, contacts: 0 };
        }
        volunteerStats[activity.volunteer_name].activities++;
        volunteerStats[activity.volunteer_name].contacts += activity.contacts_made;
      });

      const leaders = Object.entries(volunteerStats)
        .map(([name, stats]) => ({
          volunteer_name: name,
          total_activities: stats.activities,
          total_contacts: stats.contacts,
          avg_contacts_per_activity: Math.round((stats.contacts / stats.activities) * 10) / 10,
        }))
        .sort((a, b) => b.total_contacts - a.total_contacts)
        .slice(0, 10);

      setVolunteerLeaders(leaders);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/cope/canvassing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          organizationId,
          volunteerName: formData.volunteerName,
          activityType: formData.activityType,
          contactsMade: parseInt(formData.contactsMade),
          supportLevel: formData.supportLevel,
          voterResponse: formData.voterResponse,
          notes: formData.notes,
        }),
      });

      if (!response.ok) throw new Error('Failed to log activity');

      // Reset form
      setFormData({
        volunteerName: formData.volunteerName, // Keep volunteer name
        activityType: 'door_knock',
        contactsMade: '1',
        supportLevel: 'undecided',
        voterResponse: '',
        notes: '',
      });

      setShowForm(false);
      fetchActivities();
    } catch (_error) {
alert('Failed to log activity');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Canvassing Activities</h2>
          <p className="text-muted-foreground">Track door-knocking and phone banking efforts</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Log Activity'}
        </Button>
      </div>

      {/* Activity Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Log New Activity</CardTitle>
            <CardDescription>Record a door-knock, phone call, or petition signature</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="volunteerName">Volunteer Name *</Label>
                  <Input
                    id="volunteerName"
                    value={formData.volunteerName}
                    onChange={(e) => setFormData({ ...formData, volunteerName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activityType">Activity Type *</Label>
                  <Select
                    value={formData.activityType}
                    onValueChange={(value) => setFormData({ ...formData, activityType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="door_knock">Door Knock</SelectItem>
                      <SelectItem value="phone_call">Phone Call</SelectItem>
                      <SelectItem value="petition">Petition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactsMade">Contacts Made *</Label>
                  <Input
                    id="contactsMade"
                    type="number"
                    min="1"
                    value={formData.contactsMade}
                    onChange={(e) => setFormData({ ...formData, contactsMade: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportLevel">Support Level *</Label>
                  <Select
                    value={formData.supportLevel}
                    onValueChange={(value) => setFormData({ ...formData, supportLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strong_support">Strong Support</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="undecided">Undecided</SelectItem>
                      <SelectItem value="oppose">Oppose</SelectItem>
                      <SelectItem value="strong_oppose">Strong Oppose</SelectItem>
                      <SelectItem value="not_home">Not Home</SelectItem>
                      <SelectItem value="refused">Refused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voterResponse">Voter Response (optional)</Label>
                <Input
                  id="voterResponse"
                  value={formData.voterResponse}
                  onChange={(e) => setFormData({ ...formData, voterResponse: e.target.value })}
                  placeholder="Brief summary of conversation..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save Activity</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Daily Summary */}
      {dailySummary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailySummary.total_activities}</div>
              <p className="text-xs text-muted-foreground">
                {dailySummary.unique_volunteers} volunteers active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Home className="h-4 w-4 mr-2" />
                Doors Knocked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailySummary.doors_knocked}</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                Phone Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailySummary.phone_calls}</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Support Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-600 mr-2" />
                    Support
                  </span>
                  <span className="font-medium">{dailySummary.strong_support + dailySummary.support}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 mr-2" />
                    Undecided
                  </span>
                  <span className="font-medium">{dailySummary.undecided}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-600 mr-2" />
                    Oppose
                  </span>
                  <span className="font-medium">{dailySummary.oppose + dailySummary.strong_oppose}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Last {Math.min(activities.length, 10)} logged activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.slice(0, 10).map((activity) => {
                const Icon = activityTypeIcons[activity.activity_type] || User;
                return (
                  <div 
                    key={activity.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{activity.volunteer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {activity.contacts_made} contact{activity.contacts_made !== 1 ? 's' : ''} â€¢ {format(new Date(activity.activity_date), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                    <Badge className={supportLevelColors[activity.support_level] || 'bg-gray-500'}>
                      {activity.support_level.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Volunteer Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
              Volunteer Leaderboard
            </CardTitle>
            <CardDescription>Top volunteers by contacts made</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {volunteerLeaders.map((volunteer, index) => (
                <div 
                  key={volunteer.volunteer_name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{volunteer.volunteer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {volunteer.total_activities} activities â€¢ Avg {volunteer.avg_contacts_per_activity} contacts
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{volunteer.total_contacts}</div>
                    <div className="text-xs text-muted-foreground">contacts</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

