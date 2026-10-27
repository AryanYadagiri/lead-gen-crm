package cc.miab.lead_generation.campaign;

import cc.miab.lead_generation.campaign.entity.Campaign;
import cc.miab.lead_generation.campaign.repository.CampaignRepository;
import cc.miab.lead_generation.campaign.repository.LeadSequenceTrackerRepository;
import cc.miab.lead_generation.campaign.repository.SequenceStepRepository;
import cc.miab.lead_generation.email.EmailSenderService;
import cc.miab.lead_generation.lead.repository.LeadsRepository;
import cc.miab.lead_generation.verifier.EmailVerifierService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailCampaignServiceTest {

    @Mock
    private LeadSequenceTrackerRepository trackerRepository;
    @Mock
    private SequenceStepRepository sequenceStepRepository;
    @Mock
    private CampaignRepository campaignRepository;
    @Mock
    private LeadsRepository leadsRepository;
    @Mock
    private EmailSenderService emailSenderService;
    @Mock
    private EmailVerifierService emailVerifierService;

    private EmailCampaignService service;

    @BeforeEach
    void setUp() {
        service = new EmailCampaignService(
                trackerRepository,
                sequenceStepRepository,
                campaignRepository,
                leadsRepository,
                emailSenderService,
                emailVerifierService,
                Executors.newSingleThreadExecutor()
        );
    }

    @Test
    void testCheckAndCompleteCampaignIfDone_ZeroPending_UpdatesToCompleted() {
        Long campaignId = 1L;
        Campaign campaign = new Campaign("Test Outreach", "RUNNING");
        campaign.setId(campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(trackerRepository.countByCampaignId(campaignId)).thenReturn(5L);
        when(trackerRepository.countByCampaignIdAndStatus(campaignId, "PENDING")).thenReturn(0L);

        service.checkAndCompleteCampaignIfDone(campaignId);

        assertEquals("COMPLETED", campaign.getStatus());
        verify(campaignRepository).saveAndFlush(campaign);
    }

    @Test
    void testCheckAndCompleteCampaignIfDone_PendingRemaining_RemainsRunning() {
        Long campaignId = 1L;
        Campaign campaign = new Campaign("Test Outreach", "RUNNING");
        campaign.setId(campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(trackerRepository.countByCampaignId(campaignId)).thenReturn(5L);
        when(trackerRepository.countByCampaignIdAndStatus(campaignId, "PENDING")).thenReturn(2L);

        service.checkAndCompleteCampaignIfDone(campaignId);

        assertEquals("RUNNING", campaign.getStatus());
        verify(campaignRepository, never()).saveAndFlush(campaign);
    }

    @Test
    void testIsWithinSendingWindow() {
        Campaign campaign = new Campaign("Test", "RUNNING");
        campaign.setSendingWindowStart("09:00");
        campaign.setSendingWindowEnd("17:00");

        ZoneId zone = ZoneId.of("Asia/Kolkata");

        // 10:00 is within 09:00 - 17:00
        ZonedDateTime inside = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(10, 0), zone);
        assertTrue(service.isWithinSendingWindow(campaign, inside));

        // 08:30 is before 09:00
        ZonedDateTime before = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(8, 30), zone);
        assertFalse(service.isWithinSendingWindow(campaign, before));

        // 18:00 is after 17:00
        ZonedDateTime after = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(18, 0), zone);
        assertFalse(service.isWithinSendingWindow(campaign, after));
    }

    @Test
    void testIsAllowedDay() {
        Campaign campaign = new Campaign("Test", "RUNNING");
        campaign.setAllowedDays("MON,TUE,WED,THU,FRI");

        ZoneId zone = ZoneId.of("Asia/Kolkata");

        // Friday
        ZonedDateTime friday = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(10, 0), zone);
        assertEquals(DayOfWeek.FRIDAY, friday.getDayOfWeek());
        assertTrue(service.isAllowedDay(campaign, friday));

        // Sunday
        ZonedDateTime sunday = ZonedDateTime.of(LocalDate.of(2026, 10, 25), LocalTime.of(10, 0), zone);
        assertEquals(DayOfWeek.SUNDAY, sunday.getDayOfWeek());
        assertFalse(service.isAllowedDay(campaign, sunday));
    }

    @Test
    void testIsUnderDailyLimitAndResetIfNewDay() {
        Campaign campaign = new Campaign("Test", "RUNNING");
        campaign.setMaxDailyEmailLimit(2);
        campaign.setDailyEmailSentCount(2);
        campaign.setLastDispatchDate(LocalDate.of(2026, 10, 22)); // Yesterday

        ZoneId zone = ZoneId.of("Asia/Kolkata");
        ZonedDateTime today = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(10, 0), zone);

        // Date changed -> resets daily count to 0, returns true
        boolean canSend = service.isUnderDailyLimitAndResetIfNewDay(campaign, today);
        assertTrue(canSend);
        assertEquals(0, campaign.getDailyEmailSentCount());
        assertEquals(LocalDate.of(2026, 10, 23), campaign.getLastDispatchDate());

        // Fill up to max limit of 2
        campaign.setDailyEmailSentCount(2);
        assertFalse(service.isUnderDailyLimitAndResetIfNewDay(campaign, today));
    }

    @Test
    void testIsUnderChannelDailyLimitAndResetIfNewDay_IndependentQuotas() {
        Campaign campaign = new Campaign("Test", "RUNNING");
        campaign.setMaxDailyEmailLimit(2);
        campaign.setMaxDailyWhatsappLimit(5);
        campaign.setDailyEmailSentCount(2); // Email limit reached
        campaign.setDailyWhatsappSentCount(1); // WhatsApp quota still available
        campaign.setLastDispatchDate(LocalDate.of(2026, 10, 23));

        ZoneId zone = ZoneId.of("Asia/Kolkata");
        ZonedDateTime today = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(10, 0), zone);

        // Email should be blocked
        assertFalse(service.isUnderChannelDailyLimitAndResetIfNewDay(campaign, "email", today));
        // WhatsApp should be allowed
        assertTrue(service.isUnderChannelDailyLimitAndResetIfNewDay(campaign, "whatsapp", today));

        // Date advances to next day -> resets both counters
        ZonedDateTime tomorrow = ZonedDateTime.of(LocalDate.of(2026, 10, 24), LocalTime.of(10, 0), zone);
        assertTrue(service.isUnderChannelDailyLimitAndResetIfNewDay(campaign, "email", tomorrow));
        assertEquals(0, campaign.getDailyEmailSentCount());
        assertEquals(0, campaign.getDailyWhatsappSentCount());
        assertEquals(LocalDate.of(2026, 10, 24), campaign.getLastDispatchDate());
    }

    @Test
    void testQuotaCaps_Enforced() {
        Campaign campaign = new Campaign("Test", "RUNNING");
        // Over maximums
        campaign.setMaxDailyEmailLimit(500); // Max allowed: 200
        campaign.setMaxDailyWhatsappLimit(2000); // Max allowed: 1000

        assertEquals(200, campaign.getMaxDailyEmailLimit(), "Email limit must be capped at 200");
        assertEquals(1000, campaign.getMaxDailyWhatsappLimit(), "WhatsApp limit must be capped at 1000");
    }

    @Test
    void testProcessCampaignTrackersImmediately_FreshnessGuarantee_ResetsTrackersAndSetsRunning() {
        Long campaignId = 1L;
        Campaign campaign = new Campaign("Test Campaign", "COMPLETED");
        campaign.setId(campaignId);
        campaign.setSenderEmail("outreach@test.com");
        campaign.setSenderPassword("secret");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(sequenceStepRepository.findByCampaignIdOrderByStepOrderAsc(campaignId)).thenReturn(java.util.List.of(
                new cc.miab.lead_generation.campaign.entity.SequenceStep(campaignId, 1, "email", "Step 1", 0, "Subject", "Body", true)
        ));

        cc.miab.lead_generation.campaign.entity.LeadSequenceTracker tracker =
                new cc.miab.lead_generation.campaign.entity.LeadSequenceTracker();
        tracker.setId(101L);
        tracker.setLeadId("lead-1");
        tracker.setEmail("test@example.com");
        tracker.setCampaignId(campaignId);
        tracker.setStatus("COMPLETED");
        tracker.setCurrentStepOrder(3);

        when(trackerRepository.findByCampaignId(campaignId)).thenReturn(new java.util.ArrayList<>(java.util.List.of(tracker)));
        when(leadsRepository.findAll()).thenReturn(java.util.List.of());

        int count = service.processCampaignTrackersImmediately(campaignId);

        assertEquals(1, count);
        assertEquals("RUNNING", campaign.getStatus());
        assertEquals("PENDING", tracker.getStatus());
        assertEquals(1, tracker.getCurrentStepOrder());

        verify(campaignRepository).saveAndFlush(campaign);
        verify(sequenceStepRepository).findByCampaignIdOrderByStepOrderAsc(campaignId);
        verify(trackerRepository).saveAllAndFlush(any());
    }

    @Test
    void testProcessCampaignTrackersImmediately_MissingCredentials_RejectsAndRemainsDraft() {
        Long campaignId = 2L;
        Campaign campaign = new Campaign("Draft Campaign", "DRAFT");
        campaign.setId(campaignId);
        // No sender email or password set

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(sequenceStepRepository.findByCampaignIdOrderByStepOrderAsc(campaignId)).thenReturn(java.util.List.of(
                new cc.miab.lead_generation.campaign.entity.SequenceStep(campaignId, 1, "email", "Step 1", 0, "Subject", "Body", true)
        ));

        org.springframework.web.server.ResponseStatusException ex = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> service.processCampaignTrackersImmediately(campaignId)
        );

        assertTrue(ex.getReason().contains("Outbound sender email and password must be configured"));
        assertEquals("DRAFT", campaign.getStatus(), "Campaign status must remain DRAFT on credential failure");
        verify(campaignRepository, never()).saveAndFlush(campaign);
    }

    @Test
    void testProcessCampaignTrackersImmediately_SmtpAuthFailed_RejectsAndRemainsDraft() {
        Long campaignId = 3L;
        Campaign campaign = new Campaign("Draft Campaign", "DRAFT");
        campaign.setId(campaignId);
        campaign.setSenderEmail("bad@example.com");
        campaign.setSenderPassword("wrongpass");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(sequenceStepRepository.findByCampaignIdOrderByStepOrderAsc(campaignId)).thenReturn(java.util.List.of(
                new cc.miab.lead_generation.campaign.entity.SequenceStep(campaignId, 1, "email", "Step 1", 0, "Subject", "Body", true)
        ));

        doThrow(new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "SMTP Authentication Failed: 535 Invalid login"
        )).when(emailSenderService).validateSmtpCredentials(any(), any(), eq("bad@example.com"), eq("wrongpass"));

        org.springframework.web.server.ResponseStatusException ex = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> service.processCampaignTrackersImmediately(campaignId)
        );

        assertTrue(ex.getReason().contains("SMTP Authentication Failed: 535 Invalid login"));
        assertEquals("DRAFT", campaign.getStatus(), "Campaign status must remain DRAFT on auth failure");
        verify(campaignRepository, never()).saveAndFlush(campaign);
    }

    @Test
    void testCalculateNextExecutionTime_PreventWeekendBunching_DeferredStepPushesSubsequentStepRelatively() {
        Campaign campaign = new Campaign("Outreach", "RUNNING");
        campaign.setAllowedDays("MON,TUE,WED,THU,FRI");
        campaign.setSendingWindowStart("09:00");
        campaign.setSendingWindowEnd("17:00");
        campaign.setTimezone("Asia/Kolkata");

        // Step 1 was Friday. Step 2 (delay 1 day) lands on Saturday (weekend), pushed to Monday 09:00 AM
        LocalDateTime fridayTenAm = LocalDateTime.of(2026, 10, 23, 10, 0); // Friday
        assertEquals(DayOfWeek.FRIDAY, fridayTenAm.getDayOfWeek());

        LocalDateTime step2ScheduledTime = service.calculateNextExecutionTime(fridayTenAm, 1, campaign);
        assertEquals(DayOfWeek.MONDAY, step2ScheduledTime.getDayOfWeek());
        assertEquals(LocalTime.of(9, 0), step2ScheduledTime.toLocalTime());

        // Step 2 actually executes on Monday.
        // Step 3's schedule MUST remain strictly relative to Step 2's actual execution time on Monday!
        LocalDateTime step2ActualExecutionTime = LocalDateTime.of(2026, 10, 26, 9, 30); // Monday
        assertEquals(DayOfWeek.MONDAY, step2ActualExecutionTime.getDayOfWeek());

        // Step 3 delay is 1 day -> MUST push to Tuesday, NOT collapse onto Monday!
        LocalDateTime step3ScheduledTime = service.calculateNextExecutionTime(step2ActualExecutionTime, 1, campaign);
        assertEquals(DayOfWeek.TUESDAY, step3ScheduledTime.getDayOfWeek(), "Step 3 must push to Tuesday and not bunch onto Monday");
        assertEquals(LocalTime.of(9, 30), step3ScheduledTime.toLocalTime());
    }

    @Test
    void testCalculateNextExecutionTime_RespectIntentionalZeroDayDelay() {
        Campaign campaign = new Campaign("Outreach", "RUNNING");
        campaign.setAllowedDays("MON,TUE,WED,THU,FRI");
        campaign.setSendingWindowStart("09:00");
        campaign.setSendingWindowEnd("17:00");
        campaign.setTimezone(ZoneId.systemDefault().getId());

        // Inside window on Wednesday 11:00 AM with delay = 0
        LocalDateTime wednesdayElevenAm = LocalDateTime.of(2026, 10, 21, 11, 0);
        assertEquals(DayOfWeek.WEDNESDAY, wednesdayElevenAm.getDayOfWeek());

        LocalDateTime nextExecutionTime = service.calculateNextExecutionTime(wednesdayElevenAm, 0, campaign);
        assertEquals(wednesdayElevenAm, nextExecutionTime, "0-day delay must allow immediate/same-day execution");
    }

    @Test
    void testProcessTracker_RespectIntentionalZeroDayDelay_SendsMultipleStepsSameDay() {
        Long campaignId = 10L;
        Campaign campaign = new Campaign("Outreach", "RUNNING");
        campaign.setId(campaignId);
        campaign.setMaxDailyLimit(50);
        campaign.setDailySentCount(0);
        campaign.setSendingWindowStart("00:00");
        campaign.setSendingWindowEnd("23:59");
        campaign.setAllowedDays("MON,TUE,WED,THU,FRI,SAT,SUN");
        campaign.setTimezone(ZoneId.systemDefault().getId());

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        // Step 1 (delay 0)
        cc.miab.lead_generation.campaign.entity.SequenceStep step1 =
                new cc.miab.lead_generation.campaign.entity.SequenceStep(campaignId, 1, "email", "Step 1", 0, "Subject 1", "Body 1", true);
        // Step 2 (delay 0 - intentional 0-day delay)
        cc.miab.lead_generation.campaign.entity.SequenceStep step2 =
                new cc.miab.lead_generation.campaign.entity.SequenceStep(campaignId, 2, "email", "Step 2", 0, "Subject 2", "Body 2", true);

        when(sequenceStepRepository.findByCampaignIdAndStepOrder(campaignId, 1)).thenReturn(Optional.of(step1));
        when(sequenceStepRepository.findByCampaignIdAndStepOrder(campaignId, 2)).thenReturn(Optional.of(step2));
        when(sequenceStepRepository.findByCampaignIdAndStepOrder(campaignId, 3)).thenReturn(Optional.empty());

        when(emailVerifierService.verifyEmail(anyString())).thenReturn(null);

        cc.miab.lead_generation.campaign.entity.LeadSequenceTracker tracker =
                new cc.miab.lead_generation.campaign.entity.LeadSequenceTracker();
        tracker.setId(501L);
        tracker.setLeadId("lead-501");
        tracker.setEmail("multi@example.com");
        tracker.setCampaignId(campaignId);
        tracker.setStatus("PENDING");
        tracker.setCurrentStepOrder(1);

        service.processTracker(tracker);

        verify(emailSenderService, times(2)).sendEmail(
                eq("multi@example.com"),
                anyString(),
                anyString(),
                any(),
                any(),
                any(),
                any(),
                any()
        );
        assertEquals("COMPLETED", tracker.getStatus(), "Tracker should complete after both steps are delivered");
    }
}
