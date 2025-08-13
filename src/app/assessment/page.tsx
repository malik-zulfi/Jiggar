"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Briefcase,
  Users,
  Lightbulb,
  History,
  Trash2,
  RefreshCw,
  UserPlus,
  Database,
  Search,
  Plus,
  ArrowLeft,
  Wand2,
  AlertTriangle,
  Edit3,
} from "lucide-react";

import type {
  CandidateSummaryOutput,
  ExtractJDCriteriaOutput,
  AssessmentSession,
  CandidateRecord,
  CvDatabaseRecord,
  SuitablePosition,
  AlignmentDetail,
  ParseCvOutput,
  Requirement,
  AnalyzeCVAgainstJDOutput,
} from "@/lib/types";
import { analyzeCVAgainstJD } from "@/ai/flows/cv-analyzer";
import { extractJDCriteria } from "@/ai/flows/jd-analyzer";
import { summarizeCandidateAssessments } from "@/ai/flows/candidate-summarizer";
import { parseCv } from "@/ai/flows/cv-parser";

import { Header } from "@/components/header";
import JdAnalysis from "@/components/jd-analysis";
import CandidateCard from "@/components/candidate-card";
import SummaryDisplay from "@/components/summary-display";
import FileUploader from "@/components/file-uploader";
import ProgressLoader from "@/components/progress-loader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/components/client-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from "uuid";

const ACTIVE_SESSION_STORAGE_KEY = "jiggar-active-session";
const PENDING_ASSESSMENT_KEY = "jiggar-pending-assessment";

type UploadedFile = { name: string; content: string };
type CvProcessingStatus = Record<
  string,
  {
    status: "processing" | "done" | "error";
    fileName: string;
    candidateName?: string;
  }
>;
type ReassessStatus = Record<
  string,
  { status: "processing" | "done" | "error"; candidateName: string }
>;
type ReplacementPrompt = {
  isOpen: boolean;
  existingSession: AssessmentSession | null;
  newJd: ExtractJDCriteriaOutput | null;
};
type JobCode = "OCN" | "WEX" | "SAN";
type Priority = "MUST_HAVE" | "NICE_TO_HAVE";

