import { useEffect, useRef, useState }    from 'react';
import { useParams, useNavigate, Link }   from 'react-router-dom';
import { api }                            from '@/lib/api';
import type { JobOpening, ScreeningQuestion } from '@/lib/api';
import {
  ArrowLeft, Upload, Loader2,
  CheckCircle2, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PersonalInfo {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
}

type DynamicAnswers = Record<string, string>;   // questionId → answer

// ─── Reusable field wrapper ───────────────────────────────────────────────────
function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400';

// ─── Dynamic Question ─────────────────────────────────────────────────────────
function DynamicQuestion({
  q, value, onChange,
}: {
  q:        ScreeningQuestion;
  value:    string;
  onChange: (id: string, val: string) => void;
}) {
  if (q.answerType === 'boolean') {
    return (
      <Field label={q.questionText} required={q.isRequired}>
        <div className="flex items-center gap-4 pt-1">
          {(['Yes', 'No'] as const).map(opt => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all ${
                value === opt
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
              }`}
            >
              <input
                type="radio"
                name={q._id}
                value={opt}
                required={q.isRequired}
                checked={value === opt}
                onChange={() => onChange(q._id, opt)}
                className="sr-only"
              />
              <span
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  value === opt ? 'border-indigo-600' : 'border-gray-300'
                }`}
              >
                {value === opt && (
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                )}
              </span>
              {opt}
            </label>
          ))}
        </div>
      </Field>
    );
  }

  return (
    <Field label={q.questionText} required={q.isRequired}>
      <textarea
        rows={3}
        required={q.isRequired}
        value={value}
        onChange={e => onChange(q._id, e.target.value)}
        placeholder="Your answer…"
        className={`${inputCls} resize-none`}
      />
    </Field>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export function JobApplicationForm() {
  const { orgId, jobId } = useParams<{ orgId: string; jobId: string }>();
  const navigate         = useNavigate();

  const [job,         setJob]         = useState<JobOpening | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [fetchError,  setFetchError]  = useState<string | null>(null);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '', lastName: '', email: '', phone: '',
  });
  const [dynamicAnswers, setDynamicAnswers] = useState<DynamicAnswers>({});
  const [resume,         setResume]         = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch job ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId || !jobId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const jobs = await api.getPublicJobs(orgId);
        const found = jobs.find(j => j._id === jobId) ?? null;
        if (!cancelled) {
          setJob(found);
          if (!found) setFetchError('Job not found or no longer available.');
        }
      } catch (err) {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : 'Failed to load job.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [orgId, jobId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const setPersonal = (field: keyof PersonalInfo) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setPersonalInfo(prev => ({ ...prev, [field]: e.target.value }));

  const setAnswer = (questionId: string, value: string) =>
    setDynamicAnswers(prev => ({ ...prev, [questionId]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !orgId || !jobId) return;

    if(!resume){
      alert('Please upload your resume before submitting.');
      return
    }

    setIsSubmitting(true);
 try {
      // ── Step 1: Create candidate account ────────────────────────────────
      // signup returns a candidate JWT scoped to this application
      const signupRes = await api.candidateSignup({
        orgId,
        jobId,
        firstName: personalInfo.firstName,
        lastName:  personalInfo.lastName,
        email:     personalInfo.email,
        password:  crypto.randomUUID(),   // auto-generated — candidate logs in via magic link later
      });

      const candidateToken = signupRes.token;

      // ── Step 2: Submit application (resume + answers) ────────────────────
      await api.submitApplication(candidateToken, {
        jobId,
        answers: job.screeningQuestions.map(q => ({
          questionId:   q._id,
          questionText: q.questionText,
          answer:       dynamicAnswers[q._id] ?? '',
        })),
        resume,
      });

      setSubmitted(true);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed.';

      // Duplicate application — friendly message
      if (message.toLowerCase().includes('already applied')) {
        alert('You have already applied for this position.');
      } else {
        alert(`Something went wrong: ${message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500">Loading job details…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (fetchError || !job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h2 className="text-lg font-semibold text-gray-800">
            {fetchError ?? 'Job not found'}
          </h2>
          <Link
            to={`/careers/${orgId}`}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to all positions
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
          <p className="mt-2 text-gray-500">
            Thank you for applying for <span className="font-medium text-gray-700">{job.title}</span>.
            We'll be in touch soon.
          </p>
          <Link
            to={`/careers/${orgId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> View other positions
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Link
            to={`/careers/${orgId}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All positions
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
          <p className="mt-1 text-base text-gray-500">Apply for this position</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
            <span>{job.department}</span>
            <span>·</span>
            <span>{job.location}</span>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Section 1: Personal Info ─────────────────────────────────── */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-gray-900">
              Personal Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" required>
                <input
                  type="text" required autoComplete="given-name"
                  placeholder="Jane"
                  value={personalInfo.firstName}
                  onChange={setPersonal('firstName')}
                  className={inputCls}
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  type="text" required autoComplete="family-name"
                  placeholder="Smith"
                  value={personalInfo.lastName}
                  onChange={setPersonal('lastName')}
                  className={inputCls}
                />
              </Field>
              <Field label="Email Address" required>
                <input
                  type="email" required autoComplete="email"
                  placeholder="jane@example.com"
                  value={personalInfo.email}
                  onChange={setPersonal('email')}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone Number">
                <input
                  type="tel" autoComplete="tel"
                  placeholder="+1 555 000 0000"
                  value={personalInfo.phone}
                  onChange={setPersonal('phone')}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 2: Screening Questions ───────────────────────────── */}
          {job.screeningQuestions?.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-base font-semibold text-gray-900">
                Screening Questions
              </h2>
              <div className="space-y-5">
                {job.screeningQuestions.map(q => (
                  <DynamicQuestion
                    key={q._id}
                    q={q}
                    value={dynamicAnswers[q._id] ?? ''}
                    onChange={setAnswer}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Section 3: Resume Upload ──────────────────────────────────── */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-gray-900">Resume</h2>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                resume
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'
              }`}
            >
              {resume ? (
                <>
                  <CheckCircle2 className="h-7 w-7 text-green-500" />
                  <p className="text-sm font-medium text-green-700">{resume.name}</p>
                  <p className="text-xs text-green-500">
                    {(resume.size / 1024).toFixed(1)} KB — click to replace
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7 text-gray-400" />
                  <p className="text-sm font-medium text-gray-600">
                    Click to upload your resume
                  </p>
                  <p className="text-xs text-gray-400">PDF only, max 5 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              required
              className="sr-only"
              onChange={e => setResume(e.target.files?.[0] ?? null)}
            />
          </section>

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-4 pb-8">
            <Link
              to={`/careers/${orgId}`}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                : 'Submit Application'
              }
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}