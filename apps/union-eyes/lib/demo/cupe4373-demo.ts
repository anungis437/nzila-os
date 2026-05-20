import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FileText,
  FolderClock,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export type DemoCase = {
  id: string;
  title: string;
  type: string;
  caseworkStream: "grievance" | "accommodation" | "health-safety" | "coordination";
  worker: string;
  unit: string;
  location: string;
  status: string;
  urgency: "urgent" | "watch" | "steady";
  assignedSteward: string;
  opened: string;
  updated: string;
  deadline: string;
  summary: string;
  desiredOutcome: string;
  agreementRefs: string[];
  continuityState: string;
  nextStep: string;
  relatedCases: string[];
  attachments: string[];
  flags: string[];
  notes: string[];
  timeline: DemoTimelineEntry[];
};

export type DemoTimelineEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  notes: string;
  attachments: string[];
  followUp: string;
};

export const caseworkTabs = [
  {
    id: "all",
    label: "All casework",
    description: "Active files across grievances, accommodations, safety concerns, and coordination work.",
  },
  {
    id: "grievances",
    label: "Grievances",
    description: "Formal disputes and files likely to enter the grievance path.",
  },
  {
    id: "accommodations",
    label: "Accommodations",
    description: "Return-to-work and duty-modification files with sensitive documentation.",
  },
  {
    id: "health-safety",
    label: "Health & safety",
    description: "Unsafe staffing, workload, and group-risk concerns.",
  },
  {
    id: "deadlines",
    label: "Deadlines",
    description: "Files where the next operational commitment is close or urgent.",
  },
] as const;

export type CaseworkTabId = (typeof caseworkTabs)[number]["id"];

