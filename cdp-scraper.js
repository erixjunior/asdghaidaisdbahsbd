const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPFacebookScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cdpSession = null;
        this.isLoggedIn = false;
        this.posts = [];
        this.cleanedPosts = [];

        // Clean parsing patterns
        this.initCleaningPatterns();
    }

    initCleaningPatterns() {
        // Patterns untuk filtering noise/UI elements
        this.noisePatterns = [
            // UI elements
            /^(Like|Comment|Share|Follow|More)$/i,
            /^\d+[KM]?\s*(Comments?|Like|Share|Follow)$/i,
            /^(People You May Know|Suggested for you|See all)$/i,
            /^\d+\s*mutual friends?$/i,
            /^(Add Friend|Remove|Block|Report)$/i,
            /^(What's on your mind\?|Photo|Video|Live)$/i,
            /^(Home|Search|Notifications|Menu|Profile)$/i,
            /^(News Feed|Stories|Groups|Pages|Events)$/i,

            // Navigation and interaction elements
            /^(󰍸|󰍹|󰍺|󰞋)/,  // Facebook reaction icons
            /^[\u{1F300}-\u{1F6FF}]+$/u,  // Emoji-only content
            /^\d+$/, // Numbers only (like counts)
            /^\d+[KM]$/, // Like counts (1K, 2M, etc)
            /^(󱘋|🎥|📷|📸|🎵)/, // Media icons

            // Time stamps and metadata
            /^\d+[hmdHMD]$/, // 1h, 2d, 3m ago
            /^(Just now|Yesterday|Today)$/i,
            /^(Sponsored|Promoted|Advertisement)$/i,
            /^(Privacy|Public|Friends|Custom)$/i,

            // Translation metadata
            /^Translated from \w+$/i,
            /^See translation$/i,
            /^Original text$/i,

            // Generic short noise
            /^[\.]{3,}$/, // Three dots or more
            /^[…]+$/, // Ellipsis
            /^[\s\n\r]*$/, // Whitespace only
        ];

        // Patterns untuk identifying real post content
        this.postContentPatterns = [
            // Text that looks like real posts (longer than 20 chars, contains meaningful words)
            /[a-zA-Z]{3,}.*[a-zA-Z]{3,}/, // Contains at least 2 words of 3+ letters
            /[.!?]{1}/, // Contains sentence endings
            /[,:;]/, // Contains punctuation
        ];
    }

    async init() {
        console.log("🚀 Memulai CDP Facebook Scraper (Mobile Mode)...");

        // Launch browser dengan CDP enabled untuk mobile simulation
        this.browser = await chromium.launch({
            headless: process.env.HEADLESS === "true",
            slowMo: parseInt(process.env.SLOW_MO_MS) || 1000,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-plugins",
                // '--disable-images',
                "--disable-javascript-harmony-shipping",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
                "--enable-features=NetworkService,NetworkServiceLogging",
                "--force-color-profile=srgb",
                "--metrics-recording-only",
                "--no-zygote",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-background-networking",
                "--disable-sync",
                "--disable-translate",
                "--hide-scrollbars",
                "--mute-audio",
                "--no-default-browser-check",
                "--safebrowsing-disable-auto-update",
                "--ignore-certificate-errors",
                "--ignore-ssl-errors",
                "--ignore-certificate-errors-spki-list",
                // Mobile-specific args
                "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
                "--window-size=375,667",
                "--mobile-emulation=device=iPhone 8",
                "--enable-touch-events",
                "--disable-touch-adjustment",
            ],
        });

        this.page = await this.browser.newPage();

        // Get CDP session
        this.cdpSession = await this.page.context().newCDPSession(this.page);

        // Enable CDP domains yang diperlukan
        await this.cdpSession.send("Page.enable");
        await this.cdpSession.send("Network.enable");
        await this.cdpSession.send("Runtime.enable");

        // Set stealth properties
        await this.setupStealth();

        // Set viewport untuk mobile portrait
        await this.page.setViewportSize({ width: 375, height: 667 });

        console.log(
            "✅ CDP Browser berhasil diinisialisasi dengan stealth mode (Mobile iPhone Portrait)"
        );
        console.log(
            "📏 Dimensions bar aktif - Double-click untuk toggle, Ctrl+Shift+D untuk hide/show"
        );
    }

    async setupStealth() {
        try {
            // Remove webdriver property
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, "webdriver", {
                    get: () => undefined,
                });

                // Override plugins dengan data yang lebih realistis
                Object.defineProperty(navigator, "plugins", {
                    get: () => [
                        {
                            0: {
                                type: "application/x-google-chrome-pdf",
                                suffixes: "pdf",
                                description: "Portable Document Format",
                                __pluginName: "Chrome PDF Plugin",
                            },
                            description: "Portable Document Format",
                            filename: "internal-pdf-viewer",
                            length: 1,
                            name: "Chrome PDF Plugin",
                        },
                        {
                            0: {
                                type: "application/pdf",
                                suffixes: "pdf",
                                description: "Portable Document Format",
                                __pluginName: "Chrome PDF Viewer",
                            },
                            description: "Portable Document Format",
                            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                            length: 1,
                            name: "Chrome PDF Viewer",
                        },
                    ],
                });

                // Override languages dengan bahasa Indonesia
                Object.defineProperty(navigator, "languages", {
                    get: () => ["id-ID", "id", "en-US", "en"],
                });

                // Override permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) =>
                    parameters.name === "notifications"
                        ? Promise.resolve({ state: Notification.permission })
                        : originalQuery(parameters);

                // Override chrome runtime
                if (window.chrome) {
                    window.chrome.runtime = {};
                }

                // Override permissions
                const originalGetUserMedia = navigator.getUserMedia;
                navigator.getUserMedia = function (constraints) {
                    return new Promise((resolve, reject) => {
                        originalGetUserMedia.call(
                            this,
                            constraints,
                            resolve,
                            reject
                        );
                    });
                };

                // Override screen properties untuk iPhone portrait
                Object.defineProperty(screen, "availHeight", {
                    get: () => 667 - 40, // iPhone 8 height minus status bar
                });

                Object.defineProperty(screen, "availWidth", {
                    get: () => 375,
                });

                Object.defineProperty(screen, "height", {
                    get: () => 667,
                });

                Object.defineProperty(screen, "width", {
                    get: () => 375,
                });

                // Override timezone
                Object.defineProperty(Intl, "DateTimeFormat", {
                    value: class extends Intl.DateTimeFormat {
                        resolvedOptions() {
                            const options = super.resolvedOptions();
                            options.timeZone = "Asia/Jakarta";
                            return options;
                        }
                    },
                });

                // Override battery API
                if ("getBattery" in navigator) {
                    navigator.getBattery = () =>
                        Promise.resolve({
                            charging: true,
                            chargingTime: Infinity,
                            dischargingTime: Infinity,
                            level: 1,
                        });
                }

                // Add responsive dimensions bar
                const dimensionsBar = document.createElement("div");
                dimensionsBar.id = "responsive-dimensions-bar";
                dimensionsBar.innerHTML = `
                    <div id="dimensions-display">
                        <span id="dimensions-text">375 × 667</span>
                        <span id="device-type">📱 Mobile</span>
                    </div>
                `;
                dimensionsBar.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 8px 15px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    z-index: 999999;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border-bottom: 2px solid rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                `;

                const dimensionsDisplay = dimensionsBar.querySelector(
                    "#dimensions-display"
                );
                dimensionsDisplay.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    max-width: 1200px;
                    margin: 0 auto;
                `;

                const dimensionsText =
                    dimensionsBar.querySelector("#dimensions-text");
                dimensionsText.style.cssText = `
                    background: rgba(255,255,255,0.15);
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    border: 1px solid rgba(255,255,255,0.3);
                `;

                const deviceType = dimensionsBar.querySelector("#device-type");
                deviceType.style.cssText = `
                    font-size: 12px;
                    opacity: 0.9;
                    font-weight: 500;
                `;

                document.body.insertBefore(
                    dimensionsBar,
                    document.body.firstChild
                );

                // Function to update dimensions
                function updateDimensions() {
                    const width = window.innerWidth;
                    const height = window.innerHeight;
                    const dimensionsText =
                        document.getElementById("dimensions-text");
                    const deviceType = document.getElementById("device-type");

                    if (dimensionsText && deviceType) {
                        dimensionsText.textContent = `${width} × ${height}`;

                        // Update device type based on width
                        let device = "📱 Mobile";
                        if (width >= 1200) device = "🖥️ Desktop";
                        else if (width >= 768) device = "💻 Tablet";
                        else if (width >= 480) device = "📱 Large Mobile";
                        else device = "📱 Mobile";

                        deviceType.textContent = device;

                        // Update colors based on device type
                        const bar = document.getElementById(
                            "responsive-dimensions-bar"
                        );
                        if (width >= 1200) {
                            bar.style.background =
                                "linear-gradient(90deg, #667eea 0%, #764ba2 100%)";
                        } else if (width >= 768) {
                            bar.style.background =
                                "linear-gradient(90deg, #f093fb 0%, #f5576c 100%)";
                        } else {
                            bar.style.background =
                                "linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)";
                        }
                    }
                }

                // Update dimensions on load and resize
                updateDimensions();
                window.addEventListener("resize", updateDimensions);
                window.addEventListener("orientationchange", () => {
                    setTimeout(updateDimensions, 100);
                });

                // Add toggle functionality with double-click
                dimensionsBar.addEventListener("dblclick", function () {
                    this.style.display =
                        this.style.display === "none" ? "block" : "none";
                });

                // Add keyboard shortcut (Ctrl+Shift+D to toggle)
                document.addEventListener("keydown", function (e) {
                    if (e.ctrlKey && e.shiftKey && e.key === "D") {
                        e.preventDefault();
                        const bar = document.getElementById(
                            "responsive-dimensions-bar"
                        );
                        bar.style.display =
                            bar.style.display === "none" ? "block" : "none";
                    }
                });
            });

            // Set extra headers yang lebih komprehensif untuk mobile
            await this.page.setExtraHTTPHeaders({
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Cache-Control": "max-age=0",
                Pragma: "no-cache",
                "Sec-Ch-Ua":
                    '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
                "Sec-Ch-Ua-Mobile": "?1",
                "Sec-Ch-Ua-Platform": '"iOS"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
                DNT: "1",
            });

            // Intercept and modify requests dengan lebih cerdas
            await this.page.route("**/*", async (route) => {
                const request = route.request();

                // Skip images, fonts, dan media untuk mempercepat loading
                if (
                    ["image", "font", "media", "websocket"].includes(
                        request.resourceType()
                    )
                ) {
                    await route.abort();
                    return;
                }

                // Modify headers untuk request Facebook mobile
                if (request.url().includes("facebook.com")) {
                    await route.continue({
                        headers: {
                            ...request.headers(),
                            Referer: "https://m.facebook.com/",
                            Origin: "https://m.facebook.com",
                            "Sec-Fetch-Site": request.url().includes("login")
                                ? "same-origin"
                                : "same-site",
                            "Sec-Fetch-Mode": "cors",
                            "Sec-Fetch-Dest": "empty",
                        },
                    });
                } else {
                    await route.continue();
                }
            });

            // Set user agent mobile iPhone portrait
            await this.page.setUserAgent(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
            );

            // Set timezone
            await this.page.emulateTimezone("Asia/Jakarta");

            // Set geolocation (Jakarta)
            await this.page.setGeolocation({
                latitude: -6.2088,
                longitude: 106.8456,
            });

            console.log(
                "✅ Stealth mode berhasil diaktifkan dengan pengaturan lengkap"
            );
        } catch (error) {
            console.log(
                "⚠️ Warning: Stealth setup tidak sempurna:",
                error.message
            );
        }
    }

    async login() {
        try {
            console.log(
                "🔐 Mencoba login ke Facebook dengan CDP (Mobile iPhone Portrait)..."
            );

            // Buka halaman login Facebook mobile
            await this.page.goto("https://m.facebook.com/login", {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });

            // Tunggu lebih lama untuk form login muncul
            await this.page.waitForTimeout(3000);

            // Coba beberapa selector untuk email field
            const emailSelectors = [
                '[name="email"]',
                'input[type="email"]',
                'input[placeholder*="email"]',
            ];
            let emailFound = false;

            for (const selector of emailSelectors) {
                try {
                    await this.page.waitForSelector(selector, {
                        timeout: 5000,
                    });
                    console.log(
                        `📧 Email field ditemukan dengan selector: ${selector}`
                    );

                    // Simulasi human behavior sebelum input
                    await this.simulateHumanBehavior();

                    // Clear dan input email dengan delay yang lebih natural
                    await this.page.click(selector);
                    await this.page.keyboard.press("Control+a");
                    await this.page.keyboard.press("Delete");
                    await this.page.keyboard.type(process.env.FACEBOOK_EMAIL, {
                        delay: Math.random() * 10 + 15,
                    });
                    console.log("📧 Email berhasil diinput");
                    emailFound = true;
                    break;
                } catch (error) {
                    console.log(
                        `⚠️ Selector ${selector} tidak ditemukan, mencoba yang lain...`
                    );
                }
            }

            if (!emailFound) {
                console.log("❌ Tidak dapat menemukan field email");
                return false;
            }

            // Tunggu sebentar sebelum input password
            await this.page.waitForTimeout(1000);

            // Coba beberapa selector untuk password field
            const passwordSelectors = [
                '[name="pass"]',
                'input[type="password"]',
                'input[placeholder*="password"]',
            ];
            let passwordFound = false;

            for (const selector of passwordSelectors) {
                try {
                    await this.page.waitForSelector(selector, {
                        timeout: 5000,
                    });
                    console.log(
                        `🔑 Password field ditemukan dengan selector: ${selector}`
                    );

                    // Clear dan input password
                    await this.page.click(selector);
                    await this.page.keyboard.press("Control+a");
                    await this.page.keyboard.press("Delete");
                    await this.page.keyboard.type(
                        process.env.FACEBOOK_PASSWORD,
                        { delay: Math.random() * 10 + 15 }
                    );
                    console.log("🔑 Password berhasil diinput");
                    passwordFound = true;
                    break;
                } catch (error) {
                    console.log(
                        `⚠️ Selector ${selector} tidak ditemukan, mencoba yang lain...`
                    );
                }
            }

            if (!passwordFound) {
                console.log("❌ Tidak dapat menemukan field password");
                return false;
            }

            // Tunggu random delay sebelum klik login
            await this.page.waitForTimeout(2000);

            let loginClicked = false;
            try {
                const selector = '[role="button"]:has-text("Login")';
                const button = await this.page.waitForSelector(selector, {
                    timeout: 5e3,
                });
                if (button) {
                    await button.click();
                    console.log(
                        `✅ Tombol login diklik dengan selector: ${selector}`
                    );
                    loginClicked = true;
                }
            } catch (error) {
                console.log(`⚠️ Gagal klik dengan selector ${selector}`);
            } finally {
                await this.page.waitForTimeout(5e3);
            }

            try {
                const selector = '[role="button"]:has-text("Lain Kali")';
                const button = await this.page.waitForSelector(selector, {
                    timeout: 5e3,
                });
                if (button) {
                    await button.click();
                    console.log(
                        `✅ Tombol "Lain Kali" diklik dengan selector: ${selector}`
                    );
                    loginClicked = true;
                }
            } catch (error) {
                console.log(`⚠️ Gagal klik dengan selector ${selector}`);
            } finally {
                await this.page.waitForTimeout(5e3);
            }

            for (let i = 0; i < 3; i++) {
                try {
                    const selector = '[role="button"]:has-text("Skip")';
                    const button = await this.page.$(selector);
                    if (button) {
                        await button.click();
                        console.log(
                            `✅ Tombol "Skip" diklik dengan selector: ${selector}`
                        );
                    }
                } catch (error) {
                    console.log(`⚠️ Gagal klik dengan selector ${selector}`);
                    break;
                }
            }

            if (!loginClicked) {
                console.log("❌ Tidak dapat menemukan tombol login");
                return false;
            }

            // Tunggu proses login dengan pendekatan yang lebih fleksibel
            console.log("⏳ Menunggu proses login...");

            // Tunggu beberapa detik untuk memungkinkan redirect atau loading
            await this.page.waitForTimeout(5000);

            // Cek apakah ada captcha atau verifikasi tambahan
            const captchaSelectors = [
                '[data-testid="captcha"]',
                ".captcha",
                '[aria-label*="verification"]',
                'input[placeholder*="code"]',
                'input[name*="code"]',
            ];

            for (const selector of captchaSelectors) {
                try {
                    const captchaElement = await this.page.$(selector);
                    if (captchaElement) {
                        console.log(
                            "⚠️ Terdeteksi captcha atau verifikasi tambahan"
                        );
                        console.log(
                            "💡 Silakan selesaikan verifikasi secara manual di browser yang terbuka"
                        );
                        console.log(
                            "⏳ Menunggu 60 detik untuk verifikasi manual..."
                        );

                        // Tunggu lebih lama untuk verifikasi manual
                        await this.page.waitForTimeout(60000);

                        // Cek lagi setelah verifikasi manual
                        const stillHasCaptcha = await this.page.$(selector);
                        if (stillHasCaptcha) {
                            console.log("❌ Verifikasi masih diperlukan");
                            return false;
                        }
                        break;
                    }
                } catch (error) {
                    // Continue checking other selectors
                }
            }

            // Cek status login dengan berbagai cara
            const isLoggedIn = await this.checkLoginStatus();

            if (isLoggedIn) {
                this.isLoggedIn = true;
                console.log("✅ Login berhasil dengan CDP (Mobile iPhone)!");
                return true;
            } else {
                console.log(
                    "❌ Login gagal, cek kredensial atau ada captcha/verifikasi"
                );
                console.log("💡 Tips:");
                console.log("   - Pastikan kredensial benar");
                console.log("   - Cek apakah akun memiliki 2FA");
                console.log(
                    "   - Facebook mungkin mendeteksi aktivitas otomatis"
                );
                console.log("   - Coba login manual terlebih dahulu");

                // Screenshot untuk debugging
                try {
                    await this.page.screenshot({
                        path: "login_failed.png",
                        fullPage: true,
                    });
                    console.log(
                        "📸 Screenshot disimpan sebagai login_failed.png"
                    );
                } catch (error) {
                    console.log("⚠️ Gagal menyimpan screenshot");
                }

                return false;
            }
        } catch (error) {
            console.error("❌ Error saat login:", error.message);

            // Screenshot untuk debugging
            try {
                await this.page.screenshot({
                    path: "login_error.png",
                    fullPage: true,
                });
                console.log(
                    "📸 Screenshot error disimpan sebagai login_error.png"
                );
            } catch (screenshotError) {
                console.log("⚠️ Gagal menyimpan screenshot error");
            }

            return false;
        }
    }

    async simulateHumanBehavior() {
        try {
            // Random mouse movements
            const viewport = this.page.viewportSize();
            for (let i = 0; i < 3; i++) {
                const x = Math.random() * viewport.width;
                const y = Math.random() * viewport.height;
                await this.page.mouse.move(x, y);
                await this.page.waitForTimeout(Math.random() * 500 + 200);
            }

            // Random scroll
            await this.page.evaluate(() => {
                window.scrollBy(0, Math.random() * 100);
            });

            await this.page.waitForTimeout(Math.random() * 1000 + 500);
        } catch (error) {
            // Ignore errors in human simulation
        }
    }

    async checkLoginStatus() {
        try {
            // Cek beberapa indikator login untuk mobile
            // cek div dengan role button dan aria-label Facebook Menu
            const loginButton = await this.page.$(
                '[role="button"]:has-text("Login")'
            );
            const menuButton = await this.page.$(
                '[role="button"][aria-label*="Facebook Menu"]'
            );
            const homeLink = await this.page.$(
                '[role=button][aria-label="Facebook logo"]'
            );
            const profileLink = await this.page.$(
                '[role=button][aria-label*="Go to profile"]'
            );
            const searchBox = await this.page.$(
                '[role=button][aria-label="Search Facebook"]'
            );

            // Jika tidak ada tombol login dan ada elemen yang menunjukkan sudah login
            return (
                !loginButton &&
                (profileLink || homeLink || searchBox || menuButton)
            );
        } catch (error) {
            return false;
        }
    }

    async scrapeStatus(targetUrl = null) {
        if (!this.isLoggedIn) {
            console.log("❌ Harus login terlebih dahulu");
            return [];
        }

        try {
            const url = targetUrl || "https://m.facebook.com/";
            console.log(`📱 Membuka halaman: ${url}`);

            if (this.page.url() !== url) {
                await this.page.goto(url, {
                    waitUntil: "networkidle",
                    timeout: 30000,
                });
            }

            // Tunggu content dimuat
            await this.page.waitForTimeout(5000);

            // Scroll untuk memuat lebih banyak post
            await this.autoScroll();

            // Scrape status posts with advanced cleaning
            const posts = await this.extractPostsWithAdvancedCleaning();

            console.log(`✅ Berhasil scrape ${posts.length} clean status`);
            this.posts = posts;
            this.cleanedPosts = posts; // Store cleaned posts
            return posts;
        } catch (error) {
            console.error("❌ Error saat scraping status:", error.message);
            return [];
        }
    }

    async autoScroll() {
        console.log(
            "📜 Melakukan auto-scroll untuk memuat lebih banyak post..."
        );

        const maxPosts = parseInt(process.env.MAX_POSTS_TO_SCRAPE) || 50;
        let loadedPosts = 0;
        let previousHeight = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = 25;

        while (loadedPosts < maxPosts && scrollAttempts < maxScrollAttempts) {
            // Scroll dengan smooth scroll dan random distance
            const scrollDistance = Math.floor(Math.random() * 400) + 600;
            await this.page.evaluate((distance) => {
                window.scrollBy({
                    top: distance,
                    behavior: "smooth",
                });
            }, scrollDistance);

            // Tunggu content baru dimuat dengan random delay
            const delay =
                Math.floor(Math.random() * 1000) +
                parseInt(process.env.SCRAPE_DELAY_MS) || 2000;
            await this.page.waitForTimeout(delay);

            // Hitung jumlah post yang sudah dimuat (berdasarkan struktur m.facebook.com)
            const currentPosts = await this.page.$$(
                '[data-mcomponent="MContainer"]:has([data-mcomponent="TextArea"]), [data-testid="post_message"], [data-testid="post_text"], .userContent, .post-content, [data-nt="NT:TEXT"]'
            );
            loadedPosts = currentPosts.length;

            // Cek apakah scroll sudah mencapai bottom
            const currentHeight = await this.page.evaluate(
                () => document.body.scrollHeight
            );
            if (currentHeight === previousHeight) {
                scrollAttempts++;
            } else {
                scrollAttempts = 0;
            }

            previousHeight = currentHeight;
            console.log(
                `📊 Post yang sudah dimuat: ${loadedPosts}, Scroll attempt: ${scrollAttempts}`
            );

            // Jika sudah 3 kali scroll tanpa perubahan, berhenti
            if (scrollAttempts >= 3) {
                console.log(
                    "📄 Sudah mencapai akhir halaman atau tidak ada content baru"
                );
                break;
            }
        }
    }

    async extractPostsAdvanced() {
        try {
            // Filter elemen berdasarkan container yang memiliki div[role="button"] sebagai child
            const containerElements = await this.page.$$('[data-mcomponent="MContainer"]');
            console.log(`🔍 Found ${containerElements.length} valid post containers with role="button"`);

            let posts = [];
            const processedContainers = new Set();

            for (let i = 0; i < containerElements.length; i++) {
                const container = containerElements[i];

                try {
                    // Get container identifier untuk avoid duplicate processing
                    const containerId = await container.getAttribute('id') || `container_${i}`;
                    if (processedContainers.has(containerId)) continue;

                    processedContainers.add(containerId);

                    // Extract post data from this specific container
                    const postData = await container.evaluate((containerEl, index) => {
                        // Pastikan ini adalah container yang valid (memiliki div[role="button"] sebagai child)
                        // const roleButtonChild = containerEl.querySelector(':scope > div[role="button"]');
                        // if (!roleButtonChild) return null;

                        // Look for text content in this container only - ambil yang pertama saja
                        const textAreas = containerEl.querySelectorAll('[data-mcomponent="TextArea"]');

                        if (textAreas.length === 0) return null;

                        // Ambil TextArea pertama yang mengandung span.f1 dengan content yang valid
                        let text = '';
                        let validTextArea = null;

                        for (const textArea of textAreas) {
                            const spanF1 = textArea.querySelector('span.f1');
                            if (spanF1) {
                                const candidateText = spanF1.textContent?.trim();
                                // Skip jika ini adalah text terjemahan, metadata, atau like info
                                if (candidateText &&
                                    candidateText.length > 15 && // Minimum length untuk post content
                                    !candidateText.includes('Translated from') &&
                                    !candidateText.includes('See translation') &&
                                    !candidateText.includes('Original text') &&
                                    !candidateText.includes(' and ') && // Skip "X and Y others" 
                                    !candidateText.includes(' others') && // Skip like counts
                                    !candidateText.includes(' mutual friends') && // Skip friend suggestions
                                    !candidateText.includes(' reacted to this') && // Skip reaction info
                                    !candidateText.match(/^\d+[hmdHMD](\s+(ago|lalu))?$/i) && // Skip timestamp like "2h ago"
                                    !candidateText.match(/^(Like|Comment|Share|Follow|More|See All)$/i) &&
                                    !candidateText.match(/^\w+\s+\w+\s+and\s+\d+\s+others?$/i) && // Skip "Name Name and X others"
                                    !candidateText.match(/^\d+\s*(like|comment|share)s?$/i)) { // Skip "5 likes", "3 comments"

                                    text = candidateText;
                                    validTextArea = textArea;
                                    break; // Ambil yang pertama yang valid, skip yang lainnya
                                }
                            }
                        }

                        if (!text || !validTextArea) return null;

                        // Find author in this container
                        let author = '';
                        const authorElements = containerEl.querySelectorAll('span.f2.a, h3 a, h4 a');
                        for (const authorEl of authorElements) {
                            const candidateAuthor = authorEl.textContent?.trim();
                            if (candidateAuthor && candidateAuthor.length > 0) {
                                author = candidateAuthor;
                                break;
                            }
                        }

                        // Find timestamp
                        let timestamp = '';
                        const timeElement = containerEl.querySelector('time, abbr');
                        if (timeElement) {
                            timestamp = timeElement.getAttribute('datetime') ||
                                timeElement.getAttribute('title') ||
                                timeElement.textContent || '';
                        }

                        return {
                            id: `container_post_${index}`,
                            text: text,
                            author: author,
                            timestamp: timestamp,
                            url: window.location.href,
                            selector: 'MContainer[role-button-child]'
                        };
                    }, i);

                    if (postData && postData.text) {
                        posts.push(postData);
                        console.log(`📝 Extracted from valid container ${i}: "${postData.text.substring(0, 50)}..." (Author: ${postData.author || 'N/A'})`);
                    }

                } catch (error) {
                    console.log(`⚠️ Error processing container ${i}:`, error.message);
                }
            }

            console.log(`✅ Extracted ${posts.length} posts from ${containerElements.length} valid containers`);
            return posts;

        } catch (error) {
            console.error("❌ Error saat extract posts:", error.message);
            return [];
        }
    }

    // Clean parsing methods
    isNoiseContent(text) {
        if (!text || typeof text !== 'string') return true;

        const cleanText = text.trim();

        // Check length - too short is likely noise
        if (cleanText.length < 10) return true;

        // Check against noise patterns
        for (const pattern of this.noisePatterns) {
            if (pattern.test(cleanText)) {
                return true;
            }
        }

        return false;
    }

    isRealPostContent(text) {
        if (!text || typeof text !== 'string') return false;

        const cleanText = text.trim();

        // Must be at least 15 characters
        if (cleanText.length < 15) return false;

        // Check if it contains meaningful content patterns
        for (const pattern of this.postContentPatterns) {
            if (pattern.test(cleanText)) {
                return true;
            }
        }

        // If no pattern matches, it's not real content
        return false;
    }

    cleanText(text) {
        if (!text) return '';

        return text
            .trim()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
            .replace(/[^\S\r\n]+/g, ' ') // Normalize spaces but keep line breaks
            .trim();
    }

    calculateConfidence(text) {
        let confidence = 0;

        // Length bonus
        if (text.length > 50) confidence += 0.3;
        if (text.length > 100) confidence += 0.2;

        // Sentence structure bonus
        if (text.includes('.') || text.includes('!') || text.includes('?')) confidence += 0.2;

        // Multiple sentences bonus
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        if (sentences.length > 1) confidence += 0.2;

        // Pattern matching bonus
        for (const pattern of this.postContentPatterns) {
            if (pattern.test(text)) {
                confidence += 0.1;
                break; // Only add bonus once
            }
        }

        return Math.min(confidence, 1.0); // Cap at 1.0
    }

    async extractPostsWithAdvancedCleaning() {
        try {
            console.log('🧹 Starting advanced post extraction with cleaning...');

            const rawPosts = await this.extractPostsAdvanced();
            console.log(`📝 Extracted ${rawPosts.length} raw posts`);

            if (rawPosts.length === 0) {
                console.log('⚠️  No raw posts found');
                return [];
            }

            // Clean posts with advanced filtering
            const cleanedPosts = [];
            const duplicateTracker = new Set();

            for (let i = 0; i < rawPosts.length; i++) {
                const post = rawPosts[i];
                const originalText = post.text || '';

                // Skip if it's noise content
                if (this.isNoiseContent(originalText)) {
                    console.log(`⏭️  Skipped noise: "${originalText.substring(0, 50)}..."`);
                    continue;
                }

                // Check if it's real post content
                if (!this.isRealPostContent(originalText)) {
                    console.log(`⏭️  Skipped non-content: "${originalText.substring(0, 50)}..."`);
                    continue;
                }

                // Clean the text
                const cleanText = this.cleanText(originalText);

                // Simple duplicate detection based on clean text
                if (duplicateTracker.has(cleanText.toLowerCase())) {
                    console.log(`⏭️  Skipped duplicate: "${cleanText.substring(0, 50)}..."`);
                    continue;
                }
                duplicateTracker.add(cleanText.toLowerCase());

                // Enhanced author extraction using current page context
                let enhancedAuthor = post.author || '';
                if (!enhancedAuthor || enhancedAuthor.length < 2) {
                    try {
                        enhancedAuthor = await this.extractAuthorForPost(cleanText);
                    } catch (error) {
                        console.log(`⚠️  Could not enhance author for post: ${error.message}`);
                    }
                }

                // Skip post if no author found
                if (!enhancedAuthor || enhancedAuthor.trim().length === 0) {
                    console.log(`⏭️  Skipped no author: "${cleanText.substring(0, 50)}..."`);
                    continue;
                }

                // Filter out unwanted selectors from being saved
                let cleanSelector = post.selector || '';
                const unwantedSelectors = [
                    'div[data-mcomponent="MContainer"] [data-mcomponent="TextArea"] div[dir="auto"]'
                ];

                if (unwantedSelectors.some(selector => cleanSelector.includes(selector))) {
                    cleanSelector = ''; // Don't save unwanted selectors
                }

                // Create cleaned post object
                const cleanedPost = {
                    id: `clean_post_${cleanedPosts.length + 1}`,
                    originalId: post.id,
                    text: cleanText,
                    author: enhancedAuthor,
                    timestamp: post.timestamp || '',
                    url: post.url || '',
                    selector: cleanSelector,
                    confidence: this.calculateConfidence(cleanText),
                    originalIndex: i
                };

                cleanedPosts.push(cleanedPost);
                console.log(`✅ Added clean post ${cleanedPosts.length}: "${cleanText.substring(0, 60)}..." (Author: ${enhancedAuthor || 'N/A'}) [Confidence: ${cleanedPost.confidence.toFixed(2)}]`);
            }

            this.cleanedPosts = cleanedPosts;
            console.log(`\n🎉 Advanced cleaning complete! Found ${cleanedPosts.length} clean posts out of ${rawPosts.length} raw posts.`);

            return cleanedPosts;

        } catch (error) {
            console.error('❌ Error in advanced post extraction:', error.message);
            return [];
        }
    }

    async extractAuthorForPost(postText) {
        try {
            // Try to find author context for specific post text
            const authorInfo = await this.page.evaluate((searchText) => {
                // Search for elements containing the post text
                const textElements = Array.from(document.querySelectorAll('span.f1')).filter(el =>
                    el.textContent && el.textContent.trim() === searchText
                );

                for (const textEl of textElements) {
                    let container = textEl.closest('[data-mcomponent="MContainer"]') || textEl.closest('.m');

                    // Search up the DOM tree for author
                    for (let i = 0; i < 5; i++) {
                        if (!container) break;

                        const authorEl = container.querySelector('span.f2.a[role="link"][data-focusable="true"]')
                        // <span class="f2 a" data-action-id="32577" tabindex="0" role="link" data-focusable="true">Fansleslar</span>
                        if (authorEl) {
                            return authorEl.textContent?.trim();
                        }

                        container = container.parentElement;
                    }
                }

                return '';
            }, postText.substring(0, 100)); // Limit search text for performance

            return authorInfo || '';

        } catch (error) {
            console.log(`⚠️  Error extracting author for post: ${error.message}`);
            return '';
        }
    }

    async saveToFile(posts, filename = "facebook_posts_cdp.json") {
        try {
            // Calculate stats for cleaned posts
            const stats = this.calculateCleaningStats(posts);

            const data = {
                scrapedAt: new Date().toISOString(),
                totalPosts: posts.length,
                source:
                    process.env.TARGET_PROFILE_URL ||
                    "https://m.facebook.com/me",
                method: "CDP Session (Mobile) + Advanced Cleaning",
                cleaningStats: stats,
                posts: posts,
            };

            fs.writeFileSync(filename, JSON.stringify(data, null, 2));
            console.log(`💾 Clean data berhasil disimpan ke ${filename}`);

            // Juga buat file CSV untuk analisis
            await this.saveToCSV(posts, filename.replace(".json", ".csv"));

            // Save cleaning report
            await this.saveCleaningReport(stats, filename.replace(".json", "_report.json"));
        } catch (error) {
            console.error("❌ Error saat menyimpan file:", error.message);
        }
    }

    calculateCleaningStats(cleanedPosts) {
        const totalCleaned = cleanedPosts.length;

        const qualityDistribution = {
            highConfidence: cleanedPosts.filter(p => p.confidence >= 0.8).length,
            mediumConfidence: cleanedPosts.filter(p => p.confidence >= 0.5 && p.confidence < 0.8).length,
            lowConfidence: cleanedPosts.filter(p => p.confidence < 0.5).length
        };

        const topPosts = cleanedPosts
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10)
            .map((post, index) => ({
                rank: index + 1,
                confidence: post.confidence.toFixed(2),
                text: post.text.substring(0, 100) + (post.text.length > 100 ? '...' : ''),
                author: post.author,
                timestamp: post.timestamp
            }));

        return {
            summary: {
                cleanedPosts: totalCleaned,
                processingDate: new Date().toISOString(),
                method: "CDP Session (Mobile) + Advanced Cleaning"
            },
            topPosts: topPosts,
            qualityDistribution: qualityDistribution,
            authorStats: this.calculateAuthorStats(cleanedPosts)
        };
    }

    calculateAuthorStats(posts) {
        const authorCounts = {};
        let postsWithAuthor = 0;

        posts.forEach(post => {
            if (post.author && post.author.trim().length > 0) {
                postsWithAuthor++;
                authorCounts[post.author] = (authorCounts[post.author] || 0) + 1;
            }
        });

        const topAuthors = Object.entries(authorCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([author, count]) => ({ author, postCount: count }));

        return {
            totalAuthors: Object.keys(authorCounts).length,
            postsWithAuthor: postsWithAuthor,
            postsWithoutAuthor: posts.length - postsWithAuthor,
            authorCoverage: ((postsWithAuthor / posts.length) * 100).toFixed(1) + '%',
            topAuthors: topAuthors
        };
    }

    async saveCleaningReport(stats, filename) {
        try {
            fs.writeFileSync(filename, JSON.stringify(stats, null, 2));
            console.log(`📊 Cleaning report saved to ${filename}`);
        } catch (error) {
            console.error("❌ Error saving cleaning report:", error.message);
        }
    }

    async saveToCSV(posts, filename) {
        try {
            let csvContent = "ID,Text,Timestamp,Author,Selector,URL,Confidence\n";

            posts.forEach((post) => {
                const text = (post.text || "").replace(/"/g, '""'); // Escape quotes
                const timestamp = post.timestamp || "";
                const author = (post.author || "").replace(/"/g, '""');
                const selector = post.selector || "";
                const url = post.url || "";
                const confidence = post.confidence ? post.confidence.toFixed(2) : "0.00";

                csvContent += `"${post.id}","${text}","${timestamp}","${author}","${selector}","${url}","${confidence}"\n`;
            });

            fs.writeFileSync(filename, csvContent);
            console.log(`📊 Data CSV berhasil disimpan ke ${filename}`);
        } catch (error) {
            console.error("❌ Error saat menyimpan CSV:", error.message);
        }
    }

    async toggleDimensionsBar(show = null) {
        try {
            const isVisible = await this.page.evaluate(() => {
                const bar = document.getElementById(
                    "responsive-dimensions-bar"
                );
                if (!bar) return false;
                return bar.style.display !== "none";
            });

            const shouldShow = show !== null ? show : !isVisible;

            await this.page.evaluate((show) => {
                const bar = document.getElementById(
                    "responsive-dimensions-bar"
                );
                if (bar) {
                    bar.style.display = show ? "block" : "none";
                }
            }, shouldShow);

            console.log(
                `${shouldShow ? "✅" : "❌"} Dimensions bar ${shouldShow ? "ditampilkan" : "disembunyikan"
                }`
            );
            return shouldShow;
        } catch (error) {
            console.log("⚠️ Error saat toggle dimensions bar:", error.message);
            return false;
        }
    }

    async close() {
        if (this.browser) {
            try {
                await this.browser.close();
                console.log("🔒 Browser berhasil ditutup");
            } catch (error) {
                console.log("⚠️ Error saat menutup browser:", error.message);
            }
        }
    }
}

module.exports = CDPFacebookScraper;
