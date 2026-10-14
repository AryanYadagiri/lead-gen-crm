'use client';

import React from 'react';
import { Search, Send, Sparkles, Database, Users, ShieldCheck, Cpu } from 'lucide-react';

interface NavbarProps {
  activeView: 'discovery' | 'outreach';
  setActiveView: (view: 'discovery' | 'outreach') => void;
  selectedLeadCount: number;
  enrolledLeadCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  selectedLeadCount,
  enrolledLeadCount,
}) => {
  return (
    <header className="w-full bg-[#0b0b0b] border-b border-[#353535] sticky top-0 z-50 transition-all duration-200">
      <div className="max-w-[1640px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Lockup */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveView('discovery')}>
            <span className="w-3 h-3 rounded-full bg-[#f36458] inline-block animate-pulse" />
            <span className="text-xl font-semibold tracking-tight text-white font-sans">
              Saniti <span className="text-[#f36458] font-mono text-xs uppercase tracking-widest font-normal ml-1">LeadOS</span>
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-1 pl-4 border-l border-[#353535]">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[#37cd84] border border-[#353535] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#37cd84]" /> Live Pipeline
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[#b9b9b9]">
              Lead Database Connected
            </span>
          </div>
        </div>

        {/* Primary View Switcher */}
        <nav className="flex items-center bg-[#212121] p-1 rounded-full border border-[#353535]">
          <button
            onClick={() => setActiveView('discovery')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeView === 'discovery'
                ? 'bg-white text-[#0b0b0b] shadow-md font-semibold'
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
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeView === 'outreach'
                ? 'bg-white text-[#0b0b0b] shadow-md font-semibold'
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
        <div className="hidden lg:flex items-center space-x-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#b9b9b9] bg-[#212121] px-3 py-1.5 rounded-[4px] border border-[#353535]">
            <Cpu className="w-3.5 h-3.5 text-[#f36458]" />
            <span>Enrichment: <strong className="text-white">Active</strong></span>
          </div>

          <button className="flex items-center gap-1.5 bg-[#f36458] text-[#0b0b0b] hover:bg-[#f36458]/90 font-medium text-xs px-4 py-2 rounded-full transition-all duration-200 shadow-sm cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </button>
        </div>

      </div>
    </header>
  );
};
