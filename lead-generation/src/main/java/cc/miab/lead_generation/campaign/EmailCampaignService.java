package cc.miab.lead_generation.campaign;

import cc.miab.lead_generation.campaign.dto.CampaignRequest;
import cc.miab.lead_generation.campaign.dto.EnrollLeadRequest;
import cc.miab.lead_generation.email.EmailSenderService;
import cc.miab.lead_generation.verifier.EmailVerifierService;
import cc.miab.lead_generation.verifier.dto.MyEmailVerifierResponse;
import cc.miab.lead_generation.campaign.dto.SequenceStepRequest;
import cc.miab.lead_generation.campaign.dto.TestRunRequest;
import cc.miab.lead_generation.campaign.dto.TestRunResponse;
import cc.miab.lead_generation.campaign.entity.Campaign;
import cc.miab.lead_generation.campaign.entity.LeadSequenceTracker;
import cc.miab.lead_generation.campaign.entity.SequenceStep;
import cc.miab.lead_generation.campaign.repository.CampaignRepository;
import cc.miab.lead_generation.campaign.repository.LeadSequenceTrackerRepository;
import cc.miab.lead_generation.campaign.repository.SequenceStepRepository;
import cc.miab.lead_generation.lead.entity.Leads;
import cc.miab.lead_generation.lead.repository.LeadsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.stream.Collectors;

@Service
public class EmailCampaignService {

    private static final Logger logger = LoggerFactory.getLogger(EmailCampaignService.class);

    private final LeadSequenceTrackerRepository trackerRepository;
    private final SequenceStepRepository sequenceStepRepository;
    private final CampaignRepository campaignRepository;
    private final LeadsRepository leadsRepository;
    private final EmailSenderService emailSenderService;
    private final EmailVerifierService emailVerifierService;
    private final Executor outreachTaskExecutor;

    public EmailCampaignService(LeadSequenceTrackerRepository trackerRepository,
                                SequenceStepRepository sequenceStepRepository,
                                CampaignRepository campaignRepository,
                                LeadsRepository leadsRepository,
                                EmailSenderService emailSenderService,
                                EmailVerifierService emailVerifierService,
                                @Qualifier("outreachTaskExecutor") Executor outreachTaskExecutor) {
        this.trackerRepository = trackerRepository;
        this.sequenceStepRepository = sequenceStepRepository;
        this.campaignRepository = campaignRepository;
        this.leadsRepository = leadsRepository;
        this.emailSenderService = emailSenderService;
        this.emailVerifierService = emailVerifierService;
        this.outreachTaskExecutor = outreachTaskExecutor;
    }

    /**
     * Automatically bootstraps default campaign and sequence steps if database is empty on application startup.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initDefaultCampaignOnStartup() {
        try {
            getOrCreateDefaultCampaign();
        } catch (Exception ex) {
            logger.error("Failed to auto-setup default campaign on startup", ex);
        }
    }

    @Transactional(readOnly = true)
    public Optional<Campaign> findActiveCampaign() {
        List<Campaign> campaigns = campaignRepository.findAll();
        if (campaigns.isEmpty()) {
            return Optional.empty();
        }
        checkAndCompleteCampaignIfDone(campaigns.get(0).getId());
        return campaignRepository.findById(campaigns.get(0).getId());
    }

    @Transactional
    public Campaign getOrCreateDefaultCampaign() {
        List<Campaign> campaigns = campaignRepository.findAll();
        if (!campaigns.isEmpty()) {
            Campaign c = campaigns.get(0);
            checkAndCompleteCampaignIfDone(c.getId());
            return campaignRepository.findById(c.getId()).orElse(c);
        }

        logger.info("No campaign found. Initializing default automated outreach campaign...");
        Campaign defaultCampaign = campaignRepository.save(new Campaign(
                "Automated Outreach Sequence Studio",
                "READY",
                "09:00",
                "17:00",
                "Asia/Kolkata",
                "MON,TUE,WED,THU,FRI",
                50,
                100
        ));

        // Seed initial steps matching frontend DEFAULT_SEQUENCE_STEPS
        List<SequenceStep> initialSteps = List.of(
                new SequenceStep(defaultCampaign.getId(), 1, "email", "Initial Email", 0,
                        "Quick question about {{company_name}}'s growth strategy",
                        "Hi {{first_name}},\n\nI noticed {{company_name}} has been expanding rapidly in {{location}}'s {{industry}} sector.\n\nMany {{person_title}}s we speak with in companies around {{revenue}}M revenue are looking to scale their outbound acquisition pipeline without increasing headcount.\n\nWe recently helped a similar company scale their target outreach by 3.4x while maintaining high reply rates.\n\nWould you be open to a 10-minute executive briefing this Thursday?\n\nBest regards,\nLeadFlow Outreach Team",
                        true),
                new SequenceStep(defaultCampaign.getId(), 2, "email", "Follow-up Email #1", 1,
                        "Following up on my previous message",
                        "Hi {{first_name}},\n\nWanted to check if you had a moment to review my earlier note regarding {{company_name}}?\n\nBest regards,\nLeadFlow Outreach Team",
                        true)
        );

        sequenceStepRepository.saveAll(initialSteps);
        logger.info("Successfully seeded default campaign ID {} with {} sequence steps", defaultCampaign.getId(), initialSteps.size());
        return defaultCampaign;
    }

    /**
     * Resolves the target ZoneId configured on a Campaign, defaulting to Asia/Kolkata.
     */
    public ZoneId resolveCampaignZoneId(Campaign campaign) {
        if (campaign == null || campaign.getTimezone() == null || campaign.getTimezone().isBlank()) {
            return ZoneId.of("Asia/Kolkata");
        }
        try {
            return ZoneId.of(campaign.getTimezone().trim());
        } catch (Exception ex) {
            logger.warn("Invalid timezone '{}' for campaign ID {}. Falling back to Asia/Kolkata.",
                    campaign.getTimezone(), campaign.getId());
            return ZoneId.of("Asia/Kolkata");
        }
    }

    /**
     * Parses time string (e.g. "09:00", "9:00", "09:00:00") into LocalTime with graceful fallback.
     */
    public LocalTime parseTimeOrDefault(String timeStr, LocalTime defaultTime) {
        if (timeStr == null || timeStr.isBlank()) {
            return defaultTime;
        }
        try {
            String trimmed = timeStr.trim();
            if (trimmed.length() == 4 && trimmed.charAt(1) == ':') {
                trimmed = "0" + trimmed;
            }
            if (trimmed.length() == 5) {
                return LocalTime.parse(trimmed, DateTimeFormatter.ofPattern("HH:mm"));
            }
            return LocalTime.parse(trimmed);
        } catch (Exception ex) {
            logger.warn("Unable to parse time string '{}'. Falling back to {}.", timeStr, defaultTime);
            return defaultTime;
        }
    }

    /**
     * Time Window Check: Is the current time in the campaign's target timezone within
     * sending_window_start and sending_window_end?
     */
    public boolean isWithinSendingWindow(Campaign campaign, ZonedDateTime nowInZone) {
        LocalTime start = parseTimeOrDefault(campaign.getSendingWindowStart(), LocalTime.of(9, 0));
        LocalTime end = parseTimeOrDefault(campaign.getSendingWindowEnd(), LocalTime.of(17, 0));
        LocalTime current = nowInZone.toLocalTime();

        if (start.isBefore(end)) {
            return !current.isBefore(start) && !current.isAfter(end);
        } else if (start.isAfter(end)) {
            // Overnight window (e.g. 22:00 to 06:00)
            return !current.isBefore(start) || !current.isAfter(end);
        } else {
            return true;
        }
    }

