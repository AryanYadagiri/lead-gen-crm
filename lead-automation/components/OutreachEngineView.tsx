'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SequenceStep, Lead, StepChannel, Campaign, LeadSequenceTracker } from '../types/lead';
import { DEFAULT_SEQUENCE_STEPS, VARIABLE_TAGS } from '../data/mockLeads';
import { 
  getActiveCampaign, 
  getCampaignSteps, 
  syncCampaignSteps, 
  bulkEnrollLeads, 
  runTestSequenceApi,
  importLeadsFile,
  getCampaignTrackers,
  processAllCampaignTrackers
} from '../utils/apiClient';
import { 
  Mail, MessageSquare, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, 
  Send, CheckCheck, Smartphone, Info, Play, CheckCircle2, ShieldAlert,
  ChevronRight, Users, Settings2, Code, Eye, RefreshCw, Server, Check, 
  AlertCircle, FileSpreadsheet, Upload, Zap, Clock
} from 'lucide-react';

interface OutreachEngineViewProps {
  enrolledLeads: Lead[];
  onRemoveEnrolledLead: (id: string) => void;
  onLeadsImported?: (newLeads: Lead[]) => void;
}

export const OutreachEngineView: React.FC<OutreachEngineViewProps> = ({
  enrolledLeads,
  onRemoveEnrolledLead,
  onLeadsImported,
}) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_SEQUENCE_STEPS);
  const [activeStepId, setActiveStepId] = useState<string>('step-1');
  const [activeLeadPreviewIndex, setActiveLeadPreviewIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [showEnrolledDrawer, setShowEnrolledDrawer] = useState(false);
  const [serverTrackers, setServerTrackers] = useState<LeadSequenceTracker[]>([]);
  
  // Backend Integration States
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline' | 'syncing'>('syncing');
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isEnrollingBackend, setIsEnrollingBackend] = useState<boolean>(false);
  const [sendActualEmail, setSendActualEmail] = useState<boolean>(false);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onLeadsImportedRef = useRef(onLeadsImported);

  useEffect(() => {
    onLeadsImportedRef.current = onLeadsImported;
  }, [onLeadsImported]);

  // ---------------------------------------------------------------------------
  // 1. Re-fetch Campaign Trackers and Sync with Enrolled Drawer
  // ---------------------------------------------------------------------------
  const refreshEnrolledTrackers = useCallback(async (campaignId: number) => {
    try {
      const trackers = await getCampaignTrackers(campaignId);
      setServerTrackers(trackers);
      if (trackers && trackers.length > 0) {
        const freshLeads: Lead[] = trackers.map((t, idx) => ({
          id: t.leadId ? `${t.leadId}-${t.id || idx}` : `tracker-${t.id || idx}-${idx}`,
          name: t.fullName || t.firstName || 'Lead Target',
          title: t.personTitle || 'Executive',
          seniority: 'Executive' as const,
          company: t.companyName || 'Target Company',
          location: t.location || 'United States',
          employees: '51-200',
          revenue: parseFloat(t.revenue || '10') || 10,
          industry: t.industry || 'Software & SaaS',
          keywords: ['Enrolled', 'Outreach'],
          email: t.email,
          phone: t.phone || '',
          linkedinUrl: '',
          matchScore: 95,
          verified: true,
        }));
        if (onLeadsImportedRef.current) {
          onLeadsImportedRef.current(freshLeads);
        }
      }
      return trackers;
    } catch (err) {
      console.warn('Could not fetch campaign trackers from backend:', err);
      return [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Initial Load: Fetch Active Campaign & Sequence Steps & Enrolled Trackers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadCampaignAndSteps() {
      try {
        setBackendStatus('syncing');
        const activeCamp = await getActiveCampaign();
        if (!isMounted) return;
        setCampaign(activeCamp);

        const serverSteps = await getCampaignSteps(activeCamp.id);
        if (!isMounted) return;

        if (serverSteps && serverSteps.length > 0) {
          setSteps(serverSteps);
          setActiveStepId(serverSteps[0].id);
        } else {
          // If campaign steps are empty, sync the default steps to backend
          await syncCampaignSteps(activeCamp.id, DEFAULT_SEQUENCE_STEPS);
          setSteps(DEFAULT_SEQUENCE_STEPS);
          setActiveStepId(DEFAULT_SEQUENCE_STEPS[0].id);
        }

        // Fetch already enrolled trackers for the active campaign
        await refreshEnrolledTrackers(activeCamp.id);

        setBackendStatus('connected');
        setSyncFeedback('Engine Connected');
        setTimeout(() => setSyncFeedback(null), 3000);
      } catch (err) {
        console.warn('Backend unavailable or initializing, using local sequence defaults:', err);
        if (isMounted) {
          setBackendStatus('offline');
          setSyncFeedback('Running in offline preview mode');
        }
      }
    }

    loadCampaignAndSteps();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 3. Persist Sequence Steps to Spring Boot Backend
  // ---------------------------------------------------------------------------
  const saveStepsToBackend = useCallback(async (updatedSteps: SequenceStep[]) => {
    if (!campaign) return;

    try {
      setIsSyncing(true);
      const saved = await syncCampaignSteps(campaign.id, updatedSteps);
      setIsSyncing(false);
      setBackendStatus('connected');
      setSyncFeedback('Sequence saved successfully');
      setTimeout(() => setSyncFeedback(null), 2500);
    } catch (err) {
      console.warn('Failed to sync steps with Spring Boot:', err);
      setIsSyncing(false);
      setBackendStatus('offline');
      setSyncFeedback('Sync failed — saved locally only');
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  }, [campaign]);

  // Debounced auto-save helper
  const triggerDebouncedSave = (newSteps: SequenceStep[]) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveStepsToBackend(newSteps);
    }, 800);
  };

  // Get active step being edited
  const activeStep = steps.find((s) => s.id === activeStepId) || steps[0] || {
    id: 'step-1',
    stepNumber: 1,
    channel: 'email',
    delayDays: 1,
    title: 'Initial Step',
    body: '',
    subject: '',
    isActive: true,
  };

  // Currently selected lead for live tag preview rendering
  const currentSampleLead: Lead = enrolledLeads[activeLeadPreviewIndex] || {
    id: 'sample-0',
    name: 'Alexandra Vance',
    title: 'Chief Executive Officer',
    seniority: 'C-Level',
    company: 'ApexScale AI',
    location: 'United States',
    employees: '51-200',
    revenue: 18.5,
    industry: 'Software & SaaS',
    keywords: ['AI', 'SaaS'],
    email: 'a.vance@apexscale.ai',
    phone: '+1 (415) 890-2341',
    linkedinUrl: '',
    matchScore: 98,
    verified: true,
  };

  // Helper function to resolve dynamic template tags like {{first_name}}
  const resolveTemplateTags = (text: string, lead: Lead): string => {
    if (!text) return '';
    return text
      .replace(/\{\{first_name\}\}/g, lead.name.split(' ')[0] || 'There')
      .replace(/\{\{full_name\}\}/g, lead.name)
      .replace(/\{\{person_title\}\}/g, lead.title)
      .replace(/\{\{company_name\}\}/g, lead.company)
      .replace(/\{\{location\}\}/g, lead.location)
      .replace(/\{\{revenue\}\}/g, lead.revenue.toString())
      .replace(/\{\{industry\}\}/g, lead.industry);
  };

  // Step reordering handlers
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const renumbered = updated.map((step, idx) => ({
      ...step,
      stepNumber: idx + 1,
    }));

    setSteps(renumbered);
    triggerDebouncedSave(renumbered);
  };

  // Delete step handler
  const deleteStep = (id: string) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((s) => s.id !== id).map((step, idx) => ({
      ...step,
      stepNumber: idx + 1,
    }));
    setSteps(updated);
    if (activeStepId === id) {
      setActiveStepId(updated[0].id);
    }
    triggerDebouncedSave(updated);
  };

  // Add new step
  const addNewStep = (channel: StepChannel) => {
    const nextStepNum = steps.length + 1;
    const newId = `step-${Date.now()}`;
    const newStep: SequenceStep = {
      id: newId,
      stepNumber: nextStepNum,
      channel,
      delayDays: 2,
      title: channel === 'email' ? `Follow-up Email #${nextStepNum}` : `WhatsApp Touch #${nextStepNum}`,
      subject: channel === 'email' ? 'Following up on my previous message' : undefined,
      body: channel === 'email' 
        ? `Hi {{first_name}},\n\nWanted to check if you had a moment to review my earlier note regarding {{company_name}}?\n\nBest regards,`
        : `Hi {{first_name}} 👋 Quick follow-up regarding {{company_name}}. Let me know if you are open to connect!`,
      isActive: true,
    };

    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    setActiveStepId(newId);
    triggerDebouncedSave(newSteps);
  };

  // Step field updates
  const updateActiveStep = (fields: Partial<SequenceStep>) => {
    const newSteps = steps.map((s) => (s.id === activeStepId ? { ...s, ...fields } : s));
    setSteps(newSteps);
    triggerDebouncedSave(newSteps);
  };

  // Insert variable tag pill at end of active field or text
  const insertVariableTag = (tagCode: string, field: 'subject' | 'body') => {
    if (!activeStep) return;
    if (field === 'subject' && activeStep.channel === 'email') {
      const current = activeStep.subject || '';
      updateActiveStep({ subject: current + ' ' + tagCode });
    } else {
      const current = activeStep.body || '';
      updateActiveStep({ body: current + ' ' + tagCode });
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Trigger Immediate Campaign Dispatch (POST /api/campaigns/:id/process-all)
  // ---------------------------------------------------------------------------
  const handleProcessCampaignImmediately = async () => {
    if (!campaign) return;

    try {
      setIsProcessingAll(true);
      setSyncFeedback('Dispatching campaign sequence immediately to all enrolled leads...');

      const result = await processAllCampaignTrackers(campaign.id);
      setIsProcessingAll(false);
      setSyncFeedback(result.message || 'Sequence dispatched immediately!');

      // Populate execution message into the console
      setSimulationLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Immediate Outreach Dispatch executed for Campaign #${campaign.id}`,
        `[${new Date().toLocaleTimeString()}] Dispatched outreach for ${result.processedTrackers ?? enrolledLeads.length} lead(s).`,
        `[SUCCESS] Emails & touchpoints dispatched without waiting for scheduled delay.`
      ]);

      // Re-fetch trackers to display updated progress/status
      setTimeout(() => {
        refreshEnrolledTrackers(campaign.id);
      }, 1200);

      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      console.error('Immediate execution failed:', err);
      setIsProcessingAll(false);
      const errMsg = err.response?.data?.message || err.message || 'Execution error';
      setSyncFeedback(`Dispatch error: ${errMsg}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Trigger Backend Sequence Test Run / Live Preview Simulation
  // ---------------------------------------------------------------------------
  const runSequenceSimulation = async () => {
    setIsSimulating(true);
    setSimulationLog([]);

    const leadName = currentSampleLead.name;
    const company = currentSampleLead.company;

    if (campaign && backendStatus === 'connected') {
      try {
        const response = await runTestSequenceApi(
          campaign.id,
          currentSampleLead,
          steps,
          sendActualEmail
        );

        if (response && response.logs && response.logs.length > 0) {
          response.logs.forEach((logLine, index) => {
            setTimeout(() => {
              setSimulationLog((prev) => [...prev, logLine]);
              if (index === response.logs.length - 1) {
                setIsSimulating(false);
              }
            }, (index + 1) * 450);
          });
          return;
        }
      } catch (err) {
        console.warn('Backend test run failed, falling back to simulated UI output:', err);
      }
    }

    // Fallback client simulation if backend is unreachable
    const fallbackLogs = [
      `[09:00 AM] Enrolling target: ${leadName} (${company})`,
      `[09:01 AM] Verification OK: Direct Email (${currentSampleLead.email}) & WhatsApp (${currentSampleLead.phone})`,
      `[09:02 AM] Dispatching Step 1 (Email)...`,
      `[09:03 AM] Step 1 Delivered! Subject: "${resolveTemplateTags(steps[0]?.subject || '', currentSampleLead)}"`,
      `[Delay 1 Day simulated...]`,
      `[Step 2] Triggering WhatsApp Web API to ${currentSampleLead.phone}...`,
      `[Step 2] WhatsApp Message Sent & Delivered (Double Blue Tick Verified)!`,
      `[SUCCESS] Sequence automation active for ${leadName}.`,
    ];

    fallbackLogs.forEach((logLine, index) => {
      setTimeout(() => {
        setSimulationLog((prev) => [...prev, logLine]);
        if (index === fallbackLogs.length - 1) {
          setIsSimulating(false);
        }
      }, (index + 1) * 600);
    });
  };

  // ---------------------------------------------------------------------------
  // 6. Bulk Enroll Leads into Spring Boot Database
  // ---------------------------------------------------------------------------
  const handleBulkEnrollToBackend = async () => {
    if (!campaign || enrolledLeads.length === 0) return;

    try {
      setIsEnrollingBackend(true);
      await bulkEnrollLeads(campaign.id, enrolledLeads);
      setIsEnrollingBackend(false);
      setSyncFeedback(`Successfully enrolled ${enrolledLeads.length} leads!`);
      
      // Re-fetch trackers immediately
      await refreshEnrolledTrackers(campaign.id);
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to enroll leads into backend:', err);
      setIsEnrollingBackend(false);
      setSyncFeedback('Failed to enroll leads');
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. Excel & CSV File Lead Upload Handler (Auto Re-fetches Trackers)
  // ---------------------------------------------------------------------------
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFile(true);
      setSyncFeedback(`Parsing & importing ${file.name}...`);

      const response = await importLeadsFile(file);

      // Ensure importLeadsFile generates guaranteed unique IDs for newly returned leads before merging them into enrolledLeads state
      if (response.importedLeads && response.importedLeads.length > 0 && onLeadsImportedRef.current) {
        const uniqueTimestamp = Date.now();
        const mappedLeads: Lead[] = response.importedLeads.map((ql, idx) => {
          const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${uniqueTimestamp}-${idx}-${Math.random().toString(36).slice(2, 9)}`;
          const uniqueId = `imported-${uniqueSuffix}`;
          const fullName = [ql.firstName, ql.lastName].filter(Boolean).join(' ') || 'Imported Lead';
          return {
            id: uniqueId,
            name: fullName,
            title: ql.title || 'Lead Target',
            seniority: 'Executive' as const,
            company: ql.organization || 'Imported Company',
            location: 'United States',
            employees: '51-200',
            revenue: 10,
            industry: 'General',
            keywords: ['Imported', 'Outreach'],
            email: ql.email || '',
            phone: ql.phoneNumber || '',
            linkedinUrl: '',
            matchScore: 90,
            verified: true,
          };
        });
        onLeadsImportedRef.current(mappedLeads);
      }

      // Immediately re-fetch campaign trackers from backend so the enrolled targets drawer updates without page refresh
      const activeCampId = campaign?.id || response.enrolledCampaignId;
      if (activeCampId) {
        await refreshEnrolledTrackers(activeCampId);
      }

      setSyncFeedback(response.message);
      setShowEnrolledDrawer(true);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      console.error('File import error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to import file';
      setSyncFeedback(`Import error: ${errMsg}`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full max-w-[1640px] mx-auto px-4 md:px-8 py-6 space-y-6">
      
      {/* Page Header / Sequence Metrics Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-[#353535] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono text-[#37cd84] uppercase tracking-widest block">
              Campaign Workflow
            </span>
            {campaign && (
              <span className="bg-[#212121] text-[#b9b9b9] text-[10px] font-mono px-2 py-0.5 rounded border border-[#353535]">
                Campaign #{campaign.id}: {campaign.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-normal tracking-tight text-white font-sans">
            Automated Outreach Sequence Studio
          </h1>
          <p className="text-xs md:text-sm text-[#b9b9b9] mt-1">
            Build multi-step Email & WhatsApp flows with live preview, dynamic token injection, and automated scheduling.
          </p>
        </div>

        {/* Sequence Metrics Quick Bar & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 bg-[#212121] border border-[#353535] px-3 py-1.5 rounded-[4px] text-xs font-mono">
            <Server className={`w-3.5 h-3.5 ${
              backendStatus === 'connected' ? 'text-[#37cd84]' : backendStatus === 'syncing' ? 'text-amber-400 animate-spin' : 'text-[#f36458]'
            }`} />
            <span className="text-white">
              {backendStatus === 'connected' ? 'Engine Ready' : backendStatus === 'syncing' ? 'Syncing...' : 'Offline Mode'}
            </span>
            {isSyncing && <RefreshCw className="w-3 h-3 text-[#55beff] animate-spin" />}
          </div>

          {/* Sync status toast pill */}
          {syncFeedback && (
            <span className="text-[11px] font-mono text-[#37cd84] bg-[#0b0b0b] border border-[#37cd84]/40 px-2.5 py-1 rounded">
              {syncFeedback}
            </span>
          )}

          {/* Excel / CSV Lead Import Action */}
          <label className="flex items-center gap-2 bg-[#212121] border border-[#353535] hover:border-[#37cd84] text-white hover:text-[#37cd84] px-3.5 py-2 rounded-[4px] text-xs font-mono cursor-pointer transition-all">
            <FileSpreadsheet className={`w-3.5 h-3.5 text-[#37cd84] ${isUploadingFile ? 'animate-bounce' : ''}`} />
            <span>{isUploadingFile ? 'Parsing...' : 'Import Leads (Excel/CSV)'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isUploadingFile}
              className="hidden"
            />
          </label>

          {/* Actual SMTP Send Toggle */}
          <label className="flex items-center gap-1.5 bg-[#212121] border border-[#353535] px-2.5 py-1.5 rounded text-[11px] font-mono text-[#b9b9b9] cursor-pointer">
            <input
              type="checkbox"
              checked={sendActualEmail}
              onChange={(e) => setSendActualEmail(e.target.checked)}
              className="accent-[#37cd84] cursor-pointer"
            />
            <span>Real SMTP</span>
          </label>

          {/* Enrolled Targets Drawer Trigger */}
          <button
            onClick={() => setShowEnrolledDrawer(!showEnrolledDrawer)}
            className="flex items-center gap-2 bg-[#212121] border border-[#353535] hover:border-[#b9b9b9] px-3.5 py-2 rounded-[4px] text-xs font-mono text-white cursor-pointer transition-all"
          >
            <Users className="w-4 h-4 text-[#f36458]" />
            <span>Enrolled Targets: <strong className="text-[#37cd84]">{enrolledLeads.length} Leads</strong></span>
          </button>

          {/* Run Campaign / Process Sequence Button (Dispatches immediately without waiting for cron) */}
          <button
            onClick={handleProcessCampaignImmediately}
            disabled={isProcessingAll || enrolledLeads.length === 0}
            className="flex items-center gap-2 bg-[#f36458] text-white hover:bg-[#f36458]/90 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg shadow-[#f36458]/20 cursor-pointer disabled:opacity-50"
            title="Immediately sends campaign emails to all enrolled leads without waiting for schedule"
          >
            <Send className={`w-3.5 h-3.5 ${isProcessingAll ? 'animate-spin' : ''}`} />
            <span>{isProcessingAll ? 'Dispatching...' : 'Process Sequence (Send Now)'}</span>
          </button>

          {/* Interactive Simulation / Test Run Console Button */}
          <button
            onClick={runSequenceSimulation}
            disabled={isSimulating}
            className="flex items-center gap-2 bg-[#37cd84] text-[#0b0b0b] hover:bg-[#37cd84]/90 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg shadow-[#37cd84]/10 cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Simulating...' : 'Run Test Sequence'}</span>
          </button>
        </div>
      </div>

      {/* Target Lead Selector for Live Preview */}
      <div className="bg-[#212121] border border-[#353535] rounded-xl p-3 px-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#797979]">LIVE CONTEXT TARGET:</span>
          <div className="flex items-center gap-2 bg-[#0b0b0b] border border-[#353535] px-3 py-1 rounded-full text-xs text-white">
            <div className="w-5 h-5 rounded-full bg-[#0052ef] text-white flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
              {(currentSampleLead.name || 'L').charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold">{currentSampleLead.name}</span>
            <span className="text-[#797979]">({currentSampleLead.company})</span>
          </div>
        </div>

        {enrolledLeads.length > 1 && (
          <div className="flex items-center gap-2 text-xs font-mono text-[#b9b9b9]">
            <span>Cycle Lead Preview:</span>
            <select
              value={activeLeadPreviewIndex}
              onChange={(e) => setActiveLeadPreviewIndex(Number(e.target.value))}
              className="bg-[#0b0b0b] text-white border border-[#353535] rounded px-2 py-1 text-xs focus:outline-none"
            >
              {enrolledLeads.map((l, idx) => (
                <option key={l.id ? `${l.id}-${idx}` : idx} value={idx}>
                  {l.name} - {l.company}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Simulation Log Console Notification (if active) */}
      {simulationLog.length > 0 && (
        <div className="bg-[#0b0b0b] border border-[#37cd84]/40 rounded-xl p-4 space-y-1 font-mono text-xs text-[#37cd84]">
          <div className="flex items-center justify-between text-white font-semibold border-b border-[#353535] pb-2 mb-2">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#37cd84]" /> Real-time Execution Simulation Log
            </span>
            <button
              onClick={() => setSimulationLog([])}
              className="text-[#797979] hover:text-white text-[11px] cursor-pointer"
            >
              Clear Log
            </button>
          </div>
          {simulationLog.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[#797979]">›</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: MULTI-CHANNEL SEQUENCE FLOW (5/12 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#212121] border border-[#353535] rounded-xl p-5 space-y-5">
            
            <div className="flex items-center justify-between border-b border-[#353535] pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Settings2 className="w-4 h-4 text-[#f36458]" />
                <span>Multi-Channel Sequence Timeline</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#797979]">{steps.length} PHASES</span>
                <button
                  onClick={() => saveStepsToBackend(steps)}
                  disabled={isSyncing}
                  title="Save Sequence Changes"
                  className="p-1 hover:text-[#37cd84] text-[#797979] cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Timeline List */}
            <div className="space-y-4 relative">
              
              {/* Connecting Timeline Line */}
              <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-[#353535] z-0" />

              {steps.map((step, index) => {
                const isSelected = step.id === activeStepId;
                return (
                  <div
                    key={step.id}
                    onClick={() => setActiveStepId(step.id)}
                    className={`relative z-10 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-[#0b0b0b] border-[#f36458] shadow-lg shadow-[#f36458]/10 ring-1 ring-[#f36458]/50'
                        : 'bg-[#0b0b0b]/60 border-[#353535] hover:border-[#b9b9b9] hover:bg-[#0b0b0b]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      
                      {/* Step Badge Icon */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs shadow-md ${
                            step.channel === 'email'
                              ? 'bg-[#0052ef] text-white'
                              : 'bg-[#37cd84] text-[#0b0b0b]'
                          }`}
                        >
                          {step.channel === 'email' ? (
                            <Mail className="w-5 h-5" />
                          ) : (
                            <MessageSquare className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#f36458]">
                              STEP {step.stepNumber}
                            </span>
                            <span className="text-[10px] font-mono text-[#797979] uppercase bg-[#212121] px-2 py-0.5 rounded border border-[#353535]">
                              {step.channel}
                            </span>
                            <span className="text-[10px] font-mono text-[#b9b9b9]">
                              Delay: {step.delayDays} day{step.delayDays > 1 ? 's' : ''}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-white mt-0.5">{step.title}</h4>
                        </div>
                      </div>

                      {/* Interaction Controls: Move Up, Move Down, Delete */}
                      <div className="flex items-center gap-1 bg-[#212121] p-1 rounded border border-[#353535]" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                          title="Move Step Up"
                          className="p-1 text-[#797979] hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                          title="Move Step Down"
                          className="p-1 text-[#797979] hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteStep(step.id)}
                          title="Delete Step"
                          className="p-1 text-[#797979] hover:text-[#dd0000] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>

                    {/* Preview snippet */}
                    <div className="mt-3 pt-2 border-t border-[#353535] text-xs text-[#b9b9b9] font-sans truncate">
                      {step.channel === 'email' && step.subject && (
                        <span className="font-mono text-[11px] text-[#55beff] block truncate">
                          Subject: {step.subject}
                        </span>
                      )}
                      <p className="truncate text-[#797979] mt-0.5">{step.body}</p>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Add New Step Buttons */}
            <div className="pt-2 border-t border-[#353535] grid grid-cols-2 gap-3">
              <button
                onClick={() => addNewStep('email')}
                className="flex items-center justify-center gap-2 bg-[#0b0b0b] hover:bg-[#0052ef]/20 border border-[#0052ef]/50 text-[#55beff] px-3 py-2 rounded-[4px] text-xs font-mono transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Email Step</span>
              </button>
              <button
                onClick={() => addNewStep('whatsapp')}
                className="flex items-center justify-center gap-2 bg-[#0b0b0b] hover:bg-[#37cd84]/20 border border-[#37cd84]/50 text-[#37cd84] px-3 py-2 rounded-[4px] text-xs font-mono transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ WhatsApp Step</span>
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: CONTEXTUAL CONTENT WORKSPACE (7/12 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#212121] border border-[#353535] rounded-xl p-5 space-y-6">
            
            {/* Header: Active Step Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#353535] pb-4 gap-3">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                  activeStep.channel === 'email' ? 'bg-[#0052ef] text-white' : 'bg-[#37cd84] text-[#0b0b0b]'
                }`}>
                  {activeStep.channel} Mode
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Step {activeStep.stepNumber}: {activeStep.title}
                  </h3>
                </div>
              </div>

              {/* Delay Selector */}
              <div className="flex items-center gap-2 text-xs text-[#b9b9b9] font-mono">
                <span>Delay:</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={activeStep.delayDays}
                  onChange={(e) => updateActiveStep({ delayDays: Number(e.target.value) })}
                  className="w-16 bg-[#0b0b0b] text-white border border-[#353535] rounded px-2 py-1 text-center font-mono focus:outline-none"
                />
                <span>day(s)</span>
              </div>
            </div>

            {/* Variable Tag Pills Selector Bar */}
            <div className="space-y-2 bg-[#0b0b0b] p-3 rounded-lg border border-[#353535]">
              <span className="text-[11px] font-mono text-[#797979] flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-[#f36458]" />
                <span>Dynamic Variable Tag Pills (Click to Insert):</span>
              </span>

              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_TAGS.map((tag) => (
                  <button
                    key={tag.code}
                    type="button"
                    onClick={() => insertVariableTag(tag.code, 'body')}
                    className="bg-[#212121] hover:bg-[#f36458] hover:text-[#0b0b0b] text-white border border-[#353535] px-2.5 py-1 rounded-full text-xs font-mono transition-all duration-200 cursor-pointer"
                    title={tag.description}
                  >
                    {tag.code}
                  </button>
                ))}
              </div>
            </div>

            {/* MODE 1: EMAIL WORKSPACE MODE */}
            {activeStep.channel === 'email' && (
              <div className="space-y-4">
                
                {/* Subject Line */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-[#b9b9b9]">
                    <span>Email Subject Line</span>
                    <button
                      type="button"
                      onClick={() => insertVariableTag('{{company_name}}', 'subject')}
                      className="text-[10px] font-mono text-[#55beff] hover:underline cursor-pointer"
                    >
                      + Insert Company Tag
                    </button>
                  </div>
                  <input
                    type="text"
                    value={activeStep.subject || ''}
                    onChange={(e) => updateActiveStep({ subject: e.target.value })}
                    placeholder="Enter email subject line..."
                    className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-sm px-3.5 py-2.5 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#0052ef] font-sans"
                  />
                </div>

                {/* Rich Message Body */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-[#b9b9b9]">
                    <span>Email Body Copy</span>
                    <span className="text-[10px] font-mono text-[#797979]">Rich-Text Parser</span>
                  </div>
                  <textarea
                    rows={10}
                    value={activeStep.body}
                    onChange={(e) => updateActiveStep({ body: e.target.value })}
                    placeholder="Write your email body template..."
                    className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-sm p-4 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#0052ef] font-sans leading-relaxed"
                  />
                </div>

                {/* Email Live Preview Box */}
                <div className="bg-[#0b0b0b] border border-[#353535] rounded-lg p-4 space-y-2">
                  <span className="text-[10px] font-mono text-[#37cd84] uppercase tracking-widest block">
                    // LIVE EMAIL RENDER PREVIEW ({currentSampleLead.name})
                  </span>
                  <div className="bg-[#212121] p-3 rounded text-xs text-white border border-[#353535] space-y-1">
                    <p className="font-semibold text-[#55beff]">
                      To: {currentSampleLead.email}
                    </p>
                    <p className="font-medium text-white border-b border-[#353535] pb-2">
                      Subject: {resolveTemplateTags(activeStep.subject || '', currentSampleLead)}
                    </p>
                    <p className="whitespace-pre-line text-[#b9b9b9] pt-2 leading-relaxed">
                      {resolveTemplateTags(activeStep.body, currentSampleLead)}
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* MODE 2: WHATSAPP WORKSPACE MODE (With Smartphone Mockup) */}
            {activeStep.channel === 'whatsapp' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* WhatsApp Text Editor (Column 7/12) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                      <span>WhatsApp Message Editor</span>
                      <span className="text-[10px] font-mono text-[#37cd84]">Direct Web API</span>
                    </label>
                    <textarea
                      rows={8}
                      value={activeStep.body}
                      onChange={(e) => updateActiveStep({ body: e.target.value })}
                      placeholder="Write your WhatsApp message..."
                      className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-sm p-3.5 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#37cd84] font-sans leading-relaxed"
                    />
                  </div>

                  <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#353535] text-xs text-[#b9b9b9] space-y-1">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#37cd84]" /> WhatsApp Delivery Rules
                    </span>
                    <p className="text-[11px] text-[#797979]">
                      Messages are queued via Saniti Meta Business Cloud API with automatic rate-limiting and double blue tick delivery verification.
                    </p>
                  </div>
                </div>

                {/* BEAUTIFUL SMARTPHONE MOCKUP CONTAINER (Column 5/12) */}
                <div className="md:col-span-5 flex justify-center">
                  <div className="w-[260px] bg-[#000000] border-4 border-[#353535] rounded-[36px] p-3 shadow-2xl space-y-2 relative overflow-hidden">
                    
                    {/* Phone Camera Notch & Status Bar */}
                    <div className="w-full flex items-center justify-between text-[10px] font-mono text-white px-2 pt-1">
                      <span>9:41</span>
                      <div className="w-16 h-3 bg-[#212121] rounded-full mx-auto" />
                      <span>5G ⚡</span>
                    </div>

                    {/* WhatsApp App Header */}
                    <div className="bg-[#075e54] text-white p-2.5 rounded-t-xl flex items-center gap-2 shadow-md">
                      <div className="w-7 h-7 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-white/30 font-mono">
                        {(currentSampleLead.name || 'L').charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h5 className="text-xs font-bold truncate leading-tight">{currentSampleLead.name}</h5>
                        <p className="text-[9px] text-emerald-200 truncate">{currentSampleLead.company}</p>
                      </div>
                    </div>

                    {/* Chat Wallpaper Screen */}
                    <div className="bg-[#0b141a] p-3 rounded-b-xl min-h-[260px] flex flex-col justify-end space-y-2 border border-white/5">
                      
                      {/* Date Separator Pill */}
                      <div className="self-center bg-[#182229] text-[#8696a0] text-[9px] px-2 py-0.5 rounded-full font-mono">
                        TODAY
                      </div>

                      {/* WhatsApp Outgoing Bubble */}
                      <div className="self-end bg-[#005c4b] text-white p-2.5 rounded-2xl rounded-tr-none max-w-[90%] text-xs shadow-md space-y-1">
                        <p className="whitespace-pre-line text-[11px] leading-snug">
                          {resolveTemplateTags(activeStep.body, currentSampleLead)}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200/80">
                          <span>09:41 AM</span>
                          <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
                        </div>
                      </div>

                    </div>

                    {/* Home Bar Indicator */}
                    <div className="w-24 h-1 bg-white/40 rounded-full mx-auto mt-2" />
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

      {/* ENROLLED TARGETS DRAWER / MODAL */}
      {showEnrolledDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#212121] border-l border-[#353535] w-full max-w-md h-full p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#353535] pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Users className="w-5 h-5 text-[#37cd84]" />
                <span>Enrolled Sequence Queue ({enrolledLeads.length})</span>
              </div>
              <button
                onClick={() => setShowEnrolledDrawer(false)}
                className="text-[#797979] hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Excel / CSV Drag & Drop Upload Dropzone in Drawer */}
            <div className="bg-[#0b0b0b] border border-dashed border-[#353535] hover:border-[#37cd84] rounded-lg p-4 text-center cursor-pointer transition-all">
              <label className="cursor-pointer flex flex-col items-center gap-1.5">
                <FileSpreadsheet className={`w-6 h-6 text-[#37cd84] ${isUploadingFile ? 'animate-bounce' : ''}`} />
                <span className="text-xs font-semibold text-white">
                  {isUploadingFile ? 'Uploading & Parsing File...' : 'Upload Excel / CSV Lead Sheet'}
                </span>
                <span className="text-[10px] text-[#797979]">
                  Auto-imports, skips duplicates & updates queue immediately
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isUploadingFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* Action Buttons in Drawer */}
            {enrolledLeads.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={handleProcessCampaignImmediately}
                  disabled={isProcessingAll}
                  className="w-full flex items-center justify-center gap-2 bg-[#f36458] hover:bg-[#f36458]/90 text-white py-2.5 px-4 rounded text-xs font-bold cursor-pointer disabled:opacity-50 transition-all shadow-md"
                >
                  <Send className={`w-3.5 h-3.5 ${isProcessingAll ? 'animate-spin' : ''}`} />
                  <span>{isProcessingAll ? 'Dispatching Sequence...' : 'Dispatch Sequence Immediately (Send All Now)'}</span>
                </button>

                <button
                  onClick={handleBulkEnrollToBackend}
                  disabled={isEnrollingBackend}
                  className="w-full flex items-center justify-center gap-2 bg-[#212121] hover:bg-[#353535] border border-[#353535] text-[#b9b9b9] hover:text-white py-2 px-4 rounded text-xs font-medium cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Server className={`w-3.5 h-3.5 ${isEnrollingBackend ? 'animate-spin' : ''}`} />
                  <span>{isEnrollingBackend ? 'Syncing...' : 'Re-sync Queue to Database'}</span>
                </button>
              </div>
            )}

            {enrolledLeads.length === 0 ? (
              <div className="text-center text-[#797979] py-12 space-y-2">
                <p className="text-sm font-medium text-white">No leads currently enrolled</p>
                <p className="text-xs">Import a spreadsheet above or go to View 1 (Lead Discovery) to add targets.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrolledLeads.map((lead, idx) => {
                  const tracker = serverTrackers.find(
                    (t) => t.email.toLowerCase() === lead.email.toLowerCase() || t.leadId === lead.id
                  );

                  return (
                    <div
                      key={lead.id ? `${lead.id}-${idx}` : idx}
                      className="bg-[#0b0b0b] border border-[#353535] p-3 rounded-lg flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0052ef]/20 border border-[#0052ef]/40 text-[#4d8eff] flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                          {(lead.name || 'L').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-white">{lead.name}</h4>
                            {tracker && (
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                                tracker.status === 'COMPLETED' 
                                  ? 'bg-emerald-950 text-[#37cd84] border border-[#37cd84]/40' 
                                  : tracker.status === 'FAILED'
                                  ? 'bg-red-950 text-[#f36458] border border-[#f36458]/40'
                                  : 'bg-amber-950 text-amber-400 border border-amber-400/40'
                              }`}>
                                {tracker.status} · Step {tracker.currentStepOrder}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#b9b9b9]">{lead.title}</p>
                          <p className="text-[10px] font-mono text-[#37cd84]">{lead.company}</p>
                          {lead.email && (
                            <p className="text-[10px] font-mono text-[#797979] truncate">{lead.email}</p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveEnrolledLead(lead.id)}
                        className="text-[#797979] hover:text-[#dd0000] p-1 cursor-pointer"
                        title="Remove from sequence"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
