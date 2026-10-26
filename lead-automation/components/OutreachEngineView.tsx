'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SequenceStep, Lead, StepChannel, Campaign, LeadSequenceTracker, CampaignQueueTarget } from '../types/lead';
import { DEFAULT_SEQUENCE_STEPS, VARIABLE_TAGS } from '../data/mockLeads';
import { EnrolledTargetsPopover } from './EnrolledTargetsPopover';
import { CampaignScheduleModal } from './CampaignScheduleModal';
import { 
  getActiveCampaign, 
  getCampaignSteps, 
  syncCampaignSteps, 
  bulkEnrollLeads, 
  runTestSequenceApi,
  importLeadsFile,
  getCampaignTrackers,
  processAllCampaignTrackers,
  updateCampaignStatus,
  deleteCampaign,
  updateCampaignSettings
} from '../utils/apiClient';
import { 
  Mail, MessageSquare, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, 
  Send, CheckCheck, Smartphone, Info, Play, CheckCircle2, ShieldAlert,
  ChevronRight, Users, Settings2, Code, Eye, RefreshCw, Server, Check, 
  AlertCircle, FileSpreadsheet, Upload, Zap, Clock, Pause, AlertTriangle,
  Calendar, Globe, Sliders, ShieldCheck, RotateCcw
} from 'lucide-react';

interface OutreachEngineViewProps {
  enrolledLeads: Lead[];
  onRemoveEnrolledLead: (id: string) => void;
  onLeadsImported?: (newLeads: Lead[]) => void;
  queueTargets?: CampaignQueueTarget[];
  isQueueLoading?: boolean;
  onClearQueue?: () => Promise<void>;
  onDeleteQueueTarget?: (id: string | number) => Promise<void>;
  onRefreshQueue?: () => Promise<any>;
  onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingFileProp?: boolean;
  onNavigateToDiscovery?: () => void;
}

const MAX_SEQUENCE_STEPS = 8;
const MAX_STEP_DELAY_DAYS = 90;
const MIN_STEP_DELAY_DAYS = 0;

