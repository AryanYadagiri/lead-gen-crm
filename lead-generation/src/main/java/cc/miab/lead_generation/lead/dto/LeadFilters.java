package cc.miab.lead_generation.lead.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeadFilters(
        List<String> personTitles,
        List<String> personSeniorities,
        List<String> organizationLocations,
        List<String> organizationNumEmployeesRanges,
        List<String> organizationKeywordTags,
        Long revenueRangeMin,
        Long revenueRangeMax
) {
}

