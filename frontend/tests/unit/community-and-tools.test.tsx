import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CampusAssistantPage } from "@/features/assistant/components/campus-assistant-page";
import { ResourceChatPage } from "@/features/chat/components/resource-chat-page";
import { ForumPostCard } from "@/features/forum/components/forum-post-card";
import { PostComposer } from "@/features/forum/components/post-composer";
import type { ForumAuthor, ForumPost } from "@/features/forum/types/forum";
import { ResourceHubPage } from "@/features/resources/components/resource-hub-page";
import { ResourceSharingProvider } from "@/features/resources/context/resource-sharing-context";
import type { ResourceSharingSnapshot } from "@/features/resources/types/resource-sharing";
import { TransportPage } from "@/features/transport/components/transport-page";
import type { TransportSnapshot } from "@/features/transport/types/transport";

const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  getSnapshot: vi.fn(),
  saveProfile: vi.fn(),
  submitRequest: vi.fn(),
  decideRequest: vi.fn(),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} role="img" />,
}));

vi.mock("@/services", () => ({
  campusAssistantService: { ask: mocks.ask },
  resourceSharingService: {
    getSnapshot: mocks.getSnapshot,
    saveProfile: mocks.saveProfile,
    submitRequest: mocks.submitRequest,
    decideRequest: mocks.decideRequest,
    getMessages: mocks.getMessages,
    sendMessage: mocks.sendMessage,
  },
}));

const resourceSnapshot: ResourceSharingSnapshot = {
  currentUserId: "student-1",
  profile: {
    isDiscoverable: true,
    level: "Level 4",
    hall: "Bangabandhu Hall",
    availabilityNote: "Evenings",
    resourceCategories: ["notebook"],
  },
  people: [
    {
      id: "student-2",
      name: "Rafi Student",
      username: "rafi",
      department: "EEE",
      level: "Level 3",
      hall: "Shaheed Tareq Huda Hall",
      availabilityNote: "After class",
      resourceCategories: ["notebook"],
    },
  ],
  requests: [
    {
      id: "request-1",
      senderId: "student-2",
      receiverId: "student-1",
      category: "notebook",
      resourceName: "Circuits notebook",
      message: "May I borrow it tonight?",
      status: "pending",
      createdAt: "2026-09-29T09:00:00Z",
    },
  ],
  conversations: [],
  messages: [],
};

const chatSnapshot: ResourceSharingSnapshot = {
  ...resourceSnapshot,
  requests: [{ ...resourceSnapshot.requests[0], status: "accepted" }],
  conversations: [
    {
      id: "conversation-1",
      requestId: "request-1",
      otherUserId: "student-2",
      otherUserName: "Rafi Student",
      resourceName: "Circuits notebook",
      lastActivityAt: "2026-09-29T09:00:00Z",
    },
  ],
};

const author: ForumAuthor = {
  id: "student-1",
  displayName: "Anika Rahman",
  username: "anika",
  role: "student",
  academicUnit: "CSE",
};

const post: ForumPost = {
  id: "post-1",
  author,
  body: "How can we improve campus life?",
  createdAt: "2026-09-29T09:00:00Z",
  comments: [],
};

const transportSnapshot: TransportSnapshot = {
  referenceDate: "2026-09-29",
  availableDates: ["2026-09-28", "2026-09-29", "2026-09-30"],
  buses: [
    {
      id: "bus-1",
      name: "Tista",
      type: "student",
      registration: "CUET-1",
      driverId: "driver-1",
    },
  ],
  drivers: [
    {
      id: "driver-1",
      name: "Md. Driver",
      phone: "01700000000",
      emergencyContact: "01700000000",
      assignedBusId: "bus-1",
    },
  ],
  routes: [
    {
      id: "regular",
      name: "Regular route",
      outboundStops: ["CUET", "GEC"],
      returnStops: ["GEC", "CUET"],
    },
  ],
  trips: [
    {
      id: "trip-1",
      date: "2026-09-29",
      startTime: "07:00",
      endTime: "08:20",
      title: "Morning run",
      direction: "to-campus",
      origin: "Bottoli",
      destination: "CUET",
      assignments: [{ routeId: "regular", busIds: ["bus-1"], driverIds: ["driver-1"] }],
    },
    {
      id: "trip-2",
      date: "2026-09-30",
      startTime: "16:15",
      endTime: "17:45",
      title: "Evening run",
      direction: "from-campus",
      origin: "CUET",
      destination: "Bottoli",
      assignments: [{ routeId: "regular", busIds: ["bus-1"], driverIds: ["driver-1"] }],
    },
  ],
};

