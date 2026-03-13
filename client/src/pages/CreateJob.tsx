import { useState }       from 'react';
import { useNavigate }    from 'react-router-dom';
import { api }            from '@/lib/api';
import { toast }          from 'sonner';
import {
  Plus, Trash2, Briefcase,
  MapPin, DollarSign, Layers,
  ClipboardList, Loader2, ArrowLeft,
  GripVertical,
} from 'lucide-react';

import {
  Card, CardContent,
  CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Button }   from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScreeningQuestion {
  questionText: string;
  answerType:   'text' | 'boolean' | 'multipleChoice';
  isRequired:   boolean;
}

interface FormData {
  title:       string;
  department:  string;
  location:    string;
  description: string;
  salaryRange: { min: string; max: string; currency: string };
  technologies: string[];
  stages:       string[];
  screeningQuestions: ScreeningQuestion[];
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon:        React.ElementType;
  title:       string;
  description: string;
  children:    React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
            <Icon className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CreateJob() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title:       '',
    department:  '',
    location:    '',
    description: '',
    salaryRange: { min: '', max: '', currency: 'USD' },
    technologies: [],
    stages:      ['Screening', 'Interview', 'Offer', 'Hired'],
    screeningQuestions: [],
  });

  // Tech input — separate state so it doesn't bloat formData
  const [techInput, setTechInput] = useState('');

  // ── Generic field updater ─────────────────────────────────────────────────
  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // ── Salary range ──────────────────────────────────────────────────────────
  const setSalary = (key: keyof FormData['salaryRange'], value: string) => {
    setFormData(prev => ({
      ...prev,
      salaryRange: { ...prev.salaryRange, [key]: value },
    }));
  };

  // ── Technologies ──────────────────────────────────────────────────────────
  const addTech = () => {
    const trimmed = techInput.trim();
    if (!trimmed) return;
    if (formData.technologies.includes(trimmed)) {
      toast.error(`"${trimmed}" is already added.`);
      return;
    }
    setField('technologies', [...formData.technologies, trimmed]);
    setTechInput('');
  };

  const removeTech = (index: number) => {
    setField('technologies', formData.technologies.filter((_, i) => i !== index));
  };

  // ── Stages ────────────────────────────────────────────────────────────────
  const addStage = () => {
    setField('stages', [...formData.stages, '']);
  };

  const updateStage = (index: number, value: string) => {
    const updated = [...formData.stages];
    updated[index] = value;
    setField('stages', updated);
  };

  const removeStage = (index: number) => {
    if (formData.stages.length <= 1) {
      toast.error('At least one pipeline stage is required.');
      return;
    }
    setField('stages', formData.stages.filter((_, i) => i !== index));
  };

  // ── Screening questions ───────────────────────────────────────────────────
  const addQuestion = () => {
    setField('screeningQuestions', [
      ...formData.screeningQuestions,
      { questionText: '', answerType: 'text', isRequired: true },
    ]);
  };

  const updateQuestion = (
    index: number,
    key:   keyof ScreeningQuestion,
    value: string | boolean,
  ) => {
    const updated = formData.screeningQuestions.map((q, i) =>
      i === index ? { ...q, [key]: value } : q
    );
    setField('screeningQuestions', updated);
  };

  const removeQuestion = (index: number) => {
    setField('screeningQuestions', formData.screeningQuestions.filter((_, i) => i !== index));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.title.trim())       return toast.error('Job title is required.');
    if (!formData.department.trim())  return toast.error('Department is required.');
    if (!formData.location.trim())    return toast.error('Location is required.');
    if (!formData.description.trim()) return toast.error('Description is required.');

    const emptyStage = formData.stages.find(s => !s.trim());
    if (emptyStage !== undefined) return toast.error('All pipeline stages must have a name.');

    const emptyQuestion = formData.screeningQuestions.find(q => !q.questionText.trim());
    if (emptyQuestion !== undefined) return toast.error('All screening questions must have text.');

    try {
      setIsLoading(true);

      const payload = {
        title:       formData.title.trim(),
        department:  formData.department.trim(),
        location:    formData.location.trim(),
        description: formData.description.trim(),
        technologies: formData.technologies,
        salaryRange: {
          min:      formData.salaryRange.min      ? Number(formData.salaryRange.min)  : undefined,
          max:      formData.salaryRange.max      ? Number(formData.salaryRange.max)  : undefined,
          currency: formData.salaryRange.currency || 'USD',
        },
        stages:             formData.stages.map(s => s.trim()),
        screeningQuestions: formData.screeningQuestions,
      };

      const result = await api.createJobOpening(payload);

      toast.success('Job opening created!', {
        description: `"${result.job.title}" is now published.`,
      });

      // Navigate to the Kanban board for the new job
      navigate(`/recruitment/job/${result.job._id}`);

    } catch (err) {
      toast.error('Failed to create job opening.', {
        description: err instanceof Error ? err.message : 'Unknown error.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Job Opening</h1>
          <p className="text-sm text-gray-500">
            Fill in the details to publish a new position.
          </p>
        </div>
      </div>

      {/* ── Section 1: Basic Info ────────────────────────────────────────── */}
      <Section
        icon={Briefcase}
        title="Basic Information"
        description="The core details candidates will see on the careers portal."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Job Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="e.g. Senior Frontend Engineer"
              value={formData.title}
              onChange={e => setField('title', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Department <span className="text-red-500">*</span></Label>
            <Input
              id="department"
              placeholder="e.g. Engineering"
              value={formData.department}
              onChange={e => setField('department', e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                id="location"
                placeholder="e.g. Remote / New York, USA"
                className="pl-9"
                value={formData.location}
                onChange={e => setField('location', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
            <Textarea
              id="description"
              placeholder="Describe responsibilities, team culture, and expectations..."
              className="min-h-[140px] resize-y"
              value={formData.description}
              onChange={e => setField('description', e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* ── Section 2: Requirements & Salary ────────────────────────────── */}
      <Section
        icon={DollarSign}
        title="Requirements & Salary"
        description="Technologies required and the compensation range."
      >
        <div className="space-y-6">

          {/* Salary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sal-min">Salary Min</Label>
              <Input
                id="sal-min"
                type="number"
                min={0}
                placeholder="e.g. 60000"
                value={formData.salaryRange.min}
                onChange={e => setSalary('min', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sal-max">Salary Max</Label>
              <Input
                id="sal-max"
                type="number"
                min={0}
                placeholder="e.g. 90000"
                value={formData.salaryRange.max}
                onChange={e => setSalary('max', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={formData.salaryRange.currency}
                onValueChange={val => setSalary('currency', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Technologies */}
          <div className="space-y-3">
            <Label>Technologies</Label>

            {/* Tech tags */}
            {formData.technologies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.technologies.map((tech, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full border border-blue-200
                      bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTech(i)}
                      className="text-blue-400 hover:text-blue-700 transition-colors"
                      aria-label={`Remove ${tech}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add tech input */}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. React"
                value={techInput}
                onChange={e => setTechInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addTech(); }
                }}
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTech}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Tech
              </Button>
            </div>
            <p className="text-xs text-gray-400">Press Enter or click Add to add a technology.</p>
          </div>
        </div>
      </Section>

      {/* ── Section 3: Pipeline Stages ───────────────────────────────────── */}
      <Section
        icon={Layers}
        title="Hiring Pipeline"
        description="Define the Kanban columns candidates will move through."
      >
        <div className="space-y-3">
          {formData.stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center
                rounded-lg border border-gray-200 bg-gray-50 cursor-grab"
              >
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center
                rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                {i + 1}
              </span>
              <Input
                value={stage}
                onChange={e => updateStage(i, e.target.value)}
                placeholder={`Stage ${i + 1} name`}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeStage(i)}
                className="text-gray-400 hover:text-red-500 shrink-0"
                aria-label="Remove stage"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStage}
            className="mt-1"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Stage
          </Button>
        </div>
      </Section>

      {/* ── Section 4: Screening Questions ──────────────────────────────── */}
      <Section
        icon={ClipboardList}
        title="Screening Questions"
        description="Candidates answer these when submitting their application."
      >
        <div className="space-y-4">
          {formData.screeningQuestions.length === 0 && (
            <p className="text-sm text-gray-400">
              No questions yet. Add one below.
            </p>
          )}

          {formData.screeningQuestions.map((q, i) => (
            <div
              key={i}
              className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3"
            >
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                className="absolute right-3 top-3 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Question {i + 1}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor={`q-text-${i}`}>Question Text</Label>
                <Input
                  id={`q-text-${i}`}
                  placeholder="e.g. How many years of experience do you have with React?"
                  value={q.questionText}
                  onChange={e => updateQuestion(i, 'questionText', e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Answer Type</Label>
                  <Select
                    value={q.answerType}
                    onValueChange={val => updateQuestion(i, 'answerType', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="boolean">Yes / No</SelectItem>
                      <SelectItem value="multipleChoice">Multiple Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Required</Label>
                  <Select
                    value={q.isRequired ? 'true' : 'false'}
                    onValueChange={val => updateQuestion(i, 'isRequired', val === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Required</SelectItem>
                      <SelectItem value="false">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuestion}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </Section>

      {/* ── Submit row ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 text-white hover:bg-blue-700 min-w-[140px]"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</>
          ) : (
            <><Briefcase className="mr-2 h-4 w-4" />Publish Job</>
          )}
        </Button>
      </div>
    </form>
  );
}