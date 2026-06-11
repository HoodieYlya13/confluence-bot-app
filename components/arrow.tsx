interface ArrowProps {
  direction?: "up-right" | "right";
  className?: string;
}

export function Arrow({ direction = "right", className = "" }: ArrowProps) {
  if (direction === "up-right")
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${className}`}
      >
        <path
          fillRule="evenodd"
          d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
          clipRule="evenodd"
        />
      </svg>
    );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`size-4 transition-transform group-hover:translate-x-1 ${className}`}
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638L10.22 5.08a.75.75 0 111.06-1.06l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 11-1.06-1.06l4.168-4.17H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}
