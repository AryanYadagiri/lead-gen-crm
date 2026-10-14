package cc.miab.lead_generation.lead;

import cc.miab.lead_generation.lead.dto.LeadFilters;
import cc.miab.lead_generation.lead.dto.QueriedLead;
import org.springframework.stereotype.Component;
import java.util.List;


public interface LeadQuery<T, U> {
    T companySearch(LeadFilters leadFilters);
    U searchPeople(LeadFilters leadFilters);
    List<QueriedLead> enrichPeople(LeadFilters leadFilters, String webhook);
}
