export const adminModuleGroups = [
  {
    key: "overview",
    label: "Overview",
    description: "Stay on top of the platform, alerts, and next actions.",
  },
  {
    key: "support",
    label: "Support Flow",
    description: "Handle student requests, assign work, and maintain service quality.",
  },
  {
    key: "content",
    label: "Content & Guidance",
    description: "Keep announcements and the knowledge base accurate and current.",
  },
  {
    key: "oversight",
    label: "Oversight",
    description: "Track help desk performance, incident reports, and your admin oversight.",
  },
];

export const adminModules = [
  {
    label: "Dashboard",
    route: "AdminHome",
    icon: "dashboard",
    note: "Live admin overview with structured next steps.",
    group: "overview",
    status: "live",
  },
  {
    label: "Ticket Desk",
    route: "AllTickets",
    icon: "confirmation-number",
    note: "Review, assign, and resolve student support requests.",
    group: "support",
    status: "live",
  },
  {
    label: "Feedback",
    route: "Feedback",
    icon: "reviews",
    note: "Track student ratings and comments on resolved tickets.",
    group: "support",
    status: "live",
  },
  {
    label: "User Management",
    route: "UserManagement",
    icon: "person-search",
    note: "Create accounts, manage roles, and control access.",
    group: "support",
    status: "live",
  },
  {
    label: "Announcements",
    route: "Announcements",
    icon: "campaign",
    note: "Publish timely notices for students and staff.",
    group: "content",
    status: "live",
  },
  {
    label: "Knowledge Base",
    route: "KnowledgeBase",
    icon: "library-books",
    note: "Maintain FAQs and RAG-ready PDF resources.",
    group: "content",
    status: "live",
  },
  {
    label: "Help Desk Analytics",
    route: "AnalyticsLogs",
    icon: "analytics",
    note: "See help desk ticket stats and manage internal incident reports.",
    group: "oversight",
    status: "live",
  },
  {
    label: "Chat Monitor",
    route: "ChatMonitor",
    icon: "forum",
    note: "Planned workspace for live conversation oversight and moderation.",
    group: "oversight",
    status: "planned",
  },
];

export const liveAdminModules = adminModules.filter((item) => item.status === "live");
export const liveAdminWorkspaces = liveAdminModules.filter((item) => item.route !== "AdminHome");
export const plannedAdminModules = adminModules.filter((item) => item.status === "planned");

export function getAdminModule(route) {
  return adminModules.find((item) => item.route === route) || null;
}

export function getAdminModulesByGroup(groupKey, { includePlanned = true } = {}) {
  return adminModules.filter((item) => {
    if (item.group !== groupKey) {
      return false;
    }

    return includePlanned ? true : item.status === "live";
  });
}

export function openAdminRoute(navigation, route, params) {
  if (!navigation?.navigate) {
    return;
  }

  navigation.navigate(route, params);
}
