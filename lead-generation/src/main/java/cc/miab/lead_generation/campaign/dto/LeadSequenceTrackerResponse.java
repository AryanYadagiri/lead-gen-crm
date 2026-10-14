package cc.miab.lead_generation.campaign.dto;

import cc.miab.lead_generation.campaign.entity.LeadSequenceTracker;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record LeadSequenceTrackerResponse(
        @JsonProperty("id")
        Long id,

        @JsonProperty("leadId")
        String leadId,

        @JsonProperty("email")
        String email,

        @JsonProperty("phone")
        String phone,

        @JsonProperty("campaignId")
        Long campaignId,

        @JsonProperty("currentStepOrder")
        int currentStepOrder,

        @JsonProperty("nextExecutionTime")
        LocalDateTime nextExecutionTime,

        @JsonProperty("status")
        String status,

        @JsonProperty("firstName")
        String firstName,

        @JsonProperty("fullName")
        String fullName,

        @JsonProperty("personTitle")
        String personTitle,

        @JsonProperty("companyName")
        String companyName,

        @JsonProperty("location")
        String location,

        @JsonProperty("revenue")
        String revenue,

        @JsonProperty("industry")
        String industry
) {
    public static LeadSequenceTrackerResponse from(LeadSequenceTracker tracker) {
        return new LeadSequenceTrackerResponse(
                tracker.getId(),
                tracker.getLeadId(),
                tracker.getEmail(),
                tracker.getPhone(),
                tracker.getCampaignId(),
                tracker.getCurrentStepOrder(),
                tracker.getNextExecutionTime(),
                tracker.getStatus(),
                tracker.getFirstName(),
                tracker.getFullName(),
                tracker.getPersonTitle(),
                tracker.getCompanyName(),
                tracker.getLocation(),
                tracker.getRevenue(),
                tracker.getIndustry());
    }
}
