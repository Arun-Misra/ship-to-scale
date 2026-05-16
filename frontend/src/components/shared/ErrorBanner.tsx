interface Props {
  message: string;
}

export function ErrorBanner({ message }: Props) {
  return (
    <div className="mx-4 mt-2 px-4 py-2 bg-red-950 border border-red-800 rounded-lg text-sm text-red-300">
      {message}
    </div>
  );
}
