package cc.miab.lead_generation.lead.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record QueriedLead(
        String firstName,
        String lastName,
        String email,
        String phoneNumber,
        String title,
        String organization
) {
}
