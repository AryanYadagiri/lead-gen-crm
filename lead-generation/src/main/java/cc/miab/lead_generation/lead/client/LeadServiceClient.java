package cc.miab.lead_generation.lead.client;

import cc.miab.lead_generation.lead.dto.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

import java.util.List;

@HttpExchange("/api/v1")
public interface LeadServiceClient {
//    @PostExchange("/mixed_companies/search")
    @PostExchange("/organizations/search")
    ApolloCompanySearchResponse searchCompanies(
            @RequestParam(value = "organization_locations[]", required = false) List<String> organization_locations,
            @RequestParam(value = "organization_num_employees_ranges[]", required = false) List<String> organizationNumEmployeesRanges,
            @RequestParam(value = "q_organization_keyword_tags[]", required = false) List<String> qOrganizationKeywordTags,
            @RequestParam(value = "revenue_range[min]", required = false) Long revenueRangeMin,
            @RequestParam(value = "revenue_range[max]", required = false) Long revenueRangeMax
                                                      );

    @PostExchange("/contacts/search")
    ApolloPeopleSearchResponse searchPeople(
            @RequestParam(value = "person_titles[]", required = false) List<String> personTitles,
            @RequestParam(value = "person_seniorities[]", required = false) List<String> personSeniorities,
            @RequestParam(value = "include_similar_titles", required = false) Boolean includeSimilarTitles,
            @RequestParam(value = "organization_ids[]", required = false) List<String> organizationIds);

    @PostExchange("/people/bulk_match")
    List<ApolloPeopleEnrichmentResponse> enrichPeople(
            @RequestParam("reveal_personal_emails") boolean revealPersonalEmails,
            @RequestParam("reveal_phone_number") boolean revealPhoneNumber,
            @RequestParam("webhook_url") String webhookUrl,
            @RequestBody ApolloPeopleEnrichmentRequest request);
}
