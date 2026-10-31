import { Avatar } from "@/components/ui/misc";
import { cn, formatDateTime } from "@/lib/utils";

export type ThreadMessage = { id: string; body: string; isStaff: boolean; createdAt: Date; author: { name: string; avatarUrl: string | null } };

export function Thread({ messages, viewer }: { messages: ThreadMessage[]; viewer: "customer" | "staff" }) {
  return (
    <ol className="space-y-5">
      {messages.map((m) => {
        const mine = viewer === "staff" ? m.isStaff : !m.isStaff;
        return (
          <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
            <Avatar name={m.isStaff ? "MyDrivez Support" : m.author.name} src={m.author.avatarUrl} size={34} className={m.isStaff ? "bg-lime !text-ink" : ""} />
            <div className={cn("max-w-[80%]", mine && "text-right")}>
              <p className="text-[12px] text-muted">
                <span className="font-semibold text-ink">{m.isStaff ? `${m.author.name} · MyDrivez` : m.author.name}</span> · {formatDateTime(m.createdAt)}
              </p>
              <div className={cn("mt-1 inline-block whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-[14px] leading-relaxed", mine ? "rounded-tr-sm bg-ink text-white" : "rounded-tl-sm bg-white text-graphite shadow-card")}>{m.body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
