# Changelog

## Repository update — 2026-08-28

### Added

- Secondary **Deal Dashboard** for rapid property screening and purchase triage.
- GO, HOLD, PASS, and NEEDS DATA recommendation states.
- Transparent maximum-bid, projected all-in cost, profit, ROI, and bid-headroom calculations.
- Buy-box controls for maximum all-in percentage, minimum profit, minimum ROI, and repair contingency.
- Risk and diligence screens covering title, access, federal interests, flood, utilities, occupancy, buildability, restrictions, and redemption.
- Property editor, manual Bid/Watch/Pass decisions, notes, research links, browser persistence, and CSV import/export.
- Demo-property removal, filters, sorting, KPIs, mobile-width support, and a dashboard preview.
- Standard-library unit/integration tests and an optional Playwright browser smoke test.
- GitHub Actions validation workflow.

### Corrected

- County address cleanup and missing county-seat data.
- Favorite filtering, sale-date calculations, CSV safety, phone links, and empty-state handling.
- Texas sale-process copy concerning Chapter 34 sales, holiday timing, online sales, as-is notices, and federal redemption analysis.

### Validation status

- Standard project test suite passes.
- County dataset contains 254 unique Texas counties.
- JavaScript and Python syntax checks pass.
- Dataset rebuild is deterministic against the committed county JSON.
