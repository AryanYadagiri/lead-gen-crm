package cc.miab.lead_generation.lead;

import cc.miab.lead_generation.lead.client.LeadServiceClient;
import cc.miab.lead_generation.lead.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Primary
@Service
public class LeadQueryService implements LeadQuery {
    LeadServiceClient leadServiceClient;

    public LeadQueryService(LeadServiceClient leadServiceClient) {
        this.leadServiceClient = leadServiceClient;
    }

    public ApolloCompanySearchResponse companySearch(LeadFilters leadFilters) {

        return leadServiceClient.searchCompanies(
                leadFilters.organizationLocations(),
                leadFilters.organizationNumEmployeesRanges(),
                leadFilters.organizationKeywordTags(),
                leadFilters.revenueRangeMin(),
                leadFilters.revenueRangeMax());
    }

    public ApolloPeopleSearchResponse searchPeople(LeadFilters leadFilters) {
//        ApolloCompanySearchResponse apolloCompanySearchResponse = companySearch(leadFilters);
//
//        System.out.println(apolloCompanySearchResponse);
//        List<String> organizationIds = apolloCompanySearchResponse.organizations().
//                stream().map(ApolloCompanySearchResponse.Organization::id
//        ).toList();
        System.out.println(leadFilters);

        List<String> organizationIds = new ArrayList<>();
        organizationIds.add("6ab0f805db1bea001092b0d9");


        return leadServiceClient.searchPeople(leadFilters.personTitles(),
                leadFilters.personSeniorities(),
                true,
                organizationIds);
    }

    public List<QueriedLead> enrichPeople(LeadFilters leadFilters,String webhook) {
        ApolloPeopleSearchResponse apolloPeopleSearchResponseList = searchPeople(leadFilters);
        System.out.println(apolloPeopleSearchResponseList);
//        List<ApolloPeopleEnrichmentRequest.DetailsObject> detailsList = apolloPeopleSearchResponseList
//                .stream()
//                .map(item -> new ApolloPeopleEnrichmentRequest
//                        .DetailsObject(item.id()))
//                .toList();
//        ApolloPeopleEnrichmentRequest ids = new ApolloPeopleEnrichmentRequest(detailsList);
//        List<ApolloPeopleEnrichmentResponse> apolloPeopleEnrichmentResponseList = leadServiceClient.enrichPeople(
//                true,
//                true,
//                webhook,
//                ids
//        );
//        List<ApolloPeopleEnrichmentResponse.Match> matchList = apolloPeopleEnrichmentResponseList
//                .stream()
//                .flatMap(item -> item.matches().stream()).toList();
//        List<QueriedLead> queriedLeadList = matchList.stream()
//                .map(match -> new QueriedLead(
//                        match.firstName(),
//                        match.lastName(),
//                        match.email(),
//                        "tata",
//                        match.title(),
//                        match.organization().name())
//                    ).toList();
//        return queriedLeadList;

        QueriedLead lead = new QueriedLead(
                "match.firstName()",
                "match.lastName()",
                "match.email()",
                "tata",
                "match.title()",
                "match.organization().name()");

        List<QueriedLead> list = new ArrayList<>();
        list.add(lead);

        return list;
    }

}
