import AdminLayout from '@/components/AdminLayout';

export default function TodosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout fullWidth>{children}</AdminLayout>;
}
