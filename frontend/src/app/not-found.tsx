import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <p className="text-primary text-7xl font-bold">404</p>
      <h2 className="text-foreground text-2xl font-semibold">Page Not Found</h2>
      <p className="text-muted-foreground text-center text-sm">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground mt-2 rounded-md px-6 py-2 text-sm font-medium transition-colors hover:opacity-90"
      >
        Go home
      </Link>
    </div>
  );
}
