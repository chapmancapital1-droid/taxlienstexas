# Texas Land & Tax Sale Finder

A self-contained local web application for researching Texas tax-foreclosure sales and resales, organizing candidate properties, and making faster first-pass purchase decisions.

The project now has two connected workflows:

1. **County research:** all 254 counties, assessor-collector contacts, official county sites, sale-source searches, city-to-county starting points, favorites, notes, and optional website reachability checks.
2. **Deal Dashboard:** a sortable property pipeline with a transparent maximum-bid calculation, GO/HOLD/PASS/NEEDS DATA recommendations, risk flags, a core-diligence gate, buy-box settings, manual decisions, and CSV import/export.

> **Scope:** this application is aimed at court-ordered real-property sales and statutory resales under Texas Tax Code Chapter 34. Texas also regulates licensed property-tax lenders and certain tax-lien transfers under Tax Code §32.06; those financing transactions are outside this workflow.

## Quick start

No application dependencies are required; the server uses the Python 3 standard library.

```bash
python3 app/server.py
# Open http://localhost:8000
```

Use another port when needed:

```bash
PORT=8080 python3 app/server.py
```

## Deal Dashboard workflow

Open **Deal Dashboard** and either remove the three clearly labeled demo records, add properties manually, or download/import the CSV template.

Each property record includes:

- Property identity, county, account number, legal description, sale type/date, and source URL
- Minimum bid, planned bid, CAD reference value, and independently supported exit value
- Taxes, repairs, title/closing, liens/assessments, holding, and other estimated costs
- Redemption, occupancy, access, flood, utilities, buildability, title, federal-interest, and POA/restriction screens
- Eight core diligence confirmations
- Notes and a manual **Bid / Watch / Pass / Undecided** call

The dashboard stores records and buy-box settings in browser `localStorage`. Export a CSV before clearing browser storage or moving to another device/profile.

### Maximum-bid calculation

The default buy box is:

- Maximum all-in cost: **65% of exit value**
- Minimum projected profit: **$15,000**
- Minimum projected ROI: **30%**
- Repair contingency: **10%**

The dashboard first calculates:

```text
non-bid costs = post-sale taxes
              + repairs
              + repair contingency
              + title / closing / resale costs
              + liens / assessments allowance
              + holding / insurance
              + other costs
```

It then computes three bid limits:

```text
all-in limit = exit value × max all-in percentage − non-bid costs
profit limit = exit value − minimum profit − non-bid costs
ROI limit    = exit value ÷ (1 + minimum ROI) − non-bid costs
```

**Calculated max bid = the lowest of those three limits, floored at zero.**

The bid used for screening is the planned bid when entered; otherwise it is the minimum bid.

### Recommendation logic

- **GO:** core inputs are present, diligence is at least 75%, no high/critical risk flag is open, and all buy-box targets are met.
- **HOLD:** economics may be interesting, but diligence is below 75% or a high/critical screen issue is open.
- **PASS:** required data and diligence gate are present, but the entered economics miss the buy box.
- **NEEDS DATA:** a county, sale type, minimum bid, or exit value is missing.

The 0–100 score is a transparent sorting aid based on economics, diligence completion, and current screen flags. It is not an appraisal, title opinion, legal conclusion, or probability model.

## County research features

- Search, region/metro filters, favorites, and sorting across all **254 Texas counties**
- Tax Assessor-Collector contact snapshot from the Texas Secretary of State source data
- County seat, population, region, metro, and official website
- Correct statutory sale-day calculator, including the first-Wednesday exception when the first Tuesday is January 1 or July 4
- Research links for current sale material, resales/struck-off property, sale officers/hosts, and appraisal districts
- Per-county notes and a copyable contact/research block
- Server-side website reachability check and filtered county CSV export
- Forty-five major-city starting points, with an explicit warning to verify the actual parcel county and current court/order notice

## Important Texas screening notes

- Chapter 34 sales are tied to a judgment, order, and current notice; a county may have no active inventory in a particular month.
- The ordinary statutory sale window is the first Tuesday between 10 a.m. and 4 p.m.; the first-Wednesday holiday exception and statutory online-sale provisions are reflected in the app.
- Bidder registration under §34.011 depends on an adopted local requirement; it is not treated as universal.
- Resale disposition may use public or private statutory procedures depending on the circumstances and required consents.
- The general Chapter 34 redemption clock is tied to filing the purchaser's or taxing unit's deed for record—not simply the auction date.
- Federal liens/interests require separate notice, discharge, and redemption analysis.
- CAD value is displayed only as reference data and is never used automatically as the exit value.

Official starting references:

- [Texas Tax Code Chapter 34](https://statutes.capitol.texas.gov/Docs/TX/htm/TX.34.htm)
- [Texas Tax Code §32.06](https://statutes.capitol.texas.gov/Docs/TX/htm/TX.32.htm#32.06)
- [Texas Comptroller property-tax resources](https://comptroller.texas.gov/taxes/property-tax/)
- [Texas Secretary of State assessor-collector directory source](https://www.sos.state.tx.us/elections/voter/tac.shtml)
- [26 U.S.C. §7425](https://www.law.cornell.edu/uscode/text/26/7425)

## CSV workflow

The **CSV template** contains every editable field and one example row. Imports append records rather than replacing existing data. Exports include both raw fields and calculated fields such as recommendation, score, diligence percentage, all-in cost, calculated max bid, projected profit/ROI, and risk flags.

CSV exports neutralize cells beginning with `=`, `+`, `-`, or `@` to reduce spreadsheet formula-injection risk.

## Validation and tests

Run the standard-library validation suite:

```bash
python3 -m unittest discover -s tests -v
```

Run syntax/build checks:

```bash
python3 -m py_compile app/server.py app/build_dataset.py
node --check app/app.js
node --check app/dashboard.js
python3 app/build_dataset.py
```

An optional Playwright browser smoke test is included when Playwright and Chromium are installed:

```bash
python3 tests/browser_smoke.py
```

See [`VALIDATION.md`](VALIDATION.md) for the validation record, corrected defects, test results, and known limitations.

## Data refresh

The county dataset is generated from the raw snapshots under `data/`:

```bash
python3 app/build_dataset.py
```

The build now removes alphabet-navigation fragments accidentally captured from the Secretary of State page and patches the two county seats missing from the Wikidata snapshot.

## Project layout

```text
app/
  server.py              local HTTP server + APIs + website checker
  index.html             application shell and research/playbook content
  app.js                 county directory, city map, notes, calendar, CSV
  dashboard.js           property records, decision engine, editor, CSV
  style.css               shared/county styles
  dashboard.css           dashboard/editor styles
  build_dataset.py        SOS + Wikidata merge and validation cleanup
  data/counties.json      254 generated county records
  data/cities.json        45 city starting points

data/                     raw build inputs

tests/
  test_project.py         standard-library data/server/static checks
  browser_smoke.py        optional headless UI workflow test

docs/
  dashboard-preview.png   tested dashboard preview
```

## Disclaimer

This is a research and screening aid, not legal, tax, title, valuation, engineering, environmental, or investment advice. Contacts and procedures can change; properties can be withdrawn or rescheduled; individual judgments, notices, facts, and local rules control. Verify the current official record and use qualified professionals before bidding, taking possession, improving, financing, or reselling property.

## GitHub repository update

For web-upload, Git, GitHub CLI, and pre-push verification instructions, see [`GITHUB_UPDATE.md`](GITHUB_UPDATE.md).
