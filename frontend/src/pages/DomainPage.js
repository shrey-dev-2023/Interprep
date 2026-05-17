import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArrowLeft, MessageSquare, Sparkles, Flame } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AIChatDrawer from '@/components/AIChatDrawer';
import { useTheme } from '@/contexts/ThemeContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DIFFICULTIES = ['all', 'easy', 'medium', 'hard'];
const difficultyColors = {
  easy: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hard: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function DomainPage() {
  const { slug } = useParams();
  const { theme } = useTheme();
  const [domain, setDomain] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [difficulty, setDifficulty] = useState('all');
  const [showMostAsked, setShowMostAsked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const domainRes = await axios.get(`${API}/domains/${slug}`);
        setDomain(domainRes.data);
        const questionsRes = await axios.get(`${API}/questions?domain_id=${domainRes.data.id}`);
        setQuestions(questionsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  const filteredQuestions = useMemo(() => {
    let result = questions;
    if (difficulty !== 'all') result = result.filter(q => q.difficulty === difficulty);
    if (showMostAsked) result = result.filter(q => q.is_most_asked);
    return result;
  }, [questions, difficulty, showMostAsked]);

  const codeStyle = theme === 'dark' ? oneDark : oneLight;

  const openChat = (question) => {
    setChatQuestion(question);
    setChatOpen(true);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-sm bg-muted" />
        <div className="mt-4 h-4 w-72 animate-pulse rounded-sm bg-muted" />
        <div className="mt-8 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-sm border border-border bg-muted/30" />)}
        </div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <p className="text-muted-foreground">Domain not found.</p>
        <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">Go back</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6" data-testid="domain-page">
      {/* Breadcrumb */}
      <div className="pt-6 pb-2">
        <Link
          to="/"
          data-testid="back-to-home"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All Domains
        </Link>
      </div>

      {/* Header */}
      <div className="pb-6 pt-2">
        <h1
          data-testid="domain-title"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          {domain.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{domain.description}</p>
        <span className="mt-2 inline-block text-xs text-muted-foreground font-mono">
          {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filters */}
      <div
        data-testid="filter-bar"
        className="flex flex-wrap items-center gap-2 border-b border-border pb-4"
      >
        {DIFFICULTIES.map(d => (
          <button
            key={d}
            data-testid={`filter-${d}`}
            onClick={() => setDifficulty(d)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
              difficulty === d
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {d}
          </button>
        ))}
        <div className="h-4 w-px bg-border" />
        <button
          data-testid="filter-most-asked"
          onClick={() => setShowMostAsked(!showMostAsked)}
          className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition-all ${
            showMostAsked
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
          }`}
        >
          <Flame className="h-3 w-3" />
          Most Asked
        </button>
      </div>

      {/* Questions */}
      <div className="py-4 pb-20" data-testid="questions-list">
        {filteredQuestions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No questions match the current filters.
          </p>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {filteredQuestions.map(q => (
              <AccordionItem
                key={q.id}
                value={q.id}
                data-testid={`question-item-${q.id}`}
                className="rounded-sm border border-border bg-card px-4 transition-colors hover:border-foreground/10"
              >
                <AccordionTrigger
                  data-testid={`question-trigger-${q.id}`}
                  className="py-4 text-left text-sm font-medium hover:no-underline"
                >
                  <div className="flex flex-1 items-start gap-3 pr-2">
                    <span className="flex-1">{q.question}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {q.is_most_asked && (
                        <Flame className="h-3 w-3 text-amber-500" />
                      )}
                      <Badge
                        variant="outline"
                        className={`rounded-sm text-[10px] capitalize ${difficultyColors[q.difficulty] || ''}`}
                      >
                        {q.difficulty}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="markdown-content text-sm leading-relaxed text-foreground/90">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={codeStyle}
                              language={match[1]}
                              PreTag="div"
                              className="syntax-highlighter !rounded-sm !text-xs"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-mono" {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {q.answer}
                    </ReactMarkdown>
                  </div>
                  {/* Tags */}
                  {q.tags && q.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {q.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="rounded-sm text-[10px] font-mono">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* Ask AI button */}
                  <div className="mt-4 border-t border-border pt-3">
                    <Button
                      data-testid={`ask-ai-btn-${q.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => openChat(q)}
                      className="h-8 gap-1.5 rounded-sm text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      Ask AI about this question
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* AI Chat Drawer */}
      <AIChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        question={chatQuestion}
      />
    </div>
  );
}
