import { useRef, useState, useCallback } from 'react';
import axios                             from 'axios';
import axiosInstance                     from '@/lib/axios';
import { Camera, Loader2, X, Check, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreSignedUrlResponse {
  uploadUrl:  string;   // S3 pre-signed PUT url
  publicUrl:  string;   // CloudFront CDN url — saved to DB
  fileKey:    string;   // S3 object key e.g. "profile-pictures/userId-timestamp.webp"
}

interface ProfilePictureUploadProps {
  /** Current avatar url from the DB (CloudFront) — shown as initial preview */
  currentAvatarUrl?: string | null;
  /** User's initials — shown as fallback when no image is set */
  initials: string;
  /** Called after the complete 3-step upload succeeds, with the new CDN url */
  onSuccess: (publicUrl: string) => void;
}

// ─── Validation constants ─────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;   // 5 MB
const ALLOWED_TYPES       = ['image/jpeg', 'image/png', 'image/webp'] as const;
type  AllowedType         = typeof ALLOWED_TYPES[number];

// ─── Component ────────────────────────────────────────────────────────────────
export function ProfilePictureUpload({
  currentAvatarUrl,
  initials,
  onSuccess,
}: ProfilePictureUploadProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedFile,    setSelectedFile]    = useState<File | null>(null);
  const [previewUrl,      setPreviewUrl]      = useState<string | null>(null);
  const [isUploading,     setIsUploading]     = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);      // 0-100
  const [errorMessage,    setErrorMessage]    = useState<string | null>(null);

  // Hidden <input> ref — triggered programmatically on button click
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection & validation ────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Clear previous error on every new selection attempt
      setErrorMessage(null);

      const file = e.target.files?.[0];
      if (!file) return;

      // ── Type validation ──────────────────────────────────────────────────
      if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
        setErrorMessage('Only JPEG, PNG, and WebP images are allowed.');
        // Reset the input so the same file can be re-selected after correction
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // ── Size validation ──────────────────────────────────────────────────
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`File is too large. Maximum size is 5 MB (yours: ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // ── Revoke previous object URL to avoid memory leaks ─────────────────
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      // ── Create local blob preview — instant, no network needed ───────────
      const objectUrl = URL.createObjectURL(file);
      setSelectedFile(file);
      setPreviewUrl(objectUrl);
      setUploadProgress(0);
    },
    [previewUrl]
  );

  // ── Cancel — discard selection ─────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  // ── The 3-step upload dance ────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      // ── Step 1: Get pre-signed URL from our backend ───────────────────────
      // Backend validates file type server-side and generates a scoped S3 key
      const { data: presigned } = await axiosInstance.post<PreSignedUrlResponse>(
        '/profile/profile-pic-upload-url',
        { fileType: selectedFile.type }
      );

      // ── Step 2: PUT directly to S3 using the pre-signed URL ───────────────
      // CRITICAL: Content-Type header MUST match exactly what was signed.
      // AWS verifies the signature includes this header — any mismatch = 403.
      // We do NOT use axiosInstance here — the pre-signed URL is a direct S3
      // endpoint and must NOT have our Authorization header attached.
      await axios.put(presigned.uploadUrl, selectedFile, {
        headers: {
          // Exact match to what we sent in Step 1 — S3 enforces this
          'Content-Type': selectedFile.type,
        },
        // Real-time progress — S3 sends progress events during the PUT
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            );
            setUploadProgress(pct);
          }
        },
      });

      // ── Step 3: Save the CloudFront public URL to MongoDB via our backend ──
      // We store the CDN url (not the S3 url) so the app always uses the fast
      // CloudFront edge-cached version
      await axiosInstance.patch('/profile/info', {
        avatarUrl: presigned.publicUrl,
      });

      // ── Success — clean up local state ────────────────────────────────────
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Notify parent so it can update the AuthContext / navbar avatar
      onSuccess(presigned.publicUrl);

    } catch (err) {
      // Friendly error messages for common failure modes
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 403) {
          // S3 signature mismatch — usually a Content-Type header problem
          setErrorMessage('Upload rejected by storage. Please try again.');
        } else if (err.response?.status === 413) {
          setErrorMessage('File exceeds server limit. Please choose a smaller image.');
        } else {
          const msg = err.response?.data?.message ?? err.message;
          setErrorMessage(msg || 'Upload failed. Please try again.');
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }

      // Reset progress on failure so the progress bar disappears
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // ── The image to display ───────────────────────────────────────────────────
  // Priority: local blob preview > existing CDN url > initials fallback
  const displaySrc = previewUrl ?? currentAvatarUrl ?? null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4">

      {/* ── Avatar ring ───────────────────────────────────────────────────── */}
      <div className="relative group">
        {/* Circular avatar */}
        <div
          className={`
            h-24 w-24 rounded-full overflow-hidden ring-4 ring-white shadow-md
            flex items-center justify-center
            ${displaySrc ? 'bg-transparent' : 'bg-indigo-100'}
          `}
        >
          {displaySrc ? (
            <img
              src={displaySrc}
              alt="Profile picture"
              className="h-full w-full object-cover"
            />
          ) : (
            // Initials fallback
            <span className="text-2xl font-bold text-indigo-600 select-none">
              {initials}
            </span>
          )}
        </div>

        {/* Camera overlay button — appears on hover unless uploading */}
        {!isUploading && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="
              absolute inset-0 rounded-full
              flex items-center justify-center
              bg-black/40 opacity-0 group-hover:opacity-100
              transition-opacity duration-200
              cursor-pointer
            "
            aria-label="Change profile picture"
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
        )}

        {/* Uploading spinner overlay */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      {/* ── Change picture button — shown when no file is selected ────────── */}
      {!selectedFile && !isUploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs"
        >
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          {currentAvatarUrl ? 'Change Picture' : 'Upload Picture'}
        </Button>
      )}

      {/* ── Save / Cancel — only shown when a file is staged ─────────────── */}
      {selectedFile && !isUploading && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleUpload}
            className="text-xs"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Save Photo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="text-xs text-gray-500"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      )}

      {/* ── Upload progress bar ───────────────────────────────────────────── */}
      {isUploading && (
        <div className="w-full max-w-[200px] space-y-1">
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-indigo-600 transition-all duration-200 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-center text-xs text-gray-500 tabular-nums">
            {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Saving…'}
          </p>
        </div>
      )}

      {/* ── File info — shown when a file is staged ───────────────────────── */}
      {selectedFile && !isUploading && (
        <p className="text-xs text-gray-400 text-center max-w-[200px] truncate">
          {selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB
        </p>
      )}

      {/* ── Error message ─────────────────────────────────────────────────── */}
      {errorMessage && (
        <p className="text-xs text-red-600 text-center max-w-[220px]">
          {errorMessage}
        </p>
      )}
    </div>
  );
}