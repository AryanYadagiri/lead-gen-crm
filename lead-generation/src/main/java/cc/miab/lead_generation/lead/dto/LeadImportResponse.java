package cc.miab.lead_generation.lead.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record LeadImportResponse(
        @JsonProperty("importedCount")
        int importedCount,

        @JsonProperty("skippedDuplicates")
        int skippedDuplicates,

        @JsonProperty("enrolledCampaignId")
        Long enrolledCampaignId,

        @JsonProperty("message")
        String message,

        @JsonProperty("importedLeads")
        List<QueriedLead> importedLeads
) {
}
