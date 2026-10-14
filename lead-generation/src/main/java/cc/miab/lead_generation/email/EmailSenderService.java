package cc.miab.lead_generation.email;

import cc.miab.lead_generation.email.dto.EmailStructure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailSenderService {

    private static final Logger logger = LoggerFactory.getLogger(EmailSenderService.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;

    public EmailSenderService(JavaMailSender mailSender,
                              @Value("${spring.mail.username}") String fromEmail) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
    }

    public String sendPlainText(EmailStructure email) {
        return sendEmail(email.to(), email.subject(), email.body());
    }

    public String sendEmail(String to, String subject, String body) {
        logger.info("Sending email to recipient: {} from: {}", to, fromEmail);
        final SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        this.mailSender.send(message);
        logger.info("Successfully sent email to recipient: {}", to);
        return "Email campaign successful";
    }

    public JavaMailSender getMailSender() {
        return mailSender;
    }
}
