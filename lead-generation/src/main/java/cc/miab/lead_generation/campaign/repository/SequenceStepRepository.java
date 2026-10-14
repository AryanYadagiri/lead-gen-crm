package cc.miab.lead_generation.campaign.repository;

import cc.miab.lead_generation.campaign.entity.SequenceStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SequenceStepRepository extends JpaRepository<SequenceStep, Long> {
    Optional<SequenceStep> findByCampaignIdAndStepOrder(Long campaignId, int stepOrder);
    List<SequenceStep> findByCampaignIdOrderByStepOrderAsc(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
