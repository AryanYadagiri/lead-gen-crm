package cc.miab.lead_generation.email;

import cc.miab.lead_generation.email.dto.EmailStructure;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/email")
@CrossOrigin(
        originPatterns = {"http://localhost:[*]", "http://127.0.0.1:[*]", "https://*.vercel.app", "https://*.onrender.com"},
        allowedHeaders = "*"
)
public class EmailController {

    private final EmailSenderService emailSenderService;

    public EmailController(EmailSenderService emailSenderService) {
        this.emailSenderService = emailSenderService;
    }

    @PostMapping({"", "/sendEmail"})
    public String sendEmail(@RequestBody EmailStructure email) {
        return emailSenderService.sendPlainText(email);
    }

    @PostMapping("/test-smtp")
    public org.springframework.http.ResponseEntity<java.util.Map<String, Object>> testSmtp(@RequestBody java.util.Map<String, Object> payload) {
        String host = (String) payload.getOrDefault("host", "smtp.hostinger.com");
        Object portObj = payload.get("port");
        int port = 465;
        if (portObj instanceof Number num) {
            port = num.intValue();
        } else if (portObj instanceof String str && !str.isBlank()) {
            try {
                port = Integer.parseInt(str);
            } catch (Exception ignored) {}
        }
        String user = (String) payload.get("user");
        if (user == null) user = (String) payload.get("sender_email");
        String pass = (String) payload.get("pass");
        if (pass == null) pass = (String) payload.get("sender_password");

        boolean ok = emailSenderService.testConnection(host, port, user, pass);
        if (ok) {
            return org.springframework.http.ResponseEntity.ok(java.util.Map.of("success", true, "message", "SMTP connection and credentials verified successfully!"));
        } else {
            return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("success", false, "error", "SMTP authentication failed. Please check host, port, username, and password."));
        }
    }
}
