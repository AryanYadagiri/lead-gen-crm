package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record TestRunResponse(
        @JsonProperty("success")
        boolean success,

        @JsonProperty("message")
        String message,

        @JsonProperty("logs")
        List<String> logs
) {
}
