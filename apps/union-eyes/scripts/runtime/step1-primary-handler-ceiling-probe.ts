/**
 * Step 1 diagnostic, S1-A01. Pure synthetic facts; no database, credentials,
 * HTTP calls or institution-specific issuance. Run in a pinned checkout:
 * pnpm --dir apps/union-eyes exec tsx scripts/runtime/step1-primary-handler-ceiling-probe.ts
 * An outcome that contradicts the documented primary-only ceiling exits 1;
 * this is intentionally not yet wired into required CI or runtime acceptance.
 */
import { decide } from '../../lib/authority/kernel'
import { decideIssuance, type IssuanceRule, type IssuanceRequest } from '../../lib/authority/issuance'
import type { Action, AuthorityFacts, AuthorityRequest, Capacity, CaseFacts, Mandate, Membership, ResourceRelationship, ResourceRef } from '../../lib/authority/ontology'

const org='synthetic-org', holder='synthetic-holder', issuer='synthetic-issuer', caseId='synthetic-case'
const now=new Date('2026-11-17T12:00:00Z')
const effectiveAt=new Date('2026-11-16T12:00:00Z')
const expiresAt=new Date('2026-12-01T12:00:00Z')
const resource: ResourceRef={type:'case',id:caseId,organizationId:org}
const matter: CaseFacts={kind:'case',id:caseId,organizationId:org,classification:'standard',counselControlled:false,adverseUserIds:[],unitId:'unit-1'}
const member=(userId:string,capacities:Capacity[]):Membership=>({userId,organizationId:org,status:'active',capacities})
const supervisor=member(holder,['member','chief_steward','steward'])
const officer=member(issuer,['member','officer'])
const facts=(userId:string,memberships:Membership[], overrides:Partial<AuthorityFacts>={}):AuthorityFacts=>({principal:{userId,authenticated:true},memberships,mandates:[],relationships:[],delegations:[],recusals:[],consents:[],...overrides})
const relationship=(relation:ResourceRelationship['relation'],permissions:readonly string[]=[]):ResourceRelationship=>({id:'relationship-'+relation,organizationId:org,principalUserId:holder,resource,relation,permissions,privilegedAccess:false,origin:relation==='collaborator'?'explicit':'derived',grantedBy:issuer,status:'active',effectiveAt,expiresAt,revokedAt:null})
const mandate=(power:string):Mandate=>({id:'synthetic-mandate',organizationId:org,principalUserId:holder,kind:'supervisory',powers:[power],scope:{resourceIds:[caseId]},sourceInstrument:'SYNTHETIC_TEST_ONLY',grantedBy:issuer,status:'active',effectiveAt,expiresAt,revokedAt:null,requiresAcceptance:true,acceptedAt:effectiveAt})
const rule=(powers:string[]):IssuanceRule=>({id:'synthetic-rule',organizationId:org,domain:'supervisory',operation:'issue',issuerCapacities:['officer','executive'],issuerMandateKind:null,issuerMandatePower:null,allowedPowers:powers,maxTermDays:365,requiresAcceptance:true,requiredIndependentApprovals:1,version:1,status:'active',sourceInstrument:'SYNTHETIC_TEST_ONLY',draftedBy:'drafter',approvedBy:['approver-one','approver-two']})
const results:Array<{name:string;phase:string;expected:string;observed:string;reasonCodes:string[];matches:boolean}>=[]
function record(name:string,phase:string,expected:'allow'|'deny',observed:{effect:'allow'|'deny';reasons:readonly {code:string}[]}) {
  results.push({name,phase,expected,observed:observed.effect,reasonCodes:observed.reasons.map(x=>x.code),matches:observed.effect===expected})
}
function evaluate(name:string,action:Action,expected:'allow'|'deny',f:AuthorityFacts,c:CaseFacts=matter,extra:Partial<AuthorityRequest>={}) {
  record(name,'kernel',expected,decide({principalUserId:holder,organizationId:org,action,resource,...extra},f,c,now))
}
const restricted:Action[]=['case:disclose_to_member','case:export_sealed_evidence','case:close']
for (const action of restricted) {
  const power=action.split(':')[1]
  const request:IssuanceRequest={issuerUserId:issuer,organizationId:org,domain:'supervisory',operation:'issue',holderUserId:holder,powers:[power],effectiveAt,expiresAt,scope:{resourceIds:[caseId]},sourceInstrument:'SYNTHETIC_TEST_ONLY',resource,stage:'execute',approval:{status:'satisfied',approvingLines:['independent-approval']}}
  record(action+' default rule denies','issuance','deny',decideIssuance(request,facts(issuer,[officer]),supervisor,rule(['read','assign','monitor']),now))
  record(action+' custom rule must preserve primary-only ceiling','issuance','deny',decideIssuance(request,facts(issuer,[officer]),supervisor,rule([power]),now))
  evaluate(action+' custom supervisory instrument only',action,'deny',facts(holder,[supervisor],{mandates:[mandate(power)]}))
  evaluate(action+' primary owner',action,'allow',facts(holder,[supervisor],{relationships:[relationship('owner')]}))
  evaluate(action+' primary assignee',action,'allow',facts(holder,[supervisor],{relationships:[relationship('assignee')]}))
  evaluate(action+' collaborator with attempted overgrant',action,'deny',facts(holder,[supervisor],{relationships:[relationship('collaborator',[power])]}))
  evaluate(action+' role without relationship',action,'deny',facts(holder,[supervisor]))
  evaluate(action+' privileged case without explicit grant',action,'deny',facts(holder,[supervisor],{relationships:[relationship('owner')]}),{...matter,classification:'privileged'})
  evaluate(action+' adverse primary handler',action,'deny',facts(holder,[supervisor],{relationships:[relationship('owner')]}),{...matter,adverseUserIds:[holder]})
  evaluate(action+' revoked membership',action,'deny',facts(holder,[{...supervisor,status:'revoked'}],{relationships:[relationship('owner')]}))
}
evaluate('valid scoped supervision read','case:read','allow',facts(holder,[supervisor],{mandates:[mandate('read')]}))
evaluate('valid scoped supervision assign','case:assign','allow',facts(holder,[supervisor],{mandates:[mandate('assign')]}))
const mismatches=results.filter(x=>!x.matches)
console.log(JSON.stringify({record:'UE_STEP1_PRIMARY_HANDLER_CEILING_PROBE',synthetic:true,applicationAcceptance:false,tests:results.length,matched:results.length-mismatches.length,mismatches,results},null,2))
if(mismatches.length)process.exitCode=1
