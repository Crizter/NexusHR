import { useEffect, useState, useCallback }   from 'react';
import { useParams, useNavigate }             from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
}                                             from '@hello-pangea/dnd';

import { toast }                              from 'sonner';
import {
  User, Mail, Star, ArrowLeft,
  Loader2, GripVertical, Sparkles,
}                                             from 'lucide-react';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { api } from '@/lib/api';
import { ScheduleInterviewModal }             from '@/components/ScheduleInterviewModal'; // ADD

// ─── Types ────────────────────────────────────────────────────────────────────
interface Candidate {
  _id:     string;
  email:   string;
  profile: {
    firstName: string;
    lastName:  string;
  };
  pipeline: {
    currentStage: ColumnId;
    status:       string;
    matchScore?:  number;
  };
}

type ColumnId = 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';

type Columns = Record<ColumnId, Candidate[]>;

// ─── Column config — order + accent colours ───────────────────────────────────
const COLUMN_CONFIG: {
  id:          ColumnId;
  label:       string;
  accent:      string;   // border-top colour
  badgeClass:  string;
}[] = [
  { id: 'Screening', label: 'Screening', accent: 'border-t-blue-400',   badgeClass: 'bg-blue-50   text-blue-700   border-blue-200'  },
  { id: 'Interview', label: 'Interview', accent: 'border-t-violet-400', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'Offer',     label: 'Offer',     accent: 'border-t-amber-400',  badgeClass: 'bg-amber-50  text-amber-700  border-amber-200'  },
  { id: 'Hired',     label: 'Hired',     accent: 'border-t-green-400',  badgeClass: 'bg-green-50  text-green-700  border-green-200'  },
  { id: 'Rejected',  label: 'Rejected',  accent: 'border-t-red-400',    badgeClass: 'bg-red-50    text-red-700    border-red-200'    },
];

const EMPTY_COLUMNS: Columns = {
  Screening: [],
  Interview: [],
  Offer:     [],
  Hired:     [],
  Rejected:  [],
};

