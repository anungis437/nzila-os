/**
 * Learning Path Designer Component
 * 
 * Curriculum planning with:
 * - Path creation
 * - Course sequencing
 * - Milestone tracking
 * - Duration estimates
 * - Prerequisites management
 * - Progress visualization
 * 
 * @module components/education/learning-path-designer
 */

"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Target,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle,
  Clock,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const learningPathSchema = z.object({
  name: z.string().min(1, "Path name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  milestones: z.array(
    z.object({
      title: z.string().min(1, "Milestone title is required"),
      description: z.string().optional(),
      courseIds: z.array(z.string()).min(1, "At least one course required"),
      estimatedDuration: z.number().min(1, "Duration is required"),
    })
  ).min(1, "At least one milestone required"),
});

type LearningPathData = z.infer<typeof learningPathSchema>;

export interface AvailableCourse {
  id: string;
  title: string;
  duration: number;
  level: string;
  category: string;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  totalDuration: number;
  completionRate: number;
  enrolledCount: number;
  milestones: {
    id: string;
    title: string;
    description?: string;
    courses: AvailableCourse[];
    estimatedDuration: number;
    completed: boolean;
  }[];
}

export interface LearningPathDesignerProps {
  availableCourses: AvailableCourse[];
  existingPaths: LearningPath[];
  categories: string[];
  onSavePath?: (data: LearningPathData) => Promise<void>;
  onDeletePath?: (pathId: string) => Promise<void>;
}

export function LearningPathDesigner({
  availableCourses,
  existingPaths,
  categories,
  onSavePath,
  onDeletePath,
}: LearningPathDesignerProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const form = useForm<LearningPathData>({
    resolver: zodResolver(learningPathSchema),
    defaultValues: {
      name: "",
      description: "",
      category: categories[0] || "",
      difficulty: "beginner",
      milestones: [
        {
          title: "",
          description: "",
          courseIds: [],
          estimatedDuration: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const handleSubmit = async (data: LearningPathData) => {
    setIsSubmitting(true);
    try {
      await onSavePath?.(data);
      form.reset();
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotalDuration = () => {
    const milestones = form.watch("milestones");
    return milestones.reduce((total, milestone) => {
      return total + (milestone.estimatedDuration || 0);
    }, 0);
  };

  const difficultyConfig = {
    beginner: { color: "bg-green-100 text-green-800", label: "Beginner" },
    intermediate: { color: "bg-blue-100 text-blue-800", label: "Intermediate" },
    advanced: { color: "bg-purple-100 text-purple-800", label: "Advanced" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Learning Path Designer
          </h2>
          <p className="text-gray-600 mt-1">
            Create structured learning curricula
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Path
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>New Learning Path</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Path Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Safety Certification Track" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormDescription>
                        Describe the learning objectives and outcomes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Milestones */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Milestones</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          title: "",
                          description: "",
                          courseIds: [],
                          estimatedDuration: 0,
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Milestone
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                          <h4 className="font-medium">Milestone {index + 1}</h4>
                        </div>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name={`milestones.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Milestone Title</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Fundamentals" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`milestones.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={2} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`milestones.${index}.courseIds`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Courses</FormLabel>
                            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                              {availableCourses.map((course) => (
                                <div key={course.id} className="flex items-center space-x-2 mb-2">
                                  <input
                                    type="checkbox"
                                    checked={field.value?.includes(course.id)}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      const current = field.value || [];
                                      const updated = isChecked
                                        ? [...current, course.id]
                                        : current.filter((id) => id !== course.id);
                                      field.onChange(updated);
                                    }}
                                    className="rounded"
                                  />
                                  <Label className="text-sm font-normal flex-1">
                                    {course.title}
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({course.duration}h • {course.level})
                                    </span>
                                  </Label>
                                </div>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`milestones.${index}.estimatedDuration`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Duration (hours)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Duration:</span>
                    <span className="text-2xl font-bold">{calculateTotalDuration()} hours</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setIsCreating(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Learning Path"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Existing Paths */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Existing Learning Paths</h3>
        {existingPaths.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-600">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No learning paths created yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {existingPaths.map((path) => (
              <Card key={path.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{path.name}</h4>
                        <Badge className={difficultyConfig[path.difficulty].color}>
                          {difficultyConfig[path.difficulty].label}
                        </Badge>
                        <Badge variant="outline">{path.category}</Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-4">{path.description}</p>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-600">Duration:</span>{" "}
                          <span className="font-medium">{path.totalDuration}h</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Milestones:</span>{" "}
                          <span className="font-medium">{path.milestones.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Enrolled:</span>{" "}
                          <span className="font-medium">{path.enrolledCount}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {path.milestones.map((milestone, _idx) => (
                          <div
                            key={milestone.id}
                            className="flex items-center gap-3 text-sm border-l-2 pl-3"
                          >
                            {milestone.completed ? (
                              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium">{milestone.title}</div>
                              <div className="text-xs text-gray-500">
                                {milestone.courses.length} courses • {milestone.estimatedDuration}h
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {onDeletePath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePath(path.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

