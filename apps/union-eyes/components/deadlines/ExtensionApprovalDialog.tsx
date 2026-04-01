/**
 * ExtensionApprovalDialog Component
 * 
 * Modal for officers to approve or deny deadline extension requests
 * - View request details
 * - Approve with optional days adjustment
 * - Deny with reason
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon 
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface DeadlineExtension {
  id: string;
  deadlineId: string;
  requestedBy: string;
  requestedByName?: string;
  daysRequested: number;
  reason: string;
  requestedAt: string;
  deadline: {
    deadlineName: string;
    claimNumber?: string;
    currentDeadline: string;
    deadlineType: string;
  };
}

interface ExtensionApprovalDialogProps {
  extension: DeadlineExtension;
  onApprove: (data: { daysGranted: number; notes?: string }) => Promise<void>;
  onDeny: (data: { reason: string }) => Promise<void>;
  onCancel: () => void;
  open: boolean;
}

export function ExtensionApprovalDialog({
  extension,
  onApprove,
  onDeny,
  onCancel,
  open,
}: ExtensionApprovalDialogProps) {
  const t = useTranslations('deadlines.extensionApproval');
  const [selectedTab, setSelectedTab] = useState(0); // 0 = Approve, 1 = Deny
  
  // Approve form state
  const [daysGranted, setDaysGranted] = useState<number>(extension.daysRequested);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [approvalError, setApprovalError] = useState<string | null>(null);
  
  // Deny form state
  const [denyReason, setDenyReason] = useState<string>('');
  const [denyError, setDenyError] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedTab(0);
      setDaysGranted(extension.daysRequested);
      setApprovalNotes('');
      setDenyReason('');
      setApprovalError(null);
      setDenyError(null);
      onCancel();
    }
  };

  const validateApproval = () => {
    if (!daysGranted || daysGranted < 1) {
      setApprovalError(t('daysExceedError'));
      return false;
    }
    if (daysGranted > extension.daysRequested) {
      setApprovalError(t('daysExceedError'));
      return false;
    }
    if (approvalNotes && approvalNotes.length > 500) {
      setApprovalError(t('notesMaxError'));
      return false;
    }
    setApprovalError(null);
    return true;
  };

  const validateDeny = () => {
    if (!denyReason.trim()) {
      setDenyError(t('denialReason'));
      return false;
    }
    if (denyReason.trim().length < 20) {
      setDenyError(t('denialReason'));
      return false;
    }
    if (denyReason.trim().length > 500) {
      setDenyError(t('denialReason'));
      return false;
    }
    setDenyError(null);
    return true;
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateApproval()) return;

    setIsSubmitting(true);
    try {
      await onApprove({
        daysGranted,
        notes: approvalNotes.trim() || undefined,
      });
      handleClose();
    } catch (error) {
      setApprovalError(
        error instanceof Error ? error.message : t('approveFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDeny()) return;

    setIsSubmitting(true);
    try {
      await onDeny({
        reason: denyReason.trim(),
      });
      handleClose();
    } catch (error) {
      setDenyError(
        error instanceof Error ? error.message : t('denyFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const newDeadlineIfApproved = new Date(extension.deadline.currentDeadline);
  newDeadlineIfApproved.setDate(newDeadlineIfApproved.getDate() + daysGranted);

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                {/* Header */}
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    <span className="sr-only">{t('close')}</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div>
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 pr-8"
                  >
                    {t('title')}
                  </Dialog.Title>

                  {/* Request Details */}
                  <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {extension.deadline.deadlineName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Type: {extension.deadline.deadlineType}
                        {extension.deadline.claimNumber && ` • Claim ${extension.deadline.claimNumber}`}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">{t('requestedBy')}:</span>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {extension.requestedByName || extension.requestedBy}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('requestedOn')}:</span>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {format(new Date(extension.requestedAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('currentDeadline')}:</span>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {format(new Date(extension.deadline.currentDeadline), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('daysRequested')}:</span>
                        <p className="font-medium text-gray-900 mt-0.5">
                          {extension.daysRequested} days
                        </p>
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-gray-600">{t('reason')}:</span>
                      <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                        {extension.reason}
                      </p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                    <Tab.List className="flex space-x-1 rounded-lg bg-gray-100 p-1 mt-6">
                      <Tab
                        className={({ selected }) =>
                          `w-full rounded-md py-2.5 text-sm font-medium leading-5 transition-all ${
                            selected
                              ? 'bg-white text-green-700 shadow'
                              : 'text-gray-700 hover:bg-white/12 hover:text-gray-900'
                          }`
                        }
                        disabled={isSubmitting}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircleIcon className="h-5 w-5" />
                          {t('approveTab')}
                        </div>
                      </Tab>
                      <Tab
                        className={({ selected }) =>
                          `w-full rounded-md py-2.5 text-sm font-medium leading-5 transition-all ${
                            selected
                              ? 'bg-white text-red-700 shadow'
                              : 'text-gray-700 hover:bg-white/12 hover:text-gray-900'
                          }`
                        }
                        disabled={isSubmitting}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <XCircleIcon className="h-5 w-5" />
                          {t('denyTab')}
                        </div>
                      </Tab>
                    </Tab.List>

                    <Tab.Panels className="mt-4">
                      {/* Approve Panel */}
                      <Tab.Panel>
                        <form onSubmit={handleApprove} className="space-y-5">
                          {/* Days Granted */}
                          <div>
                            <label
                              htmlFor="daysGranted"
                              className="block text-sm font-medium text-gray-700"
                            >
                              {t('daysToGrant')} <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <input
                                type="number"
                                id="daysGranted"
                                min="1"
                                max={extension.daysRequested}
                                value={daysGranted}
                                onChange={(e) => {
                                  setDaysGranted(parseInt(e.target.value) || 0);
                                  setApprovalError(null);
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                disabled={isSubmitting}
                              />
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {t('daysToGrantHelp', { max: extension.daysRequested })}
                            </p>
                            {daysGranted > 0 && (
                              <p className="mt-1 text-sm font-medium text-green-700">
                                {t('newDeadline')}: {format(newDeadlineIfApproved, 'MMM dd, yyyy')}
                              </p>
                            )}
                          </div>

                          {/* Approval Notes */}
                          <div>
                            <label
                              htmlFor="approvalNotes"
                              className="block text-sm font-medium text-gray-700"
                            >
                              {t('notesOptional')}
                            </label>
                            <div className="mt-1">
                              <textarea
                                id="approvalNotes"
                                rows={3}
                                value={approvalNotes}
                                onChange={(e) => {
                                  setApprovalNotes(e.target.value);
                                  setApprovalError(null);
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                placeholder={t('notesPlaceholder')}
                                disabled={isSubmitting}
                              />
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {t('notesCharCount', { count: approvalNotes.length })}
                            </p>
                          </div>

                          {/* Error */}
                          {approvalError && (
                            <div className="rounded-md bg-red-50 p-4">
                              <div className="flex">
                                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                                <p className="ml-3 text-sm text-red-700">{approvalError}</p>
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-3 justify-end pt-4">
                            <button
                              type="button"
                              onClick={handleClose}
                              disabled={isSubmitting}
                              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                              {t('cancel')}
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSubmitting ? t('approving') : t('approveExtension')}
                            </button>
                          </div>
                        </form>
                      </Tab.Panel>

                      {/* Deny Panel */}
                      <Tab.Panel>
                        <form onSubmit={handleDeny} className="space-y-5">
                          {/* Deny Reason */}
                          <div>
                            <label
                              htmlFor="denyReason"
                              className="block text-sm font-medium text-gray-700"
                            >
                              {t('denialReason')} <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1">
                              <textarea
                                id="denyReason"
                                rows={4}
                                value={denyReason}
                                onChange={(e) => {
                                  setDenyReason(e.target.value);
                                  setDenyError(null);
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                placeholder={t('denialPlaceholder')}
                                disabled={isSubmitting}
                              />
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {t('denialCharCount', { count: denyReason.length })}
                            </p>
                          </div>

                          {/* Error */}
                          {denyError && (
                            <div className="rounded-md bg-red-50 p-4">
                              <div className="flex">
                                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                                <p className="ml-3 text-sm text-red-700">{denyError}</p>
                              </div>
                            </div>
                          )}

                          {/* Warning */}
                          <div className="rounded-md bg-amber-50 p-4">
                            <div className="flex">
                              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
                              <p className="ml-3 text-sm text-amber-700">
                                {t('denialWarning')}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 justify-end pt-4">
                            <button
                              type="button"
                              onClick={handleClose}
                              disabled={isSubmitting}
                              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                              {t('cancel')}
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                            >
                              {isSubmitting ? t('denying') : t('denyExtension')}
                            </button>
                          </div>
                        </form>
                      </Tab.Panel>
                    </Tab.Panels>
                  </Tab.Group>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

