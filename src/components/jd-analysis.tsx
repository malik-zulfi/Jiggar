"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExtractJDCriteriaOutput, Requirement, RequirementGroup } from "@/lib/types";
import { cn } from '@/lib/utils';
import { Briefcase, ChevronsUpDown, Building, MapPin, Calendar, Target, User, Users, Star, BrainCircuit, ListChecks, ClipboardCheck, GraduationCap, Edit3, PlusCircle, PenLine, Trash2, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';

type CategoryKey = keyof ExtractJDCriteriaOutput['Requirements'] | 'Responsibilities';
type Priority = 'MUST_HAVE' | 'NICE_TO_HAVE';

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRequirementChange: (category: CategoryKey, reqId: string, newPriority: Priority) => void;
  onScoreChange: (category: CategoryKey, priority: Priority, reqId: string, newScore: number) => void;
  onAddRequirement: (description: string, priority: Priority, score: number) => void;
  onDeleteRequirement: (reqId: string) => void;
}

const InfoBadge = ({ label, value, icon }: { label: string, value?: string, icon: React.ReactNode }) => {
    if (!value || value === "Not Found") return null;
    return (
        <Badge variant="outline" className="font-normal text-muted-foreground whitespace-nowrap">
            <div className="flex items-center gap-1.5">
                {icon}
                <span className="font-semibold mr-1">{label}:</span>
                {value}
            </div>
        </Badge>
    );
};

