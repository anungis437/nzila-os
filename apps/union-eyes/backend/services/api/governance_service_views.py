"""
GovernanceService API ViewSet
Implementation of governance-service.ts operations in Django REST
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from datetime import datetime, date
import uuid

# Import governance models from compliance app
from compliance.models import (
    GoldenShares,
    ReservedMatterVotes,
    MissionAudits,
    GovernanceEvents,
    CouncilElections,
)


class GovernanceServiceViewSet(viewsets.ViewSet):
    """
    ViewSet for governance-service operations
    
    Custom endpoints for golden share management, Reserved Matter voting,
    mission audits, and sunset clause tracking.
    """
    
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def issue_golden_share(self, request):
        """
        Issue Golden Share - Create Class B Special Voting Share for Council
        POST /api/services/governance-service/issue_golden_share/
        """
        try:
            data = request.data
            
            with transaction.atomic():
                # Create golden share
                share = GoldenShares.objects.create(
                    certificate_number=data['certificateNumber'],
                    issue_date=data['issueDate'],
                    council_members=data['councilMembers'],
                    status='active',
                    sunset_clause_active=True,
                    consecutive_compliance_years=0,
                )
                
                # Log governance event
                GovernanceEvents.objects.create(
                    event_type='golden_share_issued',
                    event_date=timezone.now(),
                    golden_share_id=share.id,
                    title='Class B Special Voting Share Issued',
                    description=f'Golden share certificate {data["certificateNumber"]} issued to Union Member Representative Council. Council members: {len(data["councilMembers"])}. Sunset clause active with {share.sunset_clause_duration}-year compliance requirement.',
                    impact='high',
                    impact_description='Union Member Representative Council now holds Class B voting rights for Reserved Matters. 51% voting power activated. Sunset clause tracking begins.',
                    stakeholders=['board', 'council', 'investors'],
                    created_at=timezone.now(),
                )
                
                return Response({
                    'id': str(share.id),
                    'certificateNumber': share.certificate_number,
                    'issueDate': share.issue_date,
                    'status': share.status,
                    'consecutiveComplianceYears': share.consecutive_compliance_years,
                    'sunsetClauseDuration': share.sunset_clause_duration,
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def check_status(self, request):
        """
        Check Golden Share Status
        GET /api/services/governance-service/check_status/
        """
        try:
            # Get active golden share
            share = GoldenShares.objects.filter(status='active').first()
            
            if not share:
                return Response({
                    'share': None,
                    'sunsetProgress': {
                        'consecutiveYears': 0,
                        'requiredYears': 5,
                        'yearsRemaining': 5,
                        'percentComplete': 0,
                        'sunsetTriggered': False,
                    },
                    'lastAudit': None,
                }, status=status.HTTP_200_OK)
            
            # Get most recent audit
            recent_audit = MissionAudits.objects.order_by('-audit_year').first()
            
            years_remaining = max(0, share.sunset_clause_duration - share.consecutive_compliance_years)
            percent_complete = (share.consecutive_compliance_years / share.sunset_clause_duration) * 100 if share.sunset_clause_duration > 0 else 0
            
            return Response({
                'share': {
                    'id': str(share.id),
                    'certificateNumber': share.certificate_number,
                    'status': share.status,
                    'issueDate': share.issue_date,
                },
                'sunsetProgress': {
                    'consecutiveYears': share.consecutive_compliance_years,
                    'requiredYears': share.sunset_clause_duration,
                    'yearsRemaining': years_remaining,
                    'percentComplete': round(percent_complete, 2),
                    'sunsetTriggered': share.sunset_triggered_date is not None,
                },
                'lastAudit': {
                    'auditYear': recent_audit.audit_year,
                    'overallPass': recent_audit.overall_pass,
                } if recent_audit else None,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def request_reserved_matter_vote(self, request):
        """
        Request Reserved Matter Vote
        POST /api/services/governance-service/request_reserved_matter_vote/
        """
        try:
            data = request.data
            
            with transaction.atomic():
                # Create vote record
                vote = ReservedMatterVotes.objects.create(
                    matter_type=data['matterType'],
                    title=data['title'],
                    description=data['description'],
                    proposed_by=data.get('proposedBy', ''),
                )
                
                # Log governance event
                GovernanceEvents.objects.create(
                    event_type='reserved_matter_vote',
                    event_date=timezone.now(),
                    reserved_matter_vote_id=vote.id,
                    title=f'Reserved Matter: {data["title"]}',
                    description=f'{data["matterType"]} proposal requires Union Council approval.',
                    impact='high',
                    impact_description='Reserved Matter requires Class B (golden share) approval before proceeding.',
                    stakeholders=['board', 'council', 'investors'],
                    created_at=timezone.now(),
                )
                
                return Response({
                    'id': str(vote.id),
                    'matterType': vote.matter_type,
                    'title': vote.title,
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Get Governance Dashboard
        GET /api/services/governance-service/dashboard/
        """
        try:
            # Get golden share status
            share = GoldenShares.objects.filter(status='active').first()
            
            # Get recent votes
            recent_votes = list(ReservedMatterVotes.objects.order_by('-created_at')[:5].values())
            
            # Get recent audits
            recent_audits = list(MissionAudits.objects.order_by('-audit_year')[:3].values())
            
            # Get recent events
            recent_events = list(GovernanceEvents.objects.order_by('-event_date')[:10].values())
            
            return Response({
                'goldenShare': {
                    'id': str(share.id) if share else None,
                    'status': share.status if share else None,
                    'consecutiveComplianceYears': share.consecutive_compliance_years if share else 0,
                },
                'recentVotes': recent_votes,
                'recentAudits': recent_audits,
                'recentEvents': recent_events,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def record_class_a_vote(self, request):
        """
        Record Class A Vote - Regular shareholder votes
        POST /api/services/governance-service/record_class_a_vote/
        """
        try:
            data = request.data
            vote_id = data.get('voteId')
            votes_for = data.get('votesFor', 0)
            votes_against = data.get('votesAgainst', 0)
            abstain = data.get('abstain', 0)
            
            total_votes = votes_for + votes_against + abstain
            percent_for = round((votes_for / total_votes) * 100) if total_votes > 0 else 0
            
            with transaction.atomic():
                # Update vote record
                vote = ReservedMatterVotes.objects.get(id=vote_id)
                # Note: These fields may need to be added to the model if they don't exist
                # For now, we'll store in a JSONField or add them to the model
                
                return Response({
                    'percentFor': percent_for,
                    'passed': percent_for >= 50,
                }, status=status.HTTP_200_OK)
                
        except ReservedMatterVotes.DoesNotExist:
            return Response({
                'error': 'Vote not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def record_class_b_vote(self, request):
        """
        Record Class B Vote - Golden share (council) vote
        POST /api/services/governance-service/record_class_b_vote/
        """
        try:
            data = request.data
            vote_id = data.get('voteId')
            vote_decision = data.get('vote')  # 'approve' or 'veto'
            vote_rationale = data.get('voteRationale', '')
            council_members_voting = data.get('councilMembersVoting', [])
            
            with transaction.atomic():
                # Get vote record
                vote = ReservedMatterVotes.objects.get(id=vote_id)
                
                # Determine final decision
                if vote_decision == 'veto':
                    final_decision = 'vetoed_class_b'
                    vote_status = 'vetoed'
                else:
                    # Check Class A vote percentage (would need to be stored)
                    final_decision = 'approved'
                    vote_status = 'approved'
                
                # Create governance event
                GovernanceEvents.objects.create(
                    event_type='reserved_matter_vote',
                    event_date=timezone.now(),
                    reserved_matter_vote_id=vote.id,
                    title=f'Reserved Matter {"Vetoed" if vote_decision == "veto" else "Approved"}',
                    description=f'Union Member Representative Council {"vetoed" if vote_decision == "veto" else "approved"} Reserved Matter: {vote.title}. Rationale: {vote_rationale}',
                    stakeholders=['board', 'council', 'investors', 'public'],
                )
                
                return Response({
                    'finalDecision': final_decision,
                    'status': vote_status,
                }, status=status.HTTP_200_OK)
                
        except ReservedMatterVotes.DoesNotExist:
            return Response({
                'error': 'Vote not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def conduct_mission_audit(self, request):
        """
        Conduct Mission Audit - Annual independent audit
        POST /api/services/governance-service/conduct_mission_audit/
        """
        try:
            data = request.data
            
            # Extract thresholds or use defaults
            union_revenue_threshold = data.get('unionRevenueThreshold', 90)
            member_satisfaction_threshold = data.get('memberSatisfactionThreshold', 80)
            data_violations_threshold = data.get('dataViolationsThreshold', 0)
            
            # Calculate pass/fail
            union_revenue_pass = data['unionRevenuePercent'] >= union_revenue_threshold
            member_satisfaction_pass = data['memberSatisfactionPercent'] >= member_satisfaction_threshold
            data_violations_pass = data['dataViolations'] <= data_violations_threshold
            overall_pass = union_revenue_pass and member_satisfaction_pass and data_violations_pass
            
            with transaction.atomic():
                # Create audit
                audit = MissionAudits.objects.create(
                    audit_year=data['auditYear'],
                    audit_period_start=data['auditPeriodStart'],
                    audit_period_end=data['auditPeriodEnd'],
                    auditor_firm=data['auditorFirm'],
                    auditor_name=data['auditorName'],
                    auditor_certification=data['auditorCertification'],
                    union_revenue_percent=data['unionRevenuePercent'],
                    member_satisfaction_percent=data['memberSatisfactionPercent'],
                    data_violations=data['dataViolations'],
                    union_revenue_threshold=union_revenue_threshold,
                    member_satisfaction_threshold=member_satisfaction_threshold,
                    data_violations_threshold=data_violations_threshold,
                    union_revenue_pass=union_revenue_pass,
                    member_satisfaction_pass=member_satisfaction_pass,
                    data_violations_pass=data_violations_pass,
                    overall_pass=overall_pass,
                )
                
                # Update golden share if passes
                share = GoldenShares.objects.filter(status='active').first()
                if overall_pass:
                    if share:
                        share.consecutive_compliance_years += 1
                        audit.consecutive_years_after_audit = share.consecutive_compliance_years
                        audit.save()
                        
                        # Check if sunset should trigger (5 years)
                        if share.consecutive_compliance_years >= share.sunset_clause_duration:
                            share.status = 'sunset_triggered'
                            share.sunset_triggered_date = timezone.now().date()
                            
                            # Create sunset event
                            GovernanceEvents.objects.create(
                                event_type='sunset_triggered',
                                event_date=timezone.now(),
                                golden_share_id=share.id,
                                title='Golden Share Sunset Clause Triggered',
                                description='5 consecutive years of mission compliance achieved.',
                                stakeholders=['board', 'council', 'investors', 'public'],
                            )
                        
                        share.save()
                else:
                    # Reset consecutive years if failed
                    if share:
                        share.consecutive_compliance_years = 0
                        share.save()
                        audit.consecutive_years_after_audit = 0
                        audit.save()
                
                # Create governance event
                GovernanceEvents.objects.create(
                    event_type='mission_audit',
                    event_date=timezone.now(),
                    mission_audit_id=audit.id,
                    title=f'Mission Audit {data["auditYear"]} - {"Passed" if overall_pass else "Failed"}',
                    description=f'Annual independent audit result: {"Passed" if overall_pass else "Failed"}',
                    stakeholders=['board', 'council', 'investors', 'public'],
                )
                
                return Response({
                    'id': str(audit.id),
                    'overallPass': overall_pass,
                    'consecutiveYears': share.consecutive_compliance_years if share else 0,
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def trigger_sunset_clause(self, request):
        """
        Trigger Sunset Clause - Mark golden share for conversion
        POST /api/services/governance-service/trigger_sunset_clause/
        """
        try:
            data = request.data
            golden_share_id = data.get('goldenShareId')
            
            with transaction.atomic():
                share = GoldenShares.objects.get(id=golden_share_id)
                share.status = 'sunset_triggered'
                share.sunset_triggered_date = timezone.now().date()
                share.save()
                
                # Create governance event
                GovernanceEvents.objects.create(
                    event_type='sunset_triggered',
                    event_date=timezone.now(),
                    golden_share_id=share.id,
                    title='Golden Share Sunset Clause Triggered',
                    description='5 consecutive years of mission compliance achieved. Class B Special Voting Share will convert to ordinary Class A share.',
                    stakeholders=['board', 'council', 'investors', 'public'],
                )
                
                return Response({
                    'sunsetTriggeredDate': share.sunset_triggered_date,
                }, status=status.HTTP_200_OK)
                
        except GoldenShares.DoesNotExist:
            return Response({
                'error': 'Golden share not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def convert_golden_share(self, request):
        """
        Convert Golden Share - Final conversion to ordinary share
        POST /api/services/governance-service/convert_golden_share/
        """
        try:
            data = request.data
            golden_share_id = data.get('goldenShareId')
            
            with transaction.atomic():
                share = GoldenShares.objects.get(id=golden_share_id)
                share.status = 'converted'
                share.conversion_date = timezone.now().date()
                share.save()
                
                # Create governance event
                GovernanceEvents.objects.create(
                    event_type='share_converted',
                    event_date=timezone.now(),
                    golden_share_id=share.id,
                    title='Class B Share Converted to Class A',
                    description='Class B Special Voting Share has been converted to ordinary Class A share.',
                    stakeholders=['board', 'council', 'investors', 'public'],
                )
                
                return Response({
                    'conversionDate': share.conversion_date,
                }, status=status.HTTP_200_OK)
                
        except GoldenShares.DoesNotExist:
            return Response({
                'error': 'Golden share not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def mission_compliance_years(self, request):
        """
        Get Mission Compliance Years - Track sunset progress
        GET /api/services/governance-service/mission_compliance_years/
        """
        try:
            share = GoldenShares.objects.filter(status='active').first()
            
            if not share:
                return Response({
                    'consecutiveYears': 0,
                    'requiredYears': 5,
                    'percentComplete': 0,
                    'sunsetTriggered': False,
                }, status=status.HTTP_200_OK)
            
            # Get recent audits
            audits = list(MissionAudits.objects.order_by('-audit_year')[:10].values())
            
            return Response({
                'consecutiveYears': share.consecutive_compliance_years,
                'requiredYears': share.sunset_clause_duration,
                'percentComplete': (share.consecutive_compliance_years / share.sunset_clause_duration) * 100,
                'sunsetTriggered': share.sunset_triggered_date is not None,
                'recentAudits': audits,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def conduct_council_election(self, request):
        """
        Conduct Council Election - Elect union rep council
        POST /api/services/governance-service/conduct_council_election/
        """
        try:
            data = request.data
            
            with transaction.atomic():
                # Create election record
                election = CouncilElections.objects.create(
                    election_year=data['electionYear'],
                    election_date=data['electionDate'],
                    positions_available=data['positionsAvailable'],
                    candidates=data['candidates'],
                    winners=data['winners'],
                    total_votes=data.get('totalVotes', 0),
                    participation_rate=data.get('participationRate', 0),
                )
                
                # Update golden share with new council
                share = GoldenShares.objects.filter(status='active').first()
                if share:
                    share.council_members = data['winners']
                    share.save()
                
                # Create governance event
                GovernanceEvents.objects.create(
                    event_type='council_election',
                    event_date=timezone.now(),
                    title=f'Council Election {data["electionYear"]} Complete',
                    description=f'Union Member Representative Council elected for {data["electionYear"]}',
                    stakeholders=['council', 'members', 'public'],
                )
                
                return Response({
                    'id': str(election.id),
                    'winners': election.winners,
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({
                'error': 'An error occurred'
            }, status=status.HTTP_400_BAD_REQUEST)

