package cc.miab.lead_generation.lead.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ApolloCompanySearchResponse(
        List<Organization> organizations
) {
    public record Organization(
            String id,
            String name,
            String phone,
            String websiteUrl
            ){}
}
