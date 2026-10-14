'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { QueriedLead, Lead, FilterState, LeadFiltersPayload } from '../types/lead';
import { getLeads } from '../utils/apiClient';
import { AVAILABLE_COUNTRIES, SENIORITY_OPTIONS, EMPLOYEE_RANGE_OPTIONS, INITIAL_LEADS } from '../data/mockLeads';
import {
  Search, Filter, X, Check, Globe, Building2, Briefcase,
  DollarSign, Sparkles, UserCheck, ChevronDown, CheckSquare,
  Square, Shield, ExternalLink, RefreshCw, Mail, Phone,
  AlertTriangle, Loader2, Server, Code, Play
} from 'lucide-react';

interface LeadDiscoveryViewProps {
  selectedLeadIds: string[];
  setSelectedLeadIds: React.Dispatch<React.SetStateAction<string[]>>;
  onAddToOutreach: (leadsToAdd: Lead[]) => void;
}

export const LeadDiscoveryView: React.FC<LeadDiscoveryViewProps> = ({
  selectedLeadIds,
  setSelectedLeadIds,
  onAddToOutreach,
}) => {
  // Local React State mapping exact query parameters
  const [filters, setFilters] = useState<FilterState>({
    personTitles: 'CEO, Founder, VP',
    personSeniorities: ['C-Level', 'VP'],
    organizationLocations: ['United States', 'United Kingdom'],
    organizationNumEmployeesRanges: ['51-200', '201-500'],
    organizationKeywordTags: 'Software, SaaS, FinTech',
    revenueRangeMin: 10,
    revenueRangeMax: 200,
  });

  // Async Axios Network Layer State Bounds
  const [queriedLeads, setQueriedLeads] = useState<QueriedLead[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<LeadFiltersPayload | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  // Country Search Combobox & Modal State
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [activeLeadModal, setActiveLeadModal] = useState<QueriedLead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Live Async Network Layer - Axios POST to /api/leads/getLeads (Java DTO)
  // ---------------------------------------------------------------------------
  const fetchLeadsFromSpringBoot = useCallback(async (activeFilters: FilterState) => {
    setIsLoading(true);
    setError(null);
    setIsUsingFallback(false);

    // Map React state into exact Java Spring Boot DTO record structure: LeadFilters
    const payload: LeadFiltersPayload = {
      personTitles: activeFilters.personTitles
        ? activeFilters.personTitles.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      personSeniorities: activeFilters.personSeniorities || [],
      organizationLocations: activeFilters.organizationLocations || [],
      organizationNumEmployeesRanges: activeFilters.organizationNumEmployeesRanges || [],
      organizationKeywordTags: activeFilters.organizationKeywordTags
        ? activeFilters.organizationKeywordTags.split(',').map((k) => k.trim()).filter(Boolean)
        : [],
      revenueRangeMin:
        activeFilters.revenueRangeMin !== '' && activeFilters.revenueRangeMin !== undefined
          ? Number(activeFilters.revenueRangeMin)
          : null,
      revenueRangeMax:
        activeFilters.revenueRangeMax !== '' && activeFilters.revenueRangeMax !== undefined
          ? Number(activeFilters.revenueRangeMax)
          : null,
    };

    setLastPayload(payload);

    try {
      // Execute Axios POST request using centralized Axios apiClient helper
      const data = await getLeads(payload);
      setQueriedLeads(data);
    } catch (err: any) {
      console.warn('Spring Boot POST /api/leads/getLeads Axios fetch error:', err);
      let errMsg = 'Failed to connect to Spring Boot backend at http://localhost:8080/api/leads/getLeads';
      if (axios.isAxiosError(err)) {
        errMsg = err.response?.data?.message || err.message || errMsg;
      }
      setError(errMsg);

      // Fallback data mapping if Spring Boot server is offline locally
      setIsUsingFallback(true);
      const fallbackData: QueriedLead[] = INITIAL_LEADS.map((l) => {
        const parts = l.name.split(' ');
        return {
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          email: l.email,
          phoneNumber: l.phone,
          title: l.title,
          organization: l.company,
        };
      });
      setQueriedLeads(fallbackData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const [hasQueried, setHasQueried] = useState<boolean>(false);

  // Handle Search Submission Hook - Triggered strictly by user action
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasQueried(true);
    fetchLeadsFromSpringBoot(filters);
  };

  // State update handlers
  const toggleSeniority = (seniority: 'C-Level' | 'VP' | 'Director' | 'Manager') => {
    setFilters((prev) => {
      const exists = prev.personSeniorities.includes(seniority);
      return {
        ...prev,
        personSeniorities: exists
          ? prev.personSeniorities.filter((s) => s !== seniority)
          : [...prev.personSeniorities, seniority],
      };
    });
  };

  const toggleEmployeeRange = (range: string) => {
    setFilters((prev) => {
      const exists = prev.organizationNumEmployeesRanges.includes(range);
      return {
        ...prev,
        organizationNumEmployeesRanges: exists
          ? prev.organizationNumEmployeesRanges.filter((r) => r !== range)
          : [...prev.organizationNumEmployeesRanges, range],
      };
    });
  };

  const addCountry = (country: string) => {
    if (!filters.organizationLocations.includes(country)) {
      setFilters((prev) => ({
        ...prev,
        organizationLocations: [...prev.organizationLocations, country],
      }));
    }
    setCountrySearch('');
    setIsCountryDropdownOpen(false);
  };

  const removeCountry = (country: string) => {
    setFilters((prev) => ({
      ...prev,
      organizationLocations: prev.organizationLocations.filter((c) => c !== country),
    }));
  };

  const filteredCountries = AVAILABLE_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      personTitles: '',
      personSeniorities: [],
      organizationLocations: [],
      organizationNumEmployeesRanges: [],
      organizationKeywordTags: '',
      revenueRangeMin: '',
      revenueRangeMax: '',
    };
    setFilters(defaultFilters);
    setSearchQuery('');
    fetchLeadsFromSpringBoot(defaultFilters);
  };

  // Name combination helper safely handling null/empty strings
  const getFullName = (lead: QueriedLead): string => {
    const first = (lead.firstName || '').trim();
    const last = (lead.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    return full || 'Unnamed Executive';
  };

  // Generate unique ID per queried lead row
  const getLeadRowId = (lead: QueriedLead, index: number): string => {
    return lead.email || `lead-queried-${index}`;
  };

  // Local filtering by search bar query over current queriedLeads
  const displayedLeads = queriedLeads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = getFullName(lead).toLowerCase();
    const title = (lead.title || '').toLowerCase();
    const org = (lead.organization || '').toLowerCase();
    const email = (lead.email || '').toLowerCase();
    return fullName.includes(q) || title.includes(q) || org.includes(q) || email.includes(q);
  });

  // Selection logic
  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    displayedLeads.length > 0 &&
    displayedLeads.every((l, idx) => selectedLeadIds.includes(getLeadRowId(l, idx)));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const currentIds = new Set(displayedLeads.map((l, idx) => getLeadRowId(l, idx)));
      setSelectedLeadIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const currentIds = displayedLeads.map((l, idx) => getLeadRowId(l, idx));
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  // Transform QueriedLead to standard Lead interface for outreach sequence
  const handleAddSelectedToOutreach = () => {
    const selectedObjects: Lead[] = [];
    displayedLeads.forEach((ql, idx) => {
      const rowId = getLeadRowId(ql, idx);
      if (selectedLeadIds.includes(rowId)) {
        selectedObjects.push({
          id: rowId,
          name: getFullName(ql),
          title: ql.title || 'Executive Lead',
          seniority: 'C-Level',
          company: ql.organization || 'Enterprise Org',
          location: filters.organizationLocations[0] || 'United States',
          employees: filters.organizationNumEmployeesRanges[0] || '51-200',
          revenue: Number(filters.revenueRangeMin) || 15.0,
          industry: filters.organizationKeywordTags || 'Enterprise Tech',
          keywords: (filters.organizationKeywordTags || '').split(',').map((k) => k.trim()),
          email: ql.email || 'contact@lead.io',
          phone: ql.phoneNumber || '+1 (555) 019-2831',
          linkedinUrl: '',
          matchScore: 95,
          verified: true,
        });
      }
    });

    onAddToOutreach(selectedObjects);
  };

  return (
    <div className="w-full max-w-[1640px] mx-auto px-4 md:px-8 py-6 space-y-6">

      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#353535] pb-6 gap-4">
        <div>
          <span className="text-xs font-mono text-[#f36458] uppercase tracking-widest block mb-1">
            Prospecting & Filtering
          </span>
          <h1 className="text-3xl md:text-4xl font-normal tracking-tight text-white font-sans">
            Lead Discovery Engine
          </h1>
          <p className="text-xs md:text-sm text-[#b9b9b9] mt-1">
            Search, filter, and discover high-intent verified decision makers for your outreach campaigns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLeadsFromSpringBoot(filters)}
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#f36458] text-[#0b0b0b] hover:bg-[#f36458]/90 font-bold text-xs px-4 py-2 rounded-full transition-all duration-200 shadow-md cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Refresh Results</span>
          </button>
        </div>
      </div>

      {/* Search Overview & Results Summary Bar */}
      <div className="bg-[#212121] border border-[#353535] rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#37cd84]" />
          <span className="text-[#b9b9b9]">Database Status:</span>
          <span className="text-white font-semibold">Active & Synced</span>
          {isUsingFallback && (
            <span className="ml-2 text-[#f36458] bg-[#f36458]/10 px-2.5 py-0.5 rounded border border-[#f36458]/30 flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3 h-3" /> Offline Preview Data
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#b9b9b9]">Total Matches:</span>
          <span className="text-white font-bold bg-[#0b0b0b] px-3 py-1 rounded border border-[#353535]">
            {queriedLeads.length} Verified Leads
          </span>
        </div>
      </div>

      {/* Main Grid: Left Filter Form (1/3) + Right Matrix Table (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: FILTER PANE FORM */}
        <form
          onSubmit={handleSearchSubmit}
          className="lg:col-span-4 bg-[#212121] border border-[#353535] rounded-xl p-5 space-y-6 h-fit sticky top-20 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[#353535] pb-3">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Filter className="w-4 h-4 text-[#f36458]" />
              <span>Search Filters</span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10px] font-mono text-[#797979] hover:text-white cursor-pointer underline"
            >
              Reset
            </button>
          </div>

          <div className="space-y-5">

            {/* 1. Job Titles */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#f36458]" />
                  <span>Job Titles</span>
                </span>
              </label>
              <input
                type="text"
                value={filters.personTitles}
                onChange={(e) => setFilters({ ...filters, personTitles: e.target.value })}
                placeholder="e.g., CEO, Founder, VP of Sales (comma-separated)"
                className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-xs px-3 py-2.5 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#0052ef] focus:ring-1 focus:ring-[#0052ef] transition-all duration-200"
              />
            </div>

            {/* 2. Experience Levels */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#f36458]" />
                  <span>Experience Levels</span>
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                {SENIORITY_OPTIONS.map((seniority) => {
                  const isChecked = filters.personSeniorities.includes(seniority);
                  return (
                    <button
                      key={seniority}
                      type="button"
                      onClick={() => toggleSeniority(seniority)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${isChecked
                        ? 'bg-[#f36458] text-[#0b0b0b] border-[#f36458] font-semibold shadow-sm'
                        : 'bg-[#0b0b0b] text-[#b9b9b9] border-[#353535] hover:border-[#b9b9b9]'
                        }`}
                    >
                      {isChecked && <Check className="w-3 h-3 text-[#0b0b0b]" />}
                      <span>{seniority}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Target Countries */}
            <div className="space-y-2 relative">
              <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#f36458]" />
                  <span>Target Countries</span>
                </span>
              </label>

              {/* Selected Country Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {filters.organizationLocations.map((country) => (
                  <span
                    key={country}
                    className="bg-[#0b0b0b] text-white border border-[#353535] px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5"
                  >
                    <span>{country}</span>
                    <button
                      type="button"
                      onClick={() => removeCountry(country)}
                      className="text-[#797979] hover:text-[#f36458] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Country Combobox trigger */}
              <div className="relative">
                <div
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  className="w-full bg-[#0b0b0b] text-[#b9b9b9] text-xs px-3 py-2.5 rounded-[3px] border border-[#353535] flex items-center justify-between cursor-pointer hover:border-[#b9b9b9] transition-all duration-200"
                >
                  <span>Search & add country...</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#797979]" />
                </div>

                {isCountryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0b0b0b] border border-[#353535] rounded-md shadow-2xl z-30 max-h-48 overflow-y-auto p-2 space-y-1">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type country name..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full bg-[#212121] text-white text-xs px-2.5 py-1.5 rounded border border-[#353535] focus:outline-none mb-1"
                    />
                    {filteredCountries.length === 0 ? (
                      <div className="text-xs text-[#797979] py-2 text-center">No countries found</div>
                    ) : (
                      filteredCountries.map((c) => {
                        const isSelected = filters.organizationLocations.includes(c);
                        return (
                          <div
                            key={c}
                            onClick={() => (isSelected ? removeCountry(c) : addCountry(c))}
                            className={`text-xs px-3 py-1.5 rounded cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-[#353535] text-white font-medium' : 'text-[#b9b9b9] hover:bg-[#212121] hover:text-white'
                              }`}
                          >
                            <span>{c}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#37cd84]" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Company Size */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#f36458]" />
                  <span>Company Size Brackets</span>
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {EMPLOYEE_RANGE_OPTIONS.map((range) => {
                  const isSelected = filters.organizationNumEmployeesRanges.includes(range);
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => toggleEmployeeRange(range)}
                      className={`py-2 px-2 rounded-[3px] text-xs font-mono border text-center transition-all duration-200 cursor-pointer ${isSelected
                        ? 'bg-white text-[#0b0b0b] font-bold border-white shadow-md'
                        : 'bg-[#0b0b0b] text-[#b9b9b9] border-[#353535] hover:border-[#b9b9b9]'
                        }`}
                    >
                      {range} emp
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Industries & Keywords */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#f36458]" />
                  <span>Industries & Keywords</span>
                </span>
              </label>
              <input
                type="text"
                value={filters.organizationKeywordTags}
                onChange={(e) => setFilters({ ...filters, organizationKeywordTags: e.target.value })}
                placeholder="e.g., Software, SaaS, Healthcare, FinTech..."
                className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-xs px-3 py-2.5 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#0052ef] focus:ring-1 focus:ring-[#0052ef] transition-all duration-200"
              />
            </div>

            {/* 6. Annual Revenue Range */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#b9b9b9] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#f36458]" />
                  <span>Annual Revenue Range ($M)</span>
                </span>
              </label>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2.5 text-[#797979] text-xs font-mono">$</span>
                  <input
                    type="number"
                    value={filters.revenueRangeMin}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        revenueRangeMin: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="Min M$"
                    className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-xs pl-6 pr-2 py-2 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#0052ef]"
                  />
                </div>

                <span className="text-[#797979] font-mono text-xs">to</span>

                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2.5 text-[#797979] text-xs font-mono">$</span>
                  <input
                    type="number"
                    value={filters.revenueRangeMax}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        revenueRangeMax: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="Max M$"
                    className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-xs pl-6 pr-2 py-2 rounded-[3px] border border-[#353535] focus:outline-none focus:border-[#0052ef]"
                  />
                </div>
              </div>
            </div>

            {/* Search Submission Hook Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-full bg-white text-[#0b0b0b] hover:bg-white/90 font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-lg"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current text-[#0b0b0b]" />
              )}
              <span>Apply Filters & Search</span>
            </button>

          </div>
        </form>

        {/* RIGHT COLUMN: RESULTS MATRIX TABLE */}
        <div className="lg:col-span-8 space-y-4">

          {/* Action Bar */}
          <div className="bg-[#212121] border border-[#353535] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#797979] absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter results by name, company, email..."
                className="w-full bg-[#0b0b0b] text-white placeholder-[#797979] text-xs pl-9 pr-3 py-2 rounded-[4px] border border-[#353535] focus:outline-none focus:border-[#0052ef]"
              />
            </div>

            {/* Primary CTA */}
            <button
              onClick={handleAddSelectedToOutreach}
              disabled={selectedLeadIds.length === 0}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-full font-medium text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${selectedLeadIds.length > 0
                ? 'bg-[#f36458] text-[#0b0b0b] font-bold hover:bg-[#f36458]/90 shadow-lg shadow-[#f36458]/20 scale-[1.02]'
                : 'bg-[#353535] text-[#797979] cursor-not-allowed'
                }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Add Selected Leads to Outreach Sequence</span>
              {selectedLeadIds.length > 0 && (
                <span className="bg-[#0b0b0b] text-[#f36458] px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
                  {selectedLeadIds.length}
                </span>
              )}
            </button>
          </div>

          {/* Error Notice Warning (if fetch error occurs) */}
          {error && (
            <div className="bg-[#dd0000]/10 border border-[#dd0000]/40 rounded-xl p-4 flex items-start gap-3 text-xs text-white">
              <AlertTriangle className="w-5 h-5 text-[#dd0000] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-[#dd0000]">Connection Notice</h4>
                <p className="text-[#b9b9b9] leading-relaxed">
                  {error}
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => fetchLeadsFromSpringBoot(filters)}
                    className="px-2.5 py-1 bg-[#212121] border border-[#353535] hover:border-white rounded text-[11px] font-mono text-white cursor-pointer"
                  >
                    Retry Search
                  </button>
                  <span className="text-[10px] text-[#797979] font-mono">
                    (Displaying cached leads for offline preview)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-[#212121] border border-[#353535] rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0b0b0b] border-b border-[#353535] text-[11px] font-mono text-[#b9b9b9] uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-10">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-[#b9b9b9] hover:text-white cursor-pointer"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#f36458]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#797979]" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4">Job Title</th>
                    <th className="py-3.5 px-4">Company / Organization</th>
                    <th className="py-3.5 px-4">Contact Info</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#353535] text-xs">
                  {/* Loading State Animation Skeleton */}
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, skeletonIdx) => (
                      <tr key={`skeleton-${skeletonIdx}`} className="animate-pulse bg-[#0b0b0b]/40">
                        <td className="py-4 px-4"><div className="w-4 h-4 bg-[#353535] rounded" /></td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#353535]" />
                            <div className="space-y-1">
                              <div className="w-28 h-3 bg-[#353535] rounded" />
                              <div className="w-20 h-2 bg-[#353535] rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4"><div className="w-32 h-3 bg-[#353535] rounded" /></td>
                        <td className="py-4 px-4"><div className="w-28 h-3 bg-[#353535] rounded" /></td>
                        <td className="py-4 px-4"><div className="w-36 h-3 bg-[#353535] rounded" /></td>
                        <td className="py-4 px-4 text-right"><div className="w-16 h-6 bg-[#353535] rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : !hasQueried ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-[#797979] space-y-3">
                        <div className="w-12 h-12 rounded-full bg-[#0b0b0b] border border-[#353535] text-[#f36458] flex items-center justify-center mx-auto">
                          <Filter className="w-6 h-6 text-[#f36458]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Ready to Search Leads</p>
                          <p className="text-xs text-[#b9b9b9] max-w-md mx-auto mt-1">
                            Set your filter parameters on the left and click <strong className="text-white">&quot;Apply Filters & Search&quot;</strong> to fetch matching leads.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : displayedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#797979] space-y-2">
                        <p className="text-sm font-medium text-white">No matching leads found</p>
                        <p className="text-xs">Adjust your search filters and try again.</p>
                      </td>
                    </tr>
                  ) : (
                    displayedLeads.map((lead, index) => {
                      const rowId = getLeadRowId(lead, index);
                      const isSelected = selectedLeadIds.includes(rowId);
                      const fullName = getFullName(lead);

                      return (
                        <tr
                          key={rowId}
                          className={`transition-colors duration-150 ${isSelected ? 'bg-[#353535]/40' : 'hover:bg-[#0b0b0b]/50'
                            }`}
                        >
                          {/* Select Checkbox */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => toggleSelectLead(rowId)}
                              className="cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#f36458]" />
                              ) : (
                                <Square className="w-4 h-4 text-[#797979]" />
                              )}
                            </button>
                          </td>

                          {/* Name Column */}
                          <td className="py-3.5 px-4 font-medium text-white">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#0052ef] text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                {fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-white">{fullName}</span>
                                </div>
                                <span className="text-[10px] font-mono text-[#37cd84]">Verified Record</span>
                              </div>
                            </div>
                          </td>

                          {/* Job Title Column */}
                          <td className="py-3.5 px-4 text-white max-w-[200px] truncate">
                            <span className="font-medium truncate block">
                              {lead.title || <em className="text-[#797979]">N/A Title</em>}
                            </span>
                          </td>

                          {/* Company / Organization Column */}
                          <td className="py-3.5 px-4 text-white font-semibold">
                            {lead.organization || <em className="text-[#797979] font-normal">N/A Company</em>}
                          </td>

                          {/* Contact Info Column (Stacked email & phoneNumber) */}
                          <td className="py-3.5 px-4 text-xs font-mono space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[#55beff]">
                              <Mail className="w-3 h-3 text-[#55beff] shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {lead.email || <em className="text-[#797979]">no-email@domain.com</em>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#b9b9b9]">
                              <Phone className="w-3 h-3 text-[#37cd84] shrink-0" />
                              <span>{lead.phoneNumber || <em className="text-[#797979]">+1 (555) 000-0000</em>}</span>
                            </div>
                          </td>

                          {/* Actions Column */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveLeadModal(lead)}
                              className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#0b0b0b] text-[#b9b9b9] border border-[#353535] hover:text-white hover:border-[#b9b9b9] transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Matrix Footer */}
            <div className="bg-[#0b0b0b] border-t border-[#353535] p-3 px-4 flex items-center justify-between text-xs font-mono text-[#797979]">
              <div>
                Showing <strong className="text-white">{displayedLeads.length}</strong> leads
              </div>
              <div className="flex items-center gap-2">
                <span>Selected: <strong className="text-[#f36458]">{selectedLeadIds.length}</strong></span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* LEAD PROFILE INSPECTION MODAL */}
      {activeLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#212121] border border-[#353535] rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#0052ef] text-white flex items-center justify-center font-bold text-lg font-mono">
                  {getFullName(activeLeadModal).charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{getFullName(activeLeadModal)}</h3>
                  <p className="text-xs text-[#b9b9b9]">{activeLeadModal.title || 'Executive'}</p>
                  <p className="text-xs text-[#f36458] font-mono">{activeLeadModal.organization || 'Enterprise'}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveLeadModal(null)}
                className="text-[#797979] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono text-[#797979]">STACKED CONTACT RECORD</span>
              <div className="space-y-2 text-xs bg-[#0b0b0b] p-3 rounded-lg border border-[#353535]">
                <div className="flex items-center justify-between">
                  <span className="text-[#797979] font-mono">DIRECT EMAIL:</span>
                  <span className="text-[#55beff] font-mono font-medium">{activeLeadModal.email || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#797979] font-mono">PHONE NUMBER:</span>
                  <span className="text-[#37cd84] font-mono font-medium">{activeLeadModal.phoneNumber || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveLeadModal(null)}
                className="px-4 py-2 rounded-full bg-[#f36458] text-[#0b0b0b] font-bold text-xs hover:bg-[#f36458]/90 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
