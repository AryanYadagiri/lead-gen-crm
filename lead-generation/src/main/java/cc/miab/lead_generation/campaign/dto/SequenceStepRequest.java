package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SequenceStepRequest(
        @JsonAlias({"id"})
        @JsonProperty("id")
        String id,

        @JsonAlias({"step_order", "stepOrder", "stepNumber", "step_number"})
        @JsonProperty("stepNumber")
        Integer stepNumber,

        @JsonAlias({"delay_days", "delayDays"})
        @JsonProperty("delayDays")
        Integer delayDays,

        @JsonAlias({"channel"})
        @JsonProperty("channel")
        String channel,

        @JsonAlias({"title"})
        @JsonProperty("title")
        String title,

        @JsonAlias({"subject", "subject_template", "subjectTemplate"})
        @JsonProperty("subject")
        String subject,

        @JsonAlias({"body", "body_template", "bodyTemplate"})
        @JsonProperty("body")
        String body,

        @JsonAlias({"is_active", "isActive"})
        @JsonProperty("isActive")
        Boolean isActive
) {
    public int resolvedStepOrder(int defaultOrder) {
        return stepNumber != null ? stepNumber : defaultOrder;
    }

    public int resolvedDelayDays() {
        return delayDays != null ? delayDays : 1;
    }

    public String resolvedChannel() {
        return channel != null && !channel.isBlank() ? channel : "email";
    }

    public String resolvedTitle(int order) {
        if (title != null && !title.isBlank()) return title;
        return ("whatsapp".equalsIgnoreCase(channel) ? "WhatsApp Touch #" : "Follow-up Email #") + order;
    }

    public String resolvedSubject() {
        return subject != null ? subject : "";
    }

    public String resolvedBody() {
        return body != null ? body : "";
    }

    public boolean resolvedIsActive() {
        return isActive != null ? isActive : true;
    }
}
