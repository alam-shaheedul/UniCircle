import type { AnchorHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuthenticatedUserProvider } from "@/features/auth/context/authenticated-user-context";
import type { GeneralSessionUser } from "@/features/auth/types/session-user";
import { ClubAdminWorkspace } from "@/features/clubs-events/components/club-admin-workspace";
import { ClubCreationRequestForm } from "@/features/clubs-events/components/club-creation-request-form";
import { ClubEventHub } from "@/features/clubs-events/components/club-event-hub";
import { EventCard } from "@/features/clubs-events/components/event-card";
import { EventDetailRoute } from "@/features/clubs-events/components/event-detail-route";
import { ClubEventProvider } from "@/features/clubs-events/context/club-event-context";
import type {
  CampusClub,
  CampusEvent,
  ClubEventSnapshot,
} from "@/features/clubs-events/types/club-event";

const mocks = vi.hoisted(() => ({
  setInterest: vi.fn(),
  registerForEvent: vi.fn(),
  setClubAdmins: vi.fn(),
  submitClubRequest: vi.fn(),
  saveClub: vi.fn(),
  updateMembershipSettings: vi.fn(),
  listMembershipRequests: vi.fn(),
  saveEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/services", () => ({
  clubEventService: mocks,
}));

const student: GeneralSessionUser = {
  id: "student-1",
  firstName: "Anika",
  lastName: "Rahman",
  displayName: "Anika Rahman",
  username: "anika",
  email: "anika@student.cuet.ac.bd",
  role: "student",
  universityId: "2204001",
  department: "CSE",
  phone: "01700000000",
  homeAddress: "CUET",
  bio: "",
  memberSince: "2026-01-01T00:00:00Z",
};

const club: CampusClub = {
  id: "computer-club",
  shortName: "CCC",
  name: "CUET Computer Club",
  category: "Technology",
  tagline: "Build together",
  description: "Computing community",
  memberCount: 100,
  accent: "green",
  activities: ["Workshops"],
  leaders: [],
  adminUserIds: [student.id],
  adminStudents: [
    {
      userId: student.id,
      name: student.displayName,
      email: student.email,
      studentId: student.universityId,
      department: student.department,
    },
  ],
};

const event: CampusEvent = {
  id: "event-1",
  clubId: club.id,
  title: "Programming Workshop",
  category: "Learning",
  summary: "Practise algorithms",
  location: "CUET",
  startsAt: "2026-10-05T09:00:00+06:00",
  endsAt: "2026-10-05T11:00:00+06:00",
  status: "upcoming",
  attendeeCount: 4,
  registeredCount: 0,
  registration: { enabled: true, isPaid: false },
};

function snapshot(events: readonly CampusEvent[] = [event]): ClubEventSnapshot {
  return {
    clubs: [club],
    events,
    students: club.adminStudents ?? [],
    clubRequests: [
      {
        id: "request-1",
        requestedByUserId: student.id,
        requestedByName: student.displayName,
        requestedByStudentId: student.universityId,
        name: "CUET Art Circle",
        shortName: "CAC",
        category: "Arts",
        tagline: "Create together",
        description: "Student art community",
        purpose: "Create a campus community for visual arts.",
        activities: ["Workshops"],
        status: "pending",
        submittedAt: "2026-09-29T09:00:00Z",
      },
    ],
    registrations: [],
  };
}

function renderWithClubContext(node: ReactNode, initial = snapshot()) {
  return render(
    <AuthenticatedUserProvider initialUser={student}>
      <ClubEventProvider initialSnapshot={initial}>{node}</ClubEventProvider>
    </AuthenticatedUserProvider>,
  );
}

describe("club and event behavior", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.setInterest.mockImplementation(async (_id, status) => ({
      ...event,
      myInterest: status,
    }));
    mocks.registerForEvent.mockResolvedValue({
      id: "registration-1",
      eventId: event.id,
      userId: student.id,
      name: student.displayName,
      email: student.email,
      studentId: student.universityId,
      department: student.department,
      registeredAt: "2026-09-29T09:00:00Z",
    });
  });

  test("Interested and Going controls publish the selected state", async () => {
    const user = userEvent.setup();
    const onAttendanceChange = vi.fn();
    const { rerender } = render(
      <EventCard
        attendance="none"
        clubName={club.name}
        event={event}
        onAttendanceChange={onAttendanceChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Interested" }));
    expect(onAttendanceChange).toHaveBeenCalledWith(event.id, "interested");
    rerender(
      <EventCard
        attendance="going"
        clubName={club.name}
        event={event}
        onAttendanceChange={onAttendanceChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Going" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("0 registered")).toBeVisible();
  });

  test("club request form submits structured values and pending status is visible", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ClubCreationRequestForm onClose={onClose} onSubmit={onSubmit} />);
    const values = [
      ["Club name", "CUET Art Circle"],
      ["Short name", "CAC"],
      ["Category", "Arts"],
      ["Tagline", "Create together"],
      ["Club description", "A visual arts community"],
      ["Why should this club be created?", "To connect campus artists."],
      ["Planned activities", "Workshops\nExhibitions"],
    ] as const;
    for (const [label, value] of values) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByRole("button", { name: "Send club request" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "CUET Art Circle",
        purpose: "To connect campus artists.",
      }),
    );

    renderWithClubContext(<ClubEventHub view="clubs" />);
    expect(screen.getByLabelText("Your club requests")).toHaveTextContent(
      "CUET Art Circlepending",
    );
  });

  test("club-admin workspace exposes mapped-admin controls and protects the final admin", async () => {
    const user = userEvent.setup();
    renderWithClubContext(<ClubAdminWorkspace club={club} />);
    await user.click(screen.getByRole("button", { name: "Student admins" }));
    expect(screen.getByLabelText("Registered student ID")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove my access" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Make club admin" })).toBeDisabled();
  });

  test("free registration stores one record and updates the count UI", async () => {
    const user = userEvent.setup();
    renderWithClubContext(<EventDetailRoute eventId={event.id} />);
    expect(screen.queryByLabelText("bKash transaction ID")).not.toBeInTheDocument();
    expect(screen.getByText("0 registered")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Complete registration" }));
    expect(await screen.findByText("You are registered")).toBeVisible();
    expect(mocks.registerForEvent).toHaveBeenCalledOnce();
  });

  test("paid registration requires a transaction ID and displays payment details", async () => {
    const paidEvent: CampusEvent = {
      ...event,
      registration: {
        enabled: true,
        isPaid: true,
        feeAmount: 200,
        bkashNumber: "01700000000",
      },
    };
    renderWithClubContext(
      <EventDetailRoute eventId={paidEvent.id} />,
      snapshot([paidEvent]),
    );
    expect(screen.getByText(/Send payment to bKash 01700000000/)).toBeVisible();
    expect(screen.getByLabelText("bKash transaction ID")).toBeRequired();
    const form = screen
      .getByRole("button", { name: "Complete registration" })
      .closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(
      await screen.findByText("Enter the bKash transaction ID for this paid event."),
    ).toBeVisible();
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });
});
