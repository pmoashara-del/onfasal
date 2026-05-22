const ZONE_META = {
  title: "Ashara Mubaraka 1448H",
  subtitle: "Post Fasal 48 Hour Implementation Checklist — Zone Wise",
};

const ZONE_COLUMNS = [
  { key: "sno", label: "S.No.", width: 48 },
  { key: "task", label: "CHECKLIST ITEM", width: 480 },
  { key: "zone", label: "ZONE", width: 120 },
  { key: "assignedTo", label: "ASSIGNED TO / OWNER", width: 200 },
  { key: "status", label: "STATUS", width: 110 },
  { key: "remarks", label: "REMARKS", width: 200 },
];

const ZONE_STORAGE_KEY = "fasal-zone-checklist-v1";

const ZONE_CHECKLIST_ITEMS = [
  "All Masjid accessories not required during Ashara Mubaraka — including jhumar, carpets, decorative items, furniture, plantations, and window doors — must be removed and stored immediately.",
  "The Masjid and Sehan are to be fully cleared and made ready for Ashara setup without delay.",
  "Matam must commence immediately after Fasal with Masjid Tanzeem responsible for managing crowd movement and flow.",
  "Imam Alam is to be installed across all Masjid and Markaz premises.",
  "The complete 3-line HR hierarchy must be deployed immediately upon Fasal, with every individual assigned a specific task. No person should be on ground without a defined role, a single zone assignment, and a clear reporting line.",
  "Zone-wise attendance must be taken immediately and any absent or underperforming staff replaced from the standby pool without delay.",
  "HR food and chai must be arranged from Hour 1 — workers on ground cannot be expected to function without basic sustenance.",
  "All international HR arriving post Fasal must be received, briefed, and absorbed into their respective zones immediately.",
  "Zonal offices must be physically set up and fully operational across all zones — each office must have a table, chairs, working internet, a whiteboard, and a printed contact list of all key personnel on the wall.",
  "Each Zonal Head must conduct a full physical walkthrough of their zone, documenting what is in place, what is missing, and what needs immediate attention.",
  "A communication channel between all zones and CMZ must be established from Hour 1 — with a fixed morning and evening reporting time and a clearly understood escalation path.",
  "Each zone must submit its first status report to CMZ within 6 hours of Fasal.",
  "Any issue that cannot be resolved at zone level must be escalated within 1 hour — issues are not to be held.",
  "Letters must be dispatched on Day 1 to the Collector, Municipal Corporation, Police Department, Traffic Police, and MPEB.",
  "Permissions for fire trucks, fire extinguisher vans, and all temporary structures must be initiated immediately and followed up actively.",
  "Every vendor must be called and confirmed within the first 3 hours of Fasal — their readiness and delivery timelines must be established immediately.",
  "Purchase orders for all critical items — construction material, food supplies, disposables, and equipment — must be raised and signed on Day 1.",
  "Any vendor who does not confirm within 6 hours is to be replaced immediately without waiting.",
  "A confirmed delivery schedule from every vendor must be tracked and followed up on.",
  "Finance offices must be set up across all zones, not only at CMZ.",
  "Each zone must have cash available at the zonal level from Day 1 to meet immediate ground needs — petty expenses should not wait for central processing. All such expenditures are to be recorded at zone level with central settlement to follow.",
  "Masjid Mawaid stores must be deep cleaned and fully reorganized for Ashara operations immediately after Fasal and made ready to receive and dispatch material from Day 1.",
];

function buildZoneRows() {
  return ZONE_CHECKLIST_ITEMS.map((task, i) => ({
    sno: i + 1,
    task,
    zone: "ALL ZONES",
    assignedTo: "",
    status: "",
    remarks: "",
  }));
}

const ZONE_SEED_ROWS = buildZoneRows();
