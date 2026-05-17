import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/contexts/ThemeContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AIChatDrawer({ open, onOpenChange, question }) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Reset chat when question changes
  useEffect(() => {
    if (question) {
      setMessages([]);
      setSessionId(null);
      setInput('');
    }
  }, [question]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || !question) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const { data } = await axios.post(`${API}/chat`, {
        question_context: question.question,
        answer_context: question.answer,
        user_message: text,
        session_id: sessionId,
      });
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setSending(false);
    }
  };

  const codeStyle = theme === 'dark' ? oneDark : oneLight;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="ai-chat-drawer"
        className="flex w-full flex-col p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground">
              <Sparkles className="h-3.5 w-3.5 text-background" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold">AI Interview Coach</SheetTitle>
              <SheetDescription className="text-[11px]">
                Ask anything about this question
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Context pill */}
        {question && (
          <div className="border-b border-border px-4 py-2">
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Context:</span> {question.question}
            </p>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="py-12 text-center" data-testid="chat-empty-state">
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Ask me anything about this question.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  I can explain concepts, provide examples, or discuss edge cases.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                data-testid={`chat-message-${idx}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-sm px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-foreground text-background'
                      : 'border border-border bg-card'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="markdown-content text-xs leading-relaxed">
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
                                className="syntax-highlighter !rounded-sm !text-[11px]"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px] font-mono" {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-xs">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start" data-testid="chat-loading">
                <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="border-t border-border px-4 py-3"
          data-testid="chat-input-form"
        >
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              data-testid="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={sending}
              className="h-9 flex-1 rounded-sm text-xs"
            />
            <Button
              type="submit"
              data-testid="chat-send-btn"
              disabled={!input.trim() || sending}
              size="sm"
              className="h-9 w-9 rounded-sm p-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
