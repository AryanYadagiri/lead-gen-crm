'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Campaign } from '../types/lead';
import { 
  Clock, 
  Calendar, 
  Globe, 
  Sliders, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  RefreshCw,
  Mail,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  Server,
  Key
} from 'lucide-react';
import { testSmtpConnection } from '../utils/apiClient';

interface CampaignScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  onSave: (updatedSettings: Partial<Campaign>) => Promise<void>;
  isSaving?: boolean;
}

const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - India)', offset: 'UTC+5:30' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT - US Eastern)', offset: 'UTC-5' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT - US Central)', offset: 'UTC-6' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT - US Mountain)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT - US Pacific)', offset: 'UTC-8' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST - UK)', offset: 'UTC+0/+1' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST - Central Europe)', offset: 'UTC+1/+2' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST - Gulf Standard)', offset: 'UTC+4' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT - Singapore)', offset: 'UTC+8' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC' },
];

const DAYS_OF_WEEK = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

export const CampaignScheduleModal: React.FC<CampaignScheduleModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onSave,
  isSaving = false,
}) => {
  const [windowStart, setWindowStart] = useState<string>('09:00');
  const [windowEnd, setWindowEnd] = useState<string>('17:00');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [selectedDays, setSelectedDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [maxDailyEmailLimit, setMaxDailyEmailLimit] = useState<number>(50);
  const [maxDailyWhatsappLimit, setMaxDailyWhatsappLimit] = useState<number>(100);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Outbound Sender Account state (No hardcoding)
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [senderPassword, setSenderPassword] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [smtpHost, setSmtpHost] = useState<string>('smtp.hostinger.com');
  const [smtpPort, setSmtpPort] = useState<number>(465);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAdvancedSmtp, setShowAdvancedSmtp] = useState<boolean>(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Synchronize state when campaign prop updates or modal opens
  useEffect(() => {
    if (campaign) {
      setWindowStart(campaign.sending_window_start || '09:00');
      setWindowEnd(campaign.sending_window_end || '17:00');
      setTimezone(campaign.timezone || 'Asia/Kolkata');
      
      const emailLimit = campaign.max_daily_email_limit ?? (campaign.max_daily_limit ? Math.min(200, campaign.max_daily_limit) : 50);
      const whatsappLimit = campaign.max_daily_whatsapp_limit ?? 100;
      setMaxDailyEmailLimit(emailLimit);
      setMaxDailyWhatsappLimit(whatsappLimit);

      setSenderEmail(campaign.sender_email || '');
      setSenderPassword(campaign.sender_password || '');
      setSenderName(campaign.sender_name || '');
      setSmtpHost(campaign.smtp_host || 'smtp.hostinger.com');
      setSmtpPort(campaign.smtp_port || 465);
      setSmtpTestResult(null);

      const rawDays = campaign.allowed_days || 'MON,TUE,WED,THU,FRI';
      const parsedDays = rawDays
        .toUpperCase()
        .split(',')
        .map((d) => d.trim().substring(0, 3))
        .filter((d) => DAYS_OF_WEEK.some((dw) => dw.key === d));
      setSelectedDays(parsedDays.length > 0 ? parsedDays : ['MON', 'TUE', 'WED', 'THU', 'FRI']);
    }
  }, [campaign, isOpen]);

  // Click outside and Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate live current time in target timezone
  const currentTimeInTargetZone = useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        weekday: 'short',
      }).format(now);
    } catch {
      return 'N/A';
    }
  }, [timezone]);

  // Determine if the current moment is inside or outside the configured sending window
  const liveWindowEvaluation = useMemo(() => {
    try {
      const now = new Date();
      // Get hour and minute in target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'short',
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === 'hour')?.value || '0';
      const minutePart = parts.find((p) => p.type === 'minute')?.value || '0';
      const weekdayPart = (parts.find((p) => p.type === 'weekday')?.value || 'Mon').substring(0, 3).toUpperCase();

      const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minutePart, 10);

      const [startH, startM] = windowStart.split(':').map((v) => parseInt(v, 10) || 0);
      const [endH, endM] = windowEnd.split(':').map((v) => parseInt(v, 10) || 0);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const isDayAllowed = selectedDays.includes(weekdayPart);

      let isTimeAllowed = false;
      if (startMinutes < endMinutes) {
        isTimeAllowed = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      } else if (startMinutes > endMinutes) {
        // Overnight window
        isTimeAllowed = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      } else {
        isTimeAllowed = true;
      }

      const emailSent = campaign?.daily_email_sent_count ?? campaign?.emails_sent_today ?? 0;
      const whatsappSent = campaign?.daily_whatsapp_sent_count ?? campaign?.whatsapp_sent_today ?? 0;
      const isEmailQuotaAvailable = emailSent < maxDailyEmailLimit;
      const isWhatsappQuotaAvailable = whatsappSent < maxDailyWhatsappLimit;
      const isQuotaAvailable = isEmailQuotaAvailable || isWhatsappQuotaAvailable;

      const isWindowOpen = isDayAllowed && isTimeAllowed && isQuotaAvailable;

      return {
        isWindowOpen,
        isDayAllowed,
        isTimeAllowed,
        isQuotaAvailable,
        isEmailQuotaAvailable,
        isWhatsappQuotaAvailable,
        currentDay: weekdayPart,
      };
    } catch (e) {
      return {
        isWindowOpen: true,
        isDayAllowed: true,
        isTimeAllowed: true,
        isQuotaAvailable: true,
        isEmailQuotaAvailable: true,
        isWhatsappQuotaAvailable: true,
        currentDay: 'MON',
      };
    }
  }, [timezone, windowStart, windowEnd, selectedDays, campaign, maxDailyEmailLimit, maxDailyWhatsappLimit]);

  if (!isOpen) return null;

  const toggleDay = (dayKey: string) => {
    if (selectedDays.includes(dayKey)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayKey));
      }
    } else {
      setSelectedDays([...selectedDays, dayKey]);
    }
  };

  const handleApplyPreset = (start: string, end: string) => {
    setWindowStart(start);
    setWindowEnd(end);
  };

  const handleTestSmtp = async () => {
    if (!senderEmail || !senderPassword) {
      setSmtpTestResult({
        success: false,
        message: 'Please provide both Sender Email and Password before testing.',
      });
      return;
    }
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await testSmtpConnection({
        user: senderEmail.trim(),
        pass: senderPassword.trim(),
        host: smtpHost.trim(),
        port: smtpPort,
      });
      if (res.success) {
        setSmtpTestResult({
          success: true,
          message: res.message || 'SMTP Authentication Verified! Ready for outreach.',
        });
      } else {
        setSmtpTestResult({
          success: false,
          message: res.error || 'Connection failed. Please verify credentials.',
        });
      }
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err?.response?.data?.error || err.message || 'SMTP Connection Test Failed',
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowedDaysStr = selectedDays.join(',');
      await onSave({
        sending_window_start: windowStart,
        sending_window_end: windowEnd,
        timezone,
        allowed_days: allowedDaysStr,
        max_daily_email_limit: maxDailyEmailLimit,
        max_daily_whatsapp_limit: maxDailyWhatsappLimit,
        max_daily_limit: maxDailyEmailLimit,
        sender_email: senderEmail.trim(),
        sender_password: senderPassword.trim(),
        sender_name: senderName.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: smtpPort,
      });
      setSaveFeedback('Outreach settings & sender credentials saved successfully!');
      setTimeout(() => {
        setSaveFeedback(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setSaveFeedback(`Error: ${err?.message || 'Failed to save settings'}`);
    }
  };

  const emailSent = campaign?.daily_email_sent_count ?? campaign?.emails_sent_today ?? 0;
  const whatsappSent = campaign?.daily_whatsapp_sent_count ?? campaign?.whatsapp_sent_today ?? 0;
  const emailQuotaPercent = Math.min(100, Math.round((emailSent / Math.max(1, maxDailyEmailLimit)) * 100));
  const whatsappQuotaPercent = Math.min(100, Math.round((whatsappSent / Math.max(1, maxDailyWhatsappLimit)) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#121212] border border-[#353535] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl shadow-black/80 text-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-[#292929] flex items-start justify-between gap-4 sticky top-0 bg-[#121212] z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f36458]/20 to-amber-500/20 border border-[#f36458]/40 flex items-center justify-center text-[#f36458] shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Sending Windows & Timing Controls</span>
                <span className="text-[10px] font-mono uppercase bg-[#212121] text-[#37cd84] px-2 py-0.5 rounded border border-[#353535]">
                  Automated Guardrails
                </span>
              </h3>
              <p className="text-xs text-[#a0a0a0] mt-0.5">
                Configure business hours, local timezones, allowed days, and daily sending limits.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#797979] hover:text-white hover:bg-[#212121] transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Evaluation Status Banner */}
        <div className="px-6 pt-5">
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            liveWindowEvaluation.isWindowOpen 
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
              : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                liveWindowEvaluation.isWindowOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {liveWindowEvaluation.isWindowOpen ? (
                  <Zap className="w-4 h-4 fill-current" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span>
                    {liveWindowEvaluation.isWindowOpen 
                      ? 'Outreach Window Active' 
                      : !liveWindowEvaluation.isDayAllowed 
                      ? `Paused: ${liveWindowEvaluation.currentDay} is not an allowed outreach day` 
                      : !liveWindowEvaluation.isTimeAllowed
                      ? 'Window Closed: Outside configured business hours'
                      : 'Daily limit reached for today'}
                  </span>
                </div>
                <div className="text-[11px] opacity-80 font-mono mt-0.5">
                  Current target time: <strong className="text-white font-bold">{currentTimeInTargetZone}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-mono px-2 py-1 rounded border uppercase font-bold tracking-wider ${
                liveWindowEvaluation.isWindowOpen 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' 
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
              }`}>
                {liveWindowEvaluation.isWindowOpen ? '● Window Open' : '⏸ Window Closed'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* 0. Outbound Sender Account (User-provided credentials, No hardcoding) */}
          <div className="space-y-3.5 bg-[#181818] p-4.5 rounded-xl border border-[#2b2b2b] hover:border-[#f36458]/40 transition-colors">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#b9b9b9] flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#f36458]/10 flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-[#f36458]" />
                </div>
                <span className="font-semibold text-white">Outbound Sender Account</span>
              </label>
              <span className="text-[10px] font-mono uppercase bg-[#212121] text-[#37cd84] px-2 py-0.5 rounded border border-[#353535]">
                Dynamic Auth
              </span>
            </div>
            <p className="text-[11px] text-[#8e8e8e]">
              Enter your email credentials below. Outreach emails are authenticated and sent directly via this mailbox without any hardcoded credentials.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-mono text-[#797979] block mb-1">SENDER EMAIL ADDRESS *</span>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => {
                    const newEmail = e.target.value;
                    setSenderEmail(newEmail);
                    const domain = newEmail.includes('@') ? newEmail.split('@')[1]?.toLowerCase().trim() : '';
                    if (domain === 'gmail.com' || domain === 'googlemail.com') {
                      setSmtpHost('smtp.gmail.com');
                      setSmtpPort(587);
                    } else if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'office365.com') {
                      setSmtpHost('smtp.office365.com');
                      setSmtpPort(587);
                    } else if (domain === 'zoho.com' || domain === 'zoho.in') {
                      setSmtpHost('smtp.zoho.com');
                      setSmtpPort(465);
                    }
                  }}
                  placeholder="e.g. founder@company.com"
                  className="w-full bg-[#121212] border border-[#353535] rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#f36458] transition-colors"
                  required
                />
              </div>

              <div>
                <span className="text-[10px] font-mono text-[#797979] block mb-1">SENDER DISPLAY NAME</span>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Alex Morgan | Company"
                  className="w-full bg-[#121212] border border-[#353535] rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#f36458] transition-colors"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-[#797979] block mb-1">MAILBOX PASSWORD OR APP PASSWORD *</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senderPassword}
                  onChange={(e) => setSenderPassword(e.target.value)}
                  placeholder="Enter email account password"
                  className="w-full bg-[#121212] border border-[#353535] rounded-xl px-3.5 py-2 pr-10 text-xs font-mono text-white focus:outline-none focus:border-[#f36458] transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#797979] hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* SMTP Server Configuration */}
            <div className="p-3 bg-[#121212] rounded-xl border border-[#2b2b2b] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#a0a0a0] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <Server className="w-3.5 h-3.5 text-[#55beff]" /> Custom SMTP Server Configuration
                </span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => { setSmtpHost('smtp.hostinger.com'); setSmtpPort(465); }}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${smtpHost === 'smtp.hostinger.com' ? 'bg-[#353535] text-white font-bold' : 'text-[#797979] hover:text-white'}`}
                  >
                    Hostinger
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSmtpHost('smtp.gmail.com'); setSmtpPort(587); }}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${smtpHost === 'smtp.gmail.com' ? 'bg-[#353535] text-white font-bold' : 'text-[#797979] hover:text-white'}`}
                  >
                    Gmail
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSmtpHost('smtp.office365.com'); setSmtpPort(587); }}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${smtpHost === 'smtp.office365.com' ? 'bg-[#353535] text-white font-bold' : 'text-[#797979] hover:text-white'}`}
                  >
                    Outlook
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-mono text-[#797979] block mb-1">SMTP HOST SERVER *</span>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="e.g. smtp.hostinger.com or mail.yourdomain.com"
                    className="w-full bg-[#1c1c1c] border border-[#353535] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#55beff]"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#797979] block mb-1">PORT (SSL 465 / TLS 587) *</span>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value) || 465)}
                    placeholder="465"
                    className="w-full bg-[#1c1c1c] border border-[#353535] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#55beff]"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Test Connection Button & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#242424]">
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp || !senderEmail || !senderPassword}
                className="flex items-center gap-2 bg-[#212121] hover:bg-[#2b2b2b] text-white px-3 py-1.5 rounded-lg text-xs font-mono border border-[#3a3a3a] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingSmtp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#55beff]" />
                    <span>Verifying SMTP...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5 text-[#37cd84]" />
                    <span>Test SMTP Connection</span>
                  </>
                )}
              </button>

              <span className="text-[11px] font-mono text-[#797979]">
                Tested via port {smtpPort} on {smtpHost || 'custom host'}
              </span>
            </div>

            {/* SMTP Test Result Alert */}
            {smtpTestResult && (
              <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                smtpTestResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}>
                {smtpTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span className="truncate">{smtpTestResult.message}</span>
              </div>
            )}
          </div>

          {/* 1. Timezone Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#b9b9b9] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#55beff]" /> Target Campaign Timezone
              </span>
              <span className="text-[11px] text-[#797979]">Current: {timezone}</span>
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-[#1c1c1c] text-white border border-[#353535] rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-[#55beff] transition-all cursor-pointer"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-[#1c1c1c] text-white py-1">
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#797979]">
              All sending windows, day-of-week checks, and daily quotas evaluate against this local time.
            </p>
          </div>

          {/* 2. Business Hours / Sending Window */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono text-[#b9b9b9] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#f36458]" /> Outreach Sending Window (Business Hours)
              </span>
              <span className="text-[11px] text-[#797979]">
                Window: {windowStart} → {windowEnd}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-mono text-[#797979] block mb-1">WINDOW START TIME</span>
                <input
                  type="time"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  className="w-full bg-[#1c1c1c] text-white border border-[#353535] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#f36458]"
                  required
                />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#797979] block mb-1">WINDOW END TIME</span>
                <input
                  type="time"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  className="w-full bg-[#1c1c1c] text-white border border-[#353535] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#f36458]"
                  required
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-mono text-[#797979]">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('09:00', '17:00')}
                className="bg-[#212121] hover:bg-[#2d2d2d] border border-[#353535] text-[#b9b9b9] hover:text-white px-2 py-1 rounded text-[10px] font-mono transition-colors"
              >
                9 AM - 5 PM (Standard)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('08:30', '18:00')}
                className="bg-[#212121] hover:bg-[#2d2d2d] border border-[#353535] text-[#b9b9b9] hover:text-white px-2 py-1 rounded text-[10px] font-mono transition-colors"
              >
                8:30 AM - 6 PM (Extended)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('10:00', '16:00')}
                className="bg-[#212121] hover:bg-[#2d2d2d] border border-[#353535] text-[#b9b9b9] hover:text-white px-2 py-1 rounded text-[10px] font-mono transition-colors"
              >
                10 AM - 4 PM (Peak)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('00:00', '23:59')}
                className="bg-[#212121] hover:bg-[#2d2d2d] border border-[#353535] text-[#b9b9b9] hover:text-white px-2 py-1 rounded text-[10px] font-mono transition-colors"
              >
                24 Hours (All Day)
              </button>
            </div>
          </div>

          {/* 3. Allowed Days of the Week */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#b9b9b9] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#37cd84]" /> Allowed Outreach Days
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDays(['MON', 'TUE', 'WED', 'THU', 'FRI'])}
                  className="text-[10px] font-mono text-[#37cd84] hover:underline cursor-pointer"
                >
                  Weekdays Only
                </button>
                <span className="text-[#353535]">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])}
                  className="text-[10px] font-mono text-[#55beff] hover:underline cursor-pointer"
                >
                  All 7 Days
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#37cd84]/15 border-[#37cd84] text-[#37cd84] shadow-sm shadow-[#37cd84]/10'
                        : 'bg-[#1c1c1c] border-[#353535] text-[#797979] hover:border-[#797979] hover:text-[#b9b9b9]'
                    }`}
                  >
                    <span>{day.label}</span>
                    <span className="text-[9px] font-normal opacity-70">
                      {isSelected ? '✓' : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#797979]">
              Scheduled emails will never trigger on unselected days to protect domain reputation.
            </p>
          </div>

          {/* 4. Independent Daily Outreach Limits (Email & WhatsApp Guardrails) */}
          <div className="space-y-4">
            {/* Daily Email Quota Card */}
            <div className="space-y-3 bg-[#181818] p-4 rounded-xl border border-[#2b2b2b] hover:border-[#f36458]/40 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-[#b9b9b9] flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#f36458]/10 flex items-center justify-center">
                    <Mail className="w-3.5 h-3.5 text-[#f36458]" />
                  </div>
                  <span>Daily Email Quota (Domain Reputation Guardrail)</span>
                </label>
                <span className="text-xs font-mono text-[#f36458] font-bold bg-[#f36458]/10 px-2 py-0.5 rounded border border-[#f36458]/30">
                  {maxDailyEmailLimit} emails / day
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={maxDailyEmailLimit}
                  onChange={(e) => setMaxDailyEmailLimit(Number(e.target.value))}
                  className="w-full accent-[#f36458] cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={maxDailyEmailLimit}
                  onChange={(e) => setMaxDailyEmailLimit(Math.min(200, Math.max(1, Number(e.target.value))))}
                  className="w-20 bg-[#121212] border border-[#353535] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-[#f36458]"
                />
              </div>

              {/* Email Quota Visual Progress */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#a0a0a0]">Email Quota Consumption:</span>
                  <span className="text-white font-bold">
                    {emailSent} / {maxDailyEmailLimit} sent today ({Math.max(0, maxDailyEmailLimit - emailSent)} remaining)
                  </span>
                </div>
                <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-[#2e2e2e]">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      emailQuotaPercent >= 100 
                        ? 'bg-red-500' 
                        : emailQuotaPercent >= 80 
                        ? 'bg-amber-400' 
                        : 'bg-[#f36458]'
                    }`}
                    style={{ width: `${emailQuotaPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#797979] pt-0.5">
                  Protects email deliverability and prevents mailbox blacklisting. Max safe cap: 200/day.
                </p>
              </div>
            </div>

            {/* Daily WhatsApp Quota Card */}
            <div className="space-y-3 bg-[#181818] p-4 rounded-xl border border-[#2b2b2b] hover:border-[#37cd84]/40 transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-[#b9b9b9] flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#37cd84]/10 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-[#37cd84]" />
                  </div>
                  <span>Daily WhatsApp Quota (Number Ban Protection)</span>
                </label>
                <span className="text-xs font-mono text-[#37cd84] font-bold bg-[#37cd84]/10 px-2 py-0.5 rounded border border-[#37cd84]/30">
                  {maxDailyWhatsappLimit} messages / day
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={maxDailyWhatsappLimit}
                  onChange={(e) => setMaxDailyWhatsappLimit(Number(e.target.value))}
                  className="w-full accent-[#37cd84] cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxDailyWhatsappLimit}
                  onChange={(e) => setMaxDailyWhatsappLimit(Math.min(1000, Math.max(1, Number(e.target.value))))}
                  className="w-20 bg-[#121212] border border-[#353535] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-[#37cd84]"
                />
              </div>

              {/* WhatsApp Quota Visual Progress */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#a0a0a0]">WhatsApp Quota Consumption:</span>
                  <span className="text-white font-bold">
                    {whatsappSent} / {maxDailyWhatsappLimit} sent today ({Math.max(0, maxDailyWhatsappLimit - whatsappSent)} remaining)
                  </span>
                </div>
                <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-[#2e2e2e]">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      whatsappQuotaPercent >= 100 
                        ? 'bg-red-500' 
                        : whatsappQuotaPercent >= 80 
                        ? 'bg-amber-400' 
                        : 'bg-[#37cd84]'
                    }`}
                    style={{ width: `${whatsappQuotaPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#797979] pt-0.5">
                  Throttles bulk automated WhatsApp outreach to prevent sudden account suspension. Max cap: 1,000/day.
                </p>
              </div>
            </div>
          </div>

          {/* Feedback message banner */}
          {saveFeedback && (
            <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              saveFeedback.includes('Error') 
                ? 'bg-red-950/20 border-red-500/40 text-red-300' 
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            }`}>
              {saveFeedback.includes('Error') ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              )}
              <span>{saveFeedback}</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#292929]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-mono text-[#a0a0a0] hover:text-white hover:bg-[#212121] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-[#f36458] hover:bg-[#f36458]/90 text-white font-bold px-5 py-2.5 rounded-xl text-xs font-mono transition-all shadow-lg shadow-[#f36458]/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Timing Controls</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
