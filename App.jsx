import { useState, useEffect, useRef, useCallback } from "react";
import { loadKey, saveKey, loadPersonalKey, savePersonalKey } from "./lib/storage";
import { signUp, signIn, signOutUser, getCurrentProfile, onAuthChange, listPendingProfiles, listAllProfiles, approveProfile, revokeProfile } from "./lib/auth";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Star,
  BookOpen,
  MessageCircle,
  AlertTriangle,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
  Trophy,
  Mail,
  Lock,
  Send,
  Phone,
} from "lucide-react";

/* ---------- design tokens ----------
   pitch  #16342A  deep field green (chrome, nav)
   turf   #3F8F5F  present / success
   chalk  #F7F5EF  page background
   ink    #1C1F1D  text
   amber  #D98E2B  late / attention
   clay   #B24C34  absent / alert
   line   #DAD5C7  hairline dividers (chalk field lines)
------------------------------------- */

const FONT_LINK_ID = "sideline-fonts";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap";
    document.head.appendChild(link);
  }, []);
}

const STYLE_ID = "sideline-tokens";
const TOKEN_CSS = `
  .sl-bg-pitch { background-color: #16342A; }
  .sl-bg-turf { background-color: #3F8F5F; }
  .sl-bg-chalk { background-color: #F7F5EF; }
  .sl-bg-amber { background-color: #D98E2B; }
  .sl-bg-clay { background-color: #B24C34; }
  .sl-bg-cream { background-color: #EFEBDD; }
  .sl-bg-clay-tint { background-color: #FBE9E2; }
  .sl-bg-amber-tint { background-color: #FBF1DC; }
  .sl-bg-turf-tint { background-color: #E4F1E9; }
  .sl-bg-offwhite { background-color: #FAF9F5; }
  .sl-text-pitch { color: #16342A; }
  .sl-text-muted { color: #7C8A80; }
  .sl-text-body { color: #5B655F; }
  .sl-text-ink { color: #1C1F1D; }
  .sl-text-faint { color: #B7B0A0; }
  .sl-text-clay-dark { color: #8A3A26; }
  .sl-text-amber-dark { color: #8A6414; }
  .sl-text-turf-dark { color: #245C3D; }
  .sl-text-mint { color: #9FC2AC; }
  .sl-border-line { border-color: #DAD5C7; }
  .sl-border-line2 { border-color: #EAE5D6; }
  .sl-border-clay { border-color: #B24C34; }
  .sl-border-turf { border-color: #3F8F5F; }
  .sl-ring-turf { box-shadow: 0 0 0 1px #3F8F5F inset; }
  .sl-decoration-line { text-decoration-color: #DAD5C7; }
  .sl-border-w25 { border-color: rgba(255,255,255,0.25); }
  .sl-border-w20 { border-color: rgba(255,255,255,0.20); }
  .sl-bg-w10 { background-color: rgba(255,255,255,0.10); }
  .sl-text-w80 { color: rgba(255,255,255,0.80); }
  .sl-bg-scrim { background-color: rgba(0,0,0,0.40); }
  input.sl-text-pitch::placeholder, textarea.sl-text-pitch::placeholder { color: #7C8A80; }
`;
function useTokenStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = TOKEN_CSS;
    document.head.appendChild(style);
  }, []);
}

