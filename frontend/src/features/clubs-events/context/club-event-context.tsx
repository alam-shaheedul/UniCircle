"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuthenticatedUser } from "@/features/auth/context/authenticated-user-context";
import type {
  CampusClub,
  CampusEvent,
  CampusEventInput,
  ClubCreationRequest,
  ClubCreationRequestInput,
  ClubEventSnapshot,
  ClubProfileInput,
  ClubRequestStatus,
  EventRegistration,
  EventRegistrationInput,
  MembershipRequest,
  MembershipRequestInput,
  MembershipSettingsInput,
  RegisteredStudent,
} from "@/features/clubs-events/types/club-event";
import { clubEventService } from "@/services";

type ClubEventContextValue = Readonly<{
  snapshot: ClubEventSnapshot;
  isClubAdmin: (club: CampusClub) => boolean;
  submitClubRequest: (input: ClubCreationRequestInput) => Promise<void>;
  reviewClubRequest: (
    request: ClubCreationRequest,
    status: Exclude<ClubRequestStatus, "pending">,
  ) => Promise<void>;
  updateClub: (club: CampusClub, input: ClubProfileInput) => Promise<void>;
  addClubAdmin: (club: CampusClub, userId: string) => Promise<void>;
  removeClubAdmin: (club: CampusClub, userId: string) => Promise<void>;
  updateMembershipSettings: (
    club: CampusClub,
    input: MembershipSettingsInput,
  ) => Promise<void>;
  submitMembershipRequest: (
    club: CampusClub,
    input: MembershipRequestInput,
  ) => Promise<void>;
  listMembershipRequests: (clubId: string) => Promise<readonly MembershipRequest[]>;
  approveMembershipRequest: (clubId: string, requestId: string) => Promise<void>;
  removeMembershipRequest: (clubId: string, requestId: string) => Promise<void>;
  saveEvent: (
    clubId: string,
    input: CampusEventInput,
    current?: CampusEvent,
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  setInterest: (
    eventId: string,
    status: "interested" | "going" | "none",
  ) => Promise<void>;
  registerForEvent: (
    event: CampusEvent,
    input: EventRegistrationInput,
  ) => Promise<EventRegistration>;
  hasRegistered: (eventId: string) => boolean;
}>;

const ClubEventContext = createContext<ClubEventContextValue | null>(null);
export function ClubEventProvider({
  initialSnapshot,
  children,
}: Readonly<{ initialSnapshot: ClubEventSnapshot; children: ReactNode }>) {
  const { user } = useAuthenticatedUser();
  const [snapshot, setSnapshot] = useState(() => ({
    ...initialSnapshot,
    students:
      user.role === "student" &&
      !initialSnapshot.students.some((item) => item.userId === user.id)
        ? [
            ...initialSnapshot.students,
            {
              userId: user.id,
              name: user.displayName,
              email: user.email,
              studentId: user.universityId,
              department: user.department,
            },
          ]
        : initialSnapshot.students,
  }));

  const assertClubAdmin = useCallback(
    (clubId: string) => {
      const club = snapshot.clubs.find((item) => item.id === clubId);
      if (user.role !== "student" || !club?.adminUserIds.includes(user.id)) {
        throw new Error("Only a mapped student admin can manage this club.");
      }
    },
    [snapshot.clubs, user.id, user.role],
  );

  const isClubAdmin = useCallback(
    (club: CampusClub) =>
      user.role === "student" && club.adminUserIds.includes(user.id),
    [user.id, user.role],
  );

  const submitClubRequest = useCallback(
    async (input: ClubCreationRequestInput) => {
      if (user.role !== "student") {
        throw new Error("Only registered students can request a new club.");
      }

      const requester: RegisteredStudent = snapshot.students.find(
        (student) => student.userId === user.id,
      ) ?? {
        userId: user.id,
        name: user.displayName,
        email: user.email,
        studentId: user.universityId,
        department: user.department,
      };

      const request = await clubEventService.submitClubRequest(input, requester);
      setSnapshot((current) => ({
        ...current,
        clubRequests: [request, ...current.clubRequests],
        students: current.students.some(
          (student) => student.userId === requester.userId,
        )
          ? current.students
          : [...current.students, requester],
      }));
    },
    [snapshot.students, user],
  );

  const reviewClubRequest = useCallback(
    async (
      request: ClubCreationRequest,
      status: Exclude<ClubRequestStatus, "pending">,
    ) => {
      if (user.role !== "admin") {
        throw new Error("Only the main App Admin can review club requests.");
      }
      if (
        snapshot.clubRequests.find((item) => item.id === request.id)?.status !==
        "pending"
      ) {
        throw new Error("This club request has already been reviewed.");
      }
      const result = await clubEventService.reviewClubRequest(request, status);
      setSnapshot((current) => ({
        ...current,
        clubRequests: current.clubRequests.map((item) =>
          item.id === result.request.id ? result.request : item,
        ),
        clubs: result.club ? [result.club, ...current.clubs] : current.clubs,
      }));
    },
    [snapshot.clubRequests, user.role],
  );

  const updateClub = useCallback(
    async (club: CampusClub, input: ClubProfileInput) => {
      assertClubAdmin(club.id);
      const updated = await clubEventService.saveClub(input, club);
      setSnapshot((current) => ({
        ...current,
        clubs: current.clubs.map((item) => (item.id === updated.id ? updated : item)),
      }));
    },
    [assertClubAdmin],
  );

  const setAdmins = useCallback(
    async (club: CampusClub, userIds: readonly string[]) => {
      assertClubAdmin(club.id);
      if (userIds.length === 0) {
        throw new Error("A club must keep at least one student admin.");
      }
      const updated = await clubEventService.setClubAdmins(club, userIds);
      setSnapshot((current) => ({
        ...current,
        clubs: current.clubs.map((item) => (item.id === updated.id ? updated : item)),
        students: [
          ...current.students.filter(
            (item) => !updated.adminUserIds.includes(item.userId),
          ),
          ...(updated.adminStudents ?? []),
        ],
      }));
    },
    [assertClubAdmin],
  );

  const addClubAdmin = useCallback(
    (club: CampusClub, userId: string) =>
      setAdmins(club, [...club.adminUserIds, userId]),
    [setAdmins],
  );

  const removeClubAdmin = useCallback(
    (club: CampusClub, userId: string) =>
      setAdmins(
        club,
        club.adminUserIds.filter((id) => id !== userId),
      ),
    [setAdmins],
  );

  const updateMembershipSettings = useCallback(
    async (club: CampusClub, input: MembershipSettingsInput) => {
      assertClubAdmin(club.id);
      const updated = await clubEventService.updateMembershipSettings(club.id, input);
      setSnapshot((current) => ({
        ...current,
        clubs: current.clubs.map((item) => (item.id === updated.id ? updated : item)),
      }));
    },
    [assertClubAdmin],
  );

  const submitMembershipRequest = useCallback(
    async (club: CampusClub, input: MembershipRequestInput) => {
      if (user.role !== "student") {
        throw new Error("Only registered students can request club membership.");
      }
      await clubEventService.submitMembershipRequest(club.id, input);
      setSnapshot((current) => ({
        ...current,
        clubs: current.clubs.map((item) =>
          item.id === club.id ? { ...item, membershipRequestStatus: "pending" } : item,
        ),
      }));
    },
    [user.role],
  );

  const listMembershipRequests = useCallback(
    (clubId: string) => {
      assertClubAdmin(clubId);
      return clubEventService.listMembershipRequests(clubId);
    },
    [assertClubAdmin],
  );

  const approveMembershipRequest = useCallback(
    async (clubId: string, requestId: string) => {
      assertClubAdmin(clubId);
      const result = await clubEventService.approveMembershipRequest(clubId, requestId);
      setSnapshot((current) => ({
        ...current,
        clubs: current.clubs.map((item) =>
          item.id === result.club.id ? result.club : item,
        ),
      }));
    },
    [assertClubAdmin],
  );

  const removeMembershipRequest = useCallback(
    async (clubId: string, requestId: string) => {
      assertClubAdmin(clubId);
      await clubEventService.removeMembershipRequest(clubId, requestId);
      setSnapshot((current) => ({
        ...current,
        clubs: current.clubs.map((item) =>
          item.id === clubId
            ? {
                ...item,
                pendingMembershipRequestCount: Math.max(
                  0,
                  (item.pendingMembershipRequestCount ?? 1) - 1,
                ),
              }
            : item,
        ),
      }));
    },
    [assertClubAdmin],
  );

  const saveEvent = useCallback(
    async (clubId: string, input: CampusEventInput, current?: CampusEvent) => {
      assertClubAdmin(clubId);
      if (current && current.clubId !== clubId) {
        throw new Error("This event does not belong to the selected club.");
      }
      const saved = await clubEventService.saveEvent(input, clubId, current);
      setSnapshot((snapshotValue) => ({
        ...snapshotValue,
        events: snapshotValue.events.some((item) => item.id === saved.id)
          ? snapshotValue.events.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...snapshotValue.events],
      }));
    },
    [assertClubAdmin],
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      const event = snapshot.events.find((item) => item.id === eventId);
      if (!event) throw new Error("Event not found.");
      assertClubAdmin(event.clubId);
      await clubEventService.deleteEvent(eventId);
      setSnapshot((current) => ({
        ...current,
        events: current.events.filter((event) => event.id !== eventId),
        registrations: current.registrations.filter(
          (registration) => registration.eventId !== eventId,
        ),
      }));
    },
    [assertClubAdmin, snapshot.events],
  );

  const setInterest = useCallback(
    async (eventId: string, status: "interested" | "going" | "none") => {
      const updated = await clubEventService.setInterest(eventId, status);
      setSnapshot((current) => ({
        ...current,
        events: current.events.map((item) => (item.id === eventId ? updated : item)),
      }));
    },
    [],
  );

  const registerForEvent = useCallback(
    async (event: CampusEvent, input: EventRegistrationInput) => {
      if (!event.registration.enabled) {
        throw new Error("Registration is not available for this event.");
      }
      if (user.role !== "student") {
        throw new Error("Only registered students can join this event.");
      }
      if (event.status === "finished") {
        throw new Error("Registration has closed for this event.");
      }
      if (event.registration.isPaid && !input.bkashTransactionId?.trim()) {
        throw new Error("Enter the bKash transaction ID for this paid event.");
      }
      if (
        snapshot.registrations.some(
          (registration) =>
            registration.eventId === event.id && registration.userId === user.id,
        )
      ) {
        throw new Error("You have already registered for this event.");
      }

      const registration = await clubEventService.registerForEvent(
        event.id,
        user.id,
        input,
      );
      setSnapshot((current) => ({
        ...current,
        registrations: [registration, ...current.registrations],
        events: current.events.map((item) =>
          item.id === event.id
            ? {
                ...item,
                registeredCount: item.registeredCount + 1,
                myRegistration: {
                  id: registration.id,
                  paymentStatus: item.registration.isPaid
                    ? "pending_review"
                    : "not_required",
                },
              }
            : item,
        ),
      }));
      return registration;
    },
    [snapshot.registrations, user.id, user.role],
  );

  const hasRegistered = useCallback(
    (eventId: string) =>
      Boolean(snapshot.events.find((event) => event.id === eventId)?.myRegistration) ||
      snapshot.registrations.some(
        (registration) =>
          registration.eventId === eventId && registration.userId === user.id,
      ),
    [snapshot.events, snapshot.registrations, user.id],
  );

  const value = useMemo(
    () => ({
      snapshot,
      isClubAdmin,
      submitClubRequest,
      reviewClubRequest,
      updateClub,
      addClubAdmin,
      removeClubAdmin,
      updateMembershipSettings,
      submitMembershipRequest,
      listMembershipRequests,
      approveMembershipRequest,
      removeMembershipRequest,
      saveEvent,
      deleteEvent,
      setInterest,
      registerForEvent,
      hasRegistered,
    }),
    [
      addClubAdmin,
      deleteEvent,
      setInterest,
      hasRegistered,
      isClubAdmin,
      registerForEvent,
      removeClubAdmin,
      updateMembershipSettings,
      submitMembershipRequest,
      listMembershipRequests,
      approveMembershipRequest,
      removeMembershipRequest,
      reviewClubRequest,
      saveEvent,
      snapshot,
      submitClubRequest,
      updateClub,
    ],
  );

  return (
    <ClubEventContext.Provider value={value}>{children}</ClubEventContext.Provider>
  );
}

export function useClubEvents(): ClubEventContextValue {
  const context = useContext(ClubEventContext);
  if (!context) {
    throw new Error("useClubEvents must be used inside ClubEventProvider.");
  }
  return context;
}
