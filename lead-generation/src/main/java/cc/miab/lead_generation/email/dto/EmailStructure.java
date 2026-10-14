package cc.miab.lead_generation.email.dto;

public record EmailStructure(
        String to,
        String subject,
        String body
) {
}
