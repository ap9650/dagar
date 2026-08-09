"use client";

import { useFormStatus } from "react-dom";
import { updateRequestStatus } from "@/app/admin/requests/actions";

/**
 * "I have picked this up."
 *
 * Deliberately one button and not two. The honest states today are waiting and
 * not waiting: there is no mentor service, so "resolved" would be a claim about
 * an outcome nobody recorded. The action accepts `resolved` for when there is
 * one; the queue only offers the state it can vouch for.
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 px-lg rounded-(--radius-control) bg-primary text-background
                 text-label font-medium disabled:opacity-60"
    >
      {pending ? "Saving" : "I have picked this up"}
    </button>
  );
}

export function AcknowledgeButton({ id }: { id: string }) {
  return (
    <form action={updateRequestStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="acknowledged" />
      <Submit />
    </form>
  );
}
