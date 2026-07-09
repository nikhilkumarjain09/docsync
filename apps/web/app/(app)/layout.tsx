import { AppLayout } from '@/components/shell/app-layout';

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
