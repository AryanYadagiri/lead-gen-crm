package cc.miab.lead_generation.cron;

import cc.miab.lead_generation.campaign.EmailCampaignService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/cron")
@CrossOrigin(
        originPatterns = {"http://localhost:[*]", "http://127.0.0.1:[*]", "https://*.vercel.app", "https://*.onrender.com"},
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS},
        allowedHeaders = "*"
)
public class CronController {

    private static final Logger logger = LoggerFactory.getLogger(CronController.class);
    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    private final EmailCampaignService emailCampaignService;
    private final String expectedSecret;

    public CronController(
            EmailCampaignService emailCampaignService,
            @Value("${cron.secret:${CRON_SECRET:miab-leadgen-cron-secret-2026}}") String expectedSecret) {
        this.emailCampaignService = emailCampaignService;
        this.expectedSecret = expectedSecret;
    }

    private String currentIstTimestamp() {
        return ZonedDateTime.now(IST_ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    /**
     * GET /api/cron/trigger-emails
     * Secure ping endpoint for external cron services (cron-job.org) to prevent Render instance sleep
     * and trigger due scheduled sequence outreach emails.
     */
    @RequestMapping(value = "/trigger-emails", method = {RequestMethod.GET, RequestMethod.HEAD, RequestMethod.POST})
    public ResponseEntity<Map<String, Object>> triggerEmails(
            @RequestHeader(value = "X-Cron-Secret", required = false) String cronSecretHeader) {

        if (expectedSecret == null || expectedSecret.isBlank() || !expectedSecret.equals(cronSecretHeader != null ? cronSecretHeader.trim() : "")) {
            logger.warn("[CRON-PING-REJECTED] Unauthorized ping to /api/cron/trigger-emails. Invalid or missing X-Cron-Secret header.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "status", "error",
                    "message", "Unauthorized: Invalid or missing X-Cron-Secret header",
                    "timestamp_ist", currentIstTimestamp()
            ));
        }

        try {
            int dispatchedCount = emailCampaignService.executeScheduledOutreach();

            logger.info("[CRON-PING] Trigger-emails endpoint invoked successfully. Server kept active. Dispatched {} scheduled lead tracker(s). Timestamp (IST): {}",
                    dispatchedCount, currentIstTimestamp());

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Cron ping received. Render instance is active and email schedule cycle was executed.",
                    "dispatched_trackers", dispatchedCount,
                    "timezone", "Asia/Kolkata (IST)",
                    "timestamp_ist", currentIstTimestamp()
            ));
        } catch (Exception ex) {
            logger.error("[CRON-PING-ERROR] Error executing scheduled outreach: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "error",
                    "message", "Error executing scheduled outreach: " + ex.getMessage(),
                    "timestamp_ist", currentIstTimestamp()
            ));
        }
    }
}
