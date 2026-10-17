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
}
