package cc.miab.lead_generation.campaign;

import cc.miab.lead_generation.campaign.dto.CampaignQueueTargetResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/campaign/queue")
@CrossOrigin(
        origins = {"http://localhost:3000", "http://127.0.0.1:3000"},
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.PUT, RequestMethod.OPTIONS},
        allowedHeaders = "*"
)
public class CampaignQueueController {

    private static final Logger logger = LoggerFactory.getLogger(CampaignQueueController.class);

    private final CampaignQueueService queueService;

    public CampaignQueueController(CampaignQueueService queueService) {
        this.queueService = queueService;
    }

    /**
     * 1. GET /api/campaign/queue: Returns the current list of enrolled targets.
     */
    @GetMapping
    public List<CampaignQueueTargetResponse> getQueue() {
        List<CampaignQueueTargetResponse> targets = queueService.getQueueTargets();
        logger.info("GET /api/campaign/queue - returning {} queue targets", targets.size());
        return targets;
    }

    /**
     * 2. DELETE /api/campaign/queue/clear: Clears or deletes the entire active queue list (resets the queue to 0).
     */
    @DeleteMapping("/clear")
    public ResponseEntity<Map<String, Object>> clearQueue() {
        logger.info("DELETE /api/campaign/queue/clear - clearing all targets in database");
        queueService.clearQueue();
        return ResponseEntity.ok(Map.of(
                "message", "Campaign queue cleared successfully",
                "count", 0
        ));
    }

    /**
     * 3. DELETE /api/campaign/queue/{id}: Deletes a specific individual target out of the campaign queue matching that path ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteTarget(@PathVariable String id) {
        logger.info("DELETE /api/campaign/queue/{} - deleting individual target", id);
        boolean deleted = queueService.deleteQueueTarget(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of(
                    "message", "Target deleted from campaign queue",
                    "id", id
            ));
        } else {
            logger.warn("DELETE /api/campaign/queue/{} - target not found", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "Target not found in campaign queue with ID: " + id
            ));
        }
    }
}
