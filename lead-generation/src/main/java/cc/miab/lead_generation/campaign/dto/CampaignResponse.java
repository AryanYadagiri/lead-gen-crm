package cc.miab.lead_generation.campaign.dto;

import cc.miab.lead_generation.campaign.entity.Campaign;
import com.fasterxml.jackson.annotation.JsonProperty;

public record CampaignResponse(
        @JsonProperty("id")
        Long id,

        @JsonProperty("name")
        String name,

        @JsonProperty("status")
        String status,

        @JsonProperty("sending_window_start")
        String sendingWindowStart,

        @JsonProperty("sending_window_end")
        String sendingWindowEnd,

        @JsonProperty("timezone")
        String timezone,

        @JsonProperty("allowed_days")
        String allowedDays,

        @JsonProperty("max_daily_email_limit")
        Integer maxDailyEmailLimit,

        @JsonProperty("max_daily_whatsapp_limit")
        Integer maxDailyWhatsappLimit,

        @JsonProperty("daily_email_sent_count")
        Integer dailyEmailSentCount,

        @JsonProperty("daily_whatsapp_sent_count")
        Integer dailyWhatsappSentCount,

        @JsonProperty("emails_sent_today")
        Integer emailsSentToday,

        @JsonProperty("whatsapp_sent_today")
        Integer whatsappSentToday,

        @JsonProperty("max_daily_limit")
        Integer maxDailyLimit,

        @JsonProperty("daily_sent_count")
        Integer dailySentCount
) {
    public static CampaignResponse from(Campaign campaign) {
        if (campaign == null) {
            return null;
        }
        return new CampaignResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getStatus(),
                campaign.getSendingWindowStart(),
                campaign.getSendingWindowEnd(),
                campaign.getTimezone(),
                campaign.getAllowedDays(),
                campaign.getMaxDailyEmailLimit(),
                campaign.getMaxDailyWhatsappLimit(),
                campaign.getDailyEmailSentCount(),
                campaign.getDailyWhatsappSentCount(),
                campaign.getEmailsSentToday(),
                campaign.getWhatsappSentToday(),
                campaign.getMaxDailyLimit(),
                campaign.getDailySentCount()
        );
    }
}
