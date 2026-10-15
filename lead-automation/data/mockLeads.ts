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
    delayDays: 1,
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
    channel: 'whatsapp' as const,
    delayDays: 2,
    title: 'Initial WhatsApp',
    body: `Hi {{first_name}} 👋 I sent an email to your inbox yesterday regarding {{company_name}}. Just wanted to reach out here directly in case WhatsApp is easier for a quick response! Would love to drop a 1-min video breakdown.`,
    isActive: true,
  },
  {
    id: 'step-3',
    stepNumber: 3,
    channel: 'email' as const,
    delayDays: 3,
    title: 'Follow-up Email #1',
    subject: 'Case study: How SaaS leaders in {{industry}} increased qualified leads by 340%',
    body: `Hi {{first_name}},

Following up on my previous note. Here is a brief 2-page teardown of how an executive team at a company similar to {{company_name}} unlocked predictable lead generation.

Key takeaways:
1. Advanced multi-channel sequencing (Email + WhatsApp)
2. Automated profile enrichment
3. Tier-1 verified direct dial routing

Are you free for a quick call tomorrow afternoon?

Best,
LeadFlow Team`,
    isActive: false,
  },
  {
    id: 'step-4',
    stepNumber: 4,
    channel: 'whatsapp' as const,
    delayDays: 2,
    title: 'Follow-up WhatsApp #1',
    body: `Hey {{first_name}}, dropping a quick note on WhatsApp! We just released a customized benchmark report for {{industry}} leaders in {{location}}. Can I WhatsApp over the PDF summary? 📄`,
    isActive: false,
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
