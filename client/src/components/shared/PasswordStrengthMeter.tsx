// PasswordStrengthMeter — uses zxcvbn for realistic password strength scoring
import { useMemo } from "react";
import zxcvbn from "zxcvbn";

interface Props {
  password: string;
}

const LEVELS = [
  { label: "Very weak",  color: "bg-red-500",    textColor: "text-red-600" },
  { label: "Weak",       color: "bg-orange-500",  textColor: "text-orange-600" },
  { label: "Fair",       color: "bg-yellow-500",  textColor: "text-yellow-600" },
  { label: "Strong",     color: "bg-blue-500",    textColor: "text-blue-600" },
  { label: "Very strong",color: "bg-green-500",   textColor: "text-green-600" },
];

export default function PasswordStrengthMeter({ password }: Props) {
  const result = useMemo(() => (password ? zxcvbn(password) : null), [password]);

  if (!password) return null;

  const score = result?.score ?? 0; // 0-4
  const level = LEVELS[score];
  const filledBars = score + 1; // 1-5 bars filled

  return (
    <div className="mt-2 space-y-1.5">
      {/* Bar track */}
      <div className="flex gap-1">
        {LEVELS.map((lvl, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < filledBars ? lvl.color : "bg-muted"
            }`}
          />
        ))}
      </div>
      {/* Label + suggestion */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${level.textColor}`}>
          {level.label}
        </span>
        {result?.feedback?.suggestions?.[0] && (
          <span className="text-xs text-muted-foreground truncate max-w-[220px]">
            {result.feedback.suggestions[0]}
          </span>
        )}
      </div>
    </div>
  );
}
