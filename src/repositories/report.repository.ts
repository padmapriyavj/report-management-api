import { Report } from "../models/report.model";

export class ReportRepository {
  private store = new Map<string, Report>();
  private businessKeyIndex = new Map<string, string>(); // businessKey → id for quick lookups
  private sequenceCounter = 0; // For generating sequential business keys

  /**
   * Deep clone to avoid callers mutating stored data.
   */
  private clone(report: Report): Report {
    return structuredClone(report);
  }

  /**
   * Generate the next business key in sequence (e.g., RPT-2026-0001).
   */
  generateBusinessKey(): string {
    this.sequenceCounter++;
    const year = new Date().getFullYear();
    const seq = String(this.sequenceCounter).padStart(4, "0");
    return `RPT-${year}-${seq}`;
  }

  /**
   * Find a report by its UUID.
   */
  findById(id: string): Report | undefined {
    const report = this.store.get(id);
    return report ? this.clone(report) : undefined;
  }

  /**
   * Find a report by its human-readable business key.
   */
  findByBusinessKey(businessKey: string): Report | undefined {
    const id = this.businessKeyIndex.get(businessKey);
    return id ? this.store.get(id) : undefined;
  }

  /**
   * Check if a business key is already taken.
   */
  existsByBusinessKey(businessKey: string): boolean {
    return this.businessKeyIndex.has(businessKey);
  }

  /**
   * Store a new report. Returns a cloned copy.
   */
  create(report: Report): Report {
    this.store.set(report.id, this.clone(report));
    return this.clone(report);
  }

  /**
   * Update an existing report. Returns a cloned copy.
   */
  update(report: Report): Report {
    this.store.set(report.id, this.clone(report));
    return this.clone(report);
  }

  /**
   * Delete a report by ID. Returns true if found and deleted.
   */
  delete(id: string): boolean {
    const report = this.store.get(id);
    if (!report) return false;
    this.businessKeyIndex.delete(report.businessKey);
    this.store.delete(id);
    return true;
  }
}
