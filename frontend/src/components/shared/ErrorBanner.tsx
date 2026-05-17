interface Props {
  message: string;
}

export function ErrorBanner({ message }: Props) {
  return (
    <div className="mx-4 mt-2 px-4 py-2 bg-red-500/[0.07] border border-red-500/25 rounded-xl text-sm text-red-400">
      {message}
    </div>
  );
}