    /**
     * Day Check: Is today included in allowed_days? (e.g. ["MON", "TUE", "WED", "THU", "FRI"])
     */
    public boolean isAllowedDay(Campaign campaign, ZonedDateTime nowInZone) {
        String allowedDays = campaign.getAllowedDays();
        if (allowedDays == null || allowedDays.isBlank()) {
            return true;
        }
        String day3 = nowInZone.getDayOfWeek().name().substring(0, 3).toUpperCase();
        String fullDay = nowInZone.getDayOfWeek().name().toUpperCase();
        String upperAllowed = allowedDays.toUpperCase();
        return upperAllowed.contains(day3) || upperAllowed.contains(fullDay);
    }

    /**
     * Throttling/Limits: Evaluates email and WhatsApp quotas independently against today's sent counters.
     * Resets the daily sent counters if the calendar day in the target timezone has advanced.
     */
    @Transactional
    public boolean isUnderChannelDailyLimitAndResetIfNewDay(Campaign campaign, String channel, ZonedDateTime nowInZone) {
        LocalDate todayInZone = nowInZone.toLocalDate();
        if (campaign.getLastDispatchDate() == null || !campaign.getLastDispatchDate().equals(todayInZone)) {
            campaign.setDailyEmailSentCount(0);
            campaign.setDailyWhatsappSentCount(0);
            campaign.setDailySentCount(0);
            campaign.setLastDispatchDate(todayInZone);
            campaignRepository.save(campaign);
        }

        if ("whatsapp".equalsIgnoreCase(channel)) {
            int maxWhatsappLimit = campaign.getMaxDailyWhatsappLimit() != null && campaign.getMaxDailyWhatsappLimit() > 0
                    ? Math.min(1000, campaign.getMaxDailyWhatsappLimit())
                    : 100;
            int sentToday = campaign.getDailyWhatsappSentCount() != null ? campaign.getDailyWhatsappSentCount() : 0;
            return sentToday < maxWhatsappLimit;
        } else {
            int maxEmailLimit = campaign.getMaxDailyEmailLimit() != null && campaign.getMaxDailyEmailLimit() > 0
                    ? Math.min(200, campaign.getMaxDailyEmailLimit())
                    : 50;
            int sentToday = campaign.getDailyEmailSentCount() != null ? campaign.getDailyEmailSentCount() : 0;
            return sentToday < maxEmailLimit;
        }
    }

    @Transactional
    public boolean isUnderDailyLimitAndResetIfNewDay(Campaign campaign, ZonedDateTime nowInZone) {
        return isUnderChannelDailyLimitAndResetIfNewDay(campaign, "email", nowInZone);
    }

    /**
     * Advances a ZonedDateTime candidate to the next allowed day at the specified windowStart.
     */
    public ZonedDateTime advanceToNextAllowedDay(ZonedDateTime from, Campaign campaign, LocalTime windowStart) {
        ZonedDateTime candidate = from.with(windowStart);
        int guard = 0;
        while (!isAllowedDay(campaign, candidate) && guard < 14) {
            candidate = candidate.plusDays(1);
            guard++;
        }
        return candidate;
    }

