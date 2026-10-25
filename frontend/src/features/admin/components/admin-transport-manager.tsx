"use client";

import { useState, type FormEvent } from "react";

import type { AdminSnapshotSetter } from "@/features/admin/components/admin-page";
import type {
  AdminDriver,
  AdminDriverInput,
  AdminRoute,
  AdminRouteInput,
  AdminSchedule,
  AdminScheduleInput,
  AdminSnapshot,
} from "@/features/admin/types/admin";
import { adminService } from "@/services";

import styles from "./admin-page.module.css";

type TransportEditor =
  | { kind: "schedule"; id?: string }
  | { kind: "route"; id?: string }
  | { kind: "driver"; id?: string };

type AdminTransportManagerProps = Readonly<{
  snapshot: AdminSnapshot;
  setSnapshot: AdminSnapshotSetter;
}>;

export function AdminTransportManager({
  snapshot,
  setSnapshot,
}: AdminTransportManagerProps) {
  const [editor, setEditor] = useState<TransportEditor | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  function upsert<Item extends { id: string }>(items: readonly Item[], item: Item) {
    return items.some((current) => current.id === item.id)
      ? items.map((current) => (current.id === item.id ? item : current))
      : [item, ...items];
  }

  async function saveSchedule(input: AdminScheduleInput, id?: string) {
    setBusyId("schedule-form");
    setError("");
    try {
      const saved = await adminService.saveSchedule(input, id);
      setSnapshot((current) => ({
        ...current,
        schedules: upsert(current.schedules, saved),
      }));
      setEditor(null);
    } catch {
      setError("The schedule could not be saved. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function saveRoute(input: AdminRouteInput, id?: string) {
    setBusyId("route-form");
    setError("");
    try {
      const saved = await adminService.saveRoute(input, id);
      setSnapshot((current) => ({
        ...current,
        routes: upsert(current.routes, saved),
      }));
      setEditor(null);
    } catch {
      setError("The route could not be saved. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function saveDriver(input: AdminDriverInput, id?: string) {
    setBusyId("driver-form");
    setError("");
    try {
      const saved = await adminService.saveDriver(input, id);
      setSnapshot((current) => ({
        ...current,
        drivers: upsert(current.drivers, saved),
      }));
      setEditor(null);
    } catch {
      setError("The driver could not be saved. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function removeSchedule(id: string) {
    setBusyId(id);
    await adminService.deleteSchedule(id);
    setSnapshot((current) => ({
      ...current,
      schedules: current.schedules.filter((schedule) => schedule.id !== id),
    }));
    setBusyId("");
  }

  async function removeRoute(id: string) {
    setBusyId(id);
    await adminService.deleteRoute(id);
    setSnapshot((current) => ({
      ...current,
      routes: current.routes.filter((route) => route.id !== id),
    }));
    setBusyId("");
  }

  async function removeDriver(id: string) {
    setBusyId(id);
    await adminService.deleteDriver(id);
    setSnapshot((current) => ({
      ...current,
      drivers: current.drivers.filter((driver) => driver.id !== id),
    }));
    setBusyId("");
  }

  const editingSchedule =
    editor?.kind === "schedule"
      ? snapshot.schedules.find((item) => item.id === editor.id)
      : undefined;
  const editingRoute =
    editor?.kind === "route"
      ? snapshot.routes.find((item) => item.id === editor.id)
      : undefined;
  const editingDriver =
    editor?.kind === "driver"
      ? snapshot.drivers.find((item) => item.id === editor.id)
      : undefined;

  return (
    <section
      className={styles.managerSection}
      aria-labelledby="transport-manager-title"
    >
      <header className={styles.sectionHeading}>
        <div>
          <p>Campus mobility controls</p>
          <h2 id="transport-manager-title">Transport management</h2>
        </div>
        <button onClick={() => setEditor({ kind: "schedule" })} type="button">
          Add schedule
        </button>
      </header>

      {error ? <div className={styles.actionError}>{error}</div> : null}

      {editor ? (
        <div className={styles.editorPanel}>
          {editor.kind === "schedule" ? (
            <ScheduleForm
              busy={busyId === "schedule-form"}
              drivers={snapshot.drivers}
              buses={snapshot.buses ?? []}
              initial={editingSchedule}
              key={`schedule-${editor.id ?? "new"}`}
              onCancel={() => setEditor(null)}
              onSave={saveSchedule}
              routes={snapshot.routes}
            />
          ) : null}
          {editor.kind === "route" ? (
            <RouteForm
              busy={busyId === "route-form"}
              initial={editingRoute}
              key={`route-${editor.id ?? "new"}`}
              onCancel={() => setEditor(null)}
              onSave={saveRoute}
            />
          ) : null}
          {editor.kind === "driver" ? (
            <DriverForm
              busy={busyId === "driver-form"}
              buses={snapshot.buses ?? []}
              initial={editingDriver}
              key={`driver-${editor.id ?? "new"}`}
              onCancel={() => setEditor(null)}
              onSave={saveDriver}
            />
          ) : null}
        </div>
      ) : null}

      <div className={styles.scheduleGrid}>
        {snapshot.schedules.map((schedule) => {
          const route = snapshot.routes.find((item) => item.id === schedule.routeId);
          const driver = snapshot.drivers.find((item) => item.id === schedule.driverId);

          return (
            <article className={styles.scheduleAdminCard} key={schedule.id}>
              <div className={styles.cardTopline}>
                <span>{schedule.recurrence}</span>
                <time dateTime={schedule.serviceDate}>{schedule.serviceDate}</time>
              </div>
              <h3>{schedule.title}</h3>
              <strong>
                {schedule.startTime} - {schedule.endTime}
              </strong>
              <dl>
                <div>
                  <dt>Route</dt>
                  <dd>{route?.name ?? "Route unavailable"}</dd>
                </div>
                <div>
                  <dt>Bus</dt>
                  <dd>{schedule.busName}</dd>
                </div>
                <div>
                  <dt>Driver</dt>
                  <dd>{driver?.name ?? "Driver unavailable"}</dd>
                </div>
              </dl>
              <div className={styles.cardActions}>
                <button
                  onClick={() => setEditor({ kind: "schedule", id: schedule.id })}
                  type="button"
                >
                  Edit
                </button>
                <button
                  disabled={busyId === schedule.id}
                  onClick={() => void removeSchedule(schedule.id)}
                  type="button"
                >
                  {busyId === schedule.id ? "Removing..." : "Remove"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.transportDirectories}>
        <TransportDirectory
          actionLabel="Add route"
          count={snapshot.routes.length}
          onAdd={() => setEditor({ kind: "route" })}
          title="Route directory"
        >
          {snapshot.routes.map((route) => {
            const isAssigned = snapshot.schedules.some(
              (schedule) => schedule.routeId === route.id,
            );
            return (
              <article key={route.id}>
                <div>
                  <strong>{route.name}</strong>
                  <p>{route.stops.join(" → ")}</p>
                </div>
                <div className={styles.miniActions}>
                  <button
                    onClick={() => setEditor({ kind: "route", id: route.id })}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    disabled={isAssigned || busyId === route.id}
                    onClick={() => void removeRoute(route.id)}
                    title={isAssigned ? "Remove assigned schedules first" : undefined}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </TransportDirectory>

        <TransportDirectory
          actionLabel="Add driver"
          count={snapshot.drivers.length}
          onAdd={() => setEditor({ kind: "driver" })}
          title="Driver directory"
        >
          {snapshot.drivers.map((driver) => {
            const isAssigned = snapshot.schedules.some(
              (schedule) => schedule.driverId === driver.id,
            );
            return (
              <article key={driver.id}>
                <div>
                  <strong>{driver.name}</strong>
                  <p>
                    {driver.phone} · {driver.assignedBusName ?? "Bus not assigned"}
                  </p>
                </div>
                <div className={styles.miniActions}>
                  <button
                    onClick={() => setEditor({ kind: "driver", id: driver.id })}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    disabled={isAssigned || busyId === driver.id}
                    onClick={() => void removeDriver(driver.id)}
                    title={isAssigned ? "Remove assigned schedules first" : undefined}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </TransportDirectory>
      </div>
    </section>
  );
}

function TransportDirectory({
  title,
  count,
  actionLabel,
  onAdd,
  children,
}: Readonly<{
  title: string;
  count: number;
  actionLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}>) {
  return (
    <section className={styles.directoryPanel}>
      <header>
        <div>
          <h3>{title}</h3>
          <span>{count} records</span>
        </div>
        <button onClick={onAdd} type="button">
          {actionLabel}
        </button>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ScheduleForm({
  initial,
  routes,
  drivers,
  buses,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  initial?: AdminSchedule;
  routes: readonly AdminRoute[];
  drivers: readonly AdminDriver[];
  buses: readonly NonNullable<AdminSnapshot["buses"]>[number][];
  busy: boolean;
  onSave: (input: AdminScheduleInput, id?: string) => Promise<void>;
  onCancel: () => void;
}>) {
  const [values, setValues] = useState<AdminScheduleInput>({
    title: initial?.title ?? "",
    serviceDate: initial?.serviceDate ?? new Date().toISOString().slice(0, 10),
    startTime: initial?.startTime ?? "07:00",
    endTime: initial?.endTime ?? "08:20",
    routeId: initial?.routeId ?? routes[0]?.id ?? "",
    driverId: initial?.driverId ?? drivers[0]?.id ?? "",
    busName: initial?.busName ?? "",
    busId: initial?.busId ?? buses[0]?.id ?? "",
    direction: initial?.direction ?? "to-campus",
    origin: initial?.origin ?? "Bottoli Rail Station",
    destination: initial?.destination ?? "CUET",
    recurrenceUntil: initial?.recurrenceUntil ?? "",
    recurrence: initial?.recurrence ?? "weekly",
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(values, initial?.id);
  }

  return (
    <form className={styles.adminForm} onSubmit={submit}>
      <FormHeading
        title={initial ? "Edit schedule" : "Add schedule"}
        description="Set a service window and choose its route, driver, bus, and recurrence."
      />
      <div className={styles.formGrid}>
        <AdminField label="Schedule title">
          <input
            required
            value={values.title}
            onChange={(event) => setValues({ ...values, title: event.target.value })}
          />
        </AdminField>
        <AdminField label="Service date">
          <input
            required
            type="date"
            value={values.serviceDate}
            onChange={(event) =>
              setValues({ ...values, serviceDate: event.target.value })
            }
          />
        </AdminField>
        <AdminField label="Start time">
          <input
            required
            type="time"
            value={values.startTime}
            onChange={(event) =>
              setValues({ ...values, startTime: event.target.value })
            }
          />
        </AdminField>
        <AdminField label="End time">
          <input
            required
            type="time"
            value={values.endTime}
            onChange={(event) => setValues({ ...values, endTime: event.target.value })}
          />
        </AdminField>
        <AdminField label="Route">
          <select
            required
            value={values.routeId}
            onChange={(event) => setValues({ ...values, routeId: event.target.value })}
          >
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Direction">
          <select
            value={values.direction}
            onChange={(event) =>
              setValues({
                ...values,
                direction: event.target.value as AdminScheduleInput["direction"],
              })
            }
          >
            <option value="to-campus">To campus</option>
            <option value="from-campus">From campus</option>
            <option value="round-trip">Round trip</option>
          </select>
        </AdminField>
        <AdminField label="Origin">
          <input
            required
            value={values.origin}
            onChange={(event) => setValues({ ...values, origin: event.target.value })}
          />
        </AdminField>
        <AdminField label="Destination">
          <input
            required
            value={values.destination}
            onChange={(event) =>
              setValues({ ...values, destination: event.target.value })
            }
          />
        </AdminField>
        <AdminField label="Driver">
          <select
            required
            value={values.driverId}
            onChange={(event) => setValues({ ...values, driverId: event.target.value })}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Bus name">
          <select
            required
            value={values.busId}
            onChange={(event) => {
              const bus = buses.find((item) => item.id === event.target.value);
              setValues({
                ...values,
                busId: event.target.value,
                busName: bus?.name ?? "",
              });
            }}
          >
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.name} · {bus.registration}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Repeat">
          <select
            value={values.recurrence}
            onChange={(event) =>
              setValues({
                ...values,
                recurrence: event.target.value as AdminScheduleInput["recurrence"],
              })
            }
          >
            <option value="once">One date only</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </AdminField>
      </div>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function RouteForm({
  initial,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  initial?: AdminRoute;
  busy: boolean;
  onSave: (input: AdminRouteInput, id?: string) => Promise<void>;
  onCancel: () => void;
}>) {
  const [name, setName] = useState(initial?.name ?? "");
  const [stops, setStops] = useState(initial?.stops.join(", ") ?? "");

  return (
    <form
      className={styles.adminForm}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ name, stops }, initial?.id);
      }}
    >
      <FormHeading
        title={initial ? "Edit route" : "Add route"}
        description="Enter stops in travel order, separated by commas."
      />
      <div className={styles.formGrid}>
        <AdminField label="Route name">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </AdminField>
        <AdminField label="Stops">
          <input
            required
            value={stops}
            onChange={(event) => setStops(event.target.value)}
          />
        </AdminField>
      </div>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function DriverForm({
  initial,
  busy,
  buses,
  onSave,
  onCancel,
}: Readonly<{
  initial?: AdminDriver;
  busy: boolean;
  buses: readonly NonNullable<AdminSnapshot["buses"]>[number][];
  onSave: (input: AdminDriverInput, id?: string) => Promise<void>;
  onCancel: () => void;
}>) {
  const [values, setValues] = useState<AdminDriverInput>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    licenseNumber: initial?.licenseNumber ?? "",
    assignedBusId: initial?.assignedBusId ?? buses[0]?.id ?? "",
    assignedBusName: initial?.assignedBusName ?? buses[0]?.name ?? "",
    driverClass: initial?.driverClass ?? "heavy",
  });

  return (
    <form
      className={styles.adminForm}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(values, initial?.id);
      }}
    >
      <FormHeading
        title={initial ? "Edit driver" : "Add driver"}
        description="Maintain the contact, vehicle class, and normal bus assignment."
      />
      <div className={styles.formGrid}>
        <AdminField label="Driver name">
          <input
            required
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </AdminField>
        <AdminField label="Phone number">
          <input
            required
            type="tel"
            value={values.phone}
            onChange={(event) => setValues({ ...values, phone: event.target.value })}
          />
        </AdminField>
        <AdminField label="Assigned bus">
          <select
            required
            value={values.assignedBusId}
            onChange={(event) => {
              const bus = buses.find((item) => item.id === event.target.value);
              setValues({
                ...values,
                assignedBusId: event.target.value,
                assignedBusName: bus?.name,
              });
            }}
          >
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Driver class">
          <select
            value={values.driverClass}
            onChange={(event) =>
              setValues({
                ...values,
                driverClass: event.target.value as "heavy" | "light",
              })
            }
          >
            <option value="heavy">Heavy vehicle</option>
            <option value="light">Light vehicle</option>
          </select>
        </AdminField>
      </div>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function FormHeading({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <header className={styles.formHeading}>
      <div>
        <p>Admin management form</p>
        <h3>{title}</h3>
      </div>
      <span>{description}</span>
    </header>
  );
}

function AdminField({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className={styles.adminField}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function FormActions({
  busy,
  onCancel,
}: Readonly<{ busy: boolean; onCancel: () => void }>) {
  return (
    <div className={styles.formActions}>
      <button disabled={busy} onClick={onCancel} type="button">
        Cancel
      </button>
      <button disabled={busy} type="submit">
        {busy ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
