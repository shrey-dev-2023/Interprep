import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Search, ArrowRight, Code2, Database, Server, Braces, Terminal, Layers, Sparkles, Flame, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/contexts/ThemeContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const domainIcons = {
  'javascript': Braces,
  'react': Code2,
  'nodejs': Server,
  'data-structures-algorithms': Database,
  'python': Terminal,
  'system-design': Layers,
};

const domainAccents = {
  'javascript': { bg: 'bg-amber-500/8', text: 'text-amber-600', border: 'border-amber-500/15' },
  'react': { bg: 'bg-sky-500/8', text: 'text-sky-600', border: 'border-sky-500/15' },
  'nodejs': { bg: 'bg-emerald-500/8', text: 'text-emerald-600', border: 'border-emerald-500/15' },
  'data-structures-algorithms': { bg: 'bg-violet-500/8', text: 'text-violet-600', border: 'border-violet-500/15' },
  'python': { bg: 'bg-blue-500/8', text: 'text-blue-600', border: 'border-blue-500/15' },
  'system-design': { bg: 'bg-rose-500/8', text: 'text-rose-600', border: 'border-rose-500/15' },
};

const difficultyColors = {
  easy: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hard: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const CODE_LINES = [
  { num: '01', code: 'function prepare(topic) {', cls: 'text-foreground' },
  { num: '02', code: '  const knowledge = study(topic);', cls: 'text-muted-foreground' },
  { num: '03', code: '  const confidence = practice(knowledge);', cls: 'text-muted-foreground' },
  { num: '04', code: '  return ace(confidence);', cls: 'text-foreground font-semibold' },
  { num: '05', code: '}', cls: 'text-foreground' },
];

export default function HomePage() {
  const { theme } = useTheme();
  const [domains, setDomains] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qotd, setQotd] = useState(null);

  useEffect(() => {
    axios.get(`${API}/domains`).then(r => {
      setDomains(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
    axios.get(`${API}/question-of-the-day`).then(r => setQotd(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (search.length < 2) { setSearchResults(null); return; }
    const timer = setTimeout(() => {
      axios.get(`${API}/search?q=${encodeURIComponent(search)}`).then(r => setSearchResults(r.data));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalQuestions = useMemo(() => domains.reduce((s, d) => s + (d.question_count || 0), 0), [domains]);

  return (
    <div data-testid="home-page">
      {/* Hero section */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-0 px-4 sm:px-6 lg:grid-cols-[1fr,auto]">
          {/* Left - text */}
          <div className="py-14 sm:py-20 lg:py-24">
            <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                AI-powered doubt solving included
              </span>
            </div>
            <h1
              data-testid="hero-heading"
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif", lineHeight: 1.1 }}
            >
              Stop memorizing.
              <br />
              <span className="text-muted-foreground">Start understanding.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Curated interview questions with in-depth explanations and an AI coach
              that helps you truly grasp every concept — not just recite answers.
            </p>

            {/* Search */}
            <div className="relative mt-8 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-testid="search-input"
                type="text"
                placeholder="Search questions, topics, or domains..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-11 rounded-sm border-border bg-card pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              />
              {searchResults && searchResults.questions.length > 0 && (
                <div
                  data-testid="search-results-dropdown"
                  className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-sm border border-border bg-card shadow-lg"
                >
                  {searchResults.questions.map(q => (
                    <Link
                      key={q.id}
                      to={`/domain/${domains.find(d => d.id === q.domain_id)?.slug || ''}?q=${q.id}`}
                      className="block border-b border-border px-4 py-3 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="font-medium">{q.question}</span>
                      <div className="mt-1 flex gap-2">
                        <Badge variant="outline" className="text-[10px] rounded-sm">{q.difficulty}</Badge>
                        {q.tags?.slice(0, 2).map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] rounded-sm">{t}</Badge>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-8 flex items-center gap-6">
              <div>
                <span className="text-2xl font-bold font-mono tracking-tight">{domains.length}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">domains</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="text-2xl font-bold font-mono tracking-tight">{totalQuestions}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">questions</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-muted-foreground">GPT-5.2 coach</span>
              </div>
            </div>
          </div>

          {/* Right - code block decoration (desktop only) */}
          <div className="hidden items-center lg:flex">
            <div className="w-72 rounded-sm border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                <span className="ml-2 text-[10px] font-mono text-muted-foreground">interview.js</span>
              </div>
              <div className="space-y-1">
                {CODE_LINES.map((line, i) => (
                  <div key={i} className="flex gap-3 font-mono text-xs">
                    <span className="w-4 text-right text-muted-foreground/40 select-none">{line.num}</span>
                    <span className={line.cls}>{line.code}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-600">Ready to ace it</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Question of the Day */}
      {qotd && qotd.question && (
        <section className="border-b border-border" data-testid="qotd-section">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-amber-500/10 border border-amber-500/15">
                <Calendar className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div>
                <span
                  className="text-sm font-semibold tracking-tight"
                  style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                >
                  Question of the Day
                </span>
                <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="rounded-sm border border-border bg-card">
              {/* QOTD Header */}
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
                <h3 className="text-sm font-semibold leading-snug tracking-tight">
                  {qotd.question.question}
                </h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  {qotd.question.is_most_asked && <Flame className="h-3 w-3 text-amber-500" />}
                  <Badge
                    variant="outline"
                    className={`rounded-sm text-[10px] capitalize ${difficultyColors[qotd.question.difficulty] || ''}`}
                  >
                    {qotd.question.difficulty}
                  </Badge>
                  {qotd.domain && (
                    <Badge variant="secondary" className="rounded-sm text-[10px]">
                      {qotd.domain.name}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* QOTD Answer preview */}
              <div className="px-6 py-5">
                <div className="markdown-content text-sm leading-relaxed text-foreground/90">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={theme === 'dark' ? oneDark : oneLight}
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
                    {qotd.question.answer}
                  </ReactMarkdown>
                </div>
                {qotd.question.tags && qotd.question.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {qotd.question.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="rounded-sm text-[10px] font-mono">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* QOTD Footer */}
              {qotd.domain && (
                <div className="border-t border-border px-6 py-3">
                  <Link to={`/domain/${qotd.domain.slug}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="qotd-explore-btn"
                      className="h-8 gap-1.5 rounded-sm text-xs"
                    >
                      Explore more {qotd.domain.name} questions
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Domains section */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground font-mono">
              Browse by topic
            </span>
            <h2
              data-testid="domains-section-title"
              className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
            >
              Pick your domain
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-40 animate-pulse rounded-sm border border-border bg-muted/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain, idx) => {
              const Icon = domainIcons[domain.slug] || Code2;
              const accent = domainAccents[domain.slug] || { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' };
              const count = domain.question_count || 0;
              return (
                <Link
                  key={domain.id}
                  to={`/domain/${domain.slug}`}
                  data-testid={`domain-card-${domain.slug}`}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-sm border border-border bg-card p-6 transition-all duration-200 hover:border-foreground/20 hover:shadow-sm animate-fade-in-up stagger-${idx + 1}`}
                  style={{ opacity: 0 }}
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-sm ${accent.bg} ${accent.border} border`}>
                        <Icon className={`h-4.5 w-4.5 ${accent.text}`} />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {count} {count === 1 ? 'question' : 'questions'}
                      </span>
                    </div>
                    <h3
                      className="text-sm font-semibold tracking-tight"
                      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                    >
                      {domain.name}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {domain.description}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                      Start studying
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
