package cc.miab.lead_generation.campaign.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sequence_steps")
public class SequenceStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(name = "channel", length = 32)
    private String channel = "email";

    @Column(name = "title")
    private String title;

    @Column(name = "delay_days", nullable = false)
    private int delayDays;

    @Column(name = "subject_template", columnDefinition = "TEXT")
    private String subjectTemplate;

    @Column(name = "body_template", columnDefinition = "TEXT", nullable = false)
    private String bodyTemplate;

    @Column(name = "is_active")
    private Boolean isActive = true;

    public SequenceStep() {
    }

    public SequenceStep(Long id, Long campaignId, int stepOrder, String channel, String title, int delayDays,
                        String subjectTemplate, String bodyTemplate, Boolean isActive) {
        this.id = id;
        this.campaignId = campaignId;
        this.stepOrder = stepOrder;
        this.channel = channel != null ? channel : "email";
        this.title = title;
        this.delayDays = delayDays;
        this.subjectTemplate = subjectTemplate;
        this.bodyTemplate = bodyTemplate;
        this.isActive = isActive != null ? isActive : true;
    }

    public SequenceStep(Long campaignId, int stepOrder, String channel, String title, int delayDays,
                        String subjectTemplate, String bodyTemplate, Boolean isActive) {
        this(null, campaignId, stepOrder, channel, title, delayDays, subjectTemplate, bodyTemplate, isActive);
    }

    // Backward-compatible constructor
    public SequenceStep(Long campaignId, int stepOrder, int delayDays, String subjectTemplate, String bodyTemplate) {
        this(null, campaignId, stepOrder, "email", "Step #" + stepOrder, delayDays, subjectTemplate, bodyTemplate, true);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCampaignId() {
        return campaignId;
    }

    public void setCampaignId(Long campaignId) {
        this.campaignId = campaignId;
    }

    public int getStepOrder() {
        return stepOrder;
    }

    public void setStepOrder(int stepOrder) {
        this.stepOrder = stepOrder;
    }

    public String getChannel() {
        return channel != null ? channel : "email";
    }

    public void setChannel(String channel) {
        this.channel = channel != null ? channel : "email";
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getDelayDays() {
        return delayDays;
    }

    public void setDelayDays(int delayDays) {
        this.delayDays = delayDays;
    }

    public String getSubjectTemplate() {
        return subjectTemplate;
    }

    public void setSubjectTemplate(String subjectTemplate) {
        this.subjectTemplate = subjectTemplate;
    }

    public String getBodyTemplate() {
        return bodyTemplate;
    }

    public void setBodyTemplate(String bodyTemplate) {
        this.bodyTemplate = bodyTemplate;
    }

    public Boolean getIsActive() {
        return isActive != null ? isActive : true;
    }

    public void setIsActive(Boolean active) {
        isActive = active != null ? active : true;
    }
}
