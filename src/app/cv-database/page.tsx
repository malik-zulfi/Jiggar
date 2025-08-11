"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Bot, Database, User, Mail, Phone, Linkedin, Briefcase, Search, Clock, Trash2, Wand2, Loader2, X, PlusCircle, ArrowUpDown, AlertTriangle, ListFilter } from "lucide-react";
import type { CvDatabaseRecord, AssessmentSession, SuitablePosition, CandidateRecord } from '@/lib/types';
import { CvDatabaseRecordSchema, AssessmentSessionSchema, ParseCvOutput } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from '@/components/file-uploader';
import { parseCv } from '@/ai/flows/cv-parser';
import ProgressLoader from '@/components/progress-loader';
import { Input } from "@/components/ui/input";
import CvDisplay from '@/components/cv-display';
import { cn } from "@/lib/utils";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { findSuitablePositionsForCandidate } from '@/ai/flows/find-suitable-positions';
import { Header } from '@/components/header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppContext } from '@/components/client-provider';
import { analyzeCVAgainstJD } from '@/ai/flows/cv-analyzer';


const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const PENDING_ASSESSMENT_KEY = 'jiggar-pending-assessment';


type UploadedFile = { name: string; content: string };
type JobCode = 'OCN' | 'WEX' | 'SAN';
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', message: string }>;
type Conflict = {
    newRecord: ParseCvOutput & { cvFileName: string; cvContent: string; jobCode: JobCode; };
    existingRecord: CvDatabaseRecord;
};
type SortDescriptor = { column: 'name' | 'totalExperience' | 'createdAt'; direction: 'ascending' | 'descending'; };
type CandidateAssessmentInfo = {
    sessionId: string;
    sessionName: string;
    jobTitle: string;
    score: number;
};


