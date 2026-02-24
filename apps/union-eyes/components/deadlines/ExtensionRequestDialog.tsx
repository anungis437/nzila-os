/**
 * ExtensionRequestDialog Component
 * 
 * Modal for members to request deadline extensions
 * - Form with days requested and reason
 * - Validation and submission
 */

import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface Deadline {
  id: string;
  deadlineName: string;
  claimNumber?: string;
  currentDeadline: string;
  deadlineType: string;
  extensionCount: number;
}

interface ExtensionRequestDialogProps {
  deadline: Deadline;
  maxExtensionDays: number;
  onSubmit: (data: { daysRequested: number; reason: string }) => Promise<void>;
  onCancel: () => void;
  open: boolean;
}

export function ExtensionRequestDialog({
  deadline,
  maxExtensionDays,
  onSubmit,
  onCancel,
  open,
}: ExtensionRequestDialogProps) {
  const [daysRequested, setDaysRequested] = useState<number>(7);
  const [reason, setReason] = useState<string>('');
  const [errors, setErrors] = useState<{ days?: string; reason?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isSubmitting) {
      setDaysRequested(7);
      setReason('');
      setErrors({});
      setSubmitError(null);
      onCancel();
    }
  };

  const validate = () => {
    const newErrors: { days?: string; reason?: string } = {};

    // Validate days
    if (!daysRequested || daysRequested < 1) {
      newErrors.days = 'Please enter at least 1 day';
    } else if (daysRequested > maxExtensionDays) {
      newErrors.days = `Maximum ${maxExtensionDays} days allowed`;
    }

    // Validate reason
    if (!reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (reason.trim().length < 20) {
      newErrors.reason = 'Please provide at least 20 characters';
    } else if (reason.trim().length > 500) {
      newErrors.reason = 'Reason cannot exceed 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        daysRequested,
        reason: reason.trim(),
      });
      handleClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to submit request'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiresApproval = daysRequested > 7;
  const estimatedNewDeadline = new Date(deadline.currentDeadline);
  estimatedNewDeadline.setDate(estimatedNewDeadline.getDate() + daysRequested);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                {/* Header */}
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div>
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 pr-8"
                  >
                    Request Deadline Extension
                  </Dialog.Title>

                  {/* Deadline Info */}
                  <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {deadline.deadlineName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Type: {deadline.deadlineType}
                        {deadline.claimNumber && ` • Claim ${deadline.claimNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Current deadline:</span>
                      <span className="font-medium text-gray-900">
                        {format(new Date(deadline.currentDeadline), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    {deadline.extensionCount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Previous extensions:</span>
                        <span className="font-medium text-gray-900">
                          {deadline.extensionCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    {/* Days Requested */}
                    <div>
                      <label
                        htmlFor="daysRequested"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Days Requested <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <input
                          type="number"
                          id="daysRequested"
                          min="1"
                          max={maxExtensionDays}
                          value={daysRequested}
                          onChange={(e) => {
                            setDaysRequested(parseInt(e.target.value) || 0);
                            setErrors({ ...errors, days: undefined });
                          }}
                          className={`block w-full rounded-md shadow-sm sm:text-sm ${
                            errors.days
                              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                          }`}
                          disabled={isSubmitting}
                        />
                      </div>
                      {errors.days && (
                        <p className="mt-1 text-sm text-red-600">{errors.days}</p>
                      )}
                      {!errors.days && daysRequested > 0 && (
                        <p className="mt-1 text-sm text-gray-500">
                          New deadline: {format(estimatedNewDeadline, 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>

                    {/* Reason */}
                    <div>
                      <label
                        htmlFor="reason"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Reason for Extension <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="reason"
                          rows={4}
                          value={reason}
                          onChange={(e) => {
                            setReason(e.target.value);
                            setErrors({ ...errors, reason: undefined });
                          }}
                          className={`block w-full rounded-md shadow-sm sm:text-sm ${
                            errors.reason
                              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                          }`}
                          placeholder="Please explain why you need this extension..."
                          disabled={isSubmitting}
                        />
                      </div>
                      {errors.reason && (
                        <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
                      )}
                      {!errors.reason && (
                        <p className="mt-1 text-sm text-gray-500">
                          {reason.length}/500 characters (minimum 20 required)
                        </p>
                      )}
                    </div>

                    {/* Info Box */}
                    {requiresApproval && (
                      <div className="rounded-md bg-blue-50 p-4">
                        <div className="flex">
                          <div className="shrink-0">
                            <InformationCircleIcon
                              className="h-5 w-5 text-blue-400"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-blue-700">
                              Extensions longer than 7 days require officer approval.
                              You&apos;ll be notified of the decision.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Submit Error */}
                    {submitError && (
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                          <div className="shrink-0">
                            <ExclamationTriangleIcon
                              className="h-5 w-5 text-red-400"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-red-700">{submitError}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

