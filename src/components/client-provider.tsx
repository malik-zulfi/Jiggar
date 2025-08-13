
"use client";

import * as React from 'react';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import type { AssessmentSession, CvDatabaseRecord, SuitablePosition } from '@/lib/types';
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import Chatbot from '@/components/chatbot';
import { useToast } from '@/hooks/use-toast';
import { findSuitablePositionsForCandidate } from '@/ai/flows/find-suitable-positions';

const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const SUITABLE_POSITIONS_KEY = 'jiggar-suitable-positions';

export type ImportMode = 'replace' | 'append';
export type ImportedData = {
    history: AssessmentSession[];
    cvDatabase: CvDatabaseRecord[];
    suitablePositions: SuitablePosition[];
};

interface AppContextType {
  history: AssessmentSession[];
  setHistory: React.Dispatch<React.SetStateAction<AssessmentSession[]>>;
  cvDatabase: CvDatabaseRecord[];
  setCvDatabase: React.Dispatch<React.SetStateAction<CvDatabaseRecord[]>>;
  suitablePositions: SuitablePosition[];
  setSuitablePositions: React.Dispatch<React.SetStateAction<SuitablePosition[]>>;
  runGlobalRelevanceCheck: () => Promise<void>;
  manualCheckStatus: 'idle' | 'loading' | 'done';
  handleBulkImport: (data: ImportedData, mode: ImportMode) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider. It seems the context is not available.');
  }
  return context;
}

export function ClientProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
  const [suitablePositions, setSuitablePositions] = useState<SuitablePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [manualCheckStatus, setManualCheckStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const { toast } = useToast();

  useEffect(() => {
    // This effect runs once on mount to load data from localStorage.
    try {
      // Load history
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateJSON && savedStateJSON !== '[]') {
        const parsedJSON = JSON.parse(savedStateJSON);
        if (Array.isArray(parsedJSON)) {
          const validHistory = parsedJSON.map(sessionData => {
            const result = AssessmentSessionSchema.safeParse(sessionData);
            return result.success ? result.data : null;
          }).filter((s): s is AssessmentSession => s !== null);
          setHistory(validHistory);
        }
      } else if (savedStateJSON === '[]') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      
      // Load CV Database
      const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
      if (savedCvDbJSON && savedCvDbJSON !== '[]') {
        const parsedCvDb = JSON.parse(savedCvDbJSON);
        if (Array.isArray(parsedCvDb)) {
          const validDb = parsedCvDb.map(record => {
            const result = CvDatabaseRecordSchema.safeParse(record);
            return result.success ? result.data : null;
          }).filter((r): r is CvDatabaseRecord => r !== null);
          setCvDatabase(validDb);
        }
      } else if (savedCvDbJSON === '[]') {
        localStorage.removeItem(CV_DB_STORAGE_KEY);
      }
      
      // Load Suitable Positions
      const savedSuitablePositions = localStorage.getItem(SUITABLE_POSITIONS_KEY);
      if (savedSuitablePositions) {
          setSuitablePositions(JSON.parse(savedSuitablePositions));
      }

    } catch (error) {
      console.error("Failed to load global state from localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // This effect runs to save data to localStorage whenever it changes.
    // It's guarded by isLoading to prevent writing empty initial state.
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
      localStorage.setItem(CV_DB_STORAGE_KEY, JSON.stringify(cvDatabase));
      localStorage.setItem(SUITABLE_POSITIONS_KEY, JSON.stringify(suitablePositions));
    }
  }, [history, cvDatabase, suitablePositions, isLoading]);
  
  const handleBulkImport = useCallback((data: ImportedData, mode: ImportMode) => {
    if (mode === 'replace') {
      setHistory(data.history || []);
      setCvDatabase(data.cvDatabase || []);
      setSuitablePositions(data.suitablePositions || []);
      setTimeout(() => {
        toast({ title: 'Import Complete', description: 'All data has been replaced.' });
      }, 0);
      return;
    }

    if (mode === 'append') {
      // Append History
      setHistory(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const newHistory = data.history.filter(s => !existingIds.has(s.id));
        return [...prev, ...newHistory];
      });
      // Append CV Database
      setCvDatabase(prev => {
        const existingEmails = new Set(prev.map(c => c.email));
        const newCvs = data.cvDatabase.filter(c => !existingEmails.has(c.email));
        return [...prev, ...newCvs];
      });
      // Append Suitable Positions
      setSuitablePositions(prev => {
        const existingKeys = new Set(prev.map(p => `${p.candidateEmail}-${p.assessment.id}`));
        const newPositions = data.suitablePositions.filter(p => !existingKeys.has(`${p.candidateEmail}-${p.assessment.id}`));
        return [...prev, ...newPositions];
      });
      setTimeout(() => {
        toast({ title: 'Import Complete', description: 'New data has been appended.' });
      }, 0);
    }
  }, [toast]);
  
  const runGlobalRelevanceCheck = useCallback(async () => {
    if (history.length === 0 || cvDatabase.length === 0) {
        setTimeout(() => {
          toast({ variant: 'destructive', title: "Cannot Run Check", description: "There are no jobs or candidates to check." });
        }, 0);
        return;
    }
    
    setManualCheckStatus('loading');
    setTimeout(() => {
      toast({ description: `Checking for suitable positions for all ${cvDatabase.length} candidate(s)...` });
    }, 0);

    try {
        let allNewPositions: SuitablePosition[] = [];
        // Check all candidates one by one to avoid overly large individual calls
        for (const candidate of cvDatabase) {
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
            setTimeout(() => {
              toast({
                  title: "New Opportunities Found!",
                  description: `Found ${allNewPositions.length} new relevant position(s). Check the notifications panel.`,
              });
            }, 0);
        } else {
             setTimeout(() => {
               toast({ description: `No new relevant positions found.` });
             }, 0);
        }
    } catch (error: any) {
        console.error(`Global relevance check failed:`, error);
        setTimeout(() => {
          toast({ variant: 'destructive', title: "Relevance Check Failed", description: error.message });
        }, 0);
    } finally {
        setManualCheckStatus('done');
        setTimeout(() => setManualCheckStatus('idle'), 3000);
    }
  }, [history, cvDatabase, suitablePositions, toast]);


  const contextValue = {
    history,
    setHistory,
    cvDatabase,
    setCvDatabase,
    suitablePositions,
    setSuitablePositions,
    runGlobalRelevanceCheck,
    manualCheckStatus,
    handleBulkImport,
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <Chatbot sessions={history} cvDatabase={cvDatabase} />
    </AppContext.Provider>
  );
}

    