"use client";

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { SuitablePosition, AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { Plus, Users, Loader2, Trash2, BellOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppContext } from '@/components/client-provider';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';

const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const PENDING_ASSESSMENT_KEY = 'jiggar-pending-assessment';

export default function NotificationsPage() {
    const { suitablePositions, setSuitablePositions, cvDatabase } = useAppContext();
    const [selectedCandidates, setSelectedCandidates] = useState<Record<string, Set<string>>>({});
    const [loadingAssessments, setLoadingAssessments] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const handleQuickAddToAssessment = useCallback((positions: SuitablePosition[]) => {
        if (positions.length === 0) return;

        const { assessment } = positions[0];
        const candidateDbRecords = positions.map(p => cvDatabase.find(c => c.email === p.candidateEmail)).filter(Boolean) as CvDatabaseRecord[];

        if (candidateDbRecords.length === 0) {
            toast({ variant: 'destructive', description: "Could not find candidate records in the database." });
            return;
        }

        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id);
        const pendingItems = candidateDbRecords.map(candidate => ({ candidate, assessment }));
        localStorage.setItem(PENDING_ASSESSMENT_KEY, JSON.stringify(pendingItems));

        const handledKeys = new Set(positions.map(p => `${p.candidateEmail}-${p.assessment.id}`));
        setSuitablePositions(prev => prev.filter(p => !handledKeys.has(`${p.candidateEmail}-${p.assessment.id}`)));
        
        window.location.href = '/assessment';
    }, [cvDatabase, setSuitablePositions, toast]);

    const handleBulkAdd = useCallback(async (assessmentId: string, candidatesInGroup: SuitablePosition[]) => {
        const selectedEmails = selectedCandidates[assessmentId] || new Set();
        if (selectedEmails.size === 0) return;

        const positionsToAdd = candidatesInGroup.filter(p => selectedEmails.has(p.candidateEmail));
        
        setLoadingAssessments(prev => new Set(prev).add(assessmentId));
        
        handleQuickAddToAssessment(positionsToAdd);
        
        setSelectedCandidates(prev => {
            const newSelections = { ...prev };
            delete newSelections[assessmentId];
            return newSelections;
        });
    }, [selectedCandidates, handleQuickAddToAssessment]);
    
    const handleToggleCandidate = (assessmentId: string, candidateEmail: string) => {
        setSelectedCandidates(prev => {
            const newSelections = { ...prev };
            const selectionForGroup = new Set(newSelections[assessmentId] || []);
            
            if (selectionForGroup.has(candidateEmail)) {
                selectionForGroup.delete(candidateEmail);
            } else {
                selectionForGroup.add(candidateEmail);
            }
            
            if (selectionForGroup.size === 0) {
                 delete newSelections[assessmentId];
            } else {
                newSelections[assessmentId] = selectionForGroup;
            }

            return newSelections;
        });
    };

    const handleToggleAll = (assessmentId: string, candidatesInGroup: SuitablePosition[], allSelected: boolean) => {
        setSelectedCandidates(prev => {
            const newSelections = { ...prev };
            if (allSelected) {
                delete newSelections[assessmentId];
            } else {
                newSelections[assessmentId] = new Set(candidatesInGroup.map(c => c.candidateEmail));
            }
            return newSelections;
        });
    };

    const groupedPositions = useMemo(() => {
        return suitablePositions.reduce((acc, pos) => {
            const { assessment } = pos;
            if (!acc[assessment.id]) {
                acc[assessment.id] = {
                    assessmentInfo: assessment,
                    candidates: [],
                };
            }
            acc[assessment.id].candidates.push(pos);
            return acc;
        }, {} as Record<string, { assessmentInfo: AssessmentSession; candidates: SuitablePosition[] }>);
    }, [suitablePositions]);

    const groupedPositionsArray = Object.values(groupedPositions).sort((a, b) => new Date(b.assessmentInfo.createdAt).getTime() - new Date(a.assessmentInfo.createdAt).getTime());

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            <Header activePage="notifications" onQuickAdd={handleQuickAddToAssessment} />
            <main className="flex-1 p-4 md:p-6">
                <div className="container mx-auto">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row justify-between items-center border-b">
                            <div>
                                <CardTitle className="text-lg">Notifications</CardTitle>
                                <CardDescription>New relevant roles found for candidates in your database.</CardDescription>
                            </div>
                            {suitablePositions.length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setSuitablePositions([])}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            {groupedPositionsArray.length > 0 ? (
                                <div className="divide-y">
                                    {groupedPositionsArray.map(({ assessmentInfo, candidates }) => {
                                        const selectedForGroup = selectedCandidates[assessmentInfo.id] || new Set();
                                        const allSelectedInGroup = selectedForGroup.size === candidates.length && candidates.length > 0;
                                        const isLoading = loadingAssessments.has(assessmentInfo.id);

                                        return (
                                            <div key={assessmentInfo.id} className="p-4 hover:bg-muted/30 transition-colors">
                                                <div className="flex justify-between items-center gap-4">
                                                    <Link 
                                                        href="/assessment" 
                                                        onClick={(e) => { e.preventDefault(); localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessmentInfo.id); window.location.href = '/assessment'; }}
                                                        className="flex-1 overflow-hidden"
                                                    >
                                                        <h5 className="font-semibold text-primary truncate hover:underline" title={assessmentInfo.analyzedJd.JobTitle}>
                                                            {assessmentInfo.analyzedJd.JobTitle}
                                                        </h5>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                            <Users className="h-4 w-4" /> {candidates.length} new suitable candidate(s)
                                                        </p>
                                                    </Link>
                                                    <Button size="sm" disabled={selectedForGroup.size === 0 || isLoading} onClick={() => handleBulkAdd(assessmentInfo.id, candidates)}>
                                                        {isLoading ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Plus className="mr-2 h-4 w-4" />
                                                        )}
                                                        Add to Assessment ({selectedForGroup.size})
                                                    </Button>
                                                </div>
                                                <div className="pl-4 mt-4 space-y-2 border-l">
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        <Checkbox
                                                            id={`select-all-${assessmentInfo.id}`}
                                                            checked={allSelectedInGroup}
                                                            onCheckedChange={() => handleToggleAll(assessmentInfo.id, candidates, allSelectedInGroup)}
                                                        />
                                                        <label htmlFor={`select-all-${assessmentInfo.id}`} className="cursor-pointer">
                                                            Select all for this assessment
                                                        </label>
                                                    </div>
                                                    {candidates.map((pos) => (
                                                        <div key={pos.candidateEmail} className="flex items-center justify-between gap-2 pl-2">
                                                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                                                <Checkbox
                                                                    id={`select-${assessmentInfo.id}-${pos.candidateEmail}`}
                                                                    checked={selectedForGroup.has(pos.candidateEmail)}
                                                                    onCheckedChange={() => handleToggleCandidate(assessmentInfo.id, pos.candidateEmail)}
                                                                />
                                                                <Link href={`/cv-database?email=${encodeURIComponent(pos.candidateEmail)}`} passHref>
                                                                    <a className="font-medium text-sm truncate hover:underline" target="_blank" rel="noopener noreferrer">
                                                                        {pos.candidateName}
                                                                    </a>
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-24">
                                    <BellOff className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-medium">All caught up!</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">You have no new notifications.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}