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
        campaign.setMaxDailyLimit(2);
        campaign.setDailySentCount(2);
        campaign.setLastDispatchDate(LocalDate.of(2026, 10, 22)); // Yesterday

        ZoneId zone = ZoneId.of("Asia/Kolkata");
        ZonedDateTime today = ZonedDateTime.of(LocalDate.of(2026, 10, 23), LocalTime.of(10, 0), zone);

        // Date changed -> resets daily count to 0, returns true
        boolean canSend = service.isUnderDailyLimitAndResetIfNewDay(campaign, today);
        assertTrue(canSend);
        assertEquals(0, campaign.getDailySentCount());
        assertEquals(LocalDate.of(2026, 10, 23), campaign.getLastDispatchDate());

        // Fill up to max limit of 2
        campaign.setDailySentCount(2);
        assertFalse(service.isUnderDailyLimitAndResetIfNewDay(campaign, today));
    }

    @Test
    void testProcessCampaignTrackersImmediately_FreshnessGuarantee_ResetsTrackersAndSetsRunning() {
        Long campaignId = 1L;
        Campaign campaign = new Campaign("Test Campaign", "COMPLETED");
        campaign.setId(campaignId);

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
}
