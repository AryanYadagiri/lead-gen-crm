import axios from 'axios';
import { 
  LeadFiltersPayload, 
  QueriedLead, 
  SequenceStep, 
  Lead, 
  Campaign, 
  TestRunResult,
  LeadImportResponse,
  LeadSequenceTracker,
  CampaignQueueTarget
} from '../types/lead';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

/**
 * POST /api/leads/getLeads
 * Sends LeadFilters DTO payload directly from UI component to Java Spring Boot backend
 */
export const getLeads = async (payload: LeadFiltersPayload): Promise<QueriedLead[]> => {
  const response = await apiClient.post<QueriedLead[]>('/api/leads/getLeads', payload);
  return response.data;
};

/**
 * POST /api/email
 * Dispatches plain email payload
 */
export const sendEmail = async (emailData: { to: string; subject: string; body: string }) => {
  const response = await apiClient.post('/api/email', emailData);
  return response.data;
};

/**
 * GET /api/campaigns/active
 * Gets the active or bootstrapped default campaign
 */
export const getActiveCampaign = async (): Promise<Campaign> => {
  const response = await apiClient.get<Campaign>('/api/campaigns/active');
  return response.data;
};

/**
 * GET /api/campaigns/:campaignId/steps
 * Gets sequence steps for campaign
 */
export const getCampaignSteps = async (campaignId: number): Promise<SequenceStep[]> => {
  const response = await apiClient.get<SequenceStep[]>(`/api/campaigns/${campaignId}/steps`);
  return response.data;
};

/**
 * PUT /api/campaigns/:campaignId/steps
 * Syncs full list of sequence steps in reordered sequence
 */
export const syncCampaignSteps = async (
  campaignId: number,
  steps: SequenceStep[]
): Promise<SequenceStep[]> => {
  const response = await apiClient.put<SequenceStep[]>(`/api/campaigns/${campaignId}/steps`, steps);
  return response.data;
};

/**
 * POST /api/campaigns/:campaignId/enrollments/bulk
 * Bulk enrolls leads into campaign
 */
export const bulkEnrollLeads = async (
  campaignId: number,
  leads: Lead[]
): Promise<any[]> => {
  const payload = leads.map((l) => ({
    leadId: l.id,
    email: l.email,
    phone: l.phone,
    fullName: l.name,
    personTitle: l.title,
    companyName: l.company,
    location: l.location,
    revenue: String(l.revenue),
    industry: l.industry,
    initialDelayDays: 0,
  }));
  const response = await apiClient.post(`/api/campaigns/${campaignId}/enrollments/bulk`, payload);
  return response.data;
};

/**
 * GET /api/campaigns/:campaignId/enrollments
 * Fetches all enrolled lead trackers for the campaign
 */
export const getCampaignTrackers = async (campaignId: number): Promise<LeadSequenceTracker[]> => {
  const response = await apiClient.get<LeadSequenceTracker[]>(`/api/campaigns/${campaignId}/enrollments`);
  return response.data;
};

/**
 * POST /api/campaigns/:campaignId/process-all
 * Immediately triggers execution of scheduled outreach and sequence steps for all leads in the campaign
 */
export const processAllCampaignTrackers = async (
  campaignId: number
): Promise<{ status: string; message: string; processedTrackers?: number }> => {
  const response = await apiClient.post(`/api/campaigns/${campaignId}/process-all`);
  return response.data;
};

/**
 * POST /api/campaigns/:campaignId/test-run
 * Executes sequence test run with real-time logs
 */
export const runTestSequenceApi = async (
  campaignId: number,
  lead: Lead,
  steps: SequenceStep[],
  sendActualEmail = false
): Promise<TestRunResult> => {
  const payload = {
    lead: {
      leadId: lead.id,
      email: lead.email,
      phone: lead.phone,
      fullName: lead.name,
      personTitle: lead.title,
      companyName: lead.company,
      location: lead.location,
      revenue: String(lead.revenue),
      industry: lead.industry,
    },
    steps,
    sendActualEmail,
  };
  const response = await apiClient.post<TestRunResult>(`/api/campaigns/${campaignId}/test-run`, payload);
  return response.data;
};

/**
 * POST /api/campaign/upload
 * Uploads raw Excel (.xlsx, .xls) or CSV file stream directly to Spring Boot backend.
 * Synchronously parses, dedupes, saves to DB, and auto-enrolls leads into active campaign.
 */
