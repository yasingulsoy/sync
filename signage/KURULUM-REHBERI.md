# HospiSync Digital Signage - Mini PC Kurulum Rehberi

## Gereksinimler
- Windows 10/11 yüklü Mini PC
- Google Chrome tarayıcı
- İnternet bağlantısı
- HDMI ile bağlı TV/Monitör

---

## Adım 1: Temel Windows Ayarları

### Otomatik Oturum Açma (Şifresiz Boot)
1. `Win + R` tuşlarına basın
2. `netplwiz` yazın ve Enter'a basın
3. "Kullanıcıların bu bilgisayarı kullanabilmek için bir kullanıcı adı ve parola girmesi gerekir" kutucuğunun işaretini kaldırın
4. Uygula'ya tıklayın, şifrenizi girin ve Tamam'a basın

> **Windows 11 için alternatif:**
> Ayarlar > Hesaplar > Oturum Açma Seçenekleri > "Gelişmiş güvenlik için bu cihazda..."
> seçeneğini kapatın. Ardından `netplwiz` ile devam edin.

### Uyku/Ekran Kapatma Devre Dışı
1. Ayarlar > Sistem > Güç ve Uyku
2. Ekran: **Hiçbir Zaman**
3. Uyku: **Hiçbir Zaman**

### Windows Update Otomatik Yeniden Başlatmayı Devre Dışı Bırak
1. Ayarlar > Windows Update > Gelişmiş Seçenekler
2. "Etkin saatler" ayarlayın (örn: 06:00 - 23:00)

---

## Adım 2: Chrome Ayarları

### İlk kez Chrome'u açın ve:
1. Varsayılan tarayıcı yapın
2. "Oturumu geri yükle" uyarılarını kapatın:
   - `chrome://settings/` adresine gidin
   - Başlangıçta > "Yeni sekme sayfasını aç" seçin

### Chrome Güncellemelerini Sessiz Yapın
Chrome otomatik güncellenir, kiosk modunda sorun çıkarmaz.

---

## Adım 3: Kiosk Scriptlerini Kopyalama

### Startup Klasörüne Erişim
1. `Win + R` tuşlarına basın
2. `shell:startup` yazın ve Enter'a basın
3. Açılan klasöre şu dosyaları kopyalayın:
   - `kiosk-start.bat`
   - `kiosk-watchdog.vbs`

---

## Adım 4: Ek Güvenlik Ayarları (Opsiyonel)

### Görev Çubuğunu Gizle
1. Görev çubuğuna sağ tıklayın > Görev Çubuğu Ayarları
2. "Görev çubuğunu otomatik olarak gizle" seçeneğini açın

### Bildirim Merkezini Kapatma
1. Ayarlar > Sistem > Bildirimler
2. Tüm bildirimleri kapatın

### Fare İmlecini Gizleme (Opsiyonel)
Eğer dokunmatik ekran yoksa ve fare kullanılmayacaksa:
- AutoHideMouseCursor programını indirip Startup'a ekleyebilirsiniz
- https://www.intechopen.com/ adresinden ücretsiz indirilebilir

---

## Adım 5: Test Edin

1. Bilgisayarı yeniden başlatın
2. Otomatik oturum açması gerekir
3. 10-15 saniye sonra Chrome tam ekranda hospisync.cloud açılmalı
4. Chrome'u kapatmayı deneyin - watchdog 15 saniye içinde tekrar açmalı

---

## Sorun Giderme

### Chrome açılmıyor
- Chrome yolunu kontrol edin: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- 32-bit sistemlerde: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
  (Bu durumda .bat dosyasındaki yolu güncelleyin)

### Sayfa yüklenmiyor
- İnternet bağlantısını kontrol edin
- DNS ayarlarını kontrol edin (8.8.8.8 kullanabilirsiniz)
- `kiosk-start.bat` içindeki `timeout` süresini artırın (ör: 30 saniye)

### Kiosk modundan çıkmak
- `Alt + F4` ile Chrome'u kapatın
- Veya `Ctrl + Alt + Delete` > Görev Yöneticisi > Chrome'u sonlandırın

### Chrome "oturumunuz kilitlendi" uyarısı gösteriyor
- `--disable-session-crashed-bubble` parametresi bunu engellemeli
- Sorun devam ederse: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Preferences`
  dosyasında `"exited_cleanly": true` yapın

---

## Alternatif: Microsoft Edge Kiosk (Windows 10/11 Dahili)

Windows 10/11 Pro sürümlerinde dahili kiosk modu var:
1. Ayarlar > Hesaplar > Aile ve diğer kullanıcılar
2. "Bilgi noktası ayarla" bölümüne gidin
3. Microsoft Edge seçin ve URL olarak `https://hospisync.cloud` girin

---

## Toplu Kurulum İpuçları

Birden fazla Mini PC kuruyorsanız:
1. Bir PC'yi yukarıdaki adımlarla kurun
2. Windows Sysprep ile imaj alın
3. İmajı diğer PC'lere klonlayın
- Veya PowerShell remote script ile tüm ayarları otomatik yapın
