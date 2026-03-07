Alpr spotlight app · JSX
Copy

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
// In production, replace with your deployed Cloudflare Worker URL
const API_BASE = "https://alpr-spotlight-api.mailforslim.workers.dev";
// For local dev/demo without the worker, set USE_MOCK = true
const USE_MOCK = false;

const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";

// ─── Mock fallback (used when USE_MOCK=true or worker unavailable) ─────────────
const MOCK_AGENCIES = [
  { id: 1, name: "Metro Police Department – Central", type: "Local Police Department", lat: 40.7128, lng: -74.006, website: "https://www.nyc.gov/nypd", phone: "(212) 374-5000", address: "1 Police Plaza, New York, NY 10038", city: "New York", state: "NY", email: null, emailStatus: "unknown" },
  { id: 2, name: "New York County Sheriff's Office", type: "Sheriff's Office", lat: 40.73, lng: -74.02, website: "https://www1.nyc.gov/site/sheriff", phone: "(212) 788-8000", address: "66 John St, New York, NY 10038", city: "New York", state: "NY", email: null, emailStatus: "unknown" },
  { id: 3, name: "MTA Transit Police", type: "Transit Authority", lat: 40.705, lng: -74.015, website: null, phone: "(212) 563-3490", address: "370 Jay St, Brooklyn, NY 11201", city: "Brooklyn", state: "NY", email: null, emailStatus: "unknown" },
  { id: 4, name: "Port Authority Police Dept", type: "Port Authority", lat: 40.695, lng: -73.998, website: "https://www.panynj.gov", phone: "(212) 435-7000", address: "4 World Trade Center, New York, NY 10007", city: "New York", state: "NY", email: "records@panynj.gov", emailStatus: "records_email" },
  { id: 5, name: "NYU Campus Security", type: "Campus Police", lat: 40.729, lng: -73.997, website: "https://www.nyu.edu/public-safety", phone: "(212) 998-2222", address: "70 Washington Sq S, New York, NY 10012", city: "New York", state: "NY", email: null, emailStatus: "unknown" },
  { id: 6, name: "State Police Troop NYC", type: "State Police", lat: 40.718, lng: -74.035, website: "https://troopers.ny.gov", phone: "(518) 457-6811", address: "75 State St, Albany, NY 12207", city: "Albany", state: "NY", email: null, emailStatus: "unknown" },
  { id: 7, name: "NYC Housing Authority Police", type: "Housing Authority", lat: 40.708, lng: -73.99, website: "https://www.nyc.gov/nycha", phone: "(212) 306-3000", address: "250 Broadway, New York, NY 10007", city: "New York", state: "NY", email: "foil@nycha.nyc.gov", emailStatus: "records_email" },
  { id: 8, name: "Manhattan DA Investigators", type: "District Attorney", lat: 40.714, lng: -74.011, website: "https://www.manhattanda.org", phone: "(212) 335-9000", address: "1 Hogan Place, New York, NY 10013", city: "New York", state: "NY", email: null, emailStatus: "unknown" },
];

async function mockScrapeEmail(agency) {
  await new Promise(r => setTimeout(r, 600 + Math.random() * 1200));
  if (agency.email) return { email: agency.email, status: agency.emailStatus };
  const fakeEmails = {
    "Metro Police": { email: "records@metropd.gov", status: "records_email" },
    "Sheriff": { email: "publicrecords@sheriff.gov", status: "records_email" },
    "Transit": { email: null, status: "not_found" },
    "State Police": { email: "foil@troopers.ny.gov", status: "records_email" },
    "Campus": { email: "info@nyu.edu", status: "generic_email" },
    "Manhattan DA": { email: "records@dany.nyc.gov", status: "records_email" },
  };
  const match = Object.keys(fakeEmails).find(k => agency.name.includes(k));
  return match ? fakeEmails[match] : { email: null, status: "not_found" };
}

// ─── Request types ────────────────────────────────────────────────────────────
const REQUEST_TYPES = [
  { id: "camera_locations", label: "Camera Locations", description: "All surveillance camera locations operated or accessed by the agency", icon: "📍" },
  { id: "install_dates", label: "Installation Dates", description: "Dates when surveillance equipment was installed or activated", icon: "📅" },
  { id: "purchase_prices", label: "Purchase Prices", description: "Costs, invoices, and procurement records for surveillance equipment", icon: "💰" },
  { id: "policies", label: "Policies & Procedures", description: "Written policies governing use of surveillance technology", icon: "📋" },
  { id: "audit_records", label: "Audit Records", description: "Audit logs, access records, and usage reports for surveillance systems", icon: "🔍" },
  { id: "maintenance", label: "Maintenance Records", description: "Service records, repairs, and maintenance history", icon: "🔧" },
  { id: "contracts", label: "Vendor Contracts", description: "Contracts with surveillance technology vendors and contractors", icon: "📄" },
  { id: "retention", label: "Retention Policies", description: "Data retention schedules and deletion policies for footage/data", icon: "🗂️" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function generateRequestText(agency, selectedTypes, requesterName, requesterEmail) {
  const date = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const items = selectedTypes.map(id => {
    const t = REQUEST_TYPES.find(r => r.id === id);
    return t ? `  • ${t.label} — ${t.description}` : "";
  }).filter(Boolean).join("\n");

  return `${date}

Records Custodian
${agency.name}
${agency.address || agency.city + ", " + agency.state}

Re: Public Records Request – Surveillance Technology Information

Dear Records Custodian,

Pursuant to applicable state public records laws and/or the federal Freedom of Information Act (5 U.S.C. § 552), I hereby request copies of the following records maintained by ${agency.name}:

${items}

Please provide all responsive records in electronic format where available. If any portion of a requested record is withheld, please identify the specific legal basis for each withholding and provide any non-exempt portions.

If fees are anticipated to exceed $25.00, please notify me before processing so I may approve, narrow, or dispute the charges. I respectfully request a fee waiver on the grounds that disclosure of this information is in the public interest and will contribute to public understanding of law enforcement surveillance practices.

Please respond within the time period required under applicable law. If you have questions or need clarification, please contact me at the information below.

Thank you for your assistance.

Respectfully,

${requesterName || "[Your Name]"}
${requesterEmail || "[Your Email Address]"}`;
}

// ─── UI Components ────────────────────────────────────────────────────────────
const css = {
  bg: "#080c14",
  panel: "#0a0f1a",
  card: "#0d1421",
  border: "#1a2535",
  borderHi: "#1d3557",
  accent: "#e63946",
  accentDim: "#9b1f2a",
  blue: "#457b9d",
  blueLo: "#1d3557",
  textHi: "#e8f0fe",
  textMid: "#a0b4c8",
  textLo: "#5a7a9a",
  textDim: "#2a3a4a",
  green: "#4caf88",
  orange: "#e6963a",
  mono: "'Courier New', 'Courier', monospace",
};

function Pill({ children, color = css.blue }) {
  return (
    <span style={{
      background: color + "22", border: `1px solid ${color}44`, borderRadius: 3,
      color, fontSize: 9, padding: "2px 6px", letterSpacing: "0.12em",
      textTransform: "uppercase", fontFamily: css.mono
    }}>{children}</span>
  );
}

function StatusDot({ status }) {
  const colors = {
    records_email: css.green,
    generic_email: css.orange,
    not_found: "#e63946",
    scraping: css.blue,
    unknown: css.textDim,
    no_website: css.textDim,
  };
  const labels = {
    records_email: "Records email found",
    generic_email: "Generic email (use as fallback)",
    not_found: "No email found — enter manually",
    scraping: "Searching...",
    unknown: "Not yet searched",
    no_website: "No website listed",
  };
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: colors[status] || css.textDim,
        boxShadow: status === "scraping" ? `0 0 6px ${css.blue}` : "none",
        animation: status === "scraping" ? "pulse 1s infinite" : "none",
        flexShrink: 0
      }} />
      <span style={{ fontSize: 10, color: colors[status] || css.textLo }}>{labels[status] || status}</span>
    </span>
  );
}