const RequirementItem = ({ item, category, onRequirementChange, onScoreChange, onDeleteRequirement }: {
    item: Requirement;
    category: CategoryKey;
    onRequirementChange: (category: CategoryKey, reqId: string, newPriority: Priority) => void;
    onScoreChange: (category: CategoryKey, priority: Priority, reqId: string, newScore: number) => void;
    onDeleteRequirement: (reqId: string) => void;
}) => {
    const isModified = item.priority !== item.originalPriority || item.score !== item.originalScore;
    const [localScore, setLocalScore] = useState(item.score.toString());

    useEffect(() => {
        setLocalScore(item.score.toString());
    }, [item.score]);
    
    const handleScoreBlur = () => {
        const newScore = parseInt(localScore, 10);
        if (!isNaN(newScore) && newScore !== item.score) {
            onScoreChange(category, item.priority, item.id, newScore);
        } else {
            setLocalScore(item.score.toString()); // Revert if invalid
        }
    };
    
    const handleToggle = () => {
        const newPriority = item.priority === 'MUST_HAVE' ? 'NICE_TO_HAVE' : 'MUST_HAVE';
        onRequirementChange(category, item.id, newPriority);
    };

    return (
         <li className={cn(
            "flex items-center gap-2 md:gap-4 justify-between p-2 rounded-md hover:bg-background/50",
            isModified && "ring-1 ring-amber-500/50 bg-amber-50/20"
        )}>
            <div className="flex items-start gap-2 flex-1">
                {isModified && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="text-amber-500 pt-0.5">
                                    <Edit3 className="w-4 h-4" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>This requirement has been modified.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                <span className={cn("flex-1", !isModified && "ml-6")}>{item.description}</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                 <Input 
                    type="number" 
                    value={localScore}
                    onChange={(e) => setLocalScore(e.target.value)}
                    onBlur={handleScoreBlur}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="h-8 w-14 text-center"
                 />
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Switch
                                id={`switch-${item.id}`}
                                checked={item.priority === 'MUST_HAVE'}
                                onCheckedChange={handleToggle}
                                aria-label={`Toggle ${item.description} priority`}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Toggle to {item.priority === 'MUST_HAVE' ? 'Nice to Have' : 'Must Have'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                {item.isUserAdded && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => onDeleteRequirement(item.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>Delete this requirement</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </li>
    );
};

const isRequirementGroup = (item: any): item is RequirementGroup => {
  return 'groupType' in item && Array.isArray(item.requirements);
};


const RequirementSection = ({ title, mustHaves, niceToHaves, icon, category, onRequirementChange, onScoreChange, onDeleteRequirement, children }: {
    title: string;
    mustHaves?: (Requirement | RequirementGroup)[];
    niceToHaves?: (Requirement | RequirementGroup)[];
    icon: React.ReactNode;
    category: CategoryKey;
    onRequirementChange: (category: CategoryKey, reqId: string, newPriority: Priority) => void;
    onScoreChange: (category: CategoryKey, priority: Priority, reqId: string, newScore: number) => void;
    onDeleteRequirement: (reqId: string) => void;
    children?: React.ReactNode;
}) => {
    const hasMustHaves = mustHaves && mustHaves.length > 0;
    const hasNiceToHaves = niceToHaves && niceToHaves.length > 0;

    if (!hasMustHaves && !hasNiceToHaves && !children) {
        return null;
    }

    const renderList = (items: (Requirement | RequirementGroup)[], priority: Priority) => (
        <ul className="space-y-1 text-sm">
            {items.map((item, index) => {
                if (isRequirementGroup(item)) {
                    return (
                        <li key={`group-${index}`} className="p-2 border rounded-md bg-background/30">
                           <Badge variant="secondary" className="mb-2">Must match {item.groupType === 'ANY' ? 'ANY' : 'ALL'} of:</Badge>
                           <ul className="space-y-1">
                                {item.requirements.map(req => (
                                    <RequirementItem key={`${req.id}-${req.priority}`} item={req} category={category} onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                                ))}
                           </ul>
                        </li>
                    )
                }
                return <RequirementItem key={`${item.id}-${item.priority}`} item={item} category={category} onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />;
            })}
        </ul>
    );

    return (
        <div className="break-inside-avoid">
            <h3 className="text-base font-semibold mb-3 flex items-center text-primary">
                {icon}
                <span className="ml-2">{title}</span>
            </h3>
            <div className="space-y-3">
                {hasMustHaves && (
                    <div>
                        <h4 className="text-sm font-bold text-accent mb-1">Must Have</h4>
                        {renderList(mustHaves, 'MUST_HAVE')}
                    </div>
                )}
                {hasNiceToHaves && (
                     <div>
                        <h4 className="text-sm font-bold text-muted-foreground mb-1">Nice to Have</h4>
                         <div className="text-muted-foreground">
                            {renderList(niceToHaves, 'NICE_TO_HAVE')}
                        </div>
                    </div>
                )}
                 {children}
            </div>
        </div>
    );
};

const AddRequirementForm = ({ onAdd }: { onAdd: (description: string, priority: Priority, score: number) => void }) => {
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<Priority>("MUST_HAVE");
    const [score, setScore] = useState("10");
    const [isOpen, setIsOpen] = useState(false);

    const handlePriorityChange = (value: string) => {
        const newPriority = value as Priority;
        setPriority(newPriority);
        setScore(newPriority === 'MUST_HAVE' ? "10" : "5");
    };
    
    const handleAddClick = () => {
        if (!description.trim()) return;
        const finalScore = parseInt(score, 10);
        if (isNaN(finalScore)) return;

        onAdd(description, priority, finalScore);
        setDescription("");
        setPriority("MUST_HAVE");
        setScore("10");
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Requirement
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Add a Custom Requirement</h4>
                        <p className="text-sm text-muted-foreground">This will be added to the 'Additional Requirements' category.</p>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="width">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-2 h-20"
                                placeholder="e.g., '5+ years experience with React'"
                            />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="maxWidth">Priority</Label>
                            <RadioGroup value={priority} onValueChange={handlePriorityChange} className="col-span-2 flex items-center gap-4">
                                <div>
                                    <RadioGroupItem value="MUST_HAVE" id="r-must" />
                                    <Label htmlFor="r-must" className="ml-2">Must Have</Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="NICE_TO_HAVE" id="r-nice" />
                                    <Label htmlFor="r-nice" className="ml-2">Nice to Have</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="score">Score</Label>
                            <Input
                                id="score"
                                type="number"
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                className="col-span-2 h-8"
                            />
                        </div>
                    </div>
                     <Button onClick={handleAddClick}>Add Requirement</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default function JdAnalysis({ analysis, isOpen, onOpenChange, onRequirementChange, onScoreChange, onAddRequirement, onDeleteRequirement }: JdAnalysisProps) {
  const [objectiveVisible, setObjectiveVisible] = useState(false);
  const {
      JobTitle,
      JobCode,
      PositionNumber,
      PayGrade,
      Department,
      Company,
      Location,
      DateApproved,
      PrincipalObjective,
      OrganizationalRelationship,
      Responsibilities,
      Requirements
  } = analysis;

  const experienceMustHaves: Requirement[] = (Requirements.Experience.MUST_HAVE.Years && Requirements.Experience.MUST_HAVE.Years !== 'Not Found' && Requirements.Experience.MUST_HAVE.Fields.length > 0) 
    ? [{
        id: 'exp-must-years',
        description: `${Requirements.Experience.MUST_HAVE.Years} in ${Requirements.Experience.MUST_HAVE.Fields.join(', ')}`,
        priority: 'MUST_HAVE',
        score: 10,
        originalScore: 10,
        originalPriority: 'MUST_HAVE',
      }]
    : [];

  const experienceNiceToHaves = Requirements.Experience.NICE_TO_HAVE || [];


  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} asChild>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Briefcase className="h-5 w-5 text-primary"/>
                      </div>
                      <span className="mr-2">{JobTitle || 'Job Description Breakdown'}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">The JD has been deconstructed. You can edit requirement priorities and scores below.</CardDescription>
                  </div>
                </CollapsibleTrigger>
                 <div className="flex items-center gap-2 flex-wrap mt-3">
                    <InfoBadge label="Position" value={PositionNumber} icon={<span className="font-bold">#</span>} />
                    <InfoBadge label="Code" value={JobCode} icon={<span className="font-bold text-xs">C</span>} />
                    <InfoBadge label="Grade" value={PayGrade} icon={<Star className="w-3 h-3"/>} />
                    <InfoBadge label="Dept" value={Department} icon={<Users className="w-3 h-3"/>} />
                    <InfoBadge label="Company" value={Company} icon={<Building className="w-3 h-3"/>} />
                    <InfoBadge label="Location" value={Location} icon={<MapPin className="w-3 h-3"/>} />
                    <InfoBadge label="Approved" value={DateApproved} icon={<Calendar className="w-3 h-3"/>} />
                </div>
              </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0 w-8 h-8 -mt-1 -mr-2">
                      <ChevronsUpDown className="h-4 w-4" />
                      <span className="sr-only">Toggle JD Analysis</span>
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show/Hide Details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-6">
            <Collapsible open={objectiveVisible} onOpenChange={setObjectiveVisible} className="mb-6">
                 <CollapsibleContent className="p-4 border rounded-lg bg-muted/30 space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center text-primary">
                            <Target className="h-5 w-5" />
                            <span className="ml-2">Principal Objective</span>
                        </h3>
                        <p className="text-sm text-muted-foreground">{PrincipalObjective}</p>
                    </div>
                    
                    <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center text-primary">
                            <Users className="h-5 w-5" />
                            <span className="ml-2">Organizational Relationship</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {OrganizationalRelationship.ReportsTo.length > 0 && (
                                <div>
                                    <h4 className="font-medium">Reports To:</h4>
                                    <ul className="list-disc list-outside pl-5 text-muted-foreground">
                                        {OrganizationalRelationship.ReportsTo.map((role, i) => <li key={`report-${i}`}>{role}</li>)}
                                    </ul>
                                </div>
                            )}
                             {OrganizationalRelationship.InterfacesWith.length > 0 && (
                                <div>
                                    <h4 className="font-medium">Interfaces With:</h4>
                                    <ul className="list-disc list-outside pl-5 text-muted-foreground">
                                        {OrganizationalRelationship.InterfacesWith.map((role, i) => <li key={`interface-${i}`}>{role}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                 </CollapsibleContent>
                 <CollapsibleTrigger asChild>
                    <Button variant="link" className="px-0 h-auto text-xs mt-2 -mb-4">
                       {objectiveVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                       {objectiveVisible ? 'Hide Objective & Org Chart' : 'Show Objective & Org Chart'}
                    </Button>
                </CollapsibleTrigger>
            </Collapsible>

            <div className="md:columns-2 gap-8 space-y-6">
                <RequirementSection title="Education" icon={<GraduationCap className="h-5 w-5"/>} mustHaves={Requirements.Education.MUST_HAVE} niceToHaves={Requirements.Education.NICE_TO_HAVE} category="Education" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                <RequirementSection title="Certifications" icon={<Star className="h-5 w-5"/>} mustHaves={Requirements.Certifications.MUST_HAVE} niceToHaves={Requirements.Certifications.NICE_TO_HAVE} category="Certifications" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                <RequirementSection title="Experience" icon={<Briefcase className="h-5 w-5"/>} mustHaves={experienceMustHaves} niceToHaves={experienceNiceToHaves} category="Experience" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                <RequirementSection title="Technical Skills" icon={<BrainCircuit className="h-5 w-5"/>} mustHaves={Requirements.TechnicalSkills.MUST_HAVE} niceToHaves={Requirements.TechnicalSkills.NICE_TO_HAVE} category="TechnicalSkills" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                <RequirementSection title="Soft Skills" icon={<ClipboardCheck className="h-5 w-5"/>} mustHaves={Requirements.SoftSkills.MUST_HAVE} niceToHaves={Requirements.SoftSkills.NICE_TO_HAVE} category="SoftSkills" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                <RequirementSection title="Responsibilities" icon={<ListChecks className="h-5 w-5"/>} mustHaves={Responsibilities.MUST_HAVE} niceToHaves={Responsibilities.NICE_TO_HAVE} category="Responsibilities" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement} />
                <RequirementSection title="Additional Requirements" icon={<PenLine className="h-5 w-5"/>} mustHaves={Requirements.AdditionalRequirements?.MUST_HAVE} niceToHaves={Requirements.AdditionalRequirements?.NICE_TO_HAVE} category="AdditionalRequirements" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} onDeleteRequirement={onDeleteRequirement}>
                    <AddRequirementForm onAdd={onAddRequirement} />
                </RequirementSection>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}