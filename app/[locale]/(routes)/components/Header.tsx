import Feedback from "./Feedback";
import FulltextSearch from "./FulltextSearch";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SetLanguage } from "@/components/SetLanguage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandComponent } from "@/components/CommandComponent";
import SupportComponent from "@/components/support";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";

type Props = {
  id: string;
  lang: string;
};

/**
 * Header Component - Task Group 3.2
 *
 * Reorganized header for new layout with shadcn dashboard-01 pattern.
 *
 * Layout Structure:
 * - Left side: SidebarTrigger (mobile menu), FulltextSearch
 * - Right side: CommandComponent, SetLanguage, Feedback, ThemeToggle, SupportComponent
 *
 * Changes from previous version:
 * - Removed AvatarDropdown (functionality moved to nav-user section in sidebar)
 * - Removed unused props: name, email, avatar (now only used by nav-user)
 * - Optimized spacing and alignment for new layout
 * - SidebarTrigger added in Task 2.8.0 for mobile menu control
 *
 * Note: User profile functionality (avatar, name, email, user actions) is now
 * handled by the NavUser component in the sidebar footer (Task 3.1).
 */
const Header = ({ id, lang }: Props) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-[2px] sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <FulltextSearch />
      </div>
      <div className="flex items-center gap-1">
        <CommandComponent />
        <div className="hidden items-center gap-1 md:flex">
          <SetLanguage userId={id} />
          <Feedback />
          <CurrencySwitcher />
        </div>
        <ThemeToggle />
        <SupportComponent />
      </div>
    </header>
  );
};

export default Header;
