package cc.miab.lead_generation.email.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EmailStructure(
        @JsonProperty("to") String to,
        @JsonProperty("subject") String subject,
        @JsonProperty("body") String body,
        @JsonAlias({"sender_email", "senderEmail", "from"}) @JsonProperty("sender_email") String senderEmail,
        @JsonAlias({"sender_password", "senderPassword", "password"}) @JsonProperty("sender_password") String senderPassword,
        @JsonAlias({"sender_name", "senderName", "from_name", "fromName"}) @JsonProperty("sender_name") String senderName,
        @JsonAlias({"smtp_host", "smtpHost", "host"}) @JsonProperty("smtp_host") String smtpHost,
        @JsonAlias({"smtp_port", "smtpPort", "port"}) @JsonProperty("smtp_port") Integer smtpPort,
        @JsonAlias({"cc", "cc_recipients"}) @JsonProperty("cc") String cc,
        @JsonAlias({"bcc", "bcc_recipients"}) @JsonProperty("bcc") String bcc
) {
    public EmailStructure(String to, String subject, String body, String senderEmail, String senderPassword, String senderName, String smtpHost, Integer smtpPort) {
        this(to, subject, body, senderEmail, senderPassword, senderName, smtpHost, smtpPort, null, null);
    }

    public EmailStructure(String to, String subject, String body) {
        this(to, subject, body, null, null, null, null, null, null, null);
    }
}
