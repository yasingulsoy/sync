import { notFound } from "next/navigation";
import { HomeShell } from "@/components/HomeShell";
import { isValidGroupName } from "@/lib/screenGroups";

/**
 * IP kuralını geçersiz kılan adres: /fs/medipol
 *
 * Bir şubenin dış IP'si değiştiğinde deploy beklemeden o mini PC'nin
 * kiosk adresini buna çevirip ekranı doğru içeriğe döndürebilirsiniz.
 */
export default async function EkranPage({
  params,
}: {
  params: Promise<{ ekran: string }>;
}) {
  const { ekran } = await params;
  if (!isValidGroupName(ekran)) notFound();
  return <HomeShell group={ekran} />;
}
