import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, ArrowRight, Code2, Database, Server, Braces, Terminal, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const domainIcons = {
  'javascript': Braces,
  'react': Code2,
  'nodejs': Server,
  'data-structures-algorithms': Database,
  'python': Terminal,
  'system-design': Layers,
};

export default function HomePage() {
  const [domains, setDomains] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/domains`).then(r => {
      setDomains(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (search.length < 2) { setSearchResults(null); return; }
    const timer = setTimeout(() => {
      axios.get(`${API}/search?q=${encodeURIComponent(search)}`).then(r => setSearchResults(r.data));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const displayDomains = useMemo(() => {
    if (searchResults && searchResults.domains.length > 0) return searchResults.domains;
    return domains;
  }, [domains, searchResults]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6" data-testid="home-page">
      {/* Hero */}
      <section className="pb-12 pt-16 sm:pt-24 sm:pb-16">
        <div className="max-w-2xl">
          <h1
            data-testid="hero-heading"
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            Master your next
            <br />
            <span className="text-muted-foreground">technical interview</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg" style={{ maxWidth: '32rem' }}>
            Curated questions across domains, with AI-powered explanations to help you understand every concept deeply.
          </p>
        </div>

        {/* Search */}
        <div className="relative mt-8 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="search-input"
            type="text"
            placeholder="Search domains or questions..."
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
      </section>

      {/* Domains Grid */}
      <section className="pb-20">
        <div className="mb-6 flex items-center justify-between">
          <h2
            data-testid="domains-section-title"
            className="text-base font-semibold tracking-tight sm:text-lg"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            Interview Domains
          </h2>
          <span className="text-xs text-muted-foreground font-mono">{domains.length} domains</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-36 animate-pulse rounded-sm border border-border bg-muted/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayDomains.map((domain, idx) => {
              const Icon = domainIcons[domain.slug] || Code2;
              return (
                <Link
                  key={domain.id}
                  to={`/domain/${domain.slug}`}
                  data-testid={`domain-card-${domain.slug}`}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-sm border border-border bg-card p-6 transition-all duration-200 hover:border-foreground/20 hover:shadow-sm animate-fade-in-up stagger-${idx + 1}`}
                  style={{ opacity: 0 }}
                >
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-muted">
                        <Icon className="h-4 w-4 text-foreground" />
                      </div>
                      <h3 className="text-sm font-semibold tracking-tight">{domain.name}</h3>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {domain.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    <span>Explore questions</span>
                    <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
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
