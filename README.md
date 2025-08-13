# Google Ads Davet Paneli (cPanel Uyumlu)

Profesyonel, cPanel uyumlu bir web panel ile Google Ads hesap(lar)ınıza e-posta davetleri gönderebilirsiniz. Varsayılan rol Read Only (sadece izleme) olacak şekilde tasarlanmıştır.

## Özellikler
- AdminLTE tabanlı modern arayüz
- Birden fazla e-posta ile davet
- Rol seçimi: read_only, email_only, standard, admin
- cPanel Python App ve Passenger ile uyumlu (passenger_wsgi.py)

## Kurulum (Geliştirme Ortamı)
1. Python sanal ortam oluşturun ve bağımlılıkları kurun:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. .env dosyasını düzenleyin:
   - `GOOGLE_ADS_DEVELOPER_TOKEN` (zorunlu)
   - `GOOGLE_ADS_OAUTH_CLIENT_ID`, `GOOGLE_ADS_OAUTH_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` (zorunlu)
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC kullanıyorsanız önerilir)
   - `GOOGLE_ADS_DEFAULT_CUSTOMER_ID` (formda otomatik dolum için)
3. Uygulamayı çalıştırın:
   ```bash
   FLASK_APP=app.main flask run -h 0.0.0.0 -p 8000
   ```

## cPanel'de Yayınlama (Python App)
1. cPanel > Setup Python App bölümünden yeni bir uygulama oluşturun (ör. Python 3.10+).
2. Uygulama kök klasörü olarak bu projenin bulunduğu dizini seçin.
3. `Requirements.txt` yolunu belirtip bağımlılıkları kurdurun.
4. WSGI entrypoint olarak `passenger_wsgi.py` seçin. Application object adı `application` olarak ayarlanmıştır.
5. Ortam değişkenlerine `.env` içeriğini girin veya `.env` dosyasını sunucuya yükleyin.
6. Uygulamayı başlatın ve panel URL'sine gidin.

## CLI (Opsiyonel)
Komut satırından davet göndermek için:
```bash
env $(grep -v '^#' .env | xargs) \
python3 scripts/invite_readonly_users.py \
  --customer-id 123-456-7890 \
  --emails user1@example.com user2@example.com \
  --access-role read_only
```

## Notlar
- Google Ads API ile davet göndermek için OAuth2 kimlik bilgileri zorunludur. Yalnızca Developer Token yeterli değildir.
- cPanel ortamında HTTP Basic Auth etkinleştirmek için `.env` içinde `PANEL_BASIC_AUTH_USERNAME` ve `PANEL_BASIC_AUTH_PASSWORD` değerlerini tanımlayın.