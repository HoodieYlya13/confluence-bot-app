import { Spinner } from "@/components/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
      <Spinner className="h-10 w-10 text-sky-600 dark:text-sky-400" />
      <p className="text-sm font-medium text-zinc-500 animate-pulse">
        Loading console data...
      </p>
    </div>
  );
}
