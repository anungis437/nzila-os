/**
 * Upload Remittance Page
 * 
 * Upload employer remittance file for processing
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api/index';
import { logger } from '@/lib/logger';

type UploadStep = 'details' | 'upload' | 'processing' | 'complete';

interface RemittanceData {
  employerId: string;
  periodStart: string;
  periodEnd: string;
  file: File | null;
}

export default function UploadRemittancePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<UploadStep>('details');
  const [formData, setFormData] = useState<RemittanceData>({
    employerId: '',
    periodStart: '',
    periodEnd: '',
    file: null,
  });
  const [uploadProgress, _setUploadProgress] = useState(0);
  const [processingResults, setProcessingResults] = useState({
    totalRows: 0,
    validRows: 0,
    errors: 0,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.file) return;

    setCurrentStep('processing');

    try {
      const formDataObj = new FormData();
      formDataObj.append('file', formData.file);
      formDataObj.append('employerId', formData.employerId);
      formDataObj.append('periodStart', formData.periodStart);
      formDataObj.append('periodEnd', formData.periodEnd);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (api.dues.remittances.upload as any)(formDataObj) as Record<string, any>;
      
      setProcessingResults({
        totalRows: result.totalRows || 0,
        validRows: result.validRows || 0,
        errors: result.errors || 0,
      });

      setCurrentStep('complete');
    } catch (error) {
      logger.error('Error uploading remittance:', error);
      alert('Error uploading remittance. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Upload Remittance</h1>
          <p className="text-muted-foreground">
            Upload employer dues remittance file
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {['Details', 'Upload', 'Processing', 'Complete'].map((step, index) => {
          const stepIds: UploadStep[] = ['details', 'upload', 'processing', 'complete'];
          const currentIndex = stepIds.indexOf(currentStep);
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    h-10 w-10 rounded-full flex items-center justify-center
                    ${isActive ? 'bg-primary text-primary-foreground' : ''}
                    ${isComplete ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  {isComplete ? <CheckCircle className="h-5 w-5" /> : index + 1}
                </div>
                <span className="text-xs mt-1">{step}</span>
              </div>
              {index < 3 && (
                <div
                  className={`h-px w-16 mx-2 ${
                    isComplete ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {currentStep === 'details' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Remittance Details</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employerId">Employer *</Label>
              <Select
                value={formData.employerId}
                onValueChange={(v) => setFormData(prev => ({ ...prev, employerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emp-1">ABC Manufacturing</SelectItem>
                  <SelectItem value="emp-2">XYZ Industries</SelectItem>
                  <SelectItem value="emp-3">123 Corporation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                  required
                />
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>File Format:</strong> CSV or Excel file with columns: employee_id, name, amount, period
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setCurrentStep('upload')}
              disabled={!formData.employerId || !formData.periodStart || !formData.periodEnd}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 'upload' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload File</h2>

          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            
            {formData.file ? (
              <div>
                <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="font-medium">{formData.file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(formData.file.size / 1024).toFixed(0)} KB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFormData(prev => ({ ...prev, file: null }))}
                >
                  Change File
                </Button>
              </div>
            ) : (
              <>
                <p className="mb-4">Drag and drop your file here, or click to browse</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button asChild>
                    <span>Choose File</span>
                  </Button>
                </label>
              </>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep('details')}>
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.file}>
              Upload & Process
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 'processing' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Processing Remittance</h2>
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
            </div>
            <p className="text-lg font-medium mb-2">Processing file...</p>
            <p className="text-sm text-muted-foreground mb-4">
              Validating records and matching to members
            </p>
            <Progress value={uploadProgress} className="max-w-md mx-auto" />
            <p className="text-xs text-muted-foreground mt-2">{uploadProgress}%</p>
          </div>
        </Card>
      )}

      {currentStep === 'complete' && (
        <Card className="p-6">
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-semibold mb-2">Upload Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Remittance file has been processed successfully
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
              <Card className="p-4">
                <p className="text-2xl font-bold">{processingResults.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-green-600">{processingResults.validRows}</p>
                <p className="text-sm text-muted-foreground">Valid</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-red-600">{processingResults.errors}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </Card>
            </div>

            {processingResults.errors > 0 && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {processingResults.errors} records have errors and require manual review
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.push('/dues')}>
                View Dashboard
              </Button>
              <Button onClick={() => router.push('/dues/reconcile')}>
                Go to Reconciliation
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