export const demoCases: DemoCase[] = [
  {
    id: "UE-4373-026",
    title: "Mandatory overtime without required notice",
    type: "Overtime dispute",
    caseworkStream: "grievance",
    worker: "Maya B.",
    unit: "Registered Practical Nurses",
    location: "7 West Medicine, Grand River Hospital",
    status: "Follow-up due",
    urgency: "urgent",
    assignedSteward: "Denise Laurent",
    opened: "2026-05-08T10:15:00-04:00",
    updated: "2026-05-18T16:35:00-04:00",
    deadline: "2026-05-21T17:00:00-04:00",
    summary:
      "Member was scheduled for mandatory overtime on a statutory holiday without the required notice. The unit was already operating short-staffed across two shifts.",
    desiredOutcome:
      "Written acknowledgement of scheduling breach, corrected overtime pay, and confirmation of notice practice for the unit.",
    agreementRefs: ["Article 18.2 Overtime", "Article 14 Scheduling", "Letter of Understanding: Staffing Relief"],
    continuityState: "Handoff notes complete; employer response pending.",
    nextStep: "Confirm payroll correction request before Thursday meeting.",
    relatedCases: ["UE-4373-014", "UE-4373-018"],
    attachments: ["Schedule extract - May 2026.pdf", "Payroll variance note.docx", "Member statement.pdf"],
    flags: ["Employer response due", "Payroll correction unresolved"],
    notes: [
      "Chief Steward requested that all communication stay in writing.",
      "Similar notice issue occurred on 7 West in March.",
    ],
    timeline: [
      {
        id: "tl-1",
        timestamp: "2026-05-08T10:15:00-04:00",
        actor: "Maya B.",
        action: "Case opened",
        notes:
          "Member submitted schedule, call-in details, and notes from the charge nurse conversation.",
        attachments: ["Initial intake.pdf"],
        followUp: "Steward to confirm article references and payroll impact.",
      },
      {
        id: "tl-2",
        timestamp: "2026-05-09T14:40:00-04:00",
        actor: "Denise Laurent, Steward",
        action: "Agreement references added",
        notes:
          "Article 18.2 and Article 14 linked to the file. Similar March case added as related context.",
        attachments: ["Article extract.pdf"],
        followUp: "Request schedule record from unit clerk.",
      },
      {
        id: "tl-3",
        timestamp: "2026-05-13T09:20:00-04:00",
        actor: "Employer scheduling office",
        action: "Schedule record received",
        notes:
          "Scheduling office confirmed call-in time and posted roster. Notice period appears shorter than required.",
        attachments: ["Schedule extract - May 2026.pdf"],
        followUp: "Prepare written employer question before labour-management meeting.",
      },
      {
        id: "tl-4",
        timestamp: "2026-05-16T11:05:00-04:00",
        actor: "Chief Steward",
        action: "Handoff note recorded",
        notes:
          "If Denise is unavailable, Marc will attend the May 23 meeting with chronology, article references, and payroll variance note.",
        attachments: ["Handoff note.docx"],
        followUp: "Marc to review file before May 22.",
      },
      {
        id: "tl-5",
        timestamp: "2026-05-18T16:35:00-04:00",
        actor: "Denise Laurent, Steward",
        action: "Employer response requested",
        notes:
          "Written response requested on notice practice and payroll correction. Deadline set before the meeting package is finalized.",
        attachments: ["Employer correspondence.eml"],
        followUp: "Confirm response by May 21 at 5:00 PM.",
      },
    ],
  },
  {
    id: "UE-4373-024",
    title: "Unsafe staffing concern during emergency triage surge",
    type: "Unsafe staffing concern",
    caseworkStream: "health-safety",
    worker: "Nadia S.",
    unit: "Emergency Department Clerical",
    location: "Emergency Department",
    status: "Awaiting employer response",
    urgency: "urgent",
    assignedSteward: "Marc Okafor",
    opened: "2026-05-06T08:45:00-04:00",
    updated: "2026-05-17T13:10:00-04:00",
    deadline: "2026-05-22T12:00:00-04:00",
    summary:
      "Short-staffed triage clerical desk created missed break coverage and delayed patient registration support.",
    desiredOutcome: "Documented staffing review and agreed escalation path for surge periods.",
    agreementRefs: ["Article 22 Health and Safety", "Article 15 Rest Periods"],
    continuityState: "Two witness statements still outstanding.",
    nextStep: "Collect witness statements before JHSC discussion.",
    relatedCases: ["UE-4373-008"],
    attachments: ["Incident notes.pdf"],
    flags: ["Witness statements pending"],
    notes: ["Keep health and safety pathway separate from individual discipline files."],
    timeline: [
      {
        id: "tl-024-1",
        timestamp: "2026-05-06T08:45:00-04:00",
        actor: "Nadia S.",
        action: "Safety concern reported",
        notes:
          "Member described triage desk coverage gaps, missed break coverage, and delayed registration support during surge volume.",
        attachments: ["Initial staffing concern.pdf"],
        followUp: "Steward to separate health and safety facts from individual staffing complaints.",
      },
      {
        id: "tl-024-2",
        timestamp: "2026-05-10T13:15:00-04:00",
        actor: "Marc Okafor, Steward",
        action: "Witness list created",
        notes:
          "Two clerical witnesses identified. Chief Steward asked for concise written statements before the JHSC discussion.",
        attachments: ["Witness request email.eml"],
        followUp: "Collect statements by May 20.",
      },
      {
        id: "tl-024-3",
        timestamp: "2026-05-17T13:10:00-04:00",
        actor: "Chief Steward Office",
        action: "Employer response requested",
        notes:
          "Written request sent for surge staffing review, break coverage plan, and escalation contact for future triage surges.",
        attachments: ["Employer request - ED staffing.pdf"],
        followUp: "Confirm response before May 22 at noon.",
      },
    ],
  },
  {
    id: "UE-4373-022",
    title: "Return-to-work accommodation plan not confirmed",
    type: "Accommodation request",
    caseworkStream: "accommodation",
    worker: "Elena R.",
    unit: "Environmental Services",
    location: "Surgical Floor",
    status: "Documentation review",
    urgency: "watch",
    assignedSteward: "Aisha Tremblay",
    opened: "2026-05-01T15:05:00-04:00",
    updated: "2026-05-16T10:30:00-04:00",
    deadline: "2026-05-24T09:00:00-04:00",
    summary:
      "Member returned from medical leave without a written modified duties plan. Restrictions were communicated verbally across two supervisors.",
    desiredOutcome: "Written accommodation plan and confirmation of restrictions for all scheduling supervisors.",
    agreementRefs: ["Article 21 Accommodation", "Human Rights accommodation procedure"],
    continuityState: "Medical documentation indexed; supervisor confirmation pending.",
    nextStep: "Prepare timeline of verbal instructions.",
    relatedCases: [],
    attachments: ["Accommodation request.pdf", "Return-to-work note.pdf"],
    flags: ["Sensitive documentation"],
    notes: ["Limit file access to assigned steward and Chief Steward."],
    timeline: [
      {
        id: "tl-022-1",
        timestamp: "2026-05-01T15:05:00-04:00",
        actor: "Elena R.",
        action: "Accommodation concern opened",
        notes:
          "Member reported modified duties were communicated verbally by two supervisors with no shared written plan.",
        attachments: ["Accommodation request.pdf"],
        followUp: "Index medical note and confirm access-limited handling.",
      },
      {
        id: "tl-022-2",
        timestamp: "2026-05-07T10:30:00-04:00",
        actor: "Aisha Tremblay, Steward",
        action: "Sensitive file access limited",
        notes:
          "File marked sensitive. Access limited to assigned steward and Chief Steward while accommodation documentation is reviewed.",
        attachments: ["Return-to-work note.pdf"],
        followUp: "Prepare summary of restrictions without unnecessary medical detail.",
      },
      {
        id: "tl-022-3",
        timestamp: "2026-05-16T10:30:00-04:00",
        actor: "Chief Steward Office",
        action: "Supervisor confirmation requested",
        notes:
          "Written confirmation requested from scheduling supervisors so restrictions are consistently understood across shifts.",
        attachments: ["Supervisor confirmation request.eml"],
        followUp: "Confirm written plan before May 24.",
      },
    ],
  },
  {
    id: "UE-4373-018",
    title: "Seniority bypass on weekend shift assignment",
    type: "Seniority dispute",
    caseworkStream: "grievance",
    worker: "Robert J.",
    unit: "Portering",
    location: "Diagnostics",
    status: "Meeting scheduled",
    urgency: "watch",
    assignedSteward: "Denise Laurent",
    opened: "2026-04-24T12:30:00-04:00",
    updated: "2026-05-14T09:25:00-04:00",
    deadline: "2026-05-28T13:00:00-04:00",
    summary:
      "Member believes a weekend assignment was awarded out of seniority order after schedule change.",
    desiredOutcome: "Clarify seniority application and correct assignment process for next rotation.",
    agreementRefs: ["Article 10 Seniority", "Article 14 Scheduling"],
    continuityState: "Ready for meeting; prior scheduling file linked.",
    nextStep: "Bring rotation roster to May 28 meeting.",
    relatedCases: ["UE-4373-026"],
    attachments: ["Rotation roster.xlsx"],
    flags: [],
    notes: ["Good example for showing related-case continuity."],
    timeline: [
      {
        id: "tl-018-1",
        timestamp: "2026-04-24T12:30:00-04:00",
        actor: "Robert J.",
        action: "Seniority concern opened",
        notes:
          "Member flagged weekend assignment awarded out of expected seniority order after a schedule change.",
        attachments: ["Member statement.pdf"],
        followUp: "Request rotation roster and posted schedule.",
      },
      {
        id: "tl-018-2",
        timestamp: "2026-05-02T11:10:00-04:00",
        actor: "Denise Laurent, Steward",
        action: "Related scheduling file linked",
        notes:
          "Linked March notice file to preserve pattern context without merging distinct member issues.",
        attachments: ["Rotation roster.xlsx"],
        followUp: "Prepare article 10 and article 14 comparison note.",
      },
      {
        id: "tl-018-3",
        timestamp: "2026-05-14T09:25:00-04:00",
        actor: "Employer scheduling office",
        action: "Meeting scheduled",
        notes:
          "Employer agreed to review weekend assignment sequence and rotation roster at the May 28 meeting.",
        attachments: ["Meeting confirmation.eml"],
        followUp: "Bring roster and related-case summary to meeting.",
      },
    ],
  },
  {
    id: "UE-4373-015",
    title: "Discipline review after medication cart incident",
    type: "Discipline review",
    caseworkStream: "grievance",
    worker: "Confidential",
    unit: "Long-Term Care Support",
    location: "Continuing Care",
    status: "Under review",
    urgency: "steady",
    assignedSteward: "Chief Steward Office",
    opened: "2026-04-19T09:00:00-04:00",
    updated: "2026-05-12T15:55:00-04:00",
    deadline: "2026-06-02T17:00:00-04:00",
    summary:
      "Discipline meeting materials are being reviewed for process fairness and documentation completeness.",
    desiredOutcome: "Ensure member representation, complete record, and clear next steps before employer meeting.",
    agreementRefs: ["Article 8 Discipline", "Article 9 Representation"],
    continuityState: "Confidential chronology maintained for human representation judgment.",
    nextStep: "Confirm representation notes after member meeting.",
    relatedCases: [],
    attachments: ["Meeting notice.pdf"],
    flags: ["Confidential file"],
    notes: ["Use this case to show role-based access and dignity-centered handling."],
    timeline: [
      {
        id: "tl-015-1",
        timestamp: "2026-04-19T09:00:00-04:00",
        actor: "Chief Steward Office",
        action: "Discipline file opened",
        notes:
          "Meeting notice received. File marked confidential and limited to representation team.",
        attachments: ["Meeting notice.pdf"],
        followUp: "Confirm member representation availability.",
      },
      {
        id: "tl-015-2",
        timestamp: "2026-04-25T14:45:00-04:00",
        actor: "Assigned steward",
        action: "Process fairness checklist added",
        notes:
          "Steward recorded questions about notice, disclosure, and whether all relevant incident notes were provided.",
        attachments: ["Process checklist.docx"],
        followUp: "Request missing materials before employer meeting.",
      },
      {
        id: "tl-015-3",
        timestamp: "2026-05-12T15:55:00-04:00",
        actor: "Chief Steward Office",
        action: "Representation notes updated",
        notes:
          "Chronology is preserved for human representation judgment, with process facts recorded for steward review.",
        attachments: ["Representation notes.pdf"],
        followUp: "Confirm next meeting date and final document list.",
      },
    ],
  },
  {
    id: "UE-4373-014",
    title: "Short-notice rotation change on surgical floor",
    type: "Scheduling grievance",
    caseworkStream: "grievance",
    worker: "Priya N.",
    unit: "Unit Clerks",
    location: "Surgical Floor",
    status: "Intake review",
    urgency: "watch",
    assignedSteward: "Marc Okafor",
    opened: "2026-04-18T07:55:00-04:00",
    updated: "2026-05-11T12:20:00-04:00",
    deadline: "2026-05-29T16:00:00-04:00",
    summary:
      "Weekend rotation was changed with limited notice after posted schedules had already been relied on by members.",
    desiredOutcome: "Confirm notice expectations and prevent repeated short-notice rotation changes.",
    agreementRefs: ["Article 14 Scheduling", "Article 10 Seniority"],
    continuityState: "Roster extracts and member statements indexed.",
    nextStep: "Confirm whether employer treats this as isolated or recurring.",
    relatedCases: ["UE-4373-018", "UE-4373-026"],
    attachments: ["Posted schedule.pdf", "Rotation change email.eml", "Member statement - Priya N.pdf"],
    flags: ["Pattern review"],
    notes: ["Useful bridge case for showing scheduling pattern memory."],
    timeline: [
      {
        id: "tl-014-1",
        timestamp: "2026-04-18T07:55:00-04:00",
        actor: "Priya N.",
        action: "Scheduling grievance intake opened",
        notes:
          "Member submitted posted schedule and rotation change email. Steward confirmed no privacy-sensitive medical details involved.",
        attachments: ["Posted schedule.pdf"],
        followUp: "Compare posted schedule to updated rotation.",
      },
      {
        id: "tl-014-2",
        timestamp: "2026-04-29T16:05:00-04:00",
        actor: "Marc Okafor, Steward",
        action: "Pattern context added",
        notes:
          "Related seniority and overtime files linked to preserve recurring scheduling issue context.",
        attachments: ["Pattern note.docx"],
        followUp: "Prepare concise question for employer scheduling office.",
      },
      {
        id: "tl-014-3",
        timestamp: "2026-05-11T12:20:00-04:00",
        actor: "Employer scheduling office",
        action: "Employer clarification pending",
        notes:
          "Scheduling office acknowledged the request and asked for one consolidated timeline across related schedule issues.",
        attachments: ["Employer acknowledgement.eml"],
        followUp: "Provide consolidated timeline before May 29.",
      },
    ],
  },
  {
    id: "UE-4373-012",
    title: "Family leave request denied during staffing shortage",
    type: "Leave dispute",
    caseworkStream: "grievance",
    worker: "Jonas P.",
    unit: "Diagnostic Imaging Support",
    location: "Medical Imaging",
    status: "Member response pending",
    urgency: "steady",
    assignedSteward: "Aisha Tremblay",
    opened: "2026-04-12T13:40:00-04:00",
    updated: "2026-05-09T09:10:00-04:00",
    deadline: "2026-05-31T12:00:00-04:00",
    summary:
      "Member's family leave request was denied verbally during a staffing shortage. The steward is confirming facts and documentation before escalation.",
    desiredOutcome: "Clarify leave entitlement, obtain written rationale, and correct future handling if required.",
    agreementRefs: ["Article 20 Leaves", "Article 9 Representation"],
    continuityState: "Awaiting member confirmation before employer escalation.",
    nextStep: "Confirm dates and verbal denial details with member.",
    relatedCases: [],
    attachments: ["Leave request screenshot.pdf"],
    flags: [],
    notes: ["Keep early-stage facts separate from formal grievance position."],
    timeline: [
      {
        id: "tl-012-1",
        timestamp: "2026-04-12T13:40:00-04:00",
        actor: "Jonas P.",
        action: "Leave dispute opened",
        notes:
          "Member reported a verbal denial and provided requested leave dates.",
        attachments: ["Leave request screenshot.pdf"],
        followUp: "Confirm whether written denial exists.",
      },
      {
        id: "tl-012-2",
        timestamp: "2026-04-22T10:00:00-04:00",
        actor: "Aisha Tremblay, Steward",
        action: "Agreement reference added",
        notes:
          "Article 20 leave language added. Steward noted that escalation should wait until member confirms timeline.",
        attachments: ["Article 20 extract.pdf"],
        followUp: "Call member before next labour-management preparation window.",
      },
      {
        id: "tl-012-3",
        timestamp: "2026-05-09T09:10:00-04:00",
        actor: "Chief Steward Office",
        action: "Follow-up reminder set",
        notes:
          "Reminder added so the file does not disappear while awaiting member confirmation.",
        attachments: [],
        followUp: "Member response requested by May 31.",
      },
    ],
  },
  {
    id: "UE-4373-010",
    title: "Vacation selection conflict after unit transfer",
    type: "Vacation conflict",
    caseworkStream: "coordination",
    worker: "Leah T.",
    unit: "Food Services",
    location: "Main Campus",
    status: "Ready for discussion",
    urgency: "steady",
    assignedSteward: "Denise Laurent",
    opened: "2026-04-03T11:00:00-04:00",
    updated: "2026-05-06T15:30:00-04:00",
    deadline: "2026-06-06T10:00:00-04:00",
    summary:
      "Member transferred units and vacation selection priority was unclear after the move. The case needs consistent interpretation before summer scheduling finalizes.",
    desiredOutcome: "Confirm vacation selection treatment after transfer and document the interpretation for future transfers.",
    agreementRefs: ["Article 17 Vacation", "Article 10 Seniority"],
    continuityState: "Interpretation note drafted for steward review.",
    nextStep: "Discuss interpretation at June steward coordination meeting.",
    relatedCases: [],
    attachments: ["Vacation selection list.xlsx", "Transfer notice.pdf"],
    flags: [],
    notes: ["Good lower-risk case for showing agreement memory without urgency."],
    timeline: [
      {
        id: "tl-010-1",
        timestamp: "2026-04-03T11:00:00-04:00",
        actor: "Leah T.",
        action: "Vacation conflict opened",
        notes:
          "Member asked whether unit transfer changes vacation selection sequence.",
        attachments: ["Transfer notice.pdf"],
        followUp: "Compare selection list with transfer effective date.",
      },
      {
        id: "tl-010-2",
        timestamp: "2026-04-16T14:10:00-04:00",
        actor: "Denise Laurent, Steward",
        action: "Agreement interpretation drafted",
        notes:
          "Draft note prepared so future stewards can reuse the interpretation instead of re-litigating the same issue.",
        attachments: ["Vacation interpretation draft.docx"],
        followUp: "Review with Chief Steward before discussion.",
      },
      {
        id: "tl-010-3",
        timestamp: "2026-05-06T15:30:00-04:00",
        actor: "Chief Steward Office",
        action: "Ready for discussion",
        notes:
          "File is ready for June steward coordination meeting. No escalation flag required.",
        attachments: ["Vacation selection list.xlsx"],
        followUp: "Add final interpretation after meeting.",
      },
    ],
  },
  {
    id: "UE-4373-008",
    title: "Workload escalation after portering vacancy",
    type: "Workload escalation",
    caseworkStream: "health-safety",
    worker: "Multiple members",
    unit: "Portering",
    location: "Diagnostics and Emergency",
    status: "Escalation watch",
    urgency: "urgent",
    assignedSteward: "Chief Steward Office",
    opened: "2026-03-29T08:20:00-04:00",
    updated: "2026-05-05T17:10:00-04:00",
    deadline: "2026-05-20T15:00:00-04:00",
    summary:
      "Repeated vacancy coverage has increased workload and delayed relief across diagnostics and emergency transport requests.",
    desiredOutcome: "Document workload pattern and secure employer response on vacancy coverage and relief escalation.",
    agreementRefs: ["Article 22 Health and Safety", "Letter of Understanding: Staffing Relief"],
    continuityState: "Escalation package assembled; employer response due.",
    nextStep: "Confirm employer response on vacancy coverage by May 20.",
    relatedCases: ["UE-4373-024"],
    attachments: ["Workload log.xlsx", "Transport delay summary.pdf", "Vacancy posting.pdf"],
    flags: ["Employer response due", "Group issue"],
    notes: ["Use for showing group-file handling without naming every member."],
    timeline: [
      {
        id: "tl-008-1",
        timestamp: "2026-03-29T08:20:00-04:00",
        actor: "Portering steward team",
        action: "Workload escalation opened",
        notes:
          "Multiple members reported delayed relief and repeated vacancy coverage pressures.",
        attachments: ["Workload log.xlsx"],
        followUp: "Confirm whether issue should proceed as group grievance or labour-management item.",
      },
      {
        id: "tl-008-2",
        timestamp: "2026-04-17T12:35:00-04:00",
        actor: "Chief Steward Office",
        action: "Group issue boundaries recorded",
        notes:
          "File preserves workload pattern while avoiding unnecessary disclosure of individual member details.",
        attachments: ["Group-file handling note.docx"],
        followUp: "Add vacancy posting and transport delay summary.",
      },
      {
        id: "tl-008-3",
        timestamp: "2026-05-05T17:10:00-04:00",
        actor: "Employer representative",
        action: "Response date confirmed",
        notes:
          "Employer committed to respond on vacancy coverage and relief escalation before May 20.",
        attachments: ["Employer response commitment.eml"],
        followUp: "Hold escalation watch until response received.",
      },
    ],
  },
];