describe("resources and chat", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getSnapshot.mockResolvedValue(resourceSnapshot);
    mocks.getMessages.mockResolvedValue({ items: [], hasMore: false });
    mocks.sendMessage.mockImplementation(async (conversationId, body) => ({
      id: "message-1",
      conversationId,
      senderId: "student-1",
      body,
      sentAt: "2026-09-29T10:00:00Z",
    }));
  });

  test("recipient can accept a pending resource request", async () => {
    const user = userEvent.setup();
    mocks.decideRequest.mockResolvedValue(undefined);
    render(
      <ResourceSharingProvider initialSnapshot={resourceSnapshot}>
        <ResourceHubPage />
      </ResourceSharingProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Request centre/ }));
    await user.click(screen.getByRole("button", { name: "Accept request" }));
    expect(mocks.decideRequest).toHaveBeenCalledWith("request-1", "accepted");
  });

  test("chat trims and sends non-empty input after acceptance", async () => {
    const user = userEvent.setup();
    render(
      <ResourceSharingProvider initialSnapshot={chatSnapshot}>
        <ResourceChatPage />
      </ResourceSharingProvider>,
    );
    const input = screen.getByPlaceholderText("Message Rafi Student");
    const button = screen.getByRole("button", { name: "Send message" });
    expect(button).toBeDisabled();
    await user.type(input, "  I can collect it tomorrow.  ");
    await user.click(button);
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      "conversation-1",
      "I can collect it tomorrow.",
    );
    expect(await screen.findAllByText("I can collect it tomorrow.")).toHaveLength(2);
  });
});

describe("forum forms", () => {
  test("renders untrusted post markup as inert text", () => {
    const hostileBody = '<img src=x onerror="globalThis.compromised=true">';
    render(
      <ForumPostCard
        isReported={false}
        onCreateComment={vi.fn()}
        onReportPost={vi.fn()}
        post={{ ...post, body: hostileBody }}
      />,
    );
    expect(screen.getByText(hostileBody)).toBeVisible();
    expect(document.querySelector("img[src='x']")).not.toBeInTheDocument();
  });

  test("post composer rejects blank text and publishes normalized text only", async () => {
    const user = userEvent.setup();
    const onCreatePost = vi.fn().mockResolvedValue(undefined);
    render(<PostComposer currentUser={author} onCreatePost={onCreatePost} />);
    await user.click(screen.getByRole("button", { name: "Publish post" }));
    expect(
      await screen.findByText("Write something before publishing your post."),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Post text"), "  Useful discussion  ");
    await user.click(screen.getByRole("button", { name: "Publish post" }));
    expect(onCreatePost).toHaveBeenCalledWith("Useful discussion");
    expect(screen.getByText("Text only")).toBeVisible();
  });

  test("comment form validates text and report requires confirmation", async () => {
    const user = userEvent.setup();
    const onCreateComment = vi.fn().mockResolvedValue(undefined);
    const onReportPost = vi.fn().mockResolvedValue(undefined);
    render(
      <ForumPostCard
        isReported={false}
        onCreateComment={onCreateComment}
        onReportPost={onReportPost}
        post={post}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Write a comment before posting it.")).toBeVisible();
    await user.type(screen.getByLabelText("Add a text comment"), "  Helpful reply  ");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(onCreateComment).toHaveBeenCalledWith("post-1", "Helpful reply");

    await user.click(screen.getByRole("button", { name: "Report to Admin" }));
    expect(screen.getByText("Report this post?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm report" }));
    expect(onReportPost).toHaveBeenCalledWith("post-1");
  });
});

test("transport date selector excludes past dates and changes the visible run", async () => {
  const user = userEvent.setup();
  render(<TransportPage snapshot={transportSnapshot} />);
  expect(screen.queryByRole("button", { name: /28 Sep/ })).not.toBeInTheDocument();
  expect(screen.getByText("Morning run")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /30 Sep/ }));
  expect(screen.getByText("Evening run")).toBeVisible();
  expect(screen.queryByText("Morning run")).not.toBeInTheDocument();
});

describe("Campus AI Assistant states", () => {
  beforeEach(() => mocks.ask.mockReset());

  test("shows thinking and renders a grounded answer", async () => {
    const user = userEvent.setup();
    let resolveAnswer: (value: {
      answer: string;
      status: "answered";
    }) => void = () => {};
    mocks.ask.mockReturnValue(
      new Promise((resolve) => {
        resolveAnswer = resolve;
      }),
    );
    render(<CampusAssistantPage />);
    await user.type(screen.getByLabelText("Ask a campus question"), "Where is CUET?");
    await user.click(screen.getByRole("button", { name: /Ask assistant/ }));
    expect(screen.getByText("Checking campus information")).toBeVisible();
    resolveAnswer({ answer: "CUET is in Raozan, Chattogram.", status: "answered" });
    expect(await screen.findByText("CUET is in Raozan, Chattogram.")).toBeVisible();
  });
});
