import getNextVersion from "@/actions/system/get-next-version";
import Link from "next/link";
import { version } from "@/package.json";


const Footer = async () => {
  const nextVersion = await getNextVersion();
  //console.log(nextVersion, "nextVersion");
  return (
    <footer className="flex h-10 w-full items-center justify-between border-t border-border px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
      <Link href="/" className="transition-colors hover:text-foreground">
        {process.env.NEXT_PUBLIC_APP_NAME} v{version}
      </Link>
      <span className="hidden tabular-nums md:inline">
        Next.js {nextVersion.substring(1, 7) || process.env.NEXT_PUBLIC_NEXT_VERSION}
      </span>
    </footer>
  );
};

export default Footer;
