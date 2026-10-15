'use client';

import React, { useRef, useEffect } from 'react';
import { CampaignQueueTarget } from '../types/lead';
import { 
  Users, 
  Trash2, 
  FileSpreadsheet, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Send
} from 'lucide-react';

interface EnrolledTargetsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  queueTargets: CampaignQueueTarget[];
  isLoading: boolean;
  onClearQueue: () => Promise<void>;
  onDeleteTarget: (id: string | number) => Promise<void>;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingFile?: boolean;
  onRefresh?: () => Promise<any>;
  align?: 'left' | 'right';
}

export const EnrolledTargetsPopover: React.FC<EnrolledTargetsPopoverProps> = ({
  isOpen,
  onClose,
  queueTargets,
  isLoading,
  onClearQueue,
  onDeleteTarget,
  onUploadFile,
  isUploadingFile = false,
  onRefresh,
  align = 'right',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClearing, setIsClearing] = React.useState(false);
  const [deletingIds, setDeletingIds] = React.useState<Set<string | number>>(new Set());

  // Click-outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClearAll = async () => {
    if (queueTargets.length === 0) return;
    try {
      setIsClearing(true);
      console.log('[Popover] Initiating Clear All queue...');
      await onClearQueue();
    } catch (err) {
      console.error('[Popover] Clear All queue failed:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteItem = async (target: CampaignQueueTarget) => {
    const idToDelete = target.id;
    if (idToDelete === undefined || idToDelete === null) return;
    try {
      setDeletingIds((prev) => new Set(prev).add(idToDelete));
      console.log(`[Popover] Initiating delete for target: ${idToDelete}`);
      await onDeleteTarget(idToDelete);
    } catch (err) {
      console.error(`[Popover] Delete target ${idToDelete} failed:`, err);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(idToDelete);
        return next;
      });
    }
  };

  return (
    <div
      ref={popoverRef}
      className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 w-[440px] max-w-[95vw] bg-[#141414] border border-[#353535] rounded-xl shadow-2xl p-4 space-y-4 z-50 text-white font-sans animate-in fade-in zoom-in-95 duration-150`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Summary */}
      <div className="flex items-center justify-between border-b border-[#2c2c2c] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#212121] border border-[#353535] flex items-center justify-center">
            <Users className="w-4 h-4 text-[#37cd84]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs tracking-tight text-white">Campaign Queue</h3>
              <span className="bg-[#212121] text-[#37cd84] border border-[#37cd84]/30 text-[10px] font-mono px-2 py-0.2 rounded-full font-bold">
                {queueTargets.length}
              </span>
            </div>
            <p className="text-[10px] text-[#797979] font-mono">Active targets enrolled in sequence</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Red global Clear All button */}
          <button
            onClick={handleClearAll}
            disabled={isClearing || queueTargets.length === 0}
            className="flex items-center gap-1.5 bg-[#dd0000]/15 hover:bg-[#dd0000] text-[#f36458] hover:text-white border border-[#dd0000]/40 text-[11px] font-mono px-2.5 py-1 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            title="Wipe entire campaign queue"
          >
            <Trash2 className="w-3 h-3" />
            <span>{isClearing ? 'Clearing...' : 'Clear All'}</span>
          </button>

          {/* Close X */}
          <button
            onClick={onClose}
            className="p-1 rounded text-[#797979] hover:text-white hover:bg-[#212121] transition-colors cursor-pointer"
            title="Close Popover"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Active Queue List or Empty State */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs font-mono text-[#797979]">
          <RefreshCw className="w-5 h-5 animate-spin text-[#37cd84]" />
          <span>Syncing queue from server...</span>
        </div>
      ) : queueTargets.length === 0 ? (
        /* Empty State */
        <div className="text-center py-8 px-4 space-y-3 bg-[#0b0b0b] rounded-lg border border-[#262626]">
          <div className="w-10 h-10 rounded-full bg-[#1c1c1c] border border-[#303030] flex items-center justify-center mx-auto text-[#797979]">
            <Users className="w-5 h-5 stroke-1" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-[#b9b9b9] font-medium">No active targets enrolled.</p>
            <p className="text-[10px] text-[#797979] font-mono">
              Import a CSV/Excel sheet or select prospects from Lead Discovery.
            </p>
          </div>

          {/* Minimized clean Upload Sheet button inside empty state */}
          <label className="inline-flex items-center gap-2 bg-[#212121] hover:bg-[#353535] border border-[#353535] hover:border-[#37cd84] text-white hover:text-[#37cd84] px-3.5 py-1.5 rounded text-xs font-mono cursor-pointer transition-all shadow-sm">
            <FileSpreadsheet className={`w-3.5 h-3.5 text-[#37cd84] ${isUploadingFile ? 'animate-bounce' : ''}`} />
            <span>{isUploadingFile ? 'Parsing...' : 'Upload Sheet'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onUploadFile}
              disabled={isUploadingFile}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        /* Active Queue List */
        <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {queueTargets.map((target) => {
            const isDeleting = target.id !== undefined && deletingIds.has(target.id);
            const statusColor = 
              target.status === 'COMPLETED'
                ? 'bg-emerald-950 text-[#37cd84] border-[#37cd84]/40'
                : target.status === 'FAILED'
                ? 'bg-red-950 text-[#f36458] border-[#f36458]/40'
                : 'bg-amber-950/60 text-amber-400 border-amber-400/40';

            return (
              <div
                key={target.id}
                className={`bg-[#0b0b0b] border border-[#2a2a2a] hover:border-[#353535] p-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                  isDeleting ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Avatar Initial */}
                  <div className="w-8 h-8 rounded-full bg-[#0052ef]/20 border border-[#0052ef]/40 text-[#55beff] flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                    {(target.name || 'L').charAt(0).toUpperCase()}
                  </div>

                  {/* Target Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-semibold text-white truncate max-w-[150px]">
                        {target.name}
                      </h4>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase shrink-0 ${statusColor}`}>
                        {target.status} · Step {target.currentStep ?? target.current_step ?? 1}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#b9b9b9] truncate max-w-[210px]">
                      {target.title} · <span className="text-[#37cd84] font-mono">{target.company}</span>
                    </p>

                    {target.email && (
                      <p className="text-[10px] font-mono text-[#797979] truncate max-w-[210px]">
                        {target.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Row Eviction Action (Trash Bin Icon) */}
                <button
                  onClick={() => handleDeleteItem(target)}
                  disabled={isDeleting}
                  className="p-1.5 rounded hover:bg-[#dd0000]/20 text-[#797979] hover:text-[#f36458] transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                  title="Remove target from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Popover Footer Utilities (when targets exist) */}
      {queueTargets.length > 0 && (
        <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[11px] font-mono text-[#797979]">
          <label className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
            <FileSpreadsheet className={`w-3.5 h-3.5 text-[#37cd84] ${isUploadingFile ? 'animate-bounce' : ''}`} />
            <span>{isUploadingFile ? 'Uploading...' : 'Upload More Leads'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onUploadFile}
              disabled={isUploadingFile}
              className="hidden"
            />
          </label>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 hover:text-white cursor-pointer transition-colors"
              title="Refresh queue data"
            >
              <RefreshCw className="w-3 h-3 text-[#55beff]" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
