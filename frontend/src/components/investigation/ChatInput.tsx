import { useState } from "react";

interface Props {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q || disabled) return;
    setValue("");
    onSubmit(q);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
        placeholder='Ask anything — "Why did revenue drop last week?"'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-4 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-500"
      >
        {disabled ? "Investigating..." : "Ask"}
      </button>
    </form>
  );
}
