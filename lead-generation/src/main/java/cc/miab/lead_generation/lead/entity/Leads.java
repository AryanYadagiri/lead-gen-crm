package cc.miab.lead_generation.lead.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "leads")
public class Leads {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String email;
    private String number;
    private String Designation;
    private String Company;
    private String city;
    private String location;
    private String website;
    private String industry;
    private String revenue;

    public Leads() {
    }

    public Leads(Long id, String name, String email, String number, String designation, String company,
                 String city, String location, String website, String industry, String revenue) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.number = number;
        this.Designation = designation;
        this.Company = company;
        this.city = city;
        this.location = location;
        this.website = website;
        this.industry = industry;
        this.revenue = revenue;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getNumber() {
        return number;
    }

    public void setNumber(String number) {
        this.number = number;
    }

    public String getDesignation() {
        return Designation;
    }

    public void setDesignation(String designation) {
        this.Designation = designation;
    }

    public String getCompany() {
        return Company;
    }

    public void setCompany(String company) {
        this.Company = company;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getLocation() {
        if (location != null && !location.isBlank()) return location;
        return city;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getWebsite() {
        return website;
    }

    public void setWebsite(String website) {
        this.website = website;
    }

    public String getIndustry() {
        return industry;
    }

    public void setIndustry(String industry) {
        this.industry = industry;
    }

    public String getRevenue() {
        return revenue;
    }

    public void setRevenue(String revenue) {
        this.revenue = revenue;
    }
}
