type IconProps = { className?: string };

export function UploadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  );
}

export function UsersIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M9.5 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 1a3 3 0 0 1 0 6" />
    </svg>
  );
}

export function AssignIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4.5 19v-1a4.5 4.5 0 0 1 4.5-4.5h4.5" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m16.5 15.5 2 2 3.5-4" />
    </svg>
  );
}

export function ChatIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6.5 17.5H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2.5" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8 20v-2.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V22l-4-2H10a2 2 0 0 1-2-2.5Z" />
    </svg>
  );
}

export function ResultIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 13h10M7 9h6m-6 8h8M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5h6v2m-7 4v6m4-6v6m4-6v6" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 12h10l1-12" />
    </svg>
  );
}

export function EditIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4Z" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m12 8 4 4" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}
