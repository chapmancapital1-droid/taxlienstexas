# Project Validation Record

**Project:** Texas Land & Tax Sale Finder  
**Validation date:** 2026-08-25  
**Validated build:** local application version 1.1

## Outcome

The project was reviewed as a data-driven local web application, not just as a visual mockup. The county dataset, static assets, server routes, JavaScript syntax, decision calculations, browser interactions, import/export workflow, and high-impact legal/process summaries were checked. The secondary Deal Dashboard was added and exercised end to end.

The standard test suite currently reports:

```text
Ran 10 tests in approximately 1.4 seconds
OK
```

The optional Chromium smoke test also passed:

```text
Browser smoke passed: county directory, statutory calendar exceptions,
favorite filtering, dashboard KPIs, buy-box sensitivity, property editor,
CSV template/export, CSV import, and drawer controls.
```

## Secondary dashboard delivered

The new **Deal Dashboard** is designed for rapid property triage and purchase-decision discipline. It includes:

- Search plus county, recommendation, risk, manual-decision, and sort controls
- GO/HOLD/PASS/NEEDS DATA recommendations
- Current-view KPIs for property count, GO candidates, GO capital, projected spread, and open diligence
- Editable buy-box targets for maximum all-in percentage, minimum profit, minimum ROI, and repair contingency
- Ranked property rows showing bid used, calculated max bid, headroom, exit value, projected profit/ROI, risk flags, diligence completion, and manual call
- A full property editor with sale identity, bid/value assumptions, cost categories, legal/physical risk screens, diligence confirmations, notes, and research links
- Local persistence through browser storage
- CSV template download, robust quoted CSV import, filtered export, and spreadsheet formula-injection mitigation
- Three clearly labeled demo records that can be removed in one action

### Decision math checked

For each property:

```text
repair contingency = repairs × contingency percentage

non-bid costs = post-sale/current taxes
              + repairs
              + repair contingency
              + title/closing/resale costs
              + liens/assessments allowance
              + holding/insurance
              + other costs

all-in cost = bid used + non-bid costs
```

The maximum bid is the minimum of:

```text
exit value × maximum all-in percentage − non-bid costs
exit value − minimum profit − non-bid costs
exit value ÷ (1 + minimum ROI) − non-bid costs
```

The default demo GO record was independently checked against the rendered output:

```text
Bid used:           $25,000
Non-bid costs:      $15,500
All-in cost:        $40,500
Exit value:        $100,000
Projected profit:   $59,500
Projected ROI:          147%
Calculated max bid: $49,500
Headroom:            $24,500
```

The risk-heavy demo record renders a score of 39 and HOLD because its title and legal-access screens are critical, despite complete core-data entry. The incomplete demo renders NEEDS DATA because its exit value and several verification fields are open.

## Data validation

### Passed checks

- Exactly **254** county records
- 254 unique county IDs and 254 unique county names
- All county records contain required identity, seat, region, website, tax-office, and search fields
- All 254 county websites have an `http` or `https` URL in the generated dataset
- All 45 city rows map to an existing county record
- County data rebuild succeeds from the checked-in raw snapshots

### Data defects corrected

1. **Alphabet-navigation contamination:** 22 assessor-office addresses included scraped `A | B | C ... Z` page-navigation fragments. The builder now rejects single-letter and pipe navigation tokens before joining address lines, and the county JSON was regenerated.
2. **Missing county seats:** the Wikidata snapshot did not yield seats for Hardeman and Wood Counties. The build now patches **Quanah** and **Quitman** respectively.
3. **City guidance over-specificity:** city rows previously included provider/registration claims that can become stale. They now act as county starting points and explicitly direct the user to verify the parcel county, participating taxing units, and current notice.
4. **Telephone URI handling:** phone extensions were previously concatenated into the dialed number. The client now extracts only the first valid U.S. ten-digit number for `tel:` links while preserving the displayed extension text.

## Functional defects corrected

| Area | Prior problem | Correction |
|---|---|---|
| Favorite filter | Toggling “Favorites” changed button state but did not re-render the county rows | The click now updates `aria-pressed` and immediately re-renders |
| Statutory date | Calendar assumed every sale day was the first Tuesday | Calculator now handles the January 1 / July 4 first-Wednesday exception |
| Sale format | Copy implied every sale was an in-person courthouse auction | UI now directs users to verify the designated location or statutory online method from the current notice |
| Region display | A literal `<br>` replacement was escaped and shown as text | Region names are rendered safely without attempted HTML injection |
| Empty verification view | Progress calculation could divide by zero | Empty views now return a user message without starting workers |
| CSV safety | County CSV could expose spreadsheet formula execution for malicious leading characters | CSV values beginning with `=`, `+`, `-`, or `@` are prefixed defensively |
| Static server | New dashboard assets were unavailable | `/dashboard.js` and `/dashboard.css` are served with correct MIME types and `nosniff` headers |
| Error handling | Data fetch errors could leave a blank application | County load failures now render a visible error state and dispatch a data-error event |
| Keyboard/accessibility | Rows and drawers were mouse-centric | Rows support keyboard opening, controls have labels/focus styles, and drawer ARIA state is maintained |

## Legal/process content validation

The original project contained several statements that were too broad or incorrect enough to affect a purchase decision. The app copy and playbook were rewritten around the following verified distinctions:

