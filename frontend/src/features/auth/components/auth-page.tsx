import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";

import styles from "./auth.module.css";

type AuthPageProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelTitle: string;
  panelDescription: string;
  panelItems: readonly string[];
  children: ReactNode;
  admin?: boolean;
  compactMobile?: boolean;
}>;

export function AuthPage({
  eyebrow,
  title,
  description,
  panelTitle,
  panelDescription,
  panelItems,
  children,
  admin = false,
  compactMobile = false,
}: AuthPageProps) {
  return (
    <main
      className={`${styles.page} ${compactMobile ? styles.compactMobile : ""}`}
      id="main-content"
    >
      <section className={`${styles.contextPanel} ${admin ? styles.adminPanel : ""}`}>
        <Link className={styles.brand} href={routes.home}>
          <span aria-hidden="true">U</span>
          <strong>UniCircle</strong>
        </Link>

        <div className={styles.panelContent}>
          <p className={styles.panelEyebrow}>
            {admin ? "Restricted access" : "CUET digital campus"}
          </p>
          <h2>{panelTitle}</h2>
          <p>{panelDescription}</p>
          <ul>
            {panelItems.map((item) => (
              <li key={item}>
                <span aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.securityNote}>
          {admin
            ? "Admin registration is never public."
            : "Your credentials remain private and are never displayed publicly."}
        </p>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formContainer}>
          <header className={styles.formHeader}>
            <p>{eyebrow}</p>
            <h1>{title}</h1>
            <span>{description}</span>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}
