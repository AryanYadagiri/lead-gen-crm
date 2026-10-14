package cc.miab.lead_generation.verifier;

import cc.miab.lead_generation.verifier.dto.MyEmailVerifierResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class EmailVerifierService {

    private static final Logger logger = LoggerFactory.getLogger(EmailVerifierService.class);

    private final RestClient restClient;
    private final String apiKey;
    private final String baseUrl;
    private final boolean enabled;

    // Cache verification results in-memory to prevent burning credits on duplicate checks
    private final Map<String, MyEmailVerifierResponse> verificationCache = new ConcurrentHashMap<>();

    public EmailVerifierService(
            @Value("${myemailverifier.api-key:}") String apiKey,
            @Value("${myemailverifier.base-url:https://api.myemailverifier.com/api/validate_single.php}") String baseUrl,
            @Value("${myemailverifier.enabled:true}") boolean enabled) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Checks deliverability for an email address.
     * Returns true if deliverable, false if MyEmailVerifier indicates the email is invalid.
     */
    public boolean isDeliverable(String email) {
        if (!enabled) {
            return true;
        }
        MyEmailVerifierResponse response = verifyEmail(email);
        if (response == null) {
            // Fail open to avoid blocking valid campaigns if API timeout occurs
            return true;
        }
        return !response.isInvalid();
    }

    /**
     * Calls MyEmailVerifier API to validate a single email address.
     */
    public MyEmailVerifierResponse verifyEmail(String email) {
        if (email == null || email.isBlank()) {
            return new MyEmailVerifierResponse(email, "Invalid", "Empty email address", 0, 0, 0, 0, 0, "Empty email");
        }

        String normalizedEmail = email.trim().toLowerCase();
        if (verificationCache.containsKey(normalizedEmail)) {
            logger.debug("Cache hit for email verification: {}", normalizedEmail);
            return verificationCache.get(normalizedEmail);
        }

        if (!enabled) {
            logger.info("MyEmailVerifier is disabled via configuration. Assuming valid for: {}", normalizedEmail);
            return new MyEmailVerifierResponse(normalizedEmail, "Valid", "Verification disabled in config", 0, 0, 0, 0, 0, null);
        }

        try {
            logger.info("Calling MyEmailVerifier API to validate: {}", normalizedEmail);
            MyEmailVerifierResponse response = restClient.get()
                    .uri(baseUrl + "?apikey={apikey}&email={email}", apiKey, normalizedEmail)
                    .retrieve()
                    .body(MyEmailVerifierResponse.class);

            if (response != null) {
                logger.info("MyEmailVerifier response for {}: Status='{}', Diagnosis='{}'",
                        normalizedEmail, response.status(), response.diagnosis());
                verificationCache.put(normalizedEmail, response);
                return response;
            }
        } catch (Exception ex) {
            logger.error("Failed to call MyEmailVerifier API for {}: {}", normalizedEmail, ex.getMessage());
        }

        return null;
    }

    /**
     * Checks remaining credits on the account.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkCredits() {
        try {
            String creditsUrl = "https://client.myemailverifier.com/verifier/getcredits/" + apiKey;
            return restClient.get()
                    .uri(creditsUrl)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception ex) {
            logger.error("Failed to check MyEmailVerifier credits", ex);
            return Map.of("status", false, "error", ex.getMessage());
        }
    }

    public void clearCache() {
        verificationCache.clear();
    }

    public boolean isEnabled() {
        return enabled;
    }
}