// ─── State open records law Wikipedia links ───────────────────────────────────
const STATE_RECORDS_LAWS = [
  { code: "AL", name: "Alabama", law: "Alabama Open Records Law", url: "https://www.google.com/search?q=Alabama+Open+Records+Law+open+records+request+Alabama" },
  { code: "AK", name: "Alaska", law: "Alaska Public Records Act", url: "https://www.google.com/search?q=Alaska+Public+Records+Act+open+records+request+Alaska" },
  { code: "AZ", name: "Arizona", law: "Arizona Public Records Law", url: "https://www.google.com/search?q=Arizona+Public+Records+Law+open+records+request+Arizona" },
  { code: "AR", name: "Arkansas", law: "Arkansas Freedom of Information Act", url: "https://www.google.com/search?q=Arkansas+Freedom+of+Information+Act+open+records+request+Arkansas" },
  { code: "CA", name: "California", law: "California Public Records Act", url: "https://www.google.com/search?q=California+Public+Records+Act+open+records+request+California" },
  { code: "CO", name: "Colorado", law: "Colorado Open Records Act", url: "https://www.google.com/search?q=Colorado+Open+Records+Act+open+records+request+Colorado" },
  { code: "CT", name: "Connecticut", law: "Connecticut Freedom of Information Act", url: "https://www.google.com/search?q=Connecticut+Freedom+of+Information+Act+open+records+request+Connecticut" },
  { code: "DE", name: "Delaware", law: "Delaware Freedom of Information Act", url: "https://www.google.com/search?q=Delaware+Freedom+of+Information+Act+open+records+request+Delaware" },
  { code: "FL", name: "Florida", law: "Florida Sunshine Law", url: "https://www.google.com/search?q=Florida+Sunshine+Law+open+records+request+Florida" },
  { code: "GA", name: "Georgia", law: "Georgia Open Records Act", url: "https://www.google.com/search?q=Georgia+Open+Records+Act+open+records+request+Georgia" },
  { code: "HI", name: "Hawaii", law: "Hawaii Uniform Information Practices Act", url: "https://www.google.com/search?q=Hawaii+Uniform+Information+Practices+Act+open+records+request+Hawaii" },
  { code: "ID", name: "Idaho", law: "Idaho Public Records Law", url: "https://www.google.com/search?q=Idaho+Public+Records+Law+open+records+request+Idaho" },
  { code: "IL", name: "Illinois", law: "Illinois Freedom of Information Act", url: "https://www.google.com/search?q=Illinois+Freedom+of+Information+Act+open+records+request+Illinois" },
  { code: "IN", name: "Indiana", law: "Indiana Access to Public Records Act", url: "https://www.google.com/search?q=Indiana+Access+to+Public+Records+Act+open+records+request+Indiana" },
  { code: "IA", name: "Iowa", law: "Iowa Open Records Law", url: "https://www.google.com/search?q=Iowa+Open+Records+Law+open+records+request+Iowa" },
  { code: "KS", name: "Kansas", law: "Kansas Open Records Act", url: "https://www.google.com/search?q=Kansas+Open+Records+Act+open+records+request+Kansas" },
  { code: "KY", name: "Kentucky", law: "Kentucky Open Records Act", url: "https://www.google.com/search?q=Kentucky+Open+Records+Act+open+records+request+Kentucky" },
  { code: "LA", name: "Louisiana", law: "Louisiana Public Records Law", url: "https://www.google.com/search?q=Louisiana+Public+Records+Law+open+records+request+Louisiana" },
  { code: "ME", name: "Maine", law: "Maine Freedom of Access Act", url: "https://www.google.com/search?q=Maine+Freedom+of+Access+Act+open+records+request+Maine" },
  { code: "MD", name: "Maryland", law: "Maryland Public Information Act", url: "https://www.google.com/search?q=Maryland+Public+Information+Act+open+records+request+Maryland" },
  { code: "MA", name: "Massachusetts", law: "Massachusetts Public Records Law", url: "https://www.google.com/search?q=Massachusetts+Public+Records+Law+open+records+request+Massachusetts" },
  { code: "MI", name: "Michigan", law: "Michigan Freedom of Information Act", url: "https://www.google.com/search?q=Michigan+Freedom+of+Information+Act+open+records+request+Michigan" },
  { code: "MN", name: "Minnesota", law: "Minnesota Government Data Practices Act", url: "https://www.google.com/search?q=Minnesota+Government+Data+Practices+Act+open+records+request+Minnesota" },
  { code: "MS", name: "Mississippi", law: "Mississippi Public Records Act", url: "https://www.google.com/search?q=Mississippi+Public+Records+Act+open+records+request+Mississippi" },
  { code: "MO", name: "Missouri", law: "Missouri Sunshine Law", url: "https://www.google.com/search?q=Missouri+Sunshine+Law+open+records+request+Missouri" },
  { code: "MT", name: "Montana", law: "Montana Constitution Right to Know", url: "https://www.google.com/search?q=Montana+Constitution+Right+to+Know+open+records+request+Montana" },
  { code: "NE", name: "Nebraska", law: "Nebraska Public Records Statutes", url: "https://www.google.com/search?q=Nebraska+Public+Records+Statutes+open+records+request+Nebraska" },
  { code: "NV", name: "Nevada", law: "Nevada Public Records Act", url: "https://www.google.com/search?q=Nevada+Public+Records+Act+open+records+request+Nevada" },
  { code: "NH", name: "New Hampshire", law: "New Hampshire Right-to-Know Law", url: "https://www.google.com/search?q=New+Hampshire+Right-to-Know+Law+open+records+request+New+Hampshire" },
  { code: "NJ", name: "New Jersey", law: "New Jersey Open Public Records Act", url: "https://www.google.com/search?q=New+Jersey+Open+Public+Records+Act+open+records+request+New+Jersey" },
  { code: "NM", name: "New Mexico", law: "New Mexico Inspection of Public Records Act", url: "https://www.google.com/search?q=New+Mexico+Inspection+of+Public+Records+Act+open+records+request+New+Mexico" },
  { code: "NY", name: "New York", law: "New York Freedom of Information Law", url: "https://www.google.com/search?q=New+York+Freedom+of+Information+Law+open+records+request+New+York" },
  { code: "NC", name: "North Carolina", law: "North Carolina Public Records Law", url: "https://www.google.com/search?q=North+Carolina+Public+Records+Law+open+records+request+North+Carolina" },
  { code: "ND", name: "North Dakota", law: "North Dakota Open Records Law", url: "https://www.google.com/search?q=North+Dakota+Open+Records+Law+open+records+request+North+Dakota" },
  { code: "OH", name: "Ohio", law: "Ohio Public Records Act", url: "https://www.google.com/search?q=Ohio+Public+Records+Act+open+records+request+Ohio" },
  { code: "OK", name: "Oklahoma", law: "Oklahoma Open Records Act", url: "https://www.google.com/search?q=Oklahoma+Open+Records+Act+open+records+request+Oklahoma" },
  { code: "OR", name: "Oregon", law: "Oregon Public Records Law", url: "https://www.google.com/search?q=Oregon+Public+Records+Law+open+records+request+Oregon" },
  { code: "PA", name: "Pennsylvania", law: "Pennsylvania Right-to-Know Law", url: "https://www.google.com/search?q=Pennsylvania+Right-to-Know+Law+open+records+request+Pennsylvania" },
  { code: "RI", name: "Rhode Island", law: "Rhode Island Access to Public Records Act", url: "https://www.google.com/search?q=Rhode+Island+Access+to+Public+Records+Act+open+records+request+Rhode+Island" },
  { code: "SC", name: "South Carolina", law: "South Carolina Freedom of Information Act", url: "https://www.google.com/search?q=South+Carolina+Freedom+of+Information+Act+open+records+request+South+Carolina" },
  { code: "SD", name: "South Dakota", law: "South Dakota Open Records Law", url: "https://www.google.com/search?q=South+Dakota+Open+Records+Law+open+records+request+South+Dakota" },
  { code: "TN", name: "Tennessee", law: "Tennessee Public Records Act", url: "https://www.google.com/search?q=Tennessee+Public+Records+Act+open+records+request+Tennessee" },
  { code: "TX", name: "Texas", law: "Texas Public Information Act", url: "https://www.google.com/search?q=Texas+Public+Information+Act+open+records+request+Texas" },
  { code: "UT", name: "Utah", law: "Utah Government Records Access and Management Act", url: "https://www.google.com/search?q=Utah+Government+Records+Access+and+Management+Act+open+records+request+Utah" },
  { code: "VT", name: "Vermont", law: "Vermont Public Records Act", url: "https://www.google.com/search?q=Vermont+Public+Records+Act+open+records+request+Vermont" },
  { code: "VA", name: "Virginia", law: "Virginia Freedom of Information Act", url: "https://www.google.com/search?q=Virginia+Freedom+of+Information+Act+open+records+request+Virginia" },
  { code: "WA", name: "Washington", law: "Washington Public Records Act", url: "https://www.google.com/search?q=Washington+Public+Records+Act+open+records+request+Washington" },
  { code: "WV", name: "West Virginia", law: "West Virginia Freedom of Information Act", url: "https://www.google.com/search?q=West+Virginia+Freedom+of+Information+Act+open+records+request+West+Virginia" },
  { code: "WI", name: "Wisconsin", law: "Wisconsin Open Records Law", url: "https://www.google.com/search?q=Wisconsin+Open+Records+Law+open+records+request+Wisconsin" },
  { code: "WY", name: "Wyoming", law: "Wyoming Public Records Act", url: "https://www.google.com/search?q=Wyoming+Public+Records+Act+open+records+request+Wyoming" },
  { code: "DC", name: "Washington D.C.", law: "D.C. Freedom of Information Act", url: "https://www.google.com/search?q=D.C.+Freedom+of+Information+Act+open+records+request+Washington+D.C." },
];

