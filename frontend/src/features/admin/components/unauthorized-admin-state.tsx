import Link from "next/link";

import { AppShell } from "@/components/shared/app-shell";
import { routes } from "@/config/routes";

import styles from "./admin-page.module.css";

export function UnauthorizedAdminState() {
  return (
    <AppShell className={styles.unauthorizedShell}>
      <section className={styles.unauthorizedState} aria-labelledby="denied-title">
        <span aria-hidden="true">403</span>
        <p>Admin-only area</p>
        <h1 id="denied-title">You do not have access to this workspace.</h1>
        <div>
          <Link href={routes.home}>Return to Home</Link>
          <Link href={routes.auth.adminLogin}>Use Admin login</Link>
        </div>
      </section>
    </AppShell>
  );
}
