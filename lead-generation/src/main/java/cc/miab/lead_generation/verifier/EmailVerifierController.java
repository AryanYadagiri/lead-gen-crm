package cc.miab.lead_generation.verifier;

import cc.miab.lead_generation.verifier.dto.MyEmailVerifierResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/verifier")
public class EmailVerifierController {

    private final EmailVerifierService emailVerifierService;

    public EmailVerifierController(EmailVerifierService emailVerifierService) {
        this.emailVerifierService = emailVerifierService;
    }

    @GetMapping("/validate")
    public ResponseEntity<MyEmailVerifierResponse> validateEmail(@RequestParam String email) {
        MyEmailVerifierResponse response = emailVerifierService.verifyEmail(email);
        if (response == null) {
            return ResponseEntity.internalServerError().build();
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/credits")
    public ResponseEntity<Map<String, Object>> getCredits() {
        return ResponseEntity.ok(emailVerifierService.checkCredits());
    }
}
