import { authPolicy } from "@/features/auth/config/auth-policy";
import { getPasswordChecks } from "@/features/auth/lib/auth-validation";

import styles from "./auth.module.css";

type PasswordRequirementsProps = Readonly<{
  password: string;
}>;

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const checks = getPasswordChecks(password);
  const requirements = [
    {
      met: checks.minimumLength,
      label: `${authPolicy.minimumPasswordLength}+ characters`,
    },
    { met: checks.uppercase, label: "Uppercase letter" },
    { met: checks.lowercase, label: "Lowercase letter" },
    { met: checks.number, label: "Number" },
  ];

  return (
    <ul className={styles.passwordRequirements} aria-label="Password requirements">
      {requirements.map((requirement) => (
        <li
          className={requirement.met ? styles.requirementMet : ""}
          key={requirement.label}
        >
          <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
          {requirement.label}
        </li>
      ))}
    </ul>
  );
}
