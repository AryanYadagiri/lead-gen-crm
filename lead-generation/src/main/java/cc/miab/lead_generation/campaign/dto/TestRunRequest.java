package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TestRunRequest(
        @JsonAlias({"lead", "target_lead", "sampleLead"})
        @JsonProperty("lead")
        EnrollLeadRequest lead,

        @JsonAlias({"steps", "custom_steps"})
        @JsonProperty("steps")
        List<SequenceStepRequest> steps,

        @JsonAlias({"send_actual_email", "sendActualEmail"})
        @JsonProperty("sendActualEmail")
        Boolean sendActualEmail
) {
}
