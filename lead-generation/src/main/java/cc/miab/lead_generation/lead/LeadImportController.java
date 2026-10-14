package cc.miab.lead_generation.lead;

import cc.miab.lead_generation.lead.dto.LeadImportResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/leads")
@CrossOrigin(origins = "http://localhost:3000")
public class LeadImportController {

    private final ExcelReaderService excelReaderService;

    public LeadImportController(ExcelReaderService excelReaderService) {
        this.excelReaderService = excelReaderService;
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public LeadImportResponse importLeads(@RequestParam("file") MultipartFile file) throws IOException {
        return excelReaderService.importLeads(file);
    }
}
