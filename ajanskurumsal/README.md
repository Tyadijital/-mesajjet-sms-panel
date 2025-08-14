# AjansKurumsal

Benzersiz temalı ajans ve kurumsal web sitesi. Sıfır bağımlılık Node.js sunucu, dosya tabanlı içerik ve dahili admin panel içerir.

## Çalıştırma

```bash
cd ajanskurumsal
pnpm start # veya: npm start, ya da: node server.js
```

İlk kurulum için yönetici hesabı otomatik oluşturulur. Konsolda tek seferlik şifre gösterilir ve `data/first-run.txt` içinde saklanır.

- Varsayılan kullanıcı adı: `admin`
- Şifre: ilk çalıştırmada üretilecektir.

Geliştirme modu:

```bash
pnpm dev
```

## Dizim

- `server.js`: Uygulama sunucusu ve yönlendirmeler
- `public/`: Statik dosyalar (CSS/JS/medya)
- `data/`: İçerik, mesajlar ve yönetici bilgileri (otomatik oluşturulur)

## Özellikler

- Özel, kimsede olmayan neon-dalga teması
- Çok sayfalı kurumsal yapı: Anasayfa, Hizmetler, Portfolyo, Hakkımızda, İletişim
- Dosya tabanlı içerik yönetimi (JSON)
- Dahili admin panel (içerik ve ayarlar), şifre değiştirme
- İletişim formu ve mesaj kutusu

## Notlar

- Bu proje harici bağımlılık kullanmaz. Node.js built-in modülleri ile çalışır.
- Üretimde ters proxy (Nginx) arkasında çalıştırmanızı öneririz.