export default function CvDatabasePage() {
    const { history, setHistory, cvDatabase, setCvDatabase, suitablePositions, setSuitablePositions } = useAppContext();
    const { toast } = useToast();
    const [cvsToUpload, setCvsToUpload] = useState<UploadedFile[]>([]);
    const [jobCode, setJobCode] = useState<JobCode | null>(null);
    const [processingStatus, setProcessingStatus] = useState<CvProcessingStatus>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [cvResetKey, setCvResetKey] = useState(0);
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: 'createdAt', direction: 'descending' });
    
    const [conflictQueue, setConflictQueue] = useState<Conflict[]>([]);
    const [currentConflict, setCurrentConflict] = useState<Conflict | null>(null);
    
    const [selectedCv, setSelectedCv] = useState<CvDatabaseRecord | null>(null);
    const [selectedCvEmails, setSelectedCvEmails] = useState<Set<string>>(new Set());

    const sortedAndFilteredCvs = useMemo(() => {
        const filtered = searchTerm.trim() 
            ? cvDatabase.filter(cv => 
                cv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.currentTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.currentCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.structuredContent.skills?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
              ) 
            : cvDatabase;

        return [...filtered].sort((a, b) => {
            const aVal = a[sortDescriptor.column];
            const bVal = b[sortDescriptor.column];

            if (sortDescriptor.column === 'totalExperience') {
                const aYears = parseFloat(a.totalExperience || '0');
                const bYears = parseFloat(b.totalExperience || '0');
                return sortDescriptor.direction === 'ascending' ? aYears - bYears : bYears - aYears;
            }

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
            return sortDescriptor.direction === 'ascending' ? comparison : -comparison;
        });
    }, [cvDatabase, searchTerm, sortDescriptor]);
    
    const assessmentMap = useMemo(() => {
        const map = new Map<string, CandidateAssessmentInfo[]>();
        if (cvDatabase.length === 0 || history.length === 0) {
            return map;
        }

        history.forEach(session => {
            session.candidates.forEach(candidate => {
                let email = candidate.analysis.email?.toLowerCase();
                if (!email) {
                    const dbRecord = cvDatabase.find(cv => cv.name.toLowerCase() === candidate.analysis.candidateName.toLowerCase());
                    if (dbRecord) {
                        email = dbRecord.email.toLowerCase();
                    }
                }

                if (email) {
                    if (!map.has(email)) {
                        map.set(email, []);
                    }
                    map.get(email)!.push({
                        sessionId: session.id,
                        sessionName: session.jdName,
                        jobTitle: session.analyzedJd.JobTitle || 'N/A',
                        score: candidate.analysis.alignmentScore,
                    });
                }
            });
        });
        return map;
    }, [history, cvDatabase]);

    const handleSort = (column: SortDescriptor['column']) => {
        if (sortDescriptor.column === column) {
            setSortDescriptor({
                ...sortDescriptor,
                direction: sortDescriptor.direction === 'ascending' ? 'descending' : 'ascending'
            });
        } else {
            setSortDescriptor({ column, direction: 'descending' });
        }
    };


    useEffect(() => {
        if (conflictQueue.length > 0 && !currentConflict) {
            setCurrentConflict(conflictQueue[0]);
        }
    }, [conflictQueue, currentConflict]);

    const resolveConflict = (action: 'replace' | 'skip') => {
        if (!currentConflict) return;
        
        let newRecord: CvDatabaseRecord | null = null;
        if (action === 'replace') {
            newRecord = {
                ...currentConflict.newRecord,
                createdAt: new Date().toISOString(),
            };
            setCvDatabase(prevDb => {
                const dbMap = new Map(prevDb.map(c => [c.email, c]));
                dbMap.set(newRecord!.email, newRecord!);
                return Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
            toast({ description: `Record for ${newRecord.name} was replaced.` });
        } else {
             toast({ description: `Upload for ${currentConflict.newRecord.name} was skipped.` });
        }
        
        const newQueue = conflictQueue.slice(1);
        setConflictQueue(newQueue);
        setCurrentConflict(newQueue[0] || null);
        
        if (newRecord) {
            handleNewCandidatesAdded([newRecord]);
        }
    };

    useEffect(() => {
        if (cvDatabase.length === 0 && history.length === 0) return;
        try {
            const params = new URLSearchParams(window.location.search);
            const emailToOpen = params.get('email');
            if (emailToOpen) {
                const cvToOpen = cvDatabase.find(cv => cv.email === emailToOpen);
                if (cvToOpen) {
                    setSelectedCv(cvToOpen);
                    // Clean up the URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        } catch (error) {
            console.error("Failed to process URL parameters", error);
        }
    }, [cvDatabase, history]);
    

    const runRelevanceCheck = useCallback(async (candidatesToCheck: CvDatabaseRecord[]) => {
        if (history.length === 0 || candidatesToCheck.length === 0) {
            toast({ variant: 'destructive', title: "Cannot Run Check", description: "There are no jobs or candidates to check." });
            return;
        }
        
        toast({ description: `Checking for suitable positions for ${candidatesToCheck.length} candidate(s)...` });

        try {
            let allNewPositions: SuitablePosition[] = [];
            for (const candidate of candidatesToCheck) {
                const result = await findSuitablePositionsForCandidate({
                    candidates: [candidate],
                    assessmentSessions: history,
                    existingSuitablePositions: suitablePositions
                });
                if (result.newlyFoundPositions.length > 0) {
                    allNewPositions.push(...result.newlyFoundPositions);
                }
            }
            
            if (allNewPositions.length > 0) {
                setSuitablePositions(prev => {
                    const existingSet = new Set(prev.map(p => `${p.candidateEmail}-${p.assessment.id}`));
                    const uniqueNewPositions = allNewPositions.filter(p => !existingSet.has(`${p.candidateEmail}-${p.assessment.id}`));
                    return [...prev, ...uniqueNewPositions];
                });
                toast({
                    title: "New Opportunities Found!",
                    description: `Found ${allNewPositions.length} new relevant position(s). Check the notifications panel.`,
                });
            } else {
                 toast({ description: `No new relevant positions found for the selected candidate(s).` });
            }
        } catch (error: any) {
            console.error(`Relevance check failed:`, error);
            toast({ variant: 'destructive', title: "Relevance Check Failed", description: error.message });
        }
    }, [history, suitablePositions, toast, setSuitablePositions]);

    const handleNewCandidatesAdded = useCallback((newCandidates: CvDatabaseRecord[]) => {
        runRelevanceCheck(newCandidates);
    }, [runRelevanceCheck]);

    
    const toTitleCase = (str: string): string => {
        if (!str) return '';
        return str
          .toLowerCase()
          .split(/[\s-]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
    }

    const handleCvUpload = (files: UploadedFile[]) => {
        setCvsToUpload(prev => [...prev, ...files]);
    };

    const handleCvClear = () => {
        setCvsToUpload([]);
    };
    
    const isProcessing = useMemo(() => Object.values(processingStatus).some(s => s.status === 'processing'), [processingStatus]);

    const handleProcessCvs = useCallback(async () => {
        if (cvsToUpload.length === 0) {
            toast({ variant: 'destructive', description: 'Please upload at least one CV.' });
            return;
        }
        const currentJobCode = jobCode;
        if (!currentJobCode) {
            toast({ variant: 'destructive', description: 'Please select a job code.' });
            return;
        }

        const filesToProcess = [...cvsToUpload];
        setCvsToUpload([]);
        setCvResetKey(key => key + 1);

        const newStatus = filesToProcess.reduce((acc, cv) => {
            if (!processingStatus[cv.name]) {
                acc[cv.name] = { status: 'processing', message: cv.name };
            }
            return acc;
        }, {} as CvProcessingStatus);
        setProcessingStatus(prev => ({ ...prev, ...newStatus }));

        const dbEmails = new Map(cvDatabase.map(c => [c.email, c]));
        let successCount = 0;
        const newConflicts: Conflict[] = [];
        const newRecords: CvDatabaseRecord[] = [];

        for (const cv of filesToProcess) {
            try {
                const parsedData = await parseCv({ cvText: cv.content });
                
                const existingRecord = dbEmails.get(parsedData.email);
                if (existingRecord) {
                    newConflicts.push({
                        newRecord: {
                            ...parsedData,
                            jobCode: currentJobCode,
                            cvFileName: cv.name,
                            cvContent: cv.content,
                            name: toTitleCase(parsedData.name),
                        },
                        existingRecord,
                    });
                    setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: parsedData.name } }));
                } else {
                    const record: CvDatabaseRecord = {
                        ...parsedData,
                        jobCode: currentJobCode,
                        cvFileName: cv.name,
                        cvContent: cv.content,
                        createdAt: new Date().toISOString(),
                        name: toTitleCase(parsedData.name),
                    };
                    
                    setCvDatabase(prevDb => {
                        const dbMap = new Map(prevDb.map(c => [c.email, c]));
                        dbMap.set(record.email, record);
                        return Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    });
                    dbEmails.set(record.email, record);
                    newRecords.push(record);
                    successCount++;
                    setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: record.name } }));
                }
            } catch (error: any) {
                console.error(`Failed to parse ${cv.name}:`, error);
                toast({ variant: 'destructive', title: `Parsing Failed for ${cv.name}`, description: error.message });
                setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'error', message: cv.name } }));
            }
        }
        
        if (successCount > 0) {
            toast({ description: `${successCount} new CV(s) processed and added to the database.` });
        }
        if (newConflicts.length > 0) {
            setConflictQueue(prev => [...prev, ...newConflicts]);
            toast({
                title: `${newConflicts.length} Conflict(s) Detected`,
                description: "Some CVs match existing records. Please resolve the conflicts.",
            });
        }
        
        if (newRecords.length > 0) {
            handleNewCandidatesAdded(newRecords);
        }

    }, [cvsToUpload, jobCode, toast, processingStatus, cvDatabase, handleNewCandidatesAdded, setCvDatabase]);
    
    const handleDeleteCv = (emailsToDelete: string[]) => {
        if (emailsToDelete.length === 0) return;

        const emailsToDeleteSet = new Set(emailsToDelete.map(e => e.toLowerCase()));
        
        setCvDatabase(prev => prev.filter(cv => !emailsToDeleteSet.has(cv.email.toLowerCase())));

        setHistory(prevHistory => {
            return prevHistory.map(session => {
                const updatedCandidates = session.candidates.filter(candidate => {
                    const candidateEmail = candidate.analysis.email?.toLowerCase();
                    if (candidateEmail) {
                        return !emailsToDeleteSet.has(candidateEmail);
                    }
                    const dbRecord = cvDatabase.find(cv => cv.name.toLowerCase() === candidate.analysis.candidateName.toLowerCase());
                    if (dbRecord) {
                        return !emailsToDeleteSet.has(dbRecord.email.toLowerCase());
                    }
                    return true;
                });
                return { ...session, candidates: updatedCandidates, summary: updatedCandidates.length > 0 ? session.summary : null };
            });
        });
        
        setSelectedCvEmails(new Set());

        toast({
            description: `${emailsToDelete.length} candidate record(s) deleted from the database and all assessments.`,
        });
    };

    const handleQuickAddToAssessment = useCallback(async (positions: SuitablePosition[]) => {
        if (positions.length === 0) return;
    
        const { assessment } = positions[0];
        const candidateDbRecords = positions.map(p => cvDatabase.find(c => c.email === p.candidateEmail)).filter(Boolean) as CvDatabaseRecord[];

        if (candidateDbRecords.length === 0) {
            toast({ variant: 'destructive', description: "Could not find candidate records in the database." });
            return;
        }
        
        // Set active session in localStorage and navigate.
        // The assessment page will handle the actual processing on load.
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id);
        const pendingItems = candidateDbRecords.map(candidate => ({ candidate, assessment }));
        localStorage.setItem(PENDING_ASSESSMENT_KEY, JSON.stringify(pendingItems));
        
        // Clear handled notifications
        const handledEmails = new Set(positions.map((p: { candidateEmail: any; }) => p.candidateEmail));
        setSuitablePositions(prev => prev.filter(p => !(p.assessment.id === assessment.id && handledEmails.has(p.candidateEmail))));
        
        // Navigate
        window.location.href = '/assessment';

    }, [cvDatabase, setSuitablePositions, toast]);
    
    const handleAddFromPopover = useCallback(async (candidate: CvDatabaseRecord, assessment: AssessmentSession, closePopover: () => void) => {
        closePopover();
        const position: SuitablePosition = {
            candidateEmail: candidate.email,
            candidateName: candidate.name,
            assessment,
        };
        await handleQuickAddToAssessment([position]);
    }, [handleQuickAddToAssessment]);

    useEffect(() => {
        const hasFinishedTasks = Object.values(processingStatus).some(s => s.status === 'done' || s.status === 'error');
        if (hasFinishedTasks && !isProcessing) {
            const cleanupTimeout = setTimeout(() => {
                setProcessingStatus(prev => {
                    const newStatus: CvProcessingStatus = {};
                    for (const key in prev) {
                        if (prev[key].status === 'processing') {
                            newStatus[key] = prev[key];
                        }
                    }
                    return newStatus;
                });
            }, 3000);

            return () => clearTimeout(cleanupTimeout);
        }
    }, [processingStatus, isProcessing]);
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedCvEmails(new Set(sortedAndFilteredCvs.map(cv => cv.email)));
        } else {
            setSelectedCvEmails(new Set());
        }
    };

    const handleSelectOne = (email: string, checked: boolean) => {
        setSelectedCvEmails(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(email);
            } else {
                newSet.delete(email);
            }
            return newSet;
        });
    };
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header
                activePage="cv-database"
                onQuickAdd={handleQuickAddToAssessment}
            />
            <main className="flex-1 p-4 md:p-6">
                <div className="container mx-auto space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><FileUp /> Add New Candidates</CardTitle>
                            <CardDescription>Upload CVs and tag them with a job code to add them to the central database. If a candidate&apos;s email already exists, you will be asked to confirm the replacement.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                            <div className="grid md:grid-cols-3 gap-6 items-end">
                                <div className="md:col-span-2">
                                    <FileUploader
                                        key={cvResetKey}
                                        id="cv-db-uploader"
                                        label="Upload CV Files"
                                        acceptedFileTypes=".pdf,.docx,.txt"
                                        onFileUpload={handleCvUpload}
                                        onFileClear={handleCvClear}
                                        multiple
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <label className="text-sm font-medium">Job Code</label>
                                    <Select value={jobCode || ''} onValueChange={(v) => setJobCode(v as JobCode)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a job code..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OCN">OCN</SelectItem>
                                            <SelectItem value="WEX">WEX</SelectItem>
                                            <SelectItem value="SAN">SAN</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {Object.keys(processingStatus).length > 0 && (
                                <div className="mt-4">
                                  <ProgressLoader title="Processing CVs..." statusList={Object.values(processingStatus)} />
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                             <Button onClick={handleProcessCvs} disabled={(cvsToUpload.length === 0 || !jobCode) && !isProcessing} size="lg">
                                {isProcessing ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                ) : (
                                    <><Bot className="mr-2 h-4 w-4" /> {Object.keys(processingStatus).length > 0 ? 'Add to Queue' : 'Process & Add to Database'}</>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><Database/> Candidate Records ({cvDatabase.length})</CardTitle>
                             <div className="flex justify-between items-center gap-4 pt-2">
                                <CardDescription>Browse, search, and manage all candidates in the database.</CardDescription>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="relative w-full max-w-xs">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Search database..."
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    {selectedCvEmails.size > 0 && (
                                        <BulkActions
                                            toast={toast}
                                            selectedEmails={Array.from(selectedCvEmails)}
                                            candidates={cvDatabase}
                                            assessments={history}
                                            onDelete={handleDeleteCv}
                                            onAddToAssessment={handleQuickAddToAssessment}
                                            onClear={() => setSelectedCvEmails(new Set())}
                                        />
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="border-t">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12 px-4">
                                                <Checkbox
                                                  checked={selectedCvEmails.size > 0 && selectedCvEmails.size === sortedAndFilteredCvs.length}
                                                  indeterminate={selectedCvEmails.size > 0 && selectedCvEmails.size < sortedAndFilteredCvs.length}
                                                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                                />
                                            </TableHead>
                                            <TableHead className="w-12">Status</TableHead>
                                            <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted">
                                                <div className="flex items-center gap-2">Name <ArrowUpDown className="h-3 w-3" /></div>
                                            </TableHead>
                                            <TableHead>Current Position</TableHead>
                                            <TableHead onClick={() => handleSort('totalExperience')} className="cursor-pointer hover:bg-muted">
                                                <div className="flex items-center gap-2">Experience <ArrowUpDown className="h-3 w-3" /></div>
                                            </TableHead>
                                            <TableHead>Job Code</TableHead>
                                            <TableHead onClick={() => handleSort('createdAt')} className="cursor-pointer hover:bg-muted">
                                                <div className="flex items-center gap-2">Date Added <ArrowUpDown className="h-3 w-3" /></div>
                                            </TableHead>
                                            <TableHead className="text-right pr-4">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedAndFilteredCvs.length > 0 ? sortedAndFilteredCvs.map(cv => {
                                            const candidateAssessments = assessmentMap.get(cv.email.toLowerCase()) || [];
                                            const count = candidateAssessments.length;
                                            return (
                                                <TableRow 
                                                  key={cv.email}
                                                  data-state={selectedCvEmails.has(cv.email) ? 'selected' : ''}
                                                  className="hover:bg-muted/50"
                                                >
                                                    <TableCell className="px-4">
                                                        <Checkbox
                                                            checked={selectedCvEmails.has(cv.email)}
                                                            onCheckedChange={(checked) => handleSelectOne(cv.email, !!checked)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Popover>
                                                            <PopoverTrigger asChild disabled={count === 0} onClick={(e) => e.stopPropagation()}>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className={cn("flex items-center", count > 0 && "cursor-pointer")}>
                                                                                <span className={cn("text-2xl", count > 0 ? "text-green-500" : "text-muted-foreground")}>•</span>
                                                                                {count > 0 && <sup className="font-bold text-xs -ml-1 text-muted-foreground">{count}</sup>}
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>{count > 0 ? `${count} assessment(s)` : 'Not assessed'}</p></TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </PopoverTrigger>
                                                            {count > 0 && (
                                                                <PopoverContent className="w-96 p-2">
                                                                    <div className="space-y-1 mb-2 p-2">
                                                                        <h4 className="font-medium leading-none">Assessments for {cv.name}</h4>
                                                                        <p className="text-sm text-muted-foreground">Quick links to view assessments.</p>
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto">
                                                                        {candidateAssessments.map(a => (
                                                                            <a key={a.sessionId} href="/assessment" onClick={(e) => { e.preventDefault(); localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, a.sessionId); window.location.href = '/assessment'; }}>
                                                                                <div className="p-2 rounded-md hover:bg-secondary flex justify-between items-center">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-semibold text-sm truncate">{a.jobTitle}</span>
                                                                                        <span className="text-xs text-muted-foreground truncate">{a.sessionName}</span>
                                                                                    </div>
                                                                                    <Badge variant={a.score >= 75 ? "default" : a.score >= 40 ? "secondary" : "destructive"}>{a.score}%</Badge>
                                                                                </div>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                </PopoverContent>
                                                            )}
                                                        </Popover>
                                                    </TableCell>
                                                    <TableCell className="font-medium text-primary truncate cursor-pointer hover:underline" title={cv.name} onClick={() => setSelectedCv(cv)}>
                                                        {cv.name}
                                                    </TableCell>
                                                    <TableCell className="truncate" title={cv.currentTitle || 'N/A'}>
                                                        {cv.currentTitle || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>{cv.totalExperience || 'N/A'}</TableCell>
                                                    <TableCell><Badge variant="outline">{cv.jobCode}</Badge></TableCell>
                                                    <TableCell>{new Date(cv.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right pr-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                             <AddCandidatePopover
                                                                candidate={cv}
                                                                assessments={assessmentMap.get(cv.email.toLowerCase()) || []}
                                                                allAssessments={history}
                                                                onAdd={handleAddFromPopover}
                                                            />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent><p>Delete Candidate</p></TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This action cannot be undone. This will permanently delete the record for <span className="font-bold">{cv.name}</span> and remove them from all assessments.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteCv([cv.email])} className={cn(Button, "bg-destructive hover:bg-destructive/90")}>
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                                    {cvDatabase.length > 0 ? "No candidates found matching your search." : "No candidates in the database yet."}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
            
            <Sheet open={!!selectedCv} onOpenChange={(isOpen) => { if (!isOpen) setSelectedCv(null); }}>
                {selectedCv && (
                    <SheetContent className="w-full sm:max-w-3xl p-0">
                        <ScrollArea className="h-full">
                            <SheetHeader className="p-6 pr-10">
                                <SheetTitle className="text-2xl">{selectedCv.name}</SheetTitle>
                                <SheetDescription>
                                    {selectedCv.currentTitle} at {selectedCv.currentCompany}
                                </SheetDescription>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-2">
                                    <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4"/>{selectedCv.email}</div>
                                    <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4"/>{selectedCv.contactNumber || 'N/A'}</div>
                                    {selectedCv.linkedinUrl && <div className="flex items-center gap-2 text-muted-foreground"><Linkedin className="w-4 h-4"/><a href={selectedCv.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">LinkedIn Profile</a></div>}
                                </div>
                            </SheetHeader>
                            <div className="px-6 pb-6">
                                <CvDisplay structuredContent={selectedCv.structuredContent} />
                            </div>
                        </ScrollArea>
                    </SheetContent>
                )}
            </Sheet>

            <Dialog open={!!currentConflict} onOpenChange={(isOpen) => { if (!isOpen) setCurrentConflict(null); }}>
                {currentConflict && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Replace Existing Candidate?</DialogTitle>
                            <DialogDescription>
                                A candidate with the email <span className="font-bold text-foreground">{currentConflict.existingRecord.email}</span> already exists. Do you want to replace the existing record with the new CV you&apos;ve uploaded?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 text-sm my-4">
                            <div className="p-3 border rounded-md">
                                <h4 className="font-semibold mb-2">Existing Record</h4>
                                <p className="truncate" title={currentConflict.existingRecord.cvFileName}><span className="text-muted-foreground">File:</span> {currentConflict.existingRecord.cvFileName}</p>
                                <p><span className="text-muted-foreground">Added:</span> {new Date(currentConflict.existingRecord.createdAt).toLocaleDateString()}</p>
                                <p><span className="text-muted-foreground">Code:</span> <Badge variant="secondary">{currentConflict.existingRecord.jobCode}</Badge></p>
                            </div>
                            <div className="p-3 border rounded-md bg-amber-50 border-amber-200">
                                <h4 className="font-semibold mb-2 text-amber-900">New Upload</h4>
                                <p className="truncate" title={currentConflict.newRecord.cvFileName}><span className="text-amber-800/80">File:</span> {currentConflict.newRecord.cvFileName}</p>
                                <p><span className="text-amber-800/80">Uploading:</span> {new Date().toLocaleDateString()}</p>
                                <p><span className="text-amber-800/80">Code:</span> <Badge>{currentConflict.newRecord.jobCode}</Badge></p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => resolveConflict('skip')}>Skip This CV</Button>
                            <Button onClick={() => resolveConflict('replace')} className="bg-amber-500 hover:bg-amber-600">Replace Record</Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}

const AddCandidatePopover = ({ candidate, assessments, allAssessments, onAdd }: {
    candidate: CvDatabaseRecord;
    assessments: CandidateAssessmentInfo[];
    allAssessments: AssessmentSession[];
    onAdd: (candidate: CvDatabaseRecord, assessment: AssessmentSession, closePopover: () => void) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const compatibleAssessments = useMemo(() => {
        const assessedSessionIds = new Set(assessments.map(a => a.sessionId));
        return allAssessments.filter(session =>
            session.analyzedJd.JobCode === candidate.jobCode && !assessedSessionIds.has(session.id)
        );
    }, [candidate, assessments, allAssessments]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Add to an assessment</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-80 p-2">
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Add <span className="text-primary">{candidate.name}</span> to...</h4>
                        <p className="text-sm text-muted-foreground">
                            Showing compatible assessments.
                        </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {compatibleAssessments.length > 0 ? (
                            compatibleAssessments.map(session => (
                                <button
                                    key={session.id}
                                    onClick={() => onAdd(candidate, session, () => setIsOpen(false))}
                                    className="w-full text-left p-2 rounded-md hover:bg-secondary flex flex-col"
                                >
                                    <span className="font-medium truncate">{session.analyzedJd.JobTitle}</span>
                                    <span className="text-xs text-muted-foreground">{session.jdName}</span>
                                </button>
                            ))
                        ) : (
                            <p className="p-2 text-sm text-center text-muted-foreground">No compatible unassessed positions found.</p>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
    
const BulkActions = ({ toast, selectedEmails, candidates, assessments, onDelete, onAddToAssessment, onClear }: {
    toast: any;
    selectedEmails: string[];
    candidates: CvDatabaseRecord[];
    assessments: AssessmentSession[];
    onDelete: (emails: string[]) => void;
    onAddToAssessment: (positions: SuitablePosition[]) => void;
    onClear: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const selectedCount = selectedEmails.length;
    const selectedCandidates = candidates.filter(c => selectedEmails.includes(c.email));
    
    const commonAssessments = useMemo(() => {
        if (selectedCandidates.length === 0) return [];
        
        const firstCandidateJobCode = selectedCandidates[0].jobCode;
        if (!selectedCandidates.every(c => c.jobCode === firstCandidateJobCode)) {
            return [];
        }
        
        return assessments.filter(session => {
            if (session.analyzedJd.JobCode !== firstCandidateJobCode) return false;
            
            const sessionEmails = new Set(session.candidates.map(c => c.analysis.email?.toLowerCase()).filter(Boolean));
            return !selectedCandidates.some(sel => sessionEmails.has(sel.email.toLowerCase()));
        });

    }, [selectedCandidates, assessments]);

    const handleBulkAdd = (assessment: AssessmentSession) => {
        const positionsToAdd: SuitablePosition[] = selectedCandidates.map(c => ({
            candidateEmail: c.email,
            candidateName: c.name,
            assessment,
        }));
        onAddToAssessment(positionsToAdd);
        onClear();
        setIsOpen(false);
    };

    return (
        <div className="flex items-center gap-2 border-l pl-2">
            <span className="text-sm font-medium">{selectedCount} selected</span>
            
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Add to Assessment</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <h4 className="font-medium leading-none">Add {selectedCount} Candidates to...</h4>
                            <p className="text-sm text-muted-foreground">
                                {commonAssessments.length > 0 
                                    ? "Showing assessments compatible with all selected candidates." 
                                    : "Selected candidates have mixed job codes or are already in all compatible assessments."}
                            </p>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {commonAssessments.length > 0 ? (
                                commonAssessments.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleBulkAdd(session)}
                                        className="w-full text-left p-2 rounded-md hover:bg-secondary flex flex-col"
                                    >
                                        <span className="font-medium truncate">{session.analyzedJd.JobTitle}</span>
                                        <span className="text-xs text-muted-foreground">{session.jdName}</span>
                                    </button>
                                ))
                            ) : (
                                <p className="p-2 text-sm text-center text-muted-foreground">No common assessments found.</p>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the selected {selectedCount} candidate(s) and remove them from all assessments. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(selectedEmails)} className={cn(Button, "bg-destructive hover:bg-destructive/90")}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
                <X className="h-4 w-4"/>
            </Button>
        </div>
    );
};