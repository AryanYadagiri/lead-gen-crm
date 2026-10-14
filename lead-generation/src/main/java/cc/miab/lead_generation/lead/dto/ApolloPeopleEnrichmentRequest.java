package cc.miab.lead_generation.lead.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record ApolloPeopleEnrichmentRequest(
        @JsonProperty("details") List<DetailsObject> detailsObjectList
) {
    public record DetailsObject(
            String id
    ){}
}
