package cc.miab.lead_generation.campaign.repository;

import cc.miab.lead_generation.campaign.entity.LeadSequenceTracker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeadSequenceTrackerRepository extends JpaRepository<LeadSequenceTracker, Long> {
    List<LeadSequenceTracker> findByStatusAndNextExecutionTimeLessThanEqual(String status, LocalDateTime nextExecutionTime);
    Optional<LeadSequenceTracker> findByLeadIdAndCampaignId(String leadId, Long campaignId);
    List<LeadSequenceTracker> findByCampaignId(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
