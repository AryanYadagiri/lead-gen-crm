package cc.miab.lead_generation.email;

import cc.miab.lead_generation.email.dto.EmailStructure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
public class EmailSenderService {

    private static final Logger logger = LoggerFactory.getLogger(EmailSenderService.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;
    private final String relayUrl;
    private final RestClient restClient;

    public EmailSenderService(JavaMailSender mailSender,
                              @Value("${spring.mail.username:sourav@miab.cc}") String fromEmail,
                              @Value("${email.relay.url:https://lead-gen-crm-five.vercel.app/api/email}") String relayUrl) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
        this.relayUrl = relayUrl;
        this.restClient = RestClient.builder().build();
    }

    public String sendPlainText(EmailStructure email) {
        return sendEmail(email.to(), email.subject(), email.body());
    }

    public String sendEmail(String to, String subject, String body) {
        logger.info("Initiating email send for recipient: {} from: {}", to, fromEmail);

        // 1. Primary path: HTTPS Relay via Vercel Serverless (Port 443, never blocked by Render Free Tier)
        if (relayUrl != null && !relayUrl.isBlank()) {
            try {
                logger.info("Relaying email dispatch to HTTPS endpoint: {}", relayUrl);
                var response = restClient.post()
                        .uri(relayUrl)
                        .body(Map.of(
                                "to", to,
                                "subject", subject,
                                "body", body
                        ))
                        .retrieve()
                        .toBodilessEntity();

                if (response.getStatusCode().is2xxSuccessful()) {
                    logger.info("Successfully delivered email to {} via HTTPS relay", to);
                    return "Email campaign successful";
                }
            } catch (Exception ex) {
                logger.warn("HTTPS relay to {} encountered issue: {}. Falling back to direct SMTP...", relayUrl, ex.getMessage());
            }
        }

        // 2. Secondary fallback: Direct SMTP (used when raw port 465 is unblocked)
        final SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        this.mailSender.send(message);
        logger.info("Successfully sent email to recipient: {} via direct SMTP", to);
        return "Email campaign successful";
    }

    public JavaMailSender getMailSender() {
        return mailSender;
    }
}
