import axios from 'axios';
import { 
  LeadFiltersPayload, 
  QueriedLead, 
  SequenceStep, 
  Lead, 
  Campaign, 
  TestRunResult,
  LeadImportResponse,
  LeadSequenceTracker
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
 * POST /api/leads/import
 * Uploads Excel (.xlsx, .xls) or CSV file, parses columns, dedupes, and auto-enrolls leads into active campaign
 */
export const importLeadsFile = async (file: File): Promise<LeadImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<LeadImportResponse>('/api/leads/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
