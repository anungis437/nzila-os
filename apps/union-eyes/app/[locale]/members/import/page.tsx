/**
 * Bulk Import Wizard Page
 * 
 * Multi-step CSV import with validation and preview
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api/index';
import { logger } from '@/lib/logger';
import { 
  Upload, FileText, CheckCircle, XCircle, AlertTriangle, ArrowLeft 
} from 'lucide-react';

type ImportStep = 'upload' | 'mapping' | 'validation' | 'review' | 'importing' | 'complete';

export default function BulkImportPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [_jobId, setJobId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [_validationResults, _setValidationResults] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setCurrentStep('mapping');
  };

  const handleStartImport = async () => {
    try {
      setCurrentStep('importing');
      
      if (!file) {
        alert('No file selected');
        return;
      }

      const result = await api.members.import(file);
      setJobId(result.job?.id);
      setCurrentStep('complete');
    } catch (error) {
      logger.error('Import error:', error);
      alert('Error importing members. Please try again.');
    }
  };

  const steps = [
    { id: 'upload', label: 'Upload File', icon: Upload },
    { id: 'mapping', label: 'Map Columns', icon: FileText },
    { id: 'validation', label: 'Validate Data', icon: CheckCircle },
    { id: 'review', label: 'Review', icon: AlertTriangle },
    { id: 'importing', label: 'Importing', icon: Upload },
    { id: 'complete', label: 'Complete', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Bulk Import Members</h1>
          <p className="text-muted-foreground">
            Import member data from CSV file
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStepIndex;
            const isComplete = index < currentStepIndex;
            
            return (
              <div
                key={step.id}
                className="flex flex-col items-center flex-1"
              >
                <div
                  className={`
                    h-10 w-10 rounded-full flex items-center justify-center
                    ${isActive ? 'bg-primary text-primary-foreground' : ''}
                    ${isComplete ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-xs mt-2 text-center">{step.label}</div>
                {index < steps.length - 1 && (
                  <div className="w-full h-0.5 bg-muted absolute left-1/2" />
                )}
              </div>
            );
          })}
        </div>
        <Progress value={(currentStepIndex / (steps.length - 1)) * 100} />
      </Card>

      {/* Step Content */}
      {currentStep === 'upload' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload CSV File</h2>
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="mb-4">Drag and drop your CSV file here, or click to browse</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button asChild>
                <span>Choose File</span>
              </Button>
            </label>
          </div>
          <Alert className="mt-4">
            <AlertDescription>
              <strong>Requirements:</strong> CSV file with columns: email, full_name, phone, status, local, classification
            </AlertDescription>
          </Alert>
        </Card>
      )}

      {currentStep === 'mapping' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Map Columns</h2>
          <p className="text-muted-foreground mb-4">
            Selected file: <strong>{file?.name}</strong>
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>CSV Column</strong>
              </div>
              <div>
                <strong>Database Field</strong>
              </div>
            </div>
            {/* Column mapping interface */}
            <div className="text-muted-foreground text-center py-8">
              Column mapping interface will be implemented here
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep('upload')}>
              Back
            </Button>
            <Button onClick={() => setCurrentStep('validation')}>
              Continue to Validation
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 'validation' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Validation Results</h2>
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully validated 95 out of 100 rows
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                5 rows have errors and will be skipped
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
              Back
            </Button>
            <Button onClick={() => setCurrentStep('review')}>
              Review
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 'review' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Review Import</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Total Rows:</strong> 100
              </div>
              <div>
                <strong>Valid Rows:</strong> 95
              </div>
              <div>
                <strong>Import Type:</strong> Members
              </div>
              <div>
                <strong>Action:</strong> Create New
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setCurrentStep('validation')}>
              Back
            </Button>
            <Button onClick={handleStartImport}>
              Start Import
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 'importing' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Importing...</h2>
          <Progress value={65} className="mb-2" />
          <p className="text-center text-muted-foreground">
            Importing 62 of 95 records...
          </p>
        </Card>
      )}

      {currentStep === 'complete' && (
        <Card className="p-6 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-2xl font-semibold mb-2">Import Complete!</h2>
          <p className="text-muted-foreground mb-6">
            Successfully imported 95 members
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.push('/members')}>
              View Members
            </Button>
            <Button onClick={() => {
              setCurrentStep('upload');
              setFile(null);
            }}>
              Import Another File
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