export const demoGrievanceCases = demoCases.filter((item) => item.caseworkStream === "grievance");

export const dashboardPriorityCards = [
  { label: "Open Cases", value: "32", detail: "Across active hospital units", icon: ClipboardList },
  { label: "Urgent Follow-Ups", value: "6", detail: "Due before next labour-management cycle", icon: AlertTriangle },
  { label: "Awaiting Response", value: "9", detail: "Employer or member response pending", icon: FolderClock },
  { label: "Upcoming Meetings", value: "4", detail: "This week", icon: CalendarDays },
  { label: "Updated Files", value: "11", detail: "New chronology or document activity", icon: FileCheck2 },
];

export const workloadDistribution = [
  { steward: "Denise Laurent", open: 9, urgent: 2 },
  { steward: "Marc Okafor", open: 7, urgent: 2 },
  { steward: "Aisha Tremblay", open: 6, urgent: 1 },
  { steward: "Chief Steward Office", open: 10, urgent: 1 },
];

export const statusBreakdown = [
  { label: "Follow-up due", count: 6, color: "bg-amber-500" },
  { label: "Awaiting response", count: 9, color: "bg-sky-500" },
  { label: "Documentation review", count: 7, color: "bg-slate-500" },
  { label: "Meeting scheduled", count: 5, color: "bg-emerald-500" },
  { label: "Under review", count: 5, color: "bg-indigo-500" },
];

