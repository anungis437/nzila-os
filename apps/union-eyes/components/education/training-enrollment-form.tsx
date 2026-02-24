/**
 * Training Enrollment Form Component
 * 
 * Course enrollment workflow with:
 * - Multi-step process
 * - Prerequisites validation
 * - Schedule selection
 * - Payment processing
 * - Confirmation emails
 * - Waitlist management
 * 
 * @module components/education/training-enrollment-form
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  BookOpen,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

const enrollmentSchema = z.object({
  participantName: z.string().min(1, "Name is required"),
  participantEmail: z.string().email("Invalid email address"),
  department: z.string().min(1, "Department is required"),
  sessionId: z.string().min(1, "Please select a session"),
  specialAccommodations: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().min(1, "Emergency contact name is required"),
    phone: z.string().min(1, "Emergency contact phone is required"),
  }),
  dietaryRestrictions: z.string().optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
  paymentMethod: z.enum(["invoice", "credit-card", "purchase-order"]),
  purchaseOrderNumber: z.string().optional(),
});

type EnrollmentData = z.infer<typeof enrollmentSchema>;

export interface CourseSession {
  id: string;
  startDate: Date;
  endDate: Date;
  location: string;
  format: "online" | "in-person" | "hybrid";
  instructor: string;
  availableSpots: number;
  price: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  duration: number;
  prerequisites: string[];
  sessions: CourseSession[];
  requiresPayment: boolean;
  cancellationPolicy: string;
}

export interface TrainingEnrollmentFormProps {
  course: Course;
  userHasPrerequisites?: boolean;
  onSubmit?: (data: EnrollmentData) => Promise<void>;
  onCancel?: () => void;
}

export function TrainingEnrollmentForm({
  course,
  userHasPrerequisites = true,
  onSubmit,
  onCancel,
}: TrainingEnrollmentFormProps) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [joinWaitlist, setJoinWaitlist] = React.useState(false);

  const form = useForm<EnrollmentData>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      participantName: "",
      participantEmail: "",
      department: "",
      sessionId: "",
      specialAccommodations: "",
      emergencyContact: {
        name: "",
        phone: "",
      },
      dietaryRestrictions: "",
      agreeToTerms: false,
      paymentMethod: "invoice",
      purchaseOrderNumber: "",
    },
  });

  const selectedSession = course.sessions.find(
    (s) => s.id === form.watch("sessionId")
  );

  const handleNext = async () => {
    const fieldsToValidate: (keyof EnrollmentData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate.push("participantName", "participantEmail", "department", "sessionId");
    } else if (currentStep === 2) {
      fieldsToValidate.push("emergencyContact");
    } else if (currentStep === 3 && course.requiresPayment) {
      fieldsToValidate.push("paymentMethod");
      if (form.watch("paymentMethod") === "purchase-order") {
        fieldsToValidate.push("purchaseOrderNumber");
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (data: EnrollmentData) => {
    setIsSubmitting(true);
    try {
      await onSubmit?.(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSteps = course.requiresPayment ? 4 : 3;
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Enroll in {course.title}
        </h2>
        <p className="text-gray-600 mt-1">
          Complete the enrollment process to secure your spot
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Step {currentStep} of {totalSteps}</span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites Warning */}
      {!userHasPrerequisites && course.prerequisites.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Missing Prerequisites:</strong> You do not meet all course prerequisites.
            Please complete the following courses first:
            <ul className="list-disc list-inside mt-2">
              {course.prerequisites.map((prereq, index) => (
                <li key={index}>{prereq}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>
                {currentStep === 1 && "Participant Information"}
                {currentStep === 2 && "Additional Details"}
                {currentStep === 3 && course.requiresPayment && "Payment Information"}
                {currentStep === 3 && !course.requiresPayment && "Review & Confirm"}
                {currentStep === 4 && "Review & Confirm"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="participantName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John Doe" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="participantEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="john@example.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department/Division</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Operations" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sessionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Training Session</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a session" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {course.sessions.map((session) => (
                              <SelectItem key={session.id} value={session.id}>
                                <div className="py-1">
                                  <div className="font-medium">
                                    {session.startDate.toLocaleDateString()} -{" "}
                                    {session.endDate.toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {session.location} • {session.format} • {session.availableSpots}{" "}
                                    spots left
                                    {course.requiresPayment && ` • $${session.price}`}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedSession && selectedSession.availableSpots === 0 && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        This session is full. Would you like to join the waitlist?
                        <div className="mt-2">
                          <Checkbox
                            checked={joinWaitlist}
                            onCheckedChange={(checked) => setJoinWaitlist(!!checked)}
                          />
                          <Label className="ml-2">Join waitlist for this session</Label>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {/* Step 2: Additional Details */}
              {currentStep === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="emergencyContact.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Jane Doe" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContact.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" placeholder="(555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="specialAccommodations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Accommodations (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder="Please describe any accessibility needs or special accommodations required"
                          />
                        </FormControl>
                        <FormDescription>
                          Let us know if you require any special arrangements
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedSession?.format === "in-person" && (
                    <FormField
                      control={form.control}
                      name="dietaryRestrictions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dietary Restrictions (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
                            />
                          </FormControl>
                          <FormDescription>
                            Meals will be provided during in-person sessions
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {/* Step 3: Payment (if required) */}
              {currentStep === 3 && course.requiresPayment && (
                <>
                  {selectedSession && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Training Fee:</span>
                        <span className="text-2xl font-bold">${selectedSession.price}</span>
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="invoice" id="invoice" />
                              <Label htmlFor="invoice">Invoice (Bill to Organization)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="credit-card" id="credit-card" />
                              <Label htmlFor="credit-card">Credit Card</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="purchase-order" id="purchase-order" />
                              <Label htmlFor="purchase-order">Purchase Order</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("paymentMethod") === "purchase-order" && (
                    <FormField
                      control={form.control}
                      name="purchaseOrderNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Order Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="PO-123456" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {/* Step 4: Review & Confirm */}
              {((currentStep === 3 && !course.requiresPayment) || currentStep === 4) && (
                <>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Participant Information</h4>
                      <div className="text-sm space-y-1">
                        <div>Name: {form.watch("participantName")}</div>
                        <div>Email: {form.watch("participantEmail")}</div>
                        <div>Department: {form.watch("department")}</div>
                      </div>
                    </div>

                    {selectedSession && (
                      <div>
                        <h4 className="font-semibold mb-2">Session Details</h4>
                        <div className="text-sm space-y-1">
                          <div>
                            Dates: {selectedSession.startDate.toLocaleDateString()} -{" "}
                            {selectedSession.endDate.toLocaleDateString()}
                          </div>
                          <div>Location: {selectedSession.location}</div>
                          <div>Format: {selectedSession.format}</div>
                          {course.requiresPayment && <div>Price: ${selectedSession.price}</div>}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold mb-2">Cancellation Policy</h4>
                      <p className="text-sm text-gray-600">{course.cancellationPolicy}</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="agreeToTerms"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the terms and conditions and cancellation policy
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <div>
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
              {onCancel && currentStep === 1 && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <div>
              {currentStep < totalSteps && (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    !userHasPrerequisites ||
                    (selectedSession?.availableSpots === 0 && !joinWaitlist)
                  }
                >
                  Next
                </Button>
              )}
              {currentStep === totalSteps && (
                <Button
                  type="submit"
                  disabled={isSubmitting || !userHasPrerequisites}
                >
                  {isSubmitting ? "Submitting..." : joinWaitlist ? "Join Waitlist" : "Complete Enrollment"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

