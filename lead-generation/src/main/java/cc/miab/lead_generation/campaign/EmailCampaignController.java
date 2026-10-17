package cc.miab.lead_generation.campaign;

import cc.miab.lead_generation.campaign.dto.CampaignRequest;
import cc.miab.lead_generation.campaign.dto.CampaignResponse;
import cc.miab.lead_generation.campaign.dto.CampaignStatusRequest;
import cc.miab.lead_generation.campaign.dto.EnrollLeadRequest;
import cc.miab.lead_generation.campaign.dto.LeadSequenceTrackerResponse;
import cc.miab.lead_generation.campaign.dto.SequenceStepRequest;
import cc.miab.lead_generation.campaign.dto.SequenceStepResponse;
import cc.miab.lead_generation.campaign.dto.TestRunRequest;
import cc.miab.lead_generation.campaign.dto.TestRunResponse;
import cc.miab.lead_generation.campaign.entity.SequenceStep;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.RequestMethod;

@RestController
@RequestMapping({"/api/campaigns", "/api/campaign"})
@CrossOrigin(
        originPatterns = {"http://localhost:[*]", "http://127.0.0.1:[*]", "https://*.vercel.app", "https://*.onrender.com"},
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS},
        allowedHeaders = "*"
)
public class EmailCampaignController {

    private final EmailCampaignService emailCampaignService;

    public EmailCampaignController(EmailCampaignService emailCampaignService) {
        this.emailCampaignService = emailCampaignService;
    }

