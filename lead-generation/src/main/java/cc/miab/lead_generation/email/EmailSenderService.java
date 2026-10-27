package cc.miab.lead_generation.email;

import cc.miab.lead_generation.email.dto.EmailStructure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

@Service
public class EmailSenderService {

    private static final Logger logger = LoggerFactory.getLogger(EmailSenderService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final JavaMailSender defaultMailSender;
    private final String defaultFromEmail;
    private final String relayUrl;
    private final RestClient restClient;

    public EmailSenderService(JavaMailSender mailSender,
                              @Value("${spring.mail.username:}") String fromEmail,
                              @Value("${email.relay.url:https://lead-gen-crm-five.vercel.app/api/email}") String relayUrl) {
        this.defaultMailSender = mailSender;
        this.defaultFromEmail = fromEmail;
        this.relayUrl = relayUrl;
        this.restClient = RestClient.builder().build();
    }

    public String sendPlainText(EmailStructure email) {
        return sendEmail(
                email.to(),
                email.subject(),
                email.body(),
                email.senderEmail(),
                email.senderPassword(),
                email.senderName(),
                email.smtpHost(),
                email.smtpPort()
        );
    }

    public String sendEmail(String to, String subject, String body) {
        return sendEmail(to, subject, body, null, null, null, null, null);
    }

    public String sendEmail(String to,
                            String subject,
                            String body,
                            String senderEmail,
                            String senderPassword,
                            String senderName,
                            String smtpHost,
                            Integer smtpPort) {
        final String effectiveUser = (senderEmail != null && !senderEmail.isBlank()) ? senderEmail.trim() : defaultFromEmail;
        final String effectiveHost = (smtpHost != null && !smtpHost.isBlank()) ? smtpHost.trim() : "smtp.hostinger.com";
        final int effectivePort = (smtpPort != null && smtpPort > 0) ? smtpPort : 465;

        if (effectiveUser == null || effectiveUser.isBlank()) {
            throw new IllegalStateException("No sender email configured. Please provide your email and password in campaign settings.");
        }

        logger.info("Initiating email send for recipient: {} from: {}", to, effectiveUser);

        // 1. Primary path: HTTPS Relay via Vercel Serverless (Port 443, never blocked by Render Free Tier)
        if (relayUrl != null && !relayUrl.isBlank()) {
            try {
                logger.info("Relaying email dispatch to HTTPS endpoint: {} from: {}", relayUrl, effectiveUser);
                Map<String, Object> payload = new HashMap<>();
                payload.put("to", to);
                payload.put("subject", subject);
                payload.put("body", body);

                Map<String, Object> smtpMap = new HashMap<>();
                smtpMap.put("user", effectiveUser);
                if (senderPassword != null && !senderPassword.isBlank()) {
                    smtpMap.put("pass", senderPassword);
                }
                if (senderName != null && !senderName.isBlank()) {
                    smtpMap.put("fromName", senderName);
                }
                smtpMap.put("host", effectiveHost);
                smtpMap.put("port", effectivePort);
                payload.put("smtp", smtpMap);

                var response = restClient.post()
                        .uri(relayUrl)
                        .body(payload)
                        .retrieve()
                        .toBodilessEntity();

                if (response.getStatusCode().is2xxSuccessful()) {
                    logger.info("Successfully delivered email to {} via HTTPS relay", to);
                    return "Email campaign successful";
                }
            } catch (RestClientResponseException rex) {
                String errorMsg = extractErrorMessage(rex.getResponseBodyAsString(), rex.getMessage());
                logger.error("HTTPS relay email send failed with status {}: {}", rex.getStatusCode(), errorMsg);
                throw new IllegalStateException("SMTP Relay Error: " + errorMsg, rex);
            } catch (Exception ex) {
                logger.warn("HTTPS relay to {} encountered issue: {}. Falling back to direct SMTP...", relayUrl, ex.getMessage());
            }
        }

        // 2. Secondary fallback: Dynamic direct SMTP
        try {
            JavaMailSender dynamicSender = createDynamicSender(effectiveHost, effectivePort, effectiveUser, senderPassword);
            final SimpleMailMessage message = new SimpleMailMessage();
            if (senderName != null && !senderName.isBlank()) {
                message.setFrom(String.format("\"%s\" <%s>", senderName.trim(), effectiveUser));
            } else {
                message.setFrom(effectiveUser);
            }
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            dynamicSender.send(message);
            logger.info("Successfully sent email to recipient: {} via direct SMTP", to);
            return "Email campaign successful";
        } catch (Exception ex) {
            logger.error("Direct SMTP send failed for {}: {}", to, ex.getMessage());
            throw new RuntimeException("Failed to dispatch email: " + ex.getMessage(), ex);
        }
    }

    /**
     * Synchronously validates SMTP credentials and throws a clear ResponseStatusException with specific error details on failure.
     */
    public void validateSmtpCredentials(String host, Integer port, String user, String pass) {
        if (user == null || user.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sender email address is not configured. Please enter your email in Campaign Settings.");
        }
        if (pass == null || pass.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sender password / App Password is not configured. Please enter your password in Campaign Settings.");
        }
        String testHost = (host != null && !host.isBlank()) ? host.trim() : "smtp.hostinger.com";
        int testPort = (port != null && port > 0) ? port : 465;

        // 1. Primary validation via Vercel HTTPS Relay (port 443, reliable from Render)
        if (relayUrl != null && !relayUrl.isBlank()) {
            try {
                String testUrl = relayUrl.endsWith("/api/email") ? relayUrl + "/test" : (relayUrl + "/test");
                var res = restClient.post()
                        .uri(testUrl)
                        .body(Map.of("host", testHost, "port", testPort, "user", user.trim(), "pass", pass.trim()))
                        .retrieve()
                        .toBodilessEntity();
                if (res.getStatusCode().is2xxSuccessful()) {
                    logger.info("SMTP credentials validated successfully via relay for {}", user);
                    return;
                }
            } catch (RestClientResponseException rex) {
                String errorMsg = extractErrorMessage(rex.getResponseBodyAsString(), rex.getMessage());
                logger.warn("SMTP validation failed via relay: {}", errorMsg);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SMTP Authentication Failed: " + errorMsg);
            } catch (Exception e) {
                logger.warn("Relay validation connection issue: {}. Attempting direct SMTP validation...", e.getMessage());
            }
        }

        // 2. Fallback validation via direct SMTP
        try {
            JavaMailSenderImpl impl = (JavaMailSenderImpl) createDynamicSender(testHost, testPort, user.trim(), pass.trim());
            impl.testConnection();
            logger.info("SMTP credentials validated successfully via direct connection for {}", user);
        } catch (Exception directEx) {
            logger.error("Direct SMTP test connection failed for {}: {}", user, directEx.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SMTP Authentication Failed: " + directEx.getMessage());
        }
    }

    public boolean testConnection(String host, int port, String user, String pass) {
        try {
            validateSmtpCredentials(host, port, user, pass);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String extractErrorMessage(String responseBody, String defaultMsg) {
        if (responseBody != null && !responseBody.isBlank()) {
            try {
                Map<?, ?> map = objectMapper.readValue(responseBody, Map.class);
                if (map.containsKey("error") && map.get("error") != null) {
                    return String.valueOf(map.get("error"));
                }
                if (map.containsKey("message") && map.get("message") != null) {
                    return String.valueOf(map.get("message"));
                }
            } catch (Exception ignored) {
            }
        }
        return defaultMsg;
    }

    private JavaMailSender createDynamicSender(String host, int port, String username, String password) {
        if (password == null || password.isBlank()) {
            return defaultMailSender;
        }
        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setHost(host);
        impl.setPort(port);
        impl.setUsername(username);
        impl.setPassword(password);

        Properties props = impl.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        if (port == 465) {
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.ssl.trust", "*");
            props.put("mail.smtp.starttls.enable", "false");
        } else {
            props.put("mail.smtp.ssl.enable", "false");
            props.put("mail.smtp.starttls.enable", "true");
        }
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");
        return impl;
    }

    public JavaMailSender getMailSender() {
        return defaultMailSender;
    }
}
