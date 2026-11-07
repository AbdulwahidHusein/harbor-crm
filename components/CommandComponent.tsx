"use client";

import * as React from "react";
import {
  ArrowRight,
  Building2,
  CheckSquare,
  Command as CommandIcon,
  FileText,
  Handshake,
  LogOut,
  Receipt,
  Settings,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { searchDocuments, type DocumentSearchResult } from "@/actions/documents/search-documents";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";

const GO_TO = [
  { label: "Contacts", href: "/crm/contacts", icon: Users },
  { label: "Companies", href: "/crm/accounts", icon: Building2 },
  { label: "Opportunities", href: "/crm/opportunities", icon: Handshake },
  { label: "Leads", href: "/crm/leads", icon: UserPlus },
  { label: "Tasks", href: "/projects/tasks", icon: CheckSquare },
  { label: "Invoices", href: "/invoices", icon: Receipt },
  { label: "Command Center", href: "/intelligence", icon: CommandIcon },
];

import { signOut } from "@/lib/auth-client";
import { getCommandShortcutAction } from "@/lib/command-shortcuts";
import { useTranslations } from "next-intl";

export function CommandComponent() {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [docResults, setDocResults] = React.useState<DocumentSearchResult[]>([]);
  const router = useRouter();
  const t = useTranslations("CommandComponent");

  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setDocResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchDocuments(searchQuery).then(setDocResults).catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const action = getCommandShortcutAction(e);
      if (!action) return;
      if (action !== "close") e.preventDefault();
      if (action === "toggle") {
        setOpen((open) => !open);
      }
      if (action === "close") {
        setOpen(false);
      }
      if (action === "dashboard") {
        router.push("/");
        setOpen(false);
      }
      if (action === "profile") {
        router.push("/profile");
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [router]);

  return (
    <div className="hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open command menu"
      >
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("placeholder")}
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          {/*           <CommandGroup heading="Suggestions">
            <CommandItem>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <Smile className="mr-2 h-4 w-4" />
              <span>Search Emoji</span>
            </CommandItem>
            <CommandItem>
              <Calculator className="mr-2 h-4 w-4" />
              <span>Calculator</span>
            </CommandItem>
          </CommandGroup> */}
          {searchQuery.trim().length > 2 ? (
            <CommandGroup heading="Ask">
              <CommandItem
                value={`ask ${searchQuery}`}
                onSelect={() => {
                  router.push(`/intelligence?q=${encodeURIComponent(searchQuery.trim())}`);
                  setOpen(false);
                }}
              >
                <CommandIcon className="mr-2 h-4 w-4" />
                <span className="truncate">Ask Command Center: “{searchQuery.trim()}”</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </CommandItem>
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Go to">
            {GO_TO.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  router.push(item.href);
                  setOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {docResults.length > 0 && (
            <CommandGroup heading="Documents">
              {docResults.map((doc) => (
                <CommandItem
                  key={doc.id}
                  onSelect={() => {
                    router.push(`/documents?highlight=${doc.id}`);
                    setOpen(false);
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{doc.name}</span>
                    {doc.summary && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {doc.summary}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading={t("settings")}>
            <CommandItem onSelect={() => { router.push("/"); setOpen(false); }}>
              <User className="mr-2 h-4 w-4" />
              <span>{t("dashboard")}</span>
              <CommandShortcut>Shift + ⌘ + D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { router.push("/profile"); setOpen(false); }}>
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("profileSettings")}</span>
              <CommandShortcut>Shift + ⌘ + P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={async () => { await signOut(); window.location.href = new URL("/sign-in", window.location.origin).href; }}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("logout")}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
