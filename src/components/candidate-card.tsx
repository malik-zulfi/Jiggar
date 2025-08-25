'use client';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AnalyzedCandidate, CandidateRecord } from '@/lib/types';
import {
  TrendingUp,
  Lightbulb,
  ThumbsDown,
  ThumbsUp,
  AlertTriangle,
  ClipboardCheck,
  Trash2,
  Clock,
  RefreshCw,
  Briefcase,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AlignmentTable from './alignment-table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import React from 'react';

interface CandidateCardProps {
  candidate: Omit<CandidateRecord, 'cvContent' | 'cvName'>;
  isStale?: boolean;
  isSelected?: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReassess: () => void;
  isEdited?: boolean;
}

const getRecommendationInfo = (
  recommendation: AnalyzedCandidate['recommendation']
) => {
  switch (recommendation) {
    case 'Strongly Recommended':
      return {
        icon: <ThumbsUp className="h-4 w-4" />,
        className:
          'bg-primary text-primary-foreground border-transparent hover:bg-primary/90',
      };
    case 'Recommended with Reservations':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        className:
          'bg-accent text-accent-foreground border-transparent hover:bg-accent/80',
      };
    case 'Not Recommended':
      return {
        icon: <ThumbsDown className="h-4 w-4" />,
        className:
          'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90',
      };
    default:
      return { icon: null, className: 'text-foreground border-border' };
  }
};

const getScoreBadgeClass = (score: number) => {
  if (score >= 75) {
    return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80';
  }
  if (score >= 40) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80';
  }
  return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80';
};

export default function CandidateCard({
  candidate,
  isStale,
  isSelected,
  onToggleSelect,
  onDelete,
  onEdit,
  onReassess,
  isEdited,
}: CandidateCardProps) {
  const analysis = candidate.analysis;
  const recommendationInfo = getRecommendationInfo(analysis.recommendation);

  const sortedAlignmentDetails = React.useMemo(() => {
    const desiredOrderMap: Record<string, number> = {
      education: 1,
      experience: 2,
      certifications: 3,
      technicalskills: 4,
      softskills: 5,
      additionalrequirements: 6,
      responsibilities: 7,
    };

    return [...analysis.alignmentDetails].sort((a, b) => {
      const keyA = a.category.toLowerCase().replace(/\s+/g, '');
      const keyB = b.category.toLowerCase().replace(/\s+/g, '');
      const indexA = desiredOrderMap[keyA] || 99;
      const indexB = desiredOrderMap[keyB] || 99;
      return indexA - indexB;
    });
  }, [analysis.alignmentDetails]);

  return (
    <AccordionItem
      value={analysis.candidateName}
      className="border rounded-lg overflow-hidden bg-card shadow-sm"
    >
      <AccordionPrimitive.Header className="flex w-full items-center">
        <div
          className="pl-4 py-4 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
        >
          <Checkbox
            id={`select-${analysis.candidateName}`}
            checked={isSelected}
            aria-label={`Select candidate ${analysis.candidateName}`}
          />
        </div>
        <AccordionTrigger className="flex flex-1 items-center justify-between p-4 font-medium transition-all hover:no-underline data-[state=open]:bg-muted/50">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-lg text-foreground truncate">
              {analysis.candidateName}
            </span>
            <Badge
              className={cn(
                'whitespace-nowrap font-bold',
                getScoreBadgeClass(analysis.alignmentScore),
                isEdited && 'border-amber-500'
              )}
            >
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {analysis.alignmentScore}%
                {analysis.candidateScore !== undefined &&
                  analysis.maxScore !== undefined && (
                    <span className="font-normal text-muted-foreground/80 ml-1.5">
                      ({analysis.candidateScore}/{analysis.maxScore})
                    </span>
                  )}
              </div>
            </Badge>
            {isEdited && (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-600"
              >
                Edited
              </Badge>
            )}
            {analysis.totalExperience && (
              <Badge
                variant="outline"
                className="font-normal text-muted-foreground"
              >
                <div className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {analysis.totalExperience}
                </div>
              </Badge>
            )}
            {isStale && (
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-4 w-4 text-accent animate-pulse" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>JD has changed. Re-assess for an updated score.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReassess}
                  className="h-7 text-accent border-accent hover:bg-accent/10"
                >
                  Re-assess
                </Button>
              </div>
            )}
            {analysis.processingTime && (
              <Badge
                variant="outline"
                className="font-normal text-muted-foreground"
              >
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {analysis.processingTime}s
                </div>
              </Badge>
            )}
            <Badge
              className={cn('whitespace-nowrap', recommendationInfo.className)}
            >
              <div className="flex items-center gap-2">
                {recommendationInfo.icon}
                {analysis.recommendation}
              </div>
            </Badge>
          </div>
        </AccordionTrigger>
        <div className="flex items-center gap-1 pr-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted"
            onClick={onEdit}
            aria-label="Edit candidate score"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label="Remove candidate"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </AccordionPrimitive.Header>
      <AccordionContent className="p-6 bg-muted/30 border-t">
        <div className="space-y-8">
          <div>
            <h4 className="font-semibold mb-3 flex items-center text-base">
              <ClipboardCheck className="w-5 h-5 mr-2 text-primary" /> Alignment
              Details
            </h4>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">
              {analysis.alignmentSummary}
            </p>
            <AlignmentTable details={sortedAlignmentDetails} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold mb-3 flex items-center text-base">
                <ThumbsUp className="w-5 h-5 mr-2 text-primary" /> Strengths
              </h4>
              <ul className="list-disc list-outside pl-5 space-y-2 text-sm">
                {analysis.strengths.map((s, i) => (
                  <li key={`strength-${i}`} className="text-foreground/90">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 flex items-center text-base">
                <ThumbsDown className="w-5 h-5 mr-2 text-destructive" />{' '}
                Weaknesses
              </h4>
              <ul className="list-disc list-outside pl-5 space-y-2 text-sm">
                {analysis.weaknesses.map((w, i) => (
                  <li key={`weakness-${i}`} className="text-foreground/90">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3 flex items-center text-base">
              <Lightbulb className="w-5 h-5 mr-2 text-accent" /> Interview
              Probes
            </h4>
            <ul className="list-disc list-outside pl-5 space-y-2 text-sm">
              {analysis.interviewProbes.map((p, i) => (
                <li key={`probe-${i}`} className="text-foreground/90">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
