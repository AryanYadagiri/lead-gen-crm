export const AVAILABLE_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Germany',
  'Canada',
  'France',
  'Netherlands',
  'Sweden',
  'United Arab Emirates',
  'Australia',
  'Singapore',
  'Japan',
  'Switzerland',
];

export const SENIORITY_OPTIONS = ['C-Level', 'VP', 'Director', 'Manager'] as const;

export const EMPLOYEE_RANGE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;

export const DEFAULT_SEQUENCE_STEPS = [
  {
    id: 'step-1',
    stepNumber: 1,
    channel: 'email' as const,
    delayDays: 0,
    title: 'Initial Email',
    subject: 'Quick question about {{company_name}}\'s growth strategy',
    body: `Hi {{first_name}},

I noticed {{company_name}} has been expanding rapidly in {{location}}'s {{industry}} sector. 

Many {{person_title}}s we speak with in companies around {{revenue}}M revenue are looking to scale their outbound acquisition pipeline without increasing headcount.

We recently helped a similar company scale their target outreach by 3.4x while maintaining high reply rates.

Would you be open to a 10-minute executive briefing this Thursday?

Best regards,
LeadFlow Outreach Team`,
    isActive: true,
  },
  {
    id: 'step-2',
    stepNumber: 2,
    channel: 'email' as const,
    delayDays: 1,
    title: 'Follow-up Email #1',
    subject: 'Following up on my previous message',
    body: `Hi {{first_name}},

Wanted to check if you had a moment to review my earlier note regarding {{company_name}}?

Best regards,
LeadFlow Outreach Team`,
    isActive: true,
  }
];

export const VARIABLE_TAGS = [
  { label: 'First Name', code: '{{first_name}}', description: 'Lead\'s first name' },
  { label: 'Full Name', code: '{{full_name}}', description: 'Lead\'s complete name' },
  { label: 'Job Title', code: '{{person_title}}', description: 'Lead\'s exact job title' },
  { label: 'Company Name', code: '{{company_name}}', description: 'Company name' },
  { label: 'Target Country', code: '{{location}}', description: 'Country location' },
  { label: 'Revenue ($M)', code: '{{revenue}}', description: 'Annual revenue in millions' },
  { label: 'Industry', code: '{{industry}}', description: 'Lead\'s industry vertical' },
];
