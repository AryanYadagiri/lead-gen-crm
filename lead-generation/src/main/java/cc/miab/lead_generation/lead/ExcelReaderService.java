package cc.miab.lead_generation.lead;

import cc.miab.lead_generation.campaign.EmailCampaignService;
import cc.miab.lead_generation.campaign.dto.EnrollLeadRequest;
import cc.miab.lead_generation.lead.dto.LeadImportResponse;
import cc.miab.lead_generation.lead.dto.QueriedLead;
import cc.miab.lead_generation.campaign.entity.Campaign;
import cc.miab.lead_generation.lead.entity.Leads;
import cc.miab.lead_generation.lead.repository.LeadsRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ExcelReaderService {

    private static final Logger logger = LoggerFactory.getLogger(ExcelReaderService.class);

    private final LeadsRepository leadsRepository;
    private final EmailCampaignService emailCampaignService;

    public ExcelReaderService(LeadsRepository leadsRepository,
                              EmailCampaignService emailCampaignService) {
        this.leadsRepository = leadsRepository;
        this.emailCampaignService = emailCampaignService;
    }

    /**
     * Reads leads from either Excel (.xlsx, .xls) or CSV format and enrolls them into the active campaign.
     */
    @Transactional
    public LeadImportResponse importLeads(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<Leads> rawLeads;

        if (filename.endsWith(".csv") || "text/csv".equalsIgnoreCase(file.getContentType())) {
            rawLeads = readCsv(file);
        } else {
            rawLeads = readExcel(file);
        }

        if (rawLeads.isEmpty()) {
            Campaign defaultCampaign = emailCampaignService.getOrCreateDefaultCampaign();
            return new LeadImportResponse(0, 0, defaultCampaign.getId(), "No valid lead records found in uploaded file", List.of());
        }

        // Deduplicate within the file first
        List<Leads> deduplicatedInFile = new ArrayList<>();
        Set<String> seenFileEmails = new HashSet<>();
        int fileInternalDuplicates = 0;

        for (Leads lead : rawLeads) {
            String email = lead.getEmail() != null ? lead.getEmail().trim().toLowerCase() : "";
            if (email.isBlank() || !email.contains("@")) {
                continue;
            }
            if (seenFileEmails.contains(email)) {
                fileInternalDuplicates++;
                continue;
            }
            seenFileEmails.add(email);
            deduplicatedInFile.add(lead);
        }

        // Check against existing database emails in LeadsRepository
        List<Leads> existingMatches = leadsRepository.findByEmailIn(seenFileEmails);
        Set<String> existingDbEmails = existingMatches.stream()
                .map(l -> l.getEmail().trim().toLowerCase())
                .collect(Collectors.toSet());

        List<Leads> leadsToSave = new ArrayList<>();
        int dbDuplicates = 0;

        for (Leads lead : deduplicatedInFile) {
            String email = lead.getEmail().trim().toLowerCase();
            if (existingDbEmails.contains(email)) {
                dbDuplicates++;
            } else {
                leadsToSave.add(lead);
            }
        }

        int totalSkipped = fileInternalDuplicates + dbDuplicates;
        List<Leads> savedLeads = leadsRepository.saveAll(leadsToSave);
        logger.info("Imported {} leads from file '{}' ({} skipped duplicates)", savedLeads.size(), filename, totalSkipped);

        // Auto-enroll newly saved leads into default active outreach campaign
        Campaign defaultCampaign = emailCampaignService.getOrCreateDefaultCampaign();
        if (!savedLeads.isEmpty()) {
            List<EnrollLeadRequest> enrollRequests = savedLeads.stream().map(lead -> new EnrollLeadRequest(
                    String.valueOf(lead.getId()),
                    lead.getEmail(),
                    lead.getNumber(),
                    lead.getName() != null ? lead.getName().trim().split("\\s+")[0] : "There",
                    lead.getName(),
                    lead.getDesignation(),
                    lead.getCompany(),
                    lead.getLocation(),
                    lead.getRevenue(),
                    lead.getIndustry(),
                    0
            )).toList();

            emailCampaignService.bulkEnrollLeads(defaultCampaign.getId(), enrollRequests);
            logger.info("Automatically enrolled {} imported leads into campaign ID {}", enrollRequests.size(), defaultCampaign.getId());
        }

        List<QueriedLead> importedDtoList = savedLeads.stream().map(l -> new QueriedLead(
                l.getName() != null ? l.getName().trim().split("\\s+")[0] : "",
                l.getName() != null && l.getName().trim().contains(" ") ? l.getName().trim().substring(l.getName().trim().indexOf(' ') + 1) : "",
                l.getEmail(),
                l.getNumber(),
                l.getDesignation(),
                l.getCompany()
        )).toList();

        String message = String.format("Successfully imported %d leads (%d duplicates skipped) and enrolled into %s.",
                savedLeads.size(), totalSkipped, defaultCampaign.getName());

        return new LeadImportResponse(savedLeads.size(), totalSkipped, defaultCampaign.getId(), message, importedDtoList);
    }

    /**
     * Flexible Excel reader inspecting headers dynamically.
     */
    public List<Leads> readExcel(MultipartFile file) throws IOException {
        List<Leads> leads = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();

        try (InputStream inputStream = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(inputStream)) {

            // Sheet fallback: check for "Lead Tracker" first, else get first sheet
            Sheet sheet = workbook.getSheet("Lead Tracker");
            if (sheet == null) {
                if (workbook.getNumberOfSheets() == 0) {
                    return leads;
                }
                sheet = workbook.getSheetAt(0);
            }

            int firstRowNum = sheet.getFirstRowNum();
            Row headerRow = sheet.getRow(firstRowNum);
            if (headerRow == null) {
                return leads;
            }

            List<String> headers = new ArrayList<>();
            for (Cell cell : headerRow) {
                headers.add(formatter.formatCellValue(cell));
            }

            HeaderMapping mapping = resolveHeaderMapping(headers);

            // If header did not explicitly match email, attempt fallback detection across first few rows
            if (mapping.emailIdx == -1) {
                mapping.emailIdx = detectEmailColumnInRows(sheet, formatter, firstRowNum + 1);
            }

            if (mapping.emailIdx == -1) {
                logger.warn("Could not detect Email column in Excel sheet '{}'", sheet.getSheetName());
                return leads;
            }

            int lastRowNum = sheet.getLastRowNum();
            for (int r = firstRowNum + 1; r <= lastRowNum; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                Leads lead = extractLeadFromRow(row, formatter, mapping);
                if (lead != null && lead.getEmail() != null && !lead.getEmail().isBlank()) {
                    leads.add(lead);
                }
            }
        }

        return leads;
    }

    /**
     * Flexible CSV reader inspecting header line dynamically.
     */
    public List<Leads> readCsv(MultipartFile file) throws IOException {
        List<Leads> leads = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                return leads;
            }

            List<String> headers = parseCsvLine(headerLine);
            HeaderMapping mapping = resolveHeaderMapping(headers);

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                List<String> rowValues = parseCsvLine(line);
                Leads lead = extractLeadFromCsvValues(rowValues, mapping);
                if (lead != null && lead.getEmail() != null && !lead.getEmail().isBlank()) {
                    leads.add(lead);
                }
            }
        }

        return leads;
    }

    private static class HeaderMapping {
        int emailIdx = -1;
        int nameIdx = -1;
        int companyIdx = -1;
        int titleIdx = -1;
        int phoneIdx = -1;
        int locationIdx = -1;
        int industryIdx = -1;
        int revenueIdx = -1;
    }

    private HeaderMapping resolveHeaderMapping(List<String> headers) {
        HeaderMapping m = new HeaderMapping();
        for (int i = 0; i < headers.size(); i++) {
            String h = headers.get(i) != null ? headers.get(i).trim().toLowerCase() : "";
            if (h.isEmpty()) continue;

            if (m.emailIdx == -1 && (h.contains("email") || h.contains("e-mail") || h.equals("mail"))) {
                m.emailIdx = i;
            } else if (m.nameIdx == -1 && (h.contains("full name") || h.contains("first name") || h.equals("name") || h.contains("contact name") || h.contains("lead name"))) {
                m.nameIdx = i;
            } else if (m.companyIdx == -1 && (h.contains("company") || h.contains("organization") || h.equals("org"))) {
                m.companyIdx = i;
            } else if (m.titleIdx == -1 && (h.contains("title") || h.contains("designation") || h.contains("role") || h.contains("position"))) {
                m.titleIdx = i;
            } else if (m.phoneIdx == -1 && (h.contains("phone") || h.contains("mobile") || h.contains("whatsapp") || h.contains("cell") || h.contains("tel") || h.contains("number"))) {
                m.phoneIdx = i;
            } else if (m.locationIdx == -1 && (h.contains("location") || h.contains("city") || h.contains("country") || h.contains("state") || h.contains("address"))) {
                m.locationIdx = i;
            } else if (m.industryIdx == -1 && (h.contains("industry") || h.contains("sector") || h.contains("domain"))) {
                m.industryIdx = i;
            } else if (m.revenueIdx == -1 && (h.contains("revenue") || h.contains("turnover"))) {
                m.revenueIdx = i;
            }
        }
        return m;
    }

    private int detectEmailColumnInRows(Sheet sheet, DataFormatter formatter, int startRow) {
        int maxCheck = Math.min(startRow + 5, sheet.getLastRowNum());
        for (int r = startRow; r <= maxCheck; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (Cell cell : row) {
                String val = formatter.formatCellValue(cell);
                if (val != null && val.contains("@") && val.contains(".")) {
                    return cell.getColumnIndex();
                }
            }
        }
        return -1;
    }

    private Leads extractLeadFromRow(Row row, DataFormatter formatter, HeaderMapping m) {
        String email = getCellValue(row, m.emailIdx, formatter);
        if (email == null || email.isBlank()) return null;

        Leads lead = new Leads();
        lead.setEmail(email.trim());
        lead.setName(getCellValue(row, m.nameIdx, formatter));
        lead.setCompany(getCellValue(row, m.companyIdx, formatter));
        lead.setDesignation(getCellValue(row, m.titleIdx, formatter));
        lead.setNumber(getCellValue(row, m.phoneIdx, formatter));
        lead.setLocation(getCellValue(row, m.locationIdx, formatter));
        lead.setCity(lead.getLocation());
        lead.setIndustry(getCellValue(row, m.industryIdx, formatter));
        lead.setRevenue(getCellValue(row, m.revenueIdx, formatter));
        return lead;
    }

    private Leads extractLeadFromCsvValues(List<String> values, HeaderMapping m) {
        String email = m.emailIdx >= 0 && m.emailIdx < values.size() ? values.get(m.emailIdx) : "";
        if (email == null || email.isBlank() || !email.contains("@")) return null;

        Leads lead = new Leads();
        lead.setEmail(email.trim());
        if (m.nameIdx >= 0 && m.nameIdx < values.size()) lead.setName(values.get(m.nameIdx));
        if (m.companyIdx >= 0 && m.companyIdx < values.size()) lead.setCompany(values.get(m.companyIdx));
        if (m.titleIdx >= 0 && m.titleIdx < values.size()) lead.setDesignation(values.get(m.titleIdx));
        if (m.phoneIdx >= 0 && m.phoneIdx < values.size()) lead.setNumber(values.get(m.phoneIdx));
        if (m.locationIdx >= 0 && m.locationIdx < values.size()) {
            lead.setLocation(values.get(m.locationIdx));
            lead.setCity(values.get(m.locationIdx));
        }
        if (m.industryIdx >= 0 && m.industryIdx < values.size()) lead.setIndustry(values.get(m.industryIdx));
        if (m.revenueIdx >= 0 && m.revenueIdx < values.size()) lead.setRevenue(values.get(m.revenueIdx));
        return lead;
    }

    private String getCellValue(Row row, int colIdx, DataFormatter formatter) {
        if (colIdx < 0) return "";
        Cell cell = row.getCell(colIdx);
        if (cell == null) return "";
        String val = formatter.formatCellValue(cell);
        return val != null ? val.trim() : "";
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                values.add(sb.toString().trim().replaceAll("^\"|\"$", ""));
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        values.add(sb.toString().trim().replaceAll("^\"|\"$", ""));
        return values;
    }

    // Backward-compatibility methods
    public List<String> excelReader(MultipartFile file) throws IOException {
        return readExcel(file).stream().map(Leads::getEmail).toList();
    }

    public void savetoDatabase(MultipartFile file) throws IOException {
        importLeads(file);
    }
}
