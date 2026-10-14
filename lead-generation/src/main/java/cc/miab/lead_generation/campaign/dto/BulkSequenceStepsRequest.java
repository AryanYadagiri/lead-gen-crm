package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BulkSequenceStepsRequest(
        @JsonAlias({"steps", "sequence_steps", "sequenceSteps"})
        @JsonProperty("steps")
        List<SequenceStepRequest> steps
) {
}
