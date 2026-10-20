import Link from 'next/link';

export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-white py-4 text-center text-xs text-gray-400">
        <Link
          href="/"
          className="hover:text-blue-800 transition-colors"
        >
          MediLink
        </Link>{' '}
        — The professional OS for physicians
      </footer>
    </div>
  );
}
