package cc.miab.lead_generation.lead.dto;

import java.util.List;

public record ApolloPeopleSearchResponse(
    List<People> people
) {
    public record People(
            String id,
            String firstName,
            String title,
            Boolean hasEmail,
            String hasDirectPhone
    ){}
}
