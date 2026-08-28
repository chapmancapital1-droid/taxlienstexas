#!/usr/bin/env python3
"""Build the master Texas tax-sale county dataset.
Sources:
  - data/sos_parsed.json   (Secretary of State: tax assessor-collector contacts, 254 counties)
  - data/wikidata_counties.json (county seat, population, official website)
Regions & metros assigned from TX geography knowledge.
"""
import json, re, html as htmllib, os

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(BASE), 'data')

sos = json.load(open(os.path.join(DATA, 'sos_parsed.json')))
wiki = json.load(open(os.path.join(DATA, 'wikidata_counties.json')))

# ---------- region mapping (all 254) ----------
PANHANDLE_PLAINS = [x.strip() for x in """Armstrong, Bailey, Briscoe, Carson, Castro, Childress, Cochran, Collingsworth,
Crosby, Dallam, Deaf Smith, Dickens, Donley, Floyd, Foard, Gaines, Garza, Gray, Hale, Hall, Hansford, Hartley,
Hemphill, Hockley, Hutchinson, King, Lamb, Lubbock, Lynn, Motley, Ochiltree, Oldham, Parmer, Potter, Randall,
Roberts, Sherman, Swisher, Terry, Wheeler, Yoakum, Lipscomb, Moore""".split(',')]

NORTH_TEXAS = [x.strip() for x in """Archer, Baylor, Brown, Callahan, Clay, Coleman, Comanche, Cooke, Cottle, Eastland, Erath, Fannin,
Fisher, Grayson, Hardeman, Haskell, Jack, Jones, Kent, Knox, Montague, Navarro, Palo Pinto, Shackelford,
Stephens, Stonewall, Throckmorton, Wichita, Wilbarger, Young""".split(',')]

EAST_TEXAS = [x.strip() for x in """Anderson, Angelina, Bowie, Camp, Cass, Cherokee, Delta, Franklin, Freestone, Gregg, Harrison,
Henderson, Hopkins, Houston, Hunt, Jasper, Jefferson, Lamar, Marion, Morris, Nacogdoches, Newton, Panola, Polk,
Rains, Red River, Rusk, Sabine, San Augustine, San Jacinto, Shelby, Smith, Titus, Trinity, Tyler, Upshur,
Van Zandt, Walker, Wood, Hardin, Orange""".split(',')]

DFW = [x.strip() for x in """Collin, Dallas, Denton, Tarrant, Rockwall, Kaufman, Ellis, Johnson, Parker, Hood, Somervell, Wise""".split(',')]

GULF_COAST = [x.strip() for x in """Aransas, Austin, Brazoria, Calhoun, Chambers, Colorado, DeWitt, Fort Bend, Galveston, Goliad,
Harris, Jackson, Liberty, Lavaca, Matagorda, Refugio, Victoria, Waller, Wharton, Montgomery""".split(',')]

CENTRAL = [x.strip() for x in """Bandera, Bastrop, Bell, Blanco, Bosque, Brazos, Burleson, Burnet, Caldwell, Comal, Coryell, Falls,
Fayette, Gillespie, Gonzales, Grimes, Guadalupe, Hamilton, Hays, Hill, Kendall, Kerr, Kimble, Lampasas, Lee,
Leon, Limestone, Llano, Madison, Mason, McCulloch, McLennan, Medina, Menard, Milam, Mills, Real, Robertson,
San Saba, Travis, Washington, Williamson""".split(',')]

SOUTH_TX = [x.strip() for x in """Atascosa, Bee, Bexar, Brooks, Cameron, Dimmit, Duval, Edwards, Frio, Hidalgo, Jim Hogg, Jim Wells,
Karnes, Kenedy, Kinney, Kleberg, La Salle, Live Oak, Maverick, McMullen, Nueces, San Patricio, Starr, Uvalde,
Webb, Willacy, Wilson, Zapata, Zavala""".split(',')]

WEST_TX = [x.strip() for x in """Andrews, Borden, Brewster, Coke, Concho, Crane, Crockett, Culberson, Dawson, Ector, El Paso,
Glasscock, Howard, Hudspeth, Irion, Jeff Davis, Loving, Martin, Midland, Mitchell, Nolan, Pecos, Presidio,
Reagan, Reeves, Runnels, Schleicher, Scurry, Sterling, Sutton, Taylor, Terrell, Tom Green, Upton, Val Verde,
Ward, Winkler""".split(',')]

