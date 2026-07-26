"use client";

/**
 * How many words an AI-generated deck should have.
 *
 * The native select control is replaced with our own chevron: browsers draw
 * theirs against the control's full box, which sits a hair below the text
 * baseline once the control is padded, and the two AI panels sat next to each
 * other made the offset obvious. Absolute centering keeps it honest.
 */
export default function WordCountSelect({
  value,
  onChange,
  disabled = false,
  options = [20, 35, 50],
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  options?: number[];
}) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-9 text-sm leading-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </span>
  );
}
