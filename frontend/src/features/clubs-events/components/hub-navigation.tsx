import Link from "next/link";

import { routes } from "@/config/routes";

import styles from "./club-event-hub.module.css";

type HubView = "clubs" | "events";

type HubNavigationProps = Readonly<{
  activeView: HubView;
}>;

const hubViews = [
  {
    id: "clubs",
    label: "Club directory",
    description: "People, activities, and club events",
    href: routes.clubs,
  },
  {
    id: "events",
    label: "All campus events",
    description: "Ongoing, upcoming, and recent",
    href: routes.events,
  },
] as const satisfies readonly {
  id: HubView;
  label: string;
  description: string;
  href: string;
}[];

export function HubNavigation({ activeView }: HubNavigationProps) {
  return (
    <nav className={styles.hubNavigation} aria-label="Club and Event Hub sections">
      {hubViews.map((view, index) => (
        <Link
          className={styles.hubNavigationLink}
          data-active={view.id === activeView}
          href={view.href}
          key={view.id}
          aria-current={view.id === activeView ? "page" : undefined}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{view.label}</strong>
          <small>{view.description}</small>
          <b aria-hidden="true">&#8599;</b>
        </Link>
      ))}
    </nav>
  );
}
