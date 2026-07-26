import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/application/logout";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm">
        Log out
      </Button>
    </form>
  );
}
