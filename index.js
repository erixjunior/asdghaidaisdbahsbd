const CDPFacebookScraper = require("./cdp-scraper");

async function main() {
    const scraper = new CDPFacebookScraper();

    try {
        console.log(
            "🎯 Facebook Status Scraper - CDP Stealth Version (Mobile iPhone Portrait)"
        );
        console.log("================================================\n");

        // Inisialisasi browser dengan CDP
        await scraper.init();

        // Login ke Facebook dengan CDP
        const loginSuccess = await scraper.login();
        if (!loginSuccess) {
            console.log("❌ Tidak bisa melanjutkan tanpa login");
            console.log("💡 Kemungkinan penyebab:");
            console.log("   - Kredensial Facebook salah");
            console.log("   - Ada captcha atau verifikasi 2FA");
            console.log("   - Facebook mendeteksi aktivitas otomatis");
            console.log("   - Koneksi internet lambat");
            console.log(
                "\n🔍 Cek file login_failed.png atau login_error.png untuk detail lebih lanjut"
            );
            return;
        }

        console.log(
            "\n🎉 Login berhasil dengan CDP (Mobile iPhone Portrait)! Sekarang akan melakukan scraping...\n"
        );

        // Tunggu sebentar setelah login
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Scrape status dari beranda/feed
        console.log("🏠 Scraping status dari beranda/feed...");
        const feedPosts = await scraper.scrapeStatus();

        if (feedPosts.length > 0) {
            console.log(
                `\n📋 Berhasil scrape ${feedPosts.length} status dari beranda/feed`
            );

            // Simpan hasil
            await scraper.saveToFile(feedPosts, "facebook_feed_posts_cdp.json");

            // Tampilkan preview
            console.log("\n Preview hasil scraping:");
            feedPosts.slice(0, 5).forEach((post, index) => {
                console.log(`\n--- Post ${index + 1} ---`);
                console.log(`Author: ${post.author || "Unknown"}`);
                console.log(
                    `Text: ${post.text.substring(0, 150)}${
                        post.text.length > 150 ? "..." : ""
                    }`
                );
                console.log(`Timestamp: ${post.timestamp || "Unknown"}`);
                console.log(`Selector: ${post.selector}`);
            });

            if (feedPosts.length > 5) {
                console.log(`\n... dan ${feedPosts.length - 5} post lainnya`);
            }
        } else {
            console.log("❌ Tidak ada post yang berhasil di-scrape");
        }

        console.log("\n✅ Scraping selesai dengan CDP!");
        console.log("📁 File hasil scraping:");
        console.log("   - my_facebook_posts_cdp.json (dan .csv)");
        if (
            process.env.TARGET_PROFILE_URL &&
            process.env.TARGET_PROFILE_URL !==
                "https://www.facebook.com/username"
        ) {
            console.log("   - target_profile_posts_cdp.json (dan .csv)");
        }

        console.log("\n🔒 Keunggulan CDP Scraper (Mobile iPhone Portrait):");
        console.log(
            "   - Menggunakan m.facebook.com untuk kompatibilitas mobile"
        );
        console.log(
            "   - Simulasi perangkat iPhone 8 dengan orientasi portrait"
        );
        console.log("   - Viewport 375x667 pixels untuk responsive design");
        console.log("   - 📏 Dimensions bar untuk monitoring ukuran real-time");
        console.log("   - Anti-deteksi bot yang lebih kuat");
        console.log("   - Stealth mode dengan human behavior simulation");
        console.log("   - CDP session untuk kontrol browser yang lebih dalam");
        console.log("   - Request interception dan modification");
        console.log("   - Random delays dan movements");
    } catch (error) {
        console.error("\n❌ Error utama:", error.message);
        console.error("Stack trace:", error.stack);
    } finally {
        await scraper.close();
        console.log("\n🔒 CDP Scraper ditutup");
    }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    process.exit(1);
});

// Jalankan script jika file ini dijalankan langsung
if (require.main === module) {
    main().catch(console.error);
}

module.exports = CDPFacebookScraper;
