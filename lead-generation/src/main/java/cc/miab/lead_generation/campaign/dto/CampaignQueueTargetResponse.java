package cc.miab.lead_generation.campaign.dto;

import cc.miab.lead_generation.campaign.entity.LeadSequenceTracker;
import com.fasterxml.jackson.annotation.JsonProperty;

public record CampaignQueueTargetResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("lead_id") String leadId,
        @JsonProperty("name") String name,
        @JsonProperty("email") String email,
        @JsonProperty("phone") String phone,
        @JsonProperty("company") String company,
        @JsonProperty("title") String title,
        @JsonProperty("current_step") int currentStep,
        @JsonProperty("status") String status,
        @JsonProperty("location") String location,
        @JsonProperty("industry") String industry
) {
    public static CampaignQueueTargetResponse from(LeadSequenceTracker tracker) {
        String displayName = tracker.getFullName();
        if (displayName == null || displayName.isBlank()) {
            displayName = tracker.getFirstName();
        }
        if (displayName == null || displayName.isBlank()) {
            displayName = tracker.getEmail();
        }
        return new CampaignQueueTargetResponse(
                tracker.getId(),
                tracker.getLeadId() != null ? tracker.getLeadId() : String.valueOf(tracker.getId()),
                displayName != null ? displayName : "Lead Target",
                tracker.getEmail(),
                tracker.getPhone() != null ? tracker.getPhone() : "",
                tracker.getCompanyName() != null && !tracker.getCompanyName().isBlank() ? tracker.getCompanyName() : "Target Company",
                tracker.getPersonTitle() != null && !tracker.getPersonTitle().isBlank() ? tracker.getPersonTitle() : "Lead Target",
                tracker.getCurrentStepOrder(),
                tracker.getStatus() != null ? tracker.getStatus() : "PENDING",
                tracker.getLocation() != null ? tracker.getLocation() : "Global",
                tracker.getIndustry() != null ? tracker.getIndustry() : "Enterprise"
        );
    }
}
