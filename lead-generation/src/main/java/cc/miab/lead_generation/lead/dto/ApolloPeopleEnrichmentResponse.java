package cc.miab.lead_generation.lead.dto;

import java.util.List;

public record ApolloPeopleEnrichmentResponse(
    List<Match> matches
) {
    public record Match(
            String id,
            String firstName,
            String lastName,
            String name,
            String linkedinUrl,
            String title,
            String emailStatus,
            String photoUrl,
            String twitterUrl,
            String githubUrl,
            String facebookUrl,
            String headline,
            String email,
            Organization organization
    ) {
        public record Organization(
                String name,
                String websiteUrl,
                String industry
        ){}
    }
}
