'use client';

import React, { useState, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { LeadDiscoveryView } from '../components/LeadDiscoveryView';
import { OutreachEngineView } from '../components/OutreachEngineView';
import { INITIAL_LEADS } from '../data/mockLeads';
import { Lead } from '../types/lead';
import { CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [activeView, setActiveView] = useState<'discovery' | 'outreach'>('discovery');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(['lead-1', 'lead-2']);
  const [enrolledLeads, setEnrolledLeads] = useState<Lead[]>(INITIAL_LEADS.slice(0, 3));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAddToOutreach = useCallback((leadsToAdd: Lead[]) => {
    setEnrolledLeads((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const newLeads = leadsToAdd.filter((l) => !existingIds.has(l.id));
      if (newLeads.length === 0) return prev;
      return [...prev, ...newLeads];
    });

    setToastMessage(`Successfully added ${leadsToAdd.length} leads to Outreach Sequence!`);
    
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);

    // Auto-switch to outreach view for smooth UX
    setActiveView('outreach');
  }, []);

  const handleRemoveEnrolledLead = useCallback((id: string) => {
    setEnrolledLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handleLeadsImported = useCallback((importedLeads: Lead[]) => {
    setEnrolledLeads((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const existingEmails = new Set(
        prev.map((l) => l.email?.toLowerCase()).filter(Boolean)
      );

      const seenInBatch = new Set<string>();
      const newUnique: Lead[] = [];

      for (const lead of importedLeads) {
        const emailKey = lead.email ? lead.email.toLowerCase() : null;
        const isDuplicateEmail = emailKey && existingEmails.has(emailKey);
        const isDuplicateId = existingIds.has(lead.id) || seenInBatch.has(lead.id);

        if (!isDuplicateEmail && !isDuplicateId) {
          if (emailKey) existingEmails.add(emailKey);
          seenInBatch.add(lead.id);
          existingIds.add(lead.id);
          newUnique.push(lead);
        }
      }

      if (newUnique.length === 0) {
        return prev;
      }

      return [...prev, ...newUnique];
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white flex flex-col font-sans selection:bg-[#f36458] selection:text-black">
      
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        selectedLeadCount={selectedLeadIds.length}
        enrolledLeadCount={enrolledLeads.length}
      />

      {/* Toast Notification Alert Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#37cd84] text-[#0b0b0b] font-semibold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container Views */}
      <div className="flex-1">
        {activeView === 'discovery' ? (
          <LeadDiscoveryView
            selectedLeadIds={selectedLeadIds}
            setSelectedLeadIds={setSelectedLeadIds}
            onAddToOutreach={handleAddToOutreach}
          />
        ) : (
          <OutreachEngineView
            enrolledLeads={enrolledLeads}
            onRemoveEnrolledLead={handleRemoveEnrolledLead}
            onLeadsImported={handleLeadsImported}
          />
        )}
      </div>

      {/* Footer following DESIGN.md */}
      <footer className="w-full bg-[#0b0b0b] border-t border-[#353535] mt-12 py-8">
        <div className="max-w-[1640px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#797979]">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f36458] inline-block" />
            <span className="text-white font-semibold font-sans">Saniti LeadOS System</span>
            <span>· Automated Outreach & Lead Generation Platform</span>
          </div>

          <div className="flex items-center space-x-6">
            <span className="hover:text-white cursor-pointer">Documentation</span>
            <span className="hover:text-white cursor-pointer">API Schema</span>
            <span className="hover:text-white cursor-pointer">Meta Business Cloud</span>
            <span className="text-[#37cd84]">● All Systems Operational</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
