package cc.miab.lead_generation.lead.repository;

import cc.miab.lead_generation.lead.entity.Leads;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeadsRepository extends JpaRepository<Leads, Long> {
    Optional<Leads> findByEmail(String email);
    boolean existsByEmail(String email);
    List<Leads> findByEmailIn(Collection<String> emails);
}
