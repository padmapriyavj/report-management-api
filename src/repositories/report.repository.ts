import { Report } from "../models/report.model";

export class ReportRepository {
  private store = new Map<string, Report>();
  private businessKeyIndex = new Map<string, string>(); // businessKey → id
  private sequenceCounter = 0;

  private clone(report: Report): Report {
    return structuredClone(report);
  }

  generateBusinessKey(): string {
    this.sequenceCounter++;
    const year = new Date().getFullYear();
    const seq = String(this.sequenceCounter).padStart(4, "0");
    return `RPT-${year}-${seq}`;
  }

  findById(id: string): Report | undefined {
    const report = this.store.get(id);
    return report ? this.clone(report) : undefined;
  }

  findByBusinessKey(businessKey: string): Report | undefined {
    const id = this.businessKeyIndex.get(businessKey);
    return id ? this.store.get(id) : undefined;
  }

  existsByBusinessKey(businessKey: string): boolean {
    return this.businessKeyIndex.has(businessKey);
  }

  create(report: Report): Report {
    this.store.set(report.id, this.clone(report));
    return this.clone(report);
  }

  update(report: Report): Report {
    this.store.set(report.id, this.clone(report));
    return this.clone(report);
  }

  delete(id: string): boolean {
    const report = this.store.get(id);
    if (!report) return false;
    this.businessKeyIndex.delete(report.businessKey);
    this.store.delete(id);
    return true;
  }
}
