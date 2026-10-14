package cc.miab.lead_generation.campaign.dto;

import cc.miab.lead_generation.campaign.entity.SequenceStep;
import com.fasterxml.jackson.annotation.JsonProperty;

public record SequenceStepResponse(
        @JsonProperty("id")
        String id,

        @JsonProperty("campaignId")
        Long campaignId,

        @JsonProperty("stepNumber")
        int stepNumber,

        @JsonProperty("channel")
        String channel,

        @JsonProperty("delayDays")
        int delayDays,

        @JsonProperty("title")
        String title,

        @JsonProperty("subject")
        String subject,

        @JsonProperty("body")
        String body,

        @JsonProperty("isActive")
        boolean isActive
) {
    public static SequenceStepResponse from(SequenceStep step) {
        String channel = step.getChannel() != null ? step.getChannel() : "email";
        String title = step.getTitle() != null && !step.getTitle().isBlank()
                ? step.getTitle()
                : (("whatsapp".equalsIgnoreCase(channel) ? "WhatsApp Touch #" : "Step #") + step.getStepOrder());
        return new SequenceStepResponse(
                step.getId() != null ? String.valueOf(step.getId()) : "step-" + step.getStepOrder(),
                step.getCampaignId(),
                step.getStepOrder(),
                channel,
                step.getDelayDays(),
                title,
                step.getSubjectTemplate() != null ? step.getSubjectTemplate() : "",
                step.getBodyTemplate() != null ? step.getBodyTemplate() : "",
                step.getIsActive() != null ? step.getIsActive() : true
        );
    }
}