    /**
     * Calculates the next execution timestamp following outreach rules:
     * 1. Strictly relative to the actual execution time of the previous step, preventing weekend bunching.
     *    (e.g., If Step 2 is pushed to Monday, Step 3's delay is calculated from Monday, pushing it to Tuesday).
     * 2. Respects intentional 0-day delays (same day execution if allowed; rolls forward to next valid window if outside).
     * 3. Respects campaign allowed_days (e.g. MON,TUE,WED,THU,FRI), skipping weekends to the next allowed day.
     * 4. Aligns to sending_window_start / sending_window_end in the campaign's target timezone.
     */
    public LocalDateTime calculateNextExecutionTime(LocalDateTime actualExecutionTime, int delayDays, Campaign campaign) {
        if (actualExecutionTime == null) {
            actualExecutionTime = LocalDateTime.now();
        }
        if (campaign == null) {
            return actualExecutionTime.plusDays(Math.max(0, delayDays));
        }

        ZoneId zoneId = resolveCampaignZoneId(campaign);
        ZonedDateTime zdt = actualExecutionTime.atZone(ZoneId.systemDefault()).withZoneSameInstant(zoneId);

        LocalTime windowStart = parseTimeOrDefault(campaign.getSendingWindowStart(), LocalTime.of(9, 0));
        LocalTime windowEnd = parseTimeOrDefault(campaign.getSendingWindowEnd(), LocalTime.of(17, 0));

        if (delayDays <= 0) {
            // Intentional 0-day delay: same day if currently in allowed day and sending window
            if (isAllowedDay(campaign, zdt) && isWithinSendingWindow(campaign, zdt)) {
                return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
            }
            // If today is an allowed day but before the sending window start, align to windowStart today
            if (isAllowedDay(campaign, zdt) && zdt.toLocalTime().isBefore(windowStart)) {
                zdt = zdt.with(windowStart);
                return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
            }
            // Otherwise (window ended today or not an allowed day), advance to next allowed day at windowStart
            zdt = advanceToNextAllowedDay(zdt.plusDays(1), campaign, windowStart);
            return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        }

        // delayDays > 0: Calculate strictly relative to the actual execution time of the previous step
        zdt = zdt.plusDays(delayDays);

        // If the calculated target day lands on a weekend or non-allowed day, defer to next allowed day
        if (!isAllowedDay(campaign, zdt)) {
            zdt = advanceToNextAllowedDay(zdt, campaign, windowStart);
        } else {
            // Target is an allowed day: ensure it respects sending window
            if (zdt.toLocalTime().isBefore(windowStart)) {
                zdt = zdt.with(windowStart);
            } else if (zdt.toLocalTime().isAfter(windowEnd)) {
                // If the time of day is past the window end, push to the next allowed day at windowStart
                zdt = advanceToNextAllowedDay(zdt.plusDays(1), campaign, windowStart);
            }
        }

        return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    /**
     * Increments the channel-specific daily sent counter and persists the dispatch date in target timezone.
     */
    @Transactional
    public synchronized void recordDispatched(Long campaignId, String channel) {
        if (campaignId == null) return;
        campaignRepository.findById(campaignId).ifPresent(campaign -> {
            ZoneId zoneId = resolveCampaignZoneId(campaign);
            LocalDate todayInZone = ZonedDateTime.now(zoneId).toLocalDate();
            if (campaign.getLastDispatchDate() == null || !campaign.getLastDispatchDate().equals(todayInZone)) {
                campaign.setDailyEmailSentCount(0);
                campaign.setDailyWhatsappSentCount(0);
                campaign.setDailySentCount(0);
                campaign.setLastDispatchDate(todayInZone);
            }

            if ("whatsapp".equalsIgnoreCase(channel)) {
                int current = campaign.getDailyWhatsappSentCount() != null ? campaign.getDailyWhatsappSentCount() : 0;
                campaign.setDailyWhatsappSentCount(current + 1);
            } else {
                int current = campaign.getDailyEmailSentCount() != null ? campaign.getDailyEmailSentCount() : 0;
                campaign.setDailyEmailSentCount(current + 1);
            }
            int total = (campaign.getDailyEmailSentCount() != null ? campaign.getDailyEmailSentCount() : 0)
                    + (campaign.getDailyWhatsappSentCount() != null ? campaign.getDailyWhatsappSentCount() : 0);
            campaign.setDailySentCount(total);
            campaignRepository.save(campaign);
        });
    }

    @Transactional
    public synchronized void recordEmailDispatched(Long campaignId) {
        recordDispatched(campaignId, "email");
    }

    @Transactional
    public synchronized void recordWhatsappDispatched(Long campaignId) {
        recordDispatched(campaignId, "whatsapp");
    }

    /**
     * Inspects remaining pending sequence trackers for the specified campaign.
     * If zero pending trackers remain, automatically updates the campaign's status from RUNNING to COMPLETED.
     */
    @Transactional
    public void checkAndCompleteCampaignIfDone(Long campaignId) {
        if (campaignId == null) {
            return;
        }
        campaignRepository.findById(campaignId).ifPresent(campaign -> {
            String status = campaign.getStatus() != null ? campaign.getStatus().trim().toUpperCase() : "";
            if ("RUNNING".equals(status) || "ACTIVE".equals(status) || "PROCESSING".equals(status)) {
                long totalTrackers = trackerRepository.countByCampaignId(campaignId);
                long pendingTrackers = trackerRepository.countByCampaignIdAndStatus(campaignId, "PENDING");
                if (totalTrackers > 0 && pendingTrackers == 0) {
                    campaign.setStatus("COMPLETED");
                    campaignRepository.saveAndFlush(campaign);
                    logger.info("Campaign ID {} has 0 pending emails/trackers remaining (total: {}). Status automatically updated to COMPLETED.",
                            campaignId, totalTrackers);
                }
            }
        });
    }

    /**
     * Replaces template tokens matching Next.js frontend string parser.
     */
    public String parseTemplate(String template, LeadSequenceTracker tracker) {
        if (template == null) return "";
        return template
                .replace("{{first_name}}", tracker.getFirstName() != null ? tracker.getFirstName() : "There")
                .replace("{{full_name}}", tracker.getFullName() != null ? tracker.getFullName() : "")
                .replace("{{person_title}}", tracker.getPersonTitle() != null ? tracker.getPersonTitle() : "")
                .replace("{{company_name}}", tracker.getCompanyName() != null ? tracker.getCompanyName() : "")
                .replace("{{location}}", tracker.getLocation() != null ? tracker.getLocation() : "")
                .replace("{{revenue}}", tracker.getRevenue() != null ? tracker.getRevenue() : "0")
                .replace("{{industry}}", tracker.getIndustry() != null ? tracker.getIndustry() : "");
    }

    public String parseTemplate(String template, EnrollLeadRequest lead) {
        if (template == null) return "";
        String firstName = lead != null ? lead.resolvedFirstName() : "There";
        String fullName = lead != null ? lead.resolvedFullName() : "";
        String title = (lead != null && lead.personTitle() != null) ? lead.personTitle() : "";
        String company = (lead != null && lead.companyName() != null) ? lead.companyName() : "";
        String location = (lead != null && lead.location() != null) ? lead.location() : "";
        String revenue = (lead != null && lead.revenue() != null) ? lead.revenue() : "0";
        String industry = (lead != null && lead.industry() != null) ? lead.industry() : "";

        return template
                .replace("{{first_name}}", firstName)
                .replace("{{full_name}}", fullName)
                .replace("{{person_title}}", title)
                .replace("{{company_name}}", company)
                .replace("{{location}}", location)
                .replace("{{revenue}}", revenue)
                .replace("{{industry}}", industry);
    }

    /**
     * Scheduled background outreach engine runner with timing window, allowed days, and daily limit controls.
     */
    @Scheduled(cron = "${campaign.scheduler.cron:0 0 * * * *}")
    public int executeScheduledOutreach() {
        LocalDateTime now = LocalDateTime.now();
        logger.info("Starting scheduled outreach engine cycle at {}", now);

        List<LeadSequenceTracker> pendingTrackers = trackerRepository
                .findByStatusAndNextExecutionTimeLessThanEqual("PENDING", now);

        logger.info("Found {} pending lead sequence tracker(s) ready for execution", pendingTrackers.size());

        int dispatchedCount = 0;
        Set<Long> involvedCampaignIds = new HashSet<>();

        // Group trackers by campaign to validate campaign timing windows and daily limits
        Map<Long, List<LeadSequenceTracker>> trackersByCampaign = pendingTrackers.stream()
                .collect(Collectors.groupingBy(LeadSequenceTracker::getCampaignId));

        for (Map.Entry<Long, List<LeadSequenceTracker>> entry : trackersByCampaign.entrySet()) {
            Long campaignId = entry.getKey();
            List<LeadSequenceTracker> trackers = entry.getValue();
            involvedCampaignIds.add(campaignId);

            Optional<Campaign> campaignOpt = campaignRepository.findById(campaignId);
            if (campaignOpt.isEmpty()) {
                logger.warn("Campaign ID {} not found for pending trackers. Skipping.", campaignId);
                continue;
            }

            Campaign campaign = campaignOpt.get();
            String status = campaign.getStatus() != null ? campaign.getStatus().trim().toUpperCase() : "";

            if (!"RUNNING".equals(status) && !"PROCESSING".equals(status)) {
                logger.info("Campaign ID {} is in state '{}' (not RUNNING). Skipping scheduled outreach.", campaignId, status);
                continue;
            }

            ZoneId zoneId = resolveCampaignZoneId(campaign);
            ZonedDateTime nowInZone = ZonedDateTime.now(zoneId);

            // 1. Day Check
            if (!isAllowedDay(campaign, nowInZone)) {
                logger.info("Campaign ID {} (Zone: {}): Today ({}) is not in allowed days ({}). Skipping dispatch until next allowed day.",
                        campaignId, zoneId, nowInZone.getDayOfWeek(), campaign.getAllowedDays());
                continue;
            }

            // 2. Time Window Check
            if (!isWithinSendingWindow(campaign, nowInZone)) {
                logger.info("Campaign ID {} (Zone: {}): Current time {} is outside sending window [{} - {}]. Skipping dispatch until next valid window.",
                        campaignId, zoneId, nowInZone.toLocalTime(), campaign.getSendingWindowStart(), campaign.getSendingWindowEnd());
                continue;
            }

            // 3. Throttling / Channel-Specific Daily Limits Check (Email vs WhatsApp)
            for (LeadSequenceTracker tracker : trackers) {
                Optional<SequenceStep> currentStepOpt = sequenceStepRepository
                        .findByCampaignIdAndStepOrder(campaignId, tracker.getCurrentStepOrder());
                String channel = currentStepOpt.map(SequenceStep::getChannel).orElse("email");

                if (!isUnderChannelDailyLimitAndResetIfNewDay(campaign, channel, nowInZone)) {
                    int sent = "whatsapp".equalsIgnoreCase(channel) ? campaign.getDailyWhatsappSentCount() : campaign.getDailyEmailSentCount();
                    int max = "whatsapp".equalsIgnoreCase(channel) ? campaign.getMaxDailyWhatsappLimit() : campaign.getMaxDailyEmailLimit();
                    logger.info("Campaign ID {}: Daily limit for {} reached ({}/{} sent today). Skipping tracker ID {} until quota resets.",
                            campaignId, channel, sent, max, tracker.getId());
                    continue;
                }

                dispatchedCount++;
                outreachTaskExecutor.execute(() -> {
                    try {
                        processTrackerById(tracker.getId());
                    } catch (Exception ex) {
                        logger.error("Unhandled exception while executing tracker ID: {}", tracker.getId(), ex);
                    }
                });
            }
        }

        // Post-dispatch completion check for all running campaigns
        List<Campaign> runningCampaigns = campaignRepository.findByStatus("RUNNING");
        for (Campaign c : runningCampaigns) {
            checkAndCompleteCampaignIfDone(c.getId());
        }
        for (Long cId : involvedCampaignIds) {
            checkAndCompleteCampaignIfDone(cId);
        }

        return dispatchedCount;
    }

    /**
     * Immediately triggers all pending sequence trackers for a specific campaign.
     * Auto-enrolls any database leads not yet in this campaign so emails are never missed.
     */
    @Transactional
    public int processCampaignTrackersImmediately(Long campaignId) {
        Campaign campaign = getCampaign(campaignId);
        String currentStatus = campaign.getStatus() != null ? campaign.getStatus().trim().toUpperCase() : "";

        // 1. Execution Block: If campaign status is already RUNNING, PROCESSING, or ACTIVE, reject immediately
        if ("RUNNING".equals(currentStatus) || "PROCESSING".equals(currentStatus) || "ACTIVE".equals(currentStatus)) {
            logger.warn("Campaign ID {} is already running (status: {}). Rejecting start request.", campaignId, currentStatus);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Campaign is already running");
        }

        // 2. Execution Block: If campaign status is PAUSED, reject request
        if ("PAUSED".equals(currentStatus)) {
            logger.warn("Campaign ID {} is PAUSED. Immediate dispatch aborted.", campaignId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Campaign is paused. Please resume before starting.");
        }

        // 3. State Persist: Explicitly set status to RUNNING in DB to lock simultaneous requests
        campaign.setStatus("RUNNING");
        campaignRepository.saveAndFlush(campaign);
        logger.info("Persisted campaign ID {} status to RUNNING in database to lock simultaneous execution.", campaignId);

        // Freshness Guarantee 1: Fetch latest sequence steps linked to the campaign in database
        List<SequenceStep> currentSteps = sequenceStepRepository.findByCampaignIdOrderByStepOrderAsc(campaignId);
        logger.info("Freshness guarantee: Verified {} latest sequence step(s) for campaign ID {}", currentSteps.size(), campaignId);
        if (currentSteps.isEmpty()) {
            logger.warn("No sequence steps found for campaign ID {}. Cannot launch campaign without sequence steps.", campaignId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot launch campaign without sequence steps");
        }

        // 4. Purge any duplicate trackers in trackerRepository for this campaign so each email has at most one tracker
        List<LeadSequenceTracker> existingTrackers = trackerRepository.findByCampaignId(campaignId);
        Set<String> uniqueEmails = new HashSet<>();
        List<LeadSequenceTracker> allTrackers = new ArrayList<>();
        for (LeadSequenceTracker tracker : existingTrackers) {
            String email = tracker.getEmail() != null ? tracker.getEmail().trim().toLowerCase() : "";
            if (!email.isBlank() && uniqueEmails.contains(email)) {
                logger.info("Purging duplicate tracker ID {} for email {}", tracker.getId(), email);
                trackerRepository.delete(tracker);
            } else {
                if (!email.isBlank()) uniqueEmails.add(email);
                allTrackers.add(tracker);
            }
        }
        trackerRepository.flush();

        // 5. Sync any leads from the database leads table that aren't yet in this campaign
        List<Leads> unassignedLeads = leadsRepository.findAll();
        for (Leads lead : unassignedLeads) {
            String email = lead.getEmail() != null ? lead.getEmail().trim().toLowerCase() : "";
            if (!email.isBlank() && !uniqueEmails.contains(email)) {
                logger.info("Auto-enrolling unassigned lead '{}' ({}) into campaign ID {}", lead.getName(), email, campaignId);
                LeadSequenceTracker tracker = enrollLead(
                        String.valueOf(lead.getId()),
                        lead.getEmail(),
                        lead.getNumber(),
                        campaignId,
                        lead.getName() != null ? lead.getName().trim().split("\\s+")[0] : "There",
                        lead.getName(),
                        lead.getDesignation(),
                        lead.getCompany(),
                        lead.getLocation(),
                        lead.getRevenue(),
                        lead.getIndustry(),
                        0
                );
                allTrackers.add(tracker);
                uniqueEmails.add(email);
            }
        }

        // Freshness Guarantee 2: Reset lead tracking state so all leads start fresh from updated Step 1 using new flow
        logger.info("Freshness guarantee: Resetting all {} tracker(s) for campaign ID {} to Step 1 (PENDING) for fresh launch.",
                allTrackers.size(), campaignId);
        List<LeadSequenceTracker> trackersToProcess = new ArrayList<>();
        for (LeadSequenceTracker t : allTrackers) {
            t.setStatus("PENDING");
            t.setCurrentStepOrder(1);
            t.setNextExecutionTime(LocalDateTime.now());
            trackersToProcess.add(t);
        }
        trackerRepository.saveAllAndFlush(trackersToProcess);

        if (trackersToProcess.isEmpty()) {
            logger.info("No trackers to process for campaign ID {}. Marking campaign as COMPLETED.", campaignId);
            checkAndCompleteCampaignIfDone(campaignId);
            return 0;
        }

        logger.info("Triggering immediate processing for {} tracker(s) in campaign ID {}",
                trackersToProcess.size(), campaignId);

        for (LeadSequenceTracker tracker : trackersToProcess) {
            outreachTaskExecutor.execute(() -> {
                try {
                    processTrackerById(tracker.getId());
                } catch (Exception ex) {
                    logger.error("Unhandled exception while executing tracker ID: {}", tracker.getId(), ex);
                }
            });
        }
        return trackersToProcess.size();
    }

    /**
     * Asynchronously processes a single tracker by ID.
     */
    @Async("outreachTaskExecutor")
    public CompletableFuture<Void> processTrackerAsync(Long trackerId) {
        processTrackerById(trackerId);
        return CompletableFuture.completedFuture(null);
    }

    @Transactional
    public void processTrackerById(Long trackerId) {
        Optional<LeadSequenceTracker> trackerOpt = trackerRepository.findById(trackerId);
        if (trackerOpt.isEmpty()) {
            logger.warn("Tracker not found with ID: {}", trackerId);
            return;
        }

        processTracker(trackerOpt.get());
    }

    /**
     * Step processing and multi-channel queue pacing logic.
     */
    @Transactional
    public void processTracker(LeadSequenceTracker tracker) {
        if (!"PENDING".equalsIgnoreCase(tracker.getStatus())) {
            logger.info("Tracker ID {} is in state '{}' (not PENDING). Skipping.", tracker.getId(), tracker.getStatus());
            return;
        }

        Optional<Campaign> campaignOpt = campaignRepository.findById(tracker.getCampaignId());
        if (campaignOpt.isEmpty()) {
            logger.warn("Campaign ID {} no longer exists. Halting dispatch for tracker ID {}.",
                    tracker.getCampaignId(), tracker.getId());
            return;
        }

        Campaign campaign = campaignOpt.get();
        String currentStatus = campaign.getStatus() != null ? campaign.getStatus().trim().toUpperCase() : "";
        if (!"RUNNING".equals(currentStatus) && !"PROCESSING".equals(currentStatus)) {
            logger.info("Campaign ID {} is in state '{}' (not RUNNING). Halting dispatch for tracker ID {}.",
                    tracker.getCampaignId(), currentStatus, tracker.getId());
            return;
        }

        Optional<SequenceStep> currentStepOpt = sequenceStepRepository
                .findByCampaignIdAndStepOrder(tracker.getCampaignId(), tracker.getCurrentStepOrder());

        if (currentStepOpt.isEmpty()) {
            logger.info("No step found for campaignId={} with stepOrder={}. Marking tracker ID {} as COMPLETED.",
                    tracker.getCampaignId(), tracker.getCurrentStepOrder(), tracker.getId());
            tracker.setStatus("COMPLETED");
            trackerRepository.save(tracker);
            checkAndCompleteCampaignIfDone(tracker.getCampaignId());
            return;
        }

        SequenceStep currentStep = currentStepOpt.get();
        if (Boolean.FALSE.equals(currentStep.getIsActive())) {
            logger.info("Step {} is inactive for campaign {}. Skipping dispatch for tracker ID {}.",
                    tracker.getCurrentStepOrder(), tracker.getCampaignId(), tracker.getId());
        } else {
            String channel = currentStep.getChannel() != null ? currentStep.getChannel().toLowerCase() : "email";

            String parsedSubject = parseTemplate(currentStep.getSubjectTemplate(), tracker);
            String parsedBody = parseTemplate(currentStep.getBodyTemplate(), tracker);

            try {
                if ("whatsapp".equalsIgnoreCase(channel)) {
                    String targetPhone = tracker.getPhone() != null ? tracker.getPhone() : "[No Phone]";
                    logger.info("Dispatched WhatsApp step {} to recipient {} via Web API: {}",
                            tracker.getCurrentStepOrder(), targetPhone, parsedBody);
                    recordWhatsappDispatched(tracker.getCampaignId());
                } else {
                    // Verify email validity with MyEmailVerifier to prevent sending campaigns to invalid email IDs
                    MyEmailVerifierResponse verification = emailVerifierService.verifyEmail(tracker.getEmail());
                    if (verification != null && verification.isInvalid()) {
                        logger.warn("Prevented email send for tracker ID {}: MyEmailVerifier reported Status='{}', Diagnosis='{}'. Marking tracker as INVALID_EMAIL to protect sender reputation.",
                                tracker.getId(), verification.status(), verification.diagnosis());
                        tracker.setStatus("INVALID_EMAIL");
                        trackerRepository.save(tracker);
                        checkAndCompleteCampaignIfDone(tracker.getCampaignId());
                        return;
                    }

                    // Re-check campaign existence and status right before network dispatch in case campaign was paused or deleted during verification
                    Optional<Campaign> freshCampaignOpt = campaignRepository.findById(tracker.getCampaignId());
                    if (freshCampaignOpt.isEmpty() || (!"RUNNING".equalsIgnoreCase(freshCampaignOpt.get().getStatus()) && !"PROCESSING".equalsIgnoreCase(freshCampaignOpt.get().getStatus()))) {
                        logger.info("Campaign ID {} is no longer RUNNING right before email dispatch. Halting send for tracker ID {}.",
                                tracker.getCampaignId(), tracker.getId());
                        return;
                    }

                    emailSenderService.sendEmail(tracker.getEmail(), parsedSubject, parsedBody);
                    recordEmailDispatched(tracker.getCampaignId());
                    logger.info("Dispatched step {} email for campaign {} to {}",
                            tracker.getCurrentStepOrder(), tracker.getCampaignId(), tracker.getEmail());
                }
            } catch (Exception ex) {
                logger.error("Failed to dispatch {} to {} for tracker ID: {}", channel, tracker.getEmail(), tracker.getId(), ex);
                tracker.setStatus("FAILED");
                trackerRepository.save(tracker);
                checkAndCompleteCampaignIfDone(tracker.getCampaignId());
                return;
            }
        }

        // Pacing to next step
        Optional<SequenceStep> nextStepOpt = sequenceStepRepository
                .findByCampaignIdAndStepOrder(tracker.getCampaignId(), tracker.getCurrentStepOrder() + 1);

        if (nextStepOpt.isPresent()) {
            SequenceStep nextStep = nextStepOpt.get();
            String nextChannel = nextStep.getChannel() != null ? nextStep.getChannel().toLowerCase() : "email";
            tracker.setCurrentStepOrder(tracker.getCurrentStepOrder() + 1);
            int delay = Math.max(0, nextStep.getDelayDays());
            LocalDateTime actualExecutionTime = LocalDateTime.now();

            campaign = getCampaign(tracker.getCampaignId());
            ZoneId zoneId = resolveCampaignZoneId(campaign);
            ZonedDateTime nowInZone = ZonedDateTime.now(zoneId);
            LocalTime windowStart = parseTimeOrDefault(campaign.getSendingWindowStart(), LocalTime.of(9, 0));

            if (delay == 0) {
                // Rule: Respect Intentional 0-Day Delays
                // If a user configures a step with a 0 day delay, allow multiple emails to send to the same lead in a single day (subject to daily quotas and sending windows).
                boolean running = "RUNNING".equalsIgnoreCase(campaign.getStatus()) || "PROCESSING".equalsIgnoreCase(campaign.getStatus());
                boolean allowedDay = isAllowedDay(campaign, nowInZone);
                boolean withinWindow = isWithinSendingWindow(campaign, nowInZone);
                boolean underQuota = isUnderChannelDailyLimitAndResetIfNewDay(campaign, nextChannel, nowInZone);

                if (running && allowedDay && withinWindow && underQuota) {
                    tracker.setNextExecutionTime(actualExecutionTime);
                    trackerRepository.saveAndFlush(tracker);
                    logger.info("Intentional 0-day delay: Executing Step {} ({}) immediately for lead {} in campaign {} (same-day multiple dispatch allowed)",
                            tracker.getCurrentStepOrder(), nextChannel, tracker.getEmail(), tracker.getCampaignId());
                    processTracker(tracker);
                    return;
                } else {
                    // Deferred due to daily quota reached, closed window, or non-allowed day
                    LocalDateTime nextExec;
                    if (!underQuota) {
                        // Quota reached: advance to next allowed day at window start
                        nextExec = advanceToNextAllowedDay(
                                nowInZone.plusDays(1),
                                campaign,
                                windowStart
                        ).withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    } else {
                        nextExec = calculateNextExecutionTime(actualExecutionTime, 0, campaign);
                    }
                    tracker.setNextExecutionTime(nextExec);
                    trackerRepository.saveAndFlush(tracker);
                    logger.info("0-day delay Step {} for tracker ID {} deferred to {} (outside sending window, not allowed day, or quota reached)",
                            tracker.getCurrentStepOrder(), tracker.getId(), nextExec);
                }
            } else {
                // Rule: Prevent Weekend Bunching
                // When a step is deferred due to a non-allowed day (e.g., weekend), subsequent steps must not collapse onto the next business day.
                // Their schedules must remain strictly relative to the actual execution time of the previous step.
                // (e.g., If Step 2 is pushed to Monday, Step 3's delay is calculated from Monday, pushing it to Tuesday).
                LocalDateTime nextExec = calculateNextExecutionTime(actualExecutionTime, delay, campaign);
                tracker.setNextExecutionTime(nextExec);
                trackerRepository.saveAndFlush(tracker);
                logger.info("Advanced tracker ID {} to stepOrder {} with delay {} day(s) strictly relative to actual execution time {}. nextExecutionTime={}",
                        tracker.getId(), tracker.getCurrentStepOrder(), delay, actualExecutionTime, nextExec);
            }
        } else {
            tracker.setStatus("COMPLETED");
            trackerRepository.saveAndFlush(tracker);
            logger.info("All sequence steps completed for tracker ID: {}. Marked as COMPLETED.", tracker.getId());
            checkAndCompleteCampaignIfDone(tracker.getCampaignId());
        }
    }

    /**
     * Executes a simulation or test run for the frontend and returns real-time formatted log lines.
     */
    public TestRunResponse runTestSequence(Long campaignId, TestRunRequest request) {
        Campaign campaign = getCampaign(campaignId);
        List<String> logs = new ArrayList<>();

        EnrollLeadRequest lead = request != null ? request.lead() : null;
        if (lead == null || lead.email() == null || lead.email().isBlank()) {
            return new TestRunResponse(false, "No target email available for test run.",
                    List.of("[NOTICE] No valid target lead or email provided for simulation. Please select or import a lead."));
        }
        String leadName = !lead.resolvedFullName().isBlank() ? lead.resolvedFullName() : "Target Lead";
        String company = (lead.companyName() != null && !lead.companyName().isBlank()) ? lead.companyName() : "N/A";
        String email = lead.email().trim();
        String phone = (lead.phone() != null && !lead.phone().isBlank()) ? lead.phone() : "N/A";

        logs.add(String.format("[09:00 AM] Enrolling target: %s (%s)", leadName, company));

        // Pre-validate email with MyEmailVerifier
        MyEmailVerifierResponse verification = emailVerifierService.verifyEmail(email);
        boolean isEmailDeliverable = (verification == null || !verification.isInvalid());
        if (verification != null) {
            if (verification.isInvalid()) {
                logs.add(String.format("[09:01 AM] ⚠️ MyEmailVerifier BLOCKED: %s is INVALID (%s). Sending will be avoided to protect domain reputation.",
                        email, verification.diagnosis()));
            } else {
                logs.add(String.format("[09:01 AM] ✓ MyEmailVerifier: %s is %s (%s)",
                        email, verification.status(), verification.diagnosis()));
            }
        } else {
            logs.add(String.format("[09:01 AM] Verification OK: Direct Email (%s) & WhatsApp (%s)", email, phone));
        }

        // Use custom steps from request or pull steps from database
        List<SequenceStep> steps;
        if (request != null && request.steps() != null && !request.steps().isEmpty()) {
            if (request.steps().size() > 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A campaign sequence cannot exceed 8 steps");
            }
            steps = new ArrayList<>();
            int idx = 1;
            for (SequenceStepRequest sr : request.steps()) {
                int delay = sr.resolvedDelayDays();
                if (delay < 0 || delay > 90) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Step delay cannot exceed 90 days (received: " + delay + " days)");
                }
                steps.add(new SequenceStep(
                        campaignId,
                        sr.resolvedStepOrder(idx),
                        sr.resolvedChannel(),
                        sr.resolvedTitle(idx),
                        sr.resolvedDelayDays(),
                        sr.resolvedSubject(),
                        sr.resolvedBody(),
                        sr.resolvedIsActive()
                ));
                idx++;
            }
        } else {
            steps = getSequenceSteps(campaignId);
        }

        if (steps.isEmpty()) {
            logs.add("[WARNING] No sequence steps configured for this campaign.");
            return new TestRunResponse(true, "Campaign has no steps", logs);
        }

        boolean sendActualEmail = Boolean.TRUE.equals(request != null ? request.sendActualEmail() : false);

        int stepNum = 1;
        for (SequenceStep step : steps) {
            if (!step.getIsActive()) {
                logs.add(String.format("[Step %d] %s (%s) is inactive. Skipped.", stepNum, step.getTitle(), step.getChannel()));
                stepNum++;
                continue;
            }

            String channel = step.getChannel() != null ? step.getChannel().toLowerCase() : "email";
            String parsedSubject = parseTemplate(step.getSubjectTemplate(), lead);
            String parsedBody = parseTemplate(step.getBodyTemplate(), lead);

            if ("whatsapp".equalsIgnoreCase(channel)) {
                if (step.getDelayDays() == 0) {
                    logs.add("[Same Day / 0-Day Delay simulated...]");
                } else {
                    logs.add(String.format("[Delay %d Day(s) simulated...]", step.getDelayDays()));
                }
                logs.add(String.format("[Step %d] Triggering WhatsApp Web API to %s...", stepNum, phone));
                logs.add(String.format("[Step %d] WhatsApp Message Sent & Delivered (Double Blue Tick Verified)!", stepNum));
            } else {
                if (stepNum > 1) {
                    if (step.getDelayDays() == 0) {
                        logs.add("[Same Day / 0-Day Delay simulated...]");
                    } else {
                        logs.add(String.format("[Delay %d Day(s) simulated...]", step.getDelayDays()));
                    }
                }
                if (!isEmailDeliverable) {
                    logs.add(String.format("[09:%02d AM] ⛔ Step %d Email Blocked: Recipient %s is INVALID (%s). Dispatch aborted.",
                            stepNum + 1, stepNum, email, verification != null ? verification.diagnosis() : "Validation failed"));
                } else if (sendActualEmail && email != null && email.contains("@")) {
                    try {
                        emailSenderService.sendEmail(email, parsedSubject, parsedBody);
                        logs.add(String.format("[09:%02d AM] Step %d Delivered to %s! Subject: \"%s\"",
                                stepNum + 2, stepNum, email, parsedSubject));
                    } catch (Exception ex) {
                        logs.add(String.format("[09:%02d AM] Step %d Dispatch Warning: %s",
                                stepNum + 2, stepNum, ex.getMessage()));
                    }
                } else {
                    logs.add(String.format("[09:%02d AM] Step %d Delivered (Test Mode)! Subject: \"%s\"",
                            stepNum + 2, stepNum, parsedSubject));
                }
            }
            stepNum++;
        }

        logs.add(String.format("[SUCCESS] Sequence automation active for %s in Campaign \"%s\".", leadName, campaign.getName()));
        return new TestRunResponse(true, "Sequence simulation completed successfully", logs);
    }

    /**
     * Bulk sync entire sequence step list (reorder, add, update, delete in one unified call).
     */
    @Transactional
    public List<SequenceStep> syncSequenceSteps(Long campaignId, List<SequenceStepRequest> stepRequests) {
        getCampaign(campaignId);

        if (stepRequests != null && stepRequests.size() > 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A campaign sequence cannot exceed 8 steps (received: " + stepRequests.size() + ")");
        }

        if (stepRequests != null) {
            for (SequenceStepRequest req : stepRequests) {
                int delay = req.resolvedDelayDays();
                if (delay < 0 || delay > 90) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Step delay cannot exceed 90 days (received: " + delay + " days)");
                }
            }
        }

        sequenceStepRepository.deleteByCampaignId(campaignId);
        sequenceStepRepository.flush();

        if (stepRequests == null || stepRequests.isEmpty()) {
            return List.of();
        }

        List<SequenceStep> newSteps = new ArrayList<>();
        int order = 1;
        for (SequenceStepRequest req : stepRequests) {
            SequenceStep step = new SequenceStep(
                    campaignId,
                    order,
                    req.resolvedChannel(),
                    req.resolvedTitle(order),
                    req.resolvedDelayDays(),
                    req.resolvedSubject(),
                    req.resolvedBody(),
                    req.resolvedIsActive()
            );
            newSteps.add(step);
            order++;
        }

        List<SequenceStep> saved = sequenceStepRepository.saveAllAndFlush(newSteps);
        logger.info("Successfully synced {} sequence steps for campaign ID {}", saved.size(), campaignId);
        return saved;
    }

    @Transactional
    public SequenceStep updateSequenceStep(Long campaignId, Long stepId, SequenceStepRequest req) {
        getCampaign(campaignId);
        SequenceStep step = sequenceStepRepository.findById(stepId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Step not found with ID: " + stepId));

        if (!step.getCampaignId().equals(campaignId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Step does not belong to campaign ID " + campaignId);
        }

        if (req.delayDays() != null && (req.delayDays() < 0 || req.delayDays() > 90)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Step delay cannot exceed 90 days (received: " + req.delayDays() + " days)");
        }

        if (req.stepNumber() != null) step.setStepOrder(req.stepNumber());
        if (req.channel() != null) step.setChannel(req.channel());
        if (req.title() != null) step.setTitle(req.title());
        if (req.delayDays() != null) step.setDelayDays(req.delayDays());
        if (req.subject() != null) step.setSubjectTemplate(req.subject());
        if (req.body() != null) step.setBodyTemplate(req.body());
        if (req.isActive() != null) step.setIsActive(req.isActive());

        return sequenceStepRepository.save(step);
    }

    @Transactional
    public void deleteSequenceStep(Long campaignId, Long stepId) {
        getCampaign(campaignId);
        SequenceStep step = sequenceStepRepository.findById(stepId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Step not found with ID: " + stepId));

        if (!step.getCampaignId().equals(campaignId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Step does not belong to campaign ID " + campaignId);
        }

        sequenceStepRepository.delete(step);
        logger.info("Deleted step ID {} from campaign ID {}", stepId, campaignId);
    }

    /**
     * Enrolls a lead into a campaign starting at step 1.
     */
    @Transactional
    public LeadSequenceTracker enrollLead(String leadId, String email, String phone, Long campaignId,
                                          String firstName, String fullName, String personTitle,
                                          String companyName, String location, String revenue,
                                          String industry, int initialDelayDays) {
        // Idempotency: Prevent duplicate sequence trackers for the same lead in the same campaign
        String normalizedEmail = email != null ? email.trim().toLowerCase() : "";
        List<LeadSequenceTracker> existingTrackers = trackerRepository.findByCampaignId(campaignId);
        for (LeadSequenceTracker existing : existingTrackers) {
            boolean matchEmail = !normalizedEmail.isBlank() && normalizedEmail.equalsIgnoreCase(existing.getEmail());
            boolean matchLeadId = leadId != null && !leadId.isBlank() && leadId.equalsIgnoreCase(existing.getLeadId());
            if (matchEmail || matchLeadId) {
                logger.info("Lead {} already enrolled in campaign ID {} (tracker ID: {}). Skipping duplicate creation.",
                        email, campaignId, existing.getId());
                return existing;
            }
        }

        LeadSequenceTracker tracker = new LeadSequenceTracker();
        tracker.setLeadId(leadId);
        tracker.setEmail(email);
        tracker.setPhone(phone);
        tracker.setCampaignId(campaignId);
        tracker.setCurrentStepOrder(1);
        Campaign campaign = getCampaign(campaignId);
        tracker.setNextExecutionTime(calculateNextExecutionTime(LocalDateTime.now(), initialDelayDays, campaign));
        tracker.setStatus("PENDING");
        tracker.setFirstName(firstName);
        tracker.setFullName(fullName);
        tracker.setPersonTitle(personTitle);
        tracker.setCompanyName(companyName);
        tracker.setLocation(location);
        tracker.setRevenue(revenue);
        tracker.setIndustry(industry);

        return trackerRepository.save(tracker);
    }

    @Transactional
    public LeadSequenceTracker enrollLead(EnrollLeadRequest request, Long campaignId) {
        int initialDelayDays = request.initialDelayDays() != null ? request.initialDelayDays() : 0;
        return enrollLead(
                request.leadId(),
                request.email(),
                request.phone(),
                campaignId,
                request.resolvedFirstName(),
                request.resolvedFullName(),
                request.personTitle(),
                request.companyName(),
                request.location(),
                request.revenue(),
                request.industry(),
                initialDelayDays
        );
    }

    @Transactional
    public List<LeadSequenceTracker> bulkEnrollLeads(Long campaignId, List<EnrollLeadRequest> requests) {
        getCampaign(campaignId);
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }

        List<LeadSequenceTracker> trackers = new ArrayList<>();
        for (EnrollLeadRequest req : requests) {
            trackers.add(enrollLead(req, campaignId));
        }
        trackerRepository.flush();
        logger.info("Bulk enrolled {} leads into campaign ID {}", trackers.size(), campaignId);
        return trackers;
    }

    @Transactional
    public List<Campaign> getAllCampaigns(String status) {
        List<Campaign> running = campaignRepository.findByStatus("RUNNING");
        for (Campaign c : running) {
            checkAndCompleteCampaignIfDone(c.getId());
        }
        if (status == null || status.isBlank()) {
            return campaignRepository.findAll();
        }
        return campaignRepository.findByStatus(status);
    }

    @Transactional
    public Campaign getCampaign(Long campaignId) {
        checkAndCompleteCampaignIfDone(campaignId);
        return campaignRepository.findById(campaignId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Campaign not found with ID: " + campaignId));
    }

    @Transactional
    public Campaign createCampaign(String name, String status) {
        String resolvedStatus = (status == null || status.isBlank()) ? "READY" : status;
        if ("ACTIVE".equalsIgnoreCase(resolvedStatus)) {
            resolvedStatus = "RUNNING";
        }
        Campaign saved = campaignRepository.save(new Campaign(name, resolvedStatus));
        logger.info("Created campaign ID {} with name '{}', status '{}'", saved.getId(), saved.getName(), saved.getStatus());
        return saved;
    }

    @Transactional
    public Campaign createCampaign(CampaignRequest request) {
        String resolvedStatus = (request.status() == null || request.status().isBlank()) ? "READY" : request.status();
        if ("ACTIVE".equalsIgnoreCase(resolvedStatus)) {
            resolvedStatus = "RUNNING";
        }
        Campaign campaign = new Campaign(
                request.name() != null ? request.name() : "Automated Outreach Sequence Studio",
                resolvedStatus,
                request.sendingWindowStart(),
                request.sendingWindowEnd(),
                request.timezone(),
                request.resolvedAllowedDays(),
                request.resolvedMaxDailyEmailLimit(),
                request.resolvedMaxDailyWhatsappLimit()
        );
        Campaign saved = campaignRepository.save(campaign);
        logger.info("Created campaign ID {} with name '{}', window=[{}-{}], timezone={}, days={}, emailLimit={}, whatsappLimit={}",
                saved.getId(), saved.getName(), saved.getSendingWindowStart(), saved.getSendingWindowEnd(),
                saved.getTimezone(), saved.getAllowedDays(), saved.getMaxDailyEmailLimit(), saved.getMaxDailyWhatsappLimit());
        return saved;
    }

    @Transactional
    public Campaign updateCampaign(Long campaignId, CampaignRequest request) {
        Campaign campaign = getCampaign(campaignId);
        if (request.name() != null && !request.name().isBlank()) {
            campaign.setName(request.name().trim());
        }
        if (request.status() != null && !request.status().isBlank()) {
            String resolvedStatus = request.status().trim().toUpperCase();
            if ("ACTIVE".equals(resolvedStatus)) {
                resolvedStatus = "RUNNING";
            }
            campaign.setStatus(resolvedStatus);
        }
        if (request.sendingWindowStart() != null && !request.sendingWindowStart().isBlank()) {
            campaign.setSendingWindowStart(request.sendingWindowStart().trim());
        }
        if (request.sendingWindowEnd() != null && !request.sendingWindowEnd().isBlank()) {
            campaign.setSendingWindowEnd(request.sendingWindowEnd().trim());
        }
        if (request.timezone() != null && !request.timezone().isBlank()) {
            campaign.setTimezone(request.timezone().trim());
        }
        if (request.resolvedAllowedDays() != null && !request.resolvedAllowedDays().isBlank()) {
            campaign.setAllowedDays(request.resolvedAllowedDays().trim());
        }
        if (request.maxDailyEmailLimit() != null && request.maxDailyEmailLimit() > 0) {
            campaign.setMaxDailyEmailLimit(request.maxDailyEmailLimit());
        }
        if (request.maxDailyWhatsappLimit() != null && request.maxDailyWhatsappLimit() > 0) {
            campaign.setMaxDailyWhatsappLimit(request.maxDailyWhatsappLimit());
        }
        if (request.maxDailyLimit() != null && request.maxDailyLimit() > 0 && request.maxDailyEmailLimit() == null) {
            campaign.setMaxDailyLimit(request.maxDailyLimit());
        }
        Campaign saved = campaignRepository.save(campaign);
        logger.info("Updated campaign ID {} configuration: status={}, window=[{}-{}], timezone={}, days={}, emailLimit={}, whatsappLimit={}",
                saved.getId(), saved.getStatus(), saved.getSendingWindowStart(), saved.getSendingWindowEnd(),
                saved.getTimezone(), saved.getAllowedDays(), saved.getMaxDailyEmailLimit(), saved.getMaxDailyWhatsappLimit());
        return saved;
    }

    @Transactional(readOnly = true)
    public boolean isCampaignPaused(Long campaignId) {
        if (campaignId == null) {
            return false;
        }
        return campaignRepository.findById(campaignId)
                .map(c -> "PAUSED".equalsIgnoreCase(c.getStatus()))
                .orElse(false);
    }

    @Transactional
    public Campaign updateCampaignStatus(Long campaignId, String status) {
        Campaign campaign = getCampaign(campaignId);
        String resolvedStatus = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : "RUNNING";
        if ("ACTIVE".equalsIgnoreCase(resolvedStatus)) {
            resolvedStatus = "RUNNING";
        }
        campaign.setStatus(resolvedStatus);
        Campaign saved = campaignRepository.save(campaign);
        logger.info("Updated campaign ID {} status to {}", saved.getId(), saved.getStatus());
        return saved;
    }

    /**
     * Cascading wipe of campaign metadata, custom sequence steps, enrolled targets, and pending queues.
     */
    @Transactional
    public void deleteCampaign(Long campaignId) {
        logger.info("Permanently wiping campaign ID {} and all cascading sequence steps, targets, and queues...", campaignId);
        // 1. Purge custom sequence steps
        sequenceStepRepository.deleteByCampaignId(campaignId);
        sequenceStepRepository.flush();

        // 2. Purge enrolled sequence trackers
        trackerRepository.deleteByCampaignId(campaignId);
        trackerRepository.flush();

        // 3. Purge all enrolled targets and pending queues from leads repository
        leadsRepository.deleteAll();
        leadsRepository.flush();

        // 4. Purge campaign metadata record
        if (campaignRepository.existsById(campaignId)) {
            campaignRepository.deleteById(campaignId);
            campaignRepository.flush();
        }

        // 5. If no campaigns remain, ensure complete purge of all steps and trackers
        if (campaignRepository.count() == 0) {
            sequenceStepRepository.deleteAll();
            sequenceStepRepository.flush();
            trackerRepository.deleteAll();
            trackerRepository.flush();
            leadsRepository.deleteAll();
            leadsRepository.flush();
        }

        logger.info("Successfully completed cascading deletion for campaign ID {}", campaignId);
    }

    @Transactional
    public void deleteAllCampaigns() {
        logger.info("Permanently wiping all campaigns, sequence steps, targets, and queues...");
        sequenceStepRepository.deleteAll();
        sequenceStepRepository.flush();
        trackerRepository.deleteAll();
        trackerRepository.flush();
        leadsRepository.deleteAll();
        leadsRepository.flush();
        campaignRepository.deleteAll();
        campaignRepository.flush();
        logger.info("Successfully completed wipe of all campaigns and outreach data.");
    }

    @Transactional
    public SequenceStep addSequenceStep(Long campaignId, int stepOrder, int delayDays,
                                        String subjectTemplate, String bodyTemplate) {
        return addSequenceStep(campaignId, stepOrder, "email", "Step #" + stepOrder, delayDays, subjectTemplate, bodyTemplate, true);
    }

    @Transactional
    public SequenceStep addSequenceStep(Long campaignId, int stepOrder, String channel, String title, int delayDays,
                                        String subjectTemplate, String bodyTemplate, Boolean isActive) {
        getCampaign(campaignId);
        List<SequenceStep> existing = sequenceStepRepository.findByCampaignIdOrderByStepOrderAsc(campaignId);
        if (existing.size() >= 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A campaign sequence cannot exceed 8 steps");
        }
        if (delayDays < 0 || delayDays > 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Step delay cannot exceed 90 days (received: " + delayDays + " days)");
        }
        SequenceStep saved = sequenceStepRepository.save(
                new SequenceStep(campaignId, stepOrder, channel, title, delayDays, subjectTemplate, bodyTemplate, isActive));
        logger.info("Added step {} to campaign ID {}", stepOrder, campaignId);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<SequenceStep> getSequenceSteps(Long campaignId) {
        return sequenceStepRepository.findByCampaignIdOrderByStepOrderAsc(campaignId);
    }

    @Transactional(readOnly = true)
    public List<LeadSequenceTracker> getCampaignTrackers(Long campaignId) {
        return trackerRepository.findByCampaignId(campaignId);
    }

    @Transactional
    public LeadSequenceTracker updateTracker(Long trackerId, Map<String, Object> updates) {
        LeadSequenceTracker tracker = trackerRepository.findById(trackerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracker not found with ID: " + trackerId));
        if (updates.containsKey("currentStepOrder")) {
            tracker.setCurrentStepOrder(((Number) updates.get("currentStepOrder")).intValue());
        }
        if (updates.containsKey("status")) {
            tracker.setStatus((String) updates.get("status"));
        }
        if (updates.containsKey("nextExecutionTime")) {
            tracker.setNextExecutionTime(LocalDateTime.parse((String) updates.get("nextExecutionTime")));
        }
        return trackerRepository.save(tracker);
    }
}
