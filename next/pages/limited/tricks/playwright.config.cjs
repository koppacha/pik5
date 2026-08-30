const path = require("path")
const {defineConfig, devices} = require("@playwright/test")

const baseURL = process.env.TRICKS_E2E_BASE_URL || "http://localhost:3000"
const shouldStartServer = process.env.TRICKS_E2E_START_SERVER === "1"
const executablePath = process.env.TRICKS_E2E_CHROME_EXECUTABLE

module.exports = defineConfig({
    testDir: "./tests",
    testMatch: "*.spec.cjs",
    timeout: 30000,
    expect: {
        timeout: 10000,
    },
    outputDir: path.join(__dirname, "output/playwright/results"),
    fullyParallel: false,
    reporter: process.env.CI ? "github" : [["list"], ["html", {
        open: "never",
        outputFolder: path.join(__dirname, "output/playwright/report"),
    }]],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        launchOptions: executablePath ? {executablePath} : undefined,
    },
    projects: [
        {
            name: "chromium",
            use: {...devices["Desktop Chrome"]},
        },
    ],
    webServer: shouldStartServer
        ? {
            command: "yarn dev -H 0.0.0.0",
            url: baseURL,
            reuseExistingServer: true,
            timeout: 120000,
        }
        : undefined,
})