export default function ALPRSpotlight() {
  const [step, setStep] = useState(1);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [leafletReady, setLeafletReady] = useState(false);
  const [pin, setPin] = useState(null);
  const [radius, setRadius] = useState(5);
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState(["camera_locations", "policies", "audit_records"]);
  const [agencies, setAgencies] = useState([]);
  const [selectedAgencies, setSelectedAgencies] = useState(new Set());
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [agencyError, setAgencyError] = useState(null);
  const [scrapingStatus, setScrapingStatus] = useState({}); // id -> status string
  const [emailOverrides, setEmailOverrides] = useState({}); // id -> manual email
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [previewId, setPreviewId] = useState(null);

  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const circleRef = useRef(null);
  const pinMarker = useRef(null);
  const agencyMarkers = useRef([]);

  // ── Load Leaflet ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.onload = () => setLeafletReady(true);
    document.head.appendChild(s);
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInst.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([39.5, -98.35], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
    map.on("click", e => setPin({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapInst.current = map;
  }, [leafletReady]);

  // ── Fetch agencies when pin/radius changes ──────────────────────────────────
  useEffect(() => {
    if (!pin) return;
    const controller = new AbortController();
    setLoadingAgencies(true);
    setAgencyError(null);
    setAgencies([]);
    setSelectedAgencies(new Set());
    setScrapingStatus({});

    (async () => {
      try {
        let found;
        if (USE_MOCK) {
          await new Promise(r => setTimeout(r, 600));
          found = MOCK_AGENCIES.filter(a => haversine(pin.lat, pin.lng, a.lat, a.lng) <= radius);
        } else {
          const res = await fetch(`${API_BASE}/api/agencies?lat=${pin.lat}&lng=${pin.lng}&radius=${radius}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`API error ${res.status}`);
          const data = await res.json();
          found = data.agencies || [];
        }
        if (!controller.signal.aborted) {
          setAgencies(found);
          setSelectedAgencies(new Set(found.map(a => a.id)));
          setLoadingAgencies(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setAgencyError(err.message);
          setLoadingAgencies(false);
        }
      }
    })();

    return () => controller.abort();
  }, [pin, radius]);

  // ── Update map visuals when pin/radius/agencies change ──────────────────────
  useEffect(() => {
    if (!mapInst.current || !window.L) return;
    const L = window.L;
    const map = mapInst.current;

    if (pinMarker.current) { pinMarker.current.remove(); pinMarker.current = null; }
    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
    agencyMarkers.current.forEach(m => m.remove());
    agencyMarkers.current = [];

    if (!pin) return;

    pinMarker.current = L.marker([pin.lat, pin.lng], {
      icon: L.divIcon({
        html: `<div style="width:16px;height:16px;background:#e63946;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #e63946,0 3px 10px rgba(0,0,0,0.5)"></div>`,
        iconSize: [16,16], iconAnchor: [8,8], className: ""
      })
    }).addTo(map);

    circleRef.current = L.circle([pin.lat, pin.lng], {
      radius: radius * 1609.34,
      color: "#e63946", fillColor: "#e63946", fillOpacity: 0.06,
      weight: 2, dashArray: "5,4"
    }).addTo(map);

    agencies.forEach(a => {
      const isSelected = selectedAgencies.has(a.id);
      const m = L.marker([a.lat, a.lng], {
        icon: L.divIcon({
          html: `<div style="background:${isSelected ? "#1d3557" : "#111820"};color:${isSelected ? "#7ab3e0" : "#445566"};font-size:9px;padding:3px 7px;border-radius:3px;white-space:nowrap;border:1px solid ${isSelected ? "#457b9d" : "#1a2535"};box-shadow:0 2px 6px rgba(0,0,0,0.4);font-family:monospace">${a.type?.slice(0,18) || "Law Enforcement"}</div>`,
          className: "", iconAnchor: [40, 10]
        })
      }).addTo(map).bindPopup(`<b>${a.name}</b><br>${a.type}<br><small>${a.address}</small>`);
      agencyMarkers.current.push(m);
    });

    if (agencies.length > 0) {
      try { map.fitBounds(circleRef.current.getBounds(), { padding: [30,30] }); } catch {}
    } else {
      map.setView([pin.lat, pin.lng], 12);
    }
  }, [pin, radius, agencies, selectedAgencies]);

  // ── Scrape emails for selected agencies ─────────────────────────────────────
  const scrapeEmails = useCallback(async (agencyList) => {
    for (const agency of agencyList) {
      if (agency.emailStatus === "records_email" || agency.emailStatus === "generic_email") continue;
      setScrapingStatus(s => ({ ...s, [agency.id]: "scraping" }));
      try {
        let result;
        if (USE_MOCK) {
          result = await mockScrapeEmail(agency);
        } else {
          const res = await fetch(`${API_BASE}/api/email?id=${agency.id}&website=${encodeURIComponent(agency.website || "")}&name=${encodeURIComponent(agency.name)}`);
          result = await res.json();
        }
        setAgencies(prev => prev.map(a => a.id === agency.id ? { ...a, email: result.email, emailStatus: result.status } : a));
        setScrapingStatus(s => ({ ...s, [agency.id]: result.status }));
      } catch {
        setScrapingStatus(s => ({ ...s, [agency.id]: "error" }));
      }
    }
  }, []);

  // Auto-scrape when advancing to step 3
  useEffect(() => {
    if (step === 3 && agencies.length > 0) {
      const toScrape = agencies.filter(a => selectedAgencies.has(a.id) && a.emailStatus === "unknown");
      if (toScrape.length > 0) scrapeEmails(toScrape);
    }
  }, [step]);

  // ── Geocode address ─────────────────────────────────────────────────────────
  const geocode = async () => {
    if (!addressInput.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput)}&limit=1`);
      const data = await res.json();
      if (data[0]) {
        const { lat, lon } = data[0];
        const newPin = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setPin(newPin);
        mapInst.current?.setView([newPin.lat, newPin.lng], 13);
      }
    } catch {}
    setGeocoding(false);
  };

  const toggleType = id => setSelectedTypes(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAgency = id => setSelectedAgencies(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const getEmail = a => emailOverrides[a.id] || a.email;

  const openEmail = agency => {
    const body = generateRequestText(agency, selectedTypes, requesterName, requesterEmail);
    const mailto = `mailto:${getEmail(agency) || ""}?subject=${encodeURIComponent("Public Records Request – Surveillance Technology")}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_self");
  };

  const openAll = () => {
    agencies.filter(a => selectedAgencies.has(a.id)).forEach((a, i) => setTimeout(() => openEmail(a), i * 400));
  };

  const selectedList = agencies.filter(a => selectedAgencies.has(a.id));
  const previewAgency = agencies.find(a => a.id === previewId) || selectedList[0];

  const stepDots = ["Location", "Requests", "Agencies", "Send"];

  return (
    <div style={{ minHeight: "100vh", background: css.bg, fontFamily: css.mono, color: css.textMid }}>
      <style>{`
        * { box-sizing: border-box; }
        input, button, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0e1a; }
        ::-webkit-scrollbar-thumb { background: #1a2535; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        .agency-row:hover { background: #0f1e30 !important; border-color: #1d3557 !important; }
        .btn-ghost:hover { background: #0d1421 !important; border-color: #1d3557 !important; }
        .btn-primary:hover { background: #c0303c !important; }
      `}</style>

      {/* ── Disclaimer Modal ─────────────────────────────────────────────────── */}
      {!disclaimerAccepted && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(4,6,12,0.95)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#0a0f1a", border: `1px solid ${css.borderHi}`,
            borderRadius: 10, maxWidth: 580, width: "100%",
            boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
            animation: "modalIn 0.25s ease"
          }}>
            {/* Modal header */}
            <div style={{
              background: "#0d1421", borderBottom: `1px solid ${css.border}`,
              borderRadius: "10px 10px 0 0", padding: "16px 22px",
              display: "flex", alignItems: "center", gap: 10
            }}>
              <div style={{
                width: 28, height: 28, background: css.accent, borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0
              }}>⚖️</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: "bold", color: css.textHi, letterSpacing: "0.1em", textTransform: "uppercase" }}>Legal Disclaimer</div>
                <div style={{ fontSize: 9, color: css.textLo, letterSpacing: "0.15em", textTransform: "uppercase" }}>Please read before using ALPR Spotlight</div>
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px 22px", maxHeight: "55vh", overflowY: "auto" }}>

              {[
                {
                  icon: "📋",
                  title: "For Lawful Public Records Requests Only",
                  text: "This tool is designed solely to assist in submitting lawful public records requests under applicable federal and state law, including the Freedom of Information Act (5 U.S.C. § 552) and equivalent state sunshine laws. All 50 states have public records statutes that grant the public the right to request government records."
                },
                {
                  icon: "📝",
                  title: "Generated Letters Are Templates",
                  text: "Request letters generated by this tool are templates only. You are responsible for reviewing, editing, and verifying the accuracy of any request before sending it. The tool makes no guarantee that generated letters are legally sufficient for any specific jurisdiction or agency."
                },
                {
                  icon: "⚠️",
                  title: "No Legal Advice",
                  text: "Nothing in this tool constitutes legal advice. Laws governing public records requests vary significantly by state and agency type. Consult a qualified attorney if you have questions about your rights, obligations, or the legal sufficiency of a specific request."
                },
                {
                  icon: "🏛️",
                  title: "Agency Contact Information",
                  text: "Agency data is sourced from OpenStreetMap contributors and may be incomplete, outdated, or inaccurate. Email addresses found by automated scraping are not guaranteed to be the correct or current records contact. Always verify contact information independently before relying on it."
                },
                {
                  icon: "🔒",
                  title: "No Data Collected",
                  text: "This tool does not collect, store, or transmit your personal information, request content, or email communications. All email sending occurs through your own email client. No request data passes through our servers."
                },
                {
                  icon: "🚫",
                  title: "Prohibited Uses",
                  text: "This tool may not be used to harass, threaten, or intimidate any individual or agency; to submit frivolous or bad-faith requests; or for any purpose that violates applicable law. Misuse of public records laws may result in civil or criminal liability."
                },
              ].map((item, i) => (
                <div key={i} style={{
                  marginBottom: 14, padding: "11px 13px",
                  background: "#080c14", border: `1px solid ${css.border}`,
                  borderRadius: 6
                }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", color: css.textHi, marginBottom: 5 }}>
                    {item.icon} {item.title}
                  </div>
                  <div style={{ fontSize: 10, color: css.textMid, lineHeight: 1.7 }}>{item.text}</div>
                </div>
              ))}

              <div style={{
                padding: "10px 13px", background: "#0f1e30",
                border: `1px solid ${css.blue}44`, borderRadius: 6,
                fontSize: 10, color: css.blue, lineHeight: 1.7
              }}>
                By clicking <strong style={{ color: css.textHi }}>"I Understand — Continue"</strong> below, you acknowledge that you have read this disclaimer, that you will use this tool only for lawful public records requests, and that you accept full responsibility for any requests you submit.
              </div>
            </div>

            {/* Modal footer */}
            <div style={{
              padding: "14px 22px", borderTop: `1px solid ${css.border}`,
              display: "flex", gap: 10
            }}>
              <button
                onClick={() => window.location.href = "https://www.google.com"}
                style={{
                  flex: 1, background: "transparent", border: `1px solid ${css.border}`,
                  borderRadius: 5, color: css.textLo, padding: "10px",
                  cursor: "pointer", fontSize: 10, letterSpacing: "0.1em"
                }}
              >
                ← Leave Site
              </button>
              <button
                onClick={() => setDisclaimerAccepted(true)}
                style={{
                  flex: 3, background: css.accent, border: "none",
                  borderRadius: 5, color: "#fff", padding: "10px",
                  cursor: "pointer", fontSize: 11, fontWeight: "bold",
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  transition: "background 0.15s"
                }}
                className="btn-primary"
              >
                I Understand — Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${css.border}`, padding: "0 24px",
        height: 54, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(90deg, #080c14 0%, #0a0f1a 100%)", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, background: css.accent, borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff", fontWeight: "bold"
          }}>⊞</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", letterSpacing: "0.15em", color: css.textHi, textTransform: "uppercase" }}>ALPR Spotlight</div>
            <div style={{ fontSize: 9, color: css.textLo, letterSpacing: "0.2em", textTransform: "uppercase" }}>Public Records Request Tool</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {stepDots.map((label, i) => {
            const n = i + 1;
            const active = step === n, done = step > n;
            return (
              <div key={i} onClick={() => done && setStep(n)} style={{
                padding: "5px 14px", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                borderRadius: 3, cursor: done ? "pointer" : "default",
                background: active ? css.accent : done ? css.blueLo : "transparent",
                color: active ? "#fff" : done ? "#7ab3e0" : css.textDim,
                border: `1px solid ${active ? css.accent : done ? css.blueLo : css.textDim + "44"}`,
                transition: "all 0.2s"
              }}>{n}. {label}</div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 54px)" }}>

        {/* ── Left Panel ─────────────────────────────────────────────────────── */}
        <div style={{
          width: 340, borderRight: `1px solid ${css.border}`,
          background: css.panel, overflowY: "auto", flexShrink: 0,
          display: "flex", flexDirection: "column"
        }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div style={{ padding: 20, flex: 1, animation: "fadeIn 0.2s ease" }}>
              <div style={{ fontSize: 10, color: css.accent, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Step 1 of 4</div>
              <div style={{ fontSize: 14, color: css.textHi, marginBottom: 6, fontWeight: "bold" }}>Select Location</div>
              <div style={{ fontSize: 11, color: css.textLo, marginBottom: 20, lineHeight: 1.7 }}>
                Search for an address or click the map to pin a location. Set the search radius to find all law enforcement agencies in that area.
              </div>

              <label style={{ fontSize: 10, color: css.textLo, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Search Address</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                <input value={addressInput} onChange={e => setAddressInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && geocode()}
                  placeholder="123 Main St, City, State..."
                  style={{
                    flex: 1, background: css.card, border: `1px solid ${css.border}`,
                    borderRadius: 4, color: css.textHi, padding: "8px 10px", fontSize: 11,
                    outline: "none", transition: "border 0.15s"
                  }}
                />
                <button onClick={geocode} disabled={geocoding} className="btn-ghost" style={{
                  background: "transparent", border: `1px solid ${css.borderHi}`,
                  borderRadius: 4, color: css.blue, padding: "8px 14px", cursor: "pointer",
                  fontSize: 10, letterSpacing: "0.12em", transition: "all 0.15s"
                }}>{geocoding ? "..." : "GO"}</button>
              </div>

              <label style={{ fontSize: 10, color: css.textLo, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                Radius: <span style={{ color: css.textHi }}>{radius} mile{radius !== 1 ? "s" : ""}</span>
              </label>
              <input type="range" min="0.5" max="25" step="0.5" value={radius}
                onChange={e => setRadius(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: css.accent, marginBottom: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: css.textDim, marginBottom: 20 }}>
                <span>0.5 mi</span><span>12.5 mi</span><span>25 mi</span>
              </div>

              {pin ? (
                <div style={{ background: css.card, border: `1px solid ${css.border}`, borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: css.textLo, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Pin Location</div>
                  <div style={{ fontSize: 11, color: css.blue, marginBottom: 6 }}>{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</div>
                  {loadingAgencies ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: css.textLo }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, border: `2px solid ${css.blue}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Querying HIFLD database...
                    </div>
                  ) : agencyError ? (
                    <div style={{ fontSize: 11, color: css.accent }}>{agencyError}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: css.textHi }}>
                      <span style={{ color: css.accent, fontWeight: "bold", fontSize: 14 }}>{agencies.length}</span> agencies found within {radius} mi
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ border: `1px dashed ${css.border}`, borderRadius: 6, padding: 20, textAlign: "center", color: css.textDim, fontSize: 11, lineHeight: 1.7 }}>
                  Click anywhere on the map<br />to place your search pin
                </div>
              )}

              {agencies.length > 0 && !loadingAgencies && (
                <button onClick={() => setStep(2)} className="btn-primary" style={{
                  width: "100%", background: css.accent, border: "none", borderRadius: 4,
                  color: "#fff", padding: "11px", cursor: "pointer", fontSize: 11,
                  letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 12,
                  transition: "background 0.15s"
                }}>Continue → Select Requests</button>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ padding: 20, flex: 1, animation: "fadeIn 0.2s ease" }}>
              <div style={{ fontSize: 10, color: css.accent, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Step 2 of 4</div>
              <div style={{ fontSize: 14, color: css.textHi, marginBottom: 6, fontWeight: "bold" }}>Request Types</div>
              <div style={{ fontSize: 11, color: css.textLo, marginBottom: 16, lineHeight: 1.7 }}>
                Choose what information to request. All selections will appear in every letter.
              </div>

              {REQUEST_TYPES.map(rt => {
                const sel = selectedTypes.includes(rt.id);
                return (
                  <div key={rt.id} onClick={() => toggleType(rt.id)} style={{
                    display: "flex", gap: 10, padding: "9px 10px", marginBottom: 5,
                    borderRadius: 5, cursor: "pointer",
                    background: sel ? "#0f1e30" : "transparent",
                    border: `1px solid ${sel ? css.borderHi : "#111925"}`,
                    transition: "all 0.15s"
                  }}>
                    <div style={{
                      width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 1,
                      background: sel ? css.accent : "transparent",
                      border: `2px solid ${sel ? css.accent : css.textDim}`,
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {sel && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: sel ? css.textHi : css.textLo, fontWeight: sel ? "bold" : "normal" }}>{rt.icon} {rt.label}</div>
                      <div style={{ fontSize: 9, color: css.textDim, marginTop: 2, lineHeight: 1.5 }}>{rt.description}</div>
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: 18, padding: 12, background: css.card, border: `1px solid ${css.border}`, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: css.textLo, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Your Information (Optional)</div>
                <input value={requesterName} onChange={e => setRequesterName(e.target.value)}
                  placeholder="Full name (for signature block)"
                  style={{ width: "100%", background: css.bg, border: `1px solid ${css.border}`, borderRadius: 3, color: css.textHi, padding: "7px 9px", fontSize: 11, outline: "none", marginBottom: 7 }}
                />
                <input value={requesterEmail} onChange={e => setRequesterEmail(e.target.value)}
                  placeholder="Your email (for agency replies)"
                  style={{ width: "100%", background: css.bg, border: `1px solid ${css.border}`, borderRadius: 3, color: css.textHi, padding: "7px 9px", fontSize: 11, outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={() => setStep(1)} className="btn-ghost" style={{
                  flex: 1, background: "transparent", border: `1px solid ${css.border}`, borderRadius: 4,
                  color: css.textLo, padding: "9px", cursor: "pointer", fontSize: 11,
                  letterSpacing: "0.1em", transition: "all 0.15s"
                }}>← Back</button>
                <button onClick={() => setStep(3)} disabled={selectedTypes.length === 0} className="btn-primary" style={{
                  flex: 2, background: selectedTypes.length > 0 ? css.accent : "#1a2535",
                  border: "none", borderRadius: 4,
                  color: selectedTypes.length > 0 ? "#fff" : css.textDim,
                  padding: "9px", cursor: selectedTypes.length > 0 ? "pointer" : "not-allowed",
                  fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", transition: "background 0.15s"
                }}>Continue → Agencies</button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div style={{ padding: 20, flex: 1, animation: "fadeIn 0.2s ease" }}>
              <div style={{ fontSize: 10, color: css.accent, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Step 3 of 4</div>
              <div style={{ fontSize: 14, color: css.textHi, marginBottom: 4, fontWeight: "bold" }}>Select Agencies</div>
              <div style={{ fontSize: 11, color: css.textLo, marginBottom: 2, lineHeight: 1.7 }}>
                {agencies.length} agencies found. Email lookup is running automatically.
              </div>

              {/* Stats bar */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <Pill color={css.green}>{agencies.filter(a => a.emailStatus === "records_email").length} records emails</Pill>
                <Pill color={css.orange}>{agencies.filter(a => a.emailStatus === "generic_email").length} generic</Pill>
                <Pill color={css.accent}>{agencies.filter(a => a.emailStatus === "not_found" || a.emailStatus === "no_website").length} not found</Pill>
                <Pill color={css.blue}>{agencies.filter(a => scrapingStatus[a.id] === "scraping").length} scraping</Pill>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button onClick={() => setSelectedAgencies(new Set(agencies.map(a => a.id)))} className="btn-ghost" style={{
                  flex: 1, background: "transparent", border: `1px solid ${css.border}`, borderRadius: 3,
                  color: css.blue, padding: "6px", cursor: "pointer", fontSize: 9, letterSpacing: "0.1em"
                }}>SELECT ALL</button>
                <button onClick={() => setSelectedAgencies(new Set())} className="btn-ghost" style={{
                  flex: 1, background: "transparent", border: `1px solid ${css.border}`, borderRadius: 3,
                  color: css.blue, padding: "6px", cursor: "pointer", fontSize: 9, letterSpacing: "0.1em"
                }}>DESELECT ALL</button>
              </div>

              {agencies.map(a => {
                const sel = selectedAgencies.has(a.id);
                const email = getEmail(a);
                const status = scrapingStatus[a.id] || a.emailStatus;
                return (
                  <div key={a.id} className="agency-row" style={{
                    padding: "10px", marginBottom: 6, borderRadius: 5, transition: "all 0.15s",
                    background: sel ? "#0d1a2a" : "transparent",
                    border: `1px solid ${sel ? css.borderHi : "#111925"}`
                  }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div onClick={() => toggleAgency(a.id)} style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2, cursor: "pointer",
                        background: sel ? css.accent : "transparent",
                        border: `2px solid ${sel ? css.accent : css.textDim}`,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {sel && <span style={{ color: "#fff", fontSize: 8 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, cursor: "pointer" }} onClick={() => toggleAgency(a.id)}>
                        <div style={{ fontSize: 11, color: css.textHi, fontWeight: "bold", marginBottom: 2 }}>{a.name}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          <Pill color={css.blue}>{a.type?.slice(0,20)}</Pill>
                          {a.state && <Pill color={css.textLo}>{a.state}</Pill>}
                        </div>
                        <div style={{ fontSize: 10, color: css.textDim, marginBottom: 5 }}>{a.address}</div>
                        <StatusDot status={status} />
                        {email && status !== "scraping" && (
                          <div style={{ fontSize: 10, color: css.textLo, marginTop: 3, wordBreak: "break-all" }}>→ {email}</div>
                        )}
                      </div>
                    </div>

                    {sel && (status === "not_found" || status === "no_website" || status === "error") && (
                      <input
                        placeholder="Enter email manually..."
                        value={emailOverrides[a.id] || ""}
                        onChange={e => setEmailOverrides(p => ({ ...p, [a.id]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: "100%", background: css.bg, border: `1px solid ${css.border}`,
                          borderRadius: 3, color: css.textHi, padding: "6px 8px", fontSize: 10,
                          outline: "none", marginTop: 8
                        }}
                      />
                    )}

                    {sel && (
                      <button onClick={() => { setPreviewId(a.id); setStep(4); }} style={{
                        marginTop: 8, background: "transparent", border: `1px solid ${css.borderHi}`,
                        borderRadius: 3, color: css.blue, padding: "4px 10px", cursor: "pointer",
                        fontSize: 9, letterSpacing: "0.1em"
                      }}>PREVIEW LETTER</button>
                    )}
                  </div>
                );
              })}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => setStep(2)} className="btn-ghost" style={{
                  flex: 1, background: "transparent", border: `1px solid ${css.border}`, borderRadius: 4,
                  color: css.textLo, padding: "9px", cursor: "pointer", fontSize: 11, letterSpacing: "0.1em"
                }}>← Back</button>
                <button onClick={() => setStep(4)} disabled={selectedList.length === 0} className="btn-primary" style={{
                  flex: 2, background: selectedList.length > 0 ? css.accent : "#1a2535", border: "none", borderRadius: 4,
                  color: selectedList.length > 0 ? "#fff" : css.textDim,
                  padding: "9px", cursor: selectedList.length > 0 ? "pointer" : "not-allowed",
                  fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", transition: "background 0.15s"
                }}>Review & Send →</button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div style={{ padding: 20, flex: 1, animation: "fadeIn 0.2s ease" }}>
              <div style={{ fontSize: 10, color: css.accent, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Step 4 of 4</div>
              <div style={{ fontSize: 14, color: css.textHi, marginBottom: 14, fontWeight: "bold" }}>Review & Send</div>

              <div style={{ background: css.card, border: `1px solid ${css.border}`, borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    ["Agencies", selectedList.length],
                    ["Request types", selectedTypes.length],
                    ["Radius", `${radius} mi`],
                    ["With email", selectedList.filter(a => getEmail(a)).length],
                  ].map(([k,v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 9, color: css.textLo, letterSpacing: "0.12em", textTransform: "uppercase" }}>{k}</div>
                      <div style={{ fontSize: 16, color: css.textHi, fontWeight: "bold" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 10, color: css.textLo, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Individual Emails</div>
              {selectedList.map(a => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", marginBottom: 4, borderRadius: 4,
                  background: previewId === a.id ? "#0f1e30" : css.bg,
                  border: `1px solid ${previewId === a.id ? css.borderHi : css.border}`,
                  cursor: "pointer"
                }} onClick={() => setPreviewId(a.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: css.textHi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: getEmail(a) ? css.green : css.textDim }}>
                      {getEmail(a) || "No email found"}
                    </div>
                  </div>
                  {getEmail(a) ? (
                    <button onClick={e => { e.stopPropagation(); openEmail(a); }} style={{
                      background: css.blueLo, border: `1px solid ${css.blue}44`, borderRadius: 3,
                      color: css.blue, padding: "4px 10px", cursor: "pointer", fontSize: 9,
                      letterSpacing: "0.1em", flexShrink: 0, marginLeft: 8
                    }}>✉ OPEN</button>
                  ) : (
                    <button onClick={e => {
                      e.stopPropagation();
                      const state = a.state || selectedState || "";
                      const query = `${a.name} ${state} public records request email`.replace(/ +/g, "+");
                      window.open(`https://www.google.com/search?q=${query}`, "_blank");
                    }} style={{
                      background: "#1a2a1a", border: `1px solid ${css.green}44`, borderRadius: 3,
                      color: css.green, padding: "4px 10px", cursor: "pointer", fontSize: 9,
                      letterSpacing: "0.1em", flexShrink: 0, marginLeft: 8, whiteSpace: "nowrap"
                    }}>🔍 FIND</button>
                  )}
                </div>
              ))}

              <button onClick={openAll} className="btn-primary" style={{
                width: "100%", background: css.accent, border: "none", borderRadius: 4,
                color: "#fff", padding: "12px", cursor: "pointer", fontSize: 11,
                letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 14,
                transition: "background 0.15s"
              }}>✉ OPEN ALL IN EMAIL CLIENT</button>

              <div style={{ fontSize: 10, color: css.textDim, textAlign: "center", marginTop: 10, lineHeight: 1.7 }}>
                Opens your default email app pre-populated with each request.<br />
                <span style={{ color: css.textLo }}>Zero data sent through this tool.</span>
              </div>

              {/* ── State Open Records Law Reference ── */}
              <div style={{
                marginTop: 18, padding: "13px", background: css.card,
                border: `1px solid ${css.border}`, borderRadius: 6
              }}>
                <div style={{ fontSize: 10, color: css.textLo, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
                  📖 State Open Records Law Reference
                </div>
                <div style={{ fontSize: 10, color: css.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                  Select your state to view the applicable open records law on Wikipedia.
                </div>
                <select
                  value={selectedState}
                  onChange={e => setSelectedState(e.target.value)}
                  style={{
                    width: "100%", background: "#080c14", border: `1px solid ${css.borderHi}`,
                    borderRadius: 4, color: css.textHi, padding: "8px 10px",
                    fontSize: 11, outline: "none", cursor: "pointer", marginBottom: 8,
                    appearance: "none"
                  }}
                >
                  <option value="">— Select a state —</option>
                  {STATE_RECORDS_LAWS.map(s => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>

                {selectedState && (() => {
                  const entry = STATE_RECORDS_LAWS.find(s => s.code === selectedState);
                  return entry ? (
                    <div style={{
                      padding: "10px 12px", background: "#080c14",
                      border: `1px solid ${css.blue}44`, borderRadius: 5
                    }}>
                      <div style={{ fontSize: 10, color: css.blue, marginBottom: 6, fontWeight: "bold" }}>
                        {entry.name}: {entry.law}
                      </div>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block", background: css.blueLo,
                          border: `1px solid ${css.blue}44`, borderRadius: 3,
                          color: css.blue, padding: "5px 12px", fontSize: 10,
                          textDecoration: "none", letterSpacing: "0.1em",
                          transition: "background 0.15s"
                        }}
                      >
                        SEARCH GOOGLE →
                      </a>
                    </div>
                  ) : null;
                })()}
              </div>

              <button onClick={() => setStep(3)} className="btn-ghost" style={{
                width: "100%", background: "transparent", border: `1px solid ${css.border}`,
                borderRadius: 4, color: css.textLo, padding: "8px", cursor: "pointer",
                fontSize: 10, marginTop: 12, letterSpacing: "0.1em"
              }}>← Back to Agencies</button>
            </div>
          )}
        </div>

        {/* ── Right: Map + Letter Preview ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {/* Map */}
          <div ref={mapRef} style={{ flex: step === 4 ? "0 0 35%" : 1, transition: "flex 0.3s ease" }} />

          {/* Letter Preview (step 4) */}
          {step === 4 && (
            <div style={{ flex: 1, background: "#06090f", borderTop: `1px solid ${css.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: `1px solid ${css.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: css.panel }}>
                <span style={{ fontSize: 9, color: css.textLo, letterSpacing: "0.15em", textTransform: "uppercase", marginRight: 4 }}>Preview:</span>
                {selectedList.map(a => (
                  <button key={a.id} onClick={() => setPreviewId(a.id)} style={{
                    background: previewId === a.id ? css.blueLo : "transparent",
                    border: `1px solid ${previewId === a.id ? css.blue : css.border}`,
                    borderRadius: 3, color: previewId === a.id ? css.blue : css.textDim,
                    padding: "3px 10px", cursor: "pointer", fontSize: 9, letterSpacing: "0.08em"
                  }}>{a.name.split(" ").slice(0,3).join(" ")}</button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                {previewAgency ? (
                  <pre style={{
                    fontSize: 11, color: "#a8c0d6", lineHeight: 1.75,
                    fontFamily: css.mono, whiteSpace: "pre-wrap", margin: 0,
                    background: "#080c14", border: `1px solid ${css.border}`,
                    borderRadius: 6, padding: 16
                  }}>
                    {generateRequestText(previewAgency, selectedTypes, requesterName, requesterEmail)}
                  </pre>
                ) : (
                  <div style={{ color: css.textDim, fontSize: 11, textAlign: "center", paddingTop: 30 }}>Select an agency on the left to preview its letter</div>
                )}
              </div>
            </div>
          )}

          {/* Map hint overlay */}
          {step === 1 && !pin && leafletReady && (
            <div style={{
              position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
              background: "rgba(6,9,15,0.88)", border: `1px solid ${css.border}`,
              borderRadius: 6, padding: "9px 18px", fontSize: 11, color: css.textLo,
              backdropFilter: "blur(4px)", pointerEvents: "none", whiteSpace: "nowrap"
            }}>
              Click the map to place a pin · or search an address above
            </div>
          )}

          {/* HIFLD loading overlay */}
          {loadingAgencies && pin && (
            <div style={{
              position: "absolute", top: 12, right: 12,
              background: "rgba(6,9,15,0.92)", border: `1px solid ${css.blue}44`,
              borderRadius: 6, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8
            }}>
              <span style={{ display: "inline-block", width: 10, height: 10, border: `2px solid ${css.blue}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <span style={{ fontSize: 10, color: css.blue, letterSpacing: "0.1em" }}>Querying HIFLD database…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
