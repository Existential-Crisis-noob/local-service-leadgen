"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function confirmUnsubscribeAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();

  if (!email) redirect(`/unsubscribe/${token}`);

  await prisma.unsubscribe.upsert({
    where: { email },
    create: { email, reason: "Recipient request" },
    update: {},
  });

  redirect(`/unsubscribe/${token}?done=1`);
}