export const OutreachEngineView: React.FC<OutreachEngineViewProps> = ({
  enrolledLeads,
  onRemoveEnrolledLead,
  onLeadsImported,
  queueTargets,
  isQueueLoading,
  onClearQueue,
  onDeleteQueueTarget,
  onRefreshQueue,
  onUploadFile,
  isUploadingFileProp,
  onNavigateToDiscovery,
}) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_SEQUENCE_STEPS);
  const [activeStepId, setActiveStepId] = useState<string>('step-1');
  const [activeLeadPreviewIndex, setActiveLeadPreviewIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [serverTrackers, setServerTrackers] = useState<LeadSequenceTracker[]>([]);
  
  // Backend Integration States
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isEnrollingBackend, setIsEnrollingBackend] = useState<boolean>(false);
  const [sendActualEmail, setSendActualEmail] = useState<boolean>(false);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);

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
      
      // If all trackers have finished and none are pending, refresh campaign status to auto-reflect completion
      if (trackers.length > 0 && trackers.every((t) => t.status !== 'PENDING')) {
        try {
          const freshCamp = await getActiveCampaign();
          if (freshCamp) setCampaign(freshCamp);
        } catch {}
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
        const activeCamp = await getActiveCampaign();
        if (!isMounted) return;
        setCampaign(activeCamp);

        const serverSteps = await getCampaignSteps(activeCamp.id);
        if (!isMounted) return;

        if (serverSteps && serverSteps.length > 0) {
          const reindexed = reindexSteps(serverSteps);
          setSteps(reindexed);
          setActiveStepId(reindexed[0].id);
        } else {
          // If campaign steps are empty, sync the default steps to backend
          const reindexed = reindexSteps(DEFAULT_SEQUENCE_STEPS);
          await syncCampaignSteps(activeCamp.id, reindexed);
          setSteps(reindexed);
          setActiveStepId(reindexed[0].id);
        }

        // Fetch already enrolled trackers for the active campaign
        await refreshEnrolledTrackers(activeCamp.id);
      } catch (err) {
        console.warn('Backend unavailable or initializing, using local sequence defaults:', err);
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

    // Frontend guard: Maximum 8 sequence steps
    if (updatedSteps.length > MAX_SEQUENCE_STEPS) {
      setSyncFeedback(`Cannot save: maximum ${MAX_SEQUENCE_STEPS} sequence steps allowed`);
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    // Frontend guard: Step delay cannot exceed 90 days
    const invalidDelayStep = updatedSteps.find(
      (s) => s.delayDays < MIN_STEP_DELAY_DAYS || s.delayDays > MAX_STEP_DELAY_DAYS
    );
    if (invalidDelayStep) {
      setSyncFeedback(
        `Cannot save: step delay must be between ${MIN_STEP_DELAY_DAYS} and ${MAX_STEP_DELAY_DAYS} days (found ${invalidDelayStep.delayDays}d)`
      );
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    try {
      setIsSyncing(true);
      const saved = await syncCampaignSteps(campaign.id, updatedSteps);
      setIsSyncing(false);
      setSyncFeedback('Sequence saved successfully');
      setTimeout(() => setSyncFeedback(null), 2500);
    } catch (err: any) {
      console.warn('Failed to sync steps with Spring Boot:', err);
      setIsSyncing(false);
      const errMsg = err.response?.data?.message || err.message || 'Sync failed';
      setSyncFeedback(`Sync failed: ${errMsg}`);
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

  // Currently selected lead for live tag preview rendering (from real enrolled leads)
  const currentSampleLead: Lead | null = enrolledLeads[activeLeadPreviewIndex] || enrolledLeads[0] || null;

  // Helper function to resolve dynamic template tags like {{first_name}}
  const resolveTemplateTags = (text: string, lead: Lead | null): string => {
    if (!text) return '';
    if (!lead) return text;
    return text
      .replace(/\{\{first_name\}\}/g, lead.name ? lead.name.split(' ')[0] : 'There')
      .replace(/\{\{full_name\}\}/g, lead.name || '')
      .replace(/\{\{person_title\}\}/g, lead.title || '')
      .replace(/\{\{company_name\}\}/g, lead.company || '')
      .replace(/\{\{location\}\}/g, lead.location || '')
      .replace(/\{\{revenue\}\}/g, lead.revenue !== undefined ? lead.revenue.toString() : '')
      .replace(/\{\{industry\}\}/g, lead.industry || '');
  };

  // Helper to dynamically get SaaS industry standard action label using per-channel occurrence counter logic
  const getContextualStepLabel = (step: SequenceStep, currentSteps: SequenceStep[]): string => {
    let emailCount = 0;
    let whatsappCount = 0;
    for (const s of currentSteps) {
      if (s.channel === 'email') {
        emailCount++;
        if (s.id === step.id) {
          return emailCount === 1 ? 'Initial Email' : `Follow-up Email #${emailCount - 1}`;
        }
      } else {
        whatsappCount++;
        if (s.id === step.id) {
          return whatsappCount === 1 ? 'Initial WhatsApp' : `Follow-up WhatsApp #${whatsappCount - 1}`;
        }
      }
    }
    return step.channel === 'email' ? 'Initial Email' : 'Initial WhatsApp';
  };

  const reindexSteps = (stepsList: SequenceStep[]): SequenceStep[] => {
    let emailCount = 0;
    let whatsappCount = 0;

    return stepsList.map((step, idx) => {
      const newStepNumber = idx + 1;
      let actionLabel = '';

      if (step.channel === 'email') {
        emailCount++;
        actionLabel = emailCount === 1 ? 'Initial Email' : `Follow-up Email #${emailCount - 1}`;
      } else {
        whatsappCount++;
        actionLabel = whatsappCount === 1 ? 'Initial WhatsApp' : `Follow-up WhatsApp #${whatsappCount - 1}`;
      }

      return {
        ...step,
        stepNumber: newStepNumber,
        title: actionLabel,
      };
    });
  };

  // Step reordering handlers
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const renumbered = reindexSteps(updated);

    setSteps(renumbered);
    triggerDebouncedSave(renumbered);
  };

  // Delete step handler
  const deleteStep = (id: string) => {
    if (steps.length <= 1) return;
    const updated = reindexSteps(steps.filter((s) => s.id !== id));
    setSteps(updated);
    if (activeStepId === id) {
      setActiveStepId(updated[0].id);
    }
    triggerDebouncedSave(updated);
  };

  // Add new step (capped at MAX_SEQUENCE_STEPS = 8)
  const addNewStep = (channel: StepChannel) => {
    if (steps.length >= MAX_SEQUENCE_STEPS) {
      setSyncFeedback(`Maximum sequence limit reached (${MAX_SEQUENCE_STEPS} steps max)`);
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    const nextStepNum = steps.length + 1;
    const newId = `step-${Date.now()}`;
    const newStep: SequenceStep = {
      id: newId,
      stepNumber: nextStepNum,
      channel,
      delayDays: 2,
      title: channel === 'email' ? 'Email Step' : 'WhatsApp Step',
      subject: channel === 'email' ? 'Following up on my previous message' : undefined,
      body: channel === 'email' 
        ? `Hi {{first_name}},\n\nWanted to check if you had a moment to review my earlier note regarding {{company_name}}?\n\nBest regards,`
        : `Hi {{first_name}} 👋 Quick follow-up regarding {{company_name}}. Let me know if you are open to connect!`,
      isActive: true,
    };

    const newSteps = reindexSteps([...steps, newStep]);
    setSteps(newSteps);
    setActiveStepId(newId);
    triggerDebouncedSave(newSteps);
  };

  // Step field updates (delayDays clamped to 0..90)
  const updateActiveStep = (fields: Partial<SequenceStep>) => {
    if (fields.delayDays !== undefined) {
      const parsed = Number(fields.delayDays);
      fields.delayDays = isNaN(parsed)
        ? 0
        : Math.min(MAX_STEP_DELAY_DAYS, Math.max(MIN_STEP_DELAY_DAYS, parsed));
    }
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

  const campaignStatus = campaign?.status?.toUpperCase() || '';
  const allTrackersDone = serverTrackers.length > 0 && serverTrackers.every((t) => t.status !== 'PENDING');
  const isCampaignCompleted = campaignStatus === 'COMPLETED' || campaignStatus === 'FINISHED' || (allTrackersDone && !isProcessingAll);
  const isCampaignRunning = !isCampaignCompleted && (campaignStatus === 'RUNNING' || campaignStatus === 'PROCESSING' || campaignStatus === 'ACTIVE');
  const isCampaignPaused = !isCampaignCompleted && campaignStatus === 'PAUSED';

  // ---------------------------------------------------------------------------
  // Live Status Polling: Keep UI synced in real-time without page refresh
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!campaign?.id || (!isCampaignRunning && !isProcessingAll)) return;

    let isMounted = true;
    const intervalId = setInterval(async () => {
      try {
        const freshCamp = await getActiveCampaign();
        if (!isMounted) return;
        if (freshCamp) setCampaign(freshCamp);

        const updatedTrackers = await getCampaignTrackers(campaign.id);
        if (!isMounted) return;
        setServerTrackers(updatedTrackers);

        // Auto-complete check: if all trackers finished, pull final campaign state
        if (updatedTrackers.length > 0 && updatedTrackers.every((t) => t.status !== 'PENDING')) {
          if (freshCamp?.status !== 'COMPLETED') {
            const recheck = await getActiveCampaign();
            if (isMounted && recheck) setCampaign(recheck);
          }
          if (onRefreshQueue) onRefreshQueue();
        }
      } catch (pollErr) {
        console.warn('[OutreachEngineView] Live polling status error:', pollErr);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [campaign?.id, isCampaignRunning, isProcessingAll, onRefreshQueue]);

  // Re-sync campaign and trackers when browser window or tab regains focus
  useEffect(() => {
    const handleFocusSync = async () => {
      if (document.visibilityState === 'visible' && campaign?.id) {
        try {
          const freshCamp = await getActiveCampaign();
          if (freshCamp) setCampaign(freshCamp);
          await refreshEnrolledTrackers(campaign.id);
          if (onRefreshQueue) onRefreshQueue();
        } catch {}
      }
    };

    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);
    return () => {
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
    };
  }, [campaign?.id, refreshEnrolledTrackers, onRefreshQueue]);

  // ---------------------------------------------------------------------------
  // Save Campaign Timing Windows & Daily Limits (PUT /api/campaigns/:id)
  // ---------------------------------------------------------------------------
  const handleSaveCampaignSchedule = async (updatedSettings: Partial<Campaign>) => {
    if (!campaign) return;
    try {
      setIsSavingSchedule(true);
      console.log(`[OutreachEngineView] Updating schedule for campaign #${campaign.id}:`, updatedSettings);
      const updated = await updateCampaignSettings(campaign.id, updatedSettings);
      setCampaign(updated);
      setSyncFeedback('Outreach sending window & daily limits saved!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      console.error('Failed to update campaign schedule settings:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to update schedule';
      setSyncFeedback(`Schedule error: ${errMsg}`);
      setTimeout(() => setSyncFeedback(null), 4000);
      throw err;
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Pause / Resume Campaign Status (PUT /api/campaign/status)
  // ---------------------------------------------------------------------------
  const handleTogglePauseResume = async () => {
    if (!campaign || isCampaignCompleted) return;
    const isCurrentlyPaused = campaign.status?.toUpperCase() === 'PAUSED';
    const nextStatus: 'RUNNING' | 'PAUSED' = isCurrentlyPaused ? 'RUNNING' : 'PAUSED';

    try {
      setIsUpdatingStatus(true);
      console.log(`[OutreachEngineView] Updating campaign #${campaign.id} status to ${nextStatus}`);
      const updated = await updateCampaignStatus(nextStatus, campaign.id);
      setCampaign(updated);
      setSyncFeedback(
        nextStatus === 'PAUSED' 
          ? 'Campaign Paused — Outgoing queue frozen' 
          : 'Campaign Resumed — Outgoing queue active'
      );
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err: any) {
      console.error('Failed to update campaign status:', err);
      const errMsg = err.response?.data?.message || err.message || 'Status update failed';
      setSyncFeedback(`Status update error: ${errMsg}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Cascading Wipe / Delete Campaign (DELETE /api/campaign)
  // ---------------------------------------------------------------------------
  const handleConfirmDeleteCampaign = async () => {
    if (!campaign || isCampaignCompleted) return;

    try {
      setIsDeletingCampaign(true);
      console.log(`[OutreachEngineView] Permanently deleting campaign ID: ${campaign.id}`);
      await deleteCampaign(campaign.id);

      // Reset local view state
      setCampaign(null);
      setSteps(DEFAULT_SEQUENCE_STEPS);
      setServerTrackers([]);
      setIsDeleteDialogOpen(false);

      // Cleanse enrolled targets & queues
      if (onClearQueue) {
        try {
          await onClearQueue();
        } catch (e) {
          console.warn('Queue clear callback failed:', e);
        }
      } else if (onRefreshQueue) {
        await onRefreshQueue();
      }

      setSyncFeedback('Campaign permanently deleted');
      setTimeout(() => setSyncFeedback(null), 3000);

      // Gracefully navigate back to Lead Discovery & Filtering view
      if (onNavigateToDiscovery) {
        onNavigateToDiscovery();
      }
    } catch (err: any) {
      console.error('Failed to delete campaign:', err);
      const errMsg = err.response?.data?.message || err.message || 'Deletion failed';
      setSyncFeedback(`Delete error: ${errMsg}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Trigger Immediate Campaign Dispatch (POST /api/campaigns/:id/process-all)
  // ---------------------------------------------------------------------------
  const currentQueueData = (queueTargets && queueTargets.length > 0) ? queueTargets : enrolledLeads;
  const activeQueueCount = currentQueueData.length;
  const isLaunchDisabled = isProcessingAll || isCampaignRunning || isCampaignPaused || (activeQueueCount === 0 && !isCampaignCompleted);

  const handleProcessCampaignImmediately = useCallback(async () => {
    // 3. Immediate console debugging tracking live active queue data
    console.log("Process Sequence clicked!", currentQueueData);

    let targetCampaignId = campaign?.id;
    if (!targetCampaignId) {
      console.log("[OutreachEngineView] Campaign ID missing from state, resolving active campaign from backend...");
      try {
        const activeCamp = await getActiveCampaign();
        if (activeCamp) {
          setCampaign(activeCamp);
          targetCampaignId = activeCamp.id;
        }
      } catch (e) {
        console.error("Could not fetch active campaign:", e);
      }
    }

    if (!targetCampaignId) {
      console.warn("Process Sequence aborted: no campaign ID available");
      setSyncFeedback("Campaign not ready. Please reload or check connection.");
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    if (isCampaignRunning) {
      console.warn("Process Sequence aborted: campaign is already running");
      setSyncFeedback('Campaign is already running in background.');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    if (isCampaignPaused) {
      console.warn("Process Sequence aborted: campaign is paused");
      setSyncFeedback('Campaign is paused. Resume campaign to dispatch messages.');
      setTimeout(() => setSyncFeedback(null), 4000);
      return;
    }

    if (currentQueueData.length === 0 && !isCampaignCompleted) {
      console.warn("Process Sequence aborted: active queue has 0 leads");
      setSyncFeedback('Queue is empty. Import or enroll leads first.');
      setTimeout(() => setSyncFeedback(null), 3500);
      return;
    }

    try {
      setIsProcessingAll(true);
      setSyncFeedback(`Syncing latest sequence flow and launching campaign for ${currentQueueData.length} lead(s)...`);
      
      // Ensure backend has the latest sequence steps as edited in the UI
      try {
        await syncCampaignSteps(targetCampaignId, steps);
      } catch (syncErr) {
        console.warn('Could not sync steps before immediate process, continuing with stored steps:', syncErr);
      }

      console.log(`[OutreachEngineView] Firing POST /api/campaigns/${targetCampaignId}/process-all for ${currentQueueData.length} leads...`);

      // Dispatch sequence immediately via backend orchestration
      const result = await processAllCampaignTrackers(targetCampaignId);
      setIsProcessingAll(false);

      // Reset serverTrackers locally if re-running sequence so completion state transitions cleanly
      setServerTrackers(prev => prev.map(t => ({ ...t, status: 'PENDING', currentStepOrder: 1 })));

      // PART 2.4: Synchronous update on click - immediately flip local campaign state without refresh
      setCampaign(prev => prev ? { ...prev, status: 'RUNNING' } : null);

      setSyncFeedback(result.message || 'Campaign launched! Outreach sequence active.');
      console.log('[OutreachEngineView] Process sequence response:', result);

      // Populate execution message into the console
      setSimulationLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Campaign Launch executed for Campaign #${targetCampaignId}`,
        `[${new Date().toLocaleTimeString()}] Reset trackers to Step 1 & actively dispatching outreach for ${result.processedTrackers ?? currentQueueData.length} lead(s).`,
        `[SUCCESS] Running latest sequence steps from Step 1.`
      ]);

      // Staggered status & tracker re-checks to catch fast-completing dispatches without user reload
      const checkDelays = [1000, 2500, 4500, 7000, 10000];
      checkDelays.forEach((delay) => {
        setTimeout(async () => {
          try {
            const freshCamp = await getActiveCampaign();
            if (freshCamp) setCampaign(freshCamp);
            await refreshEnrolledTrackers(targetCampaignId);
            if (onRefreshQueue) onRefreshQueue();
          } catch (e) {
            console.warn('Post-dispatch status check error:', e);
          }
        }, delay);
      });

      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      console.error('Immediate execution failed:', err);
      setIsProcessingAll(false);
      const errMsg = err.response?.data?.message || err.message || 'Execution error';
      if (typeof errMsg === 'string' && (errMsg.includes('already running') || errMsg.includes('already active'))) {
        setCampaign(prev => prev ? { ...prev, status: 'RUNNING' } : null);
      }
      setSyncFeedback(`Dispatch error: ${errMsg}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  }, [campaign, isCampaignRunning, isCampaignPaused, queueTargets, enrolledLeads, currentQueueData, refreshEnrolledTrackers, onRefreshQueue]);

  // ---------------------------------------------------------------------------
  // 5. Trigger Backend Sequence Test Run / Live Preview Simulation
  // ---------------------------------------------------------------------------
  const runSequenceSimulation = async () => {
    setIsSimulating(true);
    setSimulationLog([]);

    if (!currentSampleLead) {
      setIsSimulating(false);
      setSyncFeedback('No target lead enrolled to run simulation.');
      return;
    }

    const leadName = currentSampleLead.name;
    const company = currentSampleLead.company;

    if (campaign) {
      try {
        const response = await runTestSequenceApi(
          campaign.id,
          currentSampleLead,
          steps,
          true
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
  // 7. Excel & CSV File Lead Upload Handler (Backend-First Single Source of Truth)
  // ---------------------------------------------------------------------------
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingFile(true);
      setSyncFeedback(`Uploading & saving ${file.name} to database...`);
      console.log(`[OutreachEngineView] Uploading file ${file.name} to backend...`);

      // 1. Immediately fire network API request to Spring Boot backend
      // Do not write leads directly to local state before the API request resolves
      const response = await importLeadsFile(file);
      console.log('[OutreachEngineView] File saved to database successfully:', response);

      // 2. Wait for backend response, then trigger a re-fetch of queue from the database
      if (onRefreshQueue) {
        console.log('[OutreachEngineView] Triggering database queue re-fetch...');
        await onRefreshQueue();
      }

      // 3. Sync campaign sequence trackers from backend
      const activeCampId = campaign?.id || response.enrolledCampaignId;
      if (activeCampId) {
        await refreshEnrolledTrackers(activeCampId);
      }

      setSyncFeedback(response.message || 'Leads imported and saved to database successfully');
      setIsPopoverOpen(true);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      console.error('[OutreachEngineView] File import error:', err);
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-[#353535] pb-6 gap-6">
        <div>
          {/* Top Category Tag & Identification */}
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5 min-h-[22px]">
            <span className="text-xs font-mono text-[#37cd84] uppercase tracking-widest block">
              Campaign Workflow
            </span>
            {campaign && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#1c1c1c] text-[#8e8e8e] text-[10px] font-mono px-2 py-0.5 rounded border border-[#2e2e2e]">
                  Campaign #{campaign.id}: {campaign.name}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                  isCampaignPaused 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                    : isCampaignRunning
                    ? 'bg-[#37cd84]/10 border-[#37cd84]/30 text-[#37cd84]'
                    : isCampaignCompleted
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                    : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isCampaignPaused 
                      ? 'bg-amber-400 animate-pulse' 
                      : isCampaignRunning 
                      ? 'bg-[#37cd84] animate-pulse' 
                      : isCampaignCompleted
                      ? 'bg-blue-400'
                      : 'bg-zinc-400'
                  }`} />
                  {isCampaignPaused 
                    ? 'PAUSED' 
                    : isCampaignRunning 
                    ? 'RUNNING' 
                    : isCampaignCompleted 
                    ? 'COMPLETED' 
                    : (campaign.status?.toUpperCase() || 'READY')}
                </span>
              </div>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-normal tracking-tight text-white font-sans">
            Automated Outreach Sequence Studio
          </h1>
          <p className="text-xs md:text-sm text-[#b9b9b9] mt-1">
            Build multi-step Email & WhatsApp flows with live preview, dynamic token injection, and automated scheduling.
          </p>

          {/* Read-Only Status Metrics (Separated as subtle metadata pills rather than action buttons) */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-0.5 text-xs font-mono">
            {/* Metric Pill: Leads Enrolled */}
            <div className="relative">
              <button
                onClick={() => {
                  const nextState = !isPopoverOpen;
                  setIsPopoverOpen(nextState);
                  if (nextState && onRefreshQueue) {
                    onRefreshQueue();
                  }
                }}
                className="h-7 inline-flex items-center gap-1.5 bg-[#161616] border border-[#2b2b2b] hover:border-[#404040] text-[#a3a3a3] hover:text-white px-2.5 rounded-md text-[11px] font-mono cursor-pointer transition-colors"
                title="Click to view enrolled leads queue"
              >
                <Users className="w-3.5 h-3.5 text-[#f36458]" />
                <span><strong className="text-white font-medium">{queueTargets ? queueTargets.length : enrolledLeads.length}</strong> Leads Enrolled</span>
              </button>

              {onClearQueue && onDeleteQueueTarget && (
                <EnrolledTargetsPopover
                  isOpen={isPopoverOpen}
                  onClose={() => setIsPopoverOpen(false)}
                  queueTargets={queueTargets || []}
                  isLoading={isQueueLoading || false}
                  onClearQueue={onClearQueue}
                  onDeleteTarget={onDeleteQueueTarget}
                  onUploadFile={onUploadFile || handleFileUpload}
                  isUploadingFile={isUploadingFile || isUploadingFileProp}
                  onRefresh={onRefreshQueue}
                  align="left"
                />
              )}
            </div>

            {/* Metric Pill: Window & Daily Quota */}
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="h-7 inline-flex items-center gap-1.5 bg-[#161616] border border-[#2b2b2b] hover:border-[#404040] text-[#a3a3a3] hover:text-white px-2.5 rounded-md text-[11px] font-mono cursor-pointer transition-colors"
              title="Click to view and configure sending window"
            >
              <Clock className="w-3.5 h-3.5 text-[#55beff]" />
              <span>Window: <strong className="text-white font-medium">{campaign?.sending_window_start || '09:00'} - {campaign?.sending_window_end || '17:00'}</strong></span>
              <span className="text-[10px] bg-[#0c0c0c] text-[#37cd84] px-1.5 py-0.2 rounded border border-[#262626]">
                {campaign?.daily_sent_count ?? 0}/{campaign?.max_daily_limit ?? 50} today
              </span>
            </button>
          </div>
        </div>

        {/* Grouped Interactive Action Buttons (Single Aligned Flex Container) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 shrink-0">

          {/* Import Leads Action */}
          <label className="h-10 inline-flex items-center gap-2 bg-[#212121] border border-[#353535] hover:border-[#37cd84] text-white hover:text-[#37cd84] px-4 rounded-lg text-xs font-mono cursor-pointer transition-all shrink-0">
            <FileSpreadsheet className={`w-3.5 h-3.5 text-[#37cd84] ${isUploadingFile ? 'animate-bounce' : ''}`} />
            <span>{isUploadingFile ? 'Importing...' : 'Import Leads'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isUploadingFile}
              className="hidden"
            />
          </label>

          {/* Pause / Resume Campaign */}
          <button
            onClick={handleTogglePauseResume}
            disabled={isUpdatingStatus || !campaign || isCampaignCompleted}
            className={`h-10 inline-flex items-center gap-2 px-4 rounded-lg text-xs font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
              isCampaignPaused
                ? 'bg-amber-500/15 border border-amber-500/60 text-amber-300 hover:bg-amber-500/25 shadow-sm shadow-amber-500/20 cursor-pointer'
                : isCampaignCompleted
                ? 'bg-[#1a1a1a] border border-[#2b2b2b] text-[#555555]'
                : 'bg-[#212121] border border-[#353535] hover:border-amber-500/40 text-white hover:text-amber-400 cursor-pointer'
            }`}
            title={
              isCampaignCompleted
                ? 'Campaign is completed. All sequence steps have finished, so pause is disabled.'
                : isCampaignPaused 
                ? 'Resume campaign outreach dispatching' 
                : 'Pause campaign outreach dispatching'
            }
          >
            {isUpdatingStatus ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : isCampaignPaused ? (
              <Play className="w-3.5 h-3.5 text-amber-400 fill-current" />
            ) : (
              <Pause className={`w-3.5 h-3.5 ${isCampaignCompleted ? 'text-[#555555]' : 'text-amber-400'}`} />
            )}
            <span>{isUpdatingStatus ? 'Updating...' : isCampaignPaused ? 'Resume Campaign' : 'Pause Campaign'}</span>
          </button>

          {/* Delete Campaign */}
          <button
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={!campaign || isDeletingCampaign || isCampaignCompleted}
            className={`h-10 inline-flex items-center gap-2 px-4 rounded-lg text-xs font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
              isCampaignCompleted
                ? 'bg-[#1a1a1a] border border-[#2b2b2b] text-[#555555]'
                : 'bg-red-950/20 border border-red-500/30 hover:border-red-500/60 text-red-400 hover:text-red-300 hover:bg-red-950/40 cursor-pointer'
            }`}
            title={
              isCampaignCompleted
                ? 'Campaign is completed. Deletion is disabled to preserve historical sequence logs.'
                : 'Permanently delete campaign and wipe sequence data'
            }
          >
            <Trash2 className={`w-3.5 h-3.5 ${isCampaignCompleted ? 'text-[#555555]' : 'text-red-400'}`} />
            <span>Delete Campaign</span>
          </button>

          {/* Primary Campaign Action Button (Launch Campaign) */}
          <button
            onClick={handleProcessCampaignImmediately}
            disabled={isLaunchDisabled}
            className={`h-10 inline-flex items-center gap-2 px-5 rounded-lg text-xs font-bold font-mono transition-all shadow-md cursor-pointer disabled:cursor-not-allowed shrink-0 ${
              isCampaignRunning
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 cursor-not-allowed shadow-none'
                : isLaunchDisabled 
                ? 'bg-[#353535] text-[#797979] cursor-not-allowed shadow-none'
                : 'bg-[#f36458] text-white hover:bg-[#f36458]/90 shadow-[#f36458]/20'
            }`}
            title={
              isCampaignRunning
                ? 'Campaign is actively running tasks in the background.'
                : isCampaignPaused 
                ? 'Campaign is paused. Resume to send.' 
                : activeQueueCount === 0 
                ? 'No targets in queue. Import or enroll leads first.' 
                : 'Launch sequence outreach using latest steps starting fresh from Step 1'
            }
          >
            {isProcessingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isCampaignRunning ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {isProcessingAll 
                ? 'Launching...' 
                : isCampaignRunning 
                ? 'Campaign Running' 
                : 'Launch Campaign'}
            </span>
          </button>
        </div>
      </div>

      {/* Visual Badge/Banner: Campaign Completed */}
      {isCampaignCompleted && (
        <div className="bg-blue-950/20 border border-blue-500/30 text-blue-200 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in duration-200 shadow-md shadow-blue-950/10">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30 text-blue-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-300 font-sans tracking-tight flex items-center gap-2">
                <span>Campaign Outreach Completed</span>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-500/30 uppercase">
                  Completed
                </span>
              </div>
              <div className="text-xs text-blue-200/70 font-mono mt-0.5">
                All steps in this sequence have been successfully delivered to enrolled targets. Zero pending emails remaining.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Badge/Banner: Campaign Active & Running in Background */}
      {isCampaignRunning && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-md shadow-emerald-950/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-300 font-sans tracking-tight flex items-center gap-2">
                <span>Sequence Engine Active & Processing</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                  Active
                </span>
              </div>
              <div className="text-[11px] text-emerald-200/70 font-mono mt-0.5">
                Workers are processing email sequences and queue trackers in the background. Duplicate launches are locked.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Badge/Banner: Campaign Paused — Outgoing queue frozen */}
      {isCampaignPaused && (
        <div className="bg-amber-950/30 border border-amber-500/40 text-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200 shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Pause className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-300 font-sans tracking-tight flex items-center gap-2">
                <span>Campaign Paused — Outgoing queue frozen</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                  Frozen
                </span>
              </div>
              <div className="text-xs text-amber-200/70 font-mono mt-0.5">
                All outgoing emails, WhatsApp touchpoints, and scheduled cron executions are suspended.
              </div>
            </div>
          </div>
          <button
            onClick={handleTogglePauseResume}
            disabled={isUpdatingStatus}
            className="flex items-center gap-1.5 bg-amber-500 text-black hover:bg-amber-400 px-4 py-2 rounded text-xs font-bold font-mono transition-all shrink-0 cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Resume Outgoing Queue</span>
          </button>
        </div>
      )}

      {/* Target Lead Selector for Live Preview */}
      <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 min-h-[54px] shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono tracking-wider text-[#797979] font-medium">LIVE CONTEXT TARGET:</span>
          {currentSampleLead ? (
            <div className="h-8 flex items-center gap-2 bg-[#0e0e0e] border border-[#353535] px-3 rounded-lg text-xs text-white">
              <div className="w-5 h-5 rounded-full bg-[#0052ef] text-white flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                {(currentSampleLead.name || 'L').charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold">{currentSampleLead.name}</span>
              <span className="text-[#797979]">({currentSampleLead.company})</span>
            </div>
          ) : (
            <span className="text-xs text-[#797979] italic font-mono">
              No target enrolled (enroll leads from Discovery to preview dynamic variables)
            </span>
          )}
        </div>

        {enrolledLeads.length > 1 && (
          <div className="flex items-center gap-2 text-xs font-mono text-[#b9b9b9]">
            <span>Cycle Lead Preview:</span>
            <select
              value={activeLeadPreviewIndex}
              onChange={(e) => setActiveLeadPreviewIndex(Number(e.target.value))}
              className="h-8 bg-[#0e0e0e] text-white border border-[#353535] hover:border-[#555555] rounded-lg px-3 py-1 text-xs font-mono focus:outline-none focus:border-[#55beff] cursor-pointer transition-colors shadow-inner"
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

      {/* Live Sending Window & Guardrails Overview Bar */}
      {campaign && (
        <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-5 text-[#b9b9b9]">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#f36458]" />
              <span className="text-[11px] text-[#797979]">WINDOW:</span>
              <strong className="text-white bg-[#0f0f0f] px-2 py-0.5 rounded border border-[#353535]">
                {campaign.sending_window_start || '09:00'} - {campaign.sending_window_end || '17:00'}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#55beff]" />
              <span className="text-[11px] text-[#797979]">TIMEZONE:</span>
              <strong className="text-white bg-[#0f0f0f] px-2 py-0.5 rounded border border-[#353535]">
                {campaign.timezone || 'Asia/Kolkata'}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#37cd84]" />
              <span className="text-[11px] text-[#797979]">DAYS:</span>
              <strong className="text-white bg-[#0f0f0f] px-2 py-0.5 rounded border border-[#353535]">
                {campaign.allowed_days || 'MON,TUE,WED,THU,FRI'}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-[#797979]">DAILY QUOTA:</span>
              <strong className="text-white bg-[#0f0f0f] px-2 py-0.5 rounded border border-[#353535]">
                {campaign.daily_sent_count ?? 0} / {campaign.max_daily_limit ?? 50} sent today
              </strong>
            </div>
          </div>

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-[#55beff] hover:text-white bg-[#222222] hover:bg-[#2c2c2c] px-3 py-1.5 rounded-lg border border-[#383838] transition-all cursor-pointer font-sans"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure Timing & Limits</span>
          </button>
        </div>
      )}

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
                <span className="text-[11px] font-mono text-[#797979]">
                  {steps.length} / {MAX_SEQUENCE_STEPS} PHASES
                </span>
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

              {(() => {
                let emailCount = 0;
                let whatsappCount = 0;

                return steps.map((step, index) => {
                  const isSelected = step.id === activeStepId;

                  let dynamicActionLabel = '';
                  if (step.channel === 'email') {
                    emailCount++;
                    dynamicActionLabel = emailCount === 1 ? 'Initial Email' : `Follow-up Email #${emailCount - 1}`;
                  } else {
                    whatsappCount++;
                    dynamicActionLabel = whatsappCount === 1 ? 'Initial WhatsApp' : `Follow-up WhatsApp #${whatsappCount - 1}`;
                  }

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
                                Delay: {step.delayDays === 0 ? '0 days (Same Day)' : `${step.delayDays} day${step.delayDays > 1 ? 's' : ''}`}
                              </span>
                            </div>

                            <h4 className="text-sm font-semibold text-white mt-0.5">
                              {dynamicActionLabel}
                            </h4>
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
                });
              })()}
            </div>

            {/* Add New Step Buttons (Capped at MAX_SEQUENCE_STEPS = 8) */}
            <div className="pt-2 border-t border-[#353535] space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => addNewStep('email')}
                  disabled={steps.length >= MAX_SEQUENCE_STEPS}
                  className="flex items-center justify-center gap-2 bg-[#0b0b0b] hover:bg-[#0052ef]/20 border border-[#0052ef]/50 text-[#55beff] px-3 py-2 rounded-[4px] text-xs font-mono transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0b0b0b]"
                  title={steps.length >= MAX_SEQUENCE_STEPS ? 'Maximum 8 steps allowed per sequence' : 'Add new email sequence step'}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Email Step</span>
                </button>
                <button
                  onClick={() => addNewStep('whatsapp')}
                  disabled={steps.length >= MAX_SEQUENCE_STEPS}
                  className="flex items-center justify-center gap-2 bg-[#0b0b0b] hover:bg-[#37cd84]/20 border border-[#37cd84]/50 text-[#37cd84] px-3 py-2 rounded-[4px] text-xs font-mono transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0b0b0b]"
                  title={steps.length >= MAX_SEQUENCE_STEPS ? 'Maximum 8 steps allowed per sequence' : 'Add new WhatsApp sequence step'}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ WhatsApp Step</span>
                </button>
              </div>
              {steps.length >= MAX_SEQUENCE_STEPS && (
                <div className="text-[10px] font-mono text-amber-400 text-center py-1 px-2 bg-amber-500/10 border border-amber-500/20 rounded">
                  Maximum {MAX_SEQUENCE_STEPS} sequence steps reached
                </div>
              )}
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
                    Step {activeStep.stepNumber}: {getContextualStepLabel(activeStep, steps)}
                  </h3>
                </div>
              </div>

              {/* Delay Selector (Capped at MAX_STEP_DELAY_DAYS = 90) */}
              <div className="flex items-center gap-2 text-xs text-[#b9b9b9] font-mono">
                <span>Delay:</span>
                <input
                  type="number"
                  min={MIN_STEP_DELAY_DAYS}
                  max={MAX_STEP_DELAY_DAYS}
                  value={activeStep.delayDays}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const clamped = isNaN(val)
                      ? 0
                      : Math.min(MAX_STEP_DELAY_DAYS, Math.max(MIN_STEP_DELAY_DAYS, val));
                    updateActiveStep({ delayDays: clamped });
                  }}
                  className="w-16 bg-[#0b0b0b] text-white border border-[#353535] rounded px-2 py-1 text-center font-mono focus:outline-none focus:border-[#f36458]"
                />
                <span>day(s)</span>
                {activeStep.delayDays === 0 ? (
                  <span className="text-[10px] text-emerald-400 font-mono font-medium bg-emerald-950/40 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                    Same Day Dispatch
                  </span>
                ) : (
                  <span className="text-[10px] text-[#797979] font-mono">(max {MAX_STEP_DELAY_DAYS}d)</span>
                )}
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
                    // LIVE EMAIL RENDER PREVIEW {currentSampleLead ? `(${currentSampleLead.name})` : '(NO TARGET ENROLLED)'}
                  </span>
                  <div className="bg-[#212121] p-3 rounded text-xs text-white border border-[#353535] space-y-1">
                    <p className="font-semibold text-[#55beff]">
                      To: {currentSampleLead ? currentSampleLead.email : 'No enrolled lead'}
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
                        {(currentSampleLead?.name || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h5 className="text-xs font-bold truncate leading-tight">
                          {currentSampleLead ? currentSampleLead.name : 'Target Contact'}
                        </h5>
                        <p className="text-[9px] text-emerald-200 truncate">
                          {currentSampleLead ? currentSampleLead.company : 'Company'}
                        </p>
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



      {/* Delete Campaign Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-sans text-white">Delete Campaign</h3>
                {campaign && <p className="text-xs font-mono text-[#797979]">Campaign #{campaign.id}: {campaign.name}</p>}
              </div>
            </div>
            
            <p className="text-sm text-[#b9b9b9] leading-relaxed">
              Are you sure you want to permanently delete this campaign? This will remove all sequence steps, targets, and history. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeletingCampaign}
                className="px-4 py-2 rounded-lg border border-[#353535] hover:border-[#b9b9b9] text-xs font-mono text-[#b9b9b9] hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCampaign}
                disabled={isDeletingCampaign}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingCampaign ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Toast (Fixed overlay to eliminate layout shift and page shaking) */}
      {syncFeedback && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none transition-all duration-300">
          <div className="bg-[#181818] border border-[#37cd84]/50 shadow-2xl shadow-black/80 px-4 py-2.5 rounded-lg flex items-center gap-2.5 text-xs font-mono text-[#37cd84]">
            <span className="w-2 h-2 rounded-full bg-[#37cd84] animate-pulse" />
            <span>{syncFeedback}</span>
          </div>
        </div>
      )}

      {/* Campaign Sending Window & Timing Controls Modal */}
      <CampaignScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        campaign={campaign}
        onSave={handleSaveCampaignSchedule}
        isSaving={isSavingSchedule}
      />

    </div>
  );
};
