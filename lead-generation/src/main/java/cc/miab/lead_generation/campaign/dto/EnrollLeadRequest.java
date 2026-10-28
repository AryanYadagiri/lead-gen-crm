package cc.miab.lead_generation.campaign.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EnrollLeadRequest(
        @JsonAlias({"id", "lead_id", "leadId"})
        @JsonProperty("leadId")
        String leadId,

        @JsonAlias({"email"})
        @JsonProperty("email")
        String email,

        @JsonAlias({"phone", "phone_number", "phoneNumber"})
        @JsonProperty("phone")
        String phone,

        @JsonAlias({"first_name", "firstName"})
        @JsonProperty("firstName")
        String firstName,

        @JsonAlias({"name", "full_name", "fullName"})
        @JsonProperty("fullName")
        String fullName,

        @JsonAlias({"title", "person_title", "personTitle"})
        @JsonProperty("personTitle")
        String personTitle,

        @JsonAlias({"company", "company_name", "companyName"})
        @JsonProperty("companyName")
        String companyName,

        @JsonAlias({"location"})
        @JsonProperty("location")
        String location,

        @JsonAlias({"revenue"})
        @JsonProperty("revenue")
        String revenue,

        @JsonAlias({"industry"})
        @JsonProperty("industry")
        String industry,

        @JsonAlias({"initial_delay_days", "initialDelayDays"})
        @JsonProperty("initialDelayDays")
        Integer initialDelayDays
) {
    public String rawFirstName() {
        if (firstName != null && !firstName.isBlank()) return firstName.trim();
        if (fullName != null && !fullName.isBlank()) {
            return fullName.trim().split("\\s+")[0];
        }
        return null;
    }

    public String resolvedFirstName() {
        String raw = rawFirstName();
        return raw != null ? raw : "";
    }

    public String resolvedFullName() {
        if (fullName != null && !fullName.isBlank()) return fullName.trim();
        if (firstName != null && !firstName.isBlank()) return firstName.trim();
        return "";
    }
}