const FONT_DISPLAY = { fontFamily: "'Barlow Condensed', sans-serif" };
const FONT_BODY = { fontFamily: "'Inter', sans-serif" };
const FONT_MONO = { fontFamily: "'IBM Plex Mono', monospace" };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function monthKey(iso) {
  return iso.slice(0, 7);
}
function niceDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function monthLabel(mk) {
  const d = new Date(mk + "-01T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ---------- real program data ---------- */
// Pinned to the season start (Mon, July 6, 2026) rather than the live
// calendar date, so attendance defaults and the Plans "TODAY" marker
// line up with kickoff. Swap back to todayISO() once the season is
// actually underway and you want it tracking the real date again.
const TODAY = "2026-07-06";

const SEED_TEAMS = [
  { id: "jw", name: "Mon/Wed AM — Mesquite Beach", coachIds: ["jasmine", "daisy"], location: "Mesquite Beach", time: "6:30–8:00 AM", meetingDays: [1, 3] },
  { id: "jt", name: "Jasmine — Tue/Thu (McQueen)", coachId: "jasmine", location: "McQueen", time: "7:00–8:30 PM", meetingDays: [2, 4] },
  { id: "dt", name: "Daisy — Tue/Thu (McQueen)", coachId: "daisy", location: "McQueen", time: "7:00–8:30 PM", meetingDays: [2, 4] },
  { id: "cp", name: "College Prep — Day 3", coachId: "jasmine", time: "Varies — coach-scheduled", meetingDays: [] },
];

// Coach records, keyed by a stable id independent of their name (so a
// coach can correct/complete their name without breaking team
// assignments elsewhere). Last name and contact info are left blank —
// coaches complete their own profile.
const SEED_COACHES = {
  jasmine: { firstName: "Jasmine", lastName: "Urban", phone: "+1 (951) 415-2309", email: "", archived: false },
  daisy: { firstName: "Daisy", lastName: "Motes", phone: "(480) 580-4853", email: "", archived: false },
};
function coachFullName(coachId, coaches) {
  const c = coaches?.[coachId];
  if (!c) return "Coach";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Coach";
}

const LOGO_DATA_URI = "data:image/png;base64,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";

const OWNER_INFO = { name: "Allen Alexander", title: "Club Director", phone: "480-560-5090" };

// Some teams (like the combined Mon/Wed AM group) have more than one
// coach. These normalize so every call site can treat "coachId" and
// "coachIds" the same way instead of needing two code paths everywhere.
function teamCoachIds(team) {
  return team?.coachIds || (team?.coachId ? [team.coachId] : []);
}
function teamCoachDisplay(team, coaches) {
  const names = teamCoachIds(team).map((id) => coachFullName(id, coaches));
  return names.length ? names.join(" & ") : "Coach";
}

function emptyContact() {
  return { name: "", phone: "", email: "" };
}
const REQUIRED_PROFILE_FIELDS = [
  { key: "dob", label: "Date of birth" },
  { key: "gradYear", label: "Grad year" },
  { key: "highSchool", label: "High school" },
  { key: "playerPhone", label: "Player phone" },
];
function profileMissingFields(player) {
  const missing = REQUIRED_PROFILE_FIELDS.filter((f) => !player[f.key]?.trim()).map((f) => f.label);
  const hasGuardian = ["Mom", "Dad", "Guardian"].some((r) => player.contacts?.[r]?.name?.trim());
  if (!hasGuardian) missing.unshift("A parent/guardian contact");
  return missing;
}
const PLAN_LABELS = { monthly: "Month-to-month", "3mo": "3-month", "5mo": "5-month", dropin: "Drop-in" };
function scheduleLabel(team) {
  if (!team) return "—";
  if (team.meetingDays?.length === 0) return "Varies";
  if (team.meetingDays?.includes(1)) return "Mon/Wed";
  if (team.meetingDays?.includes(2)) return "Tue/Thu";
  return "—";
}
function ClickablePhone({ value }) {
  if (!value) return <span>—</span>;
  return (
    <a href={`tel:${value.replace(/[^\d+]/g, "")}`} className="sl-text-pitch underline underline-offset-2">
      {value}
    </a>
  );
}
function ClickableEmail({ value }) {
  if (!value) return <span>—</span>;
  return (
    <a href={`mailto:${value}`} className="sl-text-pitch underline underline-offset-2">
      {value}
    </a>
  );
}

function roster(names) {
  // plan: 'monthly' | '3mo' | '5mo' | 'dropin'. division: 'HS' or '14U'.
  // Package access is practice-count based, not calendar-month based:
  // packageStartDate anchors counting, practicesIncluded is how many
  // scheduled practices (present, late, absent, or excused) they're
  // covered for. Excused absences (advance notice) don't consume a
  // practice — that's tracked per-date on the attendance record itself,
  // not here. paused covers injury/approved time off — a paused player
  // isn't flagged as an unmarked/missing attendance entry.
  return names.map(([name, parent]) => ({
    id: uid(),
    name,
    parent,
    plan: "monthly",
    division: "",
    packageStartDate: "2026-07-06",
    practicesIncluded: 8,
    paused: false,
    pausedReason: "",
    pausedAt: null,
    dob: "",
    gradYear: "",
    highSchool: "",
    playerPhone: "",
    instagram: "",
    snapchat: "",
    contacts: {
      Mom: emptyContact(),
      Dad: emptyContact(),
      Guardian: { ...emptyContact(), name: parent || "" },
    },
  }));
}

const SEED_ROSTERS = {
  jw: roster([
    ["Abbie Munro", "Stephanie"],
    ["Olivia Isaula", "Vanessa"],
    ["Regina Salas", "Raquel"],
    ["Akemi Kupitz", "Mandy & Bryce"],
    ["Gia Turano", "Carrie"],
    ["Janice Pong", "Jason"],
    ["Elise Steele", "Regina"],
    ["Charli Irvin", "Jay"],
    ["Ava Zehr", "Marc"],
    ["Brielle McNeil", "Tempestt"],
    ["Arora Scofield", "BreeAnn"],
    ["Brooke Winebrenner", "Matt"],
    ["Harlow Flores", "Marcela"],
    ["Ayden Armburst", "Amanda"],
    ["Anna Lyons", "Jennifer"],
    ["Jaelyn Simmons", "Elizabeth"],
    ["Chloe Cruz", "Leah"],
    ["Hope Parenteau", "Margaret"],
    ["Isla Baer", "Chad"],
    ["Kenadee Wells", "Aimee"],
    ["Finley Ryan", "Jared & Crisini"],
  ]),
  jt: roster([
    ["Addison Pirwitz", "Jen"],
    ["Rebecca FireThunder", "Brad"],
    ["Carsyn DuBois", "Kara"],
    ["Jemma Burr", "Lexi & Jacob"],
    ["Alyse Small", "Jeremiah"],
    ["Brylee White", "Christina"],
  ]),
  dt: roster([
    ["Lindi Goodman", "Shelley"],
    ["Brooklyn Stone", "Kristi"],
    ["Londyn Harris", "Kristi"],
    ["Natalie Wilson", "Katrina"],
    ["Scarlett Layton", "Stefanie"],
    ["Cora Steele", "Rachel"],
    ["Leah Simmons", "Elizabeth"],
    ["Abby Price", "Shalae"],
    ["Leah Emett", "Heidi"],
    ["Kamryn Deikevers", "Jodie"],
    ["Elsa Castro", "Jona & Rita"],
    ["Payton Forkenbrock", "Genevieve"],
    ["Ella Frazier", "Julia"],
    ["Vivienne Bergemann", "Lindsay"],
  ]),
  cp: roster([]),
};

function archivedPlayer(name, parent, gradYear, phone, email) {
  return {
    id: uid(),
    name,
    parent,
    plan: "monthly",
    division: "",
    packageStartDate: TODAY,
    practicesIncluded: 8,
    paused: false,
    pausedReason: "",
    pausedAt: null,
    dob: "",
    gradYear,
    highSchool: "",
    playerPhone: "",
    instagram: "",
    snapchat: "",
    contacts: {
      Mom: emptyContact(),
      Dad: emptyContact(),
      Guardian: { name: parent || "", phone: phone || "", email: email || "" },
    },
    lastTeamId: null,
    lastTeamName: "Past player (imported)",
    archivedAt: new Date().toISOString(),
    lastPracticeDate: null,
  };
}

// Imported from the club's dedicated "Past Players" tracking tab (203
// total: the original 11 plus 192 more found in that tab). Anyone whose
// exact name already matches a current active roster player was left
// out — that includes Ava Zehr and Akemi Kupitz, plus 7 others found
// while cross-checking this larger batch.
const SEED_ARCHIVED_PLAYERS = [
  archivedPlayer("Evelyn Vinyard", "Becky", "2026", "(602) 670-9177", "beckylinette@hotmail.com"),
  archivedPlayer("Jade Koceja", "Zac", "2027", "(480) 822-8590", "polishdawgz@gmail.com"),
  archivedPlayer("Quinn Bradshaw", "Sicely", "2027", "(480) 370-2114", "Sicelybradshaw@gmail.com"),
  archivedPlayer("Chloe Bergmann", "Jennifer", "2027", "(480) 299-1535", "jenniferabergmann@gmail.com"),
  archivedPlayer("Rachelle Stubblefield", "Sarah", "2028", "(480) 422-4992", "stubblefields@gmail.com"),
  archivedPlayer("Brooklyn Wilson", "Jessa", "2029", "(602) 617-9209", "jlsmith07@yahoo.com"),
  archivedPlayer("Kendall Wainwright", "Rhonda", "2029", "(602) 430-4255", "rwainwright1228@gmail.com"),
  archivedPlayer("Paisley Russell", "Shanel", "2029", "(480) 760-5648", "shanelrussell1@gmail.com"),
  archivedPlayer("Sydnee Carnes", "Scott", "2029", "(901) 340-9043", "Carnesp50@gmail.com"),
  archivedPlayer("Kylah Peed", "Lindsey", "2029", "(480) 540-3539", "lindsey.peed@yahoo.com"),
  archivedPlayer("Rilyn Winters", "Sunny", "2029", "(480) 707-2199", "sunnywinters7@gmail.com"),
  archivedPlayer("Sarah Giroux", "Heidi", "2028", "(480) 993-8017", "hegiroux@cox.net"),
  archivedPlayer("Noelle Chang", "Steven", "2029", "(480) 225-0518", "ischivi@gmail.com"),
  archivedPlayer("Anka Yildirim", "Ayca", "2029", "(609) 598-2791", "aycatuzmen@gmail.com"),
  archivedPlayer("Peyton Booth", "Samantha", "2029", "(480)221-9037", "sammiegirl2612@gmail.com"),
  archivedPlayer("Jasmine Munos", "Justin", "2030", "(623) 230-7998", "justinmunos1210@icloud.com"),
  archivedPlayer("Berklee Genewick", "Ashlee", "2030", "(480) 735-8336", "ashlee.genewick@gmail.com"),
  archivedPlayer("Loraina ONeill", "Shaylynn", "2031", "(206) 518-7780", "shaylynnmoneill@hotmail.com"),
  archivedPlayer("Cici Johnson", "Tiffany", "2031", "(480) 567-2011", "tifftjohnson07@gmail.com"),
  archivedPlayer("Emma Mathot", "Jen", "2031", "(919) 696-5132", "jmathot99@gmail.com"),
  archivedPlayer("Danielle Lee", "Dong", "2032", "(602) 412-7713", "Dongletruontrao@yahoo.com, daniellele1224@gmail.com"),
  archivedPlayer("Esther Pittulo", "Holly", "2032", "(520) 705-7760", "hpittullo@gmail.com"),
  archivedPlayer("Elizabeth Grothaus", "Vanessa", "2032", "(602) 293-6034", "vanessa.grothaus@gmail.com"),
  archivedPlayer("Blaire Munoz", "Kaitlin", "2032", "(575) 649-9038", "mukaitlin@gmail.com"),
  archivedPlayer("Valentina Moreno", "Marcela", "2028", "(602)489-1546", "marcelagarro@hotmail.com"),
  archivedPlayer("Brooke Farley", "Nicole", "2029", "(480) 241-6922", "nicolemariefarley@gmail.com"),
  archivedPlayer("Maddie Alday", "Tifany", "2029", "(480) 246-6571", "tstimsonxo@gmail.com"),
  archivedPlayer("Lylli Smith", "Tané Esparza Warner", "2029", "(480) 201-5485", ""),
  archivedPlayer("Naomi Barnett", "Kristin", "2027", "(623) 521-7145", "toodesertrats@gmail.com"),
  archivedPlayer("Tierra Christensen", "Thu Lan", "2027", " (480) 204-4914", "jt.christensen@hotmail.com"),
  archivedPlayer("Makayla Madison", "Britany", "2028", "(480) 438-2538", "bmadison21@outlook.com"),
  archivedPlayer("Taylor Gunter", "Tamara", "2029", "(775) 934-3148", "tlgunter@gmail.com"),
  archivedPlayer("Samirah Council", "Estelle", "2029", "(518) 505-8225", "estellecouncil@gmail.com"),
  archivedPlayer("Gibsyn Stanley", "Gretchen", "2029", "425-591-2295", "gdelusky@yahoo.com"),
  archivedPlayer("Sophie Lloyd", "Siew Looi Tang", "2030", "(602) 873-3372", "siewlloyd@gmail.com"),
  archivedPlayer("Kendall Fulcher", "Jeffery", "2034", "(703) 606-7192", "JFULCHER@VELOCITYSBA.COM"),
  archivedPlayer("Ria TWIN 1 Montelongo", "Katie Barrera", "2027", "(949) 521-3190", "katieb394@yahoo.com"),
  archivedPlayer("Rosaline TWIN 2 Montelongo", "Katie Barrera", "2027", "(949) 521-3190", "katieb394@yahoo.com"),
  archivedPlayer("Ryleigh Smith", "Cassie", "2027", "(580) 362-7606", "cassiehoshnic24@gmail.com"),
  archivedPlayer("Kaiya Galaviz", "Rebecca", "2027", "(480)369-9305", "beckyg@azfitnessrepair.com"),
  archivedPlayer("Taylor McGrath", "Jessica", "2027", "(602)618-5180", "jcmcgrath1@hotmail.com"),
  archivedPlayer("Rhia Slaughter", "Cassondra", "2027", "(520)678-7990", "cassondra.slaughter@gmail.com"),
  archivedPlayer("Jasmine Price", "Julie", "2027", "(203) 644-8627", "juliekprice@gmail.com"),
  archivedPlayer("Samhita Uppala", "Anil", "2027", "(480) 241-9283", "auppala@gmail.com"),
  archivedPlayer("Camryn Carrasco", "Jenny", "2027", "(480) 329-7310", "jennylcarrasco@gmail.com"),
  archivedPlayer("Georgia Boehne", "Robert", "2027", "(708) 415-5081", "rboehne@gmail.com"),
  archivedPlayer("Gabriella Duarte", "Julie", "2028", "(480) 236-3252", "duarte.julie@gmail.com"),
  archivedPlayer("Sadie Barraclough", "Stacy", "2029", "(602)818-2152", "sbarraclough621@gmail.com"),
  archivedPlayer("Sierra Anderson", "Danielle", "2029", "(480) 433-7040", "danikanderson@yahoo.com"),
  archivedPlayer("Lola McVea", "Shea", "2029", "(251) 228-0983", "smcvea@whirlwindgolf.com"),
  archivedPlayer("Alexandra Josepher", "Dora", "2029", "(949)584-3875", "dora@dorajosepher.com"),
  archivedPlayer("Lucija Jeras", "Melissa", "2030", "(480) 206- 8955", "mjeras@gmail.com"),
  archivedPlayer("Autumn Stubblefield", "Sarah", "2030", "(480) 422-4992", "stubblefields@gmail.com"),
  archivedPlayer("Sophia Stone", "Jason", "2031", "(602) 751-1116", "jkgstone@gmail.com, areding@porchlighthomes.com"),
  archivedPlayer("Millie Jacobs", "Amber", "2030", "(806) 290-7400", "amberj2@gmail.com"),
  archivedPlayer("Eva Mantyla", "Cassandra", "2031", "630-362-3535", "clmantyla@gmail.com"),
  archivedPlayer("Abby Klone", "", "", "", ""),
  archivedPlayer("Camdyn Cook", "Sarah", "2032", "(505) 414-8840", "smcook505@gmail.com"),
  archivedPlayer("Brielle St Marie", "Nicole", "2031", "(949)929-8947", "nicolestmarie3@gmail.com"),
  archivedPlayer("Quinn Giles", "Mallory", "2033", "(480)254-9987", "mallory.gi15@gmail.com"),
  archivedPlayer("Jack Wahl", "William", "2026", "(480)225-5515", "rwahl3@gmail.com"),
  archivedPlayer("Hannah Geigle", "Jill", "2026", "(480) 282-1418", "geiglehome@yahoo.com"),
  archivedPlayer("Arabela Curtis", "Nikaela", "2026", "(480)703-4781", "Nikaela.Curtis@gmail.com"),
  archivedPlayer("Charlotte Ramsey", "Mary", "2026", "(480) 612-5468", "mramsey14@me.com"),
  archivedPlayer("Elaina Hansen", "Darla", "2026", "(602) 677-3760", "hansenjeffdarla@yahoo.com"),
  archivedPlayer("Noelle Lott", "Gordon", "2026", "(323) 369-2164", "champprice@yahoo.com"),
  archivedPlayer("Anna King", "Michelle", "2026", "(480) 721-9249", "kingfamily04@msn.com"),
  archivedPlayer("Alexis Legoretta", "Aimee", "2026", "(623) 570-0970", "sajalegoretta@gmail.com"),
  archivedPlayer("Kali Salmon", "Kristine", "2026", "(480) 203-1565", "salmon0909@yahoo.com"),
  archivedPlayer("Eliana Esaa", "Jeannesse", "2026", "(407) 723-9788", "jeannessej@gmail.com"),
  archivedPlayer("Jasmin Williamson", "Vanesa", "2027", "(480) 277-9192", "vanessa.williamson52@gmail.com"),
  archivedPlayer("Kennedy Carey", "Chris", "2026", "(602) 363-8789", "ccsasco@gmail.com"),
  archivedPlayer("Danica Baluran", "Ethel", "2026", "(510) 931-9539", "preciousefc@gmail.com"),
  archivedPlayer("Kaylynn Moore", "Jamie", "2028", "(520)705-5917", "jamie.n.moore@hotmail.com"),
  archivedPlayer("Emma Scheels", "Meghan", "2026", "(503)800-8351", "mtscheels@netscape.net"),
  archivedPlayer("Lola Miller", "Billy", "2027", "(602) 380 2765", "billylloydmiller@gmail.com"),
  archivedPlayer("Maya Tokuz", "Yuksel", "2027", "(480) 401-8443", "ajtokuz@yahoo.com"),
  archivedPlayer("Lily Perez", "Ashley", "2027", "(602) 663-7335", "ashleydperez@yahoo.com"),
  archivedPlayer("Lily Pfister", "Rose", "2027", "(602) 350-9579", "haleopfister@gmail.com"),
  archivedPlayer("Daniella Rosales", "Daniel", "2027", "(480) 388-9936", "danjrose1574@gmail.com"),
  archivedPlayer("Madison Warren", "Heather", "2027", "(425) 210-1767", "heaz061198@gmail.com"),
  archivedPlayer("Surina Patel", "Vipul", "2027", "(480) 510-8500", "vipul.y.patel@gmail.com"),
  archivedPlayer("Avary Christensen", "Jae", "2027", "(480)225-4132", "jae_diann@yahoo.com"),
  archivedPlayer("Cyndi Sandry", "Andrea", "2027", "(602) 531-1965", "sandryfam@gmail.com"),
  archivedPlayer("Brooklyn Allen", "Adriana", "2027", "(575) 545-1970", "adrianarallen@gmail.com"),
  archivedPlayer("Lillie Paszek", "Ann", "2027", "(608) 852-6340", "thepaszeks@gmail.com"),
  archivedPlayer("Marcela Garro", "Marcela", "2028", "(602)489-1546", "marcelagarro@hotmail.com"),
  archivedPlayer("Peyton Messer", "Melanie", "2027", "(480) 459-0851", "pricemelanie18@gmail.com"),
  archivedPlayer("Ella Shoap", "Lisa", "2027", "(585) 314-2912", "lisa.shoap@gmail.com"),
  archivedPlayer("Cassandra Maggio", "Cynthia", "2027", "(858) 243-5718", "cynthia_maggio@yahoo.com"),
  archivedPlayer("Ella Broadway", "Jessica", "2027", "(602) 741-1247", "jesscrawford27@gmail.com"),
  archivedPlayer("Cara Dunnigan", "Elizabeth", "2027", "(503) 332-0621", "liz.dunnigan@gmail.com"),
  archivedPlayer("Annie Riggs", "Lindsay", "2027", "(480) 694-6713", "riggsfam@gmail.com"),
  archivedPlayer("Lyla Hamlin", "Shane", "2027", "(602) 628-7423", "shane.hamlin@cox.net"),
  archivedPlayer("Julia Frey", "Sydney", "2028", "(480)326-7891", "sydneywfrey@gmail.com"),
  archivedPlayer("Pranjal Mishra", "Awanish", "2027", "(480) 560-7064", "awanish.mishra@gmail.com"),
  archivedPlayer("Jezrie Cons", "Anthony", "2027", "(623) 251-1606", "acons23@yahoo.com"),
  archivedPlayer("Hannah VanMeter", "Amanda VanMeter", "2026", "(480) 544-8991", "amandavanmeter15@gmail.com"),
  archivedPlayer("Hannah Cardon", "Reanna", "2028", "(480) 316-4154", "raeannac@gmail.com"),
  archivedPlayer("Kate Kriese", "Amanda", "2028", "(480) 280-3991", "ackriese@gmail.com"),
  archivedPlayer("Kolona Tuipulotu", "Marie", "2028", "(480) 862-5069", "mekaihau@gmail.com"),
  archivedPlayer("Zoe Holder", "Jarred", "2028", "(209) 401-2910", "holding_glory@yahoo.com"),
  archivedPlayer("Flynn McCleland", "Kristen", "2028", "", "ksolsrud@hotmail.com"),
  archivedPlayer("Kalli Freeborn", "Mallory", "2028", "(480) 329-7601", "mallory797@hotmail.com"),
  archivedPlayer("Maja Peterson", "Daniel", "2028", "(480) 578-3086", "peda0502@gmail.com"),
  archivedPlayer("Kenydi Bee", "Tanecia", "2028", "(602) 295-7555", "tkwise1@yahoo.com"),
  archivedPlayer("Jette Heldenbrand", "Natalie Heldenbrand", "2028", "(602) 315-8055", "nat.heldenbrand@gmail.com"),
  archivedPlayer("Bren Sarca", "Septimiu", "2028", "(480) 363-5665", "septimiusarca@gmail.com"),
  archivedPlayer("9th Téa", "Joseph", "2027", "(602) 228-8387", "Jrobcherry@msn.com, butterflyrose76@msn.com"),
  archivedPlayer("Allysen Kirkland", "Leesa Kirkland", "2028", "(602) 469-5382", "leesakirkland@gmail.com"),
  archivedPlayer("Elizabeth Uram", "Lana Larson", "2028", "(702) 419-6172", "lanalarson83@gmail.com"),
  archivedPlayer("Adriana Rivera", "Michael", "2027", "(480) 458-7687", "Michaelrivera013@yahoo.com"),
  archivedPlayer("aa Kalvin", "Leann", "2028", "(602)330-2496", "leann.cork@gmail.com"),
  archivedPlayer("9th Alexia", "Mariana", "2028", "(978) 886-3946", "marianaski@gmail.com"),
  archivedPlayer("Teagan Glynn", "Ryan", "2028", "(602) 793-1910", "ryanglynn1122@gmail.com"),
  archivedPlayer("9th Macie", "Patrice", "2028", "(602) 750-8673", "patriceopacki@yahoo.com"),
  archivedPlayer("Sydney Rahimi", "Yasmin", "2028", "(602)828-1854", "dryasmin@backfithealth.com"),
  archivedPlayer("BEG Katy", "Holly", "2028", "(480) 247-6800", "4missalls@gmail.com"),
  archivedPlayer("Brinley Ferguson", "Kristina", "2028", "(309) 261-6510", "ferguson_kristina@cat.com"),
  archivedPlayer("Drew Hollister", "", "", "", ""),
  archivedPlayer("Keona Neals", "Jessica Anderson", "2028", "(520) 610-8001", "jessicasanderson4742@gmail.com"),
  archivedPlayer("Lilyana Worden", "Steven", "2028", "(480) 529-7752", "2water@gmail.com"),
  archivedPlayer("Peyton Avery", "Tiffany", "2028", "(707) 410-9208", "averykids2616@outlook.com"),
  archivedPlayer("Lowell Baudouin IV", "Lowell III", "2028", "(480) 625-2008", "baudphx@gmail.com"),
  archivedPlayer("Charlette Parent", "Ali", "2029", "(520)289-3112", "dnaparent7879@outlook.com"),
  archivedPlayer("Bodhi Burckhard", "Jessica", "2028", "(914) 489-7013", "drburckhard@gmail.com"),
  archivedPlayer("Brinley Cole", "Alexis", "2029", "(480) 229-7707", "alexismaluf@hotmail.com"),
  archivedPlayer("Rylie Green", "Monica", "2029", "(602) 697-7688", "green.monica11@gmail.com"),
  archivedPlayer("Cassidy Myers", "Kelly", "2029", "(480) 440-6457", "kmm3853854@outlook.com"),
  archivedPlayer("Alexandria Scott", "Tonya", "2028", "(602) 909-0438", "tonyawhiting@gmail.com"),
  archivedPlayer("Faith Geigle", "Jill", "2029", "(480) 282-1418", "geiglehome@yahoo.com"),
  archivedPlayer("Anna Lammie Beaumont", "Andrea", "2030", "(480) 559-4987", "acele7@yahoo.com"),
  archivedPlayer("Olivia Padilla", "Bessie", "2030", "(520)940-2764", "bepadilla01@gmail.com"),
  archivedPlayer("Brie Angstead", "Celena", "2028", "(480) 236-0759", "CAngstead@icloud.com"),
  archivedPlayer("Clayton Larson", "", "", "", ""),
  archivedPlayer("Cecily Nelson", "Rebecca", "2029", "(480) 353-7200", "rebeccabarry@mac.com"),
  archivedPlayer("Chloe Gump", "Sarah", "2029", "(480) 294-1603", "sarahegump@yahoo.com"),
  archivedPlayer("Ellie Stefll", "Karen", "2029", "(480) 528-3717", "karenstefl2@gmail.com"),
  archivedPlayer("Gwen Hammond", "Michelle", "2028", "(480) 993-8980", "michellerhammond@yahoo.com"),
  archivedPlayer("Sophia Taylor", "John", "2029", "(623)806-5739", "johnkyletaylor@gmail.com"),
  archivedPlayer("Kamilah Mora", "Xiomara Mora", "2029", "(480) 262-6420", "sunsetxio20@gmail.com"),
  archivedPlayer("Braelyn Dunn", "Jody", "2029", "(480) 221-7187", "jodycorah@gmail.com"),
  archivedPlayer("Isabella Meagher", "Jennifer", "2029", "(602) 643-9589", "jmeagher21.jm@gmail.com"),
  archivedPlayer("Ophelia Tadman", "Ellen", "2029", "(480) 23-1264", "ELLEN.TADMAN@GMAIL.COM"),
  archivedPlayer("Mia Moss", "Leyla", "2028", "(480) 262-2448", "leylapanderson@gmail.com"),
  archivedPlayer("Rylee Lai", "Elea Lai", "2029", "(585) 317-2013", "Elea.lai@gmail.com"),
  archivedPlayer("Abigail Hamernick", "Anna Hamernick", "2029", "(480) 577-4654", "ajc06262000@yahoo.com"),
  archivedPlayer("Peytan Tamlyn", "Julie", "2029", "(312) 560-5386", "jmtamlyn@gmail.com"),
  archivedPlayer("Kendyl Leal", "Ashley", "2029", "(480) 993-5529", "ashleyleal55@gmail.com"),
  archivedPlayer("Keirra Thelen", "Jesy", "2030", "(480) 522-9732", "jesy.t@studiodwell.net"),
  archivedPlayer("Elaina McClurg", "Sharolyn", "2029", "(480) 861-2780", "shari.mcclurg@gmail.com"),
  archivedPlayer("Giana Moore", "Amanda", "2030", "(317)645-8788", "amandamoorefitcrew@gmail.com"),
  archivedPlayer("Gianna Funseth", "Nicole", "2030", "(480) 628-8449", "ngreco83@hotmail.com"),
  archivedPlayer("Olivia Malabanan", "Joy", "2030", "(847)388-6804", "geo.malabanan@gmail.com"),
  archivedPlayer("Khensi Whiting", "Trevor", "2030", "(480) 250-6568", "trevorwhiting21@gmail.com"),
  archivedPlayer("Daisy Owens", "Audra", "2030", "(480) 855-5866", "owensteacheremails@gmail.com"),
  archivedPlayer("7TH Jeannie", "Amber", "2030", "(623) 341-4549", "amberchavezaj@gmail.com"),
  archivedPlayer("Liyah Bland", "Fallon", "2030", "(915) 886-8241", "fallon.mertens@gmail.com"),
  archivedPlayer("Kayla Kyger", "Mark", "2030", "(303)589-9742", "mark.kyger@asu.edu"),
  archivedPlayer("Vivienne Endicott", "John", "2030", "(480) 203-6590", "jendo15@hotmail.com"),
  archivedPlayer("Delilah Doughty", "Erin", "2030", "(480)540-3225", "erindoughty@me.com"),
  archivedPlayer("Olivia Svendson", "Noel", "2030", "(602) 425-7633", "svendson.family@gmail.com"),
  archivedPlayer("Avery Sanders", "Dana", "2030", "(480) 244-9630", "dana.sanders@live.com"),
  archivedPlayer("Lyeron Loessberg", "Deseron", "2031", "(916) 801-0799", "dloessberg@gmail.com"),
  archivedPlayer("Brynn Keener", "Morgan", "2029", "(480)243-0656", "keenerms13@gmail.com"),
  archivedPlayer("Presley Cole", "Alexis", "2031", "(480) 229-7707", "alexismaluf@hotmail.com"),
  archivedPlayer("Cameron Auth", "Devon", "2031", "(602)703-7912", "devonauth@yahoo.com"),
  archivedPlayer("Kennadi Kellar", "Debbie", "2030", "(602)750-2457", "dkellar17@yahoo.com"),
  archivedPlayer("Alyssa Moore", "Jackie", "2031", "(602) 762-8414", "Jallison26@gmail.com"),
  archivedPlayer("Brooklyn Dingman", "Krista", "2031", "(602 909- 7906", "peep79er@gmail.com"),
  archivedPlayer("Karolina Blackledge", "John", "2031", "(917) 207-0055", "jblackledge50@hotmail.com"),
  archivedPlayer("Reese Marchwick", "Christopher", "2031", "(602) 743-9074", "cmarchwick@gmail.com"),
  archivedPlayer("Nola Young", "Kristin", "2031", "(480) 678-1611", "kristn_young@yahoo.com"),
  archivedPlayer("Harlow Caswell", "Angie", "2030", "(602) 791-1819", "angie.caswell@gmail.com"),
  archivedPlayer("Kinsley Wylie", "Sarah", "2031", "(602)481-6769", "saraharnold84@yahoo.com"),
  archivedPlayer("Kaytie Kellar", "Debbie", "2031", "(602)750-2457", "dkellar17@yahoo.com"),
  archivedPlayer("Charolette Medina-Contreras", "Marianna", "2031", "(602) 425-8043", "arq.mariannagaribaldi@gmail.com"),
  archivedPlayer("Cole Marchwick", "Christopher", "2033", "(602) 743-9074", "cmarchwick@gmail.com"),
  archivedPlayer("Presley Redder", "Timm", "2029", "(313)623-2098", "tiredder@gmail.com"),
  archivedPlayer("Lexi Richtsteig", "Bridget", "2027", "(480) 601-3981", "lexiar3168@icloud.com"),
  archivedPlayer("Addy Carey", "Chris", "2028", "(602) 363-8789", "ccsasco@gmail.com"),
  archivedPlayer("Sadie Palmer", "", "", "", ""),
  archivedPlayer("ViVi Clark", "Larissa Leao", "2031", "(480) 606-8987", "larissahleao@gmail.com"),
  archivedPlayer("Kenley Chai", "Krystina", "2031", "(602) 369-6548", "krystina114@gmail.com, Diron.Chai@gmail.com"),
  archivedPlayer("Iliana Toraya", "Michelle Amatangelo Toraya", "2029", "(480) 200-8367", "mamatangelo@msn.com"),
  archivedPlayer("9th Amelia", "Camille/Stu", "2028", "(208) 699-6091", "kauffmance@me.com"),
  archivedPlayer("Adalyn Miller", "Justus", "2027", "(480) 510-3097", "justusmiller05@gmail.com"),
  archivedPlayer("Reese Watkins", "Launa", "2028", "(480) 321-5593", "launawatkins@yahoo.com"),
  archivedPlayer("Maddie Cowley", "Jane", "2027", "(480) 618-6512", "cowleyrocks@q.com"),
  archivedPlayer("Alexis Kemeliotis", "Stefanie", "2026", "(480) 567-5147", "sw8sw7@gmail.com"),
  archivedPlayer("Sydney Wade", "Lisa", "2025", "(480) 205-9173", "lawade@me.com"),
  archivedPlayer("Quito Gonzalez", "Roque", "2025", "(956) 459-6567", "roqueg31@gmail.com"),
  archivedPlayer("Mackenna Stearman", "Mandy", "2025", "(480) 560-8597", "misssmgmack@hotmail.com"),
  archivedPlayer("Medha Chiruvolu", "Praveena Chiruvolu", "2025", "(732) 429-0395", "prakum02@gmail.com"),
  archivedPlayer("Jeslyn Dockter", "Hannah", "2025", "(435) 773-1565", "hdockter@gmail.com"),
  archivedPlayer("Luke Meyers", "Rita", "2025", "(480) 206-1151", "ptrita@cox.net"),
  archivedPlayer("Audrey Malone", "Cali", "2025", "(913) 660-5890", "cali.malone@gmail.com"),
  archivedPlayer("Grace Gardner", "Rebecca", "2025", "(801) 879-1980", "rebecgardner@yahoo.com"),
  archivedPlayer("Olivia Romesburg", "Kristin", "2025", "(602) 741-5966", "kromesburg@hotmail.com"),
  archivedPlayer("Ava Titcomb", "Jeanette", "2025", "(385) 248-1014", "jfougeron@bfwpub.com"),
  archivedPlayer("Mia Hutchinson", "Anika", "2025", "(480) 459-6887", "anika.hutchinson79@gmail.com"),
  archivedPlayer("Emily Rogers", "Laura", "2025", "(480) 209-9066", "laura444@cox.net"),
  archivedPlayer("Jonas Theriot", "Monica", "2026", "(480) 570-5906", "birdytheriot@gmail.com"),
];

const CALENDAR = [{"date": "2026-08-03", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "August"}, {"date": "2026-08-04", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "August"}, {"date": "2026-08-05", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "August"}, {"date": "2026-08-06", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "August"}, {"date": "2026-08-10", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "August"}, {"date": "2026-08-11", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "August"}, {"date": "2026-08-12", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "August"}, {"date": "2026-08-13", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "August"}, {"date": "2026-08-17", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "August"}, {"date": "2026-08-18", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "August"}, {"date": "2026-08-19", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "August"}, {"date": "2026-08-20", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "August"}, {"date": "2026-08-24", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "August"}, {"date": "2026-08-25", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "August"}, {"date": "2026-08-26", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "August"}, {"date": "2026-08-27", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "August"}, {"date": "2026-08-31", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "September"}, {"date": "2026-09-01", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "September"}, {"date": "2026-09-02", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "September"}, {"date": "2026-09-03", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "September"}, {"date": "2026-09-07", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "September"}, {"date": "2026-09-08", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "September"}, {"date": "2026-09-09", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "September"}, {"date": "2026-09-10", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "September"}, {"date": "2026-09-14", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "September"}, {"date": "2026-09-15", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "September"}, {"date": "2026-09-16", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "September"}, {"date": "2026-09-17", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "September"}, {"date": "2026-09-21", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "September"}, {"date": "2026-09-22", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "September"}, {"date": "2026-09-23", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "September"}, {"date": "2026-09-24", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "September"}, {"date": "2026-09-28", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "October"}, {"date": "2026-09-29", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "October"}, {"date": "2026-09-30", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "October"}, {"date": "2026-10-01", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "October"}, {"date": "2026-10-05", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "October"}, {"date": "2026-10-06", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "October"}, {"date": "2026-10-07", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "October"}, {"date": "2026-10-08", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "October"}, {"date": "2026-10-12", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "October"}, {"date": "2026-10-13", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "October"}, {"date": "2026-10-14", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "October"}, {"date": "2026-10-15", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "October"}, {"date": "2026-10-19", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "October"}, {"date": "2026-10-20", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "October"}, {"date": "2026-10-21", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "October"}, {"date": "2026-10-22", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "October"}, {"date": "2026-10-26", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "November"}, {"date": "2026-10-27", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 1 - Intro", "month": "November"}, {"date": "2026-10-28", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "November"}, {"date": "2026-10-29", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 1 - Intro", "month": "November"}, {"date": "2026-11-02", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "November"}, {"date": "2026-11-03", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 2 - Build", "month": "November"}, {"date": "2026-11-04", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "November"}, {"date": "2026-11-05", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 2 - Build", "month": "November"}, {"date": "2026-11-09", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "November"}, {"date": "2026-11-10", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 3 - Pressure", "month": "November"}, {"date": "2026-11-11", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "November"}, {"date": "2026-11-12", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 3 - Pressure", "month": "November"}, {"date": "2026-11-16", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "November"}, {"date": "2026-11-17", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Week 4 - Eval", "month": "November"}, {"date": "2026-11-18", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "November"}, {"date": "2026-11-19", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Week 4 - Eval", "month": "November"}, {"date": "2026-11-30", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Review Week 1", "month": "December"}, {"date": "2026-12-01", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Review Week 1", "month": "December"}, {"date": "2026-12-02", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Review Week 1", "month": "December"}, {"date": "2026-12-03", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Review Week 1", "month": "December"}, {"date": "2026-12-07", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Review Week 2", "month": "December"}, {"date": "2026-12-08", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Review Week 2", "month": "December"}, {"date": "2026-12-09", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Review Week 2", "month": "December"}, {"date": "2026-12-10", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Review Week 2", "month": "December"}, {"date": "2026-12-14", "weekday": "Monday", "team": "Monday/Wednesday Team", "dayType": "Day 1", "weekLabel": "Review Week 3", "month": "December"}, {"date": "2026-12-15", "weekday": "Tuesday", "team": "Tuesday/Thursday Team", "dayType": "Day 1", "weekLabel": "Review Week 3", "month": "December"}, {"date": "2026-12-16", "weekday": "Wednesday", "team": "Monday/Wednesday Team", "dayType": "Day 2", "weekLabel": "Review Week 3", "month": "December"}, {"date": "2026-12-17", "weekday": "Thursday", "team": "Tuesday/Thursday Team", "dayType": "Day 2", "weekLabel": "Review Week 3", "month": "December"}, {"date": "2026-12-28", "weekday": "Monday", "team": "All Teams", "dayType": "Camp", "weekLabel": "Week 4 - Camp (Camp Day 1)", "month": "December"}, {"date": "2026-12-29", "weekday": "Tuesday", "team": "All Teams", "dayType": "Camp", "weekLabel": "Week 4 - Camp (Camp Day 2)", "month": "December"}, {"date": "2026-12-30", "weekday": "Wednesday", "team": "All Teams", "dayType": "Camp", "weekLabel": "Week 4 - Camp (Camp Day 3)", "month": "December"}, {"date": "2026-12-31", "weekday": "Thursday", "team": "All Teams", "dayType": "Camp", "weekLabel": "Week 4 - Camp (Camp Day 4)", "month": "December"}];

const DAY1_CURRICULUM = {"August": {"Week 1 - Intro": {"title": "Serving - Standing Float Serve", "plan": "Warm-up: light toss/catch, shoulder activation. Main: Standing Float Serve technique - toss placement in front of body, flat contact above ball's middle, body rotation into swing. Target Practice serving to 4 zones (deep line/deep middle/short line/short middle). Reinforce: aggressive serve mindset, attacking the line with power.", "notePrompt": "Baseline toss consistency and contact quality - not yet graded, coach notes only."}, "Week 2 - Build": {"title": "Serving - Add Jump Float + Location Calls", "plan": "Warm-up: dynamic movement, arm circles. Main: Jump Float Serve intro (two-hand toss, approach timing, flat/controlled contact). Target Practice with called zones (coach or partner calls zone before serve). Server vs. Passer live reps. Reinforce: short serve to end line/middle, ready for 1-2 over.", "notePrompt": "Coach tracks % of serves landing in called zone - informal."}, "Week 3 - Pressure": {"title": "Serving - Add Topspin Jump Serve + Competition", "plan": "Warm-up: approach footwork reps (no ball). Main: Jump Serve (topspin) for Intermediate/Advanced - toss focus first, high contact, up-and-over swing. Beginners continue Jump Float refinement. Horse (serve-calling competition game). 1-on-1 Serving. Reinforce: changing up serve, attacking a player who is making mistakes.", "notePrompt": "Coach notes which serve type each athlete is competing with (standing/jump float/jump topspin)."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Serving", "plan": "Warm-up: full serve-type warm-up (athlete's choice of type). Main: Evaluation format - each athlete serves 10 balls to called zones (mix of deep/short/line/middle), coach scores accuracy + serve type/tier on rubric. Follow with Money Ball scoring game using only serving points. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Serve accuracy to called zone (rubric 1-4) + Serve type/tier achieved (Standing Float / Jump Float / Jump Topspin)."}}, "September": {"Week 1 - Intro": {"title": "Defense/Blocking - Fundamentals", "plan": "Warm-up: lateral shuffle, low-stance holds. Main: Beginner blocking (hand/feet placement, loading/jumping, hands in front). Blocking Lines footwork drill (shuffle only, no crossover). Base defense positioning intro - line block (1 finger) / angle block (2 fingers) calls.", "notePrompt": "Baseline blocking footwork and hand position - coach notes only."}, "Week 2 - Build": {"title": "Defense/Blocking - Reads and Transitions", "plan": "Warm-up: Blocking Lines with jump timing added. Main: Dropping Drill (blocker-to-defender transition, getting balanced before attacker contact). Intermediate blocking footwork. Reading setter for back-arm swing / option ball.", "notePrompt": "Coach tracks blocker-to-defense transition speed."}, "Week 3 - Pressure": {"title": "Defense/Blocking - Live Pressure", "plan": "Warm-up: reactive block/dig transitions. Main: Live Hard Digs (hitters attacking live, defenders digging full speed). Advanced blocking (penetrate, redirect, joust) for ready athletes. King of the Court emphasizing side-out via blocking/defense.", "notePrompt": "Coach notes defensive reads and recovery under live pace."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Defense/Blocking", "plan": "Warm-up: full blocking/defense warm-up. Main: Evaluation format - live blocking reps scored on footwork/hand technique/timing, plus live defensive reps scored on positioning and read. Follow with situational scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Blocking technique (footwork/hands/timing, rubric 1-4) + Defensive positioning & reads (rubric 1-4)."}}, "October": {"Week 1 - Intro": {"title": "Shots - Fundamentals (Pass to Location)", "plan": "Warm-up: ball control juggle (2 ball). Main: Beginner shots - pass to location: high line, high cross, short line/cross, deep middle (seam). Shots Around the World progression.", "notePrompt": "Baseline shot placement from a controlled pass - coach notes only."}, "Week 2 - Build": {"title": "Shots - Standing Overhead to Location", "plan": "Warm-up: target practice hitting. Main: Intermediate shots (standing overhead hit to location, same 5 targets). Reinforce consistent approach look regardless of shot selected.", "notePrompt": "Coach tracks placement accuracy from standing overhead contact."}, "Week 3 - Pressure": {"title": "Shots - Jump Attack to Location + Competition", "plan": "Warm-up: approach footwork reps. Main: Advanced shots (jump attacking to location, same 5 targets). Competitive shot-placement game (Money Ball with bonus for called-zone kill).", "notePrompt": "Coach notes shot selection quality under live pressure."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Shots", "plan": "Warm-up: full hitting warm-up. Main: Evaluation format - each athlete hits to 5 called zones at their tier (pass-to-location/standing/jump), scored on accuracy and consistency. Follow with situational scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Shot placement accuracy by tier (rubric 1-4) + Consistency across attempts (rubric 1-4)."}}, "November": {"Week 1 - Intro": {"title": "Setting - Fundamentals", "plan": "Warm-up: Chest Pass technique (arms away from body, 45-degree angle). Main: Beginner setting (pass to self/bump set, using legs, apex trajectory).", "notePrompt": "Baseline setting technique - coach notes only."}, "Week 2 - Build": {"title": "Setting - Spacing and Combo", "plan": "Warm-up: Ball Balance partner drill. Main: Intermediate setting (spacing from passer, point of hesitation, body angle/line of set). Pass Set Triangle (double set) - first set, reset, second set.", "notePrompt": "Coach tracks spacing and release timing."}, "Week 3 - Pressure": {"title": "Setting - Advanced Tempo", "plan": "Warm-up: footwork into set position. Main: Advanced setting (hitter's window/flow, outside/back/tempo sets). Wash Drill incorporating live sets under scoring pressure.", "notePrompt": "Coach notes tempo control and set variety under pressure."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Setting", "plan": "Warm-up: full setting warm-up across set types. Main: Evaluation format - each athlete runs option balls, 1's, 2's, and back sets, scored on consistency and placement. Follow with situational scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Setting consistency/placement across set types (rubric 1-4)."}}, "December": {"Review Week 1": {"title": "Review Circuit A - Serving/Serve Receive + Defense/Blocking", "plan": "Station rotation: (1) Serve location refresh + Target Practice, (2) Serve receive footwork refresh, (3) Blocking Lines + base defense refresh. Close with a short recovery/self-care talk (stretching, sleep, hydration basics).", "notePrompt": "No new formal eval - coach notes any athlete needing a specific focus heading into camp."}, "Review Week 2": {"title": "Review Circuit B - Shots/Court Vision + Setting/Hitting", "plan": "Station rotation: (1) Shot placement refresh, (2) Court vision/communication refresh, (3) Setting and hitting mechanics refresh. Mental Performance check-in: revisit November goal-setting worksheets, adjust for January.", "notePrompt": "No new formal eval - Season Readiness Check informs camp grouping and January planning."}, "Review Week 3": {"title": "Review Circuit C - Full Integration + Season Readiness", "plan": "Station rotation touching all 8 skills briefly, then a full situational scrimmage combining everything reviewed across the 3 weeks. Coaches finalize Season Readiness Check notes (holistic 1-4 across all 8 skills) to inform camp grouping and January planning.", "notePrompt": "Season Readiness Check finalized - not a graded eval, feeds camp grouping and January's spotlight adjustments."}, "Camp": {"title": "Camp Days 1-2: All-Skill Combine + Competitive Scrimmage", "plan": "Camp Day 1 (Mon, Dec 28) - All-Skill Combine: rotating stations touching all 8 skills at a fun, high-energy pace - a reset after the holiday break, not new teaching. Camp Day 2 (Tue, Dec 29) - Competitive Scrimmage Day: full game-play formats (King of the Court, Wash Drill, Money Ball) mixing training teams together.", "notePrompt": "No graded eval this week - camp closes out the fall season."}}};

const DAY2_CURRICULUM = {"August": {"Week 1 - Intro": {"title": "Serve Receive - Fundamentals", "plan": "Warm-up: platform presentation reps, partner toss-to-platform. Main: Serve receive fundamentals - stay low, watch ball to platform, lift with legs not arms, know passing zone/height. Passing Short Serve and Passing Deep Serve technique stations (different footwork/angle for each).", "notePrompt": "Baseline platform/footwork technique - coach notes only."}, "Week 2 - Build": {"title": "Serve Receive - Combo Work", "plan": "Warm-up: W Passing Drill / Quick Feet Passing. Main: Two Ball Triangle Pass (receive serve to target, then play a second free ball). Serve Receive (full pass-set-spike combo with a partner). Reinforce: contact outside body, open hips for over-the-shoulder serves.", "notePrompt": "Coach tracks target-zone consistency across combo reps."}, "Week 3 - Pressure": {"title": "Serve Receive - Under Fire", "plan": "Warm-up: reaction/footwork ladder. Main: Pass a Bomb (receiving heavy topspin serve from elevated position - stay relaxed, weight forward). Work on 2 (short serve reception set up specifically to finish on the 2nd contact). Server vs. Passer live competitive reps.", "notePrompt": "Coach notes composure/control against high-pace serves."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Serve Receive", "plan": "Warm-up: full passing warm-up, both short and deep serve reps. Main: Evaluation format - each athlete receives 10 live serves (mixed types/zones from coaches or teammates), scored on target-zone accuracy and technique (platform, footwork, balance). Follow with situational serve-receive-to-attack scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Passing accuracy to target zone (rubric 1-4) + Technique rating (platform/footwork/balance)."}}, "September": {"Week 1 - Intro": {"title": "Transitioning - Fundamentals", "plan": "Warm-up: quick-direction sprints. Main: Transition to base defense after the set (fundamentals). Split blocking basics.", "notePrompt": "Baseline transition speed/positioning - coach notes only."}, "Week 2 - Build": {"title": "Transitioning - Combo Work", "plan": "Warm-up: Superman Game (scramble digging into a live rally). Main: Blocker transition setting. Passer transition attacking off short digs.", "notePrompt": "Coach tracks transition-to-attack execution."}, "Week 3 - Pressure": {"title": "Transitioning - Live Pressure", "plan": "Warm-up: fast-paced footwork circuit. Main: Off Net Wash Drill (bonus-ball transition under scoring pressure). Live transition scrimmage reps.", "notePrompt": "Coach notes transition speed and decision-making under fatigue."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Transitioning", "plan": "Warm-up: full transition warm-up. Main: Evaluation format - live reps scored on speed to base defense and transition attack execution. Follow with situational scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Transition speed (rubric 1-4) + Transition attack/set execution (rubric 1-4)."}}, "October": {"Week 1 - Intro": {"title": "Court Vision - Fundamentals", "plan": "Warm-up: beginner passing to self with height. Main: Beginner passing + call-out practice (say the coach's number/zone before passing over). Introduce communication vocabulary (blocker up / no one / set inside / quick).", "notePrompt": "Baseline communication habits - coach notes only."}, "Week 2 - Build": {"title": "Court Vision - Reading the Defense", "plan": "Warm-up: intermediate passing footwork. Main: Intermediate passing + court vision (reading blocker peel, calling short line/seam based on defense). Look Call Drill (setter reads defense, makes a committed call).", "notePrompt": "Coach tracks call accuracy and timing."}, "Week 3 - Pressure": {"title": "Court Vision - Live Reads", "plan": "Warm-up: advanced passing angles. Main: Advanced passing/vision (angle of pass vs. angle of serve, in/out of body). Live scrimmage requiring a call on every contact; Money Ball with a communication bonus/penalty twist.", "notePrompt": "Coach notes read accuracy and consistency of calls under pressure."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Court Vision", "plan": "Warm-up: full communication/passing warm-up. Main: Evaluation format - live scrimmage scored on calls made, correct reads, and communication consistency. Follow with situational scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Communication/calls made (rubric 1-4) + Read accuracy (rubric 1-4)."}}, "November": {"Week 1 - Intro": {"title": "Hitting/Arm Swing - Fundamentals", "plan": "Warm-up: Spike Approach Footwork isolated reps (no ball). Main: Beginner hitting (arm-ready position, elbow above ear, swing shape - same pocket/middle/opposite pocket).", "notePrompt": "Baseline approach footwork and swing shape - coach notes only."}, "Week 2 - Build": {"title": "Hitting/Arm Swing - Approach and Shape", "plan": "Warm-up: Spiking Line (approach timing off a live set). Main: Intermediate hitting (transition spacing, point of hesitation, thumb-up shaping).", "notePrompt": "Coach tracks approach timing and hand-angle shaping."}, "Week 3 - Pressure": {"title": "Hitting/Arm Swing - Live Pressure", "plan": "Warm-up: full approach + arm swing warm-up. Main: Advanced hitting (pass-recognition transitions, in/out-of-system approaches). Live Hard Digs paired against hitters. Big Team Game or Baseball Game for competitive reps.", "notePrompt": "Coach notes shot execution and decision-making under live defense."}, "Week 4 - Eval": {"title": "MONTHLY EVALUATION - Hitting/Arm Swing", "plan": "Warm-up: full hitting warm-up. Main: Evaluation format - live hitting reps scored on approach footwork, swing mechanics, and shot execution. Follow with situational scrimmage. Wrap: log evaluation scores in app.", "notePrompt": "FORMAL EVAL: Approach footwork & swing mechanics (rubric 1-4) + Shot execution under live defense (rubric 1-4)."}}, "December": {"Review Week 1": {"title": "Review Circuit A (continued) - Transitioning + Serve Receive", "plan": "Station rotation: (1) Transition footwork refresh, (2) Passing short/deep serve refresh, (3) Situational mini-scrimmage combining both. Recovery/self-care talk continued from Day 1.", "notePrompt": "No new formal eval."}, "Review Week 2": {"title": "Review Circuit B (continued) - Hitting + Court Vision", "plan": "Station rotation: (1) Approach/swing refresh, (2) Communication/vision refresh, (3) Situational mini-scrimmage combining both. Mental Performance check-in continued.", "notePrompt": "No new formal eval - Season Readiness Check finalized."}, "Review Week 3": {"title": "Review Circuit C (continued) - Full Integration", "plan": "Station rotation continued from Day 1, focused on whatever gaps Day 1's stations revealed. Close with team goal-setting for the January-July stretch, tying back to November's Mental Performance Workshop.", "notePrompt": "Season Readiness Check finalized (Day 2 half)."}, "Camp": {"title": "Camp Days 3-4: Mental Performance + Team Culture Wrap-Up", "plan": "Camp Day 3 (Wed, Dec 30) - Mental Performance + Goal Setting: review the fall season, set individual and team goals for January-July, light optional skill work. Camp Day 4 (Thu, Dec 31) - Team Culture + Wrap-Up: team-building games, awards/recognition, light skill work, and a preview of January's spotlight (Serving & Serve Receive, 2nd pass).", "notePrompt": "No graded eval this week - sets up January's spotlight."}}};

const DEFAULT_EVAL_RUBRIC = {"August": [{"skillArea": "Serving", "criteria": "Serve accuracy to called zone", "scale": "1 = Rarely finds zone | 2 = Finds zone under low pressure | 3 = Consistently finds zone live | 4 = Finds zone + disrupts opponent system"}, {"skillArea": "Serving", "criteria": "Serve type/tier achieved", "scale": "1 = Underhand/basic | 2 = Standing Float | 3 = Jump Float | 4 = Jump Topspin"}, {"skillArea": "Serve Receive", "criteria": "Passing accuracy to target", "scale": "1 = Rarely on target | 2 = On target vs. easy serves | 3 = On target vs. live serves | 4 = On target vs. aggressive/jump serves"}, {"skillArea": "Serve Receive", "criteria": "Technique (platform/footwork/balance)", "scale": "1 = Inconsistent | 2 = Developing | 3 = Consistent | 4 = Reliable under pressure"}], "September": [{"skillArea": "Defense/Blocking", "criteria": "Blocking technique (footwork/hands/timing)", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Defense/Blocking", "criteria": "Defensive positioning & reads", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Transitioning", "criteria": "Transition speed to base defense", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Transitioning", "criteria": "Transition attack/set execution", "scale": "1-4 scale, Emerging to Advanced"}], "October": [{"skillArea": "Shots", "criteria": "Shot placement accuracy by tier", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Shots", "criteria": "Consistency across attempts", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Court Vision", "criteria": "Communication/calls made", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Court Vision", "criteria": "Read accuracy", "scale": "1-4 scale, Emerging to Advanced"}], "November": [{"skillArea": "Setting", "criteria": "Consistency/placement across set types", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Hitting/Arm Swing", "criteria": "Approach footwork & swing mechanics", "scale": "1-4 scale, Emerging to Advanced"}, {"skillArea": "Hitting/Arm Swing", "criteria": "Shot execution under live defense", "scale": "1-4 scale, Emerging to Advanced"}], "December": [{"skillArea": "All Skills", "criteria": "Season Readiness Check (holistic)", "scale": "1-4 scale across all 8 skills - informs camp grouping and January planning, not a graded eval"}]};

const DAY3_CURRICULUM = {"August": {"Week 1 - Intro": {"pillar": "Physical Development", "topic": "Corrective Exercise - Baseline Screening", "plan": "Movement screen for every enrolled athlete (overhead squat, single-leg balance, shoulder mobility). Coach records findings and assigns 2-3 individualized corrective exercises to build into each athlete's own warm-up."}, "Week 2 - Build": {"pillar": "Recovery & Nutrition", "topic": "Everyday Nutrition Basics", "plan": "Intro to fueling for training: balanced plates, hydration targets, pre/post-practice snack timing. Athletes build a simple personal nutrition checklist."}, "Week 3 - Pressure": {"pillar": "Mental Performance", "topic": "Goal-Setting Workshop #1", "plan": "Individual goal-setting worksheet for the season. Intro to a simple pre-serve/pre-point routine athletes can start using immediately."}, "Week 4 - Eval": {"pillar": "Recruiting & College Readiness", "topic": "Player Profile Workshop - Build the Basics", "plan": "Athletes build or update their core player profile: stats, bio, contact info, key highlights. Coaches review for completeness."}}, "September": {"Week 1 - Intro": {"pillar": "Physical Development", "topic": "Athletic Performance - Strength & Power Baseline", "plan": "Bodyweight strength circuit and vertical jump baseline test. Establish numbers to track progress across the year."}, "Week 2 - Build": {"pillar": "Recovery & Nutrition", "topic": "Recovery Modalities Intro", "plan": "Foam rolling, static stretching routines, and a sleep hygiene primer. Athletes leave with a personal recovery routine to use after tough practices."}, "Week 3 - Pressure": {"pillar": "Mental Performance", "topic": "Self-Talk & Confidence", "plan": "Identifying negative self-talk patterns and replacing them with productive cues. Practice applying it during a live drill."}, "Week 4 - Eval": {"pillar": "Recruiting & College Readiness", "topic": "Video Analysis - Building the Footage Library", "plan": "Film each athlete on serve, pass, and one attacking shot. Start a personal footage folder to draw from for a future highlight reel."}}, "October": {"Week 1 - Intro": {"pillar": "Physical Development", "topic": "Athletic Performance - Speed & Agility", "plan": "Agility ladder work and change-of-direction drills, building on August/September's baseline numbers."}, "Week 2 - Build": {"pillar": "Recovery & Nutrition", "topic": "Nutrition Before/During/After Events", "plan": "Tournament-day fueling: what to eat the night before, morning of, between matches, and post-event recovery meals."}, "Week 3 - Pressure": {"pillar": "Mental Performance", "topic": "Visualization & Pre-Performance Routines", "plan": "Guided visualization practice for a big point or serve. Athletes refine their pre-point routine from August."}, "Week 4 - Eval": {"pillar": "Recruiting & College Readiness", "topic": "Recruiting Tips - Emailing College Coaches", "plan": "How to write a first email to a college coach, what to include, timing, and follow-up etiquette. Athletes draft a real email."}}, "November": {"Week 1 - Intro": {"pillar": "Physical Development", "topic": "Corrective Exercise - Reassessment", "plan": "Re-screen each athlete against August's baseline. Adjust individualized corrective exercises based on 3 months of training."}, "Week 2 - Build": {"pillar": "Recovery & Nutrition", "topic": "Recovery Deep Dive", "plan": "Active recovery techniques, basic injury-prevention habits, and a look at recovery modalities beyond foam rolling (contrast, compression)."}, "Week 3 - Pressure": {"pillar": "Mental Performance", "topic": "Handling Pressure & Competition Anxiety", "plan": "Practical tools for in-the-moment pressure - breathing resets, reframing a bad point, staying present between rallies."}, "Week 4 - Eval": {"pillar": "Recruiting & College Readiness", "topic": "College Camp Search", "plan": "Research and identify summer camps and showcase events worth targeting based on the athlete's level and goals."}}, "December": {"Review Week 1": {"pillar": "Physical Development", "topic": "Physical Development Recap", "plan": "Review corrective exercise progress and performance testing gains from the fall. Assign simple homework for winter break."}, "Review Week 2": {"pillar": "Recovery & Nutrition", "topic": "Holiday Nutrition & Recovery", "plan": "Managing nutrition and recovery through travel, holiday food, and reduced structure. Simple non-negotiables for the break."}, "Review Week 3": {"pillar": "Mental Performance", "topic": "Season Reflection & Goal Reset", "plan": "Revisit August's goal-setting worksheet, reflect on progress, and set updated goals for January-July."}, "Week 4 - Camp": {"pillar": "Recruiting & College Readiness", "topic": "Recruiting Wrap-Up", "plan": "Finalize player profile updates, review the footage library, and build a spring recruiting/outreach calendar."}}};

/* July is a soft-launch pilot with generic practice placeholders —
   there's no curriculum data for it. August onward uses the exact
   dates and curriculum from the program's practice-calendar sheet
   (CALENDAR / DAY1_CURRICULUM / DAY2_CURRICULUM below). */
const SEASON_BLOCKS = [{ label: "July", start: "2026-07-06", end: "2026-07-30", active: true }];

function julyPilotPlans(team) {
  const plans = [];
  for (const block of SEASON_BLOCKS) {
    let d = block.start;
    while (d <= block.end) {
      const dow = new Date(d + "T00:00:00").getDay();
      if (team.meetingDays.includes(dow)) {
        plans.push({ id: uid(), date: d, title: "Practice", objectives: [], taught: false, coverage: "", notepad: "", cancelled: false });
      }
      d = addDays(d, 1);
    }
  }
  return plans;
}

function weekLabelKey(row) {
  return row.weekLabel.startsWith("Week 4 - Camp") ? "Camp" : row.weekLabel;
}
function curriculumForRow(row) {
  const wk = weekLabelKey(row);
  if (row.dayType === "Camp") {
    const early = row.weekday === "Monday" || row.weekday === "Tuesday";
    return (early ? DAY1_CURRICULUM : DAY2_CURRICULUM)[row.month]?.[wk];
  }
  const source = row.dayType === "Day 1" ? DAY1_CURRICULUM : DAY2_CURRICULUM;
  return source[row.month]?.[wk];
}
function rowAppliesToTeam(row, team) {
  if (row.team === "All Teams") return true;
  if (row.team === "Monday/Wednesday Team") return team.meetingDays.includes(1);
  if (row.team === "Tuesday/Thursday Team") return team.meetingDays.includes(2);
  return false;
}

function generateSeasonPlans(team) {
  const plans = julyPilotPlans(team);
  CALENDAR.filter((row) => rowAppliesToTeam(row, team)).forEach((row) => {
    const c = curriculumForRow(row);
    plans.push({
      id: uid(),
      date: row.date,
      title: c?.title || "Practice",
      objectives: [],
      planText: c?.plan || "",
      notePrompt: c?.notePrompt || "",
      weekLabel: row.weekLabel,
      month: row.month,
      taught: false,
      coverage: "",
      notepad: "",
      cancelled: false,
    });
  });
  return plans;
}

const SEED_PLANS = Object.fromEntries(SEED_TEAMS.map((t) => [t.id, generateSeasonPlans(t)]));
const SEED_MESSAGES = Object.fromEntries(SEED_TEAMS.map((t) => [t.id, []]));

// Full program year, August through July. Curriculum content only exists
// for Aug–Dec so far (from the practice-calendar sheet); Jan–July show as
// "coming soon" in the season snapshot until that content is provided.
const PROGRAM_YEAR_MONTHS = [
  "August", "September", "October", "November", "December",
  "January", "February", "March", "April", "May", "June", "July",
];

const SEED_EVENTS = [
  {
    id: "ev1",
    name: "BOMB Saturday Night Lights",
    type: "BOMB",
    date: "2026-07-11",
    location: "Mesquite Beach",
    description: "Tournament · Juniors · Beach · 1s. Open format, no partner required to enter.",
    registerUrl: "https://thesandclub.volleyballlife.com/event/37497?tab=information",
  },
  {
    id: "ev3",
    name: "BOMB Saturday Night Lights",
    type: "BOMB",
    date: "2026-07-18",
    location: "Mesquite Beach",
    description: "Tournament · Juniors · Beach · 1s. Open format, no partner required to enter.",
    registerUrl: "https://thesandclub.volleyballlife.com/event/37498?tab=information",
  },
  {
    id: "ev4",
    name: "BOMB Saturday Night Lights",
    type: "BOMB",
    date: "2026-07-25",
    location: "Mesquite Beach",
    description: "Tournament · Juniors · Beach · 1s. Open format, no partner required to enter.",
    registerUrl: "https://thesandclub.volleyballlife.com/event/37499?tab=information",
  },
  {
    id: "ev5",
    name: "BOMB Saturday Night Lights",
    type: "BOMB",
    date: "2026-08-01",
    location: "Mesquite Beach",
    description: "Tournament · Juniors · Beach · 1s. Open format, no partner required to enter.",
    registerUrl: "https://thesandclub.volleyballlife.com/event/37500?tab=information",
  },
];

const SEED_NEWSLETTERS = [];

// A few sample registrations so the Paid/Free toggle boxes (and partner
// status) are visible immediately without having to register players
// through the app first — otherwise there's nothing to mark yet.
const SEED_EVENT_REGS = {
  ev1: {
    [SEED_ROSTERS.jw[0].id]: { registered: true, hasPartner: true, partnerName: "Practice partner", paidStatus: "paid" },
    [SEED_ROSTERS.jw[1].id]: { registered: true, hasPartner: false, fallbackBOMB: false, paidStatus: null },
    [SEED_ROSTERS.jw[2].id]: { paidStatus: "notAttending" },
  },
  ev3: {
    [SEED_ROSTERS.jw[3].id]: { registered: true, hasPartner: false, fallbackBOMB: true, paidStatus: "free" },
  },
};

const SKILLS = ["Technique", "Effort", "Teamwork", "Game IQ"];

/* ---------- month/day navigation + RSVP helpers ---------- */
function teamMonths(teamPlans) {
  const seen = new Map();
  [...(teamPlans || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((p) => {
      const mk = monthKey(p.date);
      if (!seen.has(mk)) seen.set(mk, monthLabel(mk));
    });
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}
function dayNum(iso) {
  return new Date(iso + "T00:00:00").getDate();
}
function weekdayLetter(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" });
}
// "Surprise" = actual attendance came back late/absent, but the parent
// never flagged it ahead of time (no RSVP, or RSVP still said attending).
function isSurprise(actualStatus, rsvpStatus) {
  return (actualStatus === "late" || actualStatus === "absent") && (!rsvpStatus || rsvpStatus === "attending");
}
function computePlayerHistory(teamId, playerId, attendance, rsvps) {
  const teamAttendance = attendance[teamId] || {};
  const teamRsvps = rsvps[teamId] || {};
  let present = 0,
    late = 0,
    absent = 0;
  const surprises = [];
  Object.entries(teamAttendance).forEach(([date, dayRecord]) => {
    const rec = dayRecord[playerId];
    if (!rec?.status) return;
    if (rec.status === "present") present += 1;
    else if (rec.status === "late") late += 1;
    else if (rec.status === "absent") absent += 1;
    const rsvpStatus = teamRsvps[date]?.[playerId]?.status;
    if (isSurprise(rec.status, rsvpStatus)) surprises.push({ date, status: rec.status });
  });
  surprises.sort((a, b) => b.date.localeCompare(a.date));
  return { present, late, absent, total: present + late + absent, surprises };
}

function unreadNewsletterCount(newsletters, accountId, newsletterReads) {
  const lastRead = newsletterReads?.[accountId];
  if (!lastRead) return newsletters.length; // never opened it — everything's unread
  return newsletters.filter((n) => n.date > lastRead.slice(0, 10)).length;
}

function unreadUpdateCount(messages, teamId, accountId, updateReads) {
  const teamMessages = messages?.[teamId] || [];
  const lastRead = updateReads?.[accountId];
  if (!lastRead) return teamMessages.length; // never opened it — everything's unread
  return teamMessages.filter((m) => m.date > lastRead.slice(0, 10)).length;
}

// Practice-count package coverage. Walks a team's scheduled practice
// dates starting from the player's packageStartDate, skipping any date
// marked "excused" on the attendance record (advance-notice absence —
// doesn't consume a practice). Every other scheduled date counts
// against practicesIncluded, whether the player showed up or not —
// that's the intentional anti-abuse default. Returns how many
// practices have been used, how many remain, and the exact date their
// current package covers through (their Nth non-excused practice).
function computePackageCoverage(player, teamPlans, attendance, teamId) {
  const included = player.practicesIncluded ?? 8;
  const start = player.packageStartDate || TODAY;
  const scheduledDates = [...(teamPlans || [])]
    .filter((p) => p.date >= start && !p.cancelled)
    .map((p) => p.date)
    .sort();

  let used = 0;
  let coveredThroughDate = null;
  for (const date of scheduledDates) {
    const excused = attendance?.[teamId]?.[date]?.[player.id]?.excused === true;
    if (excused) continue;
    used += 1;
    coveredThroughDate = date;
    if (used >= included) break;
  }

  return {
    used,
    included,
    remaining: Math.max(0, included - used),
    coveredThroughDate, // null means fewer than `included` scheduled practices exist yet
    exhausted: used >= included,
  };
}

function lastPracticeDate(playerId, attendance) {
  let latest = null;
  Object.values(attendance || {}).forEach((teamAttendance) => {
    Object.entries(teamAttendance).forEach(([date, dayRecord]) => {
      if (dayRecord[playerId]?.status && (!latest || date > latest)) latest = date;
    });
  });
  return latest;
}

/* ---------- storage helpers ----------
   Fully defensive and non-blocking. Every call races against a short
   timeout, so a hung or unavailable storage backend can never freeze
   the UI. Failures are swallowed — the app just keeps whatever state
   it already has (seed data, by default). */
/* ---------- small UI atoms ---------- */
function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "sl-bg-cream sl-text-pitch",
    turf: "sl-bg-turf text-white",
    amber: "sl-bg-amber text-white",
    clay: "sl-bg-clay text-white",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
      style={FONT_BODY}
    >
      {children}
    </span>
  );
}

function YardLine() {
  return (
    <div
      className="h-2 w-full"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, #C9C2AD 0, #C9C2AD 2px, transparent 2px, transparent 18px)",
        opacity: 0.6,
      }}
    />
  );
}

/* =====================================================================
   MAIN APP (gated — see SidelineApp default export below for the login)
===================================================================== */

function SidelineAppInner({ account, onSignOut }) {
  useFonts();
  useTokenStyles();

  const [role, setRole] = useState(account.role); // coach | parent | admin
  const [teams, setTeams] = useState(SEED_TEAMS);
  const myTeams =
    account.role === "coach" && account.coachId
      ? teams.filter((t) => teamCoachIds(t).includes(account.coachId))
      : account.teamIds
      ? teams.filter((t) => account.teamIds.includes(t.id))
      : teams;
  const [rosters, setRosters] = useState(SEED_ROSTERS);
  const [attendance, setAttendance] = useState({}); // {teamId: {date: {playerId:{status,note}}}}
  const [rsvps, setRsvps] = useState({}); // {teamId: {date: {playerId:{status}}}} — parent heads-up, default 'attending'
  const [evaluations, setEvaluations] = useState({}); // {teamId: {month: {playerId:{scores,notes,completedDate}}}}
  const [evalRequests, setEvalRequests] = useState({}); // {teamId: {month: {playerId: {requestedAt}}}}
  const [evalRubric, setEvalRubric] = useState(DEFAULT_EVAL_RUBRIC); // {month: [{skillArea, criteria, scale}]} — owner-editable
  const [profileRequests, setProfileRequests] = useState({}); // {teamId: {playerId: {requestedAt}}}
  const [plans, setPlans] = useState(SEED_PLANS);
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const [events, setEvents] = useState(SEED_EVENTS); // [{id,name,type,date,location}]
  const [eventRegs, setEventRegs] = useState(SEED_EVENT_REGS); // {eventId: {playerId: {usedCoupon, wantsPartner, partnerName, fallbackBOMB}}}
  const [newsletters, setNewsletters] = useState(SEED_NEWSLETTERS); // [{id,date,topic,title,body}]
  const [boardPosts, setBoardPosts] = useState({}); // {teamId: [{id,date,author,text}]}
  const [coaches, setCoaches] = useState(SEED_COACHES); // {coachName: {phone, email}}
  const [archivedPlayers, setArchivedPlayers] = useState(SEED_ARCHIVED_PLAYERS); // [{...player, lastTeamId, lastTeamName, archivedAt}]
  const [planSuggestions, setPlanSuggestions] = useState([]); // [{id, teamId, coachName, date, title, planText, submittedAt}]
  const [coachMessages, setCoachMessages] = useState({}); // {teamId: [{id, author:'coach'|'parent', authorName, text, date}]}
  const [ownerMessages, setOwnerMessages] = useState({}); // {teamId: [{id, author:'owner'|'parent', authorName, text, date}]}
  const [practiceRatings, setPracticeRatings] = useState({}); // {teamId: {date: {playerId: {rating, comment}}}}
  const [newsletterReads, setNewsletterReads] = useState({}); // {accountId: isoTimestampOfLastRead}
  const [updateReads, setUpdateReads] = useState({}); // {accountId: isoTimestampOfLastRead} — for coach broadcast "Updates"
  const [showCoachThread, setShowCoachThread] = useState(false);
  const [teamId, setTeamId] = useState(account.teamId || myTeams[0]?.id || "jw");
  const [tab, setTab] = useState(account.role === "parent" ? "dashboard" : "attendance");
  const [showImport, setShowImport] = useState(false);

  function switchRole(nextRole) {
    setRole(nextRole);
    if (nextRole === "coach") setTab("attendance");
    else if (nextRole === "parent") setTab("dashboard");
  }

  useEffect(() => {
    if (myTeams.length && !myTeams.some((t) => t.id === teamId)) {
      setTeamId(myTeams[0].id);
    }
  }, [teams]);

  // Real parent accounts only store a playerId (who their child is),
  // not a teamId — that has to be looked up from the roster once it's
  // loaded, since which team a player is on can change (see "move
  // player to team").
  useEffect(() => {
    if (account.role === "parent" && account.playerId) {
      const foundTeam = teams.find((t) => (rosters[t.id] || []).some((p) => p.id === account.playerId));
      if (foundTeam && foundTeam.id !== teamId) setTeamId(foundTeam.id);
    }
  }, [rosters, teams]);

  // Background hydration only — the UI never waits on this. If storage
  // is unavailable, slow, or errors, the app just keeps running on the
  // seed data it already rendered with.
  useEffect(() => {
    loadKey("sideline-teams", null).then((v) => v && setTeams(v));
    loadKey("sideline-rosters", null).then((v) => v && setRosters(v));
    loadKey("sideline-attendance", null).then((v) => v && setAttendance(v));
    loadKey("sideline-rsvps", null).then((v) => v && setRsvps(v));
    loadKey("sideline-evaluations", null).then((v) => v && setEvaluations(v));
    loadKey("sideline-evalRequests", null).then((v) => v && setEvalRequests(v));
    loadKey("sideline-evalRubric", null).then((v) => v && setEvalRubric(v));
    loadKey("sideline-profileRequests", null).then((v) => v && setProfileRequests(v));
    loadKey("sideline-plans", null).then((v) => v && setPlans(v));
    loadKey("sideline-messages", null).then((v) => v && setMessages(v));
    loadKey("sideline-events", null).then((v) => v && setEvents(v));
    loadKey("sideline-eventRegs", null).then((v) => v && setEventRegs(v));
    loadKey("sideline-newsletters", null).then((v) => v && setNewsletters(v));
    loadKey("sideline-boardPosts", null).then((v) => v && setBoardPosts(v));
    loadKey("sideline-coaches", null).then((v) => v && setCoaches(v));
    loadKey("sideline-archivedPlayers", null).then((v) => v && setArchivedPlayers(v));
    loadKey("sideline-planSuggestions", null).then((v) => v && setPlanSuggestions(v));
    loadKey("sideline-coachMessages", null).then((v) => v && setCoachMessages(v));
    loadKey("sideline-ownerMessages", null).then((v) => v && setOwnerMessages(v));
    loadKey("sideline-practiceRatings", null).then((v) => v && setPracticeRatings(v));
    loadKey("sideline-newsletterReads", null).then((v) => v && setNewsletterReads(v));
    loadKey("sideline-updateReads", null).then((v) => v && setUpdateReads(v));
  }, []);

  // debounced persistence
  const timers = useRef({});
  const persist = useCallback((key, value, setter) => {
    setter(value);
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => saveKey(key, value), 350);
  }, []);

  const team = teams.find((t) => t.id === teamId) || teams[0];
  const fullRoster = rosters[teamId] || [];
  const roster = account.playerId ? fullRoster.filter((p) => p.id === account.playerId) : fullRoster;

  return (
    <div
      className="mx-auto flex max-w-md flex-col overflow-x-hidden sl-bg-chalk"
      style={{ ...FONT_BODY, minHeight: "100dvh" }}
    >
      {/* header */}
      <div className="sl-bg-pitch px-4 pb-3 pt-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <img src={LOGO_DATA_URI} alt="Sand Club Academy logo" className="h-9 w-9 shrink-0 rounded-full bg-white object-contain p-0.5" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-none tracking-tight" style={FONT_DISPLAY}>
                SAND CLUB ACADEMY
              </h1>
              <p className="mt-0.5 truncate uppercase tracking-widest sl-text-mint" style={{ fontSize: 11 }}>
                {role === "coach" ? coachFullName(account.coachId, coaches) : role === "parent" ? "Parent view" : "Program dashboard"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {account.role === "admin" && (
              <div className="flex overflow-hidden rounded-full border sl-border-w25 text-xs font-semibold">
                <button
                  onClick={() => switchRole("coach")}
                  className={`px-3 py-1.5 transition ${role === "coach" ? "bg-white sl-text-pitch" : "sl-text-w80"}`}
                >
                  Coach
                </button>
                <button
                  onClick={() => switchRole("parent")}
                  className={`px-3 py-1.5 transition ${role === "parent" ? "bg-white sl-text-pitch" : "sl-text-w80"}`}
                >
                  Parent
                </button>
                <button
                  onClick={() => switchRole("admin")}
                  className={`px-3 py-1.5 transition ${role === "admin" ? "bg-white sl-text-pitch" : "sl-text-w80"}`}
                >
                  Director
                </button>
              </div>
            )}
            <button onClick={onSignOut} className="rounded-full border sl-border-w25 px-2.5 py-1.5 text-xs font-semibold sl-text-w80">
              Sign out
            </button>
          </div>
        </div>

        {role === "coach" && (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-3 w-full rounded-lg border sl-border-w20 sl-bg-w10 px-3 py-2 text-sm font-medium text-white outline-none"
            style={FONT_BODY}
          >
            {myTeams.map((t) => (
              <option key={t.id} value={t.id} className="sl-text-pitch">
                {t.name}
              </option>
            ))}
          </select>
        )}
        {role === "parent" && team && (
          <div className="mt-3 flex items-center justify-between rounded-lg border sl-border-w20 sl-bg-w10 px-3 py-2">
            <div>
              <p className="text-xs uppercase tracking-wide sl-text-mint">{teamCoachIds(team).length > 1 ? "My Coaches" : "My Coach"}</p>
              <p className="text-sm font-semibold text-white">{teamCoachDisplay(team, coaches)}</p>
              {teamCoachIds(team).map((cid) => {
                const phone = coaches[cid]?.phone;
                if (!phone) return null;
                return (
                  <p key={cid} className="text-xs sl-text-mint">
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
                      {coachFullName(cid, coaches).split(" ")[0]}: {phone}
                    </a>
                  </p>
                );
              })}
            </div>
            <button
              onClick={() => setShowCoachThread(true)}
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold sl-text-pitch"
            >
              <MessageCircle size={13} /> Message
            </button>
          </div>
        )}
      </div>
      <YardLine />

      {/* body */}
      <div className="flex-1">
        {role === "coach" ? (
          <CoachBody
            tab={tab}
            setTab={setTab}
            team={team}
            teams={teams}
            roster={roster}
            teamId={teamId}
            attendance={attendance}
            setAttendance={(v) => persist("sideline-attendance", v, setAttendance)}
            archivedPlayers={archivedPlayers}
            setArchivedPlayers={(v) => persist("sideline-archivedPlayers", v, setArchivedPlayers)}
            rsvps={rsvps}
            evaluations={evaluations}
            setEvaluations={(v) => persist("sideline-evaluations", v, setEvaluations)}
            evalRequests={evalRequests}
            setEvalRequests={(v) => persist("sideline-evalRequests", v, setEvalRequests)}
            evalRubric={evalRubric}
            profileRequests={profileRequests}
            setProfileRequests={(v) => persist("sideline-profileRequests", v, setProfileRequests)}
            plans={plans}
            setPlans={(v) => persist("sideline-plans", v, setPlans)}
            messages={messages}
            setMessages={(v) => persist("sideline-messages", v, setMessages)}
            rosters={rosters}
            setRosters={(v) => persist("sideline-rosters", v, setRosters)}
            showImport={showImport}
            setShowImport={setShowImport}
            coaches={coaches}
            setCoaches={(v) => persist("sideline-coaches", v, setCoaches)}
            account={account}
            planSuggestions={planSuggestions}
            setPlanSuggestions={(v) => persist("sideline-planSuggestions", v, setPlanSuggestions)}
            coachMessages={coachMessages}
            setCoachMessages={(v) => persist("sideline-coachMessages", v, setCoachMessages)}
            events={events}
            setEvents={(v) => persist("sideline-events", v, setEvents)}
            eventRegs={eventRegs}
            setEventRegs={(v) => persist("sideline-eventRegs", v, setEventRegs)}
            practiceRatings={practiceRatings}
            newsletters={newsletters}
            newsletterReads={newsletterReads}
            setNewsletterReads={(v) => persist("sideline-newsletterReads", v, setNewsletterReads)}
          />
        ) : role === "parent" ? (
          <ParentBody
            tab={tab}
            setTab={setTab}
            teamId={teamId}
            team={team}
            roster={roster}
            plans={plans}
            messages={messages}
            attendance={attendance}
            rsvps={rsvps}
            setRsvps={(v) => persist("sideline-rsvps", v, setRsvps)}
            evaluations={evaluations}
            evalRequests={evalRequests}
            setEvalRequests={(v) => persist("sideline-evalRequests", v, setEvalRequests)}
            evalRubric={evalRubric}
            profileRequests={profileRequests}
            setProfileRequests={(v) => persist("sideline-profileRequests", v, setProfileRequests)}
            rosters={rosters}
            setRosters={(v) => persist("sideline-rosters", v, setRosters)}
            events={events}
            eventRegs={eventRegs}
            setEventRegs={(v) => persist("sideline-eventRegs", v, setEventRegs)}
            newsletters={newsletters}
            newsletterReads={newsletterReads}
            setNewsletterReads={(v) => persist("sideline-newsletterReads", v, setNewsletterReads)}
            updateReads={updateReads}
            setUpdateReads={(v) => persist("sideline-updateReads", v, setUpdateReads)}
            account={account}
            boardPosts={boardPosts}
            setBoardPosts={(v) => persist("sideline-boardPosts", v, setBoardPosts)}
            coaches={coaches}
            ownerMessages={ownerMessages}
            setOwnerMessages={(v) => persist("sideline-ownerMessages", v, setOwnerMessages)}
            practiceRatings={practiceRatings}
            setPracticeRatings={(v) => persist("sideline-practiceRatings", v, setPracticeRatings)}
            coachMessages={coachMessages}
            setShowCoachThread={setShowCoachThread}
          />
        ) : (
          <AdminBody
            teams={teams}
            rosters={rosters}
            setRosters={(v) => persist("sideline-rosters", v, setRosters)}
            attendance={attendance}
            plans={plans}
            setPlans={(v) => persist("sideline-plans", v, setPlans)}
            evaluations={evaluations}
            setEvaluations={(v) => persist("sideline-evaluations", v, setEvaluations)}
            evalRequests={evalRequests}
            setEvalRequests={(v) => persist("sideline-evalRequests", v, setEvalRequests)}
            evalRubric={evalRubric}
            setEvalRubric={(v) => persist("sideline-evalRubric", v, setEvalRubric)}
            profileRequests={profileRequests}
            setProfileRequests={(v) => persist("sideline-profileRequests", v, setProfileRequests)}
            coaches={coaches}
            setCoaches={(v) => persist("sideline-coaches", v, setCoaches)}
            setTeams={(v) => persist("sideline-teams", v, setTeams)}
            planSuggestions={planSuggestions}
            setPlanSuggestions={(v) => persist("sideline-planSuggestions", v, setPlanSuggestions)}
            rsvps={rsvps}
            events={events}
            setEvents={(v) => persist("sideline-events", v, setEvents)}
            eventRegs={eventRegs}
            setEventRegs={(v) => persist("sideline-eventRegs", v, setEventRegs)}
            newsletters={newsletters}
            setNewsletters={(v) => persist("sideline-newsletters", v, setNewsletters)}
            practiceRatings={practiceRatings}
            archivedPlayers={archivedPlayers}
            setArchivedPlayers={(v) => persist("sideline-archivedPlayers", v, setArchivedPlayers)}
          />
        )}
      </div>

      {/* bottom nav */}
      {role !== "admin" && (
        <div className="sticky bottom-0 z-10 shrink-0 border-t sl-border-line bg-white">
          <div className="flex">
            {(role === "coach"
              ? [
                  { id: "attendance", label: "Attendance", icon: Users },
                  { id: "evaluations", label: "Skills", icon: Star },
                  { id: "plans", label: "Plans", icon: BookOpen },
                  { id: "roster", label: "Roster", icon: Phone },
                  { id: "events", label: "Events", icon: Trophy },
                  { id: "messages", label: "Message", icon: MessageCircle },
                ]
              : [
                  { id: "plans", label: "Season", icon: BookOpen },
                  { id: "dashboard", label: "My Player", icon: Star },
                  { id: "events", label: "Events", icon: Trophy },
                  { id: "community", label: "Community", icon: MessageCircle },
                ]
            ).map(({ id, label, icon: Icon }) => {
              const showBadge =
                (role === "coach" && id === "messages" && unreadNewsletterCount(newsletters || [], account?.id, newsletterReads) > 0) ||
                (role === "parent" &&
                  id === "community" &&
                  (unreadNewsletterCount(newsletters || [], account?.id, newsletterReads) > 0 ||
                    unreadUpdateCount(messages || {}, teamId, account?.id, updateReads) > 0));
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{ fontSize: 11 }}
                  className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 font-semibold transition ${
                    tab === id ? "sl-text-pitch" : "sl-text-faint"
                  }`}
                >
                  <span className="relative">
                    <Icon size={20} strokeWidth={tab === id ? 2.4 : 2} />
                    {showBadge && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full sl-bg-clay" />
                    )}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showCoachThread && role === "parent" && team && roster[0] && (
        <CoachThreadModal
          threadKey={roster[0].id}
          coachMessages={coachMessages}
          setCoachMessages={(v) => persist("sideline-coachMessages", v, setCoachMessages)}
          authorRole="parent"
          coachName={teamCoachDisplay(team, coaches)}
          onClose={() => setShowCoachThread(false)}
        />
      )}
    </div>
  );
}

/* =====================================================================
   COACH BODY
===================================================================== */
function CoachBody(props) {
  const { tab } = props;
  if (tab === "attendance") return <AttendanceTab {...props} />;
  if (tab === "evaluations") return <EvaluationsTab {...props} />;
  if (tab === "plans") return <PlansTab {...props} />;
  if (tab === "roster") return <RosterTab {...props} />;
  if (tab === "events") return <EventsManager {...props} />;
  if (tab === "messages") return <MessagesTab {...props} />;
  return null;
}

/* ---------------- Attendance ---------------- */
function AttendanceTab({ teamId, roster, attendance, setAttendance, rsvps, plans, rosters, setRosters, showImport, setShowImport, newsletters, newsletterReads, setNewsletterReads, account, setTab }) {
  const months = teamMonths(plans[teamId]);
  const defaultMonth = months.find((m) => m.key === monthKey(TODAY))?.key || months[0]?.key;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const monthDates = [...(plans[teamId] || [])]
    .filter((p) => monthKey(p.date) === selectedMonth)
    .map((p) => p.date)
    .sort();
  const [date, setDate] = useState(monthDates.includes(TODAY) ? TODAY : monthDates[0]);
  const [showDropIn, setShowDropIn] = useState(false);
  const [dropInName, setDropInName] = useState("");
  const [dropInParent, setDropInParent] = useState("");
  const dayRecord = attendance[teamId]?.[date] || {};

  function selectMonth(mk) {
    setSelectedMonth(mk);
    const dates = [...(plans[teamId] || [])]
      .filter((p) => monthKey(p.date) === mk)
      .map((p) => p.date)
      .sort();
    setDate(dates.includes(TODAY) ? TODAY : dates[0]);
  }

  function dayStatus(d) {
    const rec = attendance[teamId]?.[d] || {};
    if (roster.length === 0) return "none";
    const allMarked = roster.every((p) => rec[p.id]?.status);
    if (!allMarked) return Object.keys(rec).length > 0 ? "partial" : "none";
    const notesOk = Object.values(rec).every(
      (r) => !(r.status === "late" || r.status === "absent") || r.note?.trim()
    );
    return notesOk ? "complete" : "partial";
  }

  const teamRsvpsForDay = rsvps[teamId]?.[date] || {};
  const expected = roster.reduce(
    (acc, p) => {
      const s = teamRsvpsForDay[p.id]?.status || "attending";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { attending: 0, late: 0, absent: 0 }
  );

  const dropIns = Object.entries(dayRecord)
    .filter(([, rec]) => rec.isDropIn)
    .map(([id, rec]) => ({ id, name: rec.name, parent: rec.parent, isDropIn: true }));
  const combined = [...roster.map((p) => ({ ...p, isDropIn: false })), ...dropIns];

  const missingNotes = combined.filter((p) => {
    const s = dayRecord[p.id];
    return s && (s.status === "late" || s.status === "absent") && !s.note?.trim();
  });
  const unmarked = combined.filter((p) => !dayRecord[p.id]);

  function updateStatus(playerId, status) {
    const next = {
      ...attendance,
      [teamId]: {
        ...attendance[teamId],
        [date]: {
          ...dayRecord,
          [playerId]: {
            ...dayRecord[playerId],
            status,
            note: status === "present" ? "" : dayRecord[playerId]?.note || "",
            excused: status === "absent" ? dayRecord[playerId]?.excused || false : false,
          },
        },
      },
    };
    setAttendance(next);
  }
  function updateExcused(playerId, excused) {
    const next = {
      ...attendance,
      [teamId]: {
        ...attendance[teamId],
        [date]: { ...dayRecord, [playerId]: { ...dayRecord[playerId], excused } },
      },
    };
    setAttendance(next);
  }
  function updateNote(playerId, note) {
    const next = {
      ...attendance,
      [teamId]: {
        ...attendance[teamId],
        [date]: { ...dayRecord, [playerId]: { ...dayRecord[playerId], note } },
      },
    };
    setAttendance(next);
  }
  function addDropIn() {
    if (!dropInName.trim()) return;
    const id = `drop-${uid()}`;
    const next = {
      ...attendance,
      [teamId]: {
        ...attendance[teamId],
        [date]: {
          ...dayRecord,
          [id]: {
            status: "present",
            note: "",
            isDropIn: true,
            name: dropInName.trim(),
            parent: dropInParent.trim(),
          },
        },
      },
    };
    setAttendance(next);
    setDropInName("");
    setDropInParent("");
    setShowDropIn(false);
  }
  function removeDropIn(id) {
    const dayCopy = { ...dayRecord };
    delete dayCopy[id];
    setAttendance({ ...attendance, [teamId]: { ...attendance[teamId], [date]: dayCopy } });
  }

  if (!date) {
    return (
      <div className="px-4 pt-4">
        <p className="text-sm sl-text-faint">No practices scheduled for this team yet.</p>
      </div>
    );
  }

  const unreadNewsletters = unreadNewsletterCount(newsletters || [], account?.id, newsletterReads);

  return (
    <div className="px-4 pt-4">
      {unreadNewsletters > 0 && (
        <button
          onClick={() => setTab("messages")}
          className="mb-3 flex w-full items-center justify-between rounded-xl sl-bg-turf-tint px-3 py-2.5 text-sm sl-text-turf-dark"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Mail size={14} /> {unreadNewsletters} new newsletter{unreadNewsletters > 1 ? "s" : ""} from the Director
          </span>
          <span className="text-xs underline underline-offset-2">Read</span>
        </button>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {months.map((m) => (
            <button
              key={m.key}
              onClick={() => selectMonth(m.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                selectedMonth === m.key ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
              }`}
            >
              {m.label.split(" ")[0]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="ml-2 flex shrink-0 items-center gap-1 text-xs font-semibold sl-text-pitch underline sl-decoration-line underline-offset-2"
        >
          <Upload size={13} /> Import
        </button>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {monthDates.map((d) => {
          const status = dayStatus(d);
          const dot = status === "complete" ? "sl-bg-turf" : status === "partial" ? "sl-bg-amber" : "sl-bg-cream";
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 ${
                d === date ? "sl-border-turf sl-ring-turf bg-white" : "sl-border-line2 bg-white"
              }`}
            >
              <span className="font-semibold uppercase sl-text-faint" style={{ fontSize: 10 }}>{weekdayLetter(d)}</span>
              <span className="text-sm font-bold sl-text-ink">{dayNum(d)}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${dot}`} />
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl sl-bg-turf-tint px-3 py-2 text-xs sl-text-turf-dark">
        <span className="font-semibold">Parents expect:</span>
        <span>
          {expected.attending} attending · {expected.late} late · {expected.absent} out
        </span>
      </div>

      {(missingNotes.length > 0 || unmarked.length > 0) && (
        <div className="mb-3 space-y-2">
          {missingNotes.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl sl-bg-clay-tint px-3 py-2.5 text-sm sl-text-clay-dark">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>{missingNotes.length}</strong> player{missingNotes.length > 1 ? "s need" : " needs"} a note
                before this day is complete.
              </span>
            </div>
          )}
          {unmarked.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl sl-bg-amber-tint px-3 py-2.5 text-sm sl-text-amber-dark">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>{unmarked.length}</strong> player{unmarked.length > 1 ? "s" : ""} not marked yet.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {combined.map((p) => {
          const rec = dayRecord[p.id];
          const status = rec?.status;
          const needsNote = rec && (status === "late" || status === "absent") && !rec.note?.trim();
          return (
            <div
              key={p.id}
              className={`rounded-xl border bg-white p-3 ${needsNote ? "sl-border-clay" : "sl-border-line2"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-semibold sl-text-ink">{p.name}</p>
                  {p.isDropIn && <Pill tone="amber">Drop-in</Pill>}
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBtn
                    active={status === "present"}
                    tone="turf"
                    icon={CheckCircle2}
                    onClick={() => updateStatus(p.id, "present")}
                  />
                  <StatusBtn
                    active={status === "late"}
                    tone="amber"
                    icon={Clock}
                    onClick={() => updateStatus(p.id, "late")}
                  />
                  <StatusBtn
                    active={status === "absent"}
                    tone="clay"
                    icon={XCircle}
                    onClick={() => updateStatus(p.id, "absent")}
                  />
                  {p.isDropIn && (
                    <button onClick={() => removeDropIn(p.id)} className="rounded-lg p-2 sl-text-faint">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              {(status === "late" || status === "absent") && (
                <>
                  <input
                    value={rec?.note || ""}
                    onChange={(e) => updateNote(p.id, e.target.value)}
                    placeholder={status === "late" ? "Why late? (required)" : "Reason for absence (required)"}
                    className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none ${
                      needsNote ? "sl-border-clay sl-bg-clay-tint" : "sl-border-line sl-bg-offwhite"
                    }`}
                  />
                  {status === "absent" && (
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs sl-text-body">
                      <input
                        type="checkbox"
                        checked={rec?.excused || false}
                        onChange={(e) => updateExcused(p.id, e.target.checked)}
                      />
                      Excused (advance notice — doesn't count against their package)
                    </label>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        {showDropIn ? (
          <div className="rounded-xl border sl-border-line2 bg-white p-3">
            <p className="mb-2 text-sm font-semibold sl-text-ink">Add drop-in for today</p>
            <input
              value={dropInName}
              onChange={(e) => setDropInName(e.target.value)}
              placeholder="Player name"
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
              autoFocus
            />
            <input
              value={dropInParent}
              onChange={(e) => setDropInParent(e.target.value)}
              placeholder="Parent name (optional)"
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={addDropIn}
                className="flex-1 rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white"
              >
                Add to today's list
              </button>
              <button
                onClick={() => {
                  setShowDropIn(false);
                  setDropInName("");
                  setDropInParent("");
                }}
                className="rounded-lg border sl-border-line px-3 py-2 text-sm sl-text-body"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDropIn(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed sl-border-line py-2.5 text-sm font-semibold sl-text-pitch"
          >
            <Plus size={15} /> Add drop-in
          </button>
        )}
      </div>

      {showImport && (
        <ImportModal
          teamId={teamId}
          rosters={rosters}
          setRosters={setRosters}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

function StatusBtn({ active, tone, icon: Icon, onClick }) {
  const tones = {
    turf: active ? "sl-bg-turf text-white" : "sl-bg-cream sl-text-muted",
    amber: active ? "sl-bg-amber text-white" : "sl-bg-cream sl-text-muted",
    clay: active ? "sl-bg-clay text-white" : "sl-bg-cream sl-text-muted",
  };
  return (
    <button onClick={onClick} className={`rounded-lg p-2 transition ${tones[tone]}`}>
      <Icon size={18} />
    </button>
  );
}

function ImportModal({ teamId, rosters, setRosters, onClose }) {
  const [mode, setMode] = useState("sync"); // sync | paste
  const [text, setText] = useState("");
  const [baseId, setBaseId] = useState("");
  const [tableName, setTableName] = useState("Registrations");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState(null); // {type:'ok'|'error', msg}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadKey("sideline-airtable-config", null).then((cfg) => {
      if (cfg) {
        setBaseId(cfg.baseId || "");
        setTableName(cfg.tableName || "Registrations");
        setToken(cfg.token || "");
      }
    });
  }, []);

  function handlePasteImport() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const added = lines.map((line) => {
      const [name, parent] = line.split(",").map((s) => s.trim());
      return { id: uid(), name: name || "Unnamed", parent: parent || "" };
    });
    setRosters({ ...rosters, [teamId]: [...(rosters[teamId] || []), ...added] });
    setText("");
    onClose();
  }

  async function handleSync() {
    if (!baseId.trim() || !tableName.trim() || !token.trim()) {
      setStatus({ type: "error", msg: "Fill in Base ID, table name, and token." });
      return;
    }
    setBusy(true);
    setStatus(null);
    saveKey("sideline-airtable-config", { baseId, tableName, token });
    try {
      const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId.trim())}/${encodeURIComponent(
        tableName.trim()
      )}`;
      const res = await withTimeout(
        fetch(url, { headers: { Authorization: `Bearer ${token.trim()}` } }),
        8000
      );
      if (!res.ok) throw new Error(`Airtable returned ${res.status}`);
      const data = await res.json();
      const existing = rosters[teamId] || [];
      const existingKeys = new Set(existing.map((p) => `${p.name}|${p.parent}`.toLowerCase()));
      const incoming = (data.records || [])
        .map((r) => ({
          name: (r.fields?.Name || r.fields?.["Player Name"] || "").trim(),
          parent: (r.fields?.Parent || r.fields?.["Parent Name"] || "").trim(),
          team: (r.fields?.Team || "").trim(),
        }))
        .filter((r) => r.name)
        .filter((r) => !r.team || r.team.toLowerCase() === "" || true); // team filtering left to caller's table design
      const fresh = incoming.filter((r) => !existingKeys.has(`${r.name}|${r.parent}`.toLowerCase()));
      if (fresh.length === 0) {
        setStatus({ type: "ok", msg: "Synced — no new registrations found." });
      } else {
        setRosters({
          ...rosters,
          [teamId]: [...existing, ...fresh.map((r) => ({ id: uid(), name: r.name, parent: r.parent }))],
        });
        setStatus({ type: "ok", msg: `Added ${fresh.length} new player${fresh.length > 1 ? "s" : ""} from registrations.` });
      }
    } catch (e) {
      setStatus({ type: "error", msg: `Couldn't reach Airtable (${e.message}). Check your Base ID, table name, and token.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sl-bg-scrim sm:items-center">
      <div
        style={{ maxHeight: "85vh" }}
        className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold sl-text-pitch" style={FONT_DISPLAY}>
            ADD PLAYERS
          </h3>
          <button onClick={onClose}>
            <X size={18} className="sl-text-muted" />
          </button>
        </div>

        <div className="mb-3 flex overflow-hidden rounded-lg border sl-border-line text-xs font-semibold">
          <button
            onClick={() => setMode("sync")}
            className={`flex-1 py-1.5 ${mode === "sync" ? "sl-bg-pitch text-white" : "bg-white sl-text-body"}`}
          >
            Auto-sync registrations
          </button>
          <button
            onClick={() => setMode("paste")}
            className={`flex-1 py-1.5 ${mode === "paste" ? "sl-bg-pitch text-white" : "bg-white sl-text-body"}`}
          >
            Paste from Sheet
          </button>
        </div>

        {mode === "sync" ? (
          <div>
            <p className="mb-2 text-sm sl-text-body">
              Pulls new registrations from the Airtable base your Gravity Forms webhook feeds. One-time setup —
              after that, tap Sync any time (or leave this connected and it stays current).
            </p>
            <input
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              placeholder="Airtable Base ID (e.g. appXXXXXXXXXXXXXX)"
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
              style={FONT_MONO}
            />
            <input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Table name"
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
              style={FONT_MONO}
            />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Read-only access token"
              type="password"
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
              style={FONT_MONO}
            />
            <p className="mb-3 text-xs sl-text-faint">
              Use a token scoped read-only to this one table. Never put payment info in this base — names and
              parent contacts only.
            </p>
            {status && (
              <div
                className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                  status.type === "ok" ? "sl-bg-turf-tint sl-text-turf-dark" : "sl-bg-clay-tint sl-text-clay-dark"
                }`}
              >
                {status.msg}
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={busy}
              className="w-full rounded-lg sl-bg-pitch py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Syncing…" : "Sync now"}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-sm sl-text-body">
              Paste rows from your Google Sheet — one player per line, as <em>Player Name, Parent Name</em>.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"Ava Thompson, Lena Thompson\nBen Ortiz, Carla Ortiz"}
              className="w-full rounded-lg border sl-border-line p-2.5 text-sm outline-none"
            />
            <button
              onClick={handlePasteImport}
              className="mt-3 w-full rounded-lg sl-bg-pitch py-2.5 font-semibold text-white"
            >
              Add to roster
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Evaluations ---------------- */
function EvaluationsTab({ teamId, roster, evaluations, setEvaluations, evalRequests, setEvalRequests, evalRubric, plans }) {
  const months = teamMonths(plans[teamId]);
  const defaultMonth = months.find((m) => m.key === monthKey(TODAY))?.key || months[0]?.key;
  const [month, setMonth] = useState(defaultMonth);
  const [open, setOpen] = useState(null);
  const monthEvals = evaluations[teamId]?.[month] || {};
  const monthRequests = evalRequests[teamId]?.[month] || {};
  const monthName = monthLabel(month).split(" ")[0];
  const rubric = evalRubric[monthName];
  const rows = rubric
    ? rubric.map((r) => ({ key: `${r.skillArea} — ${r.criteria}`, label: r.criteria, sub: r.skillArea, scaleMax: 4, hint: r.scale }))
    : SKILLS.map((s) => ({ key: s, label: s, scaleMax: 5, hint: null }));

  function save(playerId, scores, notes) {
    const next = {
      ...evaluations,
      [teamId]: {
        ...evaluations[teamId],
        [month]: {
          ...monthEvals,
          [playerId]: { scores, notes, completedDate: todayISO() },
        },
      },
    };
    setEvaluations(next);
    // clear any pending request now that the eval is done
    if (monthRequests[playerId]) {
      const clearedMonth = { ...monthRequests };
      delete clearedMonth[playerId];
      setEvalRequests({ ...evalRequests, [teamId]: { ...evalRequests[teamId], [month]: clearedMonth } });
    }
    setOpen(null);
  }

  const doneCount = roster.filter((p) => monthEvals[p.id]?.completedDate).length;

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          EVALUATIONS
        </h2>
        <Pill tone={roster.length && doneCount === roster.length ? "turf" : "amber"}>
          {doneCount}/{roster.length} done
        </Pill>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setMonth(m.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              month === m.key ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {m.label.split(" ")[0]}
          </button>
        ))}
      </div>
      {rubric ? (
        <p className="mb-3 text-xs sl-text-faint">
          {monthName}'s formal skill focus: {[...new Set(rubric.map((r) => r.skillArea))].join(" + ")}
        </p>
      ) : (
        <p className="mb-3 text-xs sl-text-faint">No formal rubric for this month yet — using general ratings.</p>
      )}

      <div className="space-y-2">
        {roster.map((p) => {
          const rec = monthEvals[p.id];
          const requested = !rec?.completedDate && monthRequests[p.id];
          const isOpen = open === p.id;
          return (
            <div key={p.id} className={`rounded-xl border bg-white p-3 ${requested ? "sl-border-clay" : "sl-border-line2"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : p.id)}
                className="flex w-full items-center justify-between"
              >
                <span className="font-semibold sl-text-ink">{p.name}</span>
                <div className="flex items-center gap-2">
                  {requested && <Pill tone="clay">Requested by parent</Pill>}
                  <Pill tone={rec?.completedDate ? "turf" : "amber"}>
                    {rec?.completedDate ? "Done" : "Due"}
                  </Pill>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>
              {isOpen && <EvalForm existing={rec} rows={rows} onSave={(s, n) => save(p.id, s, n)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvalForm({ existing, rows, onSave }) {
  const [scores, setScores] = useState(existing?.scores || Object.fromEntries(rows.map((r) => [r.key, 0])));
  const [notes, setNotes] = useState(existing?.notes || "");

  return (
    <div className="mt-3 space-y-3 border-t sl-border-line2 pt-3">
      {rows.map((row) => (
        <div key={row.key}>
          <p className="mb-1 text-sm font-medium sl-text-body">
            {row.sub && <span className="sl-text-faint">{row.sub}: </span>}
            {row.label}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: row.scaleMax }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setScores({ ...scores, [row.key]: n })}
                className={`h-8 w-8 rounded-full text-sm font-semibold ${
                  scores[row.key] >= n ? "sl-bg-turf text-white" : "sl-bg-cream sl-text-faint"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {row.hint && <p className="mt-1 text-xs sl-text-faint">{row.hint}</p>}
        </div>
      ))}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for this player…"
        rows={2}
        className="w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
      />
      <button
        onClick={() => onSave(scores, notes)}
        className="w-full rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white"
      >
        Save evaluation
      </button>
    </div>
  );
}

/* ---------------- Plans ---------------- */
function PlansTab({ teamId, team, plans, setPlans, editable, planSuggestions, setPlanSuggestions, coaches, practiceRatings }) {
  if (teamId === "cp") return <CollegePrepPlans plans={plans} setPlans={setPlans} editable={editable} />;
  return (
    <RegularPlansTab
      teamId={teamId}
      team={team}
      plans={plans}
      setPlans={setPlans}
      editable={editable}
      planSuggestions={planSuggestions}
      setPlanSuggestions={setPlanSuggestions}
      coaches={coaches}
      practiceRatings={practiceRatings}
    />
  );
}

function RegularPlansTab({ teamId, team, plans, setPlans, editable, planSuggestions, setPlanSuggestions, coaches, practiceRatings }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const months = teamMonths(plans[teamId]);
  const defaultMonth = months.find((m) => m.key === monthKey(TODAY))?.key || months[0]?.key;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const monthPlans = [...(plans[teamId] || [])]
    .filter((p) => monthKey(p.date) === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));
  const doneCount = monthPlans.filter((p) => p.taught).length;
  const myPendingSuggestions = (planSuggestions || []).filter((s) => s.teamId === teamId);

  function update(planId, patch) {
    const next = {
      ...plans,
      [teamId]: plans[teamId].map((pl) => (pl.id === planId ? { ...pl, ...patch } : pl)),
    };
    setPlans(next);
  }
  function addPlan(plan) {
    setPlans({ ...plans, [teamId]: [...(plans[teamId] || []), plan] });
    setShowAdd(false);
  }
  function submitSuggestion(suggestion) {
    setPlanSuggestions([...(planSuggestions || []), suggestion]);
    setShowSuggest(false);
  }

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          PRACTICE PLANS
        </h2>
        {editable ? (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 rounded-lg sl-bg-pitch px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <Plus size={14} /> New
          </button>
        ) : (
          <button
            onClick={() => setShowSuggest(true)}
            className="flex items-center gap-1 rounded-lg sl-bg-pitch px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <Plus size={14} /> Suggest a plan
          </button>
        )}
      </div>

      {!editable && myPendingSuggestions.length > 0 && (
        <div className="mb-3 space-y-2">
          {myPendingSuggestions.map((s) => (
            <div key={s.id} className="rounded-xl sl-bg-amber-tint px-3 py-2.5 text-sm sl-text-amber-dark">
              <p className="font-semibold">Pending owner review: {s.title}</p>
              <p className="text-xs">{niceDate(s.date)} — submitted {niceDate(s.submittedAt.slice(0, 10))}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-1 flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedMonth(m.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              selectedMonth === m.key ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {monthPlans.length > 0 && (
        <p className="mb-3 text-xs sl-text-faint">
          {doneCount}/{monthPlans.length} sessions taught this month
        </p>
      )}

      <div className="space-y-3">
        {monthPlans.map((pl) => (
          <PlanCard key={pl.id} pl={pl} onUpdate={(patch) => update(pl.id, patch)} editable={editable} ratings={practiceRatings?.[teamId]?.[pl.date]} />
        ))}
      </div>

      {showAdd && <AddPlanModal onSave={addPlan} onClose={() => setShowAdd(false)} />}
      {showSuggest && (
        <SuggestPlanModal
          teamId={teamId}
          coachName={teamCoachDisplay(team, coaches)}
          onSave={submitSuggestion}
          onClose={() => setShowSuggest(false)}
        />
      )}
    </div>
  );
}

function CollegePrepPlans({ plans, setPlans, editable }) {
  const months = Object.keys(DAY3_CURRICULUM);
  const [selectedMonth, setSelectedMonth] = useState(
    months.find((m) => m === monthLabel(monthKey(TODAY)).split(" ")[0]) || months[0]
  );
  const [showAdd, setShowAdd] = useState(false);
  const weeks = DAY3_CURRICULUM[selectedMonth];

  const loggedSessions = [...(plans.cp || [])]
    .filter((p) => monthLabel(monthKey(p.date)).split(" ")[0] === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  function update(planId, patch) {
    setPlans({ ...plans, cp: plans.cp.map((pl) => (pl.id === planId ? { ...pl, ...patch } : pl)) });
  }
  function addPlan(plan) {
    setPlans({ ...plans, cp: [...(plans.cp || []), plan] });
    setShowAdd(false);
  }

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          COLLEGE PREP — DAY 3
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 rounded-lg sl-bg-pitch px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <Plus size={14} /> Log session
        </button>
      </div>
      <p className="mb-3 text-xs sl-text-faint">
        This day varies week to week — use the reference below, then log the actual date once you've scheduled it.
      </p>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              selectedMonth === m ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">Reference guide</p>
      <div className="mb-5 space-y-2">
        {Object.entries(weeks).map(([weekLabel, w]) => (
          <div key={weekLabel} className="rounded-xl border sl-border-line2 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
              {weekLabel}
            </p>
            <p className="mt-1 text-sm font-semibold sl-text-ink">
              {w.pillar} — {w.topic}
            </p>
            <p className="mt-1 text-sm sl-text-body">{w.plan}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">Logged sessions</p>
      <div className="space-y-3">
        {loggedSessions.map((pl) => (
          <PlanCard key={pl.id} pl={pl} onUpdate={(patch) => update(pl.id, patch)} editable={editable} />
        ))}
        {loggedSessions.length === 0 && (
          <p className="py-2 text-sm sl-text-faint">No sessions logged for {selectedMonth} yet.</p>
        )}
      </div>

      {showAdd && <AddPlanModal onSave={addPlan} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function PlanCard({ pl, onUpdate, editable, ratings }) {
  const isToday = pl.date === TODAY;
  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        pl.cancelled ? "sl-border-clay" : isToday ? "sl-border-turf sl-ring-turf" : "sl-border-line2"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
          {niceDate(pl.date)} {isToday && "· TODAY"} {pl.weekLabel && `· ${pl.weekLabel}`}
        </p>
        <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium sl-text-body">
          <input type="checkbox" checked={!!pl.taught} onChange={(e) => onUpdate({ taught: e.target.checked })} />
          Taught
        </label>
      </div>

      <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">Session title</p>
      {editable ? (
        <input
          value={pl.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm font-semibold sl-text-ink outline-none"
        />
      ) : (
        <p className="mb-2 font-semibold sl-text-ink">{pl.title}</p>
      )}

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">Plan</p>
      {pl.planText !== undefined && pl.planText !== "" ? (
        editable ? (
          <textarea
            value={pl.planText}
            onChange={(e) => onUpdate({ planText: e.target.value })}
            rows={3}
            className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm sl-text-body outline-none"
          />
        ) : (
          <p className="mb-2 text-sm sl-text-body">{pl.planText}</p>
        )
      ) : editable ? (
        <div className="mb-2">
          {pl.objectives.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => {
                const next = [...pl.objectives];
                next[i] = e.target.value;
                onUpdate({ objectives: next });
              }}
              className="mb-1 w-full rounded-lg border sl-border-line p-2 text-sm sl-text-body outline-none"
            />
          ))}
          <button
            onClick={() => onUpdate({ objectives: [...pl.objectives, ""] })}
            className="text-xs font-semibold sl-text-pitch underline underline-offset-2"
          >
            + Add objective
          </button>
        </div>
      ) : pl.objectives.length > 0 ? (
        <ul className="mb-2 list-inside list-disc space-y-0.5 text-sm sl-text-body">
          {pl.objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm italic sl-text-faint">No objectives added yet.</p>
      )}

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">What was actually covered</p>
      <textarea
        value={pl.coverage}
        onChange={(e) => onUpdate({ coverage: e.target.value })}
        placeholder={pl.notePrompt || "What did you actually cover / adjust?"}
        rows={2}
        className="mb-2 w-full rounded-lg border sl-border-line sl-bg-offwhite p-2 text-sm outline-none"
      />

      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide sl-text-clay-dark">
        <input type="checkbox" checked={!!pl.cancelled} onChange={(e) => onUpdate({ cancelled: e.target.checked })} />
        Practice cancelled
      </label>
      <textarea
        value={pl.notepad || ""}
        onChange={(e) => onUpdate({ notepad: e.target.value })}
        placeholder="Notepad — weather, traffic, cancellations, anything parents should know right now"
        rows={2}
        className="w-full rounded-lg border sl-border-clay sl-bg-clay-tint p-2 text-sm outline-none"
      />

      {ratings && Object.keys(ratings).length > 0 && (
        <div className="mt-2 rounded-lg sl-bg-cream p-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">Parent feedback</p>
          {Object.values(ratings).map((r, i) => (
            <div key={i} className="mb-1 text-xs sl-text-body">
              <span>{"⭐".repeat(r.rating)}</span>
              {r.comment && <span> — {r.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPlanModal({ onSave, onClose }) {
  const [date, setDate] = useState(TODAY);
  const [title, setTitle] = useState("");
  const [objectives, setObjectives] = useState("");

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sl-bg-scrim sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold sl-text-pitch" style={FONT_DISPLAY}>
            NEW PRACTICE PLAN
          </h3>
          <button onClick={onClose}>
            <X size={18} className="sl-text-muted" />
          </button>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Session title"
          className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
        />
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          placeholder={"One objective per line…\ne.g. Passing triangles\nSmall-sided scrimmage"}
          rows={4}
          className="mb-3 w-full rounded-lg border sl-border-line p-2 text-sm"
        />
        <button
          onClick={() =>
            title.trim() &&
            onSave({
              id: uid(),
              date,
              title: title.trim(),
              objectives: objectives.split("\n").map((s) => s.trim()).filter(Boolean),
              taught: false,
              coverage: "",
              notepad: "",
              cancelled: false,
            })
          }
          className="w-full rounded-lg sl-bg-pitch py-2.5 font-semibold text-white"
        >
          Add plan
        </button>
      </div>
    </div>
  );
}

function SuggestPlanModal({ teamId, coachName, onSave, onClose }) {
  const [date, setDate] = useState(TODAY);
  const [title, setTitle] = useState("");
  const [planText, setPlanText] = useState("");

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sl-bg-scrim sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold sl-text-pitch" style={FONT_DISPLAY}>
            SUGGEST A PLAN
          </h3>
          <button onClick={onClose}>
            <X size={18} className="sl-text-muted" />
          </button>
        </div>
        <p className="mb-2 text-sm sl-text-faint">
          This goes to your owner for review — it won't show up for parents until approved.
        </p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Session title"
          className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
        />
        <textarea
          value={planText}
          onChange={(e) => setPlanText(e.target.value)}
          placeholder="What would this practice cover?"
          rows={4}
          className="mb-3 w-full rounded-lg border sl-border-line p-2 text-sm"
        />
        <button
          onClick={() =>
            title.trim() &&
            onSave({
              id: uid(),
              teamId,
              coachName: coachName || "Coach",
              date,
              title: title.trim(),
              planText: planText.trim(),
              submittedAt: new Date().toISOString(),
            })
          }
          className="w-full rounded-lg sl-bg-pitch py-2.5 font-semibold text-white"
        >
          Submit for owner review
        </button>
      </div>
    </div>
  );
}

/* ---------------- Messages (coach) ---------------- */
/* ---------------- Roster / Contacts ---------------- */
function RosterPlayerCard({ p, teamId, team, teams, onMovePlayer, onArchive, requested, onRequestCompletion }) {
  const [open, setOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const contacts = p.contacts || { Mom: emptyContact(), Dad: emptyContact(), Guardian: emptyContact() };
  const primary = [contacts.Mom, contacts.Dad, contacts.Guardian].find((c) => c?.name)?.name;
  const missing = profileMissingFields(p);
  const trainingTeam = [p.division || null, team ? scheduleLabel(team) : null, PLAN_LABELS[p.plan] || null]
    .filter(Boolean)
    .join(" · ");
  const otherTeams = (teams || []).filter((t) => t.id !== teamId);

  return (
    <div className="rounded-xl border sl-border-line2 bg-white p-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <div className="text-left">
          <p className="font-semibold sl-text-ink">{p.name}</p>
          <p className="text-xs sl-text-faint">{primary || "No contact on file"}</p>
          {trainingTeam && <p className="mt-0.5 text-xs sl-text-turf-dark">{trainingTeam}</p>}
        </div>
        <div className="flex items-center gap-2">
          {missing.length > 0 && <Pill tone="amber">{missing.length} missing</Pill>}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t sl-border-line2 pt-3">
          {["Mom", "Dad", "Guardian"].map((relation) => {
            const c = contacts[relation] || emptyContact();
            if (!c.name && !c.phone && !c.email) return null;
            return (
              <div key={relation}>
                <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted">
                  {relation === "Guardian" ? "Legal Guardian" : relation}
                </p>
                <p className="text-sm sl-text-ink">{c.name || "—"}</p>
                <p className="text-xs sl-text-body">
                  <ClickablePhone value={c.phone} /> {c.phone && c.email && "· "}
                  <ClickableEmail value={c.email} />
                </p>
              </div>
            );
          })}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted">Player details</p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sl-text-ink">
              <span className="sl-text-faint">Division</span>
              <span>{p.division || "—"}</span>
              <span className="sl-text-faint">Schedule</span>
              <span>{team ? scheduleLabel(team) : "—"}</span>
              <span className="sl-text-faint">Plan</span>
              <span>{PLAN_LABELS[p.plan] || "—"}</span>
              <span className="sl-text-faint">DOB</span>
              <span>{p.dob || "—"}</span>
              <span className="sl-text-faint">Grad year</span>
              <span>{p.gradYear || "—"}</span>
              <span className="sl-text-faint">High school</span>
              <span>{p.highSchool || "—"}</span>
              <span className="sl-text-faint">Player phone</span>
              <span>
                <ClickablePhone value={p.playerPhone} />
              </span>
              <span className="sl-text-faint">Instagram</span>
              <span>{p.instagram || "—"}</span>
              <span className="sl-text-faint">Snapchat</span>
              <span>{p.snapchat || "—"}</span>
            </div>
          </div>

          {missing.length > 0 && (
            <div className="rounded-lg sl-bg-amber-tint p-2.5 text-xs sl-text-amber-dark">
              Missing: {missing.join(", ")}
            </div>
          )}
          {missing.length > 0 && (
            <button
              onClick={onRequestCompletion}
              disabled={requested}
              className="w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-60 sl-bg-pitch"
            >
              {requested ? "Requested — parent notified" : "Request parent complete profile"}
            </button>
          )}

          {onMovePlayer && otherTeams.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">Training team</p>
              <div className="flex gap-1.5">
                <select
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="flex-1 rounded-lg border sl-border-line p-2 text-sm outline-none"
                >
                  <option value="">Move to…</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (moveTarget) {
                      onMovePlayer(moveTarget);
                      setMoveTarget("");
                    }
                  }}
                  disabled={!moveTarget}
                  className="rounded-lg sl-bg-pitch px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Move
                </button>
              </div>
            </div>
          )}

          {onArchive && (
            <button
              onClick={onArchive}
              className="w-full rounded-lg border sl-border-clay py-2 text-xs font-semibold sl-text-clay-dark"
            >
              Archive player
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddPlayerTool({ rosters, setRosters, archivedPlayers, setArchivedPlayers, teams, defaultTeamId }) {
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentName, setParentName] = useState("");
  const [targetTeamId, setTargetTeamId] = useState(defaultTeamId || teams[0]?.id);
  const [checked, setChecked] = useState(false);
  const [match, setMatch] = useState(null); // {label, where}
  const [confirmedAdded, setConfirmedAdded] = useState(null); // last action summary

  function normName(n) {
    return n.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function checkDuplicate() {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) return;
    const target = normName(fullName);

    for (const t of teams) {
      const hit = (rosters[t.id] || []).find((p) => normName(p.name) === target);
      if (hit) {
        setMatch({ label: hit.name, where: `already active on ${t.name}` });
        setChecked(true);
        return;
      }
    }
    const archiveHit = (archivedPlayers || []).find((p) => normName(p.name) === target);
    if (archiveHit) {
      setMatch({ label: archiveHit.name, where: "already sitting in the archive" });
      setChecked(true);
      return;
    }
    setMatch(null);
    setChecked(true);
  }

  function reset() {
    setFirstName("");
    setLastName("");
    setParentName("");
    setChecked(false);
    setMatch(null);
    setShowForm(false);
  }

  function addToRoster() {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const [newPlayer] = roster([[fullName, parentName.trim()]]);
    setRosters({ ...rosters, [targetTeamId]: [...(rosters[targetTeamId] || []), newPlayer] });
    setConfirmedAdded({ name: fullName, action: "added" });
    reset();
  }

  function omitToArchive() {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    setArchivedPlayers([...archivedPlayers, archivedPlayer(fullName, parentName.trim(), "", "", "")]);
    setConfirmedAdded({ name: fullName, action: "omitted" });
    reset();
  }

  return (
    <div className="mb-4">
      {!showForm ? (
        <button
          onClick={() => {
            setShowForm(true);
            setConfirmedAdded(null);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed sl-border-line py-2.5 text-sm font-semibold sl-text-pitch"
        >
          <Plus size={15} /> Add player
        </button>
      ) : (
        <div className="rounded-xl border sl-border-line2 bg-white p-3">
          <div className="mb-2 flex gap-1.5">
            <input
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setChecked(false);
              }}
              placeholder="First name"
              className="w-1/2 rounded-lg border sl-border-line p-2 text-sm"
            />
            <input
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setChecked(false);
              }}
              placeholder="Last name"
              className="w-1/2 rounded-lg border sl-border-line p-2 text-sm"
            />
          </div>
          <input
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Parent name (optional)"
            className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
          />
          {teams.length > 1 && (
            <select
              value={targetTeamId}
              onChange={(e) => setTargetTeamId(e.target.value)}
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {!checked && (
            <div className="flex gap-2">
              <button
                onClick={checkDuplicate}
                disabled={!firstName.trim() || !lastName.trim()}
                className="flex-1 rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Check & continue
              </button>
              <button onClick={reset} className="rounded-lg border sl-border-line px-3 py-2 text-sm sl-text-body">
                Cancel
              </button>
            </div>
          )}

          {checked && !match && (
            <div>
              <p className="mb-2 text-xs sl-text-turf-dark">No match found — looks like a new player.</p>
              <div className="flex gap-2">
                <button onClick={addToRoster} className="flex-1 rounded-lg sl-bg-turf py-2 text-sm font-semibold text-white">
                  Add to roster
                </button>
                <button onClick={reset} className="rounded-lg border sl-border-line px-3 py-2 text-sm sl-text-body">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {checked && match && (
            <div>
              <p className="mb-2 text-xs sl-text-amber-dark">
                Possible duplicate — <strong>{match.label}</strong> is {match.where}.
              </p>
              <div className="flex flex-col gap-1.5">
                <button onClick={addToRoster} className="rounded-lg sl-bg-turf py-2 text-sm font-semibold text-white">
                  Add anyway — different person
                </button>
                <button onClick={omitToArchive} className="rounded-lg border sl-border-clay py-2 text-sm font-semibold sl-text-clay-dark">
                  Omit — send to archive instead
                </button>
                <button onClick={reset} className="rounded-lg border sl-border-line py-2 text-sm sl-text-body">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {confirmedAdded && (
        <p className="mt-2 text-xs sl-text-faint">
          {confirmedAdded.name} was {confirmedAdded.action === "added" ? "added to the roster" : "sent to the archive"}.
        </p>
      )}
    </div>
  );
}

function PlayerArchive({ archivedPlayers, setArchivedPlayers, rosters, setRosters, teams, attendance }) {
  const [sortBy, setSortBy] = useState("lastPractice");
  const [restoreTarget, setRestoreTarget] = useState({});

  const sorted = [...archivedPlayers].sort((a, b) => {
    if (sortBy === "lastPractice") {
      const ad = a.lastPracticeDate || "";
      const bd = b.lastPracticeDate || "";
      if (bd !== ad) return bd.localeCompare(ad); // most recent first
      const ag = a.gradYear || "";
      const bg = b.gradYear || "";
      if (ag !== bg) return ag.localeCompare(bg);
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "gradYear") return (a.gradYear || "").localeCompare(b.gradYear || "") || a.name.localeCompare(b.name);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "team") return (a.lastTeamName || "").localeCompare(b.lastTeamName || "");
    return 0;
  });

  function restore(player) {
    const targetTeamId = restoreTarget[player.id];
    if (!targetTeamId) return;
    const { lastTeamId, lastTeamName, archivedAt, lastPracticeDate: _lpd, ...playerData } = player;
    setRosters({
      ...rosters,
      [targetTeamId]: [...(rosters[targetTeamId] || []), playerData],
    });
    setArchivedPlayers(archivedPlayers.filter((p) => p.id !== player.id));
  }

  return (
    <div>
      <p className="mb-3 text-xs sl-text-faint">
        Archived players are never deleted — restore any of them back to a team whenever you're ready.
      </p>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "lastPractice", label: "Last practice" },
          { id: "gradYear", label: "Grad year" },
          { id: "name", label: "First name" },
          { id: "team", label: "Last team" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSortBy(s.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              sortBy === s.id ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((p) => (
          <div key={p.id} className="rounded-xl border sl-border-line2 bg-white p-3">
            <p className="font-semibold sl-text-ink">{p.name}</p>
            <p className="text-xs sl-text-faint">
              {p.lastTeamName || "—"} {p.gradYear && `· Grad ${p.gradYear}`}
            </p>
            <p className="text-xs sl-text-faint">
              Last practice: {p.lastPracticeDate ? niceDate(p.lastPracticeDate) : "No record"}
            </p>
            <div className="mt-2 flex gap-1.5">
              <select
                value={restoreTarget[p.id] || ""}
                onChange={(e) => setRestoreTarget({ ...restoreTarget, [p.id]: e.target.value })}
                className="flex-1 rounded-lg border sl-border-line p-2 text-xs outline-none"
              >
                <option value="">Restore to…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => restore(p)}
                disabled={!restoreTarget[p.id]}
                className="rounded-lg sl-bg-turf px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Restore
              </button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm sl-text-faint">No archived players.</p>}
      </div>
    </div>
  );
}

function CoachContactCard({ coachId, coaches, setCoaches, editable }) {
  const info = coaches?.[coachId] || { firstName: "", lastName: "", phone: "", email: "" };
  const [firstName, setFirstName] = useState(info.firstName);
  const [lastName, setLastName] = useState(info.lastName);
  const [phone, setPhone] = useState(info.phone);
  const [email, setEmail] = useState(info.email);
  const fullName = [info.firstName, info.lastName].filter(Boolean).join(" ") || "Coach";

  function save() {
    setCoaches({ ...coaches, [coachId]: { ...info, firstName, lastName, phone, email } });
  }

  return (
    <div className="mb-4 rounded-xl border sl-border-turf bg-white p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">
        {editable ? "Your contact info" : `${fullName} · Contact`}
      </p>
      {editable ? (
        <>
          <div className="mb-1.5 flex gap-1.5">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-1/2 rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-1/2 rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone"
            type="tel"
            className="mb-1.5 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            type="email"
            className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
          />
          <button onClick={save} className="w-full rounded-lg sl-bg-pitch py-2 text-xs font-semibold text-white">
            Save my info
          </button>
        </>
      ) : (
        <p className="text-sm sl-text-body">
          <ClickablePhone value={info.phone} /> {info.phone && info.email && "· "}
          <ClickableEmail value={info.email} />
        </p>
      )}
    </div>
  );
}

function RosterTab({ roster, teamId, team, teams, rosters, setRosters, profileRequests, setProfileRequests, coaches, setCoaches, account, attendance, archivedPlayers, setArchivedPlayers }) {
  const [showArchive, setShowArchive] = useState(false);

  function requestCompletion(playerId) {
    setProfileRequests({
      ...profileRequests,
      [teamId]: { ...profileRequests[teamId], [playerId]: { requestedAt: new Date().toISOString() } },
    });
  }
  function movePlayer(playerId, targetTeamId) {
    const player = roster.find((p) => p.id === playerId);
    if (!player || !rosters || !setRosters) return;
    setRosters({
      ...rosters,
      [teamId]: rosters[teamId].filter((p) => p.id !== playerId),
      [targetTeamId]: [...(rosters[targetTeamId] || []), player],
    });
  }
  function archivePlayer(playerId) {
    const player = roster.find((p) => p.id === playerId);
    if (!player || !rosters || !setRosters || !setArchivedPlayers) return;
    setRosters({ ...rosters, [teamId]: rosters[teamId].filter((p) => p.id !== playerId) });
    setArchivedPlayers([
      ...archivedPlayers,
      {
        ...player,
        lastTeamId: teamId,
        lastTeamName: team?.name || "",
        archivedAt: new Date().toISOString(),
        lastPracticeDate: lastPracticeDate(playerId, attendance),
      },
    ]);
  }

  if (showArchive) {
    return (
      <div className="px-4 pt-4 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
            PLAYER ARCHIVE
          </h2>
          <button onClick={() => setShowArchive(false)} className="text-xs font-semibold sl-text-pitch underline underline-offset-2">
            Back to roster
          </button>
        </div>
        <PlayerArchive
          archivedPlayers={archivedPlayers}
          setArchivedPlayers={setArchivedPlayers}
          rosters={rosters}
          setRosters={setRosters}
          teams={teams}
          attendance={attendance}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          ROSTER & CONTACTS
        </h2>
        {setArchivedPlayers && (
          <button onClick={() => setShowArchive(true)} className="text-xs font-semibold sl-text-pitch underline underline-offset-2">
            Archive ({archivedPlayers?.length || 0})
          </button>
        )}
      </div>
      <p className="mb-3 text-xs sl-text-faint">
        Player info is view-only — parents fill it in themselves. Missing info can be flagged with a completion
        request.
      </p>

      {setArchivedPlayers && (
        <AddPlayerTool
          rosters={rosters}
          setRosters={setRosters}
          archivedPlayers={archivedPlayers}
          setArchivedPlayers={setArchivedPlayers}
          teams={teams}
          defaultTeamId={teamId}
        />
      )}

      {team &&
        teamCoachIds(team).map((cid) => (
          <CoachContactCard
            key={cid}
            coachId={cid}
            coaches={coaches}
            setCoaches={setCoaches}
            editable={account?.role === "coach" && account.coachId === cid}
          />
        ))}

      <div className="space-y-2">
        {roster.map((p) => (
          <RosterPlayerCard
            key={p.id}
            p={p}
            teamId={teamId}
            team={team}
            teams={teams}
            onMovePlayer={rosters && setRosters ? (targetTeamId) => movePlayer(p.id, targetTeamId) : null}
            onArchive={setArchivedPlayers ? () => archivePlayer(p.id) : null}
            requested={!!profileRequests[teamId]?.[p.id]}
            onRequestCompletion={() => requestCompletion(p.id)}
          />
        ))}
        {roster.length === 0 && <p className="text-sm sl-text-faint">No players on this team yet.</p>}
      </div>
    </div>
  );
}

function MessagesTab({ teamId, roster, messages, setMessages, plans, team, coaches, coachMessages, setCoachMessages, account, newsletters, newsletterReads, setNewsletterReads }) {
  const [text, setText] = useState("");
  const [showDirectList, setShowDirectList] = useState(false);
  const [openPlayerId, setOpenPlayerId] = useState(null);
  const [showNewsletters, setShowNewsletters] = useState(false);
  const teamMessages = [...(messages[teamId] || [])].sort((a, b) => b.date.localeCompare(a.date));
  const todaysPlan = (plans[teamId] || []).find((p) => p.date === TODAY);
  const totalDirectCount = (roster || []).reduce((sum, p) => sum + (coachMessages[p.id]?.length || 0), 0);
  const unread = unreadNewsletterCount(newsletters || [], account?.id, newsletterReads);

  function post() {
    if (!text.trim()) return;
    const msg = { id: uid(), date: TODAY, author: coachFullName(account?.coachId, coaches) || teamCoachDisplay(team, coaches), text: text.trim() };
    setMessages({ ...messages, [teamId]: [...(messages[teamId] || []), msg] });
    setText("");
  }
  function openNewsletters() {
    setNewsletterReads({ ...newsletterReads, [account.id]: new Date().toISOString() });
    setShowNewsletters(true);
  }

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          MESSAGE PARENTS
        </h2>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={openNewsletters}
            className="relative flex items-center gap-1 rounded-lg border sl-border-line px-2.5 py-1.5 text-xs font-semibold sl-text-pitch"
          >
            <Mail size={13} /> Newsletters
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full sl-bg-clay text-white" style={{ fontSize: 9 }}>
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowDirectList(true)}
            className="flex items-center gap-1 rounded-lg sl-bg-pitch px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <MessageCircle size={13} /> Direct{totalDirectCount > 0 ? ` (${totalDirectCount})` : ""}
          </button>
        </div>
      </div>
      <div className="rounded-xl border sl-border-line2 bg-white p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What are you covering, what should parents know…"
          rows={3}
          className="w-full resize-none rounded-lg border sl-border-line p-2 text-sm outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          {todaysPlan?.coverage ? (
            <button
              onClick={() => setText(`Today: ${todaysPlan.title}. ${todaysPlan.coverage}`)}
              className="text-xs font-semibold sl-text-pitch underline underline-offset-2"
            >
              Use today's practice notes
            </button>
          ) : (
            <span />
          )}
          <button onClick={post} className="rounded-lg sl-bg-pitch px-4 py-2 text-sm font-semibold text-white">
            Post
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {teamMessages.map((m) => (
          <div key={m.id} className="rounded-xl border sl-border-line2 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
              {niceDate(m.date)} · {m.author}
            </p>
            <p className="mt-1 text-sm sl-text-ink">{m.text}</p>
          </div>
        ))}
        {teamMessages.length === 0 && (
          <p className="py-6 text-center text-sm sl-text-faint">No updates posted yet.</p>
        )}
      </div>

      {showDirectList && (
        <div className="fixed inset-0 z-30 flex items-end justify-center sl-bg-scrim sm:items-center">
          <div style={{ maxHeight: "80vh" }} className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold sl-text-pitch" style={FONT_DISPLAY}>
                MESSAGE A PARENT
              </h3>
              <button onClick={() => setShowDirectList(false)}>
                <X size={18} className="sl-text-muted" />
              </button>
            </div>
            <p className="mb-3 text-xs sl-text-faint">Pick a player — this opens a private thread just between you and their parent.</p>
            <div className="space-y-1.5">
              {(roster || []).map((p) => {
                const count = (coachMessages[p.id] || []).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setShowDirectList(false);
                      setOpenPlayerId(p.id);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border sl-border-line2 p-2.5 text-left text-sm"
                  >
                    <span className="font-medium sl-text-ink">{p.name}</span>
                    {count > 0 && <span className="text-xs sl-text-faint">{count} message{count > 1 ? "s" : ""}</span>}
                  </button>
                );
              })}
              {(!roster || roster.length === 0) && <p className="text-sm sl-text-faint">No players on this roster yet.</p>}
            </div>
          </div>
        </div>
      )}

      {openPlayerId && (
        <CoachThreadModal
          threadKey={openPlayerId}
          recipientLabel={roster.find((p) => p.id === openPlayerId)?.name}
          coachMessages={coachMessages}
          setCoachMessages={setCoachMessages}
          authorRole="coach"
          coachName={teamCoachDisplay(team, coaches)}
          onClose={() => setOpenPlayerId(null)}
        />
      )}
      {showNewsletters && (
        <div className="fixed inset-0 z-30 flex items-end justify-center sl-bg-scrim sm:items-center">
          <div style={{ maxHeight: "80vh" }} className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold sl-text-pitch" style={FONT_DISPLAY}>
                NEWSLETTERS
              </h3>
              <button onClick={() => setShowNewsletters(false)}>
                <X size={18} className="sl-text-muted" />
              </button>
            </div>
            <NewsletterArchive newsletters={newsletters || []} />
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   PARENT BODY
===================================================================== */
/* =====================================================================
   ADMIN / OWNER DASHBOARD
===================================================================== */
function normName(n) {
  return (n || "").trim().toLowerCase();
}

function computeDashboard(teams, rosters, attendance, plans, rsvps, coaches) {
  // 1. total unique players across the whole program
  const allNames = new Set();
  teams.forEach((t) => (rosters[t.id] || []).forEach((p) => allNames.add(normName(p.name))));

  // 2. unique players per coach (a coach may run more than one team)
  const coachIds = [...new Set(teams.flatMap((t) => teamCoachIds(t)))];
  const byCoach = coachIds.map((coachId) => {
    const names = new Set();
    teams
      .filter((t) => teamCoachIds(t).includes(coachId))
      .forEach((t) => (rosters[t.id] || []).forEach((p) => names.add(normName(p.name))));
    return { coach: coachFullName(coachId, coaches), count: names.size };
  });

  // 3 & 4. per-team roster completion %, attendance breakdown, and
  // unannounced late/absences (actual late/absent with no parent heads-up)
  const byTeam = teams.map((team) => {
    const teamRoster = rosters[team.id] || [];
    const scheduled = (plans[team.id] || []).filter((p) => p.date <= TODAY);
    let completeDays = 0;
    let present = 0,
      late = 0,
      absent = 0,
      unannounced = 0;

    const teamAttendance = attendance[team.id] || {};
    const teamRsvps = rsvps[team.id] || {};
    scheduled.forEach((session) => {
      const dayRecord = teamAttendance[session.date] || {};
      const rosterIds = teamRoster.map((p) => p.id);
      const allMarked = rosterIds.every((id) => dayRecord[id]?.status);
      const notesOk = Object.values(dayRecord).every(
        (rec) => !(rec.status === "late" || rec.status === "absent") || rec.note?.trim()
      );
      if (allMarked && notesOk && rosterIds.length > 0) completeDays += 1;
    });

    Object.entries(teamAttendance).forEach(([date, dayRecord]) => {
      Object.entries(dayRecord).forEach(([playerId, rec]) => {
        if (rec.status === "present") present += 1;
        else if (rec.status === "late") late += 1;
        else if (rec.status === "absent") absent += 1;
        if (!rec.isDropIn && isSurprise(rec.status, teamRsvps[date]?.[playerId]?.status)) unannounced += 1;
      });
    });
    const totalMarked = present + late + absent;

    return {
      team,
      rosterSize: teamRoster.length,
      scheduledCount: scheduled.length,
      completeDays,
      completionPct: scheduled.length ? Math.round((completeDays / scheduled.length) * 100) : null,
      present,
      late,
      absent,
      unannounced,
      totalMarked,
      presentPct: totalMarked ? Math.round((present / totalMarked) * 100) : 0,
      latePct: totalMarked ? Math.round((late / totalMarked) * 100) : 0,
      absentPct: totalMarked ? Math.round((absent / totalMarked) * 100) : 0,
    };
  });

  return { totalUnique: allNames.size, byCoach, byTeam };
}

function AdminBody({
  teams,
  rosters,
  setRosters,
  attendance,
  plans,
  setPlans,
  evaluations,
  setEvaluations,
  evalRequests,
  setEvalRequests,
  evalRubric,
  setEvalRubric,
  profileRequests,
  setProfileRequests,
  coaches,
  setCoaches,
  setTeams,
  planSuggestions,
  setPlanSuggestions,
  rsvps,
  events,
  setEvents,
  eventRegs,
  setEventRegs,
  newsletters,
  setNewsletters,
  practiceRatings,
  archivedPlayers,
  setArchivedPlayers,
}) {
  const [section, setSection] = useState("dashboard");

  return (
    <div className="px-4 pt-4 pb-8">
      <h2 className="mb-3 text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
        OWNER
      </h2>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "roster", label: "Roster" },
          { id: "coaches", label: "Coaches" },
          { id: "people", label: "People" },
          { id: "plans", label: "Plans" },
          { id: "evals", label: "Evals" },
          { id: "events", label: "Events" },
          { id: "newsletters", label: "Newsletters" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              section === s.id ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "dashboard" && <ProgramDashboard teams={teams} rosters={rosters} attendance={attendance} plans={plans} rsvps={rsvps} coaches={coaches} />}
      {section === "roster" && <AdminRosterViewer teams={teams} rosters={rosters} setRosters={setRosters} profileRequests={profileRequests} setProfileRequests={setProfileRequests} coaches={coaches} attendance={attendance} archivedPlayers={archivedPlayers} setArchivedPlayers={setArchivedPlayers} />}
      {section === "coaches" && (
        <AdminCoachManager teams={teams} setTeams={setTeams} coaches={coaches} setCoaches={setCoaches} />
      )}
      {section === "people" && <PendingApprovalsPanel teams={teams} rosters={rosters} coaches={coaches} />}
      {section === "plans" && <AdminPlansEditor teams={teams} plans={plans} setPlans={setPlans} planSuggestions={planSuggestions} setPlanSuggestions={setPlanSuggestions} coaches={coaches} practiceRatings={practiceRatings} />}
      {section === "evals" && <AdminEvalsEditor evalRubric={evalRubric} setEvalRubric={setEvalRubric} />}
      {section === "events" && <EventsManager events={events} setEvents={setEvents} eventRegs={eventRegs} setEventRegs={setEventRegs} rosters={rosters} />}
      {section === "newsletters" && <NewsletterComposer newsletters={newsletters} setNewsletters={setNewsletters} />}
    </div>
  );
}

function ProgramDashboard({ teams, rosters, attendance, plans, rsvps, coaches }) {
  const { totalUnique, byCoach, byTeam } = computeDashboard(teams, rosters, attendance, plans, rsvps, coaches);

  return (
    <div>
      <div className="rounded-xl sl-bg-pitch p-4 text-white">
        <p className="text-xs uppercase tracking-wide sl-text-mint">Unique players training</p>
        <p className="text-4xl font-bold" style={FONT_DISPLAY}>
          {totalUnique}
        </p>
        <p className="mt-1 text-xs sl-text-mint">across {teams.length} training teams</p>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide sl-text-muted">By coach</h3>
      <div className="space-y-2">
        {byCoach.map(({ coach, count }) => (
          <div key={coach} className="flex items-center justify-between rounded-xl border sl-border-line2 bg-white p-3">
            <span className="font-semibold sl-text-ink">{coach}</span>
            <Pill tone="turf">{count} players</Pill>
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide sl-text-muted">By training team</h3>
      <div className="space-y-3">
        {byTeam.map(({ team, rosterSize, scheduledCount, completionPct, present, late, absent, unannounced, totalMarked, presentPct, latePct, absentPct, completeDays }) => (
          <div key={team.id} className="rounded-xl border sl-border-line2 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold sl-text-ink">{team.name}</p>
              <span className="text-xs sl-text-faint">{rosterSize} players</span>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between text-xs sl-text-muted">
                <span>Attendance completed on time</span>
                <span className="font-semibold sl-text-ink">
                  {completionPct === null ? "No sessions yet" : `${completionPct}%`}
                </span>
              </div>
              {completionPct !== null && (
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full sl-bg-cream">
                  <div className="h-full sl-bg-turf" style={{ width: `${completionPct}%` }} />
                </div>
              )}
              <p className="mt-0.5 text-xs sl-text-faint">
                {completionPct !== null && `${completeDays}/${scheduledCount} sessions fully marked`}
              </p>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-xs sl-text-muted">Attendance breakdown</p>
              {totalMarked > 0 ? (
                <>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                    <div className="sl-bg-turf" style={{ width: `${presentPct}%` }} />
                    <div className="sl-bg-amber" style={{ width: `${latePct}%` }} />
                    <div className="sl-bg-clay" style={{ width: `${absentPct}%` }} />
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs sl-text-body">
                    <span>🟢 {presentPct}% present</span>
                    <span>🟠 {latePct}% late</span>
                    <span>🔴 {absentPct}% absent</span>
                  </div>
                </>
              ) : (
                <p className="text-xs sl-text-faint">No attendance recorded yet.</p>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg sl-bg-amber-tint px-2.5 py-2 text-xs sl-text-amber-dark">
              <span className="font-semibold">Unannounced late/absent</span>
              <span className="font-bold">{unannounced}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPlansEditor({ teams, plans, setPlans, planSuggestions, setPlanSuggestions, coaches, practiceRatings }) {
  const [teamId, setTeamId] = useState(teams[0]?.id);
  const team = teams.find((t) => t.id === teamId);
  const pending = planSuggestions || [];

  function approve(s) {
    const teamPlans = plans[s.teamId] || [];
    const existing = teamPlans.find((p) => p.date === s.date);
    const nextTeamPlans = existing
      ? teamPlans.map((p) => (p.date === s.date ? { ...p, title: s.title, planText: s.planText, objectives: [] } : p))
      : [
          ...teamPlans,
          { id: uid(), date: s.date, title: s.title, planText: s.planText, objectives: [], taught: false, coverage: "", notepad: "", cancelled: false },
        ];
    setPlans({ ...plans, [s.teamId]: nextTeamPlans });
    setPlanSuggestions(pending.filter((x) => x.id !== s.id));
  }
  function dismiss(s) {
    setPlanSuggestions(pending.filter((x) => x.id !== s.id));
  }

  return (
    <div>
      <p className="mb-3 text-xs sl-text-faint">Edit any team's practice plans — coaches see this content read-only.</p>

      {pending.length > 0 && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">
            Coach suggestions ({pending.length})
          </p>
          <div className="mb-4 space-y-2">
            {pending.map((s) => {
              const t = teams.find((x) => x.id === s.teamId);
              return (
                <div key={s.id} className="rounded-xl border sl-border-line2 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
                    {t?.name} · {niceDate(s.date)}
                  </p>
                  <p className="mt-1 font-semibold sl-text-ink">{s.title}</p>
                  <p className="mt-1 text-sm sl-text-body">{s.planText}</p>
                  <p className="mt-1 text-xs sl-text-faint">Suggested by {s.coachName}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => approve(s)} className="flex-1 rounded-lg sl-bg-turf py-1.5 text-xs font-semibold text-white">
                      Approve & add to calendar
                    </button>
                    <button onClick={() => dismiss(s)} className="rounded-lg border sl-border-line px-3 py-1.5 text-xs sl-text-body">
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="mb-3 w-full rounded-lg border sl-border-line bg-white px-3 py-2 text-sm sl-text-pitch"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="-mx-4">
        <PlansTab teamId={teamId} team={team} plans={plans} setPlans={setPlans} editable coaches={coaches} practiceRatings={practiceRatings} />
      </div>
    </div>
  );
}

function AdminEvalsEditor({ evalRubric, setEvalRubric }) {
  const months = Object.keys(evalRubric);
  const [month, setMonth] = useState(months[0]);
  const rows = evalRubric[month] || [];

  function updateRow(i, patch) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setEvalRubric({ ...evalRubric, [month]: next });
  }
  function removeRow(i) {
    setEvalRubric({ ...evalRubric, [month]: rows.filter((_, idx) => idx !== i) });
  }
  function addRow() {
    setEvalRubric({ ...evalRubric, [month]: [...rows, { skillArea: "", criteria: "", scale: "" }] });
  }

  return (
    <div>
      <p className="mb-3 text-xs sl-text-faint">
        The evaluation criteria coaches score players against each month — not individual player results.
      </p>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              month === m ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border sl-border-line2 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted">Criterion {i + 1}</p>
              <button onClick={() => removeRow(i)} className="sl-text-clay-dark">
                <X size={16} />
              </button>
            </div>
            <input
              value={row.skillArea}
              onChange={(e) => updateRow(i, { skillArea: e.target.value })}
              placeholder="Skill area (e.g. Serving)"
              className="mb-1.5 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
            <input
              value={row.criteria}
              onChange={(e) => updateRow(i, { criteria: e.target.value })}
              placeholder="What's being scored (e.g. Serve accuracy to called zone)"
              className="mb-1.5 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
            <textarea
              value={row.scale}
              onChange={(e) => updateRow(i, { scale: e.target.value })}
              placeholder="Scoring scale (e.g. 1 = Rarely finds zone | 2 = ... | 3 = ... | 4 = ...)"
              rows={2}
              className="w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm sl-text-faint">No criteria for {month} yet.</p>}
      </div>

      <button
        onClick={addRow}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed sl-border-line py-2.5 text-sm font-semibold sl-text-pitch"
      >
        <Plus size={15} /> Add criterion to {month}
      </button>
    </div>
  );
}

function PendingApprovalsPanel({ teams, rosters, coaches }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState({}); // {profileId: {role, coachId, playerId}}

  const allPlayers = teams.flatMap((t) => (rosters[t.id] || []).map((p) => ({ ...p, teamName: t.name })));

  async function refresh() {
    setLoading(true);
    const [p, a] = await Promise.all([listPendingProfiles(), listAllProfiles()]);
    setPending(p);
    setApproved(a.filter((x) => x.approved));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function setField(id, field, value) {
    setChoice({ ...choice, [id]: { ...choice[id], [field]: value } });
  }

  async function approve(profile) {
    const c = choice[profile.id] || {};
    if (!c.role) return;
    if (c.role === "coach" && !c.coachId) return;
    if (c.role === "parent" && !c.playerId) return;
    await approveProfile(profile.id, {
      role: c.role,
      coachId: c.role === "coach" ? c.coachId : null,
      playerId: c.role === "parent" ? c.playerId : null,
      label: profile.label || profile.email,
    });
    refresh();
  }

  async function revoke(id) {
    await revokeProfile(id);
    refresh();
  }

  if (loading) return <p className="text-sm sl-text-faint">Loading…</p>;

  return (
    <div>
      <p className="mb-3 text-xs sl-text-faint">
        When someone signs up in the app, they land here until you assign their role and (for coaches/parents) link
        them to the right record.
      </p>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">
        Pending sign-ups ({pending.length})
      </p>
      <div className="mb-6 space-y-2">
        {pending.map((p) => {
          const c = choice[p.id] || {};
          return (
            <div key={p.id} className="rounded-xl border sl-border-line2 bg-white p-3">
              <p className="text-sm font-semibold sl-text-ink">{p.label || p.email}</p>
              <p className="mb-2 text-xs sl-text-faint">{p.email}</p>
              <div className="mb-2 flex gap-1.5">
                {[
                  { id: "coach", label: "Coach" },
                  { id: "parent", label: "Parent" },
                  { id: "admin", label: "Director" },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setField(p.id, "role", r.id)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${
                      c.role === r.id ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {c.role === "coach" && (
                <select
                  value={c.coachId || ""}
                  onChange={(e) => setField(p.id, "coachId", e.target.value)}
                  className="mb-2 w-full rounded-lg border sl-border-line p-2 text-xs"
                >
                  <option value="">Which coach is this?</option>
                  {Object.keys(coaches).map((id) => (
                    <option key={id} value={id}>
                      {coachFullName(id, coaches)}
                    </option>
                  ))}
                </select>
              )}
              {c.role === "parent" && (
                <select
                  value={c.playerId || ""}
                  onChange={(e) => setField(p.id, "playerId", e.target.value)}
                  className="mb-2 w-full rounded-lg border sl-border-line p-2 text-xs"
                >
                  <option value="">Which player is their child?</option>
                  {allPlayers.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} — {pl.teamName}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => approve(p)}
                disabled={!c.role || (c.role === "coach" && !c.coachId) || (c.role === "parent" && !c.playerId)}
                className="w-full rounded-lg sl-bg-turf py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve & grant access
              </button>
            </div>
          );
        })}
        {pending.length === 0 && <p className="text-sm sl-text-faint">Nobody waiting right now.</p>}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">Approved people</p>
      <div className="space-y-2">
        {approved.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border sl-border-line2 bg-white p-3">
            <div>
              <p className="text-sm font-semibold sl-text-ink">{p.label || p.email}</p>
              <p className="text-xs sl-text-faint">
                {p.role === "coach" ? `Coach — ${coachFullName(p.coach_id, coaches)}` : p.role === "admin" ? "Director" : "Parent"}
              </p>
            </div>
            <button onClick={() => revoke(p.id)} className="text-xs font-semibold sl-text-clay-dark underline underline-offset-2">
              Revoke
            </button>
          </div>
        ))}
        {approved.length === 0 && <p className="text-sm sl-text-faint">No one approved yet.</p>}
      </div>
    </div>
  );
}

function AdminCoachManager({ teams, setTeams, coaches, setCoaches }) {
  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const coachIds = Object.keys(coaches);

  function toggleTeamCoach(teamId, coachId) {
    setTeams(
      teams.map((t) => {
        if (t.id !== teamId) return t;
        const current = teamCoachIds(t);
        const next = current.includes(coachId) ? current.filter((id) => id !== coachId) : [...current, coachId];
        return { ...t, coachIds: next, coachId: undefined };
      })
    );
  }
  function updateCoach(coachId, patch) {
    setCoaches({ ...coaches, [coachId]: { ...coaches[coachId], ...patch } });
  }
  function addCoach() {
    if (!firstName.trim()) return;
    const id = `c-${uid()}`;
    setCoaches({ ...coaches, [id]: { firstName: firstName.trim(), lastName: lastName.trim(), phone: "", email: "", archived: false } });
    setFirstName("");
    setLastName("");
    setShowAdd(false);
  }

  return (
    <div>
      <p className="mb-3 text-xs sl-text-faint">
        Add coach identities and assign them to teams. To actually give someone login access, have them sign up in
        the app themselves — you'll link their sign-up to one of these coach records in "Pending sign-ups" below.
      </p>

      <button
        onClick={() => setShowAdd(true)}
        className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed sl-border-line py-2.5 text-sm font-semibold sl-text-pitch"
      >
        <Plus size={15} /> Add sub / replacement coach
      </button>

      {showAdd && (
        <div className="mb-4 rounded-xl border sl-border-line2 bg-white p-3">
          <div className="mb-2 flex gap-1.5">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="w-1/2 rounded-lg border sl-border-line p-2 text-sm" />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="w-1/2 rounded-lg border sl-border-line p-2 text-sm" />
          </div>
          <p className="mb-2 text-xs sl-text-faint">
            This creates the coach's identity record (name, contact info, team assignments). Have them sign up
            separately with their own email — you'll link the two in "Pending sign-ups."
          </p>
          <div className="flex gap-2">
            <button onClick={addCoach} className="flex-1 rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white">
              Add coach
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border sl-border-line px-3 py-2 text-sm sl-text-body">
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">Coaches</p>
      <div className="mb-5 space-y-2">
        {coachIds.map((id) => {
          const c = coaches[id];
          const assignedTeams = teams.filter((t) => teamCoachIds(t).includes(id));
          return (
            <div key={id} className="rounded-xl border sl-border-line2 bg-white p-3">
              <div className="mb-1.5 flex gap-1.5">
                <input
                  value={c.firstName}
                  onChange={(e) => updateCoach(id, { firstName: e.target.value })}
                  placeholder="First name"
                  className="w-1/2 rounded-lg border sl-border-line p-2 text-sm"
                />
                <input
                  value={c.lastName}
                  onChange={(e) => updateCoach(id, { lastName: e.target.value })}
                  placeholder="Last name"
                  className="w-1/2 rounded-lg border sl-border-line p-2 text-sm"
                />
              </div>
              <div className="mb-1.5 flex gap-1.5">
                <input
                  value={c.phone}
                  onChange={(e) => updateCoach(id, { phone: e.target.value })}
                  placeholder="Phone"
                  type="tel"
                  className="w-1/2 rounded-lg border sl-border-line p-2 text-sm"
                />
                <input
                  value={c.email}
                  onChange={(e) => updateCoach(id, { email: e.target.value })}
                  placeholder="Email"
                  type="email"
                  className="w-1/2 rounded-lg border sl-border-line p-2 text-sm"
                />
                {c.phone && (
                  <a
                    href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                    className="flex shrink-0 items-center justify-center rounded-lg sl-bg-turf px-2.5 text-white"
                    title="Call"
                  >
                    <Phone size={16} />
                  </a>
                )}
              </div>
              <p className="mt-2 text-xs sl-text-faint">
                {assignedTeams.length > 0 ? `Coaching: ${assignedTeams.map((t) => t.name).join(", ")}` : "Not assigned to a team yet"}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">Team assignments</p>
      <p className="mb-2 text-xs sl-text-faint">A team can have more than one coach — tap to toggle.</p>
      <div className="space-y-2">
        {teams.map((t) => {
          const assigned = teamCoachIds(t);
          return (
            <div key={t.id} className="rounded-xl border sl-border-line2 bg-white p-3">
              <p className="mb-1.5 text-sm font-semibold sl-text-ink">{t.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {coachIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => toggleTeamCoach(t.id, id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      assigned.includes(id) ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
                    }`}
                  >
                    {coachFullName(id, coaches)}
                  </button>
                ))}
              </div>
              {assigned.length === 0 && <p className="mt-1 text-xs sl-text-clay-dark">No coach assigned</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminRosterViewer({ teams, rosters, setRosters, profileRequests, setProfileRequests, coaches, attendance, archivedPlayers, setArchivedPlayers }) {
  const [query, setQuery] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const allPlayers = teams.flatMap((t) => (rosters[t.id] || []).map((p) => ({ p, team: t })));
  const q = query.trim().toLowerCase();
  const results = q
    ? allPlayers.filter(
        ({ p }) =>
          p.name.toLowerCase().includes(q) ||
          ["Mom", "Dad", "Guardian"].some((r) => p.contacts?.[r]?.name?.toLowerCase().includes(q))
      )
    : allPlayers;

  const coachIds = [...new Set(teams.flatMap((t) => teamCoachIds(t)))];

  function movePlayer(playerId, fromTeamId, targetTeamId) {
    const player = (rosters[fromTeamId] || []).find((p) => p.id === playerId);
    if (!player) return;
    setRosters({
      ...rosters,
      [fromTeamId]: rosters[fromTeamId].filter((p) => p.id !== playerId),
      [targetTeamId]: [...(rosters[targetTeamId] || []), player],
    });
  }
  function archivePlayer(playerId, fromTeamId, teamName) {
    const player = (rosters[fromTeamId] || []).find((p) => p.id === playerId);
    if (!player) return;
    setRosters({ ...rosters, [fromTeamId]: rosters[fromTeamId].filter((p) => p.id !== playerId) });
    setArchivedPlayers([
      ...archivedPlayers,
      {
        ...player,
        lastTeamId: fromTeamId,
        lastTeamName: teamName,
        archivedAt: new Date().toISOString(),
        lastPracticeDate: lastPracticeDate(playerId, attendance),
      },
    ]);
  }

  if (showArchive) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
            PLAYER ARCHIVE
          </h2>
          <button onClick={() => setShowArchive(false)} className="text-xs font-semibold sl-text-pitch underline underline-offset-2">
            Back to roster
          </button>
        </div>
        <PlayerArchive
          archivedPlayers={archivedPlayers}
          setArchivedPlayers={setArchivedPlayers}
          rosters={rosters}
          setRosters={setRosters}
          teams={teams}
          attendance={attendance}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs sl-text-faint">
          Roster, parent contact numbers, and player profiles across every team — view-only, same as coaches see.
        </p>
        <button onClick={() => setShowArchive(true)} className="shrink-0 text-xs font-semibold sl-text-pitch underline underline-offset-2">
          Archive ({archivedPlayers?.length || 0})
        </button>
      </div>

      <AddPlayerTool
        rosters={rosters}
        setRosters={setRosters}
        archivedPlayers={archivedPlayers}
        setArchivedPlayers={setArchivedPlayers}
        teams={teams}
        defaultTeamId={teams[0]?.id}
      />

      <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide sl-text-muted">Coaches</p>
      <div className="mb-4 space-y-2">
        {coachIds.map((id) => (
          <CoachContactCard key={id} coachId={id} coaches={coaches} editable={false} />
        ))}
      </div>

      <div className="relative mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players or parents by name…"
          className="w-full rounded-lg border sl-border-line bg-white p-2.5 text-sm outline-none"
        />
      </div>

      <p className="mb-2 text-xs sl-text-faint">
        {results.length} player{results.length !== 1 ? "s" : ""} {q && `matching "${query}"`}
      </p>
      <div className="space-y-2">
        {results.map(({ p, team }) => (
          <RosterPlayerCard
            key={p.id}
            p={p}
            teamId={team.id}
            team={team}
            teams={teams}
            onMovePlayer={setRosters ? (targetTeamId) => movePlayer(p.id, team.id, targetTeamId) : null}
            onArchive={() => archivePlayer(p.id, team.id, team.name)}
            requested={!!profileRequests[team.id]?.[p.id]}
            onRequestCompletion={() =>
              setProfileRequests({
                ...profileRequests,
                [team.id]: { ...profileRequests[team.id], [p.id]: { requestedAt: new Date().toISOString() } },
              })
            }
          />
        ))}
        {results.length === 0 && <p className="text-sm sl-text-faint">No players found.</p>}
      </div>
    </div>
  );
}

function EventsManager({ events, setEvents, eventRegs, setEventRegs, roster, rosters }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("BOMB");
  const [date, setDate] = useState(TODAY);
  const [location, setLocation] = useState("");
  const [host, setHost] = useState("The Sand Club");
  const [description, setDescription] = useState("");
  const [registerUrl, setRegisterUrl] = useState("");
  const [expanded, setExpanded] = useState(null);

  // Coaches see their own team's roster; Owner (no single roster) sees
  // every player across every team, so nobody gets missed.
  const scopedPlayers = roster || Object.values(rosters || {}).flat();

  function addEvent() {
    if (!name.trim()) return;
    setEvents([
      ...events,
      {
        id: uid(),
        name: name.trim(),
        type,
        date,
        location: location.trim() || "TBD",
        host: host.trim() || "The Sand Club",
        description: description.trim(),
        registerUrl: registerUrl.trim() || undefined,
      },
    ]);
    setName("");
    setLocation("");
    setHost("The Sand Club");
    setDescription("");
    setRegisterUrl("");
    setShowAdd(false);
  }
  function setPaidStatus(eventId, playerId, status) {
    setEventRegs({
      ...eventRegs,
      [eventId]: { ...eventRegs[eventId], [playerId]: { ...eventRegs[eventId]?.[playerId], paidStatus: status } },
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs sl-text-faint">
          BOMB, National Qualifier, and other events players should attend — including ones The Sand Club doesn't
          host. Always sorted chronologically.
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg sl-bg-pitch px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-xl border sl-border-line2 bg-white p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
          <div className="mb-2 flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="flex-1 rounded-lg border sl-border-line p-2 text-sm">
              <option value="BOMB">BOMB</option>
              <option value="National Qualifier">National Qualifier</option>
              <option value="Other">Other</option>
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border sl-border-line p-2 text-sm" />
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Hosted by" className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
          <p className="mb-2 text-xs sl-text-faint">Leave as "The Sand Club" for our own events, or enter another club/org if we just want players to attend.</p>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description for parents" rows={2} className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
          <input value={registerUrl} onChange={(e) => setRegisterUrl(e.target.value)} placeholder="Registration link (optional, e.g. VolleyballLife URL)" type="url" className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={addEvent} className="flex-1 rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white">Add event</button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border sl-border-line px-3 py-2 text-sm sl-text-body">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((ev) => {
          const eventRegMap = eventRegs[ev.id] || {};
          const regEntries = Object.entries(eventRegMap).filter(([, r]) => r.registered);
          const withPartner = regEntries.filter(([, r]) => r.hasPartner).length;
          const needPartner = regEntries.filter(([, r]) => !r.hasPartner && !r.fallbackBOMB).length;
          const bomb = regEntries.filter(([, r]) => r.fallbackBOMB).length;
          const accountedFor = scopedPlayers.filter((p) => eventRegMap[p.id]?.paidStatus).length;
          const notSandClub = ev.host && ev.host !== "The Sand Club";
          const isOpen = expanded === ev.id;
          return (
            <div key={ev.id} className="rounded-xl border sl-border-line2 bg-white p-3">
              <Pill tone={ev.type === "National Qualifier" ? "clay" : "turf"}>{ev.type}</Pill>
              <p className="mt-1 font-semibold sl-text-ink">{ev.name}</p>
              <p className="text-xs sl-text-faint">
                {niceDate(ev.date)} · {ev.location} {notSandClub && `· Hosted by ${ev.host}`}
              </p>
              {ev.registerUrl && (
                <a
                  href={ev.registerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold sl-text-pitch underline underline-offset-2"
                >
                  VolleyballLife listing →
                </a>
              )}
              <p className="mt-2 text-xs sl-text-muted">
                {regEntries.length} self-registered · {accountedFor}/{scopedPlayers.length} players accounted for
              </p>
              {regEntries.length > 0 && (
                <div className="mt-1 flex gap-3 text-xs sl-text-body">
                  <span>✅ {withPartner} with partner</span>
                  <span>⚠️ {needPartner} need one</span>
                  <span>🔁 {bomb} moved to BOMB</span>
                </div>
              )}

              <button
                onClick={() => setExpanded(isOpen ? null : ev.id)}
                className="mt-2 flex items-center gap-1 text-xs font-semibold sl-text-pitch underline underline-offset-2"
              >
                {isOpen ? "Hide roster" : "Mark players"} {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {isOpen && (
                <div className="mt-2 space-y-2 border-t sl-border-line2 pt-2">
                  {scopedPlayers.map((p) => {
                    const r = eventRegMap[p.id] || {};
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs sl-text-body">
                        <span>
                          {p.name}
                          {r.registered && (
                            <span className="sl-text-faint">
                              {" "}
                              — {r.fallbackBOMB ? "BOMB" : r.hasPartner ? `partner: ${r.partnerName || "—"}` : "needs partner"}
                            </span>
                          )}
                        </span>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() => setPaidStatus(ev.id, p.id, r.paidStatus === "paid" ? null : "paid")}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${r.paidStatus === "paid" ? "sl-bg-amber text-white" : "sl-bg-cream sl-text-body"}`}
                          >
                            Paid
                          </button>
                          <button
                            onClick={() => setPaidStatus(ev.id, p.id, r.paidStatus === "free" ? null : "free")}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${r.paidStatus === "free" ? "sl-bg-turf text-white" : "sl-bg-cream sl-text-body"}`}
                          >
                            Free
                          </button>
                          <button
                            onClick={() => setPaidStatus(ev.id, p.id, r.paidStatus === "notAttending" ? null : "notAttending")}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${r.paidStatus === "notAttending" ? "sl-bg-clay text-white" : "sl-bg-cream sl-text-body"}`}
                          >
                            Not attending
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {scopedPlayers.length === 0 && <p className="text-xs sl-text-faint">No players to show.</p>}
                </div>
              )}
            </div>
          );
        })}
        {events.length === 0 && <p className="text-sm sl-text-faint">No events posted yet.</p>}
      </div>
    </div>
  );
}

function NewsletterComposer({ newsletters, setNewsletters }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");

  function send() {
    if (!title.trim() || !body.trim()) return;
    setNewsletters([{ id: uid(), date: TODAY, title: title.trim(), topic: topic.trim(), body: body.trim() }, ...newsletters]);
    setTitle("");
    setTopic("");
    setBody("");
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border sl-border-line2 bg-white p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject" className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic tag (e.g. Finding a Partner)" className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the newsletter…" rows={5} className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm" />
        <button onClick={send} className="flex w-full items-center justify-center gap-1.5 rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white">
          <Mail size={14} /> Send to all parents
        </button>
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide sl-text-muted">Archive</p>
      <div className="space-y-2">
        {newsletters.map((n) => (
          <div key={n.id} className="rounded-xl sl-bg-cream p-3">
            <p className="text-xs sl-text-muted">{niceDate(n.date)} {n.topic && `· ${n.topic}`}</p>
            <p className="text-sm font-semibold sl-text-ink">{n.title}</p>
          </div>
        ))}
        {newsletters.length === 0 && <p className="text-sm sl-text-faint">Nothing sent yet.</p>}
      </div>
    </div>
  );
}

function ParentBody({
  tab,
  setTab,
  teamId,
  team,
  roster,
  plans,
  messages,
  attendance,
  rsvps,
  setRsvps,
  evaluations,
  evalRequests,
  setEvalRequests,
  evalRubric,
  profileRequests,
  setProfileRequests,
  rosters,
  setRosters,
  events,
  eventRegs,
  setEventRegs,
  newsletters,
  newsletterReads,
  setNewsletterReads,
  updateReads,
  setUpdateReads,
  account,
  boardPosts,
  setBoardPosts,
  coaches,
  ownerMessages,
  setOwnerMessages,
  practiceRatings,
  setPracticeRatings,
  coachMessages,
  setShowCoachThread,
}) {
  if (tab === "dashboard") {
    return (
      <ParentDashboard
        teamId={teamId}
        team={team}
        roster={roster}
        plans={plans}
        attendance={attendance}
        rsvps={rsvps}
        setRsvps={setRsvps}
        evaluations={evaluations}
        evalRequests={evalRequests}
        setEvalRequests={setEvalRequests}
        profileRequests={profileRequests}
        setProfileRequests={setProfileRequests}
        rosters={rosters}
        setRosters={setRosters}
        coaches={coaches}
        ownerMessages={ownerMessages}
        setOwnerMessages={setOwnerMessages}
        newsletters={newsletters}
        newsletterReads={newsletterReads}
        setNewsletterReads={setNewsletterReads}
        messages={messages}
        updateReads={updateReads}
        setUpdateReads={setUpdateReads}
        account={account}
        setTab={setTab}
      />
    );
  }
  if (tab === "events") {
    return <ParentEvents roster={roster} events={events} eventRegs={eventRegs} setEventRegs={setEventRegs} />;
  }
  if (tab === "community") {
    return (
      <ParentCommunity
        teamId={teamId}
        team={team}
        roster={roster}
        coaches={coaches}
        messages={messages}
        newsletters={newsletters}
        newsletterReads={newsletterReads}
        setNewsletterReads={setNewsletterReads}
        updateReads={updateReads}
        setUpdateReads={setUpdateReads}
        account={account}
        boardPosts={boardPosts}
        setBoardPosts={setBoardPosts}
        coachMessages={coachMessages}
        setShowCoachThread={setShowCoachThread}
      />
    );
  }
  return (
    <ParentSeason
      teamId={teamId}
      team={team}
      plans={plans}
      roster={roster}
      attendance={attendance}
      evalRubric={evalRubric}
      coaches={coaches}
      practiceRatings={practiceRatings}
      setPracticeRatings={setPracticeRatings}
    />
  );
}

function ParentSeason({ teamId, team, plans, roster, attendance, evalRubric, coaches, practiceRatings, setPracticeRatings }) {
  const [playerId, setPlayerId] = useState(roster[0]?.id);
  const player = roster.find((p) => p.id === playerId) || roster[0];

  const months = teamMonths(plans[teamId]);
  const defaultMonth = months.find((m) => m.key === monthKey(TODAY))?.key || months[0]?.key;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const monthName = selectedMonth ? monthLabel(selectedMonth).split(" ")[0] : "";

  const coverage = player ? computePackageCoverage(player, plans[teamId], attendance, teamId) : null;
  const monthPlansForCheck = [...(plans[teamId] || [])].filter((p) => monthKey(p.date) === selectedMonth);
  const unlocked =
    !!player &&
    !!coverage &&
    monthPlansForCheck.some((p) => {
      if (p.date < (player.packageStartDate || TODAY)) return false;
      if (coverage.coveredThroughDate) return p.date <= coverage.coveredThroughDate;
      return true; // package not yet exhausted — everything from start date onward is open
    });

  const monthPlans = [...(plans[teamId] || [])]
    .filter((p) => monthKey(p.date) === selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  const unlockedMonthNames = new Set(
    (plans[teamId] || [])
      .filter((p) => {
        if (!player || !coverage) return false;
        if (p.date < (player.packageStartDate || TODAY)) return false;
        return coverage.coveredThroughDate ? p.date <= coverage.coveredThroughDate : true;
      })
      .map((p) => monthLabel(monthKey(p.date)).split(" ")[0])
  );

  const rubric = evalRubric[monthName];
  const focus = rubric ? [...new Set(rubric.map((r) => r.skillArea))].join(" + ") : null;

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          SEASON
        </h2>
        {roster.length > 1 && (
          <select
            value={player?.id}
            onChange={(e) => setPlayerId(e.target.value)}
            className="rounded-lg border sl-border-line bg-white px-2 py-1 text-xs sl-text-pitch"
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide sl-text-muted">Browse the season</h3>
      <div className="mb-3 rounded-xl sl-bg-cream p-3 text-xs sl-text-body">
        Every month trains all 8 skills — each month just puts a spotlight on one or two. Sand Club Academy isn't
        a cookie-cutter program: coaches have room to adjust each practice to what the group needs that day, so
        the order below is a guide, not a script. Everything gets covered — just not always in this exact order.
      </div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedMonth(m.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              selectedMonth === m.key ? "sl-bg-pitch text-white" : "sl-bg-cream sl-text-body"
            }`}
          >
            {m.label.split(" ")[0]}
          </button>
        ))}
      </div>
      {focus && (
        <p className="mb-3 text-xs sl-text-faint">
          <strong>{monthName}'s spotlight:</strong> {focus} — all other skills still get trained this month too.
        </p>
      )}

      {unlocked ? (
        <div className="space-y-2">
          {monthPlans.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border bg-white p-3 ${p.cancelled ? "sl-border-clay" : "sl-border-line2"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
                  {niceDate(p.date)} {p.weekLabel && `· ${p.weekLabel}`}
                </p>
                {p.cancelled && <Pill tone="clay">Cancelled</Pill>}
              </div>
              <p className="mt-1 font-semibold sl-text-ink">{p.title}</p>
              {p.planText && <p className="mt-1 text-sm sl-text-body">{p.planText}</p>}
              {p.notepad && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm sl-text-clay-dark">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {p.notepad}
                </p>
              )}
              {p.date < TODAY && p.coverage && (
                <p className="mt-1.5 text-sm sl-text-turf-dark">
                  <strong>What we covered:</strong> {p.coverage}
                </p>
              )}
              {p.date <= TODAY && player && (
                <PracticeRatingWidget
                  teamId={teamId}
                  date={p.date}
                  playerId={player.id}
                  practiceRatings={practiceRatings}
                  setPracticeRatings={setPracticeRatings}
                />
              )}
            </div>
          ))}
          {monthPlans.length === 0 && <p className="text-sm sl-text-faint">Nothing scheduled this month.</p>}
        </div>
      ) : (
        <div className="rounded-xl border sl-border-line2 sl-bg-cream p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold sl-text-body">
            <Lock size={14} /> {monthName} isn't unlocked on the current plan
          </p>
          <p className="mt-1 text-sm sl-text-faint">
            {monthName}'s spotlight: {focus || "curriculum coming soon"}. Upgrade to a 3- or 5-month package to
            unlock full daily plans for this month.
          </p>
        </div>
      )}

      {player && <SeasonSnapshot player={player} evalRubric={evalRubric} unlockedMonthNames={unlockedMonthNames} />}
    </div>
  );
}

function PracticeRatingWidget({ teamId, date, playerId, practiceRatings, setPracticeRatings }) {
  const existing = practiceRatings?.[teamId]?.[date]?.[playerId];
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || "");
  const [saved, setSaved] = useState(false);

  const needsComment = rating > 0 && rating < 5 && !comment.trim();

  function save(nextRating, nextComment) {
    if (nextRating > 0 && nextRating < 5 && !nextComment.trim()) {
      setSaved(false);
      return; // don't save yet — comment required below 5 stars
    }
    setPracticeRatings({
      ...practiceRatings,
      [teamId]: {
        ...practiceRatings[teamId],
        [date]: { ...practiceRatings[teamId]?.[date], [playerId]: { rating: nextRating, comment: nextComment } },
      },
    });
    setSaved(true);
  }

  function handleStar(n) {
    setRating(n);
    setSaved(false);
    save(n, comment);
  }
  function handleComment(v) {
    setComment(v);
    setSaved(false);
    if (rating > 0) save(rating, v);
  }

  return (
    <div className="mt-2 border-t sl-border-line2 pt-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">Rate this practice</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => handleStar(n)} className="text-lg leading-none">
            {n <= rating ? "⭐" : "☆"}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => handleComment(e.target.value)}
        placeholder={rating > 0 && rating < 5 ? "Please share what happened — required for less than 5 stars" : "Anything you'd like to share? Positive feedback welcome!"}
        rows={2}
        className={`mt-1.5 w-full rounded-lg border p-2 text-sm outline-none ${needsComment ? "sl-border-clay sl-bg-clay-tint" : "sl-border-line"}`}
      />
      {needsComment && <p className="mt-1 text-xs sl-text-clay-dark">A quick note is needed before this rating saves.</p>}
      {saved && !needsComment && rating > 0 && <p className="mt-1 text-xs sl-text-turf-dark">Thanks for the feedback!</p>}
    </div>
  );
}

function SeasonSnapshot({ player, evalRubric, unlockedMonthNames }) {
  return (
    <>
      <h3 className="mb-1 mt-6 text-sm font-bold uppercase tracking-wide sl-text-muted">Full Year Plan</h3>
      <p className="mb-2 text-xs sl-text-faint">
        August through July — every parent sees the season at a glance. All 8 skills are trained every month;
        each month spotlights one or two. Full daily detail unlocks for the months {player.name.split(" ")[0]}{" "}
        is enrolled in.
      </p>
      <div className="space-y-2">
        {PROGRAM_YEAR_MONTHS.map((m) => {
          const unlocked = unlockedMonthNames.has(m);
          const rubric = evalRubric[m];
          const focus = rubric ? [...new Set(rubric.map((r) => r.skillArea))].join(" + ") : null;
          return (
            <div
              key={m}
              className={`flex items-center justify-between rounded-xl border p-3 ${
                unlocked ? "sl-border-turf bg-white" : "sl-border-line2 sl-bg-cream"
              }`}
            >
              <div>
                <p className="text-sm font-semibold sl-text-ink">{m}</p>
                <p className="text-xs sl-text-faint">{focus ? `Spotlight: ${focus}` : "Curriculum coming soon"}</p>
              </div>
              {unlocked ? (
                <Pill tone="turf">Enrolled</Pill>
              ) : (
                <span className="flex items-center gap-1 text-xs sl-text-faint">
                  <Lock size={12} /> Preview
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs sl-text-faint">
        Want full access to more months? Ask about our 3-month and 5-month packages — both include a free
        tournament registration coupon.
      </p>
    </>
  );
}

function ParentEvents({ roster, events, eventRegs, setEventRegs }) {
  const [playerId, setPlayerId] = useState(roster[0]?.id);
  const player = roster.find((p) => p.id === playerId) || roster[0];
  const [openEvent, setOpenEvent] = useState(null);

  if (!player) {
    return (
      <div className="px-4 pt-4">
        <p className="text-sm sl-text-faint">No players on this team yet.</p>
      </div>
    );
  }

  const eligibleForCoupon = player.plan === "3mo" || player.plan === "5mo";

  function register(eventId, patch) {
    const next = {
      ...eventRegs,
      [eventId]: { ...eventRegs[eventId], [player.id]: { ...eventRegs[eventId]?.[player.id], ...patch } },
    };
    setEventRegs(next);
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          EVENTS
        </h2>
        {roster.length > 1 && (
          <select
            value={player.id}
            onChange={(e) => setPlayerId(e.target.value)}
            className="rounded-lg border sl-border-line bg-white px-2 py-1 text-xs sl-text-pitch"
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={`mb-4 rounded-xl p-3 text-sm ${eligibleForCoupon ? "sl-bg-turf-tint sl-text-turf-dark" : "sl-bg-cream sl-text-body"}`}>
        {eligibleForCoupon ? (
          <span>🎟️ {player.name.split(" ")[0]} has a free tournament registration coupon from their package.</span>
        ) : (
          <span>No free registration coupon on the current plan — 3-month and 5-month packages include one.</span>
        )}
      </div>

      <div className="space-y-3">
        {sorted.map((ev) => {
          const reg = eventRegs[ev.id]?.[player.id];
          const isOpen = openEvent === ev.id;
          const isQualifier = ev.type === "National Qualifier";
          const notSandClub = ev.host && ev.host !== "The Sand Club";
          return (
            <div key={ev.id} className="rounded-xl border sl-border-line2 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Pill tone={isQualifier ? "clay" : "turf"}>{ev.type}</Pill>
                  <p className="mt-1 font-semibold sl-text-ink">{ev.name}</p>
                  <p className="text-xs sl-text-faint">
                    {niceDate(ev.date)} {ev.location && ev.location !== "TBD" ? `· ${ev.location}` : ""}
                  </p>
                  {notSandClub && <p className="text-xs sl-text-faint">Hosted by {ev.host}</p>}
                </div>
                {reg?.registered && <Pill tone="turf">Registered</Pill>}
              </div>
              <p className="mt-1.5 text-sm sl-text-body">{ev.description}</p>
              <div className="mt-2 flex gap-1.5">
                <div className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold ${reg?.paidStatus === "paid" ? "sl-bg-amber text-white" : "sl-bg-cream sl-text-faint"}`}>
                  Paid
                </div>
                <div className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold ${reg?.paidStatus === "free" ? "sl-bg-turf text-white" : "sl-bg-cream sl-text-faint"}`}>
                  Free
                </div>
                <button
                  onClick={() => register(ev.id, { paidStatus: reg?.paidStatus === "notAttending" ? null : "notAttending" })}
                  className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold ${reg?.paidStatus === "notAttending" ? "sl-bg-clay text-white" : "sl-bg-cream sl-text-body"}`}
                >
                  Not attending
                </button>
              </div>
              {ev.registerUrl && (
                <a
                  href={ev.registerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs font-semibold sl-text-pitch underline underline-offset-2"
                >
                  View on VolleyballLife →
                </a>
              )}

              {!reg?.registered ? (
                <button
                  onClick={() => setOpenEvent(isOpen ? null : ev.id)}
                  className="mt-2 rounded-lg sl-bg-pitch px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Register
                </button>
              ) : (
                <p className="mt-2 text-xs sl-text-body">
                  {reg.fallbackBOMB
                    ? "Registered for BOMB Series (no partner needed)."
                    : reg.hasPartner
                    ? `Registered with partner: ${reg.partnerName || "—"}`
                    : "Registered — no partner yet. We don't guarantee partners, but we'll try to match you."}
                </p>
              )}

              {isOpen && !reg?.registered && (
                <div className="mt-3 space-y-2 border-t sl-border-line2 pt-3">
                  {isQualifier && (
                    <div>
                      <p className="mb-1 text-xs font-medium sl-text-body">Do you have a partner?</p>
                      <div className="flex gap-1.5">
                        <RsvpBtn active={false} label="Yes, I have one" tone="turf" onClick={() => register(ev.id, { registered: true, hasPartner: true, fallbackBOMB: false, usedCoupon: eligibleForCoupon })} />
                        <RsvpBtn active={false} label="No — play BOMB instead" tone="amber" onClick={() => register(ev.id, { registered: true, fallbackBOMB: true, hasPartner: false, usedCoupon: eligibleForCoupon })} />
                        <RsvpBtn active={false} label="No, still register" tone="clay" onClick={() => register(ev.id, { registered: true, hasPartner: false, fallbackBOMB: false, usedCoupon: eligibleForCoupon })} />
                      </div>
                    </div>
                  )}
                  {!isQualifier && (
                    <button
                      onClick={() => register(ev.id, { registered: true, fallbackBOMB: false, hasPartner: false, usedCoupon: eligibleForCoupon })}
                      className="w-full rounded-lg sl-bg-turf py-2 text-sm font-semibold text-white"
                    >
                      Confirm BOMB registration{eligibleForCoupon ? " (free coupon applied)" : ""}
                    </button>
                  )}
                  {!eligibleForCoupon && (
                    <p className="text-xs sl-text-faint">This registration isn't covered by a free coupon on the current plan.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && <p className="text-sm sl-text-faint">No events posted yet.</p>}
      </div>
    </div>
  );
}

function ParentCommunity({ teamId, team, roster, coaches, messages, newsletters, newsletterReads, setNewsletterReads, updateReads, setUpdateReads, account, boardPosts, setBoardPosts, coachMessages, setShowCoachThread }) {
  const unread = unreadNewsletterCount(newsletters || [], account?.id, newsletterReads);
  const unreadUpdates = unreadUpdateCount(messages || {}, teamId, account?.id, updateReads);
  const directCount = (coachMessages?.[roster?.[0]?.id] || []).length;
  const [section, setSection] = useState(unread > 0 ? "newsletters" : "updates"); // updates | newsletters | board

  function selectSection(id) {
    if (id === "direct") {
      setShowCoachThread(true);
      return;
    }
    setSection(id);
    if (id === "newsletters" && account) {
      setNewsletterReads({ ...newsletterReads, [account.id]: new Date().toISOString() });
    }
    if (id === "updates" && account) {
      setUpdateReads({ ...updateReads, [account.id]: new Date().toISOString() });
    }
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <h2 className="mb-3 text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
        COMMUNITY
      </h2>
      <div className="mb-3 flex overflow-hidden rounded-lg border sl-border-line text-xs font-semibold">
        {[
          { id: "updates", label: `Updates${unreadUpdates > 0 ? ` (${unreadUpdates})` : ""}` },
          { id: "newsletters", label: `News${unread > 0 ? ` (${unread})` : ""}` },
          { id: "board", label: "Board" },
          { id: "direct", label: `Direct${directCount > 0 ? ` (${directCount})` : ""}` },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => selectSection(s.id)}
            className={`flex-1 py-1.5 ${section === s.id ? "sl-bg-pitch text-white" : "bg-white sl-text-body"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "updates" && (
        <p className="mb-2 text-xs sl-text-faint">Announcements from {team ? teamCoachDisplay(team, coaches) : "your coach"} — everyone on the team sees these.</p>
      )}
      {section === "board" && <p className="mb-2 text-xs sl-text-faint">Open discussion — visible to every parent on the team.</p>}

      {section === "updates" && <ParentMessagesList teamId={teamId} messages={messages} />}
      {section === "newsletters" && <NewsletterArchive newsletters={newsletters} />}
      {section === "board" && <ParentBoard teamId={teamId} boardPosts={boardPosts} setBoardPosts={setBoardPosts} />}
    </div>
  );
}

function ParentMessagesList({ teamId, messages }) {
  const teamMessages = [...(messages[teamId] || [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-2">
      {teamMessages.map((m) => (
        <div key={m.id} className="rounded-xl border sl-border-line2 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
            {niceDate(m.date)} · {m.author}
          </p>
          <p className="mt-1 text-sm sl-text-ink">{m.text}</p>
        </div>
      ))}
      {teamMessages.length === 0 && <p className="py-4 text-center text-sm sl-text-faint">No updates yet.</p>}
    </div>
  );
}

function NewsletterArchive({ newsletters }) {
  const sorted = [...newsletters].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-2">
      {sorted.map((n) => (
        <div key={n.id} className="rounded-xl border sl-border-line2 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
              {niceDate(n.date)}
            </p>
            {n.topic && <Pill tone="neutral">{n.topic}</Pill>}
          </div>
          <p className="mt-1 font-semibold sl-text-ink">{n.title}</p>
          <p className="mt-1 text-sm sl-text-body">{n.body}</p>
        </div>
      ))}
      {sorted.length === 0 && <p className="py-4 text-center text-sm sl-text-faint">No newsletters yet.</p>}
    </div>
  );
}

function ParentBoard({ teamId, boardPosts, setBoardPosts }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const posts = [...(boardPosts[teamId] || [])].sort((a, b) => b.date.localeCompare(a.date));

  function post() {
    if (!text.trim() || !name.trim()) return;
    const newPost = { id: uid(), date: new Date().toISOString(), author: name.trim(), text: text.trim() };
    setBoardPosts({ ...boardPosts, [teamId]: [...(boardPosts[teamId] || []), newPost] });
    setText("");
  }

  return (
    <div>
      <div className="mb-3 rounded-xl border sl-border-line2 bg-white p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question or share something with other parents…"
          rows={2}
          className="w-full resize-none rounded-lg border sl-border-line p-2 text-sm outline-none"
        />
        <button onClick={post} className="mt-2 flex items-center gap-1.5 rounded-lg sl-bg-pitch px-3 py-1.5 text-xs font-semibold text-white">
          <Send size={13} /> Post
        </button>
      </div>
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl sl-bg-cream p-3">
            <p className="text-xs font-semibold sl-text-muted">{p.author}</p>
            <p className="text-sm sl-text-ink">{p.text}</p>
          </div>
        ))}
        {posts.length === 0 && <p className="py-4 text-center text-sm sl-text-faint">No posts yet — be the first to ask a question.</p>}
      </div>
    </div>
  );
}

function ParentDashboard({
  teamId,
  team,
  roster,
  plans,
  attendance,
  rsvps,
  setRsvps,
  evaluations,
  evalRequests,
  setEvalRequests,
  profileRequests,
  setProfileRequests,
  rosters,
  setRosters,
  coaches,
  ownerMessages,
  setOwnerMessages,
  newsletters,
  newsletterReads,
  setNewsletterReads,
  messages,
  updateReads,
  setUpdateReads,
  account,
  setTab,
}) {
  const [playerId, setPlayerId] = useState(roster[0]?.id);
  const player = roster.find((p) => p.id === playerId) || roster[0];
  const [showOwnerThread, setShowOwnerThread] = useState(false);
  const [showMoreSessions, setShowMoreSessions] = useState(false);

  if (!player) {
    return (
      <div className="px-4 pt-4">
        <p className="text-sm sl-text-faint">No players on this team yet.</p>
      </div>
    );
  }

  const todaysPlan = (plans[teamId] || []).find((p) => p.date === TODAY);

  const history = computePlayerHistory(teamId, player.id, attendance, { [teamId]: rsvps[teamId] || {} });
  const allUpcoming = [...(plans[teamId] || [])].filter((p) => p.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingSessions = allUpcoming.slice(0, 5);
  const nextUpcomingSessions = allUpcoming.slice(5, 10);

  const months = teamMonths(plans[teamId]);
  const currentMonthKey = months.find((m) => m.key === monthKey(TODAY))?.key || months[months.length - 1]?.key;
  const currentMonthName = currentMonthKey ? monthLabel(currentMonthKey).split(" ")[0] : "";
  const currentEval = evaluations[teamId]?.[currentMonthKey]?.[player.id];
  const alreadyRequested = !!evalRequests[teamId]?.[currentMonthKey]?.[player.id];
  const pastEvals = months
    .map((m) => ({ month: m, rec: evaluations[teamId]?.[m.key]?.[player.id] }))
    .filter((e) => e.rec?.completedDate)
    .sort((a, b) => b.month.key.localeCompare(a.month.key));

  function requestEval() {
    setEvalRequests({
      ...evalRequests,
      [teamId]: {
        ...evalRequests[teamId],
        [currentMonthKey]: {
          ...evalRequests[teamId]?.[currentMonthKey],
          [player.id]: { requestedAt: new Date().toISOString() },
        },
      },
    });
  }

  function setRsvp(date, status) {
    const next = {
      ...rsvps,
      [teamId]: {
        ...rsvps[teamId],
        [date]: { ...rsvps[teamId]?.[date], [player.id]: { status } },
      },
    };
    setRsvps(next);
  }

  const coverage = computePackageCoverage(player, plans[teamId], attendance, teamId);

  const unreadNewsletters = unreadNewsletterCount(newsletters || [], account?.id, newsletterReads);
  const unreadUpdates = unreadUpdateCount(messages || {}, teamId, account?.id, updateReads);

  return (
    <div className="px-4 pt-4 pb-6">
      <div className={`mb-3 rounded-xl p-4 text-center ${coverage.remaining <= 1 ? "sl-bg-clay" : coverage.remaining <= 2 ? "sl-bg-amber" : "sl-bg-pitch"}`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-white opacity-80">Practices Remaining</p>
        <p className="text-4xl font-bold text-white" style={FONT_DISPLAY}>
          {coverage.remaining} <span className="text-lg font-normal opacity-70">/ {coverage.included}</span>
        </p>
        <p className="mt-1 text-xs text-white opacity-80">
          {coverage.exhausted
            ? "Package used up — time to renew"
            : coverage.coveredThroughDate
            ? `Covered through ${niceDate(coverage.coveredThroughDate)}`
            : "Package active"}
        </p>
        <p className="mt-2 text-xs text-white opacity-60">
          Every scheduled practice counts automatically, whether attendance is marked or not. Only advance-notice
          absences your coach excuses are skipped.
        </p>
      </div>
      {unreadNewsletters > 0 && (
        <button
          onClick={() => setTab("community")}
          className="mb-3 flex w-full items-center justify-between rounded-xl sl-bg-turf-tint px-3 py-2.5 text-sm sl-text-turf-dark"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Mail size={14} /> {unreadNewsletters} new newsletter{unreadNewsletters > 1 ? "s" : ""} from the Director
          </span>
          <span className="text-xs underline underline-offset-2">Read</span>
        </button>
      )}
      {unreadUpdates > 0 && (
        <button
          onClick={() => setTab("community")}
          className="mb-3 flex w-full items-center justify-between rounded-xl sl-bg-clay-tint px-3 py-2.5 text-sm sl-text-clay-dark"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> {unreadUpdates} new update{unreadUpdates > 1 ? "s" : ""} from {teamCoachDisplay(team, coaches)}
          </span>
          <span className="text-xs underline underline-offset-2">Read</span>
        </button>
      )}
      {coverage.exhausted && (
        <div className="mb-3 rounded-xl sl-bg-clay-tint p-3 text-sm sl-text-clay-dark">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> Package used up
          </p>
          <p className="mt-1">Reach out to renew so {player.name.split(" ")[0]} doesn't miss the next practice.</p>
        </div>
      )}
      {!coverage.exhausted && coverage.remaining <= 2 && (
        <div className="mb-3 rounded-xl sl-bg-amber-tint p-3 text-sm sl-text-amber-dark">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> Only {coverage.remaining} practice{coverage.remaining === 1 ? "" : "s"} left
          </p>
          <p className="mt-1">Renew soon to keep {player.name.split(" ")[0]}'s access going without a gap.</p>
        </div>
      )}

      {todaysPlan && (todaysPlan.cancelled || todaysPlan.notepad) && (
        <div className={`mb-3 rounded-xl p-3 text-sm ${todaysPlan.cancelled ? "sl-bg-clay-tint sl-text-clay-dark" : "sl-bg-amber-tint sl-text-amber-dark"}`}>
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> {todaysPlan.cancelled ? "Today's practice is cancelled" : "Update about today's practice"}
          </p>
          {todaysPlan.notepad && <p className="mt-1">{todaysPlan.notepad}</p>}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-xl border sl-border-line2 bg-white p-3">
        <div>
          <p className="font-semibold sl-text-ink">{OWNER_INFO.name}</p>
          <p className="text-xs sl-text-faint">{OWNER_INFO.title}</p>
          <p className="text-sm">
            <ClickablePhone value={OWNER_INFO.phone} />
          </p>
        </div>
        <button
          onClick={() => setShowOwnerThread(true)}
          className="flex items-center gap-1 rounded-full sl-bg-pitch px-3 py-1.5 text-xs font-semibold text-white"
        >
          <MessageCircle size={13} /> Message
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold sl-text-pitch" style={FONT_DISPLAY}>
          MY PLAYER
        </h2>
        {roster.length > 1 && (
          <select
            value={player.id}
            onChange={(e) => setPlayerId(e.target.value)}
            className="rounded-lg border sl-border-line bg-white px-2 py-1 text-sm sl-text-pitch"
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl sl-bg-pitch p-4 text-white">
        <p className="text-xs uppercase tracking-wide sl-text-mint">{player.name}'s attendance</p>
        {history.total > 0 ? (
          <>
            <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full">
              <div className="sl-bg-turf" style={{ width: `${(history.present / history.total) * 100}%` }} />
              <div className="sl-bg-amber" style={{ width: `${(history.late / history.total) * 100}%` }} />
              <div className="sl-bg-clay" style={{ width: `${(history.absent / history.total) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex gap-3 text-xs sl-text-mint">
              <span>🟢 {history.present} present</span>
              <span>🟠 {history.late} late</span>
              <span>🔴 {history.absent} absent</span>
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs sl-text-mint">No practices recorded yet.</p>
        )}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide sl-text-muted">
        Let the coach know you're coming
      </h3>
      <div className="space-y-2">
        {upcomingSessions.map((s) => (
          <SessionRsvpCard
            key={s.id}
            s={s}
            status={rsvps[teamId]?.[s.date]?.[player.id]?.status || "attending"}
            setRsvp={setRsvp}
            showToday
          />
        ))}
        {upcomingSessions.length === 0 && (
          <p className="text-sm sl-text-faint">No upcoming practices to respond to yet.</p>
        )}

        {nextUpcomingSessions.length > 0 && (
          <>
            <button
              onClick={() => setShowMoreSessions(!showMoreSessions)}
              className="text-xs font-semibold sl-text-pitch underline underline-offset-2"
            >
              {showMoreSessions ? "Hide" : "Show"} next {nextUpcomingSessions.length} practice
              {nextUpcomingSessions.length > 1 ? "s" : ""}
            </button>
            {showMoreSessions &&
              nextUpcomingSessions.map((s) => (
                <SessionRsvpCard
                  key={s.id}
                  s={s}
                  status={rsvps[teamId]?.[s.date]?.[player.id]?.status || "attending"}
                  setRsvp={setRsvp}
                />
              ))}
          </>
        )}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide sl-text-muted">Evaluations</h3>
      <div className="rounded-xl border sl-border-line2 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold sl-text-ink">{currentMonthName} evaluation</span>
          <Pill tone={currentEval?.completedDate ? "turf" : "amber"}>
            {currentEval?.completedDate ? "Done" : "Not yet"}
          </Pill>
        </div>
        {!currentEval?.completedDate && (
          <button
            onClick={requestEval}
            disabled={alreadyRequested}
            className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-60 sl-bg-pitch"
          >
            {alreadyRequested ? "Requested — coach notified" : "Request this month's evaluation"}
          </button>
        )}
      </div>

      {pastEvals.length > 0 && (
        <div className="mt-2 space-y-2">
          {pastEvals.map(({ month, rec }) => (
            <div key={month.key} className="rounded-xl sl-bg-cream p-3">
              <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted">{month.label}</p>
              <div className="mt-1.5 space-y-1">
                {Object.entries(rec.scores).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs sl-text-body">
                    <span>{k}</span>
                    <span className="font-semibold sl-text-ink">{v}</span>
                  </div>
                ))}
              </div>
              {rec.notes && <p className="mt-1.5 text-sm sl-text-body">{rec.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {history.surprises.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide sl-text-muted">Communication</h3>
          <div className="space-y-2">
            {history.surprises.map((s) => (
              <div key={s.date} className="flex items-start gap-2 rounded-xl sl-bg-amber-tint px-3 py-2.5 text-sm sl-text-amber-dark">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {niceDate(s.date)}: marked <strong>{s.status}</strong> — no heads-up was given to the coach
                  ahead of time.
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {rosters && setRosters && (
        <ProfileEditor teamId={teamId} player={player} rosters={rosters} setRosters={setRosters} profileRequests={profileRequests} setProfileRequests={setProfileRequests} />
      )}

      {showOwnerThread && (
        <CoachThreadModal
          threadKey={player.id}
          coachMessages={ownerMessages}
          setCoachMessages={setOwnerMessages}
          authorRole="parent"
          coachName={OWNER_INFO.name}
          onClose={() => setShowOwnerThread(false)}
        />
      )}
    </div>
  );
}

function ProfileEditor({ teamId, player, rosters, setRosters, profileRequests, setProfileRequests }) {
  const [form, setForm] = useState({
    dob: player.dob || "",
    gradYear: player.gradYear || "",
    highSchool: player.highSchool || "",
    playerPhone: player.playerPhone || "",
    instagram: player.instagram || "",
    snapchat: player.snapchat || "",
    division: player.division || "",
    plan: player.plan || "monthly",
    contacts: {
      Mom: { ...emptyContact(), ...player.contacts?.Mom },
      Dad: { ...emptyContact(), ...player.contacts?.Dad },
      Guardian: { ...emptyContact(), ...player.contacts?.Guardian },
    },
  });
  const [saved, setSaved] = useState(false);
  const requested = !!profileRequests?.[teamId]?.[player.id];

  function updateField(key, value) {
    setForm({ ...form, [key]: value });
    setSaved(false);
  }
  function updateContact(relation, patch) {
    setForm({ ...form, contacts: { ...form.contacts, [relation]: { ...form.contacts[relation], ...patch } } });
    setSaved(false);
  }

  function save() {
    setRosters({
      ...rosters,
      [teamId]: rosters[teamId].map((p) => (p.id === player.id ? { ...p, ...form } : p)),
    });
    if (requested) {
      const cleared = { ...profileRequests[teamId] };
      delete cleared[player.id];
      setProfileRequests({ ...profileRequests, [teamId]: cleared });
    }
    setSaved(true);
  }

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide sl-text-muted">Player Profile</h3>
      {requested && (
        <div className="mb-2 flex items-start gap-2 rounded-xl sl-bg-amber-tint px-3 py-2.5 text-sm sl-text-amber-dark">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Your coach asked you to complete {player.name.split(" ")[0]}'s profile.</span>
        </div>
      )}
      <div className="rounded-xl border sl-border-line2 bg-white p-3">
        {["Mom", "Dad", "Guardian"].map((relation) => (
          <div key={relation} className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">
              {relation === "Guardian" ? "Legal Guardian" : relation}
            </p>
            <input
              value={form.contacts[relation].name}
              onChange={(e) => updateContact(relation, { name: e.target.value })}
              placeholder="Name"
              className="mb-1.5 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
            <div className="flex gap-1.5">
              <input
                value={form.contacts[relation].phone}
                onChange={(e) => updateContact(relation, { phone: e.target.value })}
                placeholder="Phone"
                type="tel"
                className="w-1/2 rounded-lg border sl-border-line p-2 text-sm outline-none"
              />
              <input
                value={form.contacts[relation].email}
                onChange={(e) => updateContact(relation, { email: e.target.value })}
                placeholder="Email"
                type="email"
                className="w-1/2 rounded-lg border sl-border-line p-2 text-sm outline-none"
              />
            </div>
          </div>
        ))}

        <p className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide sl-text-muted">Player details</p>
        <div className="grid grid-cols-2 gap-1.5">
          <select value={form.division} onChange={(e) => updateField("division", e.target.value)} className="rounded-lg border sl-border-line p-2 text-sm outline-none">
            <option value="">Division</option>
            <option value="14U">14U</option>
            <option value="HS">HS</option>
          </select>
          <select value={form.plan} onChange={(e) => updateField("plan", e.target.value)} className="rounded-lg border sl-border-line p-2 text-sm outline-none">
            <option value="monthly">Month-to-month</option>
            <option value="3mo">3-month</option>
            <option value="5mo">5-month</option>
            <option value="dropin">Drop-in</option>
          </select>
          <input type="text" inputMode="numeric" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} placeholder="Date of birth (MM/DD/YYYY)" className="col-span-2 rounded-lg border sl-border-line p-2 text-sm outline-none" />
          <input value={form.gradYear} onChange={(e) => updateField("gradYear", e.target.value)} placeholder="Grad year" className="rounded-lg border sl-border-line p-2 text-sm outline-none" />
          <input value={form.highSchool} onChange={(e) => updateField("highSchool", e.target.value)} placeholder="High school" className="col-span-2 rounded-lg border sl-border-line p-2 text-sm outline-none" />
          <input value={form.playerPhone} onChange={(e) => updateField("playerPhone", e.target.value)} placeholder="Player phone" type="tel" className="col-span-2 rounded-lg border sl-border-line p-2 text-sm outline-none" />
          <input value={form.instagram} onChange={(e) => updateField("instagram", e.target.value)} placeholder="Instagram (optional)" className="rounded-lg border sl-border-line p-2 text-sm outline-none" />
          <input value={form.snapchat} onChange={(e) => updateField("snapchat", e.target.value)} placeholder="Snapchat (optional)" className="rounded-lg border sl-border-line p-2 text-sm outline-none" />
        </div>

        <button onClick={save} className="mt-3 w-full rounded-lg sl-bg-pitch py-2 text-sm font-semibold text-white">
          {saved ? "Saved ✓" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function CoachThreadModal({ threadKey, recipientLabel, coachMessages, setCoachMessages, authorRole, coachName, onClose }) {
  const [parentName, setParentName] = useState("");
  const [text, setText] = useState("");
  const thread = coachMessages[threadKey] || [];

  function send() {
    if (!text.trim()) return;
    if (authorRole === "parent" && !parentName.trim()) return;
    const msg = {
      id: uid(),
      author: authorRole,
      authorName: authorRole === "coach" ? coachName : parentName.trim(),
      text: text.trim(),
      date: new Date().toISOString(),
    };
    setCoachMessages({ ...coachMessages, [threadKey]: [...thread, msg] });
    setText("");
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sl-bg-scrim sm:items-center">
      <div
        style={{ height: "80vh", maxHeight: 640 }}
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b sl-border-line2 p-3">
          <h3 className="font-bold sl-text-pitch" style={FONT_DISPLAY}>
            MESSAGE {(recipientLabel || coachName)?.toUpperCase()}
          </h3>
          <button onClick={onClose}>
            <X size={18} className="sl-text-muted" />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {thread.map((m) => (
            <div
              key={m.id}
              style={{ maxWidth: "85%" }}
              className={`rounded-xl p-2.5 text-sm ${
                m.author === authorRole ? "ml-auto sl-bg-turf text-white" : "sl-bg-cream sl-text-ink"
              }`}
            >
              <p className="text-xs font-semibold opacity-80">{m.authorName}</p>
              <p>{m.text}</p>
            </div>
          ))}
          {thread.length === 0 && <p className="py-6 text-center text-sm sl-text-faint">No messages yet — say hello.</p>}
        </div>
        <div className="border-t sl-border-line2 p-3">
          {authorRole === "parent" && (
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Your name"
              className="mb-2 w-full rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              className="flex-1 rounded-lg border sl-border-line p-2 text-sm outline-none"
            />
            <button onClick={send} className="rounded-lg sl-bg-pitch px-3 text-white">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionRsvpCard({ s, status, setRsvp, showToday }) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${s.cancelled ? "sl-border-clay" : "sl-border-line2"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide sl-text-muted" style={FONT_MONO}>
          {niceDate(s.date)} {showToday && s.date === TODAY && "· TODAY"}
        </p>
        {s.cancelled && <Pill tone="clay">Cancelled</Pill>}
      </div>
      {s.notepad && (
        <p className="mt-1 flex items-start gap-1.5 text-sm sl-text-clay-dark">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {s.notepad}
        </p>
      )}
      <div className="mt-2 flex gap-1.5">
        <RsvpBtn active={status === "attending"} label="Attending" tone="turf" onClick={() => setRsvp(s.date, "attending")} />
        <RsvpBtn active={status === "late"} label="Running late" tone="amber" onClick={() => setRsvp(s.date, "late")} />
        <RsvpBtn active={status === "absent"} label="Can't make it" tone="clay" onClick={() => setRsvp(s.date, "absent")} />
      </div>
    </div>
  );
}

function RsvpBtn({ active, label, tone, onClick }) {
  const tones = {
    turf: active ? "sl-bg-turf text-white" : "sl-bg-cream sl-text-body",
    amber: active ? "sl-bg-amber text-white" : "sl-bg-cream sl-text-body",
    clay: active ? "sl-bg-clay text-white" : "sl-bg-cream sl-text-body",
  };
  return (
    <button onClick={onClick} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tones[tone]}`}>
      {label}
    </button>
  );
}

/* =====================================================================
   LOGIN GATE
   Note: this is a lightweight access gate, not real secure auth — no
   password hashing, no server-side session. It keeps casual/unauthorized
   people out of the app, but isn't sufficient for protecting truly
   sensitive data. A production deployment would need real backend auth.
===================================================================== */
function LoginScreen({ onSignedIn }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError("Enter an email and password.");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { error: err } = await signUp(email.trim(), password, label.trim());
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      setInfo("Account created — check your email to confirm it, then sign in. After that, the Director needs to approve you before the app unlocks.");
      setMode("signin");
      return;
    }
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSignedIn();
  }

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center justify-center overflow-x-hidden sl-bg-chalk px-6"
      style={{ ...FONT_BODY, minHeight: "100dvh" }}
    >
      <img src={LOGO_DATA_URI} alt="Sand Club Academy logo" className="mb-3 h-20 w-20 object-contain" />
      <h1 className="mb-1 text-2xl font-bold sl-text-pitch" style={FONT_DISPLAY}>
        SAND CLUB ACADEMY
      </h1>
      <p className="mb-6 text-sm sl-text-faint">{mode === "signin" ? "Sign in to continue" : "Create your account"}</p>

      <div className="w-full">
        {mode === "signup" && (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Your name"
            className="mb-2 w-full rounded-lg border sl-border-line p-3 text-sm outline-none"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoCapitalize="none"
          className="mb-2 w-full rounded-lg border sl-border-line p-3 text-sm outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          className="mb-2 w-full rounded-lg border sl-border-line p-3 text-sm outline-none"
        />
        {error && <p className="mb-2 text-xs sl-text-clay-dark">{error}</p>}
        {info && <p className="mb-2 text-xs sl-text-turf-dark">{info}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="mb-3 w-full rounded-lg sl-bg-pitch py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="w-full text-center text-xs font-semibold sl-text-pitch underline underline-offset-2"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function PendingApprovalScreen({ profile, onSignOut }) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center justify-center overflow-x-hidden sl-bg-chalk px-6 text-center"
      style={{ ...FONT_BODY, minHeight: "100dvh" }}
    >
      <img src={LOGO_DATA_URI} alt="Sand Club Academy logo" className="mb-3 h-20 w-20 object-contain" />
      <h1 className="mb-1 text-2xl font-bold sl-text-pitch" style={FONT_DISPLAY}>
        Almost there
      </h1>
      <p className="mb-1 text-sm sl-text-body">
        Signed in as <strong>{profile.email}</strong>.
      </p>
      <p className="mb-6 text-sm sl-text-faint">
        The Director needs to approve your account and assign your role before you can get in. Check back soon, or
        reach out to Allen directly.
      </p>
      <button onClick={onSignOut} className="rounded-lg border sl-border-line px-4 py-2 text-sm sl-text-body">
        Sign out
      </button>
    </div>
  );
}

export default function SidelineApp() {
  const [profile, setProfile] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);

  async function refreshProfile() {
    const p = await getCurrentProfile();
    setProfile(p);
    setCheckedSession(true);
  }

  useEffect(() => {
    refreshProfile();
    const unsubscribe = onAuthChange(() => {
      refreshProfile();
    });
    return unsubscribe;
  }, []);

  async function handleSignOut() {
    await signOutUser();
    setProfile(null);
  }

  if (!checkedSession) return null;
  if (!profile || !profile.session) return <LoginScreen onSignedIn={refreshProfile} />;
  if (!profile.approved || !profile.role) return <PendingApprovalScreen profile={profile} onSignOut={handleSignOut} />;

  // Shape the Supabase profile into the same "account" object the rest
  // of the app already expects (role/coachId/playerId/label), so
  // SidelineAppInner and everything below it needed no further changes.
  const account = {
    id: profile.id,
    label: profile.label || profile.email,
    role: profile.role,
    coachId: profile.coach_id || null,
    playerId: profile.player_id || null,
    teamIds: null,
  };

  return <SidelineAppInner account={account} onSignOut={handleSignOut} />;
}
