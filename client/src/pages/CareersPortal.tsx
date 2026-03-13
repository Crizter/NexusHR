import { useEffect, useState }    from 'react';
import { useParams, Link }        from 'react-router-dom';
import { api }                    from '@/lib/api';
import type { JobOpening }        from '@/lib/api';
import {
  MapPin, Building2, DollarSign,
  Briefcase, ArrowRight, Loader2,
  SearchX,
} from 'lucide-react';

// ─── Salary formatter ─────────────────────────────────────────────────────────
function formatSalary(s: JobOpening['salaryRange']): string {
  if (!s) return 'Competitive';
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
  return `${s.currency ?? 'USD'} ${fmt(s.min)} – ${fmt(s.max)}`;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, orgId }: { job: JobOpening; orgId: string }) {
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md">
      {/* Tag strip */}
      <div className="mb-4 flex flex-wrap gap-2">
        {job.technologies?.slice(0, 4).map(tech => (
          <span
            key={tech.name}
            className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600"
          >
            {tech.name}
          </span>
        ))}
      </div>

      {/* Title */}
      <h3 className="mb-3 text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
        {job.title}
      </h3>

      {/* Meta */}
      <div className="mb-5 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
          {job.department}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
          {job.location}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <DollarSign className="h-4 w-4 shrink-0 text-gray-400" />
          {formatSalary(job.salaryRange)}
        </div>
      </div>

      {/* CTA */}
      <Link
        to={`/careers/${orgId}/apply/${job._id}`}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 self-start"
      >
        Apply Now
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CareersPortal() {
  const { orgId } = useParams<{ orgId: string }>();

  const [jobs,      setJobs]      = useState<JobOpening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getPublicJobs(orgId);
        if (!cancelled) setJobs(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load jobs.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [orgId]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
            <Briefcase className="h-4 w-4" />
            We're hiring
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Open Positions
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Join our team and help build something great.
          </p>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-6 py-12">

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-gray-500">Loading open positions…</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <SearchX className="h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-700">No open positions</h2>
            <p className="mt-1 text-sm text-gray-400">
              We don't have any openings right now. Check back soon!
            </p>
          </div>
        )}

        {/* Job grid */}
        {!isLoading && !error && jobs.length > 0 && (
          <>
            <p className="mb-6 text-sm text-gray-500">
              {jobs.length} position{jobs.length !== 1 ? 's' : ''} available
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map(job => (
                <JobCard key={job._id} job={job} orgId={orgId!} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}