'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, X, Send, Loader2, MessageSquare, Eraser } from 'lucide-react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import type { AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { queryKnowledgeBase } from '@/ai/flows/query-knowledge-base';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface ChatbotProps {
  sessions: AssessmentSession[];
  cvDatabase: CvDatabaseRecord[];
}

export default function Chatbot({ sessions, cvDatabase }: ChatbotProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = useMemo(() => {
    const questions = new Set<string>();

    if (sessions.length > 0) {
      const latestSession = sessions.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      if (latestSession.analyzedJd.JobTitle) {
        questions.add(
          `What are the must-have skills for the ${latestSession.analyzedJd.JobTitle} role?`
        );
      }
      if (latestSession.candidates.length > 1) {
        questions.add(
          `Compare ${latestSession.candidates[0].analysis.candidateName} and ${latestSession.candidates[1].analysis.candidateName} for the ${latestSession.analyzedJd.JobTitle} role.`
        );
      }
    }

    if (cvDatabase.length > 0) {
      const latestCv = cvDatabase.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      questions.add(`Summarize the CV of ${latestCv.name}.`);
    }

    questions.add('Which positions are currently open?');

    return Array.from(questions).slice(0, 4);
  }, [sessions, cvDatabase]);

  const initialMessage: ChatMessage = useMemo(
    () => ({
      role: 'assistant',
      content:
        "Hello! I'm your recruitment assistant. Ask me anything about your positions and candidates.",
    }),
    []
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen && chatHistory.length === 0) {
      setChatHistory([initialMessage]);
    }
  }, [isOpen, chatHistory.length, initialMessage]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: query };
    const newChatHistory = [...chatHistory, userMessage];
    setChatHistory(newChatHistory);
    setQuery('');
    setIsLoading(true);

    try {
      const result = await queryKnowledgeBase({
        query,
        sessions,
        cvDatabase,
        chatHistory: newChatHistory,
      });
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.answer,
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error querying knowledge base:', error);
      toast({
        variant: 'destructive',
        title: 'Chat Error',
        description: error.message || 'An unexpected error occurred.',
      });
      setChatHistory((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatHistory([initialMessage]);
    toast({ description: 'Chat history cleared.' });
  };

  const hasChatHistory = chatHistory.length > 1;

  const handleNavigation = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    e.preventDefault();
    setIsOpen(false);
    window.location.href = path; // Force a full page reload
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="rounded-full w-16 h-16 shadow-lg"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle chat"
        >
          {isOpen ? <X className="w-8 h-8" /> : <Bot className="w-8 h-8" />}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-full max-w-md">
          <Card className="shadow-2xl border-2">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/50 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                Recruitment Assistant
              </CardTitle>
              {hasChatHistory && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={handleClearChat}
                      >
                        <Eraser className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear chat history</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardHeader>
            <CardContent
              ref={chatContainerRef}
              className="h-96 overflow-y-auto space-y-4 p-4"
            >
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'p-3 rounded-lg max-w-[85%]',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="text-sm leading-relaxed prose prose-sm dark:prose-invert prose-p:mb-2 prose-p:last:mb-0 prose-ul:my-2 prose-ol:my-2 prose-a:text-primary prose-a:font-semibold hover:prose-a:no-underline"
                        components={{
                          a: ({ node, ...props }) => {
                            const { href, children, ...rest } = props;
                            const url = href || '';

                            if (url.startsWith('/assessment?sessionId=')) {
                              const sessionId = url.split('sessionId=')[1];
                              localStorage.setItem(
                                ACTIVE_SESSION_STORAGE_KEY,
                                sessionId
                              );
                              return (
                                <a
                                  href="/assessment"
                                  onClick={(e) =>
                                    handleNavigation(e, '/assessment')
                                  }
                                  className="font-semibold text-primary underline hover:no-underline cursor-pointer"
                                  {...rest}
                                >
                                  {children}
                                </a>
                              );
                            }

                            if (url.startsWith('/cv-database?email=')) {
                              return (
                                <a
                                  href={url}
                                  onClick={(e) => handleNavigation(e, url)}
                                  className="font-semibold text-primary underline hover:no-underline cursor-pointer"
                                  {...rest}
                                >
                                  {children}
                                </a>
                              );
                            }

                            return (
                              <a
                                href={url}
                                className="text-primary underline hover:no-underline"
                                {...rest}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            );
                          },
                          table: ({ node, className, ...props }) => (
                            <div className="my-2 w-full overflow-auto rounded-md border">
                              <table
                                className={cn('w-full', className)}
                                {...props}
                              />
                            </div>
                          ),
                          thead: ({ node, className, ...props }) => (
                            <thead
                              className={cn(
                                'bg-muted/50 font-medium',
                                className
                              )}
                              {...props}
                            />
                          ),
                          tr: ({ node, isHeader, className, ...props }) => (
                            <tr
                              className={cn(
                                'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                                className
                              )}
                              {...props}
                            />
                          ),
                          th: ({ node, isHeader, className, ...props }) => (
                            <th
                              className={cn(
                                'h-10 px-3 text-left align-middle font-medium text-muted-foreground',
                                className
                              )}
                              {...props}
                            />
                          ),
                          td: ({ node, isHeader, className, ...props }) => (
                            <td
                              className={cn('p-3 align-middle', className)}
                              {...props}
                            />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {chatHistory.length === 1 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground px-1">
                    Suggested Questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="h-auto text-left"
                        onClick={() => setQuery(q)}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="flex items-center gap-2 w-full">
                <Input
                  placeholder="Ask a question..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  disabled={isLoading}
                  className="h-10"
                />
                <Button
                  onClick={handleSend}
                  disabled={!query.trim() || isLoading}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