1. **Tax Code §34.04 is not a prohibition on tax-lien certificates.** It concerns claims for excess proceeds. The app no longer cites it for a blanket prohibition. Texas separately regulates licensed property-tax lenders and transfers under §32.06; that financing market is simply outside this Chapter 34 property-sale workflow.
2. **Bidder registration is conditional.** Section 34.011 authorizes a county to adopt registration requirements; it is not described as universal or required in “most counties” without verification.
3. **Sale-day rule includes an exception and online sales.** Chapter 34 generally uses the first Tuesday between 10 a.m. and 4 p.m.; when the first Tuesday is January 1 or July 4, the sale moves to the first Wednesday. Statutory online-sale provisions also exist.
4. **Redemption starts with recording, not merely the auction date.** The general Chapter 34 periods are presented as 180 days for property outside the listed two-year classes and two years for qualifying homestead, agricultural-use property, or mineral interests, measured from filing the applicable deed for record.
5. **Federal interests are not reducible to “always 120 days.”** The app now flags federal interests for separate notice, discharge, and redemption analysis. Federal law can use 120 days or a longer state-law period in applicable circumstances, and failure to give proper notice or join the United States can affect lien discharge.
6. **Resales are not always a simple commissioners-court-approved OTC closing.** The app now describes public/private statutory resale possibilities and required consents as fact-specific.
7. **Payment, deed delivery, possession, and title work vary.** The prior copy promised same-day cashier's-check mechanics and an officer's deed “at the podium.” The revised flow tells the user to follow the current order/notice and obtain title/legal guidance.
8. **Current provider domain:** the Perdue firm link was updated from the old `perduelaw.com` reference to `pbfcm.com`.
9. **Current as-is/no-warranty emphasis:** the playbook highlights the statutory resale warning that purchasers should expect “as is, where is” treatment without warranties rather than assuming a normal warranty-deed closing.

Primary references used for this correction set:

- [Texas Tax Code Chapter 34](https://statutes.capitol.texas.gov/Docs/TX/htm/TX.34.htm)
- [Texas Tax Code §32.06](https://statutes.capitol.texas.gov/Docs/TX/htm/TX.32.htm#32.06)
- [Texas Legislature, HB 3680 enrolled text](https://capitol.texas.gov/tlodocs/89R/billtext/pdf/HB03680F.pdf)
- [26 U.S.C. §7425](https://www.law.cornell.edu/uscode/text/26/7425)
- [IRS Publication 786 / federal tax lien foreclosure guidance](https://www.irs.gov/pub/irs-pdf/p786.pdf)
- [Texas Office of Consumer Credit Commissioner, property-tax lenders](https://occc.texas.gov/industry/property-tax-lenders)

## Tests performed

### Standard-library suite

`python3 -m unittest discover -s tests -v`

Coverage includes:

- County count, uniqueness, required fields, and URL shape
- Absence of alphabet-navigation fragments in assessor addresses
- Hardeman and Wood county-seat patches
- City-to-county referential integrity
- Dashboard asset references and removal of two known obsolete/incorrect strings
- Node syntax checks for `app.js` and `dashboard.js`
- Python compilation for `server.py` and `build_dataset.py`
- Successful dataset rebuild
- Live local server startup, health JSON, dashboard/static asset responses, MIME types, and response headers

### Chromium smoke test

`python3 tests/browser_smoke.py`

Coverage includes:

- 254 rendered county rows
- January 1 and July 4 first-Wednesday calendar exceptions
- Favorite-filter regression
- Initial three dashboard records and exact KPI totals
- Recommendation filtering and filter reset
- Buy-box sensitivity and reset
- Property editor open/save workflow
- CSV template download
- Current-view CSV export
- CSV import append workflow
- Drawer close behavior and console/page-error monitoring

The hosted test environment blocks Chromium navigation to localhost. The browser test therefore inlines the same checked-in HTML/CSS/JavaScript and mocks only the two local JSON API responses. The application code, DOM events, calculations, localStorage, form validation, downloads, CSV parser, and Chromium rendering still execute normally. The actual Python server is tested separately through HTTP in the standard suite.

## Known limitations

- **No live inventory aggregation:** the app organizes records supplied by the user; it does not scrape or guarantee current sale lists.
- **Reachability is not content validation:** a 200/401/403 response only indicates that a county site responded. It does not prove a contact, notice, or sale list is current.
- **Source contacts are a snapshot:** election cycles, appointments, office moves, and phone/site changes require periodic raw-data refresh and official verification.
- **No automated title/valuation conclusion:** the app does not determine lien survival, party joinder, redemption eligibility, legal access, buildability, environmental condition, insurability, market value, or possession rights.
- **Local browser storage:** property records are tied to the browser profile/origin and are subject to browser storage limits. CSV export is the portability/backup mechanism.
- **The score is ordinal screening:** it is intentionally transparent and simple. It should rank research attention, not be interpreted as purchase probability or expected return.
- **County/case rules control:** individual judgments, orders, notices, local bidder-registration rules, payment instructions, cancellations, and court decisions supersede generic workflow text.

## Release artifacts

- Updated project source and regenerated county data
- `docs/dashboard-preview.png`
- `tests/test_project.py`
- `tests/browser_smoke.py`
- This validation record