REGIONS = {
    'Panhandle & South Plains': PANHANDLE_PLAINS,
    'North Texas & Rolling Plains': NORTH_TEXAS,
    'East Texas': EAST_TEXAS,
    'DFW Metroplex': DFW,
    'Gulf Coast & Houston': GULF_COAST,
    'Central Texas & Hill Country': CENTRAL,
    'South Texas & Rio Grande Valley': SOUTH_TX,
    'West Texas & Permian Basin': WEST_TX,
}
METRO = {}
for c in DFW: METRO[c] = 'Dallas\u2013Fort Worth'
for c in [x.strip() for x in "Harris, Fort Bend, Montgomery, Galveston, Brazoria, Liberty, Chambers, Waller, Austin".split(',')]: METRO[c] = 'Greater Houston'
for c in [x.strip() for x in "Bexar, Comal, Guadalupe, Kendall, Wilson, Medina, Atascosa, Bandera".split(',')]: METRO[c] = 'San Antonio'
for c in [x.strip() for x in "Travis, Williamson, Hays, Bastrop, Caldwell, Burnet".split(',')]: METRO[c] = 'Austin'
METRO['El Paso'] = 'El Paso'

# canonical county display-name fixes (SOS title-case quirks)
NAME_FIX = {'Mcmullen': 'McMullen', 'Mcculloch': 'McCulloch', 'Mclennan': 'McLennan', 'De Witt': 'DeWitt'}
WEBSITE_FIX = {'Bexar': 'https://www.bexar.org'}
SEAT_FIX = {'Hardeman': 'Quanah', 'Wood': 'Quitman'}

def clean_text(s):
    s = htmllib.unescape(s or '')
    return re.sub(r'\s+', ' ', s).strip()

def title_county(raw):
    name = NAME_FIX.get(raw, raw)
    return name

def is_navigation_fragment(value):
    """Drop A | B | C index fragments captured from the SOS page."""
    text = clean_text(value)
    return bool(re.fullmatch(r'(?:\||\|?\s*[A-Z]\s*\|?)', text))

# ---------- merge wikidata ----------
wiki_by_name = {}
for w in wiki:
    n = w['county'].replace(' County', '').strip()
    wiki_by_name.setdefault(n.lower(), w)

def norm_key(n):
    return re.sub(r'[^a-z]', '', n.lower())

wiki_norm = {norm_key(k): v for k, v in wiki_by_name.items()}

# ---------- manual patches ----------
sos['Mcmullen']['officer'] = 'Bessilia G. "Bessie" Guerrero'
sos['Mcmullen']['address'] = ['P.O. Box 38, Tilden 78072']
sos['Trinity']['phones'] = '(512) 594-3426'
sos['Trinity']['address'] = ['P.O. Box 369, Groveton 75845']

# ---------- assign regions, validate ----------
region_of = {}
for region, names in REGIONS.items():
    for n in names:
        if n in region_of:
            raise SystemExit(f'DUPLICATE region assignment: {n}')
        region_of[n] = region

sos_names = [title_county(k) for k in sos.keys()]
unassigned = [n for n in sos_names if n not in region_of]
extra = [n for n in region_of if n not in sos_names]
print('unassigned:', unassigned)
print('extra:', extra)
if unassigned or extra:
    raise SystemExit('Fix region mapping first.')

# ---------- build records ----------
def q(name):
    return f"{name} County Texas"

out = []
for raw_key, rec in sos.items():
    name = title_county(raw_key)
    w = wiki_norm.get(norm_key(name), {})
    website = WEBSITE_FIX.get(name) or (w.get('website') or '').rstrip('/')
    seat = SEAT_FIX.get(name) or (w.get('seat') if (w.get('seat') and not w['seat'].startswith('Q')) else '')
    pop = None
    try:
        pop = int(float(w.get('pop') or 0)) or None
    except ValueError:
        pop = None
    addr = '; '.join(clean_text(a) for a in rec['address'] if clean_text(a) and not is_navigation_fragment(a))
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    out.append({
        'id': slug,
        'county': name,
        'seat': seat,
        'pop': pop,
        'region': region_of[name],
        'metro': METRO.get(name, ''),
        'website': website,
        'tax': {
            'title': clean_text(rec['officeTitle']),
            'officer': clean_text(rec['officer']),
            'address': addr,
            'phone': clean_text(rec['phones']),
            'fax': clean_text(rec['fax']),
        },
        'search': {
            'sale': f"https://www.google.com/search?q={q(name).replace(' ','+')}+delinquent+tax+sale",
            'struck': f"https://www.google.com/search?q={q(name).replace(' ','+')}+struck+off+resale+property+list",
            'constable': f"https://www.google.com/search?q={q(name).replace(' ','+')}+constable+tax+sale+auction",
            'cad': f"https://www.google.com/search?q={q(name).replace(' ','+')}+appraisal+district+property+search",
        },
    })

out.sort(key=lambda r: r['county'])
print('counties built:', len(out))
missing_web = [r['county'] for r in out if not r['website']]
print('missing website:', missing_web)
os.makedirs(os.path.join(BASE, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(BASE, 'data', 'counties.json'), 'w'), indent=1)
print('wrote app/data/counties.json')
