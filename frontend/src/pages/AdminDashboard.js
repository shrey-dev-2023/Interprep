import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Layers, HelpCircle, MessageSquare, Plus, Pencil, Trash2, Loader2, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const diffColors = {
  easy: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hard: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [domains, setDomains] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Domain dialog
  const [domainDialog, setDomainDialog] = useState(false);
  const [editDomain, setEditDomain] = useState(null);
  const [domainForm, setDomainForm] = useState({ name: '', description: '' });
  const [domainSaving, setDomainSaving] = useState(false);

  // Question dialog
  const [questionDialog, setQuestionDialog] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    domain_id: '', question: '', answer: '', difficulty: 'medium',
    is_most_asked: false, tags: ''
  });
  const [questionSaving, setQuestionSaving] = useState(false);

  const axiosAuth = useCallback(() => {
    return { withCredentials: true };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [analyticsRes, domainsRes, questionsRes] = await Promise.all([
        axios.get(`${API}/admin/analytics`, axiosAuth()),
        axios.get(`${API}/domains`),
        axios.get(`${API}/questions`),
      ]);
      setAnalytics(analyticsRes.data);
      setDomains(domainsRes.data);
      setQuestions(questionsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [axiosAuth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Domain CRUD ---
  const openNewDomain = () => {
    setEditDomain(null);
    setDomainForm({ name: '', description: '' });
    setDomainDialog(true);
  };

  const openEditDomain = (d) => {
    setEditDomain(d);
    setDomainForm({ name: d.name, description: d.description || '' });
    setDomainDialog(true);
  };

  const saveDomain = async () => {
    setDomainSaving(true);
    try {
      if (editDomain) {
        await axios.put(`${API}/admin/domains/${editDomain.id}`, domainForm, axiosAuth());
        toast.success('Domain updated');
      } else {
        await axios.post(`${API}/admin/domains`, domainForm, axiosAuth());
        toast.success('Domain created');
      }
      setDomainDialog(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving domain');
    } finally {
      setDomainSaving(false);
    }
  };

  const deleteDomain = async (d) => {
    if (!window.confirm(`Delete "${d.name}" and all its questions?`)) return;
    try {
      await axios.delete(`${API}/admin/domains/${d.id}`, axiosAuth());
      toast.success('Domain deleted');
      fetchAll();
    } catch (err) {
      toast.error('Error deleting domain');
    }
  };

  // --- Question CRUD ---
  const openNewQuestion = () => {
    setEditQuestion(null);
    setQuestionForm({
      domain_id: domains[0]?.id || '', question: '', answer: '',
      difficulty: 'medium', is_most_asked: false, tags: ''
    });
    setQuestionDialog(true);
  };

  const openEditQuestion = (q) => {
    setEditQuestion(q);
    setQuestionForm({
      domain_id: q.domain_id, question: q.question, answer: q.answer,
      difficulty: q.difficulty, is_most_asked: q.is_most_asked,
      tags: (q.tags || []).join(', ')
    });
    setQuestionDialog(true);
  };

  const saveQuestion = async () => {
    setQuestionSaving(true);
    const payload = {
      ...questionForm,
      tags: questionForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    };
    try {
      if (editQuestion) {
        await axios.put(`${API}/admin/questions/${editQuestion.id}`, payload, axiosAuth());
        toast.success('Question updated');
      } else {
        await axios.post(`${API}/admin/questions`, payload, axiosAuth());
        toast.success('Question created');
      }
      setQuestionDialog(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving question');
    } finally {
      setQuestionSaving(false);
    }
  };

  const deleteQuestion = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await axios.delete(`${API}/admin/questions/${q.id}`, axiosAuth());
      toast.success('Question deleted');
      fetchAll();
    } catch (err) {
      toast.error('Error deleting question');
    }
  };

  const getDomainName = (id) => domains.find(d => d.id === id)?.name || 'Unknown';

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6" data-testid="admin-dashboard">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          Admin Dashboard
        </h1>
        <p className="mt-1 text-xs text-muted-foreground font-mono">
          Logged in as {user?.email}
        </p>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="analytics-cards">
          <Card className="rounded-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">Domains</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-2xl font-bold font-mono" data-testid="total-domains">{analytics.total_domains}</span>
            </CardContent>
          </Card>
          <Card className="rounded-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">Questions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-2xl font-bold font-mono" data-testid="total-questions">{analytics.total_questions}</span>
            </CardContent>
          </Card>
          <Card className="rounded-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">Chat Sessions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-2xl font-bold font-mono" data-testid="total-chats">{analytics.total_chat_sessions}</span>
            </CardContent>
          </Card>
          <Card className="rounded-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">By Difficulty</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex gap-2" data-testid="difficulty-breakdown">
                {Object.entries(analytics.difficulty_breakdown || {}).map(([k, v]) => (
                  <Badge key={k} variant="outline" className={`rounded-sm text-[10px] capitalize ${diffColors[k] || ''}`}>
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="domains" className="w-full" data-testid="admin-tabs">
        <TabsList className="mb-4 rounded-sm">
          <TabsTrigger value="domains" className="rounded-sm text-xs" data-testid="tab-domains">Domains</TabsTrigger>
          <TabsTrigger value="questions" className="rounded-sm text-xs" data-testid="tab-questions">Questions</TabsTrigger>
        </TabsList>

        {/* Domains Tab */}
        <TabsContent value="domains">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">All Domains</h2>
            <Button
              data-testid="add-domain-btn"
              onClick={openNewDomain}
              size="sm"
              className="h-8 gap-1.5 rounded-sm text-xs"
            >
              <Plus className="h-3 w-3" /> Add Domain
            </Button>
          </div>
          <div className="rounded-sm border border-border" data-testid="domains-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-mono">Name</TableHead>
                  <TableHead className="hidden text-xs font-mono sm:table-cell">Slug</TableHead>
                  <TableHead className="text-xs font-mono">Description</TableHead>
                  <TableHead className="w-24 text-right text-xs font-mono">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map(d => (
                  <TableRow key={d.id} data-testid={`domain-row-${d.id}`}>
                    <TableCell className="text-xs font-medium">{d.name}</TableCell>
                    <TableCell className="hidden text-xs font-mono text-muted-foreground sm:table-cell">{d.slug}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{d.description}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          data-testid={`edit-domain-${d.id}`}
                          onClick={() => openEditDomain(d)}
                          className="h-7 w-7 rounded-sm p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          data-testid={`delete-domain-${d.id}`}
                          onClick={() => deleteDomain(d)}
                          className="h-7 w-7 rounded-sm p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">All Questions</h2>
            <Button
              data-testid="add-question-btn"
              onClick={openNewQuestion}
              size="sm"
              className="h-8 gap-1.5 rounded-sm text-xs"
            >
              <Plus className="h-3 w-3" /> Add Question
            </Button>
          </div>
          <div className="rounded-sm border border-border" data-testid="questions-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-mono">Question</TableHead>
                  <TableHead className="hidden text-xs font-mono sm:table-cell">Domain</TableHead>
                  <TableHead className="text-xs font-mono">Difficulty</TableHead>
                  <TableHead className="hidden text-xs font-mono sm:table-cell">Most Asked</TableHead>
                  <TableHead className="w-24 text-right text-xs font-mono">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map(q => (
                  <TableRow key={q.id} data-testid={`question-row-${q.id}`}>
                    <TableCell className="max-w-xs truncate text-xs font-medium">{q.question}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{getDomainName(q.domain_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`rounded-sm text-[10px] capitalize ${diffColors[q.difficulty] || ''}`}>
                        {q.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {q.is_most_asked && <Badge variant="secondary" className="rounded-sm text-[10px]">Yes</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          data-testid={`edit-question-${q.id}`}
                          onClick={() => openEditQuestion(q)}
                          className="h-7 w-7 rounded-sm p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          data-testid={`delete-question-${q.id}`}
                          onClick={() => deleteQuestion(q)}
                          className="h-7 w-7 rounded-sm p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Domain Dialog */}
      <Dialog open={domainDialog} onOpenChange={setDomainDialog}>
        <DialogContent className="rounded-sm sm:max-w-md" data-testid="domain-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">{editDomain ? 'Edit Domain' : 'New Domain'}</DialogTitle>
            <DialogDescription className="text-xs">
              {editDomain ? 'Update domain details' : 'Add a new interview domain'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                data-testid="domain-name-input"
                value={domainForm.name}
                onChange={e => setDomainForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., JavaScript"
                className="h-9 rounded-sm text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                data-testid="domain-description-input"
                value={domainForm.description}
                onChange={e => setDomainForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                className="rounded-sm text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="save-domain-btn"
              onClick={saveDomain}
              disabled={!domainForm.name || domainSaving}
              className="h-9 rounded-sm text-xs"
            >
              {domainSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {editDomain ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialog} onOpenChange={setQuestionDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm sm:max-w-2xl" data-testid="question-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">{editQuestion ? 'Edit Question' : 'New Question'}</DialogTitle>
            <DialogDescription className="text-xs">
              {editQuestion ? 'Update question details' : 'Add a new interview question'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Domain</Label>
                <Select
                  value={questionForm.domain_id}
                  onValueChange={v => setQuestionForm(prev => ({ ...prev, domain_id: v }))}
                >
                  <SelectTrigger data-testid="question-domain-select" className="h-9 rounded-sm text-xs">
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select
                  value={questionForm.difficulty}
                  onValueChange={v => setQuestionForm(prev => ({ ...prev, difficulty: v }))}
                >
                  <SelectTrigger data-testid="question-difficulty-select" className="h-9 rounded-sm text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy" className="text-xs">Easy</SelectItem>
                    <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                    <SelectItem value="hard" className="text-xs">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Question</Label>
              <Input
                data-testid="question-title-input"
                value={questionForm.question}
                onChange={e => setQuestionForm(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Enter the interview question"
                className="h-9 rounded-sm text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Answer (Markdown supported)</Label>
              <Textarea
                data-testid="question-answer-input"
                value={questionForm.answer}
                onChange={e => setQuestionForm(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="Write the answer in Markdown..."
                className="min-h-[200px] rounded-sm font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input
                data-testid="question-tags-input"
                value={questionForm.tags}
                onChange={e => setQuestionForm(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="e.g., closures, scope, functions"
                className="h-9 rounded-sm text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                data-testid="question-most-asked-toggle"
                checked={questionForm.is_most_asked}
                onCheckedChange={v => setQuestionForm(prev => ({ ...prev, is_most_asked: v }))}
              />
              <Label className="text-xs">Most Asked Question</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="save-question-btn"
              onClick={saveQuestion}
              disabled={!questionForm.question || !questionForm.domain_id || questionSaving}
              className="h-9 rounded-sm text-xs"
            >
              {questionSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {editQuestion ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