    /**
     * Resolves the active / default campaign for the frontend.
     */
    @GetMapping("/active")
    public CampaignResponse getActiveCampaign() {
        return CampaignResponse.from(emailCampaignService.getOrCreateDefaultCampaign());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignResponse createCampaign(@RequestBody CampaignRequest request) {
        return CampaignResponse.from(
                emailCampaignService.createCampaign(request.name(), request.status()));
    }

    @GetMapping
    public List<CampaignResponse> getCampaigns(@RequestParam(required = false) String status) {
        return emailCampaignService.getAllCampaigns(status).stream()
                .map(CampaignResponse::from)
                .toList();
    }

    @GetMapping("/{campaignId}")
    public CampaignResponse getCampaign(@PathVariable Long campaignId) {
        return CampaignResponse.from(emailCampaignService.getCampaign(campaignId));
    }

    /**
     * PUT /api/campaign/status or PUT /api/campaigns/status
     * Receives new status payload ("RUNNING" or "PAUSED")
     */
    @PutMapping("/status")
    public CampaignResponse updateCampaignStatusDirect(@RequestBody CampaignStatusRequest request) {
        Long campaignId = request.campaignId();
        if (campaignId == null) {
            campaignId = emailCampaignService.getOrCreateDefaultCampaign().getId();
        }
        return CampaignResponse.from(
                emailCampaignService.updateCampaignStatus(campaignId, request.status()));
    }

    @PutMapping("/{campaignId}/status")
    public CampaignResponse updateCampaignStatusPut(@PathVariable Long campaignId,
                                                    @RequestBody CampaignStatusRequest request) {
        return CampaignResponse.from(
                emailCampaignService.updateCampaignStatus(campaignId, request.status()));
    }

    @PatchMapping("/{campaignId}/status")
    public CampaignResponse updateCampaignStatus(@PathVariable Long campaignId,
                                                 @RequestBody CampaignStatusRequest request) {
        return CampaignResponse.from(
                emailCampaignService.updateCampaignStatus(campaignId, request.status()));
    }

    /**
     * DELETE /api/campaign or DELETE /api/campaigns or DELETE /api/campaigns/{campaignId}
     * Cascading wipe of campaign metadata, sequence steps, targets, and queues.
     */
    @DeleteMapping({"", "/{campaignId}"})
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> deleteCampaign(@PathVariable(required = false) Long campaignId) {
        if (campaignId == null) {
            campaignId = emailCampaignService.getOrCreateDefaultCampaign().getId();
        }
        emailCampaignService.deleteCampaign(campaignId);
        return Map.of(
                "status", "success",
                "message", "Campaign " + campaignId + " and all sequence steps, targets, and queues permanently deleted.",
                "campaignId", campaignId
        );
    }

    @PostMapping("/{campaignId}/steps")
    @ResponseStatus(HttpStatus.CREATED)
    public SequenceStepResponse addSequenceStep(@PathVariable Long campaignId,
                                                @RequestBody SequenceStepRequest request) {
        int order = request.resolvedStepOrder(emailCampaignService.getSequenceSteps(campaignId).size() + 1);
        SequenceStep saved = emailCampaignService.addSequenceStep(
                campaignId,
                order,
                request.resolvedChannel(),
                request.resolvedTitle(order),
                request.resolvedDelayDays(),
                request.resolvedSubject(),
                request.resolvedBody(),
                request.resolvedIsActive()
        );
        return SequenceStepResponse.from(saved);
    }

    @GetMapping("/{campaignId}/steps")
    public List<SequenceStepResponse> getSequenceSteps(@PathVariable Long campaignId) {
        return emailCampaignService.getSequenceSteps(campaignId).stream()
                .map(SequenceStepResponse::from)
                .toList();
    }

    /**
     * Replaces and syncs the entire list of sequence steps in reordered sequence.
     */
    @PutMapping("/{campaignId}/steps")
    public List<SequenceStepResponse> syncSequenceSteps(@PathVariable Long campaignId,
                                                        @RequestBody List<SequenceStepRequest> steps) {
        return emailCampaignService.syncSequenceSteps(campaignId, steps).stream()
                .map(SequenceStepResponse::from)
                .toList();
    }

    @PutMapping("/{campaignId}/steps/{stepId}")
    public SequenceStepResponse updateSequenceStep(@PathVariable Long campaignId,
                                                   @PathVariable Long stepId,
                                                   @RequestBody SequenceStepRequest request) {
        return SequenceStepResponse.from(emailCampaignService.updateSequenceStep(campaignId, stepId, request));
    }

    @DeleteMapping("/{campaignId}/steps/{stepId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSequenceStep(@PathVariable Long campaignId,
                                   @PathVariable Long stepId) {
        emailCampaignService.deleteSequenceStep(campaignId, stepId);
    }

    @PostMapping("/{campaignId}/enrollments")
    @ResponseStatus(HttpStatus.CREATED)
    public LeadSequenceTrackerResponse enrollLead(@PathVariable Long campaignId,
                                                  @RequestBody EnrollLeadRequest request) {
        return LeadSequenceTrackerResponse.from(
                emailCampaignService.enrollLead(request, campaignId));
    }

    @PostMapping("/{campaignId}/enrollments/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<LeadSequenceTrackerResponse> bulkEnrollLeads(@PathVariable Long campaignId,
                                                            @RequestBody List<EnrollLeadRequest> requests) {
        return emailCampaignService.bulkEnrollLeads(campaignId, requests).stream()
                .map(LeadSequenceTrackerResponse::from)
                .toList();
    }

    @GetMapping("/{campaignId}/enrollments")
    public List<LeadSequenceTrackerResponse> getCampaignEnrollments(@PathVariable Long campaignId) {
        return emailCampaignService.getCampaignTrackers(campaignId).stream()
                .map(LeadSequenceTrackerResponse::from)
                .toList();
    }

    @PostMapping("/enrollments/{trackerId}/process")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void processEnrollment(@PathVariable Long trackerId) {
        emailCampaignService.processTrackerAsync(trackerId);
    }

    /**
     * Executes test sequence with real-time log lines for frontend console simulation.
     */
    @PostMapping("/{campaignId}/test-run")
    public TestRunResponse testRunSequence(@PathVariable Long campaignId,
                                           @RequestBody(required = false) TestRunRequest request) {
        return emailCampaignService.runTestSequence(campaignId, request);
    }

    /**
     * Immediately triggers scheduled outreach execution and dispatches all pending sequence steps for the campaign.
     */
    @PostMapping("/{campaignId}/process-all")
    public Map<String, Object> processAllCampaignTrackers(@PathVariable Long campaignId) {
        int triggered = emailCampaignService.processCampaignTrackersImmediately(campaignId);
        return Map.of(
                "status", "success",
                "campaignId", campaignId,
                "message", "Dispatched outreach cycle for campaign " + campaignId,
                "processedTrackers", triggered
        );
    }
}