// ─── Candidate Card ───────────────────────────────────────────────────────────
function CandidateCard({
  candidate,
  index,
}: {
  candidate: Candidate;
  index:     number;
}) {
  const initials =
    `${candidate.profile.firstName?.[0] ?? ''}${candidate.profile.lastName?.[0] ?? ''}`.toUpperCase();

  const matchScore = candidate.pipeline.matchScore;

  return (
    <Draggable draggableId={candidate._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm
            transition-shadow
            ${snapshot.isDragging
              ? 'shadow-xl ring-2 ring-violet-300 rotate-1'
              : 'hover:shadow-md hover:border-gray-200'
            }`}
        >
          <div className="flex items-start gap-3">

            {/* Drag handle */}
            <div
              {...provided.dragHandleProps}
              className="mt-0.5 cursor-grab text-gray-300 opacity-0 transition-opacity
                group-hover:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center
              rounded-full bg-gradient-to-br from-violet-500 to-blue-500
              text-xs font-semibold text-white"
            >
              {initials || <User className="h-4 w-4" />}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">
                {candidate.profile.firstName} {candidate.profile.lastName}
              </p>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{candidate.email}</span>
              </div>

              {/* Match score badge */}
              {matchScore != null && (
                <div className="mt-2 flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-medium text-gray-500">
                    {matchScore}% match
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function BoardColumn({
  config,
  candidates,
}: {
  config:     typeof COLUMN_CONFIG[number];
  candidates: Candidate[];
}) {
  return (
    <div className={`flex w-72 shrink-0 flex-col rounded-xl border border-gray-200
      bg-gray-50 shadow-sm border-t-4 ${config.accent}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">{config.label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold
          ${config.badgeClass}`}
        >
          {candidates.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={config.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3
              min-h-[120px] rounded-b-xl transition-colors
              ${snapshot.isDraggingOver ? 'bg-gray-100' : ''}`}
          >
            {candidates.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-1 items-center justify-center py-8">
                <p className="text-xs text-gray-400">No candidates</p>
              </div>
            )}

            {candidates.map((candidate, index) => (
              <CandidateCard
                key={candidate._id}
                candidate={candidate}
                index={index}
              />
            ))}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function JobBoard() {
  const { jobId }   = useParams<{ jobId: string }>();
  const navigate    = useNavigate();

  const [columns,   setColumns]   = useState<Columns>(EMPTY_COLUMNS);
  const [isLoading, setIsLoading] = useState(true);
  const [jobTitle,  setJobTitle]  = useState<string>('');
  const [esRanked,  setEsRanked]  = useState(false);   // ADD

  // ── Zoom modal state ──────────────────────────────────────────────────────
  const [isModalOpen,       setIsModalOpen]        = useState(false);         // ADD
  const [selectedCandidate, setSelectedCandidate]  = useState<Candidate | null>(null);  // ADD

  useEffect(() => {
    if (!jobId) return;

    const load = async () => {
      try {
        setIsLoading(true);

        const { candidates, esRanked } = await api.getCandidatesByJob(jobId);   // UPDATED

        setEsRanked(esRanked);   // ADD

        const grouped: Columns = {
          Screening: [],
          Interview: [],
          Offer:     [],
          Hired:     [],
          Rejected:  [],
        };

        candidates.forEach(c => {
          const stage = c.pipeline.currentStage;
          if (grouped[stage]) {
            grouped[stage].push(c);
          } else {
            grouped['Screening'].push(c);
          }
        });

        setColumns(grouped);

      } catch (err) {
        console.error('[JobBoard] Failed to load candidates:', err);
        toast.error('Failed to load candidates. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [jobId]);

  // ── Drag end handler ──────────────────────────────────────────────────────
  const onDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index       === destination.index
    ) return;

    const sourceCol = source.droppableId      as ColumnId;
    const destCol   = destination.droppableId as ColumnId;

    const previousColumns = structuredClone(columns);

    // Optimistic update
    setColumns(prev => {
      const updated = structuredClone(prev);
      const [moved] = updated[sourceCol].splice(source.index, 1);
      moved.pipeline.currentStage = destCol;
      updated[destCol].splice(destination.index, 0, moved);
      return updated;
    });

    // Persist stage change
    try {
      await api.updateCandidateStage(draggableId, destCol);
    } catch (err) {
      console.error('[JobBoard] Stage update failed — reverting:', err);
      setColumns(previousColumns);
      toast.error('Failed to update candidate stage. Please try again.');
      return;   // don't open modal if the stage update itself failed
    }

    // ── Open Zoom modal when dropped into Interview column ────────────────
    if (destCol === 'Interview') {                                              // ADD
      // Find the moved candidate from the previous snapshot so we have the
      // full object (name, email) — not just the draggableId string
      const movedCandidate = previousColumns[sourceCol].find(           // ADD
        c => c._id === draggableId
      ) ?? null;

      setSelectedCandidate(movedCandidate);                              // ADD
      setIsModalOpen(true);                                              // ADD
    }

  }, [columns]);

  // ── Modal callbacks ───────────────────────────────────────────────────────
  const handleModalClose = () => {                                             // ADD
    setIsModalOpen(false);
    setSelectedCandidate(null);
  };

  const handleScheduleSuccess = (joinUrl: string) => {                        // ADD
    // Copy join URL to clipboard so recruiter can paste it into an email
    navigator.clipboard.writeText(joinUrl).catch(() => {});
    toast.success('Join URL copied to clipboard!', {
      description: 'Paste it into your email to the candidate.',
    });
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full flex-col space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
          <div className="space-y-1.5">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_CONFIG.map(col => (
            <div
              key={col.id}
              className={`flex w-72 shrink-0 flex-col rounded-xl border border-gray-200
                bg-gray-50 border-t-4 ${col.accent}`}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-6 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="flex flex-col gap-2.5 px-3 pb-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Board ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {jobTitle || 'Recruitment Pipeline'}
            </h1>

          </div>
          <p className="text-xs text-gray-500">
            {Object.values(columns).flat().length} total candidates
            {esRanked && ' · sorted by resume match score'}
          </p>
        </div>
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMN_CONFIG.map(config => (
            <BoardColumn
              key={config.id}
              config={config}
              candidates={columns[config.id]}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Zoom scheduling modal — rendered outside the board scroll container */}
      <ScheduleInterviewModal                                                  // ADD
        isOpen={isModalOpen}
        onClose={handleModalClose}
        candidate={selectedCandidate}
        jobTitle={jobTitle}
        onScheduleSuccess={handleScheduleSuccess}
      />

    </div>
  );
}

