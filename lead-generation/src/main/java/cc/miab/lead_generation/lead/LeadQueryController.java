package cc.miab.lead_generation.lead;

import cc.miab.lead_generation.lead.dto.LeadFilters;
import cc.miab.lead_generation.lead.dto.QueriedLead;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leads")
@CrossOrigin(origins = "http://localhost:3000")
public class LeadQueryController {
    LeadQuery leadQueryService;

    public LeadQueryController(LeadQueryService leadQueryService){
        this.leadQueryService = leadQueryService;
    }

    @PostMapping("/getLeads")
    public List<QueriedLead> leadsQuryResult(@RequestBody LeadFilters leadFilters, @Value("${api.webhook-url.url}") String webhook){
        return leadQueryService.enrichPeople(leadFilters, webhook);
    }
}