export const continuityIndicators = [
  "4 files need handoff notes before upcoming meetings.",
  "2 deadline chains depend on employer written response.",
  "All urgent files have assigned steward coverage.",
  "Sensitive accommodation and discipline files remain access-limited.",
];

export const agreements = [
  {
    title: "CUPE Local 4373 Collective Agreement",
    status: "Active",
    effective: "2024-04-01",
    expires: "2027-03-31",
    references: ["Overtime", "Scheduling", "Seniority", "Accommodation", "Discipline"],
    note: "Primary agreement used by stewards for case references and meeting preparation.",
  },
  {
    title: "Letter of Understanding: Staffing Relief",
    status: "Active",
    effective: "2025-09-01",
    expires: "2026-08-31",
    references: ["Surge staffing", "Float pool", "Break coverage"],
    note: "Linked to unsafe staffing and overtime continuity files.",
  },
  {
    title: "Return-to-Work Accommodation Procedure",
    status: "Current procedure",
    effective: "2026-01-15",
    expires: "Review annually",
    references: ["Medical restrictions", "Modified duties", "Documentation handling"],
    note: "Used to preserve consistent handling across supervisors and stewards.",
  },
];

export const calendarEvents = [
  {
    date: "2026-05-21",
    time: "5:00 PM",
    title: "Employer response due: UE-4373-026",
    detail: "Confirm overtime notice and payroll correction position.",
  },
  {
    date: "2026-05-23",
    time: "10:30 AM",
    title: "Labour-management preparation",
    detail: "Finalize chronology package for overtime and scheduling files.",
  },
  {
    date: "2026-05-28",
    time: "1:00 PM",
    title: "Seniority assignment meeting",
    detail: "Review portering rotation roster and related scheduling case.",
  },
  {
    date: "2026-06-02",
    time: "4:00 PM",
    title: "Discipline representation review",
    detail: "Confirm documentation completeness before employer meeting.",
  },
];

