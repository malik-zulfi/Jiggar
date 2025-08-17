'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { performOcr } from '@/ai/flows/ocr';
import ProgressLoader from './progress-loader';

type UploadedFile = { name: string; content: string };

interface FileUploaderProps {
  onFileUpload: (files: UploadedFile[]) => void;
  onFileClear: () => void;
  acceptedFileTypes: string;
  label: string;
  id: string;
  multiple?: boolean;
}

export default function FileUploader({
  onFileUpload,
  onFileClear,
  acceptedFileTypes,
  label,
  id,
  multiple = false,
}: FileUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [fileDisplayNames, setFileDisplayNames] = useState<string[]>([]);
  const [processingProgress, setProcessingProgress] = useState<{
    steps: string[];
    currentStepIndex: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setupPdfJsWorker = async () => {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
    };
    setupPdfJsWorker();
  }, []);

  const clearFiles = () => {
    setFileDisplayNames([]);
    onFileClear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseFile = async (file: File): Promise<UploadedFile | null> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let content = '';

    try {
      if (fileExtension === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist');

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        let textContentAcc = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          textContentAcc += textContent.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .join(' ');
        }
        content = textContentAcc;

        if (content.trim().length < 10) {
          toast({
            title: 'Image-based PDF Detected',
            description: `Performing OCR on "${file.name}" to extract text. This may take a few moments...`,
          });

          let ocrContent = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
              await page.render({
                canvasContext: context,
                viewport: viewport,
                canvas: canvas,
              }).promise;
              const imageDataUri = canvas.toDataURL('image/png');
              const ocrResult = await performOcr({ image: imageDataUri });
              if (ocrResult?.text) {
                ocrContent += ocrResult.text + '\n\n';
              }
            }
          }
          content = content + '\n\n' + ocrContent;
        }
      } else if (fileExtension === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (fileExtension === 'doc') {
        toast({
          variant: 'destructive',
          title: 'Unsupported Format',
          description: `.doc files are not supported for ${file.name}. Please convert to .docx, .pdf, or .txt`,
        });
        return null;
      } else {
        // txt and other text formats
        content = await file.text();
      }

      if (content.trim()) {
        return { name: file.name, content };
      } else {
        toast({
          variant: 'destructive',
          title: 'Empty File',
          description: `The uploaded file "${file.name}" appears to be empty or could not be read.`,
        });
        return null;
      }
    } catch (error: any) {
      console.error(`Error parsing file ${file.name}:`, error);
      toast({
        variant: 'destructive',
        title: 'Parsing Error',
        description: `Failed to parse file "${file.name}". ${error.message}`,
      });
      return null;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = acceptedFileTypes
      .split(',')
      .map((t) => t.trim().toLowerCase());
    const validFiles: File[] = [];
    let invalidFiles: string[] = [];

    for (const file of Array.from(files)) {
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (allowedTypes.includes(fileExtension)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type(s)',
        description: `Skipping files: ${invalidFiles.join(
          ', '
        )}. Please use: ${acceptedFileTypes}`,
      });
    }
    if (validFiles.length === 0) return;

    const steps = [
      'Initializing secure upload...',
      'Validating file formats...',
      `Parsing ${validFiles.length} document(s)...`,
      'Extracting text content...',
      'Finalizing for analysis...',
    ];

    setProcessingProgress({ steps, currentStepIndex: 0 });
    let simulationInterval: NodeJS.Timeout | null = setInterval(() => {
      setProcessingProgress((prev) => {
        if (!prev) {
          if (simulationInterval) clearInterval(simulationInterval);
          return null;
        }
        const nextStep = prev.currentStepIndex + 1;
        if (nextStep >= prev.steps.length - 1) {
          if (simulationInterval) clearInterval(simulationInterval);
        }
        return {
          ...prev,
          currentStepIndex: Math.min(nextStep, prev.steps.length - 1),
        };
      });
    }, 500);

    try {
      const parsedFiles = (await Promise.all(validFiles.map(parseFile))).filter(
        Boolean
      ) as UploadedFile[];
      onFileUpload(parsedFiles);
      setFileDisplayNames(parsedFiles.map((f) => f.name));
    } catch (error: any) {
      console.error('Error processing files:', error);
      toast({
        variant: 'destructive',
        title: 'Processing Error',
        description:
          error.message || 'An error occurred while processing files.',
      });
    } finally {
      if (simulationInterval) clearInterval(simulationInterval);
      setProcessingProgress((prev) =>
        prev ? { ...prev, currentStepIndex: steps.length } : null
      );
      await new Promise((r) => setTimeout(r, 500));
      setProcessingProgress(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {processingProgress ? (
        <ProgressLoader
          title={`Reading ${multiple ? 'files' : 'file'}...`}
          steps={processingProgress.steps}
          currentStepIndex={processingProgress.currentStepIndex}
        />
      ) : fileDisplayNames.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {fileDisplayNames.length} file(s) selected
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFiles}
              className="h-6 w-6 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3 rounded-md border bg-muted/50 max-h-32 overflow-y-auto">
            <ul className="space-y-1.5 pl-1">
              {fileDisplayNames.map((name, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 overflow-hidden"
                >
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div
          id={id}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={cn(
            'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-input hover:border-primary/50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptedFileTypes}
            onChange={(e) => handleFiles(e.target.files)}
            multiple={multiple}
          />
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-primary">Click to upload</span>{' '}
            or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {acceptedFileTypes.replace(/,/g, ', ').toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}
