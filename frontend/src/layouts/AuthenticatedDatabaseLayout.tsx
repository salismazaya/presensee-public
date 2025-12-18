import { type JSX } from "react";
import { DatabaseContextConsumer } from "../contexts/DatabaseContext";
import AuthenticatedLayout from "./AuthenticatedLayout";

export default function AuthenticatedDatabaseLayout({
  child,
}: {
  child: JSX.Element;
}) {
  return (
    <DatabaseContextConsumer>
      <AuthenticatedLayout child={child} />
    </DatabaseContextConsumer>
  );
}
