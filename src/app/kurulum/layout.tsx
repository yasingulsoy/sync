export default function KurulumLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
