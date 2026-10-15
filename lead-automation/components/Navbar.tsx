'use client';

import React, { useState } from 'react';
import { Search, Send, Sparkles, Users, ChevronDown } from 'lucide-react';
import { CampaignQueueTarget } from '../types/lead';
import { EnrolledTargetsPopover } from './EnrolledTargetsPopover';

interface NavbarProps {
  activeView: 'discovery' | 'outreach';
  setActiveView: (view: 'discovery' | 'outreach') => void;
  selectedLeadCount: number;
  enrolledLeadCount: number;
  queueTargets?: CampaignQueueTarget[];
  isQueueLoading?: boolean;
  onClearQueue?: () => Promise<void>;
  onDeleteTarget?: (id: string | number) => Promise<void>;
  onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingFile?: boolean;
  onRefreshQueue?: () => Promise<any>;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  selectedLeadCount,
  enrolledLeadCount,
  queueTargets,
  isQueueLoading,
  onClearQueue,
  onDeleteTarget,
  onUploadFile,
  isUploadingFile,
  onRefreshQueue,
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  return (
    <header className="w-full bg-[#0b0b0b] border-b border-[#353535] sticky top-0 z-50">
      <div className="max-w-[1640px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Lockup */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveView('discovery')}>
            <span className="w-3 h-3 rounded-full bg-[#f36458] inline-block animate-pulse" />
            <span className="text-xl font-semibold tracking-tight text-white font-sans">
              Saniti <span className="text-[#f36458] font-mono text-xs uppercase tracking-widest font-normal ml-1">LeadOS</span>
            </span>
          </div>
        </div>

        {/* Primary View Switcher */}
        <nav className="flex items-center bg-[#212121] p-1 rounded-full border border-[#353535]">
          <button
            onClick={() => setActiveView('discovery')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium transition-colors duration-150 ${
              activeView === 'discovery'
                ? 'bg-white text-[#0b0b0b] shadow-md'
                : 'text-[#b9b9b9] hover:text-white hover:bg-[#353535]/50'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Lead Discovery & Filtering</span>
            {selectedLeadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#f36458] text-white">
                {selectedLeadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('outreach')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium transition-colors duration-150 ${
              activeView === 'outreach'
                ? 'bg-white text-[#0b0b0b] shadow-md'
                : 'text-[#b9b9b9] hover:text-white hover:bg-[#353535]/50'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Automated Outreach Engine</span>
            {enrolledLeadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#37cd84] text-[#0b0b0b] font-bold">
                {enrolledLeadCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Status Actions */}
        <div className="flex items-center space-x-3">
          {/* Enrolled Targets Queue Mini-Dashboard Popover Window */}
          {queueTargets !== undefined && (
            <div className="relative">
              <button
                onClick={() => {
                  const nextState = !isPopoverOpen;
                  setIsPopoverOpen(nextState);
                  if (nextState && onRefreshQueue) {
                    onRefreshQueue();
                  }
                }}
                className="flex items-center gap-2 bg-[#212121] hover:bg-[#2c2c2c] border border-[#353535] hover:border-[#37cd84] text-white px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer shadow-sm"
                title="View Enrolled Targets Queue Mini-Dashboard"
              >
                <Users className="w-3.5 h-3.5 text-[#f36458]" />
                <span className="hidden sm:inline">Queue:</span>
                <strong className="text-[#37cd84]">{enrolledLeadCount}</strong>
                <ChevronDown className={`w-3 h-3 text-[#797979] transition-transform ${isPopoverOpen ? 'rotate-180' : ''}`} />
              </button>

              {onClearQueue && onDeleteTarget && onUploadFile && (
                <EnrolledTargetsPopover
                  isOpen={isPopoverOpen}
                  onClose={() => setIsPopoverOpen(false)}
                  queueTargets={queueTargets}
                  isLoading={isQueueLoading || false}
                  onClearQueue={onClearQueue}
                  onDeleteTarget={onDeleteTarget}
                  onUploadFile={onUploadFile}
                  isUploadingFile={isUploadingFile}
                  onRefresh={onRefreshQueue}
                />
              )}
            </div>
          )}

          <button className="hidden lg:flex items-center gap-1.5 bg-[#f36458] text-[#0b0b0b] hover:bg-[#f36458]/90 font-medium text-xs px-4 py-2 rounded-full transition-all duration-200 shadow-sm cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </button>
        </div>

      </div>
    </header>
  );
};
