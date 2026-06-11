import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center px-4">
      <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-950/30 mb-4">
        <svg
          className="h-8 w-8 text-amber-600 dark:text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Page Not Found
      </h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        Could not find the requested resource. Please check the URL or return to
        the main dashboard.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
