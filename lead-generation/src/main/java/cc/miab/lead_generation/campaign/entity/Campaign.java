package cc.miab.lead_generation.campaign.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "campaigns")
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String status; // "READY", "RUNNING", "PAUSED", "COMPLETED"

    @Column(name = "sending_window_start", length = 10)
    private String sendingWindowStart = "09:00";

    @Column(name = "sending_window_end", length = 10)
    private String sendingWindowEnd = "17:00";

    @Column(name = "timezone", length = 64)
    private String timezone = "Asia/Kolkata";

    @Column(name = "allowed_days", length = 128)
    private String allowedDays = "MON,TUE,WED,THU,FRI";

    @Column(name = "max_daily_limit")
    private Integer maxDailyLimit = 50;

    @Column(name = "daily_sent_count")
    private Integer dailySentCount = 0;

    @Column(name = "max_daily_email_limit")
    private Integer maxDailyEmailLimit = 50;

    @Column(name = "max_daily_whatsapp_limit")
    private Integer maxDailyWhatsappLimit = 100;

    @Column(name = "daily_email_sent_count")
    private Integer dailyEmailSentCount = 0;

    @Column(name = "daily_whatsapp_sent_count")
    private Integer dailyWhatsappSentCount = 0;

    @Column(name = "last_dispatch_date")
    private LocalDate lastDispatchDate;

    public Campaign() {
    }

    public Campaign(Long id, String name, String status) {
        this.id = id;
        this.name = name;
        this.status = status;
    }

    public Campaign(String name, String status) {
        this.name = name;
        this.status = status;
    }

    public Campaign(String name, String status, String sendingWindowStart, String sendingWindowEnd,
                    String timezone, String allowedDays, Integer maxDailyLimit) {
        this(name, status, sendingWindowStart, sendingWindowEnd, timezone, allowedDays, maxDailyLimit, 100);
    }

    public Campaign(String name, String status, String sendingWindowStart, String sendingWindowEnd,
                    String timezone, String allowedDays, Integer maxDailyEmailLimit, Integer maxDailyWhatsappLimit) {
        this.name = name;
        this.status = status;
        this.sendingWindowStart = sendingWindowStart != null ? sendingWindowStart : "09:00";
        this.sendingWindowEnd = sendingWindowEnd != null ? sendingWindowEnd : "17:00";
        this.timezone = timezone != null ? timezone : "Asia/Kolkata";
        this.allowedDays = allowedDays != null ? allowedDays : "MON,TUE,WED,THU,FRI";
        this.maxDailyEmailLimit = maxDailyEmailLimit != null && maxDailyEmailLimit > 0 ? Math.min(200, maxDailyEmailLimit) : 50;
        this.maxDailyWhatsappLimit = maxDailyWhatsappLimit != null && maxDailyWhatsappLimit > 0 ? Math.min(1000, maxDailyWhatsappLimit) : 100;
        this.maxDailyLimit = this.maxDailyEmailLimit;
        this.dailyEmailSentCount = 0;
        this.dailyWhatsappSentCount = 0;
        this.dailySentCount = 0;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSendingWindowStart() {
        return sendingWindowStart != null && !sendingWindowStart.isBlank() ? sendingWindowStart : "09:00";
    }

    public void setSendingWindowStart(String sendingWindowStart) {
        this.sendingWindowStart = sendingWindowStart;
    }

    public String getSendingWindowEnd() {
        return sendingWindowEnd != null && !sendingWindowEnd.isBlank() ? sendingWindowEnd : "17:00";
    }

    public void setSendingWindowEnd(String sendingWindowEnd) {
        this.sendingWindowEnd = sendingWindowEnd;
    }

    public String getTimezone() {
        return timezone != null && !timezone.isBlank() ? timezone : "Asia/Kolkata";
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public String getAllowedDays() {
        return allowedDays != null && !allowedDays.isBlank() ? allowedDays : "MON,TUE,WED,THU,FRI";
    }

    public void setAllowedDays(String allowedDays) {
        this.allowedDays = allowedDays;
    }

    public Integer getMaxDailyEmailLimit() {
        return maxDailyEmailLimit != null && maxDailyEmailLimit > 0 ? Math.min(200, maxDailyEmailLimit) : 50;
    }

    public void setMaxDailyEmailLimit(Integer maxDailyEmailLimit) {
        this.maxDailyEmailLimit = maxDailyEmailLimit != null && maxDailyEmailLimit > 0 ? Math.min(200, maxDailyEmailLimit) : 50;
        this.maxDailyLimit = this.maxDailyEmailLimit;
    }

    public Integer getMaxDailyWhatsappLimit() {
        return maxDailyWhatsappLimit != null && maxDailyWhatsappLimit > 0 ? Math.min(1000, maxDailyWhatsappLimit) : 100;
    }

    public void setMaxDailyWhatsappLimit(Integer maxDailyWhatsappLimit) {
        this.maxDailyWhatsappLimit = maxDailyWhatsappLimit != null && maxDailyWhatsappLimit > 0 ? Math.min(1000, maxDailyWhatsappLimit) : 100;
    }

    public Integer getDailyEmailSentCount() {
        return dailyEmailSentCount != null ? dailyEmailSentCount : 0;
    }

    public void setDailyEmailSentCount(Integer dailyEmailSentCount) {
        this.dailyEmailSentCount = dailyEmailSentCount;
    }

    public Integer getDailyWhatsappSentCount() {
        return dailyWhatsappSentCount != null ? dailyWhatsappSentCount : 0;
    }

    public void setDailyWhatsappSentCount(Integer dailyWhatsappSentCount) {
        this.dailyWhatsappSentCount = dailyWhatsappSentCount;
    }

    public Integer getEmailsSentToday() {
        return getDailyEmailSentCount();
    }

    public Integer getWhatsappSentToday() {
        return getDailyWhatsappSentCount();
    }

    public Integer getMaxDailyLimit() {
        return getMaxDailyEmailLimit();
    }

    public void setMaxDailyLimit(Integer maxDailyLimit) {
        this.maxDailyLimit = maxDailyLimit;
        if (maxDailyLimit != null && maxDailyLimit > 0) {
            this.maxDailyEmailLimit = Math.min(200, maxDailyLimit);
        }
    }

    public Integer getDailySentCount() {
        int email = dailyEmailSentCount != null ? dailyEmailSentCount : 0;
        int whatsapp = dailyWhatsappSentCount != null ? dailyWhatsappSentCount : 0;
        return (email + whatsapp > 0) ? (email + whatsapp) : (dailySentCount != null ? dailySentCount : 0);
    }

    public void setDailySentCount(Integer dailySentCount) {
        this.dailySentCount = dailySentCount;
    }

    public LocalDate getLastDispatchDate() {
        return lastDispatchDate;
    }

    public void setLastDispatchDate(LocalDate lastDispatchDate) {
        this.lastDispatchDate = lastDispatchDate;
    }
}