export const reports = [
  {
    title: "Weekly Case Continuity Brief",
    cadence: "Weekly",
    purpose: "Chief Steward overview of urgent follow-ups, response gaps, and handoff readiness.",
  },
  {
    title: "Labour-Management Meeting Package",
    cadence: "As needed",
    purpose: "Case chronology, agreement references, attachments, and unresolved action list.",
  },
  {
    title: "Accommodation File Access Review",
    cadence: "Monthly",
    purpose: "Confirms sensitive files have appropriate steward access and documentation handling.",
  },
];

export const trustSignals = [
  { label: "Canadian hosting", icon: ShieldCheck },
  { label: "Role-based access", icon: UsersRound },
  { label: "Chronology integrity", icon: FolderClock },
  { label: "Secure documents", icon: FileText },
];

export function getDemoCase(id: string): DemoCase {
  return demoCases.find((item) => item.id === id) ?? demoCases[0];
}

// ── Demo document library ────────────────────────────────────────────────────

export type DemoDocument = {
  id: string;
  title: string;
  category: 'collective-agreement' | 'grievance-evidence' | 'minutes' | 'policy' | 'correspondence';
  privacyLabel: 'public_internal' | 'team_confidential' | 'case_restricted' | 'privileged';
  linkedCaseId?: string;
  lastUpdated: string;
  description: string;
  fileType: 'PDF' | 'DOCX' | 'XLSX';
};

