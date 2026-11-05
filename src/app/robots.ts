import type { MetadataRoute } from "next";

/**
 * Bu site kiosk ekranları için; arama motorlarında bulunacak bir içerik yok.
 * Botlar /fs'i tarayıp panelde sahte ekran olarak görünüyor ve 80 MB'lık
 * videoları indirip bant genişliği harcıyordu.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
