import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddApprovedMessageForm } from "@/features/ad-concepts/ui/add-approved-message-form";
import { ApprovedMessageRow } from "@/features/ad-concepts/ui/approved-message-row";
import type { ApprovedMessageRow as ApprovedMessageRowData } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function ApprovedMessagesManager({
  messages,
}: {
  messages: ApprovedMessageRowData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approved Promotional Messages</CardTitle>
        <CardDescription>
          Every generated creative uses exactly one of these — Claude never
          invents promotional copy outside this list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {messages.map((message) => (
          <ApprovedMessageRow key={message.id} message={message} />
        ))}
        <AddApprovedMessageForm />
      </CardContent>
    </Card>
  );
}
