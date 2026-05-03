import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { fetchTickets } from "../../api/tickets";
import { subscribeRealtimeEvent } from "../../realtime/socket";
import { findRequestTypeOption } from "../../tickets/config";

export function normalizeString(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function emptyFeedback() {
  return { type: "", message: "" };
}

export function ticketId(ticket) {
  return ticket?._id || "";
}

export function replaceTicket(collection, nextTicket) {
  const id = ticketId(nextTicket);
  const existing = collection.some((ticket) => ticketId(ticket) === id);

  if (!existing) {
    return [nextTicket, ...collection];
  }

  return collection.map((ticket) => (ticketId(ticket) === id ? nextTicket : ticket));
}

export function removeTicket(collection, targetTicketId) {
  return collection.filter((ticket) => ticketId(ticket) !== String(targetTicketId || ""));
}

export function formatDateTime(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-LK", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return String(value);
  }
}

export function createStudentTicketForm(user) {
  return {
    fullName: user?.name || "",
    email: user?.email || "",
    registrationNumber:
      user?.studentProfile?.registrationNumber || user?.studentProfile?.studentId || "",
    faculty: user?.studentProfile?.faculty || "",
    contactNumber: user?.phone || "",
    requestType: "",
    requestSubType: "",
    department: "",
    subject: "",
    campus: user?.studentProfile?.campus || "",
    message: "",
  };
}

export function validateStudentTicketForm(form) {
  if (!normalizeString(form.fullName)) return "Full Name is required.";
  if (!normalizeString(form.email)) return "Email is required.";
  if (!normalizeString(form.registrationNumber)) return "Registration Number is required.";
  if (!normalizeString(form.faculty)) return "Faculty / School is required.";
  if (!normalizeString(form.contactNumber)) return "Contact Number is required.";
  if (!normalizeString(form.requestType)) return "Request / Inquiry Type is required.";

  const requestTypeConfig = findRequestTypeOption(form.requestType);

  if (requestTypeConfig?.subOptions?.length && !normalizeString(form.requestSubType)) {
    return `${requestTypeConfig.subLabel || "Sub-category"} is required.`;
  }

  if (!normalizeString(form.department)) return "Department is required.";
  if (!normalizeString(form.subject)) return "Subject is required.";
  if (!normalizeString(form.campus)) return "Campus / Center is required.";
  if (!normalizeString(form.message)) return "Message is required.";

  return "";
}

export function groupStaffByDepartment(users, preferredDepartment = "") {
  const grouped = users.reduce((accumulator, user) => {
    const department = user?.staffProfile?.department || "Other";

    if (!accumulator[department]) {
      accumulator[department] = [];
    }

    accumulator[department].push({
      _id: user._id,
      name: user.name,
      department,
    });

    return accumulator;
  }, {});

  return Object.keys(grouped)
    .sort((left, right) => {
      if (left === preferredDepartment) return -1;
      if (right === preferredDepartment) return 1;
      return left.localeCompare(right);
    })
    .map((department) => ({
      department,
      staff: grouped[department].sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

export function useTickets(viewer) {
  const viewerId = viewer?._id || "";
  const viewerRole = viewer?.role || "";
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(emptyFeedback());
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setTickets([]);
    setFeedback(emptyFeedback());
    setLoading(true);
    hasLoadedRef.current = false;
  }, [viewerId, viewerRole]);

  const loadTickets = useCallback(
    async ({ keepFeedback = false, keepLoading = false } = {}) => {
      if (!viewerId || !viewerRole) {
        setTickets([]);
        setLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      try {
        if (!keepLoading && !hasLoadedRef.current) {
          setLoading(true);
        }

        const data = await fetchTickets({
          viewerId,
          viewerRole,
        });

        setTickets(Array.isArray(data.tickets) ? data.tickets : []);

        if (!keepFeedback) {
          setFeedback(emptyFeedback());
        }
      } catch (error) {
        setFeedback({
          type: "error",
          message: error.message || "Unable to load tickets right now.",
        });
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    },
    [viewerId, viewerRole]
  );

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
    }, [loadTickets])
  );

  useEffect(() => {
    if (!viewerId || !viewerRole) {
      return undefined;
    }

    return subscribeRealtimeEvent("ticket:changed", () => {
      void loadTickets({ keepFeedback: true, keepLoading: true });
    });
  }, [loadTickets, viewerId, viewerRole]);

  return { tickets, setTickets, loading, feedback, setFeedback, loadTickets };
}
