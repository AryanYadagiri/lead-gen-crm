package cc.miab.lead_generation.lead.dto;

import java.util.List;

public record ApolloPeopleSearchRequest(
        List<String> personTitles,
        List<String> personSeniorities,
        Boolean includeSimilarTitles,
        List<String> organizationIds
) {
}
