package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collection;
import java.util.stream.Collectors;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CampaignRequest(
        @JsonAlias({"name"})
        @JsonProperty("name")
        String name,

        @JsonAlias({"status"})
        @JsonProperty("status")
        String status,

        @JsonAlias({"sending_window_start", "sendingWindowStart"})
        @JsonProperty("sending_window_start")
        String sendingWindowStart,

        @JsonAlias({"sending_window_end", "sendingWindowEnd"})
        @JsonProperty("sending_window_end")
        String sendingWindowEnd,

        @JsonAlias({"timezone", "time_zone", "timeZone"})
        @JsonProperty("timezone")
        String timezone,

        @JsonAlias({"allowed_days", "allowedDays"})
        @JsonProperty("allowed_days")
        Object allowedDays,

        @JsonAlias({"max_daily_email_limit", "maxDailyEmailLimit", "email_limit", "emailLimit"})
        @JsonProperty("max_daily_email_limit")
        Integer maxDailyEmailLimit,

        @JsonAlias({"max_daily_whatsapp_limit", "maxDailyWhatsappLimit", "whatsapp_limit", "whatsappLimit"})
        @JsonProperty("max_daily_whatsapp_limit")
        Integer maxDailyWhatsappLimit,

        @JsonAlias({"max_daily_limit", "maxDailyLimit"})
        @JsonProperty("max_daily_limit")
        Integer maxDailyLimit
) {
    public String resolvedAllowedDays() {
        if (allowedDays == null) return null;
        if (allowedDays instanceof Collection<?> coll) {
            return coll.stream().map(Object::toString).collect(Collectors.joining(","));
        }
        return allowedDays.toString();
    }

    public Integer resolvedMaxDailyEmailLimit() {
        if (maxDailyEmailLimit != null && maxDailyEmailLimit > 0) {
            return Math.min(200, maxDailyEmailLimit);
        }
        if (maxDailyLimit != null && maxDailyLimit > 0) {
            return Math.min(200, maxDailyLimit);
        }
        return 50;
    }

    public Integer resolvedMaxDailyWhatsappLimit() {
        if (maxDailyWhatsappLimit != null && maxDailyWhatsappLimit > 0) {
            return Math.min(1000, maxDailyWhatsappLimit);
        }
        return 100;
    }
}
