# Facebook Status Scraper

Project ini adalah tool untuk melakukan scraping status Facebook menggunakan Playwright. Tool ini dapat login ke Facebook dan melakukan scraping status dari profile feed.

## Fitur

- ✅ Login otomatis ke Facebook
- ✅ Scraping status dari feed
- ✅ Auto-scroll untuk memuat lebih banyak post
- ✅ Export ke format JSON dan CSV
- ✅ Anti-deteksi bot dengan user agent dan delay realistic
- ✅ Error handling yang robust
- ✅ Konfigurasi yang fleksibel

## Instalasi

1. **Clone atau download project ini**

2. **Install dependencies:**
```bash
npm install
```

3. **Install browser Playwright:**
```bash
npm run install-browsers
```

4. **Setup environment variables:**
   - Copy file `env.example` menjadi `.env`
   - Edit file `.env` dengan kredensial Facebook Anda

## Konfigurasi

Edit file `.env` dengan informasi berikut:

```env
# Facebook Login Credentials
FACEBOOK_EMAIL=your_email@example.com
FACEBOOK_PASSWORD=your_password

# Scraping Configuration
MAX_POSTS_TO_SCRAPE=50
SCRAPE_DELAY_MS=2000

# Browser Configuration
HEADLESS=false
SLOW_MO_MS=1000
```

### Penjelasan Konfigurasi:

- `FACEBOOK_EMAIL`: Email Facebook Anda
- `FACEBOOK_PASSWORD`: Password Facebook Anda
- `MAX_POSTS_TO_SCRAPE`: Jumlah maksimal post yang akan di-scrape
- `SCRAPE_DELAY_MS`: Delay antara scroll (dalam milidetik)
- `HEADLESS`: `true` untuk mode headless, `false` untuk melihat browser
- `SLOW_MO_MS`: Delay antara aksi untuk simulasi manusia

## Penggunaan

### 1. Basic Scraper

```bash
npm start
```

## Output

Script akan menghasilkan file:

1. **JSON file** - Data lengkap dalam format JSON
2. **CSV file** - Data dalam format CSV untuk analisis

### Format Data JSON:

```json
{
  "scrapedAt": "2024-01-15T10:30:00.000Z",
  "totalPosts": 25,
  "source": "https://www.facebook.com/me",
  "posts": [
    {
      "id": "post_message_1",
      "text": "Isi status Facebook...",
      "timestamp": "2024-01-15T10:00:00.000Z",
      "author": "Nama User",
      "selector": "[data-testid=\"post_message\"]",
      "url": "https://www.facebook.com/me"
    }
  ]
}
```

## Struktur Project

```
facebook-scraper/
├── index.js              # Basic scraper
├── scraper.js            # Advanced scraper
├── run-advanced.js       # Runner untuk advanced scraper
├── package.json          # Dependencies dan scripts
├── env.example           # Template environment variables
└── README.md            # Dokumentasi ini
```

## Troubleshooting

### 1. Login Gagal
- Pastikan email dan password benar
- Cek apakah ada 2FA yang aktif
- Coba buka Facebook manual untuk memastikan akun tidak diblokir

### 2. Tidak Ada Post yang Di-scrape
- Facebook mungkin mengubah struktur HTML
- Coba ubah selector di `scraper.js`
- Pastikan profile target dapat diakses

### 3. Error Browser
- Jalankan `npm run install-browsers`
- Pastikan ada cukup memory untuk browser
- Coba set `HEADLESS=true` di `.env`

### 4. Rate Limiting
- Facebook mungkin mendeteksi aktivitas bot
- Tambah delay yang lebih besar di `SCRAPE_DELAY_MS`
- Gunakan `SLOW_MO_MS` yang lebih tinggi

## Keamanan

⚠️ **Peringatan Penting:**

1. **Jangan share kredensial Facebook** Anda
2. **Gunakan dengan bijak** - jangan spam atau abuse
3. **Respect privacy** pengguna lain
4. **Ikuti Terms of Service** Facebook
5. **Gunakan untuk tujuan edukasi** atau research yang legitimate

## Legal Disclaimer

Tool ini dibuat untuk tujuan edukasi dan research. Pengguna bertanggung jawab penuh atas penggunaan tool ini dan harus mematuhi:

- Terms of Service Facebook
- Hukum privasi data yang berlaku
- Etika scraping dan data collection

## Support

Jika ada masalah atau pertanyaan:

1. Cek troubleshooting section di atas
2. Pastikan semua dependencies terinstall
3. Cek console output untuk error messages
4. Pastikan kredensial Facebook valid

## Changelog

### v1.0.0
- Initial release
- Basic Facebook login dan scraping
- Export ke JSON dan CSV
- Advanced anti-deteksi features
