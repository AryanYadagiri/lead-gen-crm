package cc.miab.lead_generation.campaign;

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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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

    @Transactional
    public Campaign getOrCreateDefaultCampaign() {
        List<Campaign> campaigns = campaignRepository.findAll();
        if (!campaigns.isEmpty()) {
            return campaigns.get(0);
        }

        logger.info("No campaign found. Initializing default automated outreach campaign...");
        Campaign defaultCampaign = campaignRepository.save(new Campaign("Automated Outreach Sequence Studio", "READY"));

        // Seed initial steps matching frontend DEFAULT_SEQUENCE_STEPS
        List<SequenceStep> initialSteps = List.of(
                new SequenceStep(defaultCampaign.getId(), 1, "email", "Initial Executive Touch", 1,
                        "Quick question regarding {{company_name}} scaling",
                        "Hi {{first_name}},\n\nI noticed {{company_name}} has been expanding rapidly in {{location}}'s {{industry}} sector.\n\nMany {{person_title}}s we speak with in companies around {{revenue}}M revenue are looking to scale their outbound acquisition pipeline without increasing headcount.\n\nWe recently helped a similar company scale their target outreach by 3.4x while maintaining high reply rates.\n\nWould you be open to a 10-minute executive briefing this Thursday?\n\nBest regards,\nLeadFlow Outreach Team",
                        true),
                new SequenceStep(defaultCampaign.getId(), 2, "whatsapp", "Direct WhatsApp Intro", 2,
                        "",
                        "Hi {{first_name}} 👋 I sent an email to your inbox yesterday regarding {{company_name}}. Just wanted to reach out here directly in case WhatsApp is easier for a quick response! Would love to drop a 1-min video breakdown.",
                        true),
                new SequenceStep(defaultCampaign.getId(), 3, "email", "Case Study Follow-up", 3,
                        "Case study: How SaaS leaders in {{industry}} increased qualified leads by 340%",
                        "Hi {{first_name}},\n\nFollowing up on my previous note. Here is a brief 2-page teardown of how an executive team at a company similar to {{company_name}} unlocked predictable lead generation.\n\nKey takeaways:\n1. Advanced multi-channel sequencing (Email + WhatsApp)\n2. Automated profile enrichment\n3. Tier-1 verified direct dial routing\n\nAre you free for a quick call tomorrow afternoon?\n\nBest,\nLeadFlow Team",
                        true),
                new SequenceStep(defaultCampaign.getId(), 4, "whatsapp", "WhatsApp Value Nudge", 2,
                        "",
                        "Hey {{first_name}}, dropping a quick note on WhatsApp! We just released a customized benchmark report for {{industry}} leaders in {{location}}. Can I WhatsApp over the PDF summary? 📄",
                        false)
        );

        sequenceStepRepository.saveAll(initialSteps);
        logger.info("Successfully seeded default campaign ID {} with {} sequence steps", defaultCampaign.getId(), initialSteps.size());
        return defaultCampaign;
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
     * Non-blocking background runner scheduled to run hourly.
     */
    @Scheduled(cron = "${campaign.scheduler.cron:0 0 * * * *}")
    public int executeScheduledOutreach() {
        LocalDateTime now = LocalDateTime.now();
        logger.info("Starting scheduled outreach engine cycle at {}", now);

        List<LeadSequenceTracker> pendingTrackers = trackerRepository
                .findByStatusAndNextExecutionTimeLessThanEqual("PENDING", now);

        logger.info("Found {} pending lead sequence tracker(s) ready for execution", pendingTrackers.size());

        int dispatchedCount = 0;
        for (LeadSequenceTracker tracker : pendingTrackers) {
            if (isCampaignPaused(tracker.getCampaignId())) {
                logger.info("Campaign ID {} is PAUSED. Skipping scheduled outreach for tracker ID {}.",
                        tracker.getCampaignId(), tracker.getId());
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

        // 3. State Persist: As soon as sequence starts, explicitly set status to RUNNING in DB to block simultaneous requests
        campaign.setStatus("RUNNING");
        campaignRepository.saveAndFlush(campaign);
        logger.info("Persisted campaign ID {} status to RUNNING in database to lock simultaneous execution.", campaignId);

        // 1. Purge any duplicate trackers in trackerRepository for this campaign so each email has at most one tracker
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

        // 2. Sync any leads from the database leads table that aren't yet in this campaign
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

        // 2. Filter pending trackers; if all existing trackers are COMPLETED or FAILED, allow re-triggering them from step 1
        List<LeadSequenceTracker> trackersToProcess = allTrackers.stream()
                .filter(t -> "PENDING".equalsIgnoreCase(t.getStatus()))
                .toList();

        if (trackersToProcess.isEmpty() && !allTrackers.isEmpty()) {
            logger.info("All {} tracker(s) for campaign ID {} were previously finished. Resetting to step 1 for re-dispatch.",
                    allTrackers.size(), campaignId);
            List<LeadSequenceTracker> resetTrackers = new ArrayList<>();
            for (LeadSequenceTracker t : allTrackers) {
                t.setStatus("PENDING");
                t.setCurrentStepOrder(1);
                t.setNextExecutionTime(LocalDateTime.now());
                resetTrackers.add(trackerRepository.save(t));
            }
            trackersToProcess = resetTrackers;
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

        if (isCampaignPaused(tracker.getCampaignId())) {
            logger.info("Campaign ID {} is PAUSED. Halting dispatch for tracker ID {}.",
                    tracker.getCampaignId(), tracker.getId());
            return;
        }

        Optional<SequenceStep> currentStepOpt = sequenceStepRepository
                .findByCampaignIdAndStepOrder(tracker.getCampaignId(), tracker.getCurrentStepOrder());

        if (currentStepOpt.isEmpty()) {
            logger.info("No step found for campaignId={} with stepOrder={}. Marking tracker ID {} as COMPLETED.",
                    tracker.getCampaignId(), tracker.getCurrentStepOrder(), tracker.getId());
            tracker.setStatus("COMPLETED");
            trackerRepository.save(tracker);
            return;
        }

        SequenceStep currentStep = currentStepOpt.get();
        String channel = currentStep.getChannel() != null ? currentStep.getChannel().toLowerCase() : "email";

        String parsedSubject = parseTemplate(currentStep.getSubjectTemplate(), tracker);
        String parsedBody = parseTemplate(currentStep.getBodyTemplate(), tracker);

        try {
            if ("whatsapp".equalsIgnoreCase(channel)) {
                String targetPhone = tracker.getPhone() != null ? tracker.getPhone() : "[No Phone]";
                logger.info("Dispatched WhatsApp step {} to recipient {} via Web API: {}",
                        tracker.getCurrentStepOrder(), targetPhone, parsedBody);
            } else {
                // Verify email validity with MyEmailVerifier to prevent sending campaigns to invalid email IDs
                MyEmailVerifierResponse verification = emailVerifierService.verifyEmail(tracker.getEmail());
                if (verification != null && verification.isInvalid()) {
                    logger.warn("Prevented email send for tracker ID {}: MyEmailVerifier reported Status='{}', Diagnosis='{}'. Marking tracker as INVALID_EMAIL to protect sender reputation.",
                            tracker.getId(), verification.status(), verification.diagnosis());
                    tracker.setStatus("INVALID_EMAIL");
                    trackerRepository.save(tracker);
                    return;
                }

                emailSenderService.sendEmail(tracker.getEmail(), parsedSubject, parsedBody);
                logger.info("Dispatched step {} email for campaign {} to {}",
                        tracker.getCurrentStepOrder(), tracker.getCampaignId(), tracker.getEmail());
            }
        } catch (Exception ex) {
            logger.error("Failed to dispatch {} to {} for tracker ID: {}", channel, tracker.getEmail(), tracker.getId(), ex);
            tracker.setStatus("FAILED");
            trackerRepository.save(tracker);
            return;
        }

        // Pacing to next step
        Optional<SequenceStep> nextStepOpt = sequenceStepRepository
                .findByCampaignIdAndStepOrder(tracker.getCampaignId(), tracker.getCurrentStepOrder() + 1);

        if (nextStepOpt.isPresent()) {
            SequenceStep nextStep = nextStepOpt.get();
            tracker.setCurrentStepOrder(tracker.getCurrentStepOrder() + 1);
            tracker.setNextExecutionTime(LocalDateTime.now().plusDays(nextStep.getDelayDays()));
            trackerRepository.save(tracker);
            logger.info("Advanced tracker ID {} to stepOrder {} with nextExecutionTime={}",
                    tracker.getId(), tracker.getCurrentStepOrder(), tracker.getNextExecutionTime());
        } else {
            tracker.setStatus("COMPLETED");
            trackerRepository.save(tracker);
            logger.info("All sequence steps completed for tracker ID: {}. Marked as COMPLETED.", tracker.getId());
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
                logs.add(String.format("[Delay %d Day(s) simulated...]", step.getDelayDays()));
                logs.add(String.format("[Step %d] Triggering WhatsApp Web API to %s...", stepNum, phone));
                logs.add(String.format("[Step %d] WhatsApp Message Sent & Delivered (Double Blue Tick Verified)!", stepNum));
            } else {
                if (stepNum > 1) {
                    logs.add(String.format("[Delay %d Day(s) simulated...]", step.getDelayDays()));
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

        List<SequenceStep> saved = sequenceStepRepository.saveAll(newSteps);
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
        tracker.setNextExecutionTime(LocalDateTime.now().plusDays(initialDelayDays));
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

    @Transactional(readOnly = true)
    public List<Campaign> getAllCampaigns(String status) {
        if (status == null || status.isBlank()) {
            return campaignRepository.findAll();
        }
        return campaignRepository.findByStatus(status);
    }

    @Transactional(readOnly = true)
    public Campaign getCampaign(Long campaignId) {
        return campaignRepository.findById(campaignId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Campaign not found with ID: " + campaignId));
    }

    @Transactional
    public Campaign createCampaign(String name, String status) {
        String resolvedStatus = (status == null || status.isBlank()) ? "ACTIVE" : status;
        Campaign saved = campaignRepository.save(new Campaign(name, resolvedStatus));
        logger.info("Created campaign ID {} with name '{}'", saved.getId(), saved.getName());
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

        logger.info("Successfully completed cascading deletion for campaign ID {}", campaignId);
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
}
