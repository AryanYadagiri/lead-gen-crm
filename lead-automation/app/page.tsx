'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../components/Navbar';
import { LeadDiscoveryView } from '../components/LeadDiscoveryView';
import { OutreachEngineView } from '../components/OutreachEngineView';
import { Lead, CampaignQueueTarget } from '../types/lead';
import { 
  getCampaignQueue, 
  clearCampaignQueue, 
  deleteCampaignQueueTarget, 
  importLeadsFile,
  getActiveCampaign,
  bulkEnrollLeads
} from '../utils/apiClient';
import { CheckCircle2 } from 'lucide-react';

function LeadOSApp() {
  const searchParams = useSearchParams();

  // Read initial tab strictly from searchParams so SSR and initial client hydration match 100%
  const tabFromUrl = searchParams.get('tab');
  const initialView: 'discovery' | 'outreach' = tabFromUrl === 'outreach' ? 'outreach' : 'discovery';

  const [activeView, setActiveView] = useState<'discovery' | 'outreach'>(initialView);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [enrolledLeads, setEnrolledLeads] = useState<Lead[]>([]);
  const [queueTargets, setQueueTargets] = useState<CampaignQueueTarget[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState<boolean>(false);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync active view strictly client-side to URL parameter & localStorage (zero server RSC requests)
  const changeActiveView = useCallback((newView: 'discovery' | 'outreach') => {
    setActiveView(newView);
    try {
      localStorage.setItem('saniti_active_view', newView);
    } catch {
      // Ignore storage errors in private browsing
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newView);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, []);

  // Fetch campaign queue targets from Spring Boot backend
  const refreshQueue = useCallback(async () => {
    try {
      setIsQueueLoading(true);
      console.log('[Page] Refreshing queue targets from backend...');
      const rawTargets = await getCampaignQueue();
      
      // Deduplicate targets by id to guarantee strict uniqueness in state
      const seenIds = new Set<string>();
      const targets = (rawTargets || []).filter((t) => {
        const idKey = String(t.id ?? t.leadId);
        if (!idKey || seenIds.has(idKey)) return false;
        seenIds.add(idKey);
        return true;
      });

      setQueueTargets(targets);
      setEnrolledLeads(
        targets.map((t, idx) => ({
          id: String(t.id || t.leadId || `tracker-${idx}`),
          name: t.name || 'Lead Target',
          title: t.title || 'Executive',
          seniority: 'Executive',
          company: t.company || 'Target Company',
          location: t.location || 'United States',
          employees: '51-200',
          revenue: 10,
          industry: t.industry || 'Software & SaaS',
          keywords: ['Enrolled', 'Outreach'],
          email: t.email,
          phone: t.phone || '',
          linkedinUrl: '',
          matchScore: 95,
          verified: true,
        }))
      );
      return targets;
    } catch (err) {
      console.error('[Page] Could not fetch queue targets:', err);
      return [];
    } finally {
      setIsQueueLoading(false);
    }
  }, []);

  const handleClearQueue = useCallback(async () => {
    try {
      console.log('[Page] handleClearQueue: calling DELETE /api/campaign/queue/clear');
      await clearCampaignQueue();
      setQueueTargets([]);
      setEnrolledLeads([]);
      setToastMessage('Campaign queue cleared successfully');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('[Page] Failed to clear queue:', err);
      setToastMessage('Failed to clear queue');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, []);

  const handleDeleteQueueTarget = useCallback(async (id: string | number) => {
    try {
      console.log(`[Page] handleDeleteQueueTarget: calling DELETE /api/campaign/queue/${id}`);
      await deleteCampaignQueueTarget(id);
      // Clean local array filtering to immediately reflect deletion without triggering state race condition
      setQueueTargets((prev) =>
        prev.filter((t) => String(t.id) !== String(id) && String(t.leadId) !== String(id))
      );
      setEnrolledLeads((prev) =>
        prev.filter((l) => String(l.id) !== String(id) && l.id !== `tracker-${id}`)
      );
      setToastMessage('Target removed from campaign queue');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error(`[Page] Failed to delete target ${id}:`, err);
      setToastMessage('Failed to remove target');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, []);

  const handleUploadFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingFile(true);
      const res = await importLeadsFile(file);
      setToastMessage(res.message || 'Leads imported successfully');
      setTimeout(() => setToastMessage(null), 3000);
      await refreshQueue();
    } catch (err: any) {
      console.error('File import error:', err);
      setToastMessage('Failed to import file');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  }, [refreshQueue]);

  // Client-only mount synchronization: checks localStorage once on mount if no ?tab= was provided in URL
  useEffect(() => {
    refreshQueue();

    const tabParam = searchParams.get('tab');
    if (!tabParam) {
      let savedTab: string | null = null;
      try {
        savedTab = localStorage.getItem('saniti_active_view');
      } catch {}

      if (savedTab === 'outreach' || savedTab === 'discovery') {
        setActiveView(savedTab);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', savedTab);
          window.history.replaceState(null, '', url.pathname + url.search);
        }
      }
    } else {
      try {
        localStorage.setItem('saniti_active_view', tabParam);
      } catch {}
    }

    const handlePopState = () => {
      const url = new URL(window.location.href);
      const tab = url.searchParams.get('tab');
      if (tab === 'outreach' || tab === 'discovery') {
        setActiveView(tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [refreshQueue]); // Run strictly once on mount

  const handleAddToOutreach = useCallback(async (leadsToAdd: Lead[]) => {
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

    // Auto-enroll to backend active campaign if available
    try {
      const camp = await getActiveCampaign();
      if (camp) {
        await bulkEnrollLeads(camp.id, leadsToAdd);
        await refreshQueue();
      }
    } catch (e) {
      console.warn('Could not auto-enroll leads to backend:', e);
    }

    // Auto-switch to outreach view with URL & localStorage persistence
    changeActiveView('outreach');
  }, [changeActiveView, refreshQueue]);

  const handleRemoveEnrolledLead = useCallback(async (id: string) => {
    await handleDeleteQueueTarget(id);
  }, [handleDeleteQueueTarget]);

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

  const displayEnrolledCount = queueTargets.length;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white flex flex-col font-sans selection:bg-[#f36458] selection:text-black">
      
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={changeActiveView}
        selectedLeadCount={selectedLeadIds.length}
        enrolledLeadCount={displayEnrolledCount}
        queueTargets={queueTargets}
        isQueueLoading={isQueueLoading}
        onClearQueue={handleClearQueue}
        onDeleteTarget={handleDeleteQueueTarget}
        onUploadFile={handleUploadFile}
        isUploadingFile={isUploadingFile}
        onRefreshQueue={refreshQueue}
      />

      {/* Toast Notification Alert Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#37cd84] text-[#0b0b0b] font-semibold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container Views with persistent min-height to prevent collapse */}
      <div className="flex-1 min-h-[calc(100vh-14rem)] w-full">
        <div className={activeView === 'discovery' ? 'block' : 'hidden'}>
          <LeadDiscoveryView
            selectedLeadIds={selectedLeadIds}
            setSelectedLeadIds={setSelectedLeadIds}
            onAddToOutreach={handleAddToOutreach}
          />
        </div>
        <div className={activeView === 'outreach' ? 'block' : 'hidden'}>
          <OutreachEngineView
            enrolledLeads={enrolledLeads}
            onRemoveEnrolledLead={handleRemoveEnrolledLead}
            onLeadsImported={handleLeadsImported}
            queueTargets={queueTargets}
            isQueueLoading={isQueueLoading}
            onClearQueue={handleClearQueue}
            onDeleteQueueTarget={handleDeleteQueueTarget}
            onUploadFile={handleUploadFile}
            isUploadingFileProp={isUploadingFile}
            onRefreshQueue={refreshQueue}
            onNavigateToDiscovery={() => changeActiveView('discovery')}
          />
        </div>
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

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0b0b]" />}>
      <LeadOSApp />
    </Suspense>
  );
}
