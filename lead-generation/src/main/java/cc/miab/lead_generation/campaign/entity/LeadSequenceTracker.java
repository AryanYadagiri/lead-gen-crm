package cc.miab.lead_generation.campaign.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "lead_sequence_trackers")
public class LeadSequenceTracker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lead_id")
    private String leadId;

    @Column(nullable = false)
    private String email;

    @Column(name = "phone")
    private String phone;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "current_step_order", nullable = false)
    private int currentStepOrder = 1;

    @Column(name = "next_execution_time", nullable = false)
    private LocalDateTime nextExecutionTime;

    @Column(nullable = false)
    private String status; // "PENDING", "COMPLETED", "FAILED"

    // Prompt token mapping fields
    @Column(name = "first_name")
    private String firstName;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "person_title")
    private String personTitle;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "location")
    private String location;

    @Column(name = "revenue")
    private String revenue;

    @Column(name = "industry")
    private String industry;

    public LeadSequenceTracker() {
    }

    public LeadSequenceTracker(Long id, String leadId, String email, String phone, Long campaignId, int currentStepOrder,
                               LocalDateTime nextExecutionTime, String status, String firstName, String fullName,
                               String personTitle, String companyName, String location, String revenue, String industry) {
        this.id = id;
        this.leadId = leadId;
        this.email = email;
        this.phone = phone;
        this.campaignId = campaignId;
        this.currentStepOrder = currentStepOrder;
        this.nextExecutionTime = nextExecutionTime;
        this.status = status;
        this.firstName = firstName;
        this.fullName = fullName;
        this.personTitle = personTitle;
        this.companyName = companyName;
        this.location = location;
        this.revenue = revenue;
        this.industry = industry;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLeadId() {
        return leadId;
    }

    public void setLeadId(String leadId) {
        this.leadId = leadId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Long getCampaignId() {
        return campaignId;
    }

    public void setCampaignId(Long campaignId) {
        this.campaignId = campaignId;
    }

    public int getCurrentStepOrder() {
        return currentStepOrder;
    }

    public void setCurrentStepOrder(int currentStepOrder) {
        this.currentStepOrder = currentStepOrder;
    }

    public LocalDateTime getNextExecutionTime() {
        return nextExecutionTime;
    }

    public void setNextExecutionTime(LocalDateTime nextExecutionTime) {
        this.nextExecutionTime = nextExecutionTime;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPersonTitle() {
        return personTitle;
    }

    public void setPersonTitle(String personTitle) {
        this.personTitle = personTitle;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getRevenue() {
        return revenue;
    }

    public void setRevenue(String revenue) {
        this.revenue = revenue;
    }

    public String getIndustry() {
        return industry;
    }

    public void setIndustry(String industry) {
        this.industry = industry;
    }
}
