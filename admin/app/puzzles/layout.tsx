import AdminLayout from '@/components/AdminLayout';

export default function PuzzlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
