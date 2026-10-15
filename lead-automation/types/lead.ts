export interface QueriedLead {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  title?: string;
  organization?: string;
}

export interface LeadFiltersPayload {
  personTitles: string[];
  personSeniorities: string[];
  organizationLocations: string[];
  organizationNumEmployeesRanges: string[];
  organizationKeywordTags: string[];
  revenueRangeMin: number | null;
  revenueRangeMax: number | null;
}

export interface Lead {
  id: string;
  name: string;
  title: string;
  seniority: 'C-Level' | 'VP' | 'Director' | 'Manager' | 'Executive';
  company: string;
  location: string;
  employees: string;
  revenue: number;
  industry: string;
  keywords: string[];
  email: string;
  phone: string;
  linkedinUrl: string;
  matchScore: number;
  verified: boolean;
}

export interface FilterState {
  personTitles: string;
  personSeniorities: string[];
  organizationLocations: string[];
  organizationNumEmployeesRanges: string[];
  organizationKeywordTags: string;
  revenueRangeMin: number | '';
  revenueRangeMax: number | '';
}

export type StepChannel = 'email' | 'whatsapp';

export interface SequenceStep {
  id: string;
  stepNumber: number;
  channel: StepChannel;
  delayDays: number;
  title: string;
  subject?: string;
  body: string;
  isActive?: boolean;
}

export interface VariableTag {
  label: string;
  code: string;
  description: string;
}

export interface Campaign {
  id: number;
  name: string;
  status: string;
}

export interface TestRunResult {
  success: boolean;
  message: string;
  logs: string[];
}

export interface LeadImportResponse {
  importedCount: number;
  skippedDuplicates: number;
  enrolledCampaignId: number;
  message: string;
  importedLeads?: QueriedLead[];
}

export interface LeadSequenceTracker {
  id: number;
  leadId: string;
  email: string;
  phone?: string;
  campaignId: number;
  currentStepOrder: number;
  nextExecutionTime: string;
  status: string;
  firstName?: string;
  fullName?: string;
  personTitle?: string;
  companyName?: string;
  location?: string;
  revenue?: string;
  industry?: string;
}

export interface CampaignQueueTarget {
  id: number;
  leadId: string;
  lead_id?: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  title: string;
  currentStep: number;
  current_step?: number;
  status: string;
  location?: string;
  industry?: string;
}

