/**
 * Steward Onboarding Wizard
 * 
 * Multi-step onboarding flow for new union stewards:
 * - Step 1: Role Introduction & Responsibilities
 * - Step 2: Grievance Handling Basics
 * - Step 3: Rights & Management
 * - Step 4: Documentation Requirements
 * - Step 5: Resources & Support
 * 
 * @module components/onboarding/steward-onboarding-wizard
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  FileText, 
  Users, 
  Clock, 
  BookOpen, 
  MessageSquare,
  Phone,
  CheckCircle2,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { logger } from "@/lib/logger";

export interface StewardOnboardingData {
  chapter: string;
  worksites: string[];
  bargainingUnit: string;
  contactMethod: string;
  emergencyContact: string;
  completedSteps: number;
}

const STEPS = [
  {
    id: "introduction",
    title: "Welcome, Steward!",
    description: "Understanding your vital role",
    icon: Shield,
  },
  {
    id: "grievance-basics",
    title: "Grievance Handling",
    description: "The fundamentals of representing members",
    icon: FileText,
  },
  {
    id: "rights",
    title: "Your Rights",
    description: "Weingarten rights and beyond",
    icon: Users,
  },
  {
    id: "documentation",
    title: "Documentation",
    description: "Proper record-keeping practices",
    icon: Clock,
  },
  {
    id: "resources",
    title: "Resources & Support",
    description: "Tools available to help you succeed",
    icon: BookOpen,
  },
];

export function StewardOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [data, setData] = React.useState<StewardOnboardingData>({
    chapter: "",
    worksites: [],
    bargainingUnit: "",
    contactMethod: "email",
    emergencyContact: "",
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
    logger.info("Steward onboarding completed", { data });
    // Save completion status
    if (typeof window !== 'undefined') {
      localStorage.setItem('steward_onboarding_completed', new Date().toISOString());
    }
    router.push('/dashboard');
  };

  const handleSkip = () => {
    logger.info("Steward onboarding skipped");
    router.push('/dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Steward Onboarding
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Welcome to your role as a union steward. Let&apos;s get you prepared.
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
              className: "w-6 h-6 text-blue-600" 
            })}
            <div>
              <CardTitle>{STEPS[currentStep].title}</CardTitle>
              <CardDescription>{STEPS[currentStep].description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && <IntroductionStep data={data} setData={setData} />}
          {currentStep === 1 && <GrievanceBasicsStep />}
          {currentStep === 2 && <RightsStep />}
          {currentStep === 3 && <DocumentationStep />}
          {currentStep === 4 && <ResourcesStep />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleSkip}
        >
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

function IntroductionStep({ 
  data, 
  setData 
}: { 
  data: StewardOnboardingData; 
  setData: React.Dispatch<React.SetStateAction<StewardOnboardingData>>;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Your Role as a Steward</h3>
        <p className="text-blue-800 text-sm">
          As a union steward, you are the front-line representative for your co-workers. 
          You play a crucial role in enforcing our collective agreement and ensuring 
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          members' rights are protected.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-2">Key Responsibilities</h4>
          <ul className="text-sm space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
              Representing members in grievances
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
              Communicating union information
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
              Monitoring workplace conditions
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
              Recruiting and organizing members
            </li>
          </ul>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-2">What You&apos;ll Need</h4>
          <ul className="text-sm space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-500 mt-0.5" />
              Time for steward duties
            </li>
            <li className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-blue-500 mt-0.5" />
              Knowledge of the CBA
            </li>
            <li className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5" />
              Communication skills
            </li>
            <li className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-blue-500 mt-0.5" />
              Contact with union staff
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Which chapter are you assigned to?</label>
        <select 
          className="w-full p-2 border rounded-md"
          value={data.chapter}
          onChange={(e) => setData({ ...data, chapter: e.target.value })}
        >
          <option value="">Select a chapter...</option>
          <option value="chapter-1">Chapter 1 - Manufacturing</option>
          <option value="chapter-2">Chapter 2 - Services</option>
          <option value="chapter-3">Chapter 3 - Healthcare</option>
        </select>
      </div>
    </div>
  );
}

function GrievanceBasicsStep() {
  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h3 className="font-semibold text-yellow-900 mb-2">🔰 Grievance Handling 101</h3>
        <p className="text-yellow-800 text-sm">
          A grievance is any complaint or concern about the interpretation or application 
          of our collective agreement. As a steward, you&apos;ll be the first point of contact.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">The Grievance Process</h4>
        
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            1
          </div>
          <div>
            <h5 className="font-medium">Listen & Document</h5>
            <p className="text-sm text-gray-600">
              Meet with the member, listen to their concern, and document everything accurately.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            2
          </div>
          <div>
            <h5 className="font-medium">Investigate</h5>
            <p className="text-sm text-gray-600">
              Gather facts, review the CBA, and speak with witnesses if needed.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            3
          </div>
          <div>
            <h5 className="font-medium">Discuss with Management</h5>
            <p className="text-sm text-gray-600">
              Attempt informal resolution before filing a formal grievance.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            4
          </div>
          <div>
            <h5 className="font-medium">File Grievance</h5>
            <p className="text-sm text-gray-600">
              If unresolved, file the formal grievance with proper documentation.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
        <h4 className="font-medium text-red-900 mb-2">⏰ Critical: Timelines Matter!</h4>
        <p className="text-red-800 text-sm">
          Most grievances must be filed within 5-10 business days of the incident. 
          Always check the specific timeline in your CBA. Missing a deadline can forfeit the grievance.
        </p>
      </div>
    </div>
  );
}

function RightsStep() {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 mb-2">Your Weingarten Rights</h3>
        <p className="text-green-800 text-sm">
          Under the Weingarten decision, you have the right to union representation 
          during any investigatory interview that could lead to discipline.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">When You Have the Right to Represent</h4>
        <ul className="space-y-2">
          {[
            "Management schedules a meeting to investigate misconduct",
            "Member is asked to answer allegations",
            "Any meeting where discipline may result",
            "Performance evaluation discussions"
          ].map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <Users className="w-4 h-4 text-green-500 mt-1" />
              <span className="text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Your Rights as a Steward</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            "Access to the workplace during your shift",
            "Time off for union duties (per CBA)",
            "Access to relevant documents",
            "Protection from retaliation",
            "Training and support from the union",
            "Confidential member information"
          ].map((right, index) => (
            <div key={index} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              {right}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentationStep() {
  return (
    <div className="space-y-6">
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-2">📋 Proper Documentation</h3>
        <p className="text-purple-800 text-sm">
          Good documentation is essential. Write down everything as soon as possible 
          while details are fresh in your mind.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">What to Document</h4>
        <div className="space-y-3">
          {[
            { title: "Incident Details", desc: "Who, what, when, where, witnesses" },
            { title: "Conversations", desc: "Date, time, attendees, key points discussed" },
            { title: "Management Actions", desc: "Verbatim statements, documents provided" },
            { title: "Member Statements", desc: "Direct quotes when possible" },
            { title: "Timeline", desc: "Chronological sequence of events" }
          ].map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <h5 className="font-medium text-sm">{item.title}</h5>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tip</h4>
        <p className="text-blue-800 text-sm">
          Use the UnionEyes grievance tracking system to document all cases. 
          It maintains proper timestamps and provides automatic reminders for deadlines.
        </p>
      </div>
    </div>
  );
}

function ResourcesStep() {
  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 mb-2">🎯 You&apos;re Ready!</h3>
        <p className="text-green-800 text-sm">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          Here's everything you need to succeed in your role as a steward.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Your Support Resources</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h5 className="font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Collective Agreement
            </h5>
            <p className="text-sm text-gray-600 mt-1">
              Access your CBA in the Documents section
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h5 className="font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Chief Steward
            </h5>
            <p className="text-sm text-gray-600 mt-1">
              Contact for complex grievances
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h5 className="font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Union Staff Rep
            </h5>
            <p className="text-sm text-gray-600 mt-1">
              Available for arbitration and complex cases
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <h5 className="font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              Training Modules
            </h5>
            <p className="text-sm text-gray-600 mt-1">
              Online steward training available
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2">Need Help?</h4>
        <p className="text-yellow-800 text-sm">
          Your AI assistant can help answer questions about grievance procedures, 
          CBA interpretation, and member rights. Look for the chat icon in your dashboard!
        </p>
      </div>
    </div>
  );
}

export default StewardOnboardingWizard;
