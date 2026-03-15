import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Settings2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ManageTenantModal,
  type ManagedOrg,
} from "@/components/ManageTenantModal";
// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscription: {
    plan: string;
    status: string;
    maxUsers: number;
  };
  settings: {
    payroll: { currency: string; payCycle: string; taxId?: string };
    timezone: string;
    leavePolicy: { casualLeaves: number; sickLeaves: number };
  };
  createdAt: string;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const PLAN_STYLES: Record<string, string> = {
  free: "bg-gray-100   text-gray-700  hover:bg-gray-100",
  pro: "bg-blue-100   text-blue-700  hover:bg-blue-100",
  enterprise: "bg-violet-100 text-violet-700 hover:bg-violet-100",
};

const API_BASE = import.meta.env.VITE_API_URL as string;
const LIMIT = 10;

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-40" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-14 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-7 w-16 rounded-md" />
      </TableCell>
    </TableRow>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={6}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Building2 className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            {hasSearch ? "No tenants match your search" : "No tenants yet"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {hasSearch
              ? "Try a different name."
              : "Provision the first tenant from your dashboard."}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TenantDirectory() {
  const [allData, setAllData] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [selectedOrg, setSelectedOrg] = useState<Tenant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("adminToken") ?? "";
        const url = new URL(`${API_BASE}/super-admin/organizations`);
        url.searchParams.set("limit", String(LIMIT));
        if (currentCursor) url.searchParams.set("cursor", currentCursor);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to load tenants");

        setAllData(json.data);
        setNextCursor(json.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentCursor]);

  useEffect(() => {
    setSearchQuery("");
  }, [currentCursor]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allData;
    const q = searchQuery.toLowerCase();
    return allData.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }, [allData, searchQuery]);

  const handleNext = () => {
    if (!nextCursor) return;
    setHistory((h) => [...h, currentCursor]);
    setCurrentCursor(nextCursor);
  };
  const handlePrev = () => {
    if (!history.length) return;
    setCurrentCursor(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            setError(null);
            setCurrentCursor(null);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tenant Directory</h1>
        <p className="mt-1 text-sm text-gray-500">
          All provisioned organisations on the NexusHR platform.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search by name or slug..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-[28%]">
                Organisation
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-[20%]">
                Slug
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-[18%]">
                Created
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-[12%]">
                Plan
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-[12%]">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-[10%]" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading &&
              Array.from({ length: LIMIT }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}

            {!isLoading && filtered.length === 0 && (
              <EmptyState hasSearch={searchQuery.trim().length > 0} />
            )}

            {!isLoading &&
              filtered.map((tenant) => (
                <TableRow
                  key={tenant._id}
                  className="hover:bg-gray-50/70 transition-colors"
                >
                  <TableCell className="py-3.5 font-medium text-gray-900 text-sm">
                    {tenant.name}
                  </TableCell>
                  <TableCell className="py-3.5 font-mono text-sm text-gray-500">
                    {tenant.slug}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-gray-500">
                    {formatDate(tenant.createdAt)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge
                      className={`capitalize ${PLAN_STYLES[tenant.subscription?.plan] ?? PLAN_STYLES.free}`}
                    >
                      {tenant.subscription?.plan ?? "free"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5">
                    {tenant.isActive !== false ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Suspended
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-gray-500 hover:text-gray-900"
                      onClick={() => {
                        setSelectedOrg(tenant);
                        setIsModalOpen(true);
                      }}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page{" "}
            <span className="font-medium text-gray-900">
              {history.length + 1}
            </span>
            {filtered.length > 0 && (
              <>
                {" "}
                · {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={history.length === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!nextCursor}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {
  /* Manage Modal */
}
<ManageTenantModal
  isOpen={isModalOpen}
  onClose={() => {
    setIsModalOpen(false);
    setSelectedOrg(null);
  }}
  organization={selectedOrg as ManagedOrg | null}
  onUpdateSuccess={(updated) => {
    setAllData((prev) =>
      prev.map((t) => (t._id === updated._id ? (updated as Tenant) : t)),
    );
  }}
/>

    </div>
  );
}

