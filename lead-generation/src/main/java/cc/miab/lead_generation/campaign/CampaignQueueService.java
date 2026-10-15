package cc.miab.lead_generation.campaign;

import cc.miab.lead_generation.campaign.dto.CampaignQueueTargetResponse;
import cc.miab.lead_generation.campaign.entity.LeadSequenceTracker;
import cc.miab.lead_generation.campaign.repository.LeadSequenceTrackerRepository;
import cc.miab.lead_generation.lead.entity.Leads;
import cc.miab.lead_generation.lead.repository.LeadsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class CampaignQueueService {

    private static final Logger logger = LoggerFactory.getLogger(CampaignQueueService.class);

    private final LeadSequenceTrackerRepository trackerRepository;
    private final LeadsRepository leadsRepository;

    public CampaignQueueService(LeadSequenceTrackerRepository trackerRepository,
                                LeadsRepository leadsRepository) {
        this.trackerRepository = trackerRepository;
        this.leadsRepository = leadsRepository;
    }

    @Transactional(readOnly = true)
    public List<CampaignQueueTargetResponse> getQueueTargets() {
        long trackerCount = trackerRepository.count();
        long leadsCount = leadsRepository.count();
        logger.info("getQueueTargets - trackerRepository count: {}, leadsRepository count: {}", trackerCount, leadsCount);

        List<CampaignQueueTargetResponse> results = new ArrayList<>();
        Set<String> seenEmails = new HashSet<>();
        Set<String> seenLeadIds = new HashSet<>();
        Set<Long> seenIds = new HashSet<>();

        // 1. First collect all active sequence trackers (strictly deduplicating by email & leadId)
        List<LeadSequenceTracker> trackers = trackerRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
        for (LeadSequenceTracker tracker : trackers) {
            String email = tracker.getEmail() != null ? tracker.getEmail().trim().toLowerCase() : "";
            String leadId = tracker.getLeadId() != null ? tracker.getLeadId().trim() : "";

            if (!email.isBlank() && seenEmails.contains(email)) {
                continue; // Skip duplicate tracker for same email
            }
            if (!leadId.isBlank() && seenLeadIds.contains(leadId)) {
                continue; // Skip duplicate tracker for same leadId
            }

            results.add(CampaignQueueTargetResponse.from(tracker));

            if (tracker.getId() != null) {
                seenIds.add(tracker.getId());
            }
            if (!leadId.isBlank()) {
                seenLeadIds.add(leadId);
            }
            if (!email.isBlank()) {
                seenEmails.add(email);
            }
        }

        // 2. Also fetch any leads already saved in DB (leads table) that aren't yet represented in trackers
        List<Leads> allLeads = leadsRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
        for (Leads lead : allLeads) {
            String leadIdStr = String.valueOf(lead.getId());
            String email = lead.getEmail() != null ? lead.getEmail().trim().toLowerCase() : "";

            if (seenLeadIds.contains(leadIdStr)) {
                continue; // Already included via tracker leadId
            }
            if (!email.isBlank() && seenEmails.contains(email)) {
                continue; // Already included via tracker email
            }
            if (seenIds.contains(lead.getId())) {
                continue; // Prevent ID collision
            }

            if (!email.isBlank()) {
                seenEmails.add(email);
            }
            seenLeadIds.add(leadIdStr);
            seenIds.add(lead.getId());

            results.add(new CampaignQueueTargetResponse(
                    lead.getId(),
                    leadIdStr,
                    lead.getName() != null && !lead.getName().isBlank() ? lead.getName() : "Lead Target",
                    lead.getEmail(),
                    lead.getNumber() != null ? lead.getNumber() : "",
                    lead.getCompany() != null && !lead.getCompany().isBlank() ? lead.getCompany() : "Target Company",
                    lead.getDesignation() != null && !lead.getDesignation().isBlank() ? lead.getDesignation() : "Lead Target",
                    1,
                    "PENDING",
                    lead.getLocation() != null && !lead.getLocation().isBlank() ? lead.getLocation() : "Global",
                    lead.getIndustry() != null && !lead.getIndustry().isBlank() ? lead.getIndustry() : "Enterprise"
            ));
        }

        logger.info("Retrieved {} total queue targets ({} from trackers, {} from leads table)",
                results.size(), trackers.size(), results.size() - trackers.size());
        return results;
    }

    @Transactional
    public void clearQueue() {
        long currentTrackerCount = trackerRepository.count();
        long currentLeadsCount = leadsRepository.count();
        logger.info("Clearing active campaign queue in database (trackers: {}, leads: {})...", currentTrackerCount, currentLeadsCount);
        trackerRepository.deleteAll();
        trackerRepository.flush();
        leadsRepository.deleteAll();
        leadsRepository.flush();
        logger.info("Campaign queue cleared successfully. Remaining trackers: {}, leads: {}",
                trackerRepository.count(), leadsRepository.count());
    }

    @Transactional
    public boolean deleteQueueTarget(String id) {
        if (id == null || id.isBlank()) {
            return false;
        }

        String trimmedId = id.trim();
        logger.info("Attempting to delete queue target with identifier '{}' from database...", trimmedId);
        boolean deleted = false;

        // 1. Try numeric primary key ID first
        try {
            Long numericId = Long.parseLong(trimmedId);
            if (trackerRepository.existsById(numericId)) {
                trackerRepository.deleteById(numericId);
                trackerRepository.flush();
                logger.info("Successfully deleted tracker by numeric ID {}", numericId);
                deleted = true;
            }
            if (leadsRepository.existsById(numericId)) {
                leadsRepository.deleteById(numericId);
                leadsRepository.flush();
                logger.info("Successfully deleted lead from leads table by numeric ID {}", numericId);
                deleted = true;
            }
            if (deleted) return true;
        } catch (NumberFormatException ignored) {
            // Not a pure numeric ID
        }

        // 2. Search by leadId, email, or tracker-{numericId} in trackerRepository
        List<LeadSequenceTracker> allTrackers = trackerRepository.findAll();
        for (LeadSequenceTracker tracker : allTrackers) {
            boolean matchLeadId = trimmedId.equalsIgnoreCase(tracker.getLeadId());
            boolean matchEmail = trimmedId.equalsIgnoreCase(tracker.getEmail());
            boolean matchTrackerPattern = tracker.getId() != null && (
                    trimmedId.equals(String.valueOf(tracker.getId())) ||
                    trimmedId.startsWith("tracker-" + tracker.getId()) ||
                    trimmedId.endsWith("-" + tracker.getId())
            );

            if (matchLeadId || matchEmail || matchTrackerPattern) {
                trackerRepository.delete(tracker);
                trackerRepository.flush();
                logger.info("Successfully deleted tracker id={} matching '{}'", tracker.getId(), trimmedId);
                deleted = true;
                break;
            }
        }

        // 3. Also check and delete matching lead in leadsRepository by email or id
        for (Leads lead : leadsRepository.findAll()) {
            boolean matchEmail = trimmedId.equalsIgnoreCase(lead.getEmail());
            boolean matchId = trimmedId.equals(String.valueOf(lead.getId()));
            if (matchEmail || matchId) {
                leadsRepository.delete(lead);
                leadsRepository.flush();
                logger.info("Successfully deleted lead id={} from leads table matching '{}'", lead.getId(), trimmedId);
                deleted = true;
                break;
            }
        }

        if (!deleted) {
            logger.warn("Could not find queue target in database matching identifier '{}'", trimmedId);
        }
        return deleted;
    }
}

