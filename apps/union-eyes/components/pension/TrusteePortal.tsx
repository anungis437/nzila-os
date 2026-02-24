'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 
import { Badge } from '@/components/ui/badge';

interface PensionPlan {
  id: string;
  planName: string;
  planType: string;
  fundedRatio: number;
  solvencyRatio: number;
  totalAssets: string;
  totalLiabilities: string;
  activeMembers: number;
  status: string;
}

interface TrusteeMeeting {
  id: string;
  meetingDate: string;
  meetingType: string;
  location: string;
  agendaItems: string[];
  quorumMet: boolean;
  attendeeIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  votingRecords: any[];
}

interface Trustee {
  id: string;
  memberId: string;
  trusteeType: string;
  position: string;
  appointedDate: string;
  termStartDate: string;
  termEndDate: string;
  status: string;
}

interface TrusteePortalProps {
  trustBoardId: string;
  memberId: string;
}

export default function TrusteePortal({ trustBoardId, memberId: _memberId }: TrusteePortalProps) {
  const [plan, setPlan] = useState<PensionPlan | null>(null);
  const [meetings, setMeetings] = useState<TrusteeMeeting[]>([]);
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'meetings' | 'trustees'>('overview');

  useEffect(() => {
    fetchPortalData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustBoardId]);

  const fetchPortalData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch pension plan details (using existing API)
      const planRes = await fetch(`/api/pension/plans?trustBoardId=${trustBoardId}&limit=1`);
      const planData = await planRes.json();
      if (planRes.ok && planData.data && planData.data.length > 0) {
        setPlan(planData.data[0]);
      }

      // Fetch trustee meetings
      const meetingsRes = await fetch(`/api/pension/trustee-meetings?trustBoardId=${trustBoardId}&limit=10`);
      const meetingsData = await meetingsRes.json();
      if (meetingsRes.ok) {
        setMeetings(meetingsData.data || []);
      }

      // Fetch trustees
      const trusteesRes = await fetch(`/api/pension/trustees?trustBoardId=${trustBoardId}&activeOnly=true`);
      const trusteesData = await trusteesRes.json();
      if (trusteesRes.ok) {
        setTrustees(trusteesData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(typeof value === 'string' ? parseFloat(value) : value);
  };

  const getHealthStatus = (fundedRatio: number) => {
    if (fundedRatio >= 1.0) return { label: 'Healthy', color: 'bg-green-100 text-green-800' };
    if (fundedRatio >= 0.85) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'At Risk', color: 'bg-red-100 text-red-800' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading trustee portal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800 font-semibold">Error loading portal</p>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Pension Trustee Portal</h2>
        <p className="text-gray-600 mt-1">{plan?.planName || 'Pension Plan'}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'meetings', 'trustees'].map((tab) => (
            <button
              key={tab}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => setSelectedTab(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && plan && (
        <div className="space-y-6">
          {/* Health Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Funded Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{(plan.fundedRatio * 100).toFixed(1)}%</div>
                <Badge className={`mt-2 ${getHealthStatus(plan.fundedRatio).color}`}>
                  {getHealthStatus(plan.fundedRatio).label}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Solvency Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{(plan.solvencyRatio * 100).toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(plan.totalAssets)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{plan.activeMembers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700 font-medium">Total Assets</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(plan.totalAssets)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700 font-medium">Total Liabilities</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(plan.totalLiabilities)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700 font-medium">Surplus / (Deficit)</span>
                  <span className={`font-bold ${
                    parseFloat(plan.totalAssets) >= parseFloat(plan.totalLiabilities)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(parseFloat(plan.totalAssets) - parseFloat(plan.totalLiabilities))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700 font-medium">Plan Type</span>
                  <Badge>{plan.planType}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <p className="text-gray-500">No upcoming meetings scheduled</p>
              ) : (
                <div className="space-y-3">
                  {meetings.slice(0, 3).map((meeting) => (
                    <div
                      key={meeting.id}
                      className="p-4 border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(meeting.meetingDate).toLocaleDateString('en-CA', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-gray-600">{meeting.location}</p>
                        </div>
                        <Badge variant={meeting.quorumMet ? 'default' : 'secondary'}>
                          {meeting.meetingType}
                        </Badge>
                      </div>
                      {meeting.agendaItems && meeting.agendaItems.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-700 font-medium">Agenda:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                            {meeting.agendaItems.slice(0, 3).map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meetings Tab */}
      {selectedTab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900">Meeting History</h3>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Schedule Meeting
            </button>
          </div>
          {meetings.length === 0 ? (
            <p className="text-gray-500">No meetings recorded</p>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {new Date(meeting.meetingDate).toLocaleDateString('en-CA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </h4>
                        <p className="text-sm text-gray-600">{meeting.location}</p>
                      </div>
                      <div className="space-x-2">
                        <Badge>{meeting.meetingType}</Badge>
                        {meeting.quorumMet ? (
                          <Badge className="bg-green-100 text-green-800">Quorum Met</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">No Quorum</Badge>
                        )}
                      </div>
                    </div>
                    {meeting.agendaItems && meeting.agendaItems.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Agenda Items:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {meeting.agendaItems.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="text-sm text-gray-600">
                        {meeting.attendeeIds?.length || 0} attendees
                      </span>
                      <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        View Minutes →
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trustees Tab */}
      {selectedTab === 'trustees' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900">Board Members</h3>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Appoint Trustee
            </button>
          </div>
          {trustees.length === 0 ? (
            <p className="text-gray-500">No trustees recorded</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trustees.map((trustee) => (
                <Card key={trustee.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {trustee.position || 'Trustee'}
                        </h4>
                        <p className="text-sm text-gray-600">Member ID: {trustee.memberId}</p>
                      </div>
                      <Badge variant={trustee.status === 'active' ? 'default' : 'secondary'}>
                        {trustee.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium text-gray-900 capitalize">{trustee.trusteeType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Appointed:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(trustee.appointedDate).toLocaleDateString('en-CA')}
                        </span>
                      </div>
                      {trustee.termEndDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Term Ends:</span>
                          <span className="font-medium text-gray-900">
                            {new Date(trustee.termEndDate).toLocaleDateString('en-CA')}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-gray-700">
        <p className="font-medium mb-1">Trustee Responsibilities:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Act in the best interests of plan members and beneficiaries</li>
          <li>Maintain fiduciary duty and duty of care</li>
          <li>Ensure plan compliance with pension legislation</li>
          <li>Review actuarial valuations and investment performance</li>
        </ul>
      </div>
    </div>
  );
}

