package cc.miab.lead_generation.campaign.repository;

import cc.miab.lead_generation.campaign.entity.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    Optional<Campaign> findByName(String name);
    List<Campaign> findByStatus(String status);
}
