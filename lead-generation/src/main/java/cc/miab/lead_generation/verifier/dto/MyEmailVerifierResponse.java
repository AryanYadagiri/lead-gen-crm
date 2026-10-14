package cc.miab.lead_generation.verifier.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MyEmailVerifierResponse(
        @JsonProperty("Address") String address,
        @JsonProperty("Status") String status,
        @JsonProperty("Diagnosis") String diagnosis,
        @JsonProperty("catch_all") Object catchAll,
        @JsonProperty("Disposable_Domain") Object disposableDomain,
        @JsonProperty("Role_Based") Object roleBased,
        @JsonProperty("Free_Domain") Object freeDomain,
        @JsonProperty("Greylisted") Object greylisted,
        @JsonProperty("message") String message
) {
    public boolean isValid() {
        return "Valid".equalsIgnoreCase(status);
    }

    public boolean isInvalid() {
        return "Invalid".equalsIgnoreCase(status);
    }

    public boolean isCatchAll() {
        return "Catch-all".equalsIgnoreCase(status);
    }

    /**
     * Determines whether it is safe to dispatch an email campaign to this address.
     * Invalid emails are explicitly unsafe as they degrade sender reputation and cause bounces.
     */
    public boolean isSafeToSend() {
        return isValid();
    }
}
