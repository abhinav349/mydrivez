import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  return (
    <>
      <Navbar user={user ? { name: user.name, role: user.role, avatarUrl: user.avatarUrl, unread } : null} transparent />
      <main>{children}</main>
      <Footer />
    </>
  );
}
