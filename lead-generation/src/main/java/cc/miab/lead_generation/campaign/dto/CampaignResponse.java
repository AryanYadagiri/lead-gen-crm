package cc.miab.lead_generation.campaign.dto;

import cc.miab.lead_generation.campaign.entity.Campaign;
import com.fasterxml.jackson.annotation.JsonProperty;

public record CampaignResponse(
        @JsonProperty("id")
        Long id,

        @JsonProperty("name")
        String name,

        @JsonProperty("status")
        String status
) {
    public static CampaignResponse from(Campaign campaign) {
        return new CampaignResponse(campaign.getId(), campaign.getName(), campaign.getStatus());
    }
}
