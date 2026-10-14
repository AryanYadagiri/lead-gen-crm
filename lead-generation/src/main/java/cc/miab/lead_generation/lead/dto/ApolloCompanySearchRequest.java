package cc.miab.lead_generation.lead.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ApolloCompanySearchRequest(
        List<String> organizationLocations,
        List<String> organizationNumEmployeesRanges,
        List<String> qOrganizationKeywordTags,
       @JsonProperty("revenue_range[min]") Long revenueRangeMin,
       @JsonProperty("revenue_range[max]") Long revenueRangeMax
) {}
