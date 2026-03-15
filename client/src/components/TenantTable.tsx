import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Organization {
  _id:       string;
  name:      string;
  slug:      string;
  createdAt: string;
}

interface ApiResponse {
  success:    boolean;
  data:       Organization[];
  nextCursor: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });

const API_BASE = import.meta.env.VITE_API_URL as string;
const LIMIT    = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export function TenantTable() {
  const [data,          setData]          = useState<Organization[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor,    setNextCursor]    = useState<string | null>(null);
  // Stack of cursors for previous navigation — each entry is what currentCursor
  // was BEFORE we advanced, so popping it restores the previous page exactly.
  const [history,       setHistory]       = useState<Array<string | null>>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchOrganizations = async () => {
      setIsLoading(true);

      try {
        const token = localStorage.getItem('adminToken') ?? '';
        const url   = new URL(`${API_BASE}/super-admin/organizations`);
        url.searchParams.set('limit', String(LIMIT));
        if (currentCursor) url.searchParams.set('cursor', currentCursor);

        const res  = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.error('[TenantTable] API error', res.status);
          return;
        }

        const json: ApiResponse = await res.json();
        setData(json.data);
        setNextCursor(json.nextCursor);

      } catch (err) {
        console.error('[TenantTable] Fetch error', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, [currentCursor]);

  // ── Pagination handlers ───────────────────────────────────────────────────

  const handleNext = () => {
    if (!nextCursor) return;
    setHistory(prev => [...prev, currentCursor]);   // push current onto stack
    setCurrentCursor(nextCursor);
  };

  const handlePrev = () => {
    if (history.length === 0) return;
    const prev    = history[history.length - 1];
    setHistory(h  => h.slice(0, -1));               // pop from stack
    setCurrentCursor(prev);
  };

  const currentPage = history.length + 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">
            All Organisations
          </h2>
        </div>
        {!isLoading && (
          <span className="text-xs text-gray-400">Page {currentPage}</span>
        )}
      </div>

      {/* Table */}
      <div className="relative rounded-lg border border-gray-200 bg-white overflow-hidden">

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-[40%]">
                Name
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-[25%]">
                Slug
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-[20%]">
                Created
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-[15%]">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {!isLoading && data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-sm text-gray-400"
                >
                  No organisations found.
                </TableCell>
              </TableRow>
            ) : (
              data.map(org => (
                <TableRow
                  key={org._id}
                  className="hover:bg-gray-50/70 transition-colors"
                >
                  <TableCell className="py-3.5 font-medium text-gray-900 text-sm">
                    {org.name}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-gray-500 font-mono">
                    {org.slug}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-gray-500">
                    {formatDate(org.createdAt)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Active
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">
          {data.length > 0
            ? `Showing ${data.length} record${data.length !== 1 ? 's' : ''}`
            : ''}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={history.length === 0 || isLoading}
            className="gap-1.5 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!nextCursor || isLoading}
            className="gap-1.5 text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

    </div>
  );
}