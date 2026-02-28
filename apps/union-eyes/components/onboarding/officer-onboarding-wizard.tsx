/**
 * Officer/Executive Onboarding Wizard
 * 
 * Multi-step onboarding flow for new union officers and executives:
 * - Step 1: Leadership Role Overview
 * - Step 2: Collective Bargaining
 * - Step 3: Governance & Meetings
 * - Step 4: Financial Oversight
 * - Step 5: Strategic Planning
 * 
 * @module components/onboarding/officer-onboarding-wizard
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  Handshake,
  Users,
  DollarSign,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { logger } from "@/lib/logger";

export interface OfficerOnboardingData {
  position: string;
  committees: string[];
  directReports: number;
  budgetAuthority: string;
  completedSteps: number;
}

const STEPS = [
  {
    id: "leadership",
    title: "Leadership Overview",
    description: "Understanding your executive role",
    icon: Award,
  },
  {
    id: "bargaining",
    title: "Collective Bargaining",
    description: "Negotiation fundamentals",
    icon: Handshake,
  },
  {
    id: "governance",
    title: "Governance & Meetings",
    description: "Running effective meetings",
    icon: Users,
  },
  {
    id: "finance",
    title: "Financial Oversight",
    description: "Budget and financial responsibilities",
    icon: DollarSign,
  },
  {
    id: "strategy",
    title: "Strategic Planning",
    description: "Planning for the future",
    icon: TrendingUp,
  },
];

export function OfficerOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [data, setData] = React.useState<OfficerOnboardingData>({
    position: "",
    committees: [],
    directReports: 0,
    budgetAuthority: "none",
    completedSteps: 0,
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setData({ ...data, completedSteps: currentStep + 1 });
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    logger.info("Officer onboarding completed", { data });
    if (typeof window !== 'undefined') {
      localStorage.setItem('officer_onboarding_completed', new Date().toISOString());
    }
    router.push('/dashboard');
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
          <Award className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Officer Onboarding
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Welcome to your leadership role. Let&apos;s prepare you for success.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            {React.createElement(STEPS[currentStep].icon, { 
              className: "w-6 h-6 text-purple-600" 
            })}
            <div>
              <CardTitle>{STEPS[currentStep].title}</CardTitle>
              <CardDescription>{STEPS[currentStep].description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && <LeadershipStep data={data} setData={setData} />}
          {currentStep === 1 && <BargainingStep />}
          {currentStep === 2 && <GovernanceStep />}
          {currentStep === 3 && <FinanceStep />}
          {currentStep === 4 && <StrategyStep />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleSkip}>
          Skip for Now
        </Button>
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <Button onClick={handleNext}>
            {currentStep === STEPS.length - 1 ? (
              <>Complete Onboarding</>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeadershipStep({ 
  data, 
  setData 
}: { 
  data: OfficerOnboardingData; 
  setData: React.Dispatch<React.SetStateAction<OfficerOnboardingData>>;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-purple-50 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900 mb-2">Your Leadership Role</h3>
        <p className="text-purple-800 text-sm">
          As a union officer, you represent the interests of our members and lead the 
          organization toward its strategic goals.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Core Responsibilities</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "Representation", desc: "Speak on behalf of members" },
            { title: "Decision Making", desc: "Vote on union policy" },
            { title: "Financial Oversight", desc: "Ensure proper use of funds" },
            { title: "Strategic Planning", desc: "Plan for organizational growth" },
            { title: "Member Communication", desc: "Keep members informed" },
            { title: "Employer Relations", desc: "Negotiate with management" }
          ].map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm">{item.title}</h5>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Your Position</label>
        <select 
          className="w-full p-2 border rounded-md"
          value={data.position}
          onChange={(e) => setData({ ...data, position: e.target.value })}
        >
          <option value="">Select your position...</option>
          <option value="president">President</option>
          <option value="vice-president">Vice President</option>
          <option value="secretary">Secretary</option>
          <option value="treasurer">Treasurer</option>
          <option value="chief-steward">Chief Steward</option>
          <option value="bargaining-chair">Bargaining Committee Chair</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Budget Authority Level</label>
        <select 
          className="w-full p-2 border rounded-md"
          value={data.budgetAuthority}
          onChange={(e) => setData({ ...data, budgetAuthority: e.target.value })}
        >
          <option value="none">No direct budget authority</option>
          <option value="operating">Operating budget approval</option>
          <option value="capital">Capital expenditure approval</option>
          <option value="full">Full financial authority</option>
        </select>
      </div>
    </div>
  );
}

function BargainingStep() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">🤝 Collective Bargaining</h3>
        <p className="text-blue-800 text-sm">
          The collective bargaining process is how we secure better wages, benefits, 
          and working conditions for our members.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">The Bargaining Cycle</h4>
        
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
            1
          </div>
          <div>
            <h5 className="font-medium">Preparation</h5>
            <p className="text-sm text-gray-600">
              Survey members, research market data, form bargaining committee, identify priorities.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
            2
          </div>
          <div>
            <h5 className="font-medium">Negotiation</h5>
            <p className="text-sm text-gray-600">
              Meet with employer team, propose demands, counter-offer, reach tentative agreement.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
            3
          </div>
          <div>
            <h5 className="font-medium">Ratification</h5>
            <p className="text-sm text-gray-600">
              Present agreement to members, explain terms, conduct vote.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
            4
          </div>
          <div>
            <h5 className="font-medium">Implementation</h5>
            <p className="text-sm text-gray-600">
              Enforce new agreement, communicate changes, handle grievances on new terms.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2">Key Documents</h4>
        <ul className="text-yellow-800 text-sm space-y-1">
          <li>• Bargaining diary and notes</li>
          <li>• Costing sheets for proposals</li>
          <li>• Membership survey results</li>
          <li>• Employer financial information</li>
        </ul>
      </div>
    </div>
  );
}

function GovernanceStep() {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 mb-2">🏛️ Effective Governance</h3>
        <p className="text-green-800 text-sm">
          Proper meeting procedures ensure democratic decision-making and protect the organization.
        </p>
      </div>

      <div className="space-y-4">
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        <h4 className="font-medium">Robert's Rules Basics</h4>
        <div className="space-y-2">
          {[
            "One speaker at a time",
            "Motions must be seconded",
            "Vote majority rules (unless specified)",
            "Minutes must be kept",
            "Quorum required for decisions"
          ].map((rule, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              {rule}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Required Meetings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "Executive Board", freq: "Monthly", purpose: "Day-to-day decisions" },
            { title: "General Membership", freq: "Quarterly", purpose: "Major votes, reports" },
            { title: "Bargaining Updates", freq: "As needed", purpose: "Member input on talks" },
            { title: "Committee Meetings", freq: "As scheduled", purpose: "Specialized work" }
          ].map((meeting, index) => (
            <div key={index} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm">{meeting.title}</h5>
              <p className="text-xs text-gray-500">{meeting.freq}</p>
              <p className="text-xs text-gray-600 mt-1">{meeting.purpose}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinanceStep() {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 mb-2">💰 Financial Oversight</h3>
        <p className="text-green-800 text-sm">
          Officers have fiduciary responsibility to protect union finances and ensure proper use of funds.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Key Financial Responsibilities</h4>
        <div className="space-y-2">
          {[
            "Review financial reports monthly",
            "Approve annual budget",
            "Ensure proper audit procedures",
            "Monitor dues collection",
            "Oversee strike fund (if applicable)",
            "Approve major expenditures"
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
              <DollarSign className="w-4 h-4 text-green-600" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
        <h4 className="font-medium text-red-900 mb-2">⚠️ Red Flags to Watch</h4>
        <ul className="text-red-800 text-sm space-y-1">
          <li>• Missing or delayed financial reports</li>
          <li>• Unauthorized expenditures</li>
          <li>• Inconsistent accounting</li>
          <li>• Lack of audit access</li>
        </ul>
      </div>
    </div>
  );
}

function StrategyStep() {
  return (
    <div className="space-y-6">
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-2">📈 Strategic Planning</h3>
        <p className="text-purple-800 text-sm">
          Long-term planning ensures the union grows stronger and better serves its members.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Strategic Priorities</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "Membership Growth", desc: "Organizing new members" },
            { title: "Member Engagement", desc: "Active participation" },
            { title: "Financial Stability", desc: "Sustainable funding" },
            { title: "Political Action", desc: "Legislative advocacy" },
            { title: "Education", desc: "Training leaders" },
            { title: "Communications", desc: "Member outreach" }
          ].map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm">{item.title}</h5>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Your AI Assistant</h4>
        <p className="text-blue-800 text-sm">
          Your AI assistant can help with research, report generation, and answering 
          questions about union procedures. It&apos;s trained on labor law and best practices!
        </p>
      </div>

      <div className="text-center p-4 bg-green-100 rounded-lg">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
        <h4 className="font-medium text-green-900">You&apos;re Ready to Lead!</h4>
        <p className="text-green-800 text-sm">
          Complete your onboarding to access your executive dashboard.
        </p>
      </div>
    </div>
  );
}

export default OfficerOnboardingWizard;
