# Healthcare Discovery Surveys Implementation

## Scope delivered

- new package: @nzila/healthcare-surveys
- new db schema/migrations for healthcare discovery surveys
- console dashboard routes for survey management and results
- public unauthenticated response route: /healthcare/respond/[token]
- Unit 92 first campaign seed support

## Key routes

- /healthcare/discovery/surveys
- /healthcare/discovery/surveys/new
- /healthcare/discovery/surveys/[surveyId]
- /healthcare/discovery/surveys/[surveyId]/results
- /healthcare/discovery/pilot-readiness
- /healthcare/respond/[token]

## Data model

- healthcare_surveys
- healthcare_survey_responses
- healthcare_survey_insights
- healthcare_survey_templates

## Safety controls

- anonymous default
- no respondent name/email fields
- identifying-details warning on free text
- low-response warning
- free-text review/redaction status
- executive summary export excludes unreviewed free text

## Unit 92 campaign specifics

- campaign key: una-local-115-unit-92
- local: UNA Local 115
- unit: Unit 92, Short Stay Cardiology
- champion label stored internal-only

## Verification commands

Run exactly:
- pnpm --filter @nzila/healthcare-surveys test
- pnpm --filter @nzila/healthcare-surveys typecheck
- pnpm --filter @nzila/db test
- pnpm --filter @nzila/db typecheck
- pnpm --filter console lint && pnpm --filter console typecheck
- pnpm --filter console build
- pnpm test:fast
- pnpm validate:docs

## Known limitations

- no AI analysis
- no employer integration
- no grievance handling
- no PDF export pipeline
- no email distribution automation
