/** WMO weathercode → kısa Türkçe açıklama (Open-Meteo) */
export function wmoWeatherToTr(code: number): string {
  if (code === 0) return "Açık";
  if (code <= 3) return "Parçalı bulutlu";
  if (code <= 48) return "Sis";
  if (code <= 57) return "Çiseleme";
  if (code <= 67) return "Yağmur";
  if (code <= 77) return "Kar";
  if (code <= 82) return "Sağanak";
  if (code <= 86) return "Kar sağanağı";
  if (code <= 99) return "Fırtına";
  return "Değişken";
}

/** WMO kodu → tek görsel ikon (emoji, API anahtarı gerektirmez) */
export function wmoWeatherToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}
