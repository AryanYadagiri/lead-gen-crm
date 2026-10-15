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

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMethod;

@RestController
@RequestMapping("/api/campaign")
@CrossOrigin(
        origins = {"http://localhost:3000", "http://127.0.0.1:3000"},
        methods = {RequestMethod.POST, RequestMethod.OPTIONS},
        allowedHeaders = "*"
)
public class ExcelUploadController {

    private final ExcelReaderService reader;

    public ExcelUploadController(ExcelReaderService reader) {
        this.reader = reader;
    }

    /**
     * POST /api/campaign/upload or POST /api/campaign/excel-upload
     * Synchronously parses Excel/CSV file streams, saves entities to DB, and auto-enrolls leads into active campaign.
     */
    @PostMapping(value = {"/upload", "/excel-upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<LeadImportResponse> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
        LeadImportResponse response = reader.importLeads(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
