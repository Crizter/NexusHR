import { useState, useEffect }  from 'react';
import { api }                  from '@/lib/api';
import { toast }                from 'sonner';
import {
  Video, X, Calendar, Clock,
  FileText, Loader2, ExternalLink,
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Candidate {
  _id:     string;
  email:   string;
  profile: { firstName: string; lastName: string };
}

interface Props {
  isOpen:            boolean;
  onClose:           () => void;
  candidate:         Candidate | null;
  jobTitle:          string;
  onScheduleSuccess: (joinUrl: string) => void;
}

// ─── Helper — format datetime-local min value (now + 15 min) ─────────────────
const getMinDateTime = () => {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  return d.toISOString().slice(0, 16);
};

// ─── Component ────────────────────────────────────────────────────────────────
export function ScheduleInterviewModal({
  isOpen,
  onClose,
  candidate,
  jobTitle,
  onScheduleSuccess,
}: Props) {
  const defaultTopic = candidate
    ? `Interview: ${candidate.profile.firstName} ${candidate.profile.lastName} — ${jobTitle}`
    : '';

  const [topic,        setTopic]        = useState(defaultTopic);
  const [startTime,    setStartTime]    = useState('');
  const [duration,     setDuration]     = useState(45);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-seed topic when candidate changes (e.g. modal reused for different card)
  useEffect(() => {
    if (candidate) {
      setTopic(
        `Interview: ${candidate.profile.firstName} ${candidate.profile.lastName} — ${jobTitle}`
      );
    }
  }, [candidate, jobTitle]);

  if (!isOpen || !candidate) return null;

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic.trim())   return toast.error('Please enter a meeting topic.');
    if (!startTime)      return toast.error('Please select a start date and time.');
    if (duration <= 0)   return toast.error('Duration must be greater than 0.');

    // Convert datetime-local string to ISO 8601
    const isoStartTime = new Date(startTime).toISOString();

    try {
      setIsSubmitting(true);

      const result = await api.scheduleInterview(candidate._id, {
        topic:     topic.trim(),
        startTime: isoStartTime,
        duration,
      });

      toast.success('Zoom interview scheduled!', {
        description: `Join URL copied — send it to ${candidate.profile.firstName}.`,
        duration:    6000,
      });

      onScheduleSuccess(result.join_url);
      onClose();

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule interview.';

      if (message.toLowerCase().includes('zoom')) {
        toast.error('Zoom not connected.', {
          description: 'Go to Organization Settings → Integrations to connect Zoom.',
        });
      } else {
        toast.error('Could not schedule interview.', { description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
        bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-200
          bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg
              bg-violet-100"
            >
              <Video className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-base font-semibold text-gray-900"
              >
                Schedule Zoom Interview
              </h2>
              <p className="text-xs text-gray-400">
                {candidate.profile.firstName} {candidate.profile.lastName} · {candidate.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100
              hover:text-gray-600 disabled:opacity-40 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">

          {/* Topic */}
          <div className="space-y-1.5">
            <Label htmlFor="topic" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              Meeting Topic
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Senior Engineer Interview — Round 1"
              disabled={isSubmitting}
            />
          </div>

          {/* Start time */}
          <div className="space-y-1.5">
            <Label htmlFor="startTime" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              Date & Time
            </Label>
            <Input
              id="startTime"
              type="datetime-local"
              value={startTime}
              min={getMinDateTime()}
              onChange={e => setStartTime(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label htmlFor="duration" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              Duration (minutes)
            </Label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setDuration(min)}
                  disabled={isSubmitting}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium
                    transition-colors
                    ${duration === min
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                >
                  {min}m
                </button>
              ))}
              {/* Custom input */}
              <Input
                type="number"
                min={15}
                max={480}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-20 text-center text-xs"
                aria-label="Custom duration in minutes"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><ExternalLink className="mr-2 h-4 w-4" />Generate Zoom Link</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}