function AssessmentPage() {
  const {
    history,
    setHistory,
    cvDatabase,
    setCvDatabase,
    suitablePositions,
    setSuitablePositions,
  } = useAppContext();
  const { toast } = useToast();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );

  const [jdFile, setJdFile] = useState<UploadedFile | null>(null);
  const [cvs, setCvs] = useState<UploadedFile[]>([]);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [jdAnalysisProgress, setJdAnalysisProgress] = useState<{
    steps: string[];
    currentStepIndex: number;
  } | null>(null);
  const [newCvProcessingStatus, setNewCvProcessingStatus] =
    useState<CvProcessingStatus>({});
  const [reassessStatus, setReassessStatus] = useState<ReassessStatus>({});
  const [summaryProgress, setSummaryProgress] = useState<{
    steps: string[];
    currentStepIndex: number;
  } | null>(null);

  const [isJdAnalysisOpen, setIsJdAnalysisOpen] = useState(true);
  const [isAddFromDbOpen, setIsAddFromDbOpen] = useState(false);
  const [replacementPrompt, setReplacementPrompt] = useState<ReplacementPrompt>(
    { isOpen: false, existingSession: null, newJd: null }
  );
  const [editingCandidate, setEditingCandidate] =
    useState<CandidateRecord | null>(null);
  const [jobCodePrompt, setJobCodePrompt] = useState<{
    isOpen: boolean;
    callback: (code: JobCode) => void;
  }>({ isOpen: false, callback: () => {} });
  const [emailPrompt, setEmailPrompt] = useState<{
    isOpen: boolean;
    candidateName?: string;
    fileName: string;
    resolve: (email: string) => void;
    reject: (reason?: any) => void;
  } | null>(null);

  

  const activeSession = useMemo(
    () => history.find((s) => s.id === activeSessionId),
    [history, activeSessionId]
  );

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) {
      return history;
    }
    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    return history.filter((session) => {
      if (!session || !session.analyzedJd) return false;

      const jd = session.analyzedJd;
      const titleMatch = jd.JobTitle?.toLowerCase().includes(lowerCaseQuery);
      const nameMatch = session.jdName?.toLowerCase().includes(lowerCaseQuery);
      const codeMatch = jd.JobCode?.toLowerCase().includes(lowerCaseQuery);
      const gradeMatch = jd.PayGrade?.toLowerCase().includes(lowerCaseQuery);
      const departmentMatch =
        jd.Department?.toLowerCase().includes(lowerCaseQuery);

      return (
        nameMatch || titleMatch || codeMatch || gradeMatch || departmentMatch
      );
    });
  }, [history, searchQuery]);

  const newCvStatusList = useMemo(() => {
    const statuses = Object.values(newCvProcessingStatus);
    if (statuses.length === 0) return null;

    return statuses.map((item) => ({
      status: item.status,
      message: item.candidateName || item.fileName,
    }));
  }, [newCvProcessingStatus]);

  const reassessStatusList = useMemo(() => {
    const statuses = Object.values(reassessStatus);
    if (statuses.length === 0) return null;

    return statuses.map((item) => ({
      status: item.status,
      message: item.candidateName,
    }));
  }, [reassessStatus]);

  useEffect(() => {
    const statuses = Object.values(newCvProcessingStatus);
    if (
      statuses.length > 0 &&
      statuses.every((s) => s.status === "done" || s.status === "error")
    ) {
      const timer = setTimeout(() => {
        setNewCvProcessingStatus({});
        setCvs([]);
        setCvResetKey((key) => key + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newCvProcessingStatus]);

  const addOrUpdateCvInDatabase = useCallback(
    (parsedCv: CvDatabaseRecord) => {
      setCvDatabase((prevDb) => {
        const existingCvIndex = prevDb.findIndex(
          (c) => c.email.toLowerCase() === parsedCv.email.toLowerCase()
        );
        if (existingCvIndex !== -1) {
          const updatedDb = [...prevDb];
          updatedDb[existingCvIndex] = parsedCv;
          return updatedDb;
        } else {
          return [...prevDb, parsedCv];
        }
      });
    },
    [setCvDatabase]
  );

  const processAndAnalyzeCandidates = useCallback(
    async (
      candidatesToProcess: UploadedFile[],
      jd: ExtractJDCriteriaOutput,
      sessionId: string | null,
      jobCode: string | null | undefined
    ) => {
      if (!jobCode || !["OCN", "WEX", "SAN"].includes(jobCode)) {
        setTimeout(() => {
          toast({
            variant: "destructive",
            title: "Invalid Job Code",
            description:
              "A valid job code (OCN, WEX, or SAN) is required to save new candidates.",
          });
        }, 0);
        return;
      }

      const initialStatus = candidatesToProcess.reduce((acc, cv) => {
        acc[cv.name] = {
          status: "processing",
          fileName: cv.name,
          candidateName: cv.name,
        };
        return acc;
      }, {} as CvProcessingStatus);
      setNewCvProcessingStatus(initialStatus);

      let successCount = 0;
      let finalCandidateRecords: CandidateRecord[] = [];

      setTimeout(() => {
        toast({
          description: `Assessing ${candidatesToProcess.length} candidate(s)... This may take a moment.`,
        });
      }, 0);

      for (const cvFile of candidatesToProcess) {
        try {
          let parsedCvData: ParseCvOutput | null = null;

          try {
            parsedCvData = await parseCv({ cvText: cvFile.content });
          } catch (parseError: any) {
            setTimeout(() => {
              toast({
                variant: "destructive",
                title: `CV Parsing Warning: ${cvFile.name}`,
                description: `Could not reliably parse all CV data. Assessment will proceed with raw text.`,
              });
            }, 0);
          }

          // If email is missing, we prompt the user for it.
          if (!parsedCvData || !parsedCvData.email?.trim()) {
            try {
              const userProvidedEmail = await new Promise<string>(
                (resolve, reject) => {
                  setEmailPrompt({
                    isOpen: true,
                    candidateName: parsedCvData?.name,
                    fileName: cvFile.name,
                    resolve,
                    reject,
                  });
                }
              );

              // User provided an email, let's update the data and proceed.
              if (parsedCvData) {
                parsedCvData.email = userProvidedEmail;
              } else {
                // This case happens if the whole CV parsing failed.
                // We create a minimal object to proceed.
                const fallbackData: ParseCvOutput = {
                  name: cvFile.name, // Use filename as a fallback name
                  email: userProvidedEmail,
                  structuredContent: {},
                };
                parsedCvData = fallbackData;
              }
              setEmailPrompt(null); // Close the dialog
            } catch (error) {
              // User cancelled.
              setEmailPrompt(null);
              setTimeout(() => {
                toast({
                  variant: "destructive",
                  title: `Assessment Skipped for ${cvFile.name}`,
                  description: "An email address was not provided.",
                });
              }, 0);
              setNewCvProcessingStatus((prev) => ({
                ...prev,
                [cvFile.name]: { ...prev[cvFile.name], status: "error" },
              }));
              continue; // Skip to the next file.
            }
          }

          const dbRecord: CvDatabaseRecord = {
            ...parsedCvData,
            jobCode: jobCode as JobCode,
            cvFileName: cvFile.name,
            cvContent: cvFile.content,
            createdAt: new Date().toISOString(),
          };
          addOrUpdateCvInDatabase(dbRecord);

          const analysis: AnalyzeCVAgainstJDOutput = await analyzeCVAgainstJD({
            jobDescriptionCriteria: jd,
            cv: cvFile.content,
            parsedCv: parsedCvData,
          });

          const candidateRecord: CandidateRecord = {
            cvName: cvFile.name,
            cvContent: cvFile.content,
            analysis: analysis,
            isStale: false,
          };
          finalCandidateRecords.push(candidateRecord);

          setNewCvProcessingStatus((prev) => ({
            ...prev,
            [cvFile.name]: {
              ...prev[cvFile.name],
              status: "done",
              candidateName: analysis.candidateName,
            },
          }));
          successCount++;
        } catch (error: any) {
          console.error(`Error analyzing CV for ${cvFile.name}:`, error);
          setTimeout(() => {
            toast({
              variant: "destructive",
              title: `Analysis Failed for ${cvFile.name}`,
              description: error.message || "An unexpected error occurred.",
            });
          }, 0);
          setNewCvProcessingStatus((prev) => ({
            ...prev,
            [cvFile.name]: { ...prev[cvFile.name], status: "error" },
          }));
        }
      }

      if (finalCandidateRecords.length > 0) {
        setHistory((prev) =>
          prev.map((session) => {
            if (session.id === sessionId) {
              const existingEmails = new Set(
                session.candidates
                  .map((c) => c.analysis.email?.toLowerCase())
                  .filter(Boolean)
              );

              const newUniqueCandidates = finalCandidateRecords.filter((c) => {
                const newEmail = c.analysis.email?.toLowerCase();
                // Allow adding candidates without email, but check for duplicates if email exists
                return newEmail ? !existingEmails.has(newEmail) : true;
              });

              if (newUniqueCandidates.length < finalCandidateRecords.length) {
                setTimeout(() => {
                  toast({
                    variant: "destructive",
                    description: `Some candidates already existed in this session and were skipped.`,
                  });
                }, 0);
              }

              if (newUniqueCandidates.length > 0) {
                const allCandidates = [
                  ...session.candidates,
                  ...newUniqueCandidates,
                ];
                allCandidates.sort(
                  (a, b) =>
                    b.analysis.alignmentScore - a.analysis.alignmentScore
                );
                return { ...session, candidates: allCandidates, summary: null };
              }
            }
            return session;
          })
        );
      }

      if (successCount > 0) {
        setTimeout(() => {
          toast({
            description: `${successCount} candidate(s) have been successfully assessed.`,
          });
        }, 0);
      }
    },
    [toast, addOrUpdateCvInDatabase, setHistory]
  );

  useEffect(() => {
    const processPendingAssessments = () => {
      const intendedSessionId = localStorage.getItem(
        ACTIVE_SESSION_STORAGE_KEY
      );
      const pendingAssessmentJSON = localStorage.getItem(
        PENDING_ASSESSMENT_KEY
      );

      try {
        setHistory((currentHistory) => {
          let sessionToActivate = null;
          if (intendedSessionId) {
            sessionToActivate = currentHistory.find(
              (s) => s.id === intendedSessionId
            );
            setActiveSessionId(sessionToActivate ? sessionToActivate.id : null);
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
          }

          if (pendingAssessmentJSON) {
            const pendingItems: {
              candidate: CvDatabaseRecord;
              assessment: AssessmentSession;
            }[] = JSON.parse(pendingAssessmentJSON);
            if (Array.isArray(pendingItems) && pendingItems.length > 0) {
              const firstItem = pendingItems[0];
              const assessment = currentHistory.find(
                (s) => s.id === firstItem.assessment.id
              );

              if (assessment) {
                const uploadedFiles: UploadedFile[] = pendingItems.map(
                  (item) => ({
                    name: item.candidate.cvFileName,
                    content: item.candidate.cvContent,
                  })
                );
                processAndAnalyzeCandidates(
                  uploadedFiles,
                  assessment.analyzedJd,
                  assessment.id,
                  assessment.analyzedJd.JobCode
                );
              }
            }
            localStorage.removeItem(PENDING_ASSESSMENT_KEY);
          }
          return currentHistory;
        });
      } catch (error) {
        console.error(
          "Failed to process pending state from localStorage",
          error
        );
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        localStorage.removeItem(PENDING_ASSESSMENT_KEY);
      }
    };

    // Defer execution until after the initial render cycle is complete.
    const timer = setTimeout(() => {
      processPendingAssessments();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuickAddToAssessment = useCallback(
    async (positions: SuitablePosition[]) => {
      if (positions.length === 0) return;

      const { assessment } = positions[0];
      const candidateDbRecords = positions
        .map((p) => cvDatabase.find((c) => c.email === p.candidateEmail))
        .filter(Boolean) as CvDatabaseRecord[];

      if (candidateDbRecords.length === 0) {
        toast({
          variant: "destructive",
          description: "Could not find candidate records in the database.",
        });
        return;
      }

      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id);
      const pendingItems = candidateDbRecords.map((candidate) => ({
        candidate,
        assessment,
      }));
      localStorage.setItem(
        PENDING_ASSESSMENT_KEY,
        JSON.stringify(pendingItems)
      );

      const handledEmails = new Set(
        positions.map((p: { candidateEmail: any }) => p.candidateEmail)
      );
      setSuitablePositions((prev) =>
        prev.filter(
          (p) =>
            !(
              p.assessment.id === assessment.id &&
              handledEmails.has(p.candidateEmail)
            )
        )
      );

      window.location.href = "/assessment";
    },
    [cvDatabase, toast, setSuitablePositions]
  );

  const handleNewSession = () => {
    setActiveSessionId(null);
    setJdFile(null);
    setIsJdAnalysisOpen(false);
    setCvs([]);
    setCvResetKey((key) => key + 1);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedHistory = history.filter((s) => s.id !== sessionId);
    setHistory(updatedHistory);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
    toast({ description: "Assessment deleted." });
  };

  const handleReplaceJd = () => {
    const { existingSession, newJd } = replacementPrompt;
    if (!existingSession || !newJd) return;

    setHistory((prev) =>
      prev.map((s) => {
        if (s.id === existingSession.id) {
          return {
            ...s,
            analyzedJd: newJd,
            candidates: s.candidates.map((c) => ({ ...c, isStale: true })),
            summary: null,
          };
        }
        return s;
      })
    );
    setActiveSessionId(existingSession.id);
    setIsJdAnalysisOpen(true);
    toast({
      description: `Replaced JD for "${newJd.JobTitle}". Existing candidates marked for re-assessment.`,
    });
    setReplacementPrompt({ isOpen: false, existingSession: null, newJd: null });
  };

  const handleJdUpload = async (files: UploadedFile[]) => {
    if (files.length === 0) return;

    const jdFile = files[0];
    setJdFile(jdFile);

    const steps = [
      "Initializing analysis engine...",
      "Parsing job description document...",
      "Extracting key responsibilities...",
      "Extracting technical skill requirements...",
      "Analyzing soft skill criteria...",
      "Categorizing requirements by priority...",
      "Finalizing analysis...",
    ];
    setJdAnalysisProgress({ steps, currentStepIndex: 0 });
    let simulationInterval: NodeJS.Timeout | null = setInterval(() => {
      setJdAnalysisProgress((prev) => {
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
    }, 600);

    try {
      const result = await extractJDCriteria({
        jobDescription: jdFile.content,
      });

      if (simulationInterval) clearInterval(simulationInterval);
      setJdAnalysisProgress((prev) =>
        prev ? { ...prev, currentStepIndex: steps.length } : null
      );
      await new Promise((resolve) => setTimeout(resolve, 500));

      const existingSession = history.find(
        (s) =>
          s.analyzedJd.JobTitle &&
          result.JobTitle &&
          s.analyzedJd.JobTitle === result.JobTitle
      );

      if (existingSession) {
        setReplacementPrompt({ isOpen: true, existingSession, newJd: result });
        return;
      }

      const newSession: AssessmentSession = {
        id: new Date().toISOString() + Math.random(),
        jdName: jdFile.name,
        analyzedJd: result,
        candidates: [],
        summary: null,
        createdAt: new Date().toISOString(),
      };
      setHistory([newSession, ...history]);
      setActiveSessionId(newSession.id);
      setIsJdAnalysisOpen(true);
      toast({ description: "Job Description analyzed successfully." });
    } catch (error: any) {
      console.error("Error analyzing JD:", error);
      toast({
        variant: "destructive",
        title: "Analysis Error",
        description:
          error.message ||
          "An unexpected error occurred. Please check the console.",
      });
    } finally {
      if (simulationInterval) clearInterval(simulationInterval);
      setJdAnalysisProgress(null);
      setJdFile(null);
    }
  };

  const handleJdClear = () => {
    setJdFile(null);
  };

  const handleCvUpload = (files: UploadedFile[]) => {
    setCvs(files);
  };

  const handleCvClear = () => {
    setCvs([]);
  };

  const reAssessCandidates = async (
    jd: ExtractJDCriteriaOutput,
    candidatesToReassess: CandidateRecord[]
  ) => {
    if (!candidatesToReassess || candidatesToReassess.length === 0) return;

    const initialStatus: ReassessStatus = candidatesToReassess.reduce(
      (acc, candidate) => {
        acc[candidate.analysis.candidateName] = {
          status: "processing",
          candidateName: candidate.analysis.candidateName,
        };
        return acc;
      },
      {} as ReassessStatus
    );
    setReassessStatus(initialStatus);
    let updatedCandidates: CandidateRecord[] = [];
    let successCount = 0;

    try {
      toast({
        description: `Re-assessing ${candidatesToReassess.length} candidate(s)...`,
      });

      for (const candidate of candidatesToReassess) {
        try {
          const dbRecord = cvDatabase.find(
            (cv) =>
              cv.email.toLowerCase() === candidate.analysis.email?.toLowerCase()
          );

          const analysis = await analyzeCVAgainstJD({
            jobDescriptionCriteria: jd,
            cv: candidate.cvContent,
            parsedCv: dbRecord || null,
          });

          updatedCandidates.push({
            ...candidate,
            analysis,
            isStale: false,
          });
          setReassessStatus((prev) => ({
            ...prev,
            [candidate.analysis.candidateName]: {
              ...prev[candidate.analysis.candidateName],
              status: "done",
            },
          }));
          successCount++;
        } catch (error: any) {
          console.error(
            `Error re-assessing CV for ${candidate.analysis.candidateName}:`,
            error
          );
          toast({
            variant: "destructive",
            title: `Re-assessment Failed for ${candidate.analysis.candidateName}`,
            description:
              error.message ||
              "An unexpected error occurred. Please check the console.",
          });
          setReassessStatus((prev) => ({
            ...prev,
            [candidate.analysis.candidateName]: {
              ...prev[candidate.analysis.candidateName],
              status: "error",
            },
          }));
          updatedCandidates.push(candidate);
        }
      }

      setHistory((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const updatedCandidatesMap = new Map(
              updatedCandidates.map((c) => [c.analysis.candidateName, c])
            );
            const newFullCandidateList = s.candidates.map(
              (candidate) =>
                updatedCandidatesMap.get(candidate.analysis.candidateName) ||
                candidate
            );

            newFullCandidateList.sort(
              (a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore
            );

            return {
              ...s,
              candidates: newFullCandidateList,
              summary: null,
            };
          }
          return s;
        })
      );
      if (successCount > 0) {
        toast({ description: "Candidates have been re-assessed." });
      }
    } catch (error: any) {
      console.error("Error re-assessing CVs:", error);
      toast({
        variant: "destructive",
        title: "Re-assessment Error",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setTimeout(() => {
        setReassessStatus({});
      }, 3000);
    }
  };

  const handleReassessClick = async () => {
    if (!activeSession || !activeSession.analyzedJd) return;

    const candidatesToProcess =
      selectedCandidates.size > 0
        ? activeSession.candidates.filter((c) =>
            selectedCandidates.has(c.analysis.candidateName)
          )
        : activeSession.candidates;

    if (candidatesToProcess.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Re-assess",
        description: "There are no candidates in this session to re-assess.",
      });
      return;
    }
    await reAssessCandidates(activeSession.analyzedJd, candidatesToProcess);
    setSelectedCandidates(new Set());
  };

  const handleAnalyzeCvs = async () => {
    if (cvs.length === 0) {
      toast({
        variant: "destructive",
        description: "Please upload one or more CV files.",
      });
      return;
    }
    if (!activeSession) {
      toast({
        variant: "destructive",
        description: "Please analyze a Job Description first.",
      });
      return;
    }

    const startAnalysis = (code: JobCode) => {
      // Update session if needed
      setHistory((prev) =>
        prev.map((s) => {
          if (s.id === activeSession.id && s.analyzedJd.JobCode !== code) {
            return { ...s, analyzedJd: { ...s.analyzedJd, JobCode: code } };
          }
          return s;
        })
      );
      processAndAnalyzeCandidates(
        cvs,
        { ...activeSession.analyzedJd, JobCode: code },
        activeSessionId,
        code
      );
    };

    if (
      activeSession.analyzedJd.JobCode &&
      activeSession.analyzedJd.JobCode !== "Not Found"
    ) {
      startAnalysis(activeSession.analyzedJd.JobCode as JobCode);
    } else {
      setJobCodePrompt({ isOpen: true, callback: startAnalysis });
    }
  };

  const handleAnalyzeFromDb = useCallback(
    async (selectedCvsFromDb: CvDatabaseRecord[]) => {
      if (selectedCvsFromDb.length === 0) return;
      if (!activeSession?.analyzedJd) return;

      // Filter out candidates already in the session
      const sessionEmails = new Set(
        activeSession.candidates
          .map((c) => c.analysis.email?.toLowerCase())
          .filter(Boolean)
      );
      const newCvsToAdd = selectedCvsFromDb.filter(
        (cv) => !sessionEmails.has(cv.email.toLowerCase())
      );

      if (newCvsToAdd.length < selectedCvsFromDb.length) {
        toast({
          variant: "destructive",
          description:
            "Some selected candidates are already in this session and were skipped.",
        });
      }

      if (newCvsToAdd.length === 0) {
        setIsAddFromDbOpen(false);
        return;
      }

      const uploadedFiles: UploadedFile[] = newCvsToAdd.map((cv) => ({
        name: cv.cvFileName,
        content: cv.cvContent,
      }));

      // Assuming the job code for DB candidates matches their record
      const jobCode = newCvsToAdd[0]?.jobCode;
      await processAndAnalyzeCandidates(
        uploadedFiles,
        activeSession.analyzedJd,
        activeSessionId,
        jobCode
      );
      setIsAddFromDbOpen(false);
    },
    [activeSession, processAndAnalyzeCandidates, toast, activeSessionId]
  );

  const handleGenerateSummary = async () => {
    if (
      !activeSession ||
      activeSession.candidates.length === 0 ||
      !activeSession.analyzedJd
    )
      return;

    const steps = [
      "Initializing summary engine...",
      "Reviewing all candidate assessments...",
      "Identifying common strengths across pool...",
      "Pinpointing common weaknesses and gaps...",
      "Categorizing candidates into tiers...",
      "Formulating interview strategy...",
      "Finalizing summary report...",
    ];
    setSummaryProgress({ steps, currentStepIndex: 0 });
    let simulationInterval: NodeJS.Timeout | null = setInterval(() => {
      setSummaryProgress((prev) => {
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
    }, 600);

    try {
      const candidateAssessments = activeSession.candidates.map(
        (c) => c.analysis
      );
      const result = await summarizeCandidateAssessments({
        jobDescriptionCriteria: activeSession.analyzedJd,
        candidateAssessments,
      });

      if (simulationInterval) clearInterval(simulationInterval);
      setSummaryProgress((prev) =>
        prev ? { ...prev, currentStepIndex: steps.length } : null
      );
      await new Promise((resolve) => setTimeout(resolve, 500));

      setHistory((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            return { ...session, summary: result };
          }
          return session;
        })
      );

      toast({ description: "Candidate summary generated." });
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast({
        variant: "destructive",
        title: "Summary Error",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      if (simulationInterval) clearInterval(simulationInterval);
      setSummaryProgress(null);
    }
  };

  const handleToggleSelectCandidate = (candidateName: string) => {
    setSelectedCandidates((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(candidateName)) {
        newSelection.delete(candidateName);
      } else {
        newSelection.add(candidateName);
      }
      return newSelection;
    });
  };

  const handleDeleteCandidate = (candidateNameToDelete: string) => {
    if (!activeSessionId) return;

    setHistory((prev) =>
      prev.map((session) => {
        if (session.id === activeSessionId) {
          const updatedCandidates = session.candidates.filter(
            (c) => c.analysis.candidateName !== candidateNameToDelete
          );
          return {
            ...session,
            candidates: updatedCandidates,
            summary: null,
          };
        }
        return session;
      })
    );

    setSelectedCandidates((prev) => {
      const newSelection = new Set(prev);
      newSelection.delete(candidateNameToDelete);
      return newSelection;
    });

    toast({
      description: `Candidate "${candidateNameToDelete}" has been removed.`,
    });
  };

  const handleRequirementChange = (
    category:
      | keyof ExtractJDCriteriaOutput["Requirements"]
      | "Responsibilities",
    reqId: string,
    newPriority: Priority
  ) => {
    if (!activeSession) return;

    setHistory((prevHistory) => {
      return prevHistory.map((session) => {
        if (session.id !== activeSessionId) return session;

        const newJd = { ...session.analyzedJd };
        let requirementFoundAndMoved = false;

        const processCategory = (
          cat:
            | { MUST_HAVE: Requirement[]; NICE_TO_HAVE: Requirement[] }
            | undefined
        ) => {
          if (!cat) return;

          const sourcePriority =
            newPriority === "MUST_HAVE" ? "NICE_TO_HAVE" : "MUST_HAVE";
          const sourceArray = cat[sourcePriority];
          const targetArray = cat[newPriority];

          const reqIndex = sourceArray.findIndex((r) => r.id === reqId);
          if (reqIndex > -1) {
            const [reqToMove] = sourceArray.splice(reqIndex, 1);
            reqToMove.priority = newPriority;
            reqToMove.score = newPriority === "MUST_HAVE" ? 10 : 5; // Reset score to default for new priority
            targetArray.push(reqToMove);
            requirementFoundAndMoved = true;
          }
        };

        const categoriesToSearch = [
          newJd.Responsibilities,
          newJd.Requirements.TechnicalSkills,
          newJd.Requirements.SoftSkills,
          newJd.Requirements.Education,
          newJd.Requirements.Certifications,
          newJd.Requirements.AdditionalRequirements,
          {
            MUST_HAVE: [],
            NICE_TO_HAVE: newJd.Requirements.Experience.NICE_TO_HAVE,
          },
        ];

        for (const cat of categoriesToSearch) {
          processCategory(cat as any);
          if (requirementFoundAndMoved) break;
        }

        if (requirementFoundAndMoved) {
          toast({
            description: `Requirement priority updated. Candidates marked for re-assessment.`,
          });
          return {
            ...session,
            analyzedJd: newJd,
            candidates: session.candidates.map((c) => ({
              ...c,
              isStale: true,
            })),
            summary: null,
          };
        }

        return session;
      });
    });
  };

  const handleScoreChange = (
    category:
      | keyof ExtractJDCriteriaOutput["Requirements"]
      | "Responsibilities",
    priority: Priority,
    reqId: string,
    newScore: number
  ) => {
    if (!activeSession) return;

    setHistory((prevHistory) => {
      return prevHistory.map((session) => {
        if (session.id !== activeSessionId) return session;

        const newJd = { ...session.analyzedJd };
        let requirementFound = false;

        const findAndUpdate = (reqs: Requirement[] | undefined) => {
          if (!reqs) return;
          const req = reqs.find((r) => r.id === reqId);
          if (req) {
            req.score = newScore;
            requirementFound = true;
          }
        };

        const categoriesToSearch: (
          | { MUST_HAVE: Requirement[]; NICE_TO_HAVE: Requirement[] }
          | undefined
        )[] = [
          newJd.Responsibilities,
          newJd.Requirements.TechnicalSkills,
          newJd.Requirements.SoftSkills,
          newJd.Requirements.Education,
          newJd.Requirements.Certifications,
          newJd.Requirements.AdditionalRequirements,
        ];

        for (const cat of categoriesToSearch) {
          if (cat) findAndUpdate((cat as any)[priority]);
          if (requirementFound) break;
        }

        if (!requirementFound && priority === "NICE_TO_HAVE") {
          findAndUpdate(newJd.Requirements.Experience.NICE_TO_HAVE);
        }

        if (requirementFound) {
          toast({
            description: `Score updated. Candidates marked for re-assessment.`,
          });
          return {
            ...session,
            analyzedJd: newJd,
            candidates: session.candidates.map((c) => ({
              ...c,
              isStale: true,
            })),
            summary: null,
          };
        }
        return session;
      });
    });
  };

  const handleAddRequirement = (
    description: string,
    priority: Priority,
    score: number
  ) => {
    if (!activeSession) return;

    setHistory((prevHistory) => {
      const updatedHistory = prevHistory.map((session) => {
        if (session.id !== activeSessionId) {
          return session;
        }

        // Deep clone the session to avoid mutation issues
        const updatedSession = JSON.parse(JSON.stringify(session));

        const newRequirement: Requirement = {
          id: uuidv4(),
          description,
          priority,
          score,
          originalPriority: priority,
          originalScore: score,
          isUserAdded: true,
        };

        if (!updatedSession.analyzedJd.Requirements.AdditionalRequirements) {
          updatedSession.analyzedJd.Requirements.AdditionalRequirements = {
            MUST_HAVE: [],
            NICE_TO_HAVE: [],
          };
        }

        updatedSession.analyzedJd.Requirements.AdditionalRequirements[
          priority
        ].push(newRequirement);

        updatedSession.candidates = updatedSession.candidates.map(
          (c: CandidateRecord) => ({ ...c, isStale: true })
        );
        updatedSession.summary = null;

        return updatedSession;
      });
      return updatedHistory;
    });

    toast({
      description: `Added new requirement. Candidates marked for re-assessment.`,
    });
  };

  const handleDeleteRequirement = (reqId: string) => {
    if (!activeSession) return;

    setHistory((prevHistory) => {
      const updatedHistory = prevHistory.map((session) => {
        if (session.id !== activeSessionId) return session;

        const updatedSession = JSON.parse(JSON.stringify(session));
        const additionalReqs =
          updatedSession.analyzedJd.Requirements.AdditionalRequirements;

        if (additionalReqs) {
          additionalReqs.MUST_HAVE = additionalReqs.MUST_HAVE.filter(
            (r: Requirement) => r.id !== reqId
          );
          additionalReqs.NICE_TO_HAVE = additionalReqs.NICE_TO_HAVE.filter(
            (r: Requirement) => r.id !== reqId
          );
        }

        updatedSession.candidates = updatedSession.candidates.map(
          (c: CandidateRecord) => ({ ...c, isStale: true })
        );
        updatedSession.summary = null;

        return updatedSession;
      });
      return updatedHistory;
    });

    toast({
      description: `Requirement deleted. Candidates marked for re-assessment.`,
    });
  };

  

  

  const handleCandidateScoreUpdate = (
    candidateName: string,
    newAlignmentDetails: AlignmentDetail[]
  ) => {
    if (!activeSession) return;

    setHistory((prevHistory) => {
      return prevHistory.map((session) => {
        if (session.id !== activeSessionId) return session;

        const candidateIndex = session.candidates.findIndex(
          (c) => c.analysis.candidateName === candidateName
        );
        if (candidateIndex === -1) return session;

        const updatedCandidates = [...session.candidates];
        const candidateToUpdate = updatedCandidates[candidateIndex];

        const newCandidateScore = newAlignmentDetails.reduce(
          (acc, detail) => acc + (detail.score || 0),
          0
        );
        const maxScore = newAlignmentDetails.reduce(
          (acc, detail) => acc + (detail.maxScore || 0),
          0
        );
        const newAlignmentScore =
          maxScore > 0
            ? parseFloat(((newCandidateScore / maxScore) * 100).toFixed(2))
            : 0;

        let newRecommendation: AnalyzeCVAgainstJDOutput["recommendation"];
        if (newAlignmentScore >= 85) {
          newRecommendation = "Strongly Recommended";
        } else if (newAlignmentScore >= 60) {
          newRecommendation = "Recommended with Reservations";
        } else {
          newRecommendation = "Not Recommended";
        }

        const updatedAlignmentDetails = newAlignmentDetails.map((newDetail) => {
          const originalDetail =
            candidateToUpdate.analysis.alignmentDetails.find(
              (d) =>
                d.requirement === newDetail.requirement &&
                d.category === newDetail.category
            );
          const wasEdited =
            originalDetail &&
            (originalDetail.score !== newDetail.score ||
              originalDetail.status !== newDetail.status);
          return {
            ...newDetail,
            isEdited: wasEdited || originalDetail?.isEdited,
          };
        });

        const updatedAnalysis: AnalyzeCVAgainstJDOutput = {
          ...candidateToUpdate.analysis,
          alignmentDetails: updatedAlignmentDetails,
          candidateScore: newCandidateScore,
          alignmentScore: newAlignmentScore,
          recommendation: newRecommendation,
          isEdited: true,
        };

        updatedCandidates[candidateIndex] = {
          ...candidateToUpdate,
          analysis: updatedAnalysis,
          isStale: false,
        };
        updatedCandidates.sort(
          (a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore
        );

        toast({
          description: `Scores for ${candidateName} have been updated.`,
        });

        return { ...session, candidates: updatedCandidates, summary: null };
      });
    });
    setEditingCandidate(null);
  };

  const acceptedFileTypes = ".pdf,.docx,.txt";
  const isAssessingNewCvs = Object.keys(newCvProcessingStatus).length > 0;
  const isReassessing = Object.keys(reassessStatus).length > 0;
  const reassessButtonText =
    selectedCandidates.size > 0
      ? `Re-assess Selected (${selectedCandidates.size})`
      : "Re-assess All";

  const showReviewSection =
    (activeSession?.candidates?.length ?? 0) > 0 ||
    isAssessingNewCvs ||
    isReassessing;
  const showSummarySection =
    (activeSession?.candidates?.length ?? 0) > 0 &&
    !isAssessingNewCvs &&
    !isReassessing;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <Header activePage="assessment" onQuickAdd={handleQuickAddToAssessment} />
      <main className="flex-1 p-4 md:p-6">
        <div className="container mx-auto space-y-6">
          <AlertDialog
            open={replacementPrompt.isOpen}
            onOpenChange={(isOpen) =>
              !isOpen &&
              setReplacementPrompt({
                isOpen: false,
                existingSession: null,
                newJd: null,
              })
            }
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Duplicate Position Found</AlertDialogTitle>
                <AlertDialogDescription>
                  An assessment for{" "}
                  <span className="font-bold">
                    {replacementPrompt.existingSession?.analyzedJd.JobTitle}
                  </span>{" "}
                  already exists. Do you want to replace the old Job Description
                  with this new one? Existing candidates will be kept and marked
                  as stale for re-assessment.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() =>
                    setReplacementPrompt({
                      isOpen: false,
                      existingSession: null,
                      newJd: null,
                    })
                  }
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleReplaceJd}>
                  Replace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <JobCodeDialog
            isOpen={jobCodePrompt.isOpen}
            onClose={() =>
              setJobCodePrompt({ isOpen: false, callback: () => {} })
            }
            onConfirm={jobCodePrompt.callback}
          />

          {!activeSession ? (
            <div className="space-y-6">
              {jdAnalysisProgress ? (
                <div className="p-8">
                  <ProgressLoader
                    title="Analyzing Job Description..."
                    steps={jdAnalysisProgress.steps}
                    currentStepIndex={jdAnalysisProgress.currentStepIndex}
                  />
                </div>
              ) : (
                <Card className="shadow-sm border-dashed border-2">
                  <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 text-primary rounded-full p-3 w-fit">
                      <Briefcase className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-xl pt-2">
                      Start a New Assessment
                    </CardTitle>
                    <CardDescription>
                      Upload or drop a Job Description (JD) file below to begin
                      analysis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <FileUploader
                      id="jd-uploader"
                      label="Job Description"
                      acceptedFileTypes={acceptedFileTypes}
                      onFileUpload={handleJdUpload}
                      onFileClear={handleJdClear}
                    />
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History /> Past Assessments
                  </CardTitle>
                  <CardDescription>
                    Select a past assessment to view or continue working on it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search assessments by title, name, code..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((session) => (
                        <Card
                          key={session.id}
                          className="hover:shadow-lg hover:border-primary/60 transition-all cursor-pointer flex flex-col bg-white dark:bg-card rounded-lg overflow-hidden"
                          onClick={() => setActiveSessionId(session.id)}
                        >
                          <CardHeader className="flex-1 p-4 bg-primary/5">
                            <CardTitle className="text-base font-semibold truncate">
                              {session.analyzedJd.PositionNumber &&
                              session.analyzedJd.PositionNumber !== "Not Found"
                                ? `${session.analyzedJd.PositionNumber} - `
                                : ""}
                              {session.analyzedJd.JobTitle || session.jdName}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1.5 text-xs pt-1">
                              <Users className="h-3.5 w-3.5" />{" "}
                              {session.candidates.length} Candidate(s)
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 flex-1">
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              {session.analyzedJd.JobCode &&
                                session.analyzedJd.JobCode !== "Not Found" && (
                                  <Badge variant="secondary">
                                    {session.analyzedJd.JobCode}
                                  </Badge>
                                )}
                              {session.analyzedJd.Department &&
                                session.analyzedJd.Department !==
                                  "Not Found" && (
                                  <Badge variant="secondary">
                                    {session.analyzedJd.Department}
                                  </Badge>
                                )}
                              {session.analyzedJd.PayGrade &&
                                session.analyzedJd.PayGrade !== "Not Found" && (
                                  <Badge variant="secondary">
                                    Grade {session.analyzedJd.PayGrade}
                                  </Badge>
                                )}
                            </div>
                          </CardContent>
                          <CardFooter className="p-3 bg-gray-50 dark:bg-card/80 border-t flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive transition-colors" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-full text-center text-muted-foreground py-12">
                        <p>
                          {history.length > 0
                            ? "No matching assessments found."
                            : "No assessments yet."}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <Button
                variant="outline"
                onClick={() => setActiveSessionId(null)}
                className="mb-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to all assessments
              </Button>

              <JdAnalysis
                analysis={activeSession.analyzedJd}
                isOpen={isJdAnalysisOpen}
                onOpenChange={setIsJdAnalysisOpen}
                onRequirementChange={handleRequirementChange}
                onScoreChange={handleScoreChange}
                onAddRequirement={handleAddRequirement}
                onDeleteRequirement={handleDeleteRequirement}
              />

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserPlus /> Step 2: Add Candidates
                  </CardTitle>
                  <CardDescription>
                    Upload new CVs or add candidates from your database to
                    assess them against this job description. Job Code:{" "}
                    <Badge variant="secondary">
                      {activeSession.analyzedJd.JobCode || "Not Set"}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-8 items-start">
                    <FileUploader
                      key={cvResetKey}
                      id="cv-uploader"
                      label="Upload CVs"
                      acceptedFileTypes={acceptedFileTypes}
                      onFileUpload={handleCvUpload}
                      onFileClear={handleCvClear}
                      multiple={true}
                    />
                    <div className="space-y-4 pt-8">
                      <Button
                        onClick={handleAnalyzeCvs}
                        disabled={
                          cvs.length === 0 || isAssessingNewCvs || isReassessing
                        }
                        className="w-full text-base py-6"
                      >
                        {isAssessingNewCvs ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        {isAssessingNewCvs
                          ? "Assessing..."
                          : `Add & Assess ${
                              cvs.length > 0 ? `(${cvs.length})` : ""
                            }`}
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex justify-center">
                    <Dialog
                      open={isAddFromDbOpen}
                      onOpenChange={setIsAddFromDbOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Database className="mr-2 h-4 w-4" />
                          Add from Database
                        </Button>
                      </DialogTrigger>
                      <AddFromDbDialog
                        allCvs={cvDatabase}
                        jobCode={activeSession.analyzedJd.JobCode}
                        sessionCandidates={activeSession.candidates}
                        onAdd={handleAnalyzeFromDb}
                      />
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              {showReviewSection && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users /> Step 3: Review Candidates
                        </CardTitle>
                        <CardDescription className="truncate">
                          {isAssessingNewCvs
                            ? "Assessing new candidates..."
                            : isReassessing
                            ? "Re-assessing candidates..."
                            : "Review assessments, or re-assess candidates."}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {activeSession.candidates.length > 0 &&
                          !isAssessingNewCvs && (
                            <Button
                              variant="outline"
                              onClick={handleReassessClick}
                              disabled={isReassessing}
                            >
                              {isReassessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              {isReassessing
                                ? "Re-assessing..."
                                : reassessButtonText}
                            </Button>
                          )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {(reassessStatusList || newCvStatusList) && (
                      <div className="mb-4">
                        <ProgressLoader
                          title={
                            isReassessing
                              ? "Re-assessing Candidate(s)"
                              : "Assessing New Candidate(s)"
                          }
                          statusList={reassessStatusList || newCvStatusList!}
                        />
                      </div>
                    )}

                    {activeSession.candidates.length > 0 && (
                      <div
                        className={cn(
                          isReassessing && "opacity-60 pointer-events-none"
                        )}
                      >
                        <Accordion
                          type="single"
                          collapsible
                          className="w-full space-y-2"
                        >
                          {activeSession.candidates.map((c, i) => (
                            <CandidateCard
                              key={`${c.analysis.candidateName}-${i}`}
                              candidate={c}
                              isStale={c.isStale}
                              isSelected={selectedCandidates.has(
                                c.analysis.candidateName
                              )}
                              onToggleSelect={() =>
                                handleToggleSelectCandidate(
                                  c.analysis.candidateName
                                )
                              }
                              onDelete={() =>
                                handleDeleteCandidate(c.analysis.candidateName)
                              }
                              onEdit={() => setEditingCandidate(c)}
                              isEdited={c.analysis.isEdited}
                            />
                          ))}
                        </Accordion>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {showSummarySection && (
                <>
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Lightbulb /> Step 4: Generate Summary
                      </CardTitle>
                      <CardDescription>
                        Create a summary report of all assessed candidates with
                        a suggested interview strategy.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      {summaryProgress ? (
                        <ProgressLoader
                          title="Generating Summary..."
                          steps={summaryProgress.steps}
                          currentStepIndex={summaryProgress.currentStepIndex}
                        />
                      ) : (
                        <Button
                          onClick={handleGenerateSummary}
                          disabled={!!activeSession.summary}
                          size="lg"
                        >
                          <Wand2 className="mr-2 h-5 w-5" />
                          {activeSession.summary
                            ? "Summary Generated"
                            : "Generate Summary"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {activeSession.summary && !summaryProgress && (
                <SummaryDisplay
                  summary={activeSession.summary}
                  candidates={activeSession.candidates.map((c) => c.analysis)}
                  analyzedJd={activeSession.analyzedJd}
                />
              )}
              <EditScoreDialog
                candidate={editingCandidate}
                isOpen={!!editingCandidate}
                onClose={() => setEditingCandidate(null)}
                onSave={handleCandidateScoreUpdate}
              />
              <EmailPromptDialog
                isOpen={!!emailPrompt}
                onClose={() =>
                  emailPrompt?.reject(new Error("User cancelled email input."))
                }
                onConfirm={(email) => emailPrompt?.resolve(email)}
                candidateName={emailPrompt?.candidateName}
                fileName={emailPrompt?.fileName || ""}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const AddFromDbDialog = ({
  allCvs,
  jobCode,
  sessionCandidates,
  onAdd,
}: {
  allCvs: CvDatabaseRecord[];
  jobCode?: string;
  sessionCandidates: CandidateRecord[];
  onAdd: (selectedCvs: CvDatabaseRecord[]) => void;
}) => {
  const [selectedCvs, setSelectedCvs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const compatibleCvs = useMemo(() => {
    if (!jobCode || jobCode === "Not Found") return [];
    return allCvs.filter((cv) => cv.jobCode === jobCode);
  }, [allCvs, jobCode]);

  const filteredCvs = useMemo(() => {
    if (!searchTerm.trim()) return compatibleCvs;
    const lowerSearch = searchTerm.toLowerCase();
    return compatibleCvs.filter(
      (cv) =>
        cv.name.toLowerCase().includes(lowerSearch) ||
        cv.email.toLowerCase().includes(lowerSearch) ||
        cv.currentTitle?.toLowerCase().includes(lowerSearch)
    );
  }, [compatibleCvs, searchTerm]);

  const sessionCandidateEmails = useMemo(
    () =>
      new Set(
        sessionCandidates
          .map((c) => c.analysis.email?.toLowerCase())
          .filter(Boolean)
      ),
    [sessionCandidates]
  );

  const handleSelect = (email: string) => {
    setSelectedCvs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  const handleAddClick = () => {
    const cvsToAdd = compatibleCvs.filter((cv) => selectedCvs.has(cv.email));
    onAdd(cvsToAdd);
    setSelectedCvs(new Set());
  };

  if (!jobCode || jobCode === "Not Found") {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cannot Add from Database</DialogTitle>
          <DialogDescription>
            The current Job Description does not have a valid job code (e.g.,
            OCN, WEX, or SAN). A valid code must be extracted from the JD before
            adding candidates from the database.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Add Candidates from Database</DialogTitle>
        <DialogDescription>
          Select candidates from the database with job code{" "}
          <Badge>{jobCode}</Badge> to add to this assessment. Candidates already
          in this session are disabled.
        </DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or title..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <ScrollArea className="h-96 border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Current Position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCvs.length > 0 ? (
              filteredCvs.map((cv) => {
                const isInSession = sessionCandidateEmails.has(
                  cv.email.toLowerCase()
                );
                return (
                  <TableRow
                    key={cv.email}
                    className={cn(
                      isInSession && "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedCvs.has(cv.email)}
                        onCheckedChange={() => handleSelect(cv.email)}
                        disabled={isInSession}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{cv.name}</TableCell>
                    <TableCell>{cv.email}</TableCell>
                    <TableCell>{cv.currentTitle || "N/A"}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No compatible candidates found in the database.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button onClick={handleAddClick} disabled={selectedCvs.size === 0}>
          Add Selected ({selectedCvs.size})
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const JobCodeDialog = ({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (code: JobCode) => void;
}) => {
  const [selectedCode, setSelectedCode] = useState<JobCode | null>(null);

  const handleConfirm = () => {
    if (selectedCode) {
      onConfirm(selectedCode);
      onClose();
      setSelectedCode(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> Job Code Required
          </DialogTitle>
          <DialogDescription>
            A valid job code could not be determined from the Job Description.
            Please select the correct code for this assessment session to
            continue.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select onValueChange={(value) => setSelectedCode(value as JobCode)}>
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
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedCode}>
            Confirm & Assess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditScoreDialog = ({
  candidate,
  isOpen,
  onClose,
  onSave,
}: {
  candidate: CandidateRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (candidateName: string, newDetails: AlignmentDetail[]) => void;
}) => {
  const [editedDetails, setEditedDetails] = useState<AlignmentDetail[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (candidate) {
      setEditedDetails(
        JSON.parse(JSON.stringify(candidate.analysis.alignmentDetails))
      );
    }
  }, [candidate]);

  const filteredAndIndexedDetails = useMemo(() => {
    const details =
      filter === "issues"
        ? editedDetails.filter(
            (d) =>
              d.status === "Partially Aligned" ||
              d.status === "Not Aligned" ||
              d.status === "Not Mentioned"
          )
        : editedDetails;

    return details.map((detail) => ({
      ...detail,
      originalIndex: editedDetails.findIndex(
        (original) =>
          original.requirement === detail.requirement &&
          original.category === detail.category
      ),
    }));
  }, [editedDetails, filter]);

  if (!candidate) return null;

  const handleScoreChange = (originalIndex: number, newScore: string) => {
    const scoreValue = parseInt(newScore, 10);
    const newDetails = [...editedDetails];
    const detail = newDetails[originalIndex];

    if (isNaN(scoreValue)) {
      newDetails[originalIndex] = { ...detail, score: 0 };
      setEditedDetails(newDetails);
      return;
    }

    const clampedScore = Math.max(
      0,
      Math.min(scoreValue, detail.maxScore || 0)
    );
    newDetails[originalIndex] = { ...detail, score: clampedScore };
    setEditedDetails(newDetails);
  };

  const handleStatusChange = (
    originalIndex: number,
    newStatus: AlignmentDetail["status"]
  ) => {
    const newDetails = [...editedDetails];
    const detail = newDetails[originalIndex];
    const maxScore = detail.maxScore || 0;

    let newScore = detail.score;
    if (newStatus === "Aligned") {
      newScore = maxScore;
    } else if (newStatus === "Partially Aligned") {
      newScore = Math.ceil(maxScore / 2);
    } else {
      newScore = 0;
    }

    newDetails[originalIndex] = {
      ...detail,
      status: newStatus,
      score: newScore,
    };
    setEditedDetails(newDetails);
  };

  const handleSave = () => {
    onSave(candidate.analysis.candidateName, editedDetails);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Edit Scores for {candidate.analysis.candidateName}
          </DialogTitle>
          <DialogDescription>
            Manually adjust scores and alignment status. The overall alignment
            score will be recalculated.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-4 py-2">
          <Label>Filter:</Label>
          <RadioGroup
            value={filter}
            onValueChange={(value) => setFilter(value as "all" | "issues")}
            className="flex items-center"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="edit-filter-all" />
              <Label htmlFor="edit-filter-all" className="font-normal">
                All
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="issues" id="edit-filter-issues" />
              <Label htmlFor="edit-filter-issues" className="font-normal">
                Issues Only
              </Label>
            </div>
          </RadioGroup>
        </div>
        <ScrollArea className="h-[60vh] pr-4">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary z-10">
              <TableRow>
                <TableHead className="w-2/5">Requirement</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndIndexedDetails.map((detail) => (
                <TableRow key={detail.originalIndex}>
                  <TableCell>
                    <p className="font-medium">{detail.requirement}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        detail.priority === "MUST_HAVE"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {detail.priority.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={detail.status}
                      onValueChange={(newStatus) =>
                        handleStatusChange(
                          detail.originalIndex,
                          newStatus as AlignmentDetail["status"]
                        )
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aligned">Aligned</SelectItem>
                        <SelectItem value="Partially Aligned">
                          Partially Aligned
                        </SelectItem>
                        <SelectItem value="Not Aligned">Not Aligned</SelectItem>
                        <SelectItem value="Not Mentioned">
                          Not Mentioned
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        type="number"
                        value={detail.score ?? ""}
                        onChange={(e) =>
                          handleScoreChange(
                            detail.originalIndex,
                            e.target.value
                          )
                        }
                        className="w-20 text-right"
                        max={detail.maxScore}
                        min={0}
                      />
                      <span>/ {detail.maxScore}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EmailPromptDialog = ({
  isOpen,
  onClose,
  onConfirm,
  candidateName,
  fileName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  candidateName?: string;
  fileName: string;
}) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onConfirm(email);
    } else {
      setError("Please enter a valid email address.");
    }
  };

  const handleClose = () => {
    setEmail("");
    setError("");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setError("");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> Email Required
          </DialogTitle>
          <DialogDescription>
            The AI could not extract an email for &quot;
            {candidateName || fileName}&quot;. Please provide it manually to
            proceed.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="email-input">Candidate Email</Label>
          <Input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="candidate@example.com"
            className={cn(error && "border-destructive")}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Skip Candidate
          </Button>
          <Button onClick={handleConfirm} disabled={!email}>
            Confirm & Assess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssessmentPage;
