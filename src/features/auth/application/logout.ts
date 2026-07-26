"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/features/auth/infrastructure/auth-repository";

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
