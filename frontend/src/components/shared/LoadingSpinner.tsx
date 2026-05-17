export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
