package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CampaignRequest(
        @JsonAlias({"name"})
        @JsonProperty("name")
        String name,

        @JsonAlias({"status"})
        @JsonProperty("status")
        String status
) {
}