export const demoDocuments: DemoDocument[] = [
  {
    id: 'DOC-001',
    title: 'CUPE Local 4373 Collective Agreement 2022–2025',
    category: 'collective-agreement',
    privacyLabel: 'public_internal',
    lastUpdated: '2022-04-01',
    description:
      'Full collective agreement between CUPE Local 4373 and Hamilton Health Sciences. Articles 1–47 including compensation schedules.',
    fileType: 'PDF',
  },
  {
    id: 'DOC-002',
    title: 'MOU — Scheduling Flexibility Pilot (2024)',
    category: 'collective-agreement',
    privacyLabel: 'public_internal',
    lastUpdated: '2024-03-15',
    description:
      'Memorandum of Understanding on the voluntary flexible scheduling pilot covering weekend rotation changes.',
    fileType: 'PDF',
  },
  {
    id: 'DOC-003',
    title: 'Evidence Package — GRV-2024-041 (Rajani)',
    category: 'grievance-evidence',
    privacyLabel: 'case_restricted',
    linkedCaseId: 'GRV-2024-041',
    lastUpdated: '2025-01-14',
    description:
      'Compiled evidence for the unsafe staffing grievance: shift rosters, incident reports, and WSIB documentation.',
    fileType: 'PDF',
  },
  {
    id: 'DOC-004',
    title: 'Evidence Package — GRV-2024-039 (Mensah)',
    category: 'grievance-evidence',
    privacyLabel: 'case_restricted',
    linkedCaseId: 'GRV-2024-039',
    lastUpdated: '2025-02-03',
    description:
      'Supporting materials for the improper overtime denial grievance: payroll records, manager emails, and CBA clause annotations.',
    fileType: 'PDF',
  },
  {
    id: 'DOC-005',
    title: 'Steward Team Meeting Minutes — March 2025',
    category: 'minutes',
    privacyLabel: 'team_confidential',
    lastUpdated: '2025-03-12',
    description:
      'Internal minutes covering casework updates, advocacy priorities, and new member onboarding.',
    fileType: 'DOCX',
  },
  {
    id: 'DOC-006',
    title: 'Steward Team Meeting Minutes — February 2025',
    category: 'minutes',
    privacyLabel: 'team_confidential',
    lastUpdated: '2025-02-12',
    description:
      'February meeting minutes: grievance timelines, member concerns from Ward 4B, and scheduling audit.',
    fileType: 'DOCX',
  },
  {
    id: 'DOC-007',
    title: 'Employer Policy — Attendance Management Program',
    category: 'policy',
    privacyLabel: 'public_internal',
    lastUpdated: '2023-09-01',
    description:
      'Hospital attendance management policy. Reviewed against CBA Article 16 by steward team.',
    fileType: 'PDF',
  },
  {
    id: 'DOC-008',
    title: 'Letter to Management — Unsafe Staffing Concern (Jan 2025)',
    category: 'correspondence',
    privacyLabel: 'team_confidential',
    lastUpdated: '2025-01-08',
    description:
      'Formal letter submitted to unit manager and HR regarding recurring understaffing on overnight shifts.',
    fileType: 'DOCX',
  },
  {
    id: 'DOC-009',
    title: "Employer Response — Overnight Staffing Letter",
    category: 'correspondence',
    privacyLabel: 'team_confidential',
    lastUpdated: '2025-01-22',
    description:
      'Management response acknowledging the letter and committing to a staffing review by Q2 2025.',
    fileType: 'PDF',
  },
  {
    id: 'DOC-010',
    title: 'Arbitration Brief Template — Step 3',
    category: 'grievance-evidence',
    privacyLabel: 'privileged',
    lastUpdated: '2024-11-05',
    description:
      'Standard template for Step 3 arbitration submissions. Prepared with LRO guidance. Privileged — steward use only.',
    fileType: 'DOCX',
  },
];