export const importLeadsFile = async (file: File): Promise<LeadImportResponse> => {
  console.log('[API] Firing multipart file upload to /api/campaign/upload:', file.name);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await apiClient.post<LeadImportResponse>('/api/campaign/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('[API] Upload successful via /api/campaign/upload:', response.data);
    return response.data;
  } catch (err) {
    console.warn('[API] /api/campaign/upload failed, trying fallback to /api/leads/import:', err);
    const fallbackResponse = await apiClient.post<LeadImportResponse>('/api/leads/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('[API] Upload successful via /api/leads/import fallback:', fallbackResponse.data);
    return fallbackResponse.data;
  }
};

/**
 * GET /api/campaign/queue
 * Returns current list of enrolled targets from database
 */
export const getCampaignQueue = async (): Promise<CampaignQueueTarget[]> => {
  try {
    const response = await apiClient.get<any[]>('/api/campaign/queue');
    const rawList = Array.isArray(response.data) ? response.data : [];
    return rawList.map((t: any) => ({
      id: t.id,
      leadId: String(t.leadId || t.lead_id || t.id),
      lead_id: t.lead_id || t.leadId,
      name: t.name || 'Lead Target',
      email: t.email || '',
      phone: t.phone || '',
      company: t.company || 'Target Company',
      title: t.title || 'Executive',
      currentStep: t.currentStep ?? t.current_step ?? 1,
      current_step: t.current_step ?? t.currentStep ?? 1,
      status: t.status || 'PENDING',
      location: t.location || 'Global',
      industry: t.industry || 'Enterprise',
    }));
  } catch (err) {
    console.error('[API] GET /api/campaign/queue failed:', err);
    throw err;
  }
};

/**
 * DELETE /api/campaign/queue/clear
 * Clears or deletes the entire active queue list (resets queue to 0)
 */
export const clearCampaignQueue = async (): Promise<{ message: string; count: number }> => {
  console.log('[API] Firing DELETE request to /api/campaign/queue/clear');
  try {
    const response = await apiClient.delete<{ message: string; count: number }>('/api/campaign/queue/clear');
    console.log('[API] Successfully cleared campaign queue in backend:', response.data);
    return response.data;
  } catch (err) {
    console.error('[API] DELETE /api/campaign/queue/clear network request failed:', err);
    throw err;
  }
};

/**
 * DELETE /api/campaign/queue/{id}
 * Deletes a specific individual target out of the campaign queue matching that path ID
 */
export const deleteCampaignQueueTarget = async (id: string | number): Promise<{ message: string; id: string }> => {
  console.log(`[API] Firing DELETE request to /api/campaign/queue/${id}`);
  try {
    const response = await apiClient.delete<{ message: string; id: string }>(`/api/campaign/queue/${id}`);
    console.log(`[API] Successfully deleted target ${id} in backend:`, response.data);
    return response.data;
  } catch (err) {
    console.error(`[API] DELETE /api/campaign/queue/${id} network request failed:`, err);
    throw err;
  }
};

/**
 * PUT /api/campaign/status
 * Updates global campaign status ("RUNNING" or "PAUSED")
 */
export const updateCampaignStatus = async (
  status: 'RUNNING' | 'PAUSED',
  campaignId?: number
): Promise<Campaign> => {
  console.log(`[API] Updating campaign status to ${status} for campaign ${campaignId ?? 'default'}`);
  try {
    const response = await apiClient.put<Campaign>('/api/campaign/status', {
      status,
      campaignId,
    });
    console.log('[API] Successfully updated campaign status in backend:', response.data);
    return response.data;
  } catch (err) {
    console.error('[API] PUT /api/campaign/status network request failed:', err);
    throw err;
  }
};

/**
 * DELETE /api/campaign
 * Permanently deletes campaign, sequence steps, targets, and queues
 */
export const deleteCampaign = async (
  campaignId?: number
): Promise<{ status: string; message: string; campaignId?: number }> => {
  console.log(`[API] Firing DELETE request to /api/campaign for campaign ${campaignId ?? 'default'}`);
  try {
    const url = campaignId ? `/api/campaign/${campaignId}` : '/api/campaign';
    const response = await apiClient.delete<{ status: string; message: string; campaignId?: number }>(url);
    console.log('[API] Successfully deleted campaign in backend:', response.data);
    return response.data;
  } catch (err) {
    console.error('[API] DELETE /api/campaign network request failed:', err);
    throw err;
  }
